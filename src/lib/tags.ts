// Tag grouping — the single source of truth for turning messy, granular tags
// into a small set of broad study subjects, organised by BODY SYSTEM.
//
// Cards arrive with wildly inconsistent tags. AnKing notes in particular carry
// deep, resource-nested tags like
//   #AK_Step1_v12::#B&B::05_Cardiovascular::Heart_Failure
// where only the *chapter* segments ("05_Cardiovascular", "Heart_Failure")
// carry subject meaning — the rest is scaffolding (deck version, which video
// resource, housekeeping). Studying is easier with a handful of organ-system
// buckets, so every tag — old or newly imported — is mapped onto one of these.
//
// Systems, not topics: disciplines like pharmacology / microbiology / pathology
// are deliberately NOT their own buckets. A drug or disease is filed under the
// organ system it belongs to (an antihypertensive → Cardiovascular), and only
// genuinely cross-cutting / foundational material (biochem, genetics, general
// principles) lands in "General & Multisystem".
//
// Used by the .apkg importer (src/app/api/import/apkg/route.ts) so imports are
// grouped on the way in. To re-tag an existing deck, delete and re-import it.

export const TAG_BUCKETS = [
  "Obstetrics",
  "Gynecology",
  "Reproductive",
  "Endocrine",
  "Cardiovascular",
  "Respiratory",
  "Gastrointestinal",
  "Renal & Urinary",
  "Nervous System & Psychiatry",
  "Musculoskeletal & Skin",
  "Hematology & Immune",
  "General & Multisystem",
] as const;

export type TagBucket = (typeof TAG_BUCKETS)[number];

// Tag SEGMENTS (a single "::"-delimited piece, already normalised) that are pure
// scaffolding: deck-version markers, study-resource names, and Anki housekeeping.
// Skipped so they neither create a bucket nor pollute one — this is what keeps
// every AnKing card from collapsing into the catch-all via its "#AK_Step1_v12"
// prefix. Tested per segment (NOT per whole tag) so sibling system segments
// under the same nested tag still classify.
const SEG_SKIP =
  /^ak | ?ak step|step ?[12]|^v\d+$| v\d+$|^b b$|boards and beyond|physeo|sketchy|pixorize|pathoma|first ?aid|costanzo|dirty ?medicine|mehlman|lolnotacop|randy neil|^pepper$|^ome$|amboss|uworld|uwsa|free ?120|\bnbme\b|high ?yield|low(er)? ?yield|anking|overhaul|update tags|no dupes|flag these|image ?ready|potential dup|duplicate|\bdupe\b|leech|^hidden$|^missed$|obsolete|needs? deck|extra tags?|^tags?$|^study$|^cards?$/;

// Kept for backwards compatibility with any external importer that filtered
// whole Anki tags. Segment-level SEG_SKIP is the primary filter now.
export const TAG_SKIP = SEG_SKIP;

// Normalised segments that carry no subject meaning — dropped so they don't
// pollute a card's buckets (e.g. every card is "clinical"; that tells us nothing).
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

