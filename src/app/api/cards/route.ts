import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { quotaError } from "@/lib/storage";

// Sanity caps for a single card's text columns. Images are governed by the
// storage quota; these keep one request from stuffing megabytes into a text
// field (which the quota counts too late to make a good error message).
const CARD_TYPES = ["basic", "cloze", "list"];
const TEXT_CAP = 50_000;
const SHORT_CAP = 1_000;
const clip = (v: unknown, max: number) => String(v ?? "").slice(0, max);

// List/search the logged-in user's cards.
// Query params: deckId, q (search), flagged, hard, limit.
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deckId = searchParams.get("deckId") || undefined;
  const q = searchParams.get("q")?.trim();
  const flagged = searchParams.get("flagged");
  const hard = searchParams.get("hard");
  const tag = searchParams.get("tag")?.trim();
  const leech = searchParams.get("leech");
  const limit = Math.min(Number(searchParams.get("limit")) || 500, 2000);

  const where: Record<string, unknown> = { userId: user.id };
  if (deckId) where.deckId = deckId;
  if (tag) where.tags = { contains: tag };
  if (leech === "1") where.isLeech = true;
  if (flagged === "1") where.flagged = true;
  // "Hard" collects cards last rated Hard, plus flagged/leech cards. Cards
  // rated Again are deliberately excluded — they're back in the due queue
  // within minutes anyway, so listing them here would just be noise.
  if (hard === "1") {
    where.OR = [{ flagged: true }, { isLeech: true }, { lastRating: "hard" }];
  }
  if (q) {
    where.OR = [
      { front: { contains: q } },
      { back: { contains: q } },
      { tags: { contains: q } },
    ];
  }

  const cards = await prisma.card.findMany({
    where,
    include: { deck: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json(cards);
}

// Create a single card by hand (in one of the user's own decks).
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { deckId, type, front, back, extra, tags, source } = body;
  if (!deckId || !front) {
    return NextResponse.json({ error: "deckId and front are required" }, { status: 400 });
  }
  const deck = await prisma.deck.findFirst({ where: { id: deckId, userId: user.id } });
  if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });

  // Count the new content (mostly any hand-attached images) against the
  // user's storage share before saving.
  const incoming =
    String(front).length + String(back || "").length + String(extra || "").length +
    String(body.mnemonic || "").length + String(body.imageFront || "").length + String(body.imageBack || "").length;
  const quotaMsg = await quotaError(user.id, incoming);
  if (quotaMsg) return NextResponse.json({ error: quotaMsg }, { status: 413 });

  const card = await prisma.card.create({
    data: {
      deckId,
      userId: user.id,
      type: CARD_TYPES.includes(String(type)) ? String(type) : "basic",
      front: clip(front, TEXT_CAP),
      back: clip(back, TEXT_CAP),
      extra: clip(extra, TEXT_CAP),
      mnemonic: clip(body.mnemonic, TEXT_CAP),
      tags: clip(tags, SHORT_CAP),
      source: clip(source, SHORT_CAP),
      imageFront: String(body.imageFront ?? ""),
      imageBack: String(body.imageBack ?? ""),
    },
  });
  return NextResponse.json(card);
}

// Update a card (edit content, flag, move deck) — only the user's own.
export async function PUT(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { id, ...rest } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.card.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Card not found" }, { status: 404 });

  const allowed = ["type", "front", "back", "extra", "mnemonic", "tags", "source", "flagged", "deckId", "imageFront", "imageBack", "isLeech"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in rest) data[k] = rest[k];

  // Coerce everything to the shape the column expects, so a malformed request
  // can't reach Prisma as the wrong type (which would 500) or oversized text.
  for (const k of ["front", "back", "extra", "mnemonic"]) if (k in data) data[k] = clip(data[k], TEXT_CAP);
  for (const k of ["tags", "source"]) if (k in data) data[k] = clip(data[k], SHORT_CAP);
  for (const k of ["imageFront", "imageBack"]) if (k in data) data[k] = String(data[k] ?? "");
  for (const k of ["flagged", "isLeech"]) if (k in data) data[k] = Boolean(data[k]);
  if ("type" in data && !CARD_TYPES.includes(String(data.type))) delete data.type;
  if ("deckId" in data) data.deckId = String(data.deckId ?? "");

  // Moving a card into a deck must stay within the user's own decks.
  if (typeof data.deckId === "string" && data.deckId !== existing.deckId) {
    const target = await prisma.deck.findFirst({ where: { id: data.deckId, userId: user.id } });
    if (!target) return NextResponse.json({ error: "Target deck not found" }, { status: 404 });
  }

  // If the edit grows the stored content (e.g. attaching a new image), check
  // the growth against the user's share.
  const sizeOf = (c: Record<string, unknown>, keys: string[]) =>
    keys.reduce((s, k) => s + String(c[k] ?? "").length, 0);
  const contentKeys = ["front", "back", "extra", "mnemonic", "imageFront", "imageBack"];
  const grownBy =
    sizeOf({ ...existing, ...data } as Record<string, unknown>, contentKeys) -
    sizeOf(existing as unknown as Record<string, unknown>, contentKeys);
  if (grownBy > 0) {
    const quotaMsg = await quotaError(user.id, grownBy);
    if (quotaMsg) return NextResponse.json({ error: quotaMsg }, { status: 413 });
  }

  const card = await prisma.card.update({ where: { id }, data });
  return NextResponse.json(card);
}

// Delete a card — only the user's own.
export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { count } = await prisma.card.deleteMany({ where: { id, userId: user.id } });
  if (!count) return NextResponse.json({ error: "Card not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
