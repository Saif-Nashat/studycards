import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUser } from "@/lib/auth";
import { measureUserUsage } from "@/lib/storage";

export const runtime = "nodejs";

// Run a DB operation, retrying if the (free) Neon database is still waking from
// its idle auto-suspend. A cold compute can refuse the first connection(s) for
// several seconds before it's ready, so we retry with a short backoff instead of
// failing the whole request. Total patience ≈ 12s.
async function withWakeRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [500, 1000, 2000, 3000, 4000];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (attempt === delays.length) break;
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
  throw lastErr;
}

// Storage usage for the logged-in user's slice of the shared database.
// Every account owns a fixed share (User.storageLimitMb): six members at
// 75 MB + one trial at 50 MB = the 500 MB free Neon tier.
export async function GET() {
  const sessionUser = await getUser();
  if (!sessionUser) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  try {
    // First DB touch carries the wake-from-idle retry.
    const account = await withWakeRetry(() =>
      prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { username: true, displayName: true, role: true, storageLimitMb: true },
      })
    );
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const usage = await measureUserUsage(sessionUser.id);
    const limitBytes = account.storageLimitMb * 1024 * 1024;
    const pct = limitBytes ? Math.min(100, Math.round((usage.usedBytes / limitBytes) * 100)) : 0;

    // Rough per-deck content size (text + inline images) so you can see which
    // of your decks is worth deleting if you need room. length() counts chars,
    // which for base64 images ≈ bytes — fine for comparing decks.
    const deckRows = await prisma.$queryRawUnsafe<
      { id: string; name: string; cards: bigint; bytes: bigint }[]
    >(
      `SELECT d.id, d.name,
              count(c.id)::bigint AS cards,
              COALESCE(sum(
                length(c."imageFront") + length(c."imageBack") +
                length(c.front) + length(c.back) + length(c.extra) + length(c.mnemonic)
              ), 0)::bigint AS bytes
       FROM "Deck" d
       LEFT JOIN "Card" c ON c."deckId" = d.id
       WHERE d."userId" = $1
       GROUP BY d.id, d.name
       ORDER BY bytes DESC`,
      sessionUser.id
    );

    let level: "ok" | "warn" | "critical" = "ok";
    if (pct >= 95) level = "critical";
    else if (pct >= 80) level = "warn";

    return NextResponse.json({
      usedBytes: usage.usedBytes,
      limitBytes,
      limitMb: account.storageLimitMb,
      pct,
      level,
      imageCount: usage.imageCount,
      imageBytes: usage.imageBytes,
      username: account.username,
      displayName: account.displayName,
      role: account.role,
      decks: deckRows.map((d) => ({
        id: d.id,
        name: d.name,
        cards: Number(d.cards),
        bytes: Number(d.bytes),
      })),
    });
  } catch (e) {
    console.error("storage usage check failed:", e);
    return NextResponse.json({ error: "Couldn't read storage usage." }, { status: 500 });
  }
}
