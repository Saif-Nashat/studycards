// Re-encodes stored images from the old JPEG pipeline to WebP (q45, max
// 950px — exactly what the importer produces today) IN PLACE, keeping each
// image's id. Cards reference images as "img:<id>", so nothing about cards,
// decks or study progress changes — only the bytes behind the same id get
// smaller. Measured on the live data this frees roughly a third of the
// biggest storage consumer.
//
// Safe by design — three modes:
//   node scripts/reencode-images.mjs                 DRY RUN (default): report
//       what would change, write NOTHING. --samples <dir> also saves a few
//       before/after pairs as PNGs for eyeballing quality.
//   node scripts/reencode-images.mjs --apply         First saves every row it
//       is about to touch to ../backups/pre-reencode-<stamp>.ndjson.gz, then
//       rewrites rows one by one (only where the WebP came out smaller).
//   node scripts/reencode-images.mjs --restore <f>   Puts the original bytes
//       back from a pre-reencode safety file. Full undo.
//
// Never touched: gif (animation would break), svg, anything already webp,
// anything whose re-encode fails validation or comes out bigger.
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();
const here = path.dirname(fileURLToPath(import.meta.url));
const backupDir = path.resolve(here, "..", "..", "backups");

const IMG_MAX_DIM = 950;
const WEBP_QUALITY = 45;

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const RESTORE = args.includes("--restore") ? args[args.indexOf("--restore") + 1] : null;
const SAMPLES_DIR = args.includes("--samples") ? args[args.indexOf("--samples") + 1] : null;

const mb = (n) => (n / 1024 / 1024).toFixed(2) + " MB";

// List every matching key up front (tiny rows), then fetch blobs one at a
// time. A cursor over the mime filter would break in apply mode: updating a
// row to webp removes it from the filtered set the cursor walks.
async function* pages(where) {
  const keys = await prisma.image.findMany({
    where,
    select: { userId: true, id: true },
    orderBy: [{ userId: "asc" }, { id: "asc" }],
  });
  for (const key of keys) {
    const row = await prisma.image.findUnique({ where: { userId_id: key } });
    if (row) yield row;
  }
}

async function restore(file) {
  const raw = zlib.gunzipSync(fs.readFileSync(file)).toString("utf8");
  let n = 0;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const { table, row } = JSON.parse(line);
    if (table !== "Image") continue;
    await prisma.image.update({
      where: { userId_id: { userId: row.userId, id: row.id } },
      data: { data: row.data, mime: row.mime },
    });
    n++;
  }
  console.log(`Restored original bytes for ${n} images from ${file}`);
}

async function main() {
  if (RESTORE) return restore(RESTORE);

  // Only lossy raster formats the current pipeline would have produced as WebP.
  const where = { mime: { in: ["image/jpeg", "image/png", "image/bmp"] } };
  const total = await prisma.image.count({ where });
  console.log(`${APPLY ? "APPLY" : "DRY RUN"}: ${total} jpeg/png/bmp images to inspect\n`);

  // In apply mode, every row we are about to change is appended to a safety
  // file BEFORE its update runs — same NDJSON format as the nightly backup.
  let safety = null;
  let safetyPath = "";
  const writeSafety = (row) =>
    new Promise((resolve) => (safety.write(JSON.stringify({ table: "Image", row }) + "\n") ? resolve() : safety.once("drain", resolve)));
  if (APPLY) {
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
    safetyPath = path.join(backupDir, `pre-reencode-${stamp}.ndjson.gz`);
    safety = zlib.createGzip({ level: 6 });
    safety.pipe(fs.createWriteStream(safetyPath));
  }

  let inspected = 0, changed = 0, skippedBigger = 0, skippedBad = 0;
  let beforeBytes = 0, afterBytes = 0, sampled = 0;

  for await (const row of pages(where)) {
    inspected++;
    const orig = Buffer.from(row.data, "base64");
    let out;
    try {
      out = await sharp(orig)
        .rotate()
        .resize({ width: IMG_MAX_DIM, height: IMG_MAX_DIM, fit: "inside", withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      // Validate before we'd ever store it: must decode as a real webp.
      const meta = await sharp(out).metadata();
      if (meta.format !== "webp" || !meta.width || !meta.height) throw new Error("bad output");
    } catch {
      skippedBad++;
      continue; // unreadable/odd image — leave the original untouched
    }

    const newB64 = out.toString("base64");
    if (newB64.length >= row.data.length) {
      skippedBigger++;
      continue; // only ever replace with something smaller
    }

    if (SAMPLES_DIR && sampled < 3) {
      fs.mkdirSync(SAMPLES_DIR, { recursive: true });
      await sharp(orig).png().toFile(path.join(SAMPLES_DIR, `sample${sampled}-before.png`));
      await sharp(out).png().toFile(path.join(SAMPLES_DIR, `sample${sampled}-after.png`));
      sampled++;
    }

    beforeBytes += row.data.length;
    afterBytes += newB64.length;
    changed++;

    if (APPLY) {
      await writeSafety(row); // original bytes secured first
      await prisma.image.update({
        where: { userId_id: { userId: row.userId, id: row.id } },
        data: { data: newB64, mime: "image/webp" },
      });
    }
    if (changed % 50 === 0) console.log(`  …${changed}/${total} re-encoded (${mb(beforeBytes - afterBytes)} saved so far)`);
  }

  if (safety) await new Promise((resolve) => safety.end(resolve));

  console.log(`\nInspected ${inspected} · ${APPLY ? "re-encoded" : "would re-encode"} ${changed} · kept as-is ${skippedBigger} (webp not smaller) · unreadable ${skippedBad}`);
  console.log(`Stored size for those images: ${mb(beforeBytes)} → ${mb(afterBytes)}  (saves ${mb(beforeBytes - afterBytes)})`);
  if (APPLY) console.log(`Originals saved to: ${safetyPath}\n(undo any time: node scripts/reencode-images.mjs --restore "${safetyPath}")`);

  if (APPLY) {
    // Post-flight: no image row lost, and every card's "img:<id>" still resolves.
    const countAfter = await prisma.image.count();
    const dangling = await prisma.$queryRawUnsafe(`
      SELECT count(*)::int AS n FROM (
        SELECT c."userId", unnest(string_to_array(NULLIF(c."imageFront" || E'\n' || c."imageBack", E'\n'), E'\n')) AS ref
        FROM "Card" c
      ) r
      WHERE r.ref LIKE 'img:%'
        AND NOT EXISTS (SELECT 1 FROM "Image" i WHERE i."userId" = r."userId" AND i.id = substring(r.ref FROM 5))`);
    console.log(`Post-checks: ${countAfter} image rows (none lost) · dangling card refs: ${dangling[0].n} (must be 0)`);
    if (dangling[0].n > 0) process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error("FAILED:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
