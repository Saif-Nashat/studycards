// Seeds a small starter deck so the app has content on first run.
// Safe to re-run: it only adds the starter deck if it doesn't already exist.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const DECK = "MRCOG — Starter pack";

const cards = [
  { type: "basic", front: "What is the most common cause of primary postpartum haemorrhage?", back: "Uterine atony (around 70% of cases).", extra: "Remember the 4 Ts: Tone, Trauma, Tissue, Thrombin.", tags: "obstetrics,pph", source: "Starter pack" },
  { type: "basic", front: "A 30-year-old at 38 weeks has heavy bleeding after a prolonged labour; the uterus feels soft and 'boggy'. Most likely cause?", back: "Uterine atony — first step is uterine massage + oxytocin.", tags: "obstetrics,clinical,pph", source: "Starter pack" },
  { type: "cloze", front: "The first-line uterotonic drug for postpartum haemorrhage is {{c1::oxytocin}}.", back: "", tags: "pharmacology,obstetrics", source: "Starter pack" },
  { type: "cloze", front: "The corpus luteum mainly secretes {{c1::progesterone}}, maintaining the early pregnancy until the {{c2::placenta}} takes over.", back: "", tags: "endocrine,physiology", source: "Starter pack" },
  { type: "list", front: "Causes of polyhydramnios", back: ["Maternal diabetes mellitus", "Fetal anomalies (e.g. oesophageal atresia, anencephaly)", "Multiple pregnancy", "Fetal anaemia / hydrops", "Idiopathic (most common)"], tags: "obstetrics", source: "Starter pack" },
  { type: "list", front: "Risk factors for pre-eclampsia", back: ["First pregnancy", "Previous pre-eclampsia", "Chronic hypertension", "Diabetes", "Obesity (BMI ≥ 35)", "Maternal age ≥ 40", "Multiple pregnancy", "Family history"], tags: "obstetrics,pre-eclampsia", source: "Starter pack" },
  { type: "basic", front: "Which artery is the main blood supply to the uterus?", back: "The uterine artery, a branch of the internal iliac (anterior division).", tags: "anatomy", source: "Starter pack" },
  { type: "basic", front: "What does a 'category 1' caesarean section mean and what is the target decision-to-delivery interval?", back: "Immediate threat to life of mother or fetus; target decision-to-delivery within 30 minutes.", tags: "obstetrics,clinical", source: "Starter pack" },
  { type: "cloze", front: "Magnesium sulfate is used in severe pre-eclampsia to prevent {{c1::eclamptic seizures}}, and its toxicity is reversed with {{c2::calcium gluconate}}.", back: "", tags: "pharmacology,pre-eclampsia", source: "Starter pack" },
  { type: "basic", front: "What is the definition of pre-eclampsia?", back: "New-onset hypertension (≥140/90) after 20 weeks PLUS proteinuria or other end-organ dysfunction.", tags: "obstetrics,pre-eclampsia", source: "Starter pack" },
  { type: "list", front: "Maternal shoulder dystocia manoeuvres (in order)", back: ["Call for help", "McRoberts' manoeuvre (hyperflex hips)", "Suprapubic pressure", "Evaluate for episiotomy", "Enter manoeuvres (internal rotation, e.g. Rubin/Woods)", "Remove posterior arm", "Roll onto all fours"], tags: "obstetrics,emergency", source: "Starter pack" },
  { type: "basic", front: "By how many days does the corpus luteum regress if implantation does not occur?", back: "About 10–14 days, leading to a fall in progesterone and menstruation.", tags: "physiology", source: "Starter pack" },
];

async function main() {
  const existing = await prisma.deck.findUnique({ where: { name: DECK } });
  if (existing) {
    console.log("Starter deck already exists — skipping.");
    return;
  }
  const deck = await prisma.deck.create({ data: { name: DECK, description: "A few high-yield cards to get you started. Verify facts as you study." } });
  await prisma.card.createMany({ data: cards.map((c) => ({ ...c, back: c.type === "list" ? JSON.stringify(c.back) : c.back, deckId: deck.id })) });
  console.log(`Seeded "${DECK}" with ${cards.length} cards.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
