// Tag grouping — the single source of truth for turning messy, granular tags
// into a small set of broad study subjects.
//
// Cards arrive with wildly inconsistent tags: some already-grouped (e.g.
// "Reproductive Pathology"), many raw and hyper-specific ("ctg", "medical-physics",
// "anti-inflammatory", "t-cells"). Studying is easier with a handful of big
// buckets, so every tag — old or newly imported — is mapped onto one of these six.
//
// Used by:
//   - the .apkg importer (so new imports are grouped on the way in), and
//   - scripts/regroup-tags.ts (a one-time re-tag of the existing collection).

export const TAG_BUCKETS = [
  "Obstetrics",
  "Gynecology",
  "Reproductive Science",
  "Pathology & Oncology",
  "Pharmacology & Microbiology",
  "General Medicine & Research",
] as const;

export type TagBucket = (typeof TAG_BUCKETS)[number];

// Whole Anki tags that are pure organisational machinery (AnKing housekeeping,
// deck-version markers, etc.) — ignored entirely before we even look at segments.
export const TAG_SKIP =
  /no[_\s-]?dupes|flag[_\s-]?these|update[_\s-]?tags|image[_\s-]?ready|imageready|cards[_\s-]?anking|potential[_\s-]?dup|ome[_\s-]?banner|physeo|sketchy|amboss|free120|uwsa|highyield|loweryield/i;

// Normalised tags that carry no subject meaning — dropped so they don't pollute
// a card's buckets (e.g. every card is "clinical"; that tells us nothing).
const DROP = new Set([
  "clinical",
  "general",
  "general principles",
  "misc",
  "other",
  "done",
  "shelf",
  "systems",
  "subjects",
  "temporary",
  "pathology temporary",
]);

// Ordered, first-match-wins. A normalised tag is tested top-to-bottom and takes
// the label of the first pattern it matches. Order encodes precedence:
// e.g. "Reproductive Pathology" should land in Pathology, not Reproductive, so
// the Pathology rule sits above the Reproductive one.
const RULES: [RegExp, TagBucket][] = [
  // Obstetrics — pregnancy, labour, the fetus, obstetric drugs.
  [
    /obstetr|intrapartum|antepartum|postpartum|puerper|pregnan|prenatal|gestation|\blabou?r\b|delivery|placenta|amnio|\bfetal|\bfoetal|\bfetus|\bctg\b|cardiotocograph|tocolytic|uterotonic|prostaglandin|preeclamp|eclampsia|shoulder dystocia|polyhydramnios|oligohydramnios/,
    "Obstetrics",
  ],
  // Gynecology — the female tract and its non-pregnant disorders.
  [
    /gynae|gynec|contracept|menstr|menopaus|amenorr|menarche|\bpms\b|pcos|endometrios|\bendometri|uterus|uterine|myometri|fibroid|leiomyoma|ovary|ovarian|adnex|cervix|cervical|vulva|vagina|breast|infertil|fertility|sex hormone|puberty|menorrh|pelvic|pelvis/,
    "Gynecology",
  ],
  // Pharmacology & Microbiology — drugs, bugs, and immunology.
  [
    /pharmacolog|\bdrug|analgesic|antibiotic|antivir|antifung|antimalar|anticoagul|antiepilep|antihypertens|anti.?inflamm|anticonvuls|microbiolog|\bmicro\b|bacteri|\bvirus|virolog|\bviral|protozoa|\bfungal|infection|infectious|immunolog|\bimmune|complement|cytokine|\bt cell|antibod|vaccine|hypersensitiv|toleran|transplant|cellular mediator/,
    "Pharmacology & Microbiology",
  ],
  // Pathology & Oncology — disease processes and cancer.
  [
    /patholog|pathophysiolog|oncolog|cancer|carcinoma|neoplas|tumou?r|malignan|metasta|\binflammat|cell injury|wound heal|radiotherap|dysplasia|hyperplasia|\bleech/,
    "Pathology & Oncology",
  ],
  // Reproductive Science — the basic-science foundation: physiology, anatomy,
  // embryology, endocrinology, genetics and biochemistry.
  [
    /reproduc|\brepro\b|embryo|anatom|physiolog|endocrin|hormone|pituitary|hypothalam|thyroid|adrenal|calcium|genetic|chromosom|inherit|molecular|biochem|carbohydrate|protein|\bfat\b|\blipid|acid base|cell |gamet|meiosis|mitosis|histolog|starvation/,
    "Reproductive Science",
  ],
];

// Reduce a raw tag to lowercase words we can match on: strip marker chars,
// numeric priority prefixes, and turn separators into spaces.
function normalize(seg: string): string {
  return seg
    .replace(/^[#!^*+~]+/, "") // leading marker chars (#, !, ^, …)
    .replace(/^\d+\s*[-_.]\s*/, "") // numeric priority prefixes ("13_", "1-")
    .replace(/[_/]+/g, " ")
    .replace(/-/g, " ")
    .replace(/[():.,!*#^+&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Classify one already-normalised tag into a bucket, or null if it's noise.
function classifyNormalized(n: string): TagBucket | null {
  if (!n || n.length < 3 || DROP.has(n)) return null;
  for (const [re, label] of RULES) if (re.test(n)) return label;
  return "General Medicine & Research"; // sensible catch-all
}

// Dedupe a list of buckets, returning them in canonical TAG_BUCKETS order so a
// card's tags always read the same way.
function order(found: Set<TagBucket>): TagBucket[] {
  return TAG_BUCKETS.filter((b) => found.has(b));
}

// Map an existing comma-separated tag string onto broad buckets.
export function bucketsFromCommaTags(raw: string): TagBucket[] {
  const found = new Set<TagBucket>();
  for (const part of raw.split(",")) {
    const bucket = classifyNormalized(normalize(part));
    if (bucket) found.add(bucket);
  }
  return order(found);
}

// Map a raw Anki note tag string (whitespace-separated, "::"-nested) onto buckets.
export function bucketsFromAnkiTags(raw: string): TagBucket[] {
  const found = new Set<TagBucket>();
  for (const tag of raw.split(/\s+/).filter(Boolean)) {
    if (TAG_SKIP.test(tag)) continue;
    for (const seg of tag.split("::")) {
      const bucket = classifyNormalized(normalize(seg));
      if (bucket) found.add(bucket);
    }
  }
  return order(found);
}
