import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AchStats } from "@/lib/achievements";

// Format a date as a local YYYY-MM-DD key.
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Compute the stats snapshot the trophy system is derived from. The client turns
// this into unlocked/progress via src/lib/achievements.ts.
export async function GET() {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);

  const [totalReviews, reviewedToday, byRating, reviewDays, cards, totalDecks] = await Promise.all([
    prisma.review.count(),
    prisma.review.count({ where: { reviewedAt: { gte: startOfToday } } }),
    prisma.review.groupBy({ by: ["rating"], _count: { rating: true } }),
    prisma.review.findMany({ select: { reviewedAt: true } }),
    prisma.card.findMany({ select: { state: true, intervalDays: true } }),
    prisma.deck.count(),
  ]);

  // Accuracy from the rating distribution.
  let goodEasy = 0;
  for (const r of byRating) if (r.rating === "good" || r.rating === "easy") goodEasy += r._count.rating;
  const accuracy = totalReviews ? Math.round((goodEasy / totalReviews) * 100) : 0;

  // Distinct study days, plus current and longest streaks.
  const daySet = new Set(reviewDays.map((r) => dayKey(r.reviewedAt)));
  const daysStudied = daySet.size;

  // Current streak: walk back from today (or yesterday if nothing yet today).
  let streak = 0;
  const cursor = new Date(startOfToday);
  if (!daySet.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (daySet.has(dayKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }

  // Longest streak: scan the sorted set of study days for the longest run of
  // consecutive calendar days.
  const sortedDays = Array.from(daySet).sort();
  let longestStreak = 0, run = 0;
  let prev: Date | null = null;
  for (const key of sortedDays) {
    const [y, m, d] = key.split("-").map(Number);
    const day = new Date(y, m - 1, d);
    if (prev) {
      const diff = Math.round((day.getTime() - prev.getTime()) / 86400000);
      run = diff === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prev = day;
  }

  // Mature cards: in review state with a 21+ day interval.
  let matureCards = 0;
  for (const c of cards) if (c.state !== "new" && c.state !== "learning" && c.intervalDays >= 21) matureCards++;

  const stats: AchStats = {
    totalReviews,
    streak,
    longestStreak,
    daysStudied,
    reviewedToday,
    matureCards,
    totalCards: cards.length,
    totalDecks,
    accuracy,
  };

  return NextResponse.json(stats);
}
