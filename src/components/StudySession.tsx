"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Flag, Eye, Loader2, PartyPopper, ArrowRight, ChevronLeft, ChevronRight, Bug, NotebookPen, X, LogOut, CircleDashed, Timer, Coffee, Play, Pause, Target } from "lucide-react";
import { CardQuestion, CardAnswer, type CardData } from "./CardFace";
import NotebookEditor from "./NotebookEditor";
import { previewInterval, type Rating } from "@/lib/srs";
import { advancePomo, formatClock, initialPomoState, isPomodoro, pomoConfig, skipBreak, type PomoState, type TimerMode } from "@/lib/timer";

type Mode = "due" | "hard" | "all" | "custom";
type Counts = { again: number; hard: number; good: number; easy: number };

const RATINGS: { key: Rating; label: string; color: string; hot: string }[] = [
  { key: "again", label: "Again", color: "var(--color-again)", hot: "1" },
  { key: "hard", label: "Hard", color: "var(--color-hard)", hot: "2" },
  { key: "good", label: "Good", color: "var(--color-good)", hot: "3" },
  { key: "easy", label: "Easy", color: "var(--color-easy)", hot: "4" },
];

export default function StudySession({ mode, deckId, tag, tags, source, limit, title, timer = "none", pomoFocus = 25, pomoBreak = 5, goalCards, goalMinutes }: { mode: Mode; deckId?: string; tag?: string; tags?: string; source?: string; limit?: number; title: string; timer?: TimerMode; pomoFocus?: number; pomoBreak?: number; goalCards?: number; goalMinutes?: number }) {
  // The pomodoro durations are fixed for the life of a session; memoise so the
  // config keeps a stable identity for effect dependencies.
  const pomoCfg = useMemo(() => pomoConfig(pomoFocus, pomoBreak), [pomoFocus, pomoBreak]);
  const [queue, setQueue] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [finished, setFinished] = useState(false);
  const [endedEarly, setEndedEarly] = useState(false);
  // Unique cards this session started with (requeued "again/hard" cards don't inflate it),
  // so we can show how many were left unsolved if you end early.
  const [initialTotal, setInitialTotal] = useState(0);
  const [counts, setCounts] = useState<Counts>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());
  const [flaggedSet, setFlaggedSet] = useState<Set<string>>(new Set());
  const [leechSet, setLeechSet] = useState<Set<string>>(new Set());
  const [flagToast, setFlagToast] = useState<"on" | "off" | null>(null);
  const [notebookOpen, setNotebookOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Session timer (stopwatch / pomodoro) & goal tracking ----
  // elapsed always ticks (cheap, and it powers time goals even with the clock
  // hidden); the pomodoro state machine lives in @/lib/timer and is advanced by
  // wall-clock deltas so throttled background tabs can't drift it.
  const [elapsed, setElapsed] = useState(0);
  const [pomo, setPomo] = useState<PomoState | null>(() => (isPomodoro(timer) ? initialPomoState(pomoConfig(pomoFocus, pomoBreak)) : null));
  const [paused, setPaused] = useState(false);
  const [goalOverlay, setGoalOverlay] = useState(false);
  const goalAnnounced = useRef(false);
  const lastTick = useRef(0); // wall-clock ms of the previous tick; seeded when the interval starts

  useEffect(() => {
    const params = new URLSearchParams({ mode });
    if (deckId) params.set("deckId", deckId);
    if (tag) params.set("tag", tag);
    if (tags) params.set("tags", tags);
    if (source) params.set("source", source);
    if (limit) params.set("limit", String(limit));
    fetch(`/api/study?${params}`)
      .then((r) => r.json())
      .then((data: CardData[]) => {
        setQueue(data);
        setInitialTotal(data.length);
        setFlaggedSet(new Set(data.filter((c) => c.flagged).map((c) => c.id)));
        setLeechSet(new Set(data.filter((c) => c.isLeech).map((c) => c.id)));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [mode, deckId, tag, tags, source, limit]);

  // Tick the clock once a second using real elapsed time between ticks (so a
  // throttled background tab catches up correctly instead of losing time).
  // Re-created on pause/resume, which also resets the tick baseline.
  useEffect(() => {
    if (loading || finished || paused) return;
    lastTick.current = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTick.current) / 1000;
      lastTick.current = now;
      if (dt <= 0) return;
      setElapsed((e) => e + dt);
      if (isPomodoro(timer)) setPomo((p) => (p ? advancePomo(p, dt, pomoCfg) : p));
    }, 1000);
    return () => clearInterval(id);
  }, [loading, finished, paused, timer, pomoCfg]);

  const onBreak = pomo?.phase === "break";
  const focusSeconds = pomo ? pomo.focusSec : elapsed;

  const current = queue[idx];
  const total = queue.length;

  // Fire the goal celebration exactly once, whichever target lands first.
  const goalReached =
    (goalCards != null && done >= goalCards) ||
    (goalMinutes != null && focusSeconds >= goalMinutes * 60);
  useEffect(() => {
    if (goalReached && !goalAnnounced.current && !finished) {
      goalAnnounced.current = true;
      setGoalOverlay(true);
    }
  }, [goalReached, finished]);

  const rate = useCallback(
    async (rating: Rating) => {
      if (!current) return;
      const card = current;
      const alreadyRated = ratedIds.has(card.id);
      setRevealed(false);
      if (!alreadyRated) {
        setCounts((c) => ({ ...c, [rating]: c[rating] + 1 }));
        setDone((d) => d + 1);
        setRatedIds((s) => new Set(s).add(card.id));
      }
      const requeue = mode !== "hard" && !alreadyRated && (rating === "again" || rating === "hard");
      const atEnd = idx >= queue.length - 1;
      setQueue((q) => {
        const next = [...q];
        if (requeue) next.push(card);
        return next;
      });
      if (atEnd && !requeue) setFinished(true);
      else setIdx((i) => i + 1);

      const res = await fetch("/api/study/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: card.id, rating }),
      }).then((r) => r.json()).catch(() => null);
      if (res?.isLeech) setLeechSet((s) => new Set(s).add(card.id));
    },
    [current, mode, idx, queue.length, ratedIds]
  );

  // Stop now: cards already rated are kept in the statistics (they were saved as
  // you rated them); everything you didn't reach stays unsolved/unanswered.
  const endSession = useCallback(() => {
    setEndedEarly(true);
    setFinished(true);
  }, []);

  const goPrev = useCallback(() => { setRevealed(false); setIdx((i) => Math.max(0, i - 1)); }, []);
  const goNext = useCallback(() => { setRevealed(false); setIdx((i) => Math.min(queue.length - 1, i + 1)); }, [queue.length]);

  const toggleFlag = useCallback(async () => {
    if (!current) return;
    const id = current.id;
    const willFlag = !flaggedSet.has(id);
    setFlaggedSet((s) => { const n = new Set(s); willFlag ? n.add(id) : n.delete(id); return n; });
    setFlagToast(willFlag ? "on" : "off");
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setFlagToast(null), 1400);
    fetch("/api/cards", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, flagged: willFlag }) }).catch(() => {});
  }, [current, flaggedSet]);

  // Keyboard: space reveals, 1-4 rate, F flag, arrows navigate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!current) return;
      if (onBreak || goalOverlay) return; // an overlay owns the screen
      if (e.key === "ArrowLeft") { goPrev(); return; }
      if (e.key === "ArrowRight") { goNext(); return; }
      if (e.key.toLowerCase() === "f") { toggleFlag(); return; }
      if (!revealed && (e.key === " " || e.key === "Enter")) { e.preventDefault(); setRevealed(true); }
      else if (revealed && ["1", "2", "3", "4"].includes(e.key)) rate(RATINGS[Number(e.key) - 1].key);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, revealed, rate, toggleFlag, goPrev, goNext, onBreak, goalOverlay]);

  if (loading) return <div className="grid place-items-center py-24 text-[var(--color-muted)]"><Loader2 className="animate-spin mb-2" /> Loading cards…</div>;
  if (finished || !current) {
    const remaining = Math.max(0, initialTotal - done);
    return (
      <SessionSummary
        done={done} counts={counts} remaining={remaining} endedEarly={endedEarly}
        timeSeconds={timer !== "none" || goalMinutes != null ? Math.round(focusSeconds) : 0}
        cycles={pomo?.cycles ?? 0}
        goalCards={goalCards} goalMinutes={goalMinutes}
      />
    );
  }

  const isFlagged = flaggedSet.has(current.id);
  const isLeech = leechSet.has(current.id);
  const progress = total ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="flex items-center gap-2">
          <button onClick={endSession} className="btn btn-ghost py-1.5 px-2.5 text-[var(--color-again)] hover:bg-[var(--color-danger-bg)]" title="End this session now — answered cards are saved, the rest stay unsolved">
            <LogOut size={16} /> <span className="hidden sm:inline text-sm">End session</span>
          </button>
          <button onClick={() => setNotebookOpen(true)} className="btn btn-ghost py-1.5 px-2" title="Open notebook"><NotebookPen size={16} /></button>
          <button onClick={goPrev} disabled={idx === 0} className="btn btn-ghost py-1.5 px-2 disabled:opacity-40" title="Previous card (←)"><ChevronLeft size={16} /></button>
          <span className="text-sm text-[var(--color-muted)] tabular-nums">{idx + 1} / {total}</span>
          <button onClick={goNext} disabled={idx >= total - 1} className="btn btn-ghost py-1.5 px-2 disabled:opacity-40" title="Skip to next (→)"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Timer & goal chips — only when this session has a clock or a target. */}
      {(timer !== "none" || goalCards != null || goalMinutes != null) && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {timer !== "none" && (
            <button
              onClick={() => setPaused((p) => !p)}
              className="chip !text-[0.8rem] tabular-nums cursor-pointer"
              style={onBreak ? { background: "var(--color-hard)", color: "white" } : undefined}
              title={paused ? "Resume timer" : "Pause timer"}
            >
              {onBreak ? <Coffee size={13} /> : <Timer size={13} />}
              {isPomodoro(timer) && pomo
                ? `${onBreak ? "Break" : "Focus"} · ${formatClock(pomo.phaseLeft)}`
                : formatClock(elapsed)}
              {paused ? <Play size={12} /> : <Pause size={12} className="opacity-50" />}
            </button>
          )}
          {isPomodoro(timer) && pomo && pomo.cycles > 0 && (
            <span className="chip !text-[0.8rem]" title="Completed pomodoros">🍅 ×{pomo.cycles}</span>
          )}
          {goalCards != null && (
            <span className="chip !text-[0.8rem] tabular-nums" style={done >= goalCards ? { background: "var(--color-good)", color: "white" } : undefined}>
              <Target size={13} /> {done} / {goalCards} cards
            </span>
          )}
          {goalMinutes != null && (
            <span className="chip !text-[0.8rem] tabular-nums" style={focusSeconds >= goalMinutes * 60 ? { background: "var(--color-good)", color: "white" } : undefined}>
              <Target size={13} /> {formatClock(focusSeconds)} / {goalMinutes} min
            </span>
          )}
        </div>
      )}

      <div className="h-2 rounded-full bg-[var(--color-track)] overflow-hidden mb-5">
        <motion.div className="h-full progress-glow" animate={{ width: `${progress}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={current.id + "-" + idx} initial={{ opacity: 0, y: 16, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.22 }} className="card-surface gradient-ring p-7 md:p-10 min-h-[300px] flex flex-col relative">
          <AnimatePresence>
            {flagToast && (
              <motion.div initial={{ opacity: 0, y: -8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}
                className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full shadow"
                style={{ background: flagToast === "on" ? "var(--color-hard)" : "var(--color-surface-2)", color: flagToast === "on" ? "white" : "var(--color-muted)" }}>
                <Flag size={14} fill={flagToast === "on" ? "white" : "none"} />
                {flagToast === "on" ? "Flagged for review" : "Flag removed"}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2 flex-wrap items-center">
              {isLeech && <span className="chip" style={{ background: "var(--color-danger-bg)", color: "var(--color-again)" }}><Bug size={12} /> Leech</span>}
              {current.tags ? current.tags.split(",").filter(Boolean).slice(0, 4).map((t) => <span key={t} className="chip">{t.trim()}</span>) : null}
            </div>
            <motion.button onClick={toggleFlag} whileTap={{ scale: 0.8 }} animate={isFlagged ? { scale: [1, 1.25, 1] } : { scale: 1 }} transition={{ duration: 0.3 }}
              className={`transition-colors ${isFlagged ? "text-[var(--color-hard)]" : "text-[var(--color-muted)] hover:text-[var(--color-hard)]"}`}
              title={isFlagged ? "Flagged — click to remove (F)" : "Flag for review later (F)"}>
              <Flag size={20} fill={isFlagged ? "currentColor" : "none"} />
            </motion.button>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <CardQuestion card={current} />
            {revealed && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 pt-6 border-t border-[var(--color-line)]">
                <CardAnswer card={current} />
              </motion.div>
            )}
          </div>

          {current.source && <p className="text-xs text-[var(--color-muted)] mt-6">Source: {current.source}</p>}
        </motion.div>
      </AnimatePresence>

      <div className="mt-5">
        {!revealed ? (
          <button onClick={() => setRevealed(true)} className="btn btn-primary w-full py-3.5 text-base">
            <Eye size={18} /> Show Answer <span className="opacity-70 text-sm ml-1">(Space)</span>
          </button>
        ) : (
          <div className="grid grid-cols-4 gap-2.5">
            {RATINGS.map((r) => (
              <button key={r.key} onClick={() => rate(r.key)} className="btn flex-col gap-0.5 py-3 text-white" style={{ background: r.color }}>
                <span className="text-base font-bold">{r.label}</span>
                <span className="text-[11px] opacity-90">
                  {previewInterval({ state: current.state ?? "new", intervalDays: current.intervalDays ?? 0, ease: current.ease ?? 2.5, reps: current.reps ?? 0, lapses: current.lapses ?? 0 }, r.key)} · {r.hot}
                </span>
              </button>
            ))}
          </div>
        )}
        <p className="text-center text-xs text-[var(--color-muted)] mt-3">← / → to move between cards · Space to reveal · 1–4 to rate · F to flag</p>
      </div>

      {/* Notebook slide-over */}
      <AnimatePresence>
        {notebookOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40" onClick={() => setNotebookOpen(false)} />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 260, damping: 30 }}
              className="fixed top-0 right-0 h-full w-full max-w-md bg-[var(--color-surface)] z-50 shadow-2xl p-5 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold flex items-center gap-2"><NotebookPen size={18} /> Notebook</h3>
                <button onClick={() => setNotebookOpen(false)} className="text-[var(--color-muted)] hover:text-[var(--color-ink)]"><X size={20} /></button>
              </div>
              <div className="flex-1 min-h-0"><NotebookEditor compact /></div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Pomodoro break — takes over the screen so you actually rest. */}
      <AnimatePresence>
        {isPomodoro(timer) && pomo && onBreak && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.92, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              className="card-surface gradient-ring p-8 md:p-10 text-center max-w-sm w-full">
              <motion.div
                animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                className="grid place-items-center w-16 h-16 rounded-2xl mx-auto mb-4"
                style={{ background: "var(--color-chip-bg)", color: "var(--color-brand)" }}
              >
                <Coffee size={30} />
              </motion.div>
              <h2 className="text-2xl font-bold mb-1">Break time ☕</h2>
              <p className="text-[var(--color-muted)]">
                Pomodoro #{pomo.cycles} done — stretch, hydrate, look away from the screen.
              </p>
              <p className="text-5xl font-bold tabular-nums my-5">{formatClock(pomo.phaseLeft)}</p>
              <button onClick={() => setPomo((p) => (p ? skipBreak(p, pomoCfg) : p))} className="btn btn-primary w-full">
                <Play size={16} /> Skip break — keep studying
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Session goal reached — celebrate, then let the user decide. */}
      <AnimatePresence>
        {goalOverlay && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.92, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              className="card-surface gradient-ring p-8 md:p-10 text-center max-w-sm w-full relative overflow-hidden">
              <Confetti />
              <motion.div
                initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
                className="logo-badge pulse-glow grid place-items-center w-16 h-16 rounded-2xl mx-auto mb-4 text-white"
              >
                <Target size={30} />
              </motion.div>
              <h2 className="text-2xl font-bold mb-1">Goal reached! 🎯</h2>
              <p className="text-[var(--color-muted)] mb-6">
                {goalCards != null && done >= goalCards
                  ? <>You&apos;ve solved <b className="text-[var(--color-ink)]">{done}</b> cards</>
                  : <>You&apos;ve studied for <b className="text-[var(--color-ink)]">{goalMinutes}</b> minutes</>}
                {" "}— brilliant work. Stop here or push on?
              </p>
              <div className="flex gap-2">
                <button onClick={() => setGoalOverlay(false)} className="btn btn-ghost flex-1">Keep going</button>
                <button onClick={() => { setGoalOverlay(false); endSession(); }} className="btn btn-primary flex-1">Finish session</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// A one-shot confetti burst for the session-complete screen: small emerald/teal/
// amber pieces rain from the top of the summary card. Pure framer-motion — no
// dependency — and positions are memoised so re-renders don't reshuffle them.
const CONFETTI_COLORS = ["#10b981", "#14b8a6", "#34d399", "#f59e0b", "#0ea5e9", "#a7f3d0"];
// Pre-generated once at module load (not during render) so <Confetti> stays a
// pure component. The overlays that use it only ever appear after client-side
// interaction, so there's no server/client hydration mismatch to worry about.
const CONFETTI_PIECES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  delay: Math.random() * 0.7,
  duration: 2.2 + Math.random() * 1.6,
  rotate: (Math.random() - 0.5) * 720,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  w: 6 + Math.random() * 5,
  h: 10 + Math.random() * 6,
}));
function Confetti() {
  const pieces = CONFETTI_PIECES;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-[2px]"
          style={{ left: `${p.x}%`, top: -16, width: p.w, height: p.h, background: p.color }}
          initial={{ y: 0, opacity: 1, rotate: 0 }}
          animate={{ y: 560, opacity: [1, 1, 0.9, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

function SessionSummary({ done, counts, remaining = 0, endedEarly = false, timeSeconds = 0, cycles = 0, goalCards, goalMinutes }: { done: number; counts: Counts; remaining?: number; endedEarly?: boolean; timeSeconds?: number; cycles?: number; goalCards?: number; goalMinutes?: number }) {
  const total = counts.again + counts.hard + counts.good + counts.easy;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const accuracy = pct(counts.good + counts.easy);
  const goalHit =
    (goalCards != null && done >= goalCards) ||
    (goalMinutes != null && timeSeconds >= goalMinutes * 60);
  const rows = [
    { label: "Again", value: counts.again, color: "var(--color-again)" },
    { label: "Hard", value: counts.hard, color: "var(--color-hard)" },
    { label: "Good", value: counts.good, color: "var(--color-good)" },
    { label: "Easy", value: counts.easy, color: "var(--color-easy)" },
  ];
  return (
    <div className="card-surface gradient-ring p-8 md:p-10 text-center fade-up max-w-xl mx-auto relative overflow-hidden">
      {!endedEarly && total > 0 && <Confetti />}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
        className="logo-badge pulse-glow grid place-items-center w-16 h-16 rounded-2xl mx-auto mb-4 text-white"
      >
        <PartyPopper size={30} />
      </motion.div>
      <h2 className="text-2xl font-bold mb-1">{endedEarly ? "Session ended" : "Session complete!"}</h2>
      {total === 0 ? (
        <p className="text-[var(--color-muted)] mb-6">{endedEarly ? "You ended before answering any cards — nothing was counted, and all cards are still unsolved." : "There were no cards to review right now."}</p>
      ) : (
        <>
          <p className="text-[var(--color-muted)] mb-2">You reviewed <b className="text-[var(--color-ink)]">{done}</b> card{done === 1 ? "" : "s"} — all counted in your statistics.</p>
          {(timeSeconds > 0 || cycles > 0) && (
            <p className="text-sm text-[var(--color-muted)] mb-2 flex items-center gap-1.5 justify-center flex-wrap">
              <Timer size={14} /> <b className="text-[var(--color-ink)]">{formatClock(timeSeconds)}</b> focused
              {cycles > 0 && <> · 🍅 ×{cycles} pomodoro{cycles > 1 ? "s" : ""}</>}
              {goalHit && <> · 🎯 goal reached</>}
            </p>
          )}
          {endedEarly && remaining > 0 && (
            <p className="text-sm text-[var(--color-muted)] mb-6 inline-flex items-center gap-1.5 justify-center">
              <CircleDashed size={15} /> <b className="text-[var(--color-ink)]">{remaining}</b> card{remaining === 1 ? "" : "s"} left unsolved — they&apos;ll be waiting next time.
            </p>
          )}
          {!(endedEarly && remaining > 0) && <div className="mb-6" />}
          <div className="mb-6"><div className="text-5xl font-bold text-[var(--color-good)]">{accuracy}%</div><div className="text-sm text-[var(--color-muted)]">answered Good or Easy</div></div>
          <div className="space-y-3 text-left mb-7">
            {rows.map((r) => (
              <div key={r.label}>
                <div className="flex justify-between text-sm mb-1"><span className="font-medium">{r.label}</span><span className="text-[var(--color-muted)]">{r.value} · {pct(r.value)}%</span></div>
                <div className="h-2.5 rounded-full bg-[var(--color-track)] overflow-hidden"><motion.div className="h-full rounded-full" style={{ background: r.color }} initial={{ width: 0 }} animate={{ width: `${pct(r.value)}%` }} transition={{ duration: 0.6 }} /></div>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="flex gap-3 justify-center">
        <Link href="/" className="btn btn-ghost">Back home</Link>
        <Link href="/insights" className="btn btn-primary">See my insights <ArrowRight size={16} /></Link>
      </div>
    </div>
  );
}
