// Proves the claude.ai prompt's output contract stays importable — including
// the common mistake of pasting the markdown code fences along with the JSON.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseImport } from "../src/lib/importParser.ts";

const SAMPLE = {
  deck: "CS101 — Sorting algorithms",
  cards: [
    { type: "basic", front: "What is quicksort's average time complexity?", back: "O(n log n)", extra: "Each partition splits the array roughly in half, log n times.", tags: "algorithms,complexity", source: "slide 12" },
    { type: "cloze", front: "Merge sort always runs in {{c1::O(n log n)}} time.", extra: "It always splits and merges regardless of input order.", tags: "algorithms", source: "slide 14" },
    { type: "list", front: "Steps of insertion sort", back: ["Take next element", "Shift larger sorted elements right", "Insert into gap"], extra: "Builds the sorted prefix one element at a time.", mnemonic: "take-shift-insert", tags: "algorithms", source: "slide 15" },
  ],
};

test("parses the prompt's JSON output shape", () => {
  const res = parseImport(JSON.stringify(SAMPLE, null, 2));
  assert.equal(res.deckName, "CS101 — Sorting algorithms");
  assert.equal(res.cards.length, 3);
  assert.equal(res.cards[0].type, "basic");
  assert.equal(res.cards[1].type, "cloze");
  assert.equal(res.cards[2].type, "list");
  // list backs become a JSON array string the app renders as bullets
  assert.deepEqual(JSON.parse(res.cards[2].back), ["Take next element", "Shift larger sorted elements right", "Insert into gap"]);
  assert.ok(res.cards[0].extra.length > 0);
  assert.equal(res.cards[2].mnemonic, "take-shift-insert");
});

test("tolerates pasted markdown code fences around the JSON", () => {
  const fenced = "```json\n" + JSON.stringify(SAMPLE) + "\n```";
  const res = parseImport(fenced);
  assert.equal(res.cards.length, 3);
  assert.equal(res.deckName, "CS101 — Sorting algorithms");
});

test("still parses plain CSV lines", () => {
  const res = parseImport("What is 2+2?,4,maths\nCapital of France?,Paris,geography");
  assert.equal(res.cards.length, 2);
  assert.equal(res.cards[1].back, "Paris");
  assert.equal(res.cards[1].tags, "geography");
});

test("skips a CSV header row instead of importing it as a card", () => {
  const res = parseImport("front,back\nWhat is QA?,Quality assurance\nCSV row two?,Yes");
  assert.equal(res.cards.length, 2);
  assert.equal(res.cards[0].front, "What is QA?");
});

test("skips a Question/Answer style header row too", () => {
  const res = parseImport("Question;Answer;Tags\nWhat is 2+2?;4;maths");
  assert.equal(res.cards.length, 1);
  assert.equal(res.cards[0].front, "What is 2+2?");
});

test("prose lines without an answer are not turned into cards", () => {
  const res = parseImport("This is just an essay paragraph.\nAnother line of plain prose without separators.");
  assert.equal(res.cards.length, 0);
});

test("CSV cloze lines keep working even with no answer column", () => {
  const res = parseImport("The heart has {{c1::four}} chambers.\nWhat is 2+2?,4");
  assert.equal(res.cards.length, 2);
  assert.equal(res.cards[0].type, "cloze");
  assert.equal(res.cards[1].back, "4");
});
