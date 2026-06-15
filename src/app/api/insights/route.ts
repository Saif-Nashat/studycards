import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Format a date as a local YYYY-MM-DD key.
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  const sevenAgo = new Date(startOfToday); sevenAgo.setDate(sevenAgo.getDate() - 6);
  const fourteenAgo = new Date(startOfToday); fourteenAgo.setDate(fourteenAgo.getDate() - 13);
  const windowStart = new Date(startOfToday); windowStart.setDate(windowStart.getDate() - 120);

  const [totalReviews, today, last7, byRating, recent, cards, taggedReviews] = await Promise.all([
    prisma.review.count(),
    prisma.review.count({ where: { reviewedAt: { gte: startOfToday } } }),
    prisma.review.count({ where: { reviewedAt: { gte: sevenAgo } } }),
    prisma.review.groupBy({ by: ["rating"], _count: { rating: true } }),
    prisma.review.findMany({
      where: { reviewedAt: { gte: windowStart } },
      select: { reviewedAt: true },
      orderBy: { reviewedAt: "desc" },
    }),
    prisma.card.findMany({ select: { state: true, intervalDays: true } }),
    prisma.review.findMany({ select: { rating: true, card: { select: { tags: true } } } }),
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

  // Weak topics: accuracy per tag (Good/Easy = "got it"). Needs a few reviews to count.
  const tagStats = new Map<string, { correct: number; total: number }>();
  for (const r of taggedReviews) {
    const tags = (r.card?.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
    const correct = r.rating === "good" || r.rating === "easy";
    for (const tag of tags) {
      const s = tagStats.get(tag) || { correct: 0, total: 0 };
      s.total++;
      if (correct) s.correct++;
      tagStats.set(tag, s);
    }
  }
  const MIN_REVIEWS = 3;
  const weakTopics = Array.from(tagStats.entries())
    .filter(([, s]) => s.total >= MIN_REVIEWS)
    .map(([tag, s]) => ({ tag, total: s.total, accuracy: Math.round((s.correct / s.total) * 100) }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 8);

  return NextResponse.json({
    totalReviews, today, last7, ratingCounts, daily, streak, maturity, accuracy, weakTopics,
  });
}
