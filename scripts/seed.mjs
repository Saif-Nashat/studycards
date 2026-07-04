// Seeds a small starter deck so accounts have content on first login.
// Safe to re-run: each user only gets the starter deck if they don't already
// have a deck with that name. (Run scripts/setup-users.mjs first to create
// the accounts themselves.)
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
  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  if (users.length === 0) {
    console.log("No users yet — run scripts/setup-users.mjs first.");
    return;
  }
  for (const user of users) {
    const existing = await prisma.deck.findUnique({ where: { userId_name: { userId: user.id, name: DECK } } });
    if (existing) {
      console.log(`${user.username}: starter deck already exists — skipping.`);
      continue;
    }
    const deck = await prisma.deck.create({
      data: { name: DECK, userId: user.id, description: "A few high-yield cards to get you started. Verify facts as you study." },
    });
    await prisma.card.createMany({
      data: cards.map((c) => ({ ...c, back: c.type === "list" ? JSON.stringify(c.back) : c.back, deckId: deck.id, userId: user.id })),
    });
    console.log(`${user.username}: seeded "${DECK}" with ${cards.length} cards.`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
