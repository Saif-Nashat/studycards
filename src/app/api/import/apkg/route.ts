import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";
import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";

export const runtime = "nodejs";
// Importing a big image-heavy deck means many inserts to the database; give it room.
export const maxDuration = 300;

// Anki separates a note's fields with the "unit separator" control character
// (0x1F). Written as an explicit escape — a literal invisible character here is
// too easy to lose in an edit, and losing it splits notes into single letters.
const FIELD_SEP = "\x1f";

// Skip images bigger than this so one giant scan can't bloat the database row.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
// Ad/widget images that some decks (OnlineMedEd, etc.) sprinkle into every card —
// pure promo, no study value, and embedding hundreds of copies wastes space.
const PROMO_IMAGE = /^_OME_|bootcamp/i;

// Strip HTML tags and decode a few common entities so cards read cleanly.
function cleanText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---- Tag cleanup -----------------------------------------------------------
// Community decks (AnKing etc.) carry hundreds of deeply-nested housekeeping
// tags like `#AK_Step1_v12::^Other::^HighYield::1-HighYield`. Those are useless
// for studying, so we throw away the machinery and map what's left onto a small
// set of friendly, grouped topic names (e.g. "Reproductive Pathology").

// Whole tags matching this are pure organisational machinery — ignore them.
const TAG_SKIP =
  /no[_\s-]?dupes|flag[_\s-]?these|update[_\s-]?tags|image[_\s-]?ready|imageready|cards[_\s-]?anking|potential[_\s-]?dup|ome[_\s-]?banner|physeo|sketchy|amboss|free120|uwsa|highyield|loweryield/i;

// Individual path segments that are noise even when the rest of the tag isn't.
const TAG_NOISE = new Set([
  "physiology", "pathology temporary", "other", "systems", "shelf", "done",
  "general", "subjects", "misc",
]);

// Ordered, first-match-wins: a normalised segment matching the pattern becomes
// the friendly label. Specific topics first, broad ones last.
const TAG_GROUPS: [RegExp, string][] = [
  [/endometrios/, "Endometriosis"],
  [/breast/, "Breast"],
  [/ovary|ovarian|adnex/, "Ovary"],
  [/cervix|cervical/, "Cervix"],
  [/vulva|vagina|vulvar/, "Vulva & Vagina"],
  [/uterus|uterine|myometri|endometrial|endometrium|fibroid|leiomyoma/, "Uterus"],
  [/menstr|menopaus|amenorrhea|menarche|pms|pcos/, "Menstrual & Menopause"],
  [/infertil|fertility/, "Infertility"],
  [/contracept/, "Contraception"],
  [/std|sti|sexually transmitted|hpv|chlamydia|gonorrhea|syphilis|herpes|trichomon|viruses|virology|infectious/, "Infections"],
  [/cancer|carcinoma|neoplas|oncolog|tumou?r|malignan/, "Oncology"],
  [/preeclamp|eclampsia|gestational|pregnan|prenatal|obstetric|labou?r|delivery|placenta|fetal|antepartum|postpartum/, "Obstetrics"],
  [/reproduc.*phys|repro.*phys|physiology.*anatomy|anatomy.*embryo|repro.*anatomy|embryo/, "Reproductive Physiology & Anatomy"],
  [/reproduc.*path|repro.*path|female pathology/, "Reproductive Pathology"],
  [/female repro|reproduc|reproduction|^repro|20 repro/, "Reproductive"],
  [/gynec|obgyn|ob gyn|gynaec/, "Gynecology"],
  [/pharmacolog/, "Pharmacology"],
  [/microbiolog|bugs|antibiotic|antimicrob/, "Microbiology"],
  [/genetic/, "Genetics"],
  [/endocrin|hormone|pituitary|prolactin|thyroid/, "Endocrine"],
  [/surger|perioperative|post op|postoperative|post operative/, "Surgery"],
  [/ethic/, "Ethics"],
  [/biostat|epidemiolog|statistic/, "Biostatistics"],
  [/behavioral|psychiatr|psychiatry/, "Psychiatry & Behavioral"],
  [/neurolog|nervous/, "Neurology"],
  [/pathophysiolog/, "Pathophysiology"],
  [/patholog/, "Pathology"],
];

