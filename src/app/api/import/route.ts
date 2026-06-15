import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseImport } from "@/lib/importParser";

// Import claude.ai-generated cards (pasted text or uploaded file content).
// Body: { text: string, deckId?: string, deckName?: string, preview?: boolean }
export async function POST(req: Request) {
  const { text, deckId, deckName, preview } = await req.json();
  if (!text || !String(text).trim()) {
    return NextResponse.json({ error: "Nothing to import" }, { status: 400 });
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

  // Resolve target deck: explicit id > explicit name > name from file > fallback.
  let targetDeckId = deckId as string | undefined;
  if (!targetDeckId) {
    const name = (deckName || parsed.deckName || "Imported cards").trim();
    const deck = await prisma.deck.upsert({
      where: { name },
      update: {},
      create: { name },
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
    await prisma.card.create({ data: { ...c, deckId: targetDeckId } });
    added++;
  }

  return NextResponse.json({ ok: true, added, skipped, deckId: targetDeckId });
}
