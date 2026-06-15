import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Neon's free plan includes ~0.5 GB of storage. The exact figure for your plan
// shows in the Neon dashboard — override it here with DB_STORAGE_LIMIT_MB if
// yours differs (or if you upgrade).
const LIMIT_MB = Number(process.env.DB_STORAGE_LIMIT_MB) || 500;

export async function GET() {
  try {
    // The authoritative "how full is the database" number.
    const sizeRows = await prisma.$queryRawUnsafe<{ bytes: bigint }[]>(
      `SELECT pg_database_size(current_database())::bigint AS bytes`
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

    let level: "ok" | "warn" | "critical" = "ok";
    if (pct >= 95) level = "critical";
    else if (pct >= 80) level = "warn";

    return NextResponse.json({
      usedBytes,
      limitBytes,
      limitMb: LIMIT_MB,
      pct,
      level,
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
