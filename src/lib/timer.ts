// Session timer logic — pure functions so the pomodoro state machine can be
// unit-tested (scripts/timer.test.ts) independently of React.
//
// Modes:
//   "none"      no visible clock (elapsed time is still tracked for time goals)
//   "normal"    a stopwatch counting up
//   "pomodoro"  focus/break cycles, with user-chosen durations

export type TimerMode = "none" | "normal" | "pomodoro";

// A pomodoro's focus and break lengths, in seconds.
export interface PomoConfig {
  focus: number;
  break: number;
}

// Bounds for the user-configurable durations (minutes).
export const POMO_LIMITS = { focusMin: 1, focusMax: 180, breakMin: 1, breakMax: 60 };
export const DEFAULT_POMODORO = { focus: 25, break: 5 }; // minutes

// Build a PomoConfig (seconds) from minute inputs, clamped to sane bounds.
export function pomoConfig(focusMinutes: number, breakMinutes: number): PomoConfig {
  const clamp = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));
  return {
    focus: clamp(focusMinutes, POMO_LIMITS.focusMin, POMO_LIMITS.focusMax) * 60,
    break: clamp(breakMinutes, POMO_LIMITS.breakMin, POMO_LIMITS.breakMax) * 60,
  };
}

// Read a timer mode from an untrusted string (URL param); anything unknown is "none".
export function parseTimerMode(raw: string | null): TimerMode {
  return raw === "normal" || raw === "pomodoro" ? raw : "none";
}

export function isPomodoro(mode: TimerMode): boolean {
  return mode === "pomodoro";
}

// "m:ss" under an hour, "h:mm:ss" above.
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(2, "0");
  const rr = String(r).padStart(2, "0");
  return h ? `${h}:${mm}:${rr}` : `${m}:${rr}`;
}

export interface PomoState {
  phase: "focus" | "break";
  phaseLeft: number; // seconds remaining in the current phase
  focusSec: number;  // total focused seconds accumulated (drives time goals)
  cycles: number;    // completed focus blocks
}

export function initialPomoState(config: PomoConfig): PomoState {
  return { phase: "focus", phaseLeft: config.focus, focusSec: 0, cycles: 0 };
}

// Advance the state machine by dt seconds. dt can be fractional or span
// multiple phases (e.g. a background tab that was throttled for 10 minutes).
export function advancePomo(state: PomoState, dt: number, config: PomoConfig): PomoState {
  let { phase, phaseLeft, focusSec, cycles } = state;
  let remaining = Math.max(0, dt);
  while (remaining > 0) {
    const step = Math.min(remaining, phaseLeft);
    phaseLeft -= step;
    remaining -= step;
    if (phase === "focus") focusSec += step;
    if (phaseLeft <= 0) {
      if (phase === "focus") {
        cycles += 1;
        phase = "break";
        phaseLeft = config.break;
      } else {
        phase = "focus";
        phaseLeft = config.focus;
      }
    }
  }
  return { phase, phaseLeft, focusSec, cycles };
}

// End the current break early and start the next focus block.
export function skipBreak(state: PomoState, config: PomoConfig): PomoState {
  if (state.phase !== "break") return state;
  return { ...state, phase: "focus", phaseLeft: config.focus };
}
