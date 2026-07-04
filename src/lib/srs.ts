// Spaced-repetition scheduling (a simplified SM-2, the algorithm Anki is based on).
// Given a card's current state and the user's rating, it returns the next state.

export type Rating = "again" | "hard" | "good" | "easy";

export interface SrsState {
  state: string; // "new" | "learning" | "review"
  intervalDays: number;
  ease: number;
  reps: number;
  lapses: number;
}

export interface SrsResult extends SrsState {
  lastRating: Rating;
  due: Date;
}

const MIN_EASE = 1.3;

// Learning steps in minutes (for new/lapsed cards before they graduate to "review").
const LEARNING_STEPS_MIN = [1, 10];
// A "hard" answer while learning sits between failing (1 min) and passing:
// the card was recalled, just shakily — so it comes back soon, but clearly
// later than an outright "again".
const LEARNING_HARD_MIN = 6;

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}

/**
 * Calculate the next scheduling state for a card after a review.
 */
export function schedule(card: SrsState, rating: Rating, now: Date = new Date()): SrsResult {
  let { state, intervalDays, ease, reps, lapses } = card;

  if (state === "new" || state === "learning") {
    // Card is still being learned.
    if (rating === "again") {
      // Count repeated failures while learning too, so stubborn cards become leeches.
      return { state: "learning", intervalDays: 0, ease, reps, lapses: lapses + 1, lastRating: rating, due: addMinutes(now, LEARNING_STEPS_MIN[0]) };
    }
    if (rating === "hard") {
      return { state: "learning", intervalDays: 0, ease, reps, lastRating: rating, lapses, due: addMinutes(now, LEARNING_HARD_MIN) };
    }
    if (rating === "good") {
      // Graduate to review with a 1-day interval.
      return { state: "review", intervalDays: 1, ease, reps: reps + 1, lapses, lastRating: rating, due: addDays(now, 1) };
    }
    // easy -> graduate faster
    return { state: "review", intervalDays: 4, ease: ease + 0.15, reps: reps + 1, lapses, lastRating: rating, due: addDays(now, 4) };
  }

  // state === "review"
  if (rating === "again") {
    // Lapse: send back to learning.
    const newEase = Math.max(MIN_EASE, ease - 0.2);
    return { state: "learning", intervalDays: 0, ease: newEase, reps, lapses: lapses + 1, lastRating: rating, due: addMinutes(now, LEARNING_STEPS_MIN[0]) };
  }

  // Compute all three candidate intervals together so the ordering is
  // guaranteed even after rounding: for short intervals, hard/good/easy can
  // otherwise round to the same day (e.g. a 1-day card: good 2.5→3, easy
  // 3.25→3), and then "easy" wouldn't actually buy the user more time.
  const hardIvl = Math.max(1, Math.round(intervalDays * 1.2));
  const goodIvl = Math.max(hardIvl + 1, Math.round(intervalDays * ease));
  const easyIvl = Math.max(goodIvl + 1, Math.round(intervalDays * ease * 1.3));

  let newEase = ease;
  let newInterval: number;
  if (rating === "hard") {
    newEase = Math.max(MIN_EASE, ease - 0.15);
    newInterval = hardIvl;
  } else if (rating === "good") {
    newInterval = goodIvl;
  } else {
    // easy
    newEase = ease + 0.15;
    newInterval = easyIvl;
  }
  return {
    state: "review",
    intervalDays: newInterval,
    ease: newEase,
    reps: reps + 1,
    lapses,
    lastRating: rating,
    due: addDays(now, newInterval),
  };
}

// A short human-friendly label for when a card will next appear (shown on rating buttons).
export function previewInterval(card: SrsState, rating: Rating): string {
  const res = schedule(card, rating);
  const ms = res.due.getTime() - Date.now();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}mo`;
}
