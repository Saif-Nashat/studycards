import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Overall counts for the dashboard.
export async function GET() {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const [total, due, fresh, flagged, hard, decks, reviewedToday] = await Promise.all([
    prisma.card.count(),
    prisma.card.count({ where: { due: { lte: now }, state: { not: "new" } } }),
    prisma.card.count({ where: { state: "new" } }),
    prisma.card.count({ where: { flagged: true } }),
    prisma.card.count({ where: { OR: [{ flagged: true }, { lastRating: { in: ["again", "hard"] } }] } }),
    prisma.deck.count(),
    prisma.review.count({ where: { reviewedAt: { gte: startOfDay } } }),
  ]);

  return NextResponse.json({ total, due, new: fresh, flagged, hard, decks, reviewedToday });
}
