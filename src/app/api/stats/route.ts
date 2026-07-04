import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";

// Overall counts for the dashboard — scoped to the logged-in user.
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const uid = user.id;

  const [total, due, fresh, flagged, hard, decks, reviewedToday] = await Promise.all([
    prisma.card.count({ where: { userId: uid } }),
    prisma.card.count({ where: { userId: uid, due: { lte: now }, state: { not: "new" } } }),
    prisma.card.count({ where: { userId: uid, state: "new" } }),
    prisma.card.count({ where: { userId: uid, flagged: true } }),
    prisma.card.count({ where: { userId: uid, OR: [{ flagged: true }, { isLeech: true }, { lastRating: "hard" }] } }),
    prisma.deck.count({ where: { userId: uid } }),
    prisma.review.count({ where: { userId: uid, reviewedAt: { gte: startOfDay } } }),
  ]);

  return NextResponse.json({ total, due, new: fresh, flagged, hard, decks, reviewedToday });
}
