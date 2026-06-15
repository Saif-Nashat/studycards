// The copy-paste prompt the user gives to claude.ai to generate import-ready cards.
export const CLAUDE_PROMPT = `You are helping me make spaced-repetition flashcards for the MRCOG Part 1 exam (and/or USMLE Step 1/2). I will paste text from a textbook or revision notes below.

Create high-yield flashcards from that text. Follow these rules exactly:

1. OUTPUT FORMAT: Reply with ONLY a JSON code block, nothing else. Use this exact shape:
{
  "deck": "MRCOG - <topic>",
  "cards": [
    { "type": "basic", "front": "Question?", "back": "Answer", "extra": "1-2 sentence explanation of WHY this is the answer", "mnemonic": "optional memory aid", "tags": "topic,subtopic", "source": "MRCOG p.X" },
    { "type": "cloze", "front": "The corpus luteum secretes {{c1::progesterone}}.", "extra": "Why it matters in early pregnancy.", "tags": "endocrine", "source": "MRCOG p.X" },
    { "type": "list", "front": "Causes of polyhydramnios", "back": ["Maternal diabetes", "Fetal anomaly", "Twin pregnancy"], "extra": "Brief explanation.", "mnemonic": "optional", "tags": "obstetrics", "source": "MRCOG p.X" }
  ]
}

2. CARD TYPES — use a MIX:
   - "basic": a clear question and answer.
   - "cloze": hide the key fact with {{c1::...}} (you may use c1, c2, etc. for multiple blanks).
   - "list": for "causes of", "features of", "complications of" — put items in the "back" array.

3. ALWAYS INCLUDE AN EXPLANATION: every card must have an "extra" field with a concise 1-2 sentence explanation of WHY the answer is correct (the reasoning, mechanism, or rule), not just a restatement.

4. ADD A MNEMONIC WHEN SUITABLE: if there's a well-known or genuinely helpful memory aid (e.g. for a list or a tricky fact), add a "mnemonic" field. If no good mnemonic exists, leave it out — don't force one.

5. ADD CLINICAL CARDS, not just facts. For roughly 1 in 4 cards, write a short clinical-vignette question, e.g.:
   { "type": "basic", "front": "A 32-year-old at 34 weeks has a BP of 160/110 and proteinuria. What is the most appropriate next step?", "back": "...", "extra": "...", "tags": "obstetrics,clinical", "source": "MRCOG p.X" }

6. QUALITY: keep cards atomic (one idea each), concise, and exam-relevant. Avoid trivia. If a number/dose is given, double-check it.

7. TAGS: add 1-3 lowercase tags. SOURCE: if I tell you the page number, use it; otherwise put the chapter/topic name.

Here is the text:

<<< PASTE YOUR BOOK TEXT HERE >>>`;
