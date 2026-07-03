// Grouping tags for display — turns the flat list of study subjects into two
// labelled families so the picker reads like a syllabus instead of a word cloud:
//
//   • "Basic systems"  — body systems / anatomical-clinical areas
//   • "Medical topics" — cross-cutting disciplines (pharmacology, pathology, …)
//
// This is a *display* layer only: it never changes the tags stored on cards, so
// it's safe and reversible. It handles both the app's six broad buckets and any
// other tags a future import might introduce (via keyword matching + a fallback).

export type TagGroupKey = "systems" | "topics";

export const TAG_GROUP_LABELS: Record<TagGroupKey, string> = {
  systems: "Basic systems",
  topics: "Medical topics",
};

// The order groups appear in the UI.
export const TAG_GROUP_ORDER: TagGroupKey[] = ["systems", "topics"];

// Explicit placement for the six broad buckets the app already uses, so they
// always land where we expect regardless of the keyword heuristics below.
const EXPLICIT: Record<string, TagGroupKey> = {
  "Obstetrics": "systems",
  "Gynecology": "systems",
  "Reproductive Science": "systems",
  "Pathology & Oncology": "topics",
  "Pharmacology & Microbiology": "topics",
  "General Medicine & Research": "topics",
};

// Keywords that mark a tag as a body system / anatomical area.
const SYSTEM_RE =
  /obstetr|gyn|reproduc|pregnan|cardio|cardiac|heart|vascular|respir|pulmon|lung|renal|kidney|urinary|nephro|neuro|brain|nervous|psych|gastro|\bgi\b|hepat|liver|digest|endocrin|thyroid|adrenal|musculoskelet|\bmsk\b|bone|joint|ortho|rheumat|dermatolog|\bskin\b|hemat|haemat|blood|lymph|immun|reticuloendothel|ophthalm|\beye\b|\bent\b|otolaryng|head and neck|breast|pelvi/i;

// Keywords that mark a tag as a discipline / medical topic.
const TOPIC_RE =
  /pharmacolog|drug|patholog|oncolog|cancer|tumou?r|microbiolog|bacteri|virolog|\bviral|parasit|myco|physiolog|anatom|embryo|histolog|biochem|genetic|molecular|research|statistic|epidemiolog|ethics|public health|general medicine|principle/i;

// Classify a single tag string into a group.
export function groupForTag(tag: string): TagGroupKey {
  const explicit = EXPLICIT[tag.trim()];
  if (explicit) return explicit;
  const t = tag.toLowerCase();
  if (SYSTEM_RE.test(t)) return "systems";
  if (TOPIC_RE.test(t)) return "topics";
  return "topics"; // sensible catch-all: unknown subjects read as topics
}

// Split a list of tag objects into ordered groups. Preserves the incoming order
// within each group (callers pass tags already sorted by size). Empty groups are
// dropped so the UI never shows a bare heading.
export function groupTags<T extends { tag: string }>(items: T[]): { key: TagGroupKey; label: string; items: T[] }[] {
  const buckets: Record<TagGroupKey, T[]> = { systems: [], topics: [] };
  for (const item of items) buckets[groupForTag(item.tag)].push(item);
  return TAG_GROUP_ORDER
    .map((key) => ({ key, label: TAG_GROUP_LABELS[key], items: buckets[key] }))
    .filter((g) => g.items.length > 0);
}
