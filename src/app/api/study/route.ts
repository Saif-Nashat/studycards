import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

// Build a study queue.
// Params:
//   deckId       optional single deck
//   tag          optional single tag (legacy)
//   tags         optional comma-separated tags (custom test)
//   mode         "due" | "hard" | "all" | "custom"
//   source       (custom) "all" | "new" | "unanswered" | "flagged"
//   limit        (custom) max cards
//   newLimit     (due) cap on new cards
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deckId = searchParams.get("deckId") || undefined;
  const tag = searchParams.get("tag")?.trim() || undefined;
  const tagsParam = searchParams.get("tags")?.trim() || undefined;
  const mode = searchParams.get("mode") || "due";
  const source = searchParams.get("source") || "all";
  const limit = Math.min(Number(searchParams.get("limit")) || 0, 500);
  const newLimit = Number(searchParams.get("newLimit")) || 20;
  const now = new Date();

  // Base filter shared by all modes: owner + deck + tag(s).
  const base: Prisma.CardWhereInput = { userId: user.id };
  if (deckId) base.deckId = deckId;
  const tagList = [tag, ...(tagsParam ? tagsParam.split(",") : [])].map((t) => t?.trim()).filter(Boolean) as string[];
  if (tagList.length) base.OR = tagList.map((t) => ({ tags: { contains: t } }));

  if (mode === "custom") {
    const where: Prisma.CardWhereInput = { ...base };
    if (source === "new") where.state = "new";
    else if (source === "unanswered") where.lastReviewed = null;
    else if (source === "flagged") where.flagged = true;
    // "all" -> no extra filter

    const found = await prisma.card.findMany({ where, take: 500 });
    // Shuffle so a test feels fresh.
    for (let i = found.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [found[i], found[j]] = [found[j], found[i]];
    }
    return NextResponse.json(limit ? found.slice(0, limit) : found);
  }

  if (mode === "hard") {
    // Hard-rated + flagged/leech only; "again"-rated cards are excluded (they
    // reappear in the normal due queue almost immediately).
    const cards = await prisma.card.findMany({
      where: { AND: [base, { OR: [{ flagged: true }, { isLeech: true }, { lastRating: "hard" }] }] },
      orderBy: { due: "asc" },
      take: 200,
    });
    return NextResponse.json(cards);
  }

  if (mode === "all") {
    const cards = await prisma.card.findMany({ where: base, orderBy: { due: "asc" }, take: 200 });
    return NextResponse.json(cards);
  }

  // default "due": due review cards + a capped number of new cards
  const dueCards = await prisma.card.findMany({
    where: { AND: [base, { state: { not: "new" }, due: { lte: now } }] },
    orderBy: { due: "asc" },
    take: 200,
  });
  const newCards = await prisma.card.findMany({
    where: { AND: [base, { state: "new" }] },
    orderBy: { createdAt: "asc" },
    take: newLimit,
  });
  return NextResponse.json([...dueCards, ...newCards]);
}
