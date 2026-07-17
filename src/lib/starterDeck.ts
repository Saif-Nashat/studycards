// The 12-card starter pack every account begins with.
//
// NOTE: scripts/seed.mjs keeps its own copy of these cards (it's a build-time
// script that can't import this TypeScript module). If you change the starter
// content, update both. This module is the RUNTIME path — used by the trial
// self-reset to rebuild a clean account.
import { prisma } from "@/lib/prisma";

export const STARTER_DECK_NAME = "MRCOG — Starter pack";
const STARTER_DESCRIPTION = "A few high-yield cards to get you started. Verify facts as you study.";

interface StarterCard {
  type: "basic" | "cloze" | "list";
  front: string;
  back: string | string[]; // arrays are for "list" cards; stored as JSON
  extra?: string;
  mnemonic?: string;
  source?: string;
}

const STARTER_CARDS: StarterCard[] = [
  { type: "basic", front: "What is the most common cause of primary postpartum haemorrhage?", back: "Uterine atony (around 70% of cases).", extra: "Remember the 4 Ts: Tone, Trauma, Tissue, Thrombin.", source: "Starter pack" },
  { type: "basic", front: "A 30-year-old at 38 weeks has heavy bleeding after a prolonged labour; the uterus feels soft and 'boggy'. Most likely cause?", back: "Uterine atony — first step is uterine massage + oxytocin.", source: "Starter pack" },
  { type: "cloze", front: "The first-line uterotonic drug for postpartum haemorrhage is {{c1::oxytocin}}.", back: "", source: "Starter pack" },
  { type: "cloze", front: "The corpus luteum mainly secretes {{c1::progesterone}}, maintaining the early pregnancy until the {{c2::placenta}} takes over.", back: "", source: "Starter pack" },
  { type: "list", front: "Causes of polyhydramnios", back: ["Maternal diabetes mellitus", "Fetal anomalies (e.g. oesophageal atresia, anencephaly)", "Multiple pregnancy", "Fetal anaemia / hydrops", "Idiopathic (most common)"], source: "Starter pack" },
  { type: "list", front: "Risk factors for pre-eclampsia", back: ["First pregnancy", "Previous pre-eclampsia", "Chronic hypertension", "Diabetes", "Obesity (BMI ≥ 35)", "Maternal age ≥ 40", "Multiple pregnancy", "Family history"], source: "Starter pack" },
  { type: "basic", front: "Which artery is the main blood supply to the uterus?", back: "The uterine artery, a branch of the internal iliac (anterior division).", source: "Starter pack" },
  { type: "basic", front: "What does a 'category 1' caesarean section mean and what is the target decision-to-delivery interval?", back: "Immediate threat to life of mother or fetus; target decision-to-delivery within 30 minutes.", source: "Starter pack" },
  { type: "cloze", front: "Magnesium sulfate is used in severe pre-eclampsia to prevent {{c1::eclamptic seizures}}, and its toxicity is reversed with {{c2::calcium gluconate}}.", back: "", source: "Starter pack" },
  { type: "basic", front: "What is the definition of pre-eclampsia?", back: "New-onset hypertension (≥140/90) after 20 weeks PLUS proteinuria or other end-organ dysfunction.", source: "Starter pack" },
  { type: "list", front: "Maternal shoulder dystocia manoeuvres (in order)", back: ["Call for help", "McRoberts' manoeuvre (hyperflex hips)", "Suprapubic pressure", "Evaluate for episiotomy", "Enter manoeuvres (internal rotation, e.g. Rubin/Woods)", "Remove posterior arm", "Roll onto all fours"], source: "Starter pack" },
  { type: "basic", front: "By how many days does the corpus luteum regress if implantation does not occur?", back: "About 10–14 days, leading to a fall in progesterone and menstruation.", source: "Starter pack" },
];

// Create the starter deck + its cards for a user. No-op if they already have a
// deck with that name, so it's safe to call more than once.
export async function ensureStarterDeck(userId: string) {
  const existing = await prisma.deck.findUnique({ where: { userId_name: { userId, name: STARTER_DECK_NAME } } });
  if (existing) return existing;
  const deck = await prisma.deck.create({
    data: { name: STARTER_DECK_NAME, userId, description: STARTER_DESCRIPTION },
  });
  await prisma.card.createMany({
    data: STARTER_CARDS.map((c) => ({
      type: c.type,
      front: c.front,
      back: Array.isArray(c.back) ? JSON.stringify(c.back) : c.back,
      extra: c.extra ?? "",
      mnemonic: c.mnemonic ?? "",
      source: c.source ?? "",
      deckId: deck.id,
      userId,
    })),
  });
  return { deck, cardCount: STARTER_CARDS.length };
}
