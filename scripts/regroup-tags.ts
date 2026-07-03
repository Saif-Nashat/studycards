// One-time migration: collapse every card's granular tags into the six broad
// study buckets defined in src/lib/tags.ts. Idempotent — safe to re-run (already
// grouped cards map to themselves). Run with:  node scripts/regroup-tags.ts
import { PrismaClient } from "@prisma/client";
import { bucketsFromCommaTags, TAG_BUCKETS } from "../src/lib/tags.ts";

const prisma = new PrismaClient();

async function main() {
  const cards = await prisma.card.findMany({ select: { id: true, tags: true } });
  console.log(`Scanning ${cards.length} cards…`);

  let changed = 0;
  const dist = new Map<string, number>();

  for (const c of cards) {
    const buckets = bucketsFromCommaTags(c.tags);
    const next = buckets.join(",");
    for (const b of buckets) dist.set(b, (dist.get(b) || 0) + 1);
    if (next !== c.tags) {
      await prisma.card.update({ where: { id: c.id }, data: { tags: next } });
      changed++;
    }
  }

  console.log(`\nUpdated ${changed} card(s). Cards per bucket now:`);
  for (const b of TAG_BUCKETS) console.log(`  ${String(dist.get(b) || 0).padStart(4)}  ${b}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
