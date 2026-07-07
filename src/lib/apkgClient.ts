// Browser-side .apkg import.
//
// Why the deck is parsed here and not on the server: the app runs on Vercel,
// whose functions reject any request body over ~4.5 MB with a bare 413 —
// no server or Next.js setting can raise that platform limit. Real Anki decks
// bundle their images and routinely run 100 MB+, so the file can never travel
// to the server in one piece. Instead the browser unzips the deck, reads the
// SQLite collection with sql.js (WASM, served from /sql-wasm-browser.wasm),
// shrinks each image on a canvas, keeps audio clips as-is (video is skipped),
// and uploads the results to /api/import/apkg as JSON batches that each stay
// far below the limit.
//
// The cleaning/shrinking rules mirror what the server route used to do, so
// imported decks come out the same as before.

// Anki separates a note's fields with the "unit separator" control character
// (0x1F). Written as an explicit escape — a literal invisible character here
// is too easy to lose in an edit, and losing it splits notes into single letters.
const FIELD_SEP = "\x1f";

// Skip images bigger than this so one giant scan can't bloat the database row.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
// Audio is stored as-is — a browser can't usefully re-encode audio the way
// the canvas shrinks images — so cap the file size instead. 1.8 MB is ~2
// minutes of 128 kbps mp3, far beyond any pronunciation or murmur clip, and
// its base64 still fits inside a single upload batch.
const MAX_AUDIO_BYTES = 1_800_000;
// Ad/widget images that some decks (OnlineMedEd, etc.) sprinkle into every card —
// pure promo, no study value, and embedding hundreds of copies wastes space.
const PROMO_IMAGE = /^_OME_|bootcamp/i;

// Full-resolution exam screenshots are huge and they get stored straight in
// the database. Shrink to a sensible on-screen size, WebP q45 where the
// browser can encode it (≈ the old sharp pipeline), JPEG elsewhere (Safari
// can't encode WebP on a canvas — it silently hands back PNG instead).
const IMG_MAX_DIM = 950;
const WEBP_QUALITY = 0.45;
const JPEG_QUALITY = 0.6;

// Flush a batch to the server before it grows past this. Vercel rejects
// bodies over ~4.5 MB; 3 MB of payload leaves a wide margin for base64 and
// JSON overhead.
const BATCH_LIMIT = 3_000_000;
// Also cap cards per batch so one request never asks the server for an
// unbounded number of inserts (text-only cards are tiny, so a 3 MB batch
// could otherwise hold tens of thousands).
const BATCH_MAX_CARDS = 500;
// An image whose *final* encoding can't fit in a batch has to be dropped —
// the card still imports as text. (Only reachable when shrinking failed on
// a multi-MB original, which is vanishingly rare.)
const MAX_EMBED_BASE64 = 2_500_000;

export interface ApkgProgress {
  phase: "reading" | "cards";
  done: number;
  total: number;
}

export interface ApkgResult {
  added: number;
  skipped: number;
  deckName: string;
}

// Thrown for any user-facing failure. `addedSoFar` lets the page say
// "imported 800 cards, then ran out of space" instead of pretending
// nothing happened.
export class ApkgImportError extends Error {
  addedSoFar: number;
  constructor(message: string, addedSoFar = 0) {
    super(message);
    this.addedSoFar = addedSoFar;
  }
}

// Strip HTML tags and decode a few common entities so cards read cleanly.
// Anki's [sound:...] media markers go too — the audio they point at is
// imported separately (video isn't), and the marker itself is just noise.
function cleanText(html: string): string {
  return html
    .replace(/\[sound:[^\]]*\]/gi, "")
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

// src can be double-quoted, single-quoted or (in some very old decks) bare.
const IMG_RE = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
// Audio and video are both referenced with the same non-HTML tag.
const SOUND_RE = /\[sound:([^\]]+)\]/gi;

