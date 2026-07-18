import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import type { Prisma, Card } from "@prisma/client";

// Fisher–Yates, in place.
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// A uniform random sample of `cap` cards from EVERYTHING matching `where`.
// Sampling ids first (they're tiny) then fetching only the winners means a
// 20-card test over a 5,000-card deck can draw any of the 5,000 — not just
// whatever rows the DB happens to return first.
async function sampleCards(where: Prisma.CardWhereInput, cap: number): Promise<Card[]> {
  const ids = (await prisma.card.findMany({ where, select: { id: true } })).map((r) => r.id);
  shuffle(ids);
  const picked = ids.slice(0, cap);
  const cards = await prisma.card.findMany({ where: { id: { in: picked } } });
  const byId = new Map(cards.map((c) => [c.id, c]));
  return picked.flatMap((id) => byId.get(id) ?? []);
}

// Build a study queue.
// Params:
//   deckId       optional single deck (legacy)
//   deckIds      optional comma-separated decks (multi-deck select)
//   mode         "due" | "hard" | "all" | "custom"
//   source       (custom) "all" | "new" | "unanswered" | "flagged"
//   limit        (custom) max cards
//   newLimit     (due) cap on new cards
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deckId = searchParams.get("deckId")?.trim() || undefined;
  const deckIdsParam = searchParams.get("deckIds")?.trim() || undefined;
  const mode = searchParams.get("mode") || "due";
  const source = searchParams.get("source") || "all";
  // Hard ceiling per session (mirrors SESSION_MAX in the study builder): keeps
  // every session fast to load; extra matching cards wait for the next session.
  const limit = Math.min(Number(searchParams.get("limit")) || 0, 250);
  const newLimit = Number(searchParams.get("newLimit")) || 20;
  const now = new Date();

  // Base filter shared by all modes: owner + deck(s).
  const base: Prisma.CardWhereInput = { userId: user.id };
  // Decks: accept a single `deckId` (legacy) or a comma-separated `deckIds`.
  // No deck given -> every deck. One deck -> exact match. Several -> `in`.
  const deckList = [deckId, ...(deckIdsParam ? deckIdsParam.split(",") : [])].map((d) => d?.trim()).filter(Boolean) as string[];
  if (deckList.length === 1) base.deckId = deckList[0];
  else if (deckList.length > 1) base.deckId = { in: deckList };

  if (mode === "custom") {
    const where: Prisma.CardWhereInput = { ...base };
    if (source === "new") where.state = "new";
    else if (source === "unanswered") where.lastReviewed = null;
    else if (source === "flagged") where.flagged = true;
    // "due" -> review cards that have come due, plus any new cards.
    else if (source === "due") where.OR = [{ state: { not: "new" }, due: { lte: now } }, { state: "new" }];
    // "all" -> no extra filter

    return NextResponse.json(await sampleCards(where, limit || 250));
  }

  if (mode === "hard") {
    // Hard-rated + flagged/leech only; "again"-rated cards are excluded (they
    // reappear in the normal due queue almost immediately).
    const cards = await sampleCards(
      { AND: [base, { OR: [{ flagged: true }, { isLeech: true }, { lastRating: "hard" }] }] },
      200
    );
    return NextResponse.json(cards);
  }

  if (mode === "all") {
    return NextResponse.json(await sampleCards(base, 200));
  }

  // default "due": due review cards + a capped number of new cards.
  // The most-overdue cards are picked first (that's the point of spaced
  // repetition), but the new cards are a random draw and the final queue is
  // shuffled so a session never replays the deck in insertion order.
  const dueCards = await prisma.card.findMany({
    where: { AND: [base, { state: { not: "new" }, due: { lte: now } }] },
    orderBy: { due: "asc" },
    take: 200,
  });
  const newCards = await sampleCards({ AND: [base, { state: "new" }] }, newLimit);
  return NextResponse.json(shuffle([...dueCards, ...newCards]));
}
