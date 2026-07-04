// Turns whatever the user pastes/uploads into a clean list of cards.
// Accepts: JSON (object with {deck, cards} or a bare array), CSV/TSV lines.

export interface ParsedCard {
  type: string;
  front: string;
  back: string;
  extra: string;
  mnemonic: string;
  tags: string;
  source: string;
}

export interface ParseResult {
  deckName?: string;
  cards: ParsedCard[];
}

function normalizeCard(raw: Record<string, unknown>): ParsedCard | null {
  const front = String(raw.front ?? raw.question ?? raw.q ?? "").trim();
  if (!front) return null;

  let back = raw.back ?? raw.answer ?? raw.a ?? "";
  // List cards may provide an array of items.
  if (Array.isArray(back)) back = JSON.stringify(back.map((x) => String(x)));
  else back = String(back);

  const type = String(raw.type ?? "basic").toLowerCase();
  return {
    type: ["basic", "cloze", "list"].includes(type) ? type : "basic",
    front,
    back: String(back),
    extra: String(raw.extra ?? raw.explanation ?? raw.note ?? "").trim(),
    mnemonic: String(raw.mnemonic ?? "").trim(),
    tags: String(raw.tags ?? "").trim(),
    source: String(raw.source ?? "").trim(),
  };
}

export function parseImport(input: string): ParseResult {
  // Tolerate a pasted markdown code block (```json … ```): people often copy
  // the fences along with the JSON, which would otherwise fall through to the
  // CSV path and produce garbage cards.
  const text = input.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
  if (!text) return { cards: [] };

  // Try JSON first.
  try {
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
      return { cards: data.map(normalizeCard).filter(Boolean) as ParsedCard[] };
    }
    if (data && typeof data === "object") {
      const cardsArr = Array.isArray(data.cards) ? data.cards : [];
      return {
        deckName: typeof data.deck === "string" ? data.deck : undefined,
        cards: cardsArr.map(normalizeCard).filter(Boolean) as ParsedCard[],
      };
    }
  } catch {
    // not JSON, fall through to CSV/TSV
  }

  // CSV / TSV: each line "front<sep>back<sep>tags". Detect separator.
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const cards: ParsedCard[] = [];
  for (const line of lines) {
    const sep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const parts = line.split(sep);
    const front = (parts[0] || "").trim();
    if (!front) continue;
    cards.push({
      type: "basic",
      front,
      back: (parts[1] || "").trim(),
      extra: "",
      mnemonic: "",
      tags: (parts[2] || "").trim(),
      source: "",
    });
  }
  return { cards };
}
