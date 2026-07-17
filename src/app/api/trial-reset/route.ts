import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { ensureStarterDeck } from "@/lib/starterDeck";

// Full wipe of the TRIAL account back to a clean starter pack, so the next
// person trying the app starts fresh. Unlike /api/reset-progress (which keeps
// decks and cards and only clears scheduling), this deletes everything the
// trial user made.
//
// Guarded to role "trial" only — a member pressing this must never nuke their
// real decks. The proxy already blocks logged-out callers.
export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  if (user.role !== "trial") {
    return NextResponse.json({ error: "Only the trial account can be reset this way." }, { status: 403 });
  }

  // Order is defensive (cascades would handle most of it, but being explicit
  // keeps this correct regardless of schema changes).
  await prisma.review.deleteMany({ where: { userId: user.id } });
  await prisma.card.deleteMany({ where: { userId: user.id } });
  await prisma.deck.deleteMany({ where: { userId: user.id } });
  await prisma.image.deleteMany({ where: { userId: user.id } });
  await prisma.notebook.deleteMany({ where: { userId: user.id } });

  const seeded = await ensureStarterDeck(user.id);
  const cardCount = seeded && "cardCount" in seeded ? seeded.cardCount : 0;

  return NextResponse.json({ ok: true, cardCount });
}
