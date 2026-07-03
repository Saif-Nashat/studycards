import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Reset study *progress* only — spaced-repetition scheduling and review history —
// while leaving every deck and card completely intact.
//
// What this clears:
//   • all Review rows (insights, streaks, daily activity)
//   • each card's SRS state (back to "new", due now, default ease, no reps/lapses)
//   • auto-set "leech" markers
//
// What this deliberately keeps:
//   • every deck and every card (content, images, tags, sources)
//   • manual flags the user set themselves (their own "review later" list)
export async function POST() {
  // Order matters only for clarity; both are independent tables.
  const deleted = await prisma.review.deleteMany({});
  const reset = await prisma.card.updateMany({
    data: {
      state: "new",
      due: new Date(),
      intervalDays: 0,
      ease: 2.5,
      reps: 0,
      lapses: 0,
      lastRating: "",
      lastReviewed: null,
      isLeech: false,
    },
  });

  return NextResponse.json({
    ok: true,
    reviewsCleared: deleted.count,
    cardsReset: reset.count,
  });
}
