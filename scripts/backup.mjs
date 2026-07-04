// Dumps the entire live database to a timestamped, gzip-compressed NDJSON
// file in ../backups (MediCards/backups — next to the repo, synced by
// OneDrive, so every backup also gets an off-machine copy for free).
//
// Read-only: safe to run at any time, as often as you like.
// Keeps the newest KEEP files and deletes older ones.
//
// Format: one JSON object per line — {"table":"Card","row":{...}} — with
// tables written in dependency order (User → Deck → Card → Image → Notebook
// → Review), so a restore can simply insert top to bottom.
//
// Run by hand:            npm run backup
// Scheduled (Windows):    Task Scheduler → "MediCards backup" (every 4 days)
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();
const here = path.dirname(fileURLToPath(import.meta.url));
const backupDir = path.resolve(here, "..", "..", "backups");
const KEEP = 7;
const BATCH = 500;

// e.g. medicards-2026-07-04-1530.ndjson.gz
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const outPath = path.join(backupDir, `medicards-${stamp}.ndjson.gz`);

// Each table: [name, findMany batcher, orderBy for stable pagination].
// Image rows carry big base64 blobs, so they use a smaller batch size.
const TABLES = [
  ["User", (a) => prisma.user.findMany(a), [{ id: "asc" }], BATCH],
  ["Deck", (a) => prisma.deck.findMany(a), [{ id: "asc" }], BATCH],
  ["Card", (a) => prisma.card.findMany(a), [{ id: "asc" }], BATCH],
  ["Image", (a) => prisma.image.findMany(a), [{ userId: "asc" }, { id: "asc" }], 100],
  ["Notebook", (a) => prisma.notebook.findMany(a), [{ id: "asc" }], BATCH],
  ["Review", (a) => prisma.review.findMany(a), [{ id: "asc" }], BATCH],
];

async function main() {
  fs.mkdirSync(backupDir, { recursive: true });
  const gzip = zlib.createGzip({ level: 6 });
  gzip.pipe(fs.createWriteStream(outPath));
  // Respect backpressure so a big Image table never piles up in memory.
  const write = (line) =>
    new Promise((resolve) => (gzip.write(line) ? resolve() : gzip.once("drain", resolve)));

  await write(JSON.stringify({ meta: { app: "medicards", createdAt: now.toISOString(), format: 1 } }) + "\n");

  const counts = {};
  for (const [table, findMany, orderBy, batch] of TABLES) {
    let skip = 0;
    counts[table] = 0;
    for (;;) {
      const rows = await findMany({ orderBy, skip, take: batch });
      if (rows.length === 0) break;
      for (const row of rows) await write(JSON.stringify({ table, row }) + "\n");
      counts[table] += rows.length;
      skip += rows.length;
    }
  }

  await new Promise((resolve) => gzip.end(resolve));
  const sizeMb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`Backed up ${Object.entries(counts).map(([t, n]) => `${n} ${t}`).join(", ")}`);
  console.log(`→ ${outPath} (${sizeMb} MB)`);

  // Rotate: newest KEEP stay, the rest go.
  const old = fs
    .readdirSync(backupDir)
    .filter((f) => /^medicards-.*\.ndjson\.gz$/.test(f))
    .sort()
    .reverse()
    .slice(KEEP);
  for (const f of old) {
    fs.unlinkSync(path.join(backupDir, f));
    console.log(`Rotated out old backup: ${f}`);
  }
}

main()
  .catch((e) => {
    console.error("Backup FAILED:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
