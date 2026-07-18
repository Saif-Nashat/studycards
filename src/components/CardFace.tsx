"use client";

// Renders a card's question and answer for the three card types: basic, cloze, list.

export interface CardData {
  id: string;
  type: string;
  front: string;
  back: string;
  extra: string;
  tags: string;
  source: string;
  // Scheduling state (present from the API; used to preview next-review timing).
  state?: string;
  intervalDays?: number;
  ease?: number;
  reps?: number;
  lapses?: number;
  flagged?: boolean;
  isLeech?: boolean;
  imageFront?: string;
  imageBack?: string;
  mnemonic?: string;
}

// A card can carry several media entries (e.g. UWorld answer screenshots, or
// pronunciation/murmur audio), stored newline-joined. Each entry is either an
// inline data: URI (e.g. an image added by hand) or a reference to the shared
// media store — "img:<id>" for pictures, "snd:<id>" for audio — served from
// /api/image/<id>.
export function resolveImageSrc(entry: string): string {
  const m = entry.match(/^(?:img|snd):(.+)$/);
  return m ? `/api/image/${m[1]}` : entry;
}

// Cards imported before audio support (or via plain text) can carry literal
// Anki "[sound:file.mp3]" markers in their text — never show those.
export function stripSoundTags(text: string): string {
  return text.replace(/\[sound:[^\]]*\]/gi, "");
}

function CardMedia({ src }: { src?: string }) {
  if (!src) return null;
  const entries = src.split("\n").map((s) => s.trim()).filter(Boolean);
  if (!entries.length) return null;
  const images = entries.filter((s) => !s.startsWith("snd:"));
  const sounds = entries.filter((s) => s.startsWith("snd:"));
  return (
    <div className="space-y-3">
      {images.map((s, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={resolveImageSrc(s)} alt="" className="mt-4 rounded-xl max-h-72 mx-auto object-contain border border-[var(--color-line)]" />
      ))}
      {sounds.map((s, i) => (
        <audio key={i} controls preload="metadata" src={resolveImageSrc(s)} className="mt-4 w-full max-w-md mx-auto block" />
      ))}
    </div>
  );
}

const CLOZE_RE = /\{\{c\d+::(.*?)(?:::(.*?))?\}\}/g;

function clozeQuestion(text: string): string {
  return stripSoundTags(text).replace(CLOZE_RE, (_m, _ans, hint) => (hint ? `[${hint}]` : "[ ... ]"));
}
// Split cloze text into chunks, marking which chunks were the hidden answers.
function clozeSegments(raw: string): { text: string; answer: boolean }[] {
  const text = stripSoundTags(raw);
  const segments: { text: string; answer: boolean }[] = [];
  let lastIndex = 0;
  for (const m of text.matchAll(CLOZE_RE)) {
    const idx = m.index ?? 0;
    if (idx > lastIndex) segments.push({ text: text.slice(lastIndex, idx), answer: false });
    segments.push({ text: m[1], answer: true });
    lastIndex = idx + m[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), answer: false });
  return segments;
}

export function parseList(back: string): string[] {
  try {
    const arr = JSON.parse(back);
    if (Array.isArray(arr)) return arr.map(String);
  } catch {
    /* not JSON */
  }
  return back.split(/\r?\n/).filter((l) => l.trim());
}

export function CardQuestion({ card }: { card: CardData }) {
  return (
    <div>
      {card.type === "cloze"
        ? <Text value={clozeQuestion(card.front)} className="text-2xl md:text-3xl font-semibold leading-relaxed" />
        : <Text value={card.front} className="text-2xl md:text-3xl font-semibold leading-relaxed" />}
      <CardMedia src={card.imageFront} />
    </div>
  );
}

export function CardAnswer({ card }: { card: CardData }) {
  if (card.type === "cloze") {
    const segments = clozeSegments(card.front);
    return (
      <div className="space-y-3">
        <p dir="auto" className="text-xl md:text-2xl leading-relaxed">
          {segments.map((s, i) =>
            s.answer ? (
              <mark key={i} className="rounded px-1" style={{ background: "var(--color-chip-bg)", color: "var(--color-chip-ink)" }}>{s.text}</mark>
            ) : (
              <span key={i}>{s.text}</span>
            )
          )}
        </p>
        <CardMedia src={card.imageBack} />
        <AnswerExtras card={card} />
      </div>
    );
  }

  if (card.type === "list") {
    const items = parseList(card.back);
    return (
      <div className="space-y-3">
        <ul className="space-y-2 text-lg md:text-xl">
          {items.map((it, i) => (
            <li key={i} dir="auto" className="flex gap-2.5 items-start">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] shrink-0" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
        <CardMedia src={card.imageBack} />
        <AnswerExtras card={card} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Text value={card.back} className="text-xl md:text-2xl leading-relaxed" />
      <CardMedia src={card.imageBack} />
      <AnswerExtras card={card} />
    </div>
  );
}

// Render plain text, keeping line breaks. dir="auto" per line so RTL scripts
// (Arabic, Hebrew…) align right while Latin lines in the same card stay left.
function Text({ value, className }: { value: string; className?: string }) {
  return (
    <div className={`${className ?? ""} break-words`}>
      {stripSoundTags(value).split(/\r?\n/).map((line, i) => (
        <p key={i} dir="auto">{line || " "}</p>
      ))}
    </div>
  );
}

// Explanation ("why this is correct") + mnemonic, shown after the answer is revealed.
function AnswerExtras({ card }: { card: CardData }) {
  if (!card.extra && !card.mnemonic) return null;
  return (
    <div className="mt-3 space-y-2">
      {card.extra && (
        <div className="rounded-xl bg-[var(--color-tint)] border border-[var(--color-line)] p-3.5 text-sm">
          <p className="font-semibold text-[var(--color-chip-ink)] mb-1">Why this is correct</p>
          <div className="text-[var(--color-ink)] leading-relaxed">
            {card.extra.split(/\r?\n/).map((l, i) => <p key={i} dir="auto">{l || " "}</p>)}
          </div>
        </div>
      )}
      {card.mnemonic && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 text-sm">
          <p className="font-semibold text-amber-700 mb-1">🧠 Mnemonic</p>
          <div className="text-amber-900 leading-relaxed">
            {card.mnemonic.split(/\r?\n/).map((l, i) => <p key={i} dir="auto">{l || " "}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}