// Only these [sound:...] files are imported; anything else (mp4, webm, mkv,
// mov, avi… — i.e. video) is deliberately skipped: the files are huge and the
// app doesn't play video.
const AUDIO_EXTS = new Set(["mp3", "m4a", "ogg", "oga", "opus", "spx", "wav", "flac", "aac", "3gp"]);

// Decode the few ways a media filename can be escaped in field HTML
// (HTML entities, percent-encoding).
function decodeMediaName(src: string): string {
  let name = src
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
  try {
    // Some decks percent-encode spaces/unicode in the src.
    if (/%[0-9a-f]{2}/i.test(name)) name = decodeURIComponent(name);
  } catch {
    /* leave as-is if it isn't valid percent-encoding */
  }
  return name;
}

// Pull the <img> src filenames out of a chunk of Anki field HTML.
function imageRefsIn(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(IMG_RE)) {
    const src = decodeMediaName(m[1] ?? m[2] ?? m[3] ?? "");
    if (src) out.push(src);
  }
  return out;
}

// Pull the [sound:...] filenames (audio and video alike; filtered later).
function soundRefsIn(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(SOUND_RE)) {
    const name = decodeMediaName(m[1].trim());
    if (name) out.push(name);
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
    avif: "image/avif",
    ico: "image/x-icon",
    tif: "image/tiff",
    tiff: "image/tiff",
  };
  return map[ext] || "image/jpeg";
}

function mimeForAudio(name: string): string {
  const ext = name.toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    opus: "audio/ogg",
    spx: "audio/ogg",
    wav: "audio/wav",
    flac: "audio/flac",
    aac: "audio/aac",
    "3gp": "audio/3gpp",
  };
  return map[ext] || "audio/mpeg";
}

// A plain ArrayBuffer covering exactly this view's bytes (Blob/crypto want one).
function bufferOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000; // String.fromCharCode chokes on very long argument lists
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

