import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { schedule, type Rating } from "@/lib/srs";

// Apply a rating to a card and reschedule it.
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { cardId, rating } = await req.json();
  const validRatings: Rating[] = ["again", "hard", "good", "easy"];
  if (!cardId || !validRatings.includes(rating)) {
    return NextResponse.json({ error: "cardId and valid rating required" }, { status: 400 });
  }

  const card = await prisma.card.findFirst({ where: { id: cardId, userId: user.id } });
  if (!card) return NextResponse.json({ error: "Card not found" }, { status: 404 });

  const next = schedule(
    {
      state: card.state,
      intervalDays: card.intervalDays,
      ease: card.ease,
      reps: card.reps,
      lapses: card.lapses,
    },
    rating
  );

  // Leech: a card failed too many times. Mark it (and flag it for review).
  const LEECH_LAPSES = 4;
  const becameLeech = next.lapses >= LEECH_LAPSES;

  const [updated] = await Promise.all([
    prisma.card.update({
      where: { id: cardId },
      data: {
        state: next.state,
        intervalDays: next.intervalDays,
        ease: next.ease,
        reps: next.reps,
        lapses: next.lapses,
        lastRating: next.lastRating,
        due: next.due,
        lastReviewed: new Date(),
        ...(becameLeech ? { isLeech: true, flagged: true } : {}),
      },
    }),
    prisma.review.create({
      data: { cardId, rating, intervalDays: next.intervalDays, userId: user.id },
    }),
  ]);

  return NextResponse.json({ ok: true, due: updated.due, isLeech: updated.isLeech });
}
