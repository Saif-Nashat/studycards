import { prisma } from "./prisma";

// ---- Per-user storage accounting ----
// The shared database is 500 MB (free Neon tier). Instead of first-come-first-
// served, every account owns a fixed slice (User.storageLimitMb): six members
// at 75 MB plus one trial at 50 MB. A user's "usage" is the bytes of content
// they store — card text + inline images + their share of the image library —
// measured the same way the per-deck breakdown always has been (length() of
// the stored text; base64 length ≈ bytes for images).

export interface UserUsage {
  usedBytes: number;
  cardBytes: number;
  imageBytes: number;
  imageCount: number;
}

export async function measureUserUsage(userId: string): Promise<UserUsage> {
  const [cardRows, imgRows] = await Promise.all([
    prisma.$queryRawUnsafe<{ bytes: bigint }[]>(
      `SELECT COALESCE(sum(
         length(c."imageFront") + length(c."imageBack") +
         length(c.front) + length(c.back) + length(c.extra) + length(c.mnemonic) + length(c.tags)
       ), 0)::bigint AS bytes
       FROM "Card" c WHERE c."userId" = $1`,
      userId
    ),
    prisma.$queryRawUnsafe<{ n: bigint; bytes: bigint }[]>(
      `SELECT count(*)::bigint AS n, COALESCE(sum(length(data)), 0)::bigint AS bytes
       FROM "Image" WHERE "userId" = $1`,
      userId
    ),
  ]);
  const cardBytes = Number(cardRows[0]?.bytes ?? 0);
  const imageBytes = Number(imgRows[0]?.bytes ?? 0);
  return {
    cardBytes,
    imageBytes,
    imageCount: Number(imgRows[0]?.n ?? 0),
    usedBytes: cardBytes + imageBytes,
  };
}

export async function getUserLimitBytes(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { storageLimitMb: true } });
  return (user?.storageLimitMb ?? 75) * 1024 * 1024;
}

// Would adding `incomingBytes` push the user past their slice? Returns null
// when it fits, or a ready-to-show error message when it doesn't.
export async function quotaError(userId: string, incomingBytes: number): Promise<string | null> {
  const [usage, limitBytes] = await Promise.all([measureUserUsage(userId), getUserLimitBytes(userId)]);
  if (usage.usedBytes + incomingBytes <= limitBytes) return null;
  const mb = (n: number) => (n / 1024 / 1024).toFixed(1);
  return `This would use ${mb(usage.usedBytes + incomingBytes)} MB but your storage share is ${mb(limitBytes)} MB (currently ${mb(usage.usedBytes)} MB used). Delete a deck you no longer need — or import a smaller deck.`;
}
