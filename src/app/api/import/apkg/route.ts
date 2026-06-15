import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import JSZip from "jszip";
import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

// Anki separates a note's fields with the "unit separator" control character.
const FIELD_SEP = "";

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

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const deckName = (form?.get("deckName") as string) || "";

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No .apkg file uploaded" }, { status: 400 });
  }

  const buf = Buffer.from(await (file as File).arrayBuffer());

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buf);
  } catch {
    return NextResponse.json({ error: "That file isn't a valid .apkg (zip) file." }, { status: 400 });
  }

  // Prefer legacy/plain SQLite collections we can read directly.
  const dbEntry = zip.file("collection.anki21") || zip.file("collection.anki2");
  if (!dbEntry) {
    if (zip.file("collection.anki21b")) {
      return NextResponse.json(
        { error: "This deck uses Anki's newest compressed format. In Anki, re-export it with the 'Support older Anki versions (slower/larger)' box ticked, then upload again." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Couldn't find an Anki collection inside the file." }, { status: 400 });
  }

  const dbBytes = await dbEntry.async("uint8array");

  const wasmPath = path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");
  const wasmBuf = fs.readFileSync(wasmPath);
  const wasmArrayBuffer = wasmBuf.buffer.slice(wasmBuf.byteOffset, wasmBuf.byteOffset + wasmBuf.byteLength) as ArrayBuffer;
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
    return NextResponse.json({ error: "Couldn't read cards from this deck." }, { status: 400 });
  }
  db.close();

  if (rows.length === 0) {
    return NextResponse.json({ error: "No cards found in this deck." }, { status: 400 });
  }

  const name = (deckName || (file as File).name.replace(/\.apkg$/i, "") || "Imported deck").trim();
  const deck = await prisma.deck.upsert({ where: { name }, update: {}, create: { name } });

  const existing = await prisma.card.findMany({ where: { deckId: deck.id }, select: { front: true } });
  const seen = new Set(existing.map((c) => c.front.trim()));

  const toCreate: {
    deckId: string; type: string; front: string; back: string; extra: string; tags: string; source: string;
  }[] = [];

  for (const row of rows) {
    const rawFields = row.flds.split(FIELD_SEP);
    const fields = rawFields.map(cleanText).filter((x) => x.length);
    if (fields.length === 0) continue;

    const isCloze = /\{\{c\d+::/.test(row.flds);
    const front = isCloze ? cleanText(rawFields[0]) : fields[0];
    if (!front || seen.has(front.trim())) continue;
    seen.add(front.trim());

    const back = isCloze ? fields.slice(1).join("\n\n") : fields.slice(1).join("\n\n");
    toCreate.push({
      deckId: deck.id,
      type: isCloze ? "cloze" : "basic",
      front,
      back,
      extra: "",
      tags: row.tags.trim().replace(/\s+/g, ","),
      source: name,
    });
  }

  // Insert in batches for speed (decks can have thousands of cards).
  let added = 0;
  const BATCH = 200;
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
}
