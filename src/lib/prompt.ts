// The copy-paste prompt the user gives to claude.ai to generate
// import-ready cards. Copied from the Import page.
// Deliberately subject-agnostic: the app started with MRCOG/USMLE but people now
// study university slides, notes, books, languages, law, code — anything.
export const CLAUDE_PROMPT = `You are an expert flashcard author. I will paste study material below — it could be anything: textbook pages, university lecture slides, my own notes, an article, exam revision notes, language vocabulary, legal cases, code documentation, formulas… any subject, any format.

Turn that material into excellent spaced-repetition flashcards. Follow these rules exactly:

1. OUTPUT FORMAT: Reply with ONLY a JSON code block, nothing else before or after. Use this exact shape:
{
  "deck": "<Subject> — <topic>",
  "cards": [
    { "type": "basic", "front": "A clear question?", "back": "The answer", "extra": "1-2 sentences explaining WHY / the underlying reasoning", "mnemonic": "optional memory aid", "tags": "topic,subtopic", "source": "slide 12 / p.34 / chapter name" },
    { "type": "cloze", "front": "The powerhouse of the cell is the {{c1::mitochondrion}}.", "extra": "Why this matters.", "tags": "biology", "source": "p.X" },
    { "type": "list", "front": "Causes / features / steps of …", "back": ["First item", "Second item", "Third item"], "extra": "Brief explanation.", "mnemonic": "optional", "tags": "topic", "source": "p.X" }
  ]
}
The JSON must be valid: double quotes, no trailing commas, no comments.

2. CARD TYPES — use a MIX, whatever fits each fact best:
   - "basic": a clear question with a short answer.
   - "cloze": hide the key fact(s) with {{c1::...}} (use c1, c2… for multiple blanks in one sentence).
   - "list": for enumerations — causes, features, steps, advantages, components — items go in the "back" array.

3. ALWAYS EXPLAIN: every card gets an "extra" field with a concise 1-2 sentence explanation of WHY the answer is correct (mechanism, reasoning, rule, or context) — not just a restatement of the answer.

4. MNEMONIC WHEN GENUINELY USEFUL: add a "mnemonic" field only when a well-known or truly helpful memory aid exists (great for lists and tricky facts). Never force one.

5. APPLIED QUESTIONS, not just recall. For roughly 1 in 4 cards, write an applied question in the style that fits the material:
   - medicine/nursing → a short clinical vignette ("A 32-year-old presents with… what is the next step?")
   - maths/physics/engineering → a small worked problem using the concept
   - programming → "what does this code print / what's wrong with this code?"
   - law/business/ethics → a mini case scenario asking for the applicable rule
   - languages → usage in a sentence, or translation in context
   - history/social sciences → cause-effect or compare-contrast questions
   If the material doesn't suit applied questions, plain recall cards are fine.

6. QUALITY RULES:
   - Atomic: exactly ONE idea per card. Split dense facts into several cards.
   - Cover ALL the key testable facts in the material — don't stop early; make as many cards as the content deserves.
   - Stay faithful to the pasted material; don't invent facts that aren't there (general background in "extra" is fine).
   - Ignore boilerplate: slide headers/footers, page numbers, course codes, OCR junk.
   - Write cards in the same language as the material (unless I ask otherwise).
   - Double-check any numbers, doses, dates or formulas you carry over.

7. NAMING & METADATA:
   - "deck": infer a sensible name from the material, e.g. "Pharmacology — Beta blockers", "Spanish — Food vocabulary", "CS101 — Sorting algorithms".
   - "tags": 1-3 short lowercase tags per card.
   - "source": slide number, page number or section name when identifiable; otherwise the topic name.

Here is the material:

<<< PASTE YOUR STUDY MATERIAL HERE — slides, notes, book text, anything >>>`;