// Turn one "::"-separated path segment into lowercase words we can match on.
function normalizeTagSegment(seg: string): string {
  return seg
    .replace(/^[#!^*+~]+/, "")        // leading marker chars (#, !, ^, …)
    .replace(/^\d+\s*[-_.]\s*/, "")   // numeric priority prefixes ("13_", "1-")
    .replace(/[_/]+/g, " ")
    .replace(/-/g, " ")
    .replace(/[():.,!*#^+&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Reduce a note's raw Anki tag string to a few friendly, grouped topic tags.
function cleanTags(raw: string): string[] {
  const found = new Set<string>();
  for (const tag of raw.split(/\s+/).filter(Boolean)) {
    if (TAG_SKIP.test(tag)) continue;
    for (const seg of tag.split("::")) {
      const n = normalizeTagSegment(seg);
      if (!n || n.length < 3 || TAG_NOISE.has(n)) continue;
      for (const [re, label] of TAG_GROUPS) {
        if (re.test(n)) { found.add(label); break; }
      }
    }
  }
  return [...found].slice(0, 6);
}

const IMG_RE = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

// Pull the src filenames out of a chunk of Anki field HTML, decoding the few
// ways a filename can be escaped (HTML entities, percent-encoding).
function imageRefs(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(IMG_RE)) {
    let src = m[1]
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"');
    try {
      // Some decks percent-encode spaces/unicode in the src.
      if (/%[0-9a-f]{2}/i.test(src)) src = decodeURIComponent(src);
    } catch {
      /* leave as-is if it isn't valid percent-encoding */
    }
    out.push(src);
  }
  return out;
}

function mimeFor(name: string): string {
  const ext = name.toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    bmp: "image/bmp",
  };
  return map[ext] || "image/jpeg";
}

// Load sharp once (it ships with Next). If it's ever unavailable we fall back to
// embedding the original bytes, so the import still works — just larger.
let sharpMod: typeof import("sharp") | null = null;
let sharpTried = false;
async function getSharp() {
  if (sharpTried) return sharpMod;
  sharpTried = true;
  try {
    sharpMod = (await import("sharp")).default as unknown as typeof import("sharp");
  } catch {
    sharpMod = null;
  }
  return sharpMod;
}

// Full-resolution exam screenshots are huge and they get stored straight in the
// database (one row per card). Shrink them to a sensible on-screen size and
// re-encode so a single deck doesn't balloon the database. Animated GIFs and
// vector SVGs are left untouched (resizing would break them).
//
// Tuned fairly aggressively (1000px / quality 55) to keep the free database
// small: this roughly halves the stored size vs. full quality while text and
// slides stay readable at the size cards are shown. Bump these up if you ever
// move images out to dedicated file storage and stop worrying about DB size.
const IMG_MAX_DIM = 950;
const IMG_QUALITY = 52;
async function shrinkImage(bytes: Uint8Array, filename: string): Promise<{ data: Uint8Array; mime: string }> {
  const ext = filename.toLowerCase().split(".").pop() || "";
  if (ext === "svg" || ext === "gif") return { data: bytes, mime: mimeFor(filename) };
  const sharp = await getSharp();
  if (!sharp) return { data: bytes, mime: mimeFor(filename) };
  try {
    const out = await sharp(Buffer.from(bytes))
      .rotate() // honour EXIF orientation before we drop the metadata
      .resize({ width: IMG_MAX_DIM, height: IMG_MAX_DIM, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: IMG_QUALITY })
      .toBuffer();
    // Only keep the re-encoded version if it actually came out smaller.
    if (out.length < bytes.byteLength) return { data: out, mime: "image/jpeg" };
  } catch {
    /* unreadable/odd image — fall through and embed the original */
  }
  return { data: bytes, mime: mimeFor(filename) };
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    const deckName = (form?.get("deckName") as string) || "";

    if (!file || typeof file === "string") {
      return jsonError("No .apkg file uploaded");
    }

    const buf = Buffer.from(await (file as File).arrayBuffer());

    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buf);
    } catch {
      return jsonError(
        "That file isn't a valid .apkg (zip) file. If it's very large, make sure the whole upload finished."
      );
    }

    // Prefer legacy/plain SQLite collections we can read directly.
    const dbEntry = zip.file("collection.anki21") || zip.file("collection.anki2");
    if (!dbEntry) {
      if (zip.file("collection.anki21b")) {
        return jsonError(
          "This deck uses Anki's newest compressed format. In Anki, re-export it with the 'Support older Anki versions (slower/larger)' box ticked, then upload again."
        );
      }
      return jsonError("Couldn't find an Anki collection inside the file.");
    }

    const dbBytes = await dbEntry.async("uint8array");

    const wasmPath = path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");
    const wasmBuf = fs.readFileSync(wasmPath);
    const wasmArrayBuffer = wasmBuf.buffer.slice(
      wasmBuf.byteOffset,
      wasmBuf.byteOffset + wasmBuf.byteLength
    ) as ArrayBuffer;
    const SQL = await initSqlJs({ wasmBinary: wasmArrayBuffer });
    const db = new SQL.Database(dbBytes);

    // Read notes: `flds` holds the fields, `tags` the tags.
    let rows: { flds: string; tags: string }[] = [];
    try {
      const res = db.exec("SELECT flds, tags FROM notes");
      if (res.length) {
        const cols = res[0].columns;
        const fIdx = cols.indexOf("flds");
        const tIdx = cols.indexOf("tags");
        rows = res[0].values.map((v) => ({
          flds: String(v[fIdx] ?? ""),
          tags: String(v[tIdx] ?? ""),
        }));
      }
    } catch {
      db.close();
      return jsonError("Couldn't read cards from this deck.");
    }
    db.close();

    if (rows.length === 0) {
      return jsonError("No cards found in this deck.");
    }

    // Anki stores media as numbered files (0, 1, 2…) plus a `media` JSON that
    // maps each number to its real filename. Build the reverse lookup so an
    // <img src="picture.jpg"> in a card can find its bytes in the zip.
    const numberByFilename = new Map<string, string>();
    const mediaEntry = zip.file("media");
    if (mediaEntry) {
      try {
        const mediaMap = JSON.parse(await mediaEntry.async("string")) as Record<string, string>;
        for (const [num, fname] of Object.entries(mediaMap)) numberByFilename.set(fname, num);
      } catch {
        /* no usable media map — cards still import as text */
      }
    }

    // Resolve a referenced filename to a stored-image reference ("img:<hash>").
    // Each unique image (by its compressed bytes) is kept once in `uniqueImages`
    // and written to the shared Image table later, so a picture reused across
    // dozens of cards costs storage only once.
    const uniqueImages = new Map<string, { mime: string; data: string }>();
    const refCache = new Map<string, string | null>();
    async function imageRef(filename: string): Promise<string | null> {
      if (refCache.has(filename)) return refCache.get(filename)!;
      let ref: string | null = null;
      if (!PROMO_IMAGE.test(filename)) {
        const num = numberByFilename.get(filename);
        const entry = num ? zip.file(num) : null;
        if (entry) {
          const raw = await entry.async("uint8array");
          if (raw.byteLength <= MAX_IMAGE_BYTES) {
            const { data, mime } = await shrinkImage(raw, filename);
            const id = createHash("sha256").update(data).digest("hex").slice(0, 24);
            if (!uniqueImages.has(id)) {
              uniqueImages.set(id, { mime, data: Buffer.from(data).toString("base64") });
            }
            ref = `img:${id}`;
          }
        }
      }
      refCache.set(filename, ref);
      return ref;
    }

    // Collect the images referenced in a chunk of HTML, de-duplicated, as refs.
    async function collectImages(html: string): Promise<string[]> {
      const seenSrc = new Set<string>();
      const refs: string[] = [];
      for (const src of imageRefs(html)) {
        if (seenSrc.has(src)) continue;
        seenSrc.add(src);
        const ref = await imageRef(src);
        if (ref) refs.push(ref);
      }
      return refs;
    }

    const name = (deckName || (file as File).name.replace(/\.apkg$/i, "") || "Imported deck").trim();
    const deck = await prisma.deck.upsert({ where: { name }, update: {}, create: { name } });

    const existing = await prisma.card.findMany({ where: { deckId: deck.id }, select: { front: true } });
    const seen = new Set(existing.map((c) => c.front.trim()));

    const toCreate: {
      deckId: string;
      type: string;
      front: string;
      back: string;
      extra: string;
      tags: string;
      source: string;
      imageFront: string;
      imageBack: string;
    }[] = [];

    for (const row of rows) {
      const rawFields = row.flds.split(FIELD_SEP);
      const frontRaw = rawFields[0] ?? "";
      const backRaw = rawFields.slice(1).join(FIELD_SEP);

      const isCloze = /\{\{c\d+::/.test(row.flds);
      const cleaned = rawFields.map(cleanText).filter((x) => x.length);
      const front = isCloze ? cleanText(frontRaw) : cleaned[0] || "";
      const back = isCloze
        ? cleaned.slice(1).join("\n\n")
        : cleaned.slice(1).join("\n\n");

      const frontImages = await collectImages(frontRaw);
      // Don't repeat an image on the back if it already shows on the front.
      const frontSet = new Set(frontImages);
      const backImages = (await collectImages(backRaw)).filter((u) => !frontSet.has(u));

      // Keep the card if it has any text OR any picture (lots of UWorld-style
      // cards are essentially "question text → answer image").
      const hasContent = front || back || frontImages.length || backImages.length;
      if (!hasContent) continue;

      // De-duplicate on whatever identifies the card (front text, else its first image).
      const key = (front || frontImages[0] || backImages[0] || "").trim();
      if (seen.has(key)) continue;
      seen.add(key);

      toCreate.push({
        deckId: deck.id,
        type: isCloze ? "cloze" : "basic",
        front,
        back,
        extra: "",
        tags: cleanTags(row.tags).join(","),
        source: name,
        imageFront: frontImages.join("\n"),
        imageBack: backImages.join("\n"),
      });
    }

    // Store the unique images first (skipping any this deck shares with one
    // already imported), so the cards' "img:<id>" references resolve.
    const imageRows = [...uniqueImages.entries()].map(([id, v]) => ({ id, mime: v.mime, data: v.data }));
    const IMG_BATCH = 25;
    for (let i = 0; i < imageRows.length; i += IMG_BATCH) {
      await prisma.image.createMany({ data: imageRows.slice(i, i + IMG_BATCH), skipDuplicates: true });
    }

    // Insert cards in batches. Rows are now tiny (text + short image refs), so
    // these go fast.
    let added = 0;
    const BATCH = 100;
    for (let i = 0; i < toCreate.length; i += BATCH) {
      const slice = toCreate.slice(i, i + BATCH);
      const r = await prisma.card.createMany({ data: slice });
      added += r.count;
    }

    return NextResponse.json({
      ok: true,
      added,
      skipped: rows.length - added,
      deckId: deck.id,
      deckName: name,
    });
  } catch (err) {
    console.error("apkg import failed:", err);
    return jsonError(
      "Something went wrong importing that deck. It may be too large or in an unsupported format.",
      500
    );
  }
}
