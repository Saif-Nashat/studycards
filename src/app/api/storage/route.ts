import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Neon's free plan includes ~0.5 GB of storage. The exact figure for your plan
// shows in the Neon dashboard — override it here with DB_STORAGE_LIMIT_MB if
// yours differs (or if you upgrade).
const LIMIT_MB = Number(process.env.DB_STORAGE_LIMIT_MB) || 500;

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

export async function GET() {
  try {
    // The authoritative "how full is the database" number. This is the first DB
    // touch, so it carries the wake-from-idle retry.
    const sizeRows = await withWakeRetry(() =>
      prisma.$queryRawUnsafe<{ bytes: bigint }[]>(
        `SELECT pg_database_size(current_database())::bigint AS bytes`
      )
    );
    const usedBytes = Number(sizeRows[0]?.bytes ?? 0);
    const limitBytes = LIMIT_MB * 1024 * 1024;
    const pct = limitBytes ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0;

    // Rough per-deck content size (mostly the embedded images) so you can see
    // which decks are worth deleting if you need room. length() counts chars,
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
       GROUP BY d.id, d.name
       ORDER BY bytes DESC`
    );

    // Images are de-duplicated into a shared table, so report that pool on its
    // own rather than trying to split it across decks.
    const imgRows = await prisma.$queryRawUnsafe<{ n: bigint; bytes: bigint }[]>(
      `SELECT count(*)::bigint AS n, COALESCE(sum(length(data)), 0)::bigint AS bytes FROM "Image"`
    );
    const imageCount = Number(imgRows[0]?.n ?? 0);
    const imageBytes = Number(imgRows[0]?.bytes ?? 0);

    let level: "ok" | "warn" | "critical" = "ok";
    if (pct >= 95) level = "critical";
    else if (pct >= 80) level = "warn";

    return NextResponse.json({
      usedBytes,
      limitBytes,
      limitMb: LIMIT_MB,
      pct,
      level,
      imageCount,
      imageBytes,
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
