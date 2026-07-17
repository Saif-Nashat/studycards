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

// Parse a string as card JSON ({deck, cards} or a bare array); null if it
// isn't valid JSON of either shape.
function tryParseJson(text: string): ParseResult | null {
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
    /* not JSON */
  }
  return null;
}

// Some chatbots (ChatGPT and Gemini more than Claude) wrap the JSON in chatty
// prose ("Here are your flashcards! …") even when told not to. Fish it out:
// a fenced code block anywhere in the paste, else the outermost {...} / [...]
// span. Only accepted when it actually yields cards, so plain CSV pastes that
// happen to contain braces still reach the CSV path.
function tryParseEmbeddedJson(input: string): ParseResult | null {
  const fenced = input.match(/```[a-z]*\s*([\s\S]*?)```/i);
  if (fenced) {
    const r = tryParseJson(fenced[1].trim());
    if (r?.cards.length) return r;
  }
  for (const [open, close] of [["{", "}"], ["[", "]"]] as const) {
    const start = input.indexOf(open);
    const end = input.lastIndexOf(close);
    if (start !== -1 && end > start) {
      const r = tryParseJson(input.slice(start, end + 1));
      if (r?.cards.length) return r;
    }
  }
  return null;
}

export function parseImport(input: string): ParseResult {
  // Tolerate a pasted markdown code block (```json … ```): people often copy
  // the fences along with the JSON, which would otherwise fall through to the
  // CSV path and produce garbage cards.
  const text = input.trim().replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
  if (!text) return { cards: [] };

  // Try JSON first — the exact paste, then JSON buried in surrounding prose.
  const asJson = tryParseJson(text) ?? tryParseEmbeddedJson(input);
  if (asJson) return asJson;

  // CSV / TSV: each line "front<sep>back<sep>tags". Detect separator.
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const cards: ParsedCard[] = [];
  for (const [i, line] of lines.entries()) {
    const sep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    const parts = line.split(sep);
    const front = (parts[0] || "").trim();
    if (!front) continue;
    const back = (parts[1] || "").trim();
    // Spreadsheet exports usually start with a header row ("front,back" /
    // "Question;Answer") — that's labels, not a card.
    if (i === 0 && /^(front|question|q)$/i.test(front) && /^(back|answer|a)$/i.test(back)) continue;
    // A line with cloze markers is a card all by itself — no answer column needed.
    const isCloze = /\{\{c\d+::/.test(front);
    // A line with no answer isn't a card, it's prose (pasting an essay used to
    // create one junk answerless card per line).
    if (!isCloze && !back) continue;
    cards.push({
      type: isCloze ? "cloze" : "basic",
      front,
      back: isCloze ? "" : back,
      extra: "",
      mnemonic: "",
      tags: (parts[2] || "").trim(),
      source: "",
    });
  }
  return { cards };
}
