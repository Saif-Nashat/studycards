import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { parseImport } from "@/lib/importParser";
import { quotaError } from "@/lib/storage";

// Import claude.ai-generated cards (pasted text or uploaded file content).
// Body: { text: string, deckId?: string, deckName?: string, preview?: boolean }
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { text, deckId, deckName, preview } = await req.json().catch(() => ({}));
  if (!text || !String(text).trim()) {
    return NextResponse.json({ error: "Nothing to import" }, { status: 400 });
  }
  // Pasted card text is at most a few MB; anything bigger would only strain
  // the parser. (.apkg decks have their own route without this limit.)
  if (String(text).length > 10_000_000) {
    return NextResponse.json({ error: "That paste is too large. Split it into smaller batches, or export as .apkg." }, { status: 413 });
  }

  const parsed = parseImport(String(text));
  if (parsed.cards.length === 0) {
    return NextResponse.json({ error: "Couldn't find any cards in that text. Check the format." }, { status: 400 });
  }

  // Preview mode: just return what we found, don't save.
  if (preview) {
    return NextResponse.json({
      preview: true,
      count: parsed.cards.length,
      deckName: parsed.deckName || deckName || "",
      sample: parsed.cards.slice(0, 5),
    });
  }

  // The whole import must fit inside the user's storage share.
  const incomingBytes = parsed.cards.reduce(
    (s, c) => s + (c.front?.length || 0) + (c.back?.length || 0) + (c.extra?.length || 0) + (c.mnemonic?.length || 0) + (c.tags?.length || 0),
    0
  );
  const quotaMsg = await quotaError(user.id, incomingBytes);
  if (quotaMsg) return NextResponse.json({ error: quotaMsg }, { status: 413 });

  // Resolve target deck: explicit id > explicit name > name from file > fallback.
  let targetDeckId = deckId as string | undefined;
  if (targetDeckId) {
    const deck = await prisma.deck.findFirst({ where: { id: targetDeckId, userId: user.id } });
    if (!deck) return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  } else {
    const name = String(deckName || parsed.deckName || "Imported cards").trim().slice(0, 120);
    const deck = await prisma.deck.upsert({
      where: { userId_name: { userId: user.id, name } },
      update: {},
      create: { name, userId: user.id },
    });
    targetDeckId = deck.id;
  }

  // Duplicate detection: skip cards whose front already exists in the deck.
  const existing = await prisma.card.findMany({
    where: { deckId: targetDeckId },
    select: { front: true },
  });
  const seen = new Set(existing.map((c) => c.front.trim()));

  let added = 0;
  let skipped = 0;
  for (const c of parsed.cards) {
    if (seen.has(c.front.trim())) {
      skipped++;
      continue;
    }
    seen.add(c.front.trim());
    await prisma.card.create({ data: { ...c, deckId: targetDeckId, userId: user.id } });
    added++;
  }

  return NextResponse.json({ ok: true, added, skipped, deckId: targetDeckId });
}