// Ordered, first-match-wins. A normalised segment is tested top-to-bottom and
// takes the label of the first pattern it matches. Order encodes precedence:
// the app's Obstetrics/Gynecology core sits above the generic Reproductive and
// Endocrine rules so pregnancy/female-tract terms win over "sex hormone".
const RULES: [RegExp, TagBucket][] = [
  // Obstetrics — pregnancy, labour, the fetus, obstetric drugs & emergencies.
  [
    /obstetr|intrapartum|antepartum|postpartum|\bpph\b|puerper|pregnan|prenatal|gestation|\blabou?r\b|delivery|placenta|amnio|\bfetal|\bfoetal|\bfetus|\bctg\b|cardiotocograph|tocolytic|uterotonic|preeclamp|eclampsia|shoulder dystocia|polyhydramnios|oligohydramnios|miscarriage|ectopic|\btrimester|neonat/,
    "Obstetrics",
  ],
  // Gynecology — the female tract and its non-pregnant disorders.
  [
    /gynae|gynec|contracept|menstr|menopaus|amenorr|menarche|\bpms\b|pcos|endometrios|\bendometri|uterus|uterine|myometri|fibroid|leiomyoma|ovary|ovarian|adnex|cervix|cervical|vulva|vagina|infertil|fertility|menorrh|\bpelvic|\bpelvis/,
    "Gynecology",
  ],
  // Reproductive — repro basic science, breast, and the male reproductive tract.
  [
    /reproduc|\brepro\b|\bbreast|mammary|testis|testicul|\btestes|prostate|\bpenis|scrotum|spermato|\bsperm\b|semen|\bgamet|gonad|sex hormone|estrogen|oestrogen|progesteron|androgen|testosteron/,
    "Reproductive",
  ],
  // Endocrine — glands, hormones, and metabolic regulation.
  [
    /endocrin|\bhormone|pituitary|hypothalam|thyroid|parathyroid|adrenal|cortisol|aldosteron|\binsulin|diabet|\bglucose|glycem|glycaem|pancreat|\bpth\b|acromegal|cushing|addison|goitre|goiter|calcium homeostas/,
    "Endocrine",
  ],
  // Cardiovascular — heart and vessels.
  [
    /cardio|cardiac|\bheart|myocard|pericard|endocard|\bvascular|\bvessel|\baorta|aortic|\bvein\b|venous|\barter|atrium|atrial|ventric|\bvalve|valvular|coronary|ischaem|ischem|infarct|angina|hypertens|blood pressure|arrhythm|tachycard|bradycard|\becg\b|\bekg\b|atheroscler|\bshock\b|heart failure/,
    "Cardiovascular",
  ],
  // Respiratory — airways and lungs.
  [
    /respir|pulmon|\blung|\bairway|bronch|alveol|\bpleura|trachea|\bcopd\b|asthma|pneumon|pneumothor|ventilat|\bhypox|oxygen|spirometr|\btidal|\bnasal|\bsinus|\blarynx|\bpharynx/,
    "Respiratory",
  ],
  // Gastrointestinal — gut, liver, and the biliary/pancreatic tree.
  [
    /gastro|\bgi\b|intestin|\bbowel|\bcolon|colonic|rectum|rectal|\banus|\banal\b|stomach|gastric|duoden|jejun|\bileum|esophag|oesophag|\bliver|hepat|biliary|gallbladder|\bbile|pancreatit|\bspleen|colitis|crohn|\bulcer|diarrh|constipat|\bibd\b|\bibs\b|digest|peritone/,
    "Gastrointestinal",
  ],
  // Renal & Urinary — kidneys, the collecting system, fluids & electrolytes.
  [
    /renal|kidney|nephro|\bureter|\bbladder|urethr|urinary|\burine\b|glomerul|\bgfr\b|dialys|nephrotic|nephritic|creatinin|electrolyt|\bsodium|\bpotassium|acid.?base|diures/,
    "Renal & Urinary",
  ],
  // Nervous System & Psychiatry — CNS/PNS, and behavioural/psychiatric disease.
  [
    /neuro|\bbrain|cerebr|cerebell|\bspinal|\bcord\b|\bnerve|nervous|\bcns\b|\bpns\b|\baxon|synap|neurotransmit|dopamin|serotonin|seizure|epilep|\bstroke|\bcva\b|parkinson|alzheimer|dementia|meningi|encephal|myelin|multiple sclerosis|migraine|\bpsych|depress|anxiety|schizophren|bipolar|behavio|addiction|\bmood/,
    "Nervous System & Psychiatry",
  ],
  // Musculoskeletal & Skin — bones, joints, muscle, connective tissue, skin.
  [
    /musculoskelet|\bmsk\b|\bmuscle|muscular|\bbone|skelet|\bjoint|articular|cartilage|\btendon|ligament|\bortho|fracture|arthr|rheumat|\bgout|osteo|\bspine|vertebr|dermat|\bskin\b|cutane|epiderm|melanom|\brash|integument/,
    "Musculoskeletal & Skin",
  ],
  // Hematology & Immune — blood, lymphoreticular system, and immunology.
  [
    /hemat|haemat|\bheme\b|\bblood\b|anemia|anaemia|\brbc\b|\bwbc\b|platelet|thrombocyt|coagul|\bclott|\bclot\b|hemostas|haemostas|leukem|leukaem|lymphom|\blymph|\bmarrow|hemoglob|haemoglob|sickle|thalass|immun|antibod|antigen|\bt cell|\bb cell|complement|cytokine|vaccine|hypersensitiv|autoimmun|\bhla\b|inflammat/,
    "Hematology & Immune",
  ],
];

// Reduce a raw tag segment to lowercase words we can match on: strip marker
// chars, numeric chapter/priority prefixes, and turn separators into spaces.
function normalize(seg: string): string {
  return seg
    .replace(/^[#!^*+~]+/, "") // leading marker chars (#, !, ^, …)
    .replace(/^\d+\s*[-_.]\s*/, "") // numeric prefixes ("05_", "13_", "1-")
    .replace(/[_/]+/g, " ")
    .replace(/-/g, " ")
    .replace(/[():.,!*#^+&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Classify one already-normalised segment into a bucket, or null if it's noise.
function classifyNormalized(n: string): TagBucket | null {
  if (!n || n.length < 3 || DROP.has(n)) return null;
  for (const [re, label] of RULES) if (re.test(n)) return label;
  return "General & Multisystem"; // foundational / cross-cutting catch-all
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
    const n = normalize(part);
    if (!n || SEG_SKIP.test(n)) continue;
    const bucket = classifyNormalized(n);
    if (bucket) found.add(bucket);
  }
  return order(found);
}

// Map a raw Anki note tag string (whitespace-separated, "::"-nested) onto
// buckets. Every "::" segment is classified independently and scaffolding
// segments are skipped, so a deeply nested resource tag still yields its system.
export function bucketsFromAnkiTags(raw: string): TagBucket[] {
  const found = new Set<TagBucket>();
  for (const tag of raw.split(/\s+/).filter(Boolean)) {
    for (const seg of tag.split("::")) {
      const n = normalize(seg);
      if (!n || SEG_SKIP.test(n)) continue;
      const bucket = classifyNormalized(n);
      if (bucket) found.add(bucket);
    }
  }
  return order(found);
}
