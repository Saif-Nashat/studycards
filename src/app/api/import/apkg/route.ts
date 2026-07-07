import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { quotaError } from "@/lib/storage";
import { bucketsFromAnkiTags } from "@/lib/tags";
import { createHash } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 60;

// Receives one BATCH of an .apkg import, not the file itself.
//
// The deck is unzipped, read and image-shrunk in the browser (src/lib/
// apkgClient.ts) because Vercel rejects any request body over ~4.5 MB with a
// bare 413 — a whole deck can never reach this route. The client posts:
//
//   { deckName, cards: [{ type, front, back, tags, imageFront, imageBack }],
//     images: [{ id, mime, data }] }
//
// where `tags` is the raw Anki tag string (mapped onto study buckets here so
// the grouping rules stay server-side), image `data` is base64, and `id` is
// the first 24 hex chars of sha256(bytes) — verified below. Every batch is
// checked against the user's storage share, so a deck that doesn't fit stops
// partway with a clear message instead of importing blind.

// The client flushes batches at 3 MB / 500 cards; anything bigger is not ours.
const MAX_BODY = 4_000_000;
const MAX_CARDS = 500;

// "img:<hash>" for pictures, "snd:<hash>" for audio clips — both live in the
// same Image store; the prefix tells the card renderer which element to use.
const MEDIA_REF = /^(?:img|snd):[0-9a-f]{24}$/;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/avif",
  "image/x-icon",
  "image/tiff",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/flac",
  "audio/aac",
  "audio/3gpp",
]);

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Keep only well-formed "img:/snd:<hash>" references, one per line.
function cleanRefs(v: unknown): string {
  return String(v ?? "")
    .split("\n")
    .filter((r) => MEDIA_REF.test(r))
    .join("\n");
}

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) return jsonError("Not logged in", 401);

    // A stale tab from before the importer moved into the browser still
    // posts the raw file here — tell it to pick up the new page.
    if ((req.headers.get("content-type") || "").includes("multipart/form-data")) {
      return jsonError("The importer was updated — refresh this page (Cmd/Ctrl+Shift+R) and try again.");
    }

    const raw = await req.text();
    if (raw.length > MAX_BODY) {
      return jsonError("Import batch too large.", 413);
    }
    let body: {
      deckName?: unknown;
      cards?: unknown;
      images?: unknown;
    };
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonError("Malformed import batch.");
    }

    const name = String(body.deckName || "Imported deck").trim().slice(0, 120);
    const rawCards = Array.isArray(body.cards) ? body.cards : [];
    const rawImages = Array.isArray(body.images) ? body.images : [];
    if (rawCards.length > MAX_CARDS) return jsonError("Import batch too large.", 413);
    if (!rawCards.length && !rawImages.length) return jsonError("Nothing to import");

    const cards = rawCards.map((c: Record<string, unknown>) => ({
      type: c?.type === "cloze" ? "cloze" : "basic",
      front: String(c?.front ?? ""),
      back: String(c?.back ?? ""),
      tags: bucketsFromAnkiTags(String(c?.tags ?? "")).join(","),
      imageFront: cleanRefs(c?.imageFront),
      imageBack: cleanRefs(c?.imageBack),
    }));

    // Verify each image id really is the hash of its bytes (the id is
    // client-supplied); a mismatch means a corrupted or hand-rolled batch.
    const images: { id: string; mime: string; data: string }[] = [];
    for (const img of rawImages as Record<string, unknown>[]) {
      const id = String(img?.id ?? "");
      const data = String(img?.data ?? "");
      if (!/^[0-9a-f]{24}$/.test(id) || !data) continue;
      const bytes = Buffer.from(data, "base64");
      if (createHash("sha256").update(bytes).digest("hex").slice(0, 24) !== id) continue;
      images.push({
        id,
        mime: ALLOWED_MIME.has(String(img?.mime)) ? String(img?.mime) : "image/jpeg",
        // Store canonical base64 (strips whitespace/padding oddities).
        data: bytes.toString("base64"),
      });
    }

    const deck = await prisma.deck.upsert({
      where: { userId_name: { userId: user.id, name } },
      update: {},
      create: { name, userId: user.id },
    });

    // Cross-import dedupe: skip cards whose front already exists in the deck.
    // (Within-file dupes were already dropped in the browser.)
    const fronts = [...new Set(cards.map((c) => c.front.trim()).filter(Boolean))];
    const existing = fronts.length
      ? await prisma.card.findMany({
          where: { deckId: deck.id, front: { in: fronts } },
          select: { front: true },
        })
      : [];
    const seen = new Set(existing.map((c) => c.front.trim()));
    const toCreate = cards
      .filter((c) => !c.front.trim() || !seen.has(c.front.trim()))
      .map((c) => ({ ...c, deckId: deck.id, userId: user.id, extra: "", source: name }));

    // Everything this batch would add must fit in the user's storage share.
    // Count the card text/refs plus only the images they don't already have
    // (a picture shared with one of their earlier decks costs nothing new).
    const already = new Set(
      images.length
        ? (
            await prisma.image.findMany({
              where: { userId: user.id, id: { in: images.map((i) => i.id) } },
              select: { id: true },
            })
          ).map((r) => r.id)
        : []
    );
    let incomingBytes = 0;
    for (const img of images) if (!already.has(img.id)) incomingBytes += img.data.length;
    for (const c of toCreate) {
      incomingBytes +=
        c.front.length + c.back.length + c.extra.length + c.tags.length +
        c.source.length + c.imageFront.length + c.imageBack.length;
    }
    const quotaMsg = await quotaError(user.id, incomingBytes);
    if (quotaMsg) return jsonError(quotaMsg, 413);

    // Store the images first so the cards' "img:<id>" references resolve.
    const IMG_BATCH = 25;
    for (let i = 0; i < images.length; i += IMG_BATCH) {
      await prisma.image.createMany({
        data: images.slice(i, i + IMG_BATCH).map((img) => ({ ...img, userId: user.id })),
        skipDuplicates: true,
      });
    }

    let added = 0;
    const BATCH = 100;
    for (let i = 0; i < toCreate.length; i += BATCH) {
      const r = await prisma.card.createMany({ data: toCreate.slice(i, i + BATCH) });
      added += r.count;
    }

    return NextResponse.json({
      ok: true,
      added,
      skipped: cards.length - added,
      deckId: deck.id,
      deckName: name,
    });
  } catch (err) {
    console.error("apkg import batch failed:", err);
    return jsonError("Something went wrong importing that deck. Try again in a moment.", 500);
  }
}