// Same id scheme as the Image table: sha256 of the stored bytes, first 24 hex chars.
async function hashId(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

function encodeCanvas(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function shrinkImage(bytes: Uint8Array, filename: string): Promise<{ data: Uint8Array; mime: string }> {
  const original = { data: bytes, mime: mimeFor(filename) };
  const ext = filename.toLowerCase().split(".").pop() || "";
  // Resizing would break animation/vectors — embed those untouched.
  if (ext === "svg" || ext === "gif") return original;

  let bitmap: ImageBitmap;
  try {
    // 'from-image' honours EXIF orientation, like the old sharp .rotate() did.
    bitmap = await createImageBitmap(new Blob([bufferOf(bytes)], { type: original.mime }), {
      imageOrientation: "from-image",
    });
  } catch {
    return original; // undecodable/odd image — embed as-is
  }

  const scale = Math.min(1, IMG_MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return original;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  let out = await encodeCanvas(canvas, "image/webp", WEBP_QUALITY);
  if (!out || out.type !== "image/webp") {
    // JPEG has no alpha channel — composite onto white so transparent
    // diagrams don't come out black.
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    out = await encodeCanvas(canvas, "image/jpeg", JPEG_QUALITY);
  }
  // Only keep the re-encoded version if it actually came out smaller.
  if (out && out.size < bytes.byteLength) {
    return { data: new Uint8Array(await out.arrayBuffer()), mime: out.type };
  }
  return original;
}

// Let the UI repaint between chunks of work — the whole import runs on the
// main thread.
const tick = () => new Promise((r) => setTimeout(r, 0));

interface BatchCard {
  type: string;
  front: string;
  back: string;
  tags: string; // raw Anki tag string; the server maps it onto study buckets
  imageFront: string;
  imageBack: string;
}

// One stored media blob — a shrunk image or an audio clip. (The upload field
// is still called `images` because that's what the server route has always
// accepted; audio simply rides the same store.)
interface BatchImage {
  id: string;
  mime: string;
  data: string; // base64, no data: prefix
}

export async function importApkgFile(
  file: File,
  deckName: string,
  onProgress: (p: ApkgProgress) => void
): Promise<ApkgResult> {
  if (!crypto?.subtle) {
    throw new ApkgImportError("Importing needs a secure (https) connection — reload the app over https and try again.");
  }

  onProgress({ phase: "reading", done: 0, total: 1 });

  // Both libraries are heavy; load them only when an import actually starts.
  const [{ default: JSZip }, { default: initSqlJs }] = await Promise.all([
    import("jszip"),
    import("sql.js"),
  ]);

  let zip: InstanceType<typeof JSZip>;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch {
    throw new ApkgImportError("That file isn't a valid .apkg (zip) file. If the download is very large, make sure it finished completely.");
  }

  // Prefer legacy/plain SQLite collections we can read directly.
  const dbEntry = zip.file("collection.anki21") || zip.file("collection.anki2");
  if (!dbEntry) {
    if (zip.file("collection.anki21b")) {
      throw new ApkgImportError(
        "This deck uses Anki's newest compressed format. In Anki, re-export it with the 'Support older Anki versions (slower/larger)' box ticked, then upload again."
      );
    }
    throw new ApkgImportError("Couldn't find an Anki collection inside the file.");
  }

  const dbBytes = await dbEntry.async("uint8array");
  const SQL = await initSqlJs({ locateFile: () => "/sql-wasm-browser.wasm" });
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
    throw new ApkgImportError("Couldn't read cards from this deck.");
  }
  db.close();

  if (rows.length === 0) {
    throw new ApkgImportError("No cards found in this deck.");
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

  const name = (deckName || file.name.replace(/\.apkg$/i, "") || "Imported deck").trim();

  // ---- Batched upload state ----
  let batchCards: BatchCard[] = [];
  let batchImages: BatchImage[] = [];
  let batchBytes = 0;
  let added = 0;
  let serverSkipped = 0;

  async function flush() {
    if (!batchCards.length && !batchImages.length) return;
    let res: Response;
    try {
      res = await fetch("/api/import/apkg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckName: name, cards: batchCards, images: batchImages }),
      });
    } catch {
      throw new ApkgImportError(
        "The upload was interrupted — check your connection and try again. Cards that already made it in will be skipped automatically.",
        added
      );
    }
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      throw new ApkgImportError(data?.error || `Upload failed (server said ${res.status}).`, added);
    }
    added += data.added || 0;
    serverSkipped += data.skipped || 0;
    batchCards = [];
    batchImages = [];
    batchBytes = 0;
  }

  // Hash a finished blob and queue it for upload exactly once (in whichever
  // batch first needs it), so media reused across dozens of cards costs
  // upload and storage only once. Returns the content id, or null if the
  // encoding is too big to embed at all.
  const sentMedia = new Set<string>();
  async function stageMedia(data: Uint8Array, mime: string): Promise<string | null> {
    const b64 = toBase64(data);
    if (b64.length > MAX_EMBED_BASE64) return null;
    const id = await hashId(bufferOf(data));
    if (!sentMedia.has(id)) {
      // If this blob alone would overflow the batch, ship what we have first.
      if (batchBytes + b64.length > BATCH_LIMIT) await flush();
      batchImages.push({ id, mime, data: b64 });
      batchBytes += b64.length;
      sentMedia.add(id);
    }
    return id;
  }

  // Resolve a referenced filename to a stored-image reference ("img:<hash>").
  const refCache = new Map<string, string | null>(); // filename -> "img:<id>" | null
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
          const id = await stageMedia(data, mime);
          if (id) ref = `img:${id}`;
        }
      }
    }
    refCache.set(filename, ref);
    return ref;
  }

  // Resolve a [sound:...] filename to a stored-audio reference ("snd:<hash>").
  // Video extensions never get a ref — their markers were already stripped
  // from the text, so the card simply imports without the clip.
  const audioCache = new Map<string, string | null>(); // filename -> "snd:<id>" | null
  async function audioRef(filename: string): Promise<string | null> {
    if (audioCache.has(filename)) return audioCache.get(filename)!;
    let ref: string | null = null;
    const ext = filename.toLowerCase().split(".").pop() || "";
    if (AUDIO_EXTS.has(ext)) {
      const num = numberByFilename.get(filename);
      const entry = num ? zip.file(num) : null;
      if (entry) {
        const raw = await entry.async("uint8array");
        if (raw.byteLength <= MAX_AUDIO_BYTES) {
          const id = await stageMedia(raw, mimeForAudio(filename));
          if (id) ref = `snd:${id}`;
        }
      }
    }
    audioCache.set(filename, ref);
    return ref;
  }

  // Collect the media referenced in a chunk of HTML, de-duplicated, as refs —
  // pictures first, then audio clips.
  async function collectMedia(html: string): Promise<string[]> {
    const refs: string[] = [];
    const seenSrc = new Set<string>();
    for (const src of imageRefsIn(html)) {
      if (seenSrc.has(src)) continue;
      seenSrc.add(src);
      const ref = await imageRef(src);
      if (ref) refs.push(ref);
    }
    for (const src of soundRefsIn(html)) {
      if (seenSrc.has(src)) continue;
      seenSrc.add(src);
      const ref = await audioRef(src);
      if (ref) refs.push(ref);
    }
    return refs;
  }

  const seen = new Set<string>(); // within-file dedupe; the server dedupes against the deck
  let localSkipped = 0;

  for (let i = 0; i < rows.length; i++) {
    if (i % 25 === 0) {
      onProgress({ phase: "cards", done: i, total: rows.length });
      await tick();
    }
    const row = rows[i];
    const rawFields = row.flds.split(FIELD_SEP);
    const frontRaw = rawFields[0] ?? "";
    const backRaw = rawFields.slice(1).join(FIELD_SEP);

    const isCloze = /\{\{c\d+::/.test(row.flds);
    const cleaned = rawFields.map(cleanText).filter((x) => x.length);
    const front = isCloze ? cleanText(frontRaw) : cleaned[0] || "";
    const back = cleaned.slice(1).join("\n\n");

    const frontMedia = await collectMedia(frontRaw);
    // Don't repeat a picture/clip on the back if it already plays on the front.
    const frontSet = new Set(frontMedia);
    const backMedia = (await collectMedia(backRaw)).filter((u) => !frontSet.has(u));

    // Keep the card if it has any text OR any picture/audio (lots of
    // UWorld-style cards are essentially "question text → answer image",
    // and language cards can be nothing but a pronunciation clip).
    const hasContent = front || back || frontMedia.length || backMedia.length;
    if (!hasContent) {
      localSkipped++;
      continue;
    }

    // De-duplicate on whatever identifies the card (front text, else its first media).
    const key = (front || frontMedia[0] || backMedia[0] || "").trim();
    if (seen.has(key)) {
      localSkipped++;
      continue;
    }
    seen.add(key);

    const card: BatchCard = {
      type: isCloze ? "cloze" : "basic",
      front,
      back,
      tags: row.tags,
      imageFront: frontMedia.join("\n"),
      imageBack: backMedia.join("\n"),
    };
    const cardBytes =
      card.front.length + card.back.length + card.tags.length +
      card.imageFront.length + card.imageBack.length + 100; // + JSON overhead
    if (batchBytes + cardBytes > BATCH_LIMIT || batchCards.length >= BATCH_MAX_CARDS) {
      await flush();
    }
    batchCards.push(card);
    batchBytes += cardBytes;
  }

  onProgress({ phase: "cards", done: rows.length, total: rows.length });
  await flush();

  return { added, skipped: localSkipped + serverSkipped, deckName: name };
}
