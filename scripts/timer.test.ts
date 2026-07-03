// Unit tests for the pomodoro/timer state machine.
// Run with:  node --test scripts/timer.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  advancePomo,
  initialPomoState,
  formatClock,
  skipBreak,
  parseTimerMode,
  isPomodoro,
  pomoConfig,
  POMO_LIMITS,
} from "../src/lib/timer.ts";

const P25 = pomoConfig(25, 5); // { focus: 1500, break: 300 }

test("formatClock renders m:ss and h:mm:ss", () => {
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(5), "0:05");
  assert.equal(formatClock(65), "1:05");
  assert.equal(formatClock(25 * 60), "25:00");
  assert.equal(formatClock(3600), "1:00:00");
  assert.equal(formatClock(3600 + 61), "1:01:01");
  assert.equal(formatClock(-3), "0:00", "negative clamps to zero");
  assert.equal(formatClock(59.9), "0:59", "fractions floor");
});

test("parseTimerMode rejects unknown values", () => {
  assert.equal(parseTimerMode("normal"), "normal");
  assert.equal(parseTimerMode("pomodoro"), "pomodoro");
  assert.equal(parseTimerMode("pomo25"), "none", "old value no longer valid");
  assert.equal(parseTimerMode("evil"), "none");
  assert.equal(parseTimerMode(null), "none");
});

test("isPomodoro", () => {
  assert.equal(isPomodoro("pomodoro"), true);
  assert.equal(isPomodoro("normal"), false);
  assert.equal(isPomodoro("none"), false);
});

test("pomoConfig converts minutes to seconds", () => {
  assert.deepEqual(pomoConfig(25, 5), { focus: 1500, break: 300 });
  assert.deepEqual(pomoConfig(50, 10), { focus: 3000, break: 600 });
  assert.deepEqual(pomoConfig(1, 1), { focus: 60, break: 60 });
});

test("pomoConfig clamps out-of-range and junk input", () => {
  assert.deepEqual(pomoConfig(0, 0), { focus: POMO_LIMITS.focusMin * 60, break: POMO_LIMITS.breakMin * 60 });
  assert.deepEqual(pomoConfig(9999, 9999), { focus: POMO_LIMITS.focusMax * 60, break: POMO_LIMITS.breakMax * 60 });
  assert.deepEqual(pomoConfig(NaN, NaN), { focus: POMO_LIMITS.focusMin * 60, break: POMO_LIMITS.breakMin * 60 });
  assert.deepEqual(pomoConfig(25.6, 5.4), { focus: 26 * 60, break: 5 * 60 }, "rounds");
});

test("initial pomodoro state starts in focus with a full clock", () => {
  assert.deepEqual(initialPomoState(P25), { phase: "focus", phaseLeft: 25 * 60, focusSec: 0, cycles: 0 });
});

test("ticking accumulates focus time", () => {
  let s = initialPomoState(P25);
  s = advancePomo(s, 60, P25);
  assert.equal(s.phase, "focus");
  assert.equal(s.phaseLeft, 24 * 60);
  assert.equal(s.focusSec, 60);
  assert.equal(s.cycles, 0);
});

test("focus rolls over into a break, counting the cycle", () => {
  let s = initialPomoState(P25);
  s = advancePomo(s, 25 * 60, P25);
  assert.equal(s.phase, "break");
  assert.equal(s.phaseLeft, 5 * 60);
  assert.equal(s.focusSec, 25 * 60);
  assert.equal(s.cycles, 1);
});

test("break rolls back into focus, break time not counted as focus", () => {
  let s = initialPomoState(P25);
  s = advancePomo(s, 25 * 60 + 5 * 60, P25);
  assert.equal(s.phase, "focus");
  assert.equal(s.phaseLeft, 25 * 60);
  assert.equal(s.focusSec, 25 * 60);
  assert.equal(s.cycles, 1);
});

test("a huge dt (throttled background tab) spans multiple full cycles", () => {
  const dt = 2 * (25 * 60 + 5 * 60) + 10 * 60;
  const s = advancePomo(initialPomoState(P25), dt, P25);
  assert.equal(s.cycles, 2);
  assert.equal(s.phase, "focus");
  assert.equal(s.phaseLeft, 15 * 60);
  assert.equal(s.focusSec, 2 * 25 * 60 + 10 * 60);
});

test("custom durations are respected", () => {
  const cfg = pomoConfig(50, 10);
  let s = initialPomoState(cfg);
  s = advancePomo(s, 50 * 60, cfg);
  assert.equal(s.phase, "break");
  assert.equal(s.phaseLeft, 10 * 60);
  assert.equal(s.cycles, 1);
});

test("fractional ticks add up without drift", () => {
  const cfg = pomoConfig(50, 10);
  let s = initialPomoState(cfg);
  for (let i = 0; i < 40; i++) s = advancePomo(s, 1.5, cfg);
  assert.equal(s.focusSec, 60);
  assert.equal(s.phaseLeft, cfg.focus - 60);
});

test("skipBreak jumps straight to the next focus block", () => {
  let s = advancePomo(initialPomoState(P25), 25 * 60 + 30, P25); // 30s into break
  assert.equal(s.phase, "break");
  s = skipBreak(s, P25);
  assert.equal(s.phase, "focus");
  assert.equal(s.phaseLeft, 25 * 60);
  assert.equal(s.cycles, 1, "cycle count kept");
  assert.equal(skipBreak(s, P25), s, "no-op while focused");
});

test("advancePomo ignores negative dt", () => {
  const s = initialPomoState(P25);
  assert.deepEqual(advancePomo(s, -10, P25), s);
});
