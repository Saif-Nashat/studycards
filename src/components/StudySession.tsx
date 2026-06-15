"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Flag, Eye, Loader2, PartyPopper, ArrowRight, ChevronLeft, ChevronRight, Bug, NotebookPen, X, LogOut, CircleDashed } from "lucide-react";
import { CardQuestion, CardAnswer, type CardData } from "./CardFace";
import NotebookEditor from "./NotebookEditor";
import { previewInterval, type Rating } from "@/lib/srs";

type Mode = "due" | "hard" | "all" | "custom";
type Counts = { again: number; hard: number; good: number; easy: number };

const RATINGS: { key: Rating; label: string; color: string; hot: string }[] = [
  { key: "again", label: "Again", color: "var(--color-again)", hot: "1" },
  { key: "hard", label: "Hard", color: "var(--color-hard)", hot: "2" },
  { key: "good", label: "Good", color: "var(--color-good)", hot: "3" },
  { key: "easy", label: "Easy", color: "var(--color-easy)", hot: "4" },
];

export default function StudySession({ mode, deckId, tag, tags, source, limit, title }: { mode: Mode; deckId?: string; tag?: string; tags?: string; source?: string; limit?: number; title: string }) {
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

  const current = queue[idx];
  const total = queue.length;

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
      if (e.key === "ArrowLeft") { goPrev(); return; }
      if (e.key === "ArrowRight") { goNext(); return; }
      if (e.key.toLowerCase() === "f") { toggleFlag(); return; }
      if (!revealed && (e.key === " " || e.key === "Enter")) { e.preventDefault(); setRevealed(true); }
      else if (revealed && ["1", "2", "3", "4"].includes(e.key)) rate(RATINGS[Number(e.key) - 1].key);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, revealed, rate, toggleFlag, goPrev, goNext]);

  if (loading) return <div className="grid place-items-center py-24 text-[var(--color-muted)]"><Loader2 className="animate-spin mb-2" /> Loading cards…</div>;
  if (finished || !current) {
    const remaining = Math.max(0, initialTotal - done);
    return <SessionSummary done={done} counts={counts} remaining={remaining} endedEarly={endedEarly} />;
  }

  const isFlagged = flaggedSet.has(current.id);
  const isLeech = leechSet.has(current.id);
  const progress = total ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="flex items-center gap-2">
          <button onClick={endSession} className="btn btn-ghost py-1.5 px-2.5 text-[var(--color-again)] hover:bg-[#fef2f2]" title="End this session now — answered cards are saved, the rest stay unsolved">
            <LogOut size={16} /> <span className="hidden sm:inline text-sm">End session</span>
          </button>
          <button onClick={() => setNotebookOpen(true)} className="btn btn-ghost py-1.5 px-2" title="Open notebook"><NotebookPen size={16} /></button>
          <button onClick={goPrev} disabled={idx === 0} className="btn btn-ghost py-1.5 px-2 disabled:opacity-40" title="Previous card (←)"><ChevronLeft size={16} /></button>
          <span className="text-sm text-[var(--color-muted)] tabular-nums">{idx + 1} / {total}</span>
          <button onClick={goNext} disabled={idx >= total - 1} className="btn btn-ghost py-1.5 px-2 disabled:opacity-40" title="Skip to next (→)"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="h-2 rounded-full bg-[#e8eaf5] overflow-hidden mb-5">
        <motion.div className="h-full bg-[var(--color-brand)]" animate={{ width: `${progress}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={current.id + "-" + idx} initial={{ opacity: 0, y: 16, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.22 }} className="card-surface p-7 md:p-10 min-h-[300px] flex flex-col relative">
          <AnimatePresence>
            {flagToast && (
              <motion.div initial={{ opacity: 0, y: -8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }}
                className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full shadow"
                style={{ background: flagToast === "on" ? "var(--color-hard)" : "#e2e8f0", color: flagToast === "on" ? "white" : "var(--color-muted)" }}>
                <Flag size={14} fill={flagToast === "on" ? "white" : "none"} />
                {flagToast === "on" ? "Flagged for review" : "Flag removed"}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2 flex-wrap items-center">
              {isLeech && <span className="chip" style={{ background: "#fef2f2", color: "var(--color-again)" }}><Bug size={12} /> Leech</span>}
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
    </div>
  );
}

function SessionSummary({ done, counts, remaining = 0, endedEarly = false }: { done: number; counts: Counts; remaining?: number; endedEarly?: boolean }) {
  const total = counts.again + counts.hard + counts.good + counts.easy;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const accuracy = pct(counts.good + counts.easy);
  const rows = [
    { label: "Again", value: counts.again, color: "var(--color-again)" },
    { label: "Hard", value: counts.hard, color: "var(--color-hard)" },
    { label: "Good", value: counts.good, color: "var(--color-good)" },
    { label: "Easy", value: counts.easy, color: "var(--color-easy)" },
  ];
  return (
    <div className="card-surface p-8 md:p-10 text-center fade-up max-w-xl mx-auto">
      <div className="grid place-items-center w-16 h-16 rounded-2xl bg-green-100 text-green-600 mx-auto mb-4"><PartyPopper size={30} /></div>
      <h2 className="text-2xl font-bold mb-1">{endedEarly ? "Session ended" : "Session complete!"}</h2>
      {total === 0 ? (
        <p className="text-[var(--color-muted)] mb-6">{endedEarly ? "You ended before answering any cards — nothing was counted, and all cards are still unsolved." : "There were no cards to review right now."}</p>
      ) : (
        <>
          <p className="text-[var(--color-muted)] mb-2">You reviewed <b className="text-[var(--color-ink)]">{done}</b> card{done === 1 ? "" : "s"} — all counted in your statistics.</p>
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
                <div className="h-2.5 rounded-full bg-[#eef0f7] overflow-hidden"><motion.div className="h-full rounded-full" style={{ background: r.color }} initial={{ width: 0 }} animate={{ width: `${pct(r.value)}%` }} transition={{ duration: 0.6 }} /></div>
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
