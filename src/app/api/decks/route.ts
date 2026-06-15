import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// List all decks with counts of due / new / total cards.
export async function GET() {
  const now = new Date();
  const decks = await prisma.deck.findMany({ orderBy: { name: "asc" } });

  const result = await Promise.all(
    decks.map(async (d) => {
      const [total, due, fresh] = await Promise.all([
        prisma.card.count({ where: { deckId: d.id } }),
        prisma.card.count({ where: { deckId: d.id, due: { lte: now }, state: { not: "new" } } }),
        prisma.card.count({ where: { deckId: d.id, state: "new" } }),
      ]);
      return { ...d, total, due, new: fresh };
    })
  );
  return NextResponse.json(result);
}

// Create a deck.
export async function POST(req: Request) {
  const { name, description } = await req.json();
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  try {
    const deck = await prisma.deck.create({
      data: { name: name.trim(), description: description || "" },
    });
    return NextResponse.json(deck);
  } catch {
    return NextResponse.json({ error: "A deck with that name already exists" }, { status: 409 });
  }
}

// Delete a deck (and its cards).
export async function DELETE(req: Request) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.deck.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
