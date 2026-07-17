import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";

// Format a date as a local YYYY-MM-DD key.
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  const uid = user.id;

  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const sevenAgo = new Date(startOfToday); sevenAgo.setDate(sevenAgo.getDate() - 6);
  const fourteenAgo = new Date(startOfToday); fourteenAgo.setDate(fourteenAgo.getDate() - 13);
  const windowStart = new Date(startOfToday); windowStart.setDate(windowStart.getDate() - 120);

  const [totalReviews, today, last7, byRating, recent, cards, deckReviews] = await Promise.all([
    prisma.review.count({ where: { userId: uid } }),
    prisma.review.count({ where: { userId: uid, reviewedAt: { gte: startOfToday } } }),
    prisma.review.count({ where: { userId: uid, reviewedAt: { gte: sevenAgo } } }),
    prisma.review.groupBy({ by: ["rating"], where: { userId: uid }, _count: { rating: true } }),
    prisma.review.findMany({
      where: { userId: uid, reviewedAt: { gte: windowStart } },
      select: { reviewedAt: true },
      orderBy: { reviewedAt: "desc" },
    }),
    prisma.card.findMany({ where: { userId: uid }, select: { state: true, intervalDays: true } }),
    prisma.review.findMany({ where: { userId: uid }, select: { rating: true, card: { select: { deckId: true, deck: { select: { name: true } } } } } }),
  ]);

  // Rating distribution
  const ratingCounts = { again: 0, hard: 0, good: 0, easy: 0 } as Record<string, number>;
  for (const r of byRating) ratingCounts[r.rating] = r._count.rating;

  // Days that had at least one review (set of local day keys)
  const daySet = new Set(recent.map((r) => dayKey(r.reviewedAt)));

  // Daily activity for the last 14 days
  const daily: { date: string; label: string; count: number }[] = [];
  const counts14: Record<string, number> = {};
  for (const r of recent) {
    const k = dayKey(r.reviewedAt);
    counts14[k] = (counts14[k] || 0) + 1;
  }
  for (let i = 0; i < 14; i++) {
    const d = new Date(fourteenAgo); d.setDate(d.getDate() + i);
    const k = dayKey(d);
    daily.push({ date: k, label: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2), count: counts14[k] || 0 });
  }

  // Study streak (consecutive days up to today with a review)
  let streak = 0;
  const cursor = new Date(startOfToday);
  // If nothing today, the streak can still count yesterday backwards.
  if (!daySet.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (daySet.has(dayKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Longest streak within the review window: walk each studied day and measure
  // the longest run of consecutive days. (Bounded to the 120-day window we load.)
  let longestStreak = 0;
  {
    const days = Array.from(daySet).sort();
    let run = 0;
    let prev: Date | null = null;
    for (const k of days) {
      const [y, m, dd] = k.split("-").map(Number);
      const d = new Date(y, m - 1, dd);
      if (prev && (d.getTime() - prev.getTime()) === 86_400_000) run++;
      else run = 1;
      if (run > longestStreak) longestStreak = run;
      prev = d;
    }
  }

  // Card maturity
  const maturity = { total: cards.length, new: 0, learning: 0, review: 0, mature: 0 };
  for (const c of cards) {
    if (c.state === "new") maturity.new++;
    else if (c.state === "learning") maturity.learning++;
    else {
      maturity.review++;
      if (c.intervalDays >= 21) maturity.mature++;
    }
  }

  const accuracy = totalReviews ? Math.round(((ratingCounts.good + ratingCounts.easy) / totalReviews) * 100) : 0;

  // Weak decks: accuracy per deck (Good/Easy = "got it"). Needs a few reviews
  // to count, so a single lucky/unlucky answer doesn't dominate.
  const deckStats = new Map<string, { name: string; correct: number; total: number }>();
  for (const r of deckReviews) {
    const deckId = r.card?.deckId;
    const name = r.card?.deck?.name;
    if (!deckId || !name) continue;
    const correct = r.rating === "good" || r.rating === "easy";
    const s = deckStats.get(deckId) || { name, correct: 0, total: 0 };
    s.total++;
    if (correct) s.correct++;
    deckStats.set(deckId, s);
  }
  const MIN_REVIEWS = 3;
  const weakDecks = Array.from(deckStats.entries())
    .filter(([, s]) => s.total >= MIN_REVIEWS)
    .map(([deckId, s]) => ({ deckId, name: s.name, total: s.total, accuracy: Math.round((s.correct / s.total) * 100) }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 8);

  return NextResponse.json({
    totalReviews, today, last7, ratingCounts, daily, streak, longestStreak, maturity, accuracy, weakDecks,
  });
}
