import { prisma } from "./prisma";

// Pull the shared-image ids ("img:<id>") referenced by a card's image fields.
function refsIn(...fields: string[]): string[] {
  const ids: string[] = [];
  for (const f of fields) {
    if (!f) continue;
    for (const entry of f.split("\n")) {
      const e = entry.trim();
      if (e.startsWith("img:")) ids.push(e.slice(4));
    }
  }
  return ids;
}

// Remove images from a user's image library that none of their cards reference
// anymore (e.g. after a deck is deleted). Returns how many were freed.
// Scoped per user: one user's cleanup can never touch another's pictures.
export async function gcOrphanImages(userId: string): Promise<number> {
  const [cards, all] = await Promise.all([
    prisma.card.findMany({ where: { userId }, select: { imageFront: true, imageBack: true } }),
    prisma.image.findMany({ where: { userId }, select: { id: true } }),
  ]);

  const used = new Set<string>();
  for (const c of cards) for (const id of refsIn(c.imageFront, c.imageBack)) used.add(id);

  const orphans = all.filter((i) => !used.has(i.id)).map((i) => i.id);
  let removed = 0;
  const BATCH = 500;
  for (let i = 0; i < orphans.length; i += BATCH) {
    const r = await prisma.image.deleteMany({ where: { userId, id: { in: orphans.slice(i, i + BATCH) } } });
    removed += r.count;
  }
  return removed;
}
