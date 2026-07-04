import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { gcOrphanImages } from "@/lib/images";

// List the logged-in user's decks with counts of due / new / total cards.
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const now = new Date();
  const decks = await prisma.deck.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } });

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
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { name, description } = await req.json();
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  try {
    const deck = await prisma.deck.create({
      data: { name: name.trim(), description: description || "", userId: user.id },
    });
    return NextResponse.json(deck);
  } catch {
    return NextResponse.json({ error: "You already have a deck with that name" }, { status: 409 });
  }
}

// Delete a deck (and its cards) — only if it belongs to the logged-in user.
export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { count } = await prisma.deck.deleteMany({ where: { id, userId: user.id } });
  if (!count) return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  // Reclaim any of this user's images the deleted deck's cards were the last to use.
  const freedImages = await gcOrphanImages(user.id);
  return NextResponse.json({ ok: true, freedImages });
}
