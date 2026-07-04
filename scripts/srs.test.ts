// Locks in the core scheduling guarantees: a card rated Easy must always come
// back LATER than the same card rated Good, which must come back later than
// Hard, which must come back later than Again — in every state.
import { test } from "node:test";
import assert from "node:assert/strict";
import { schedule, type SrsState, type Rating } from "../src/lib/srs.ts";

const NOW = new Date("2026-07-04T12:00:00Z");
const RATINGS: Rating[] = ["again", "hard", "good", "easy"];

function dueMs(card: SrsState, rating: Rating): number {
  return schedule(card, rating, NOW).due.getTime();
}

const NEW_CARD: SrsState = { state: "new", intervalDays: 0, ease: 2.5, reps: 0, lapses: 0 };
const LEARNING: SrsState = { state: "learning", intervalDays: 0, ease: 2.5, reps: 0, lapses: 1 };
const YOUNG_REVIEW: SrsState = { state: "review", intervalDays: 1, ease: 2.5, reps: 1, lapses: 0 };
const MATURE_REVIEW: SrsState = { state: "review", intervalDays: 30, ease: 2.3, reps: 8, lapses: 1 };
const LOW_EASE_REVIEW: SrsState = { state: "review", intervalDays: 10, ease: 1.3, reps: 5, lapses: 3 };

for (const [name, card] of Object.entries({ NEW_CARD, LEARNING, YOUNG_REVIEW, MATURE_REVIEW, LOW_EASE_REVIEW })) {
  test(`rating order gives strictly increasing next-review times (${name})`, () => {
    const times = RATINGS.map((r) => dueMs(card, r));
    for (let i = 1; i < times.length; i++) {
      assert.ok(
        times[i] > times[i - 1],
        `${RATINGS[i]} (${times[i]}) should be due later than ${RATINGS[i - 1]} (${times[i - 1]})`
      );
    }
  });
}

test("easy graduates a new card with a longer first interval than good", () => {
  const good = schedule(NEW_CARD, "good", NOW);
  const easy = schedule(NEW_CARD, "easy", NOW);
  assert.equal(good.intervalDays, 1);
  assert.equal(easy.intervalDays, 4);
  assert.equal(good.state, "review");
  assert.equal(easy.state, "review");
});

test("review intervals scale correctly: hard ×1.2, good ×ease, easy ×ease×1.3", () => {
  const card = { ...MATURE_REVIEW }; // 30 days, ease 2.3
  assert.equal(schedule(card, "hard", NOW).intervalDays, Math.round(30 * 1.2)); // 36
  assert.equal(schedule(card, "good", NOW).intervalDays, Math.round(30 * 2.3)); // 69
  assert.equal(schedule(card, "easy", NOW).intervalDays, Math.round(30 * 2.3 * 1.3)); // 90
});

test("easy raises ease, hard lowers it, and ease never drops below 1.3", () => {
  assert.ok(schedule(MATURE_REVIEW, "easy", NOW).ease > MATURE_REVIEW.ease);
  assert.ok(schedule(MATURE_REVIEW, "hard", NOW).ease < MATURE_REVIEW.ease);
  assert.equal(schedule(LOW_EASE_REVIEW, "hard", NOW).ease, 1.3);
  assert.equal(schedule(LOW_EASE_REVIEW, "again", NOW).ease, 1.3);
});

test("again on a review card is a lapse: back to learning, due in ~1 minute", () => {
  const res = schedule(MATURE_REVIEW, "again", NOW);
  assert.equal(res.state, "learning");
  assert.equal(res.lapses, MATURE_REVIEW.lapses + 1);
  assert.ok(res.due.getTime() - NOW.getTime() <= 2 * 60_000);
});

test("hard while learning is slower than again but does not count a lapse", () => {
  const again = schedule(LEARNING, "again", NOW);
  const hard = schedule(LEARNING, "hard", NOW);
  assert.ok(hard.due.getTime() > again.due.getTime());
  assert.equal(again.lapses, LEARNING.lapses + 1);
  assert.equal(hard.lapses, LEARNING.lapses);
});
