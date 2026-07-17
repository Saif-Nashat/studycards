"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, Layers, Flame, CheckCircle2, Plus, Play, Trash2, Loader2, Sparkles, Trophy, ArrowRight, History, CalendarCheck } from "lucide-react";
import NumberTicker from "@/components/NumberTicker";
import { readSavedSession, clearSavedSession, type SavedSession } from "@/components/StudySession";

interface Stats { total: number; due: number; new: number; flagged: number; hard: number; decks: number; reviewedToday: number; }
interface Deck { id: string; name: string; description: string; total: number; due: number; new: number; }
interface Momentum { streak: number; longestStreak: number; daily: { date: string; label: string; count: number }[]; }

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [momentum, setMomentum] = useState<Momentum | null>(null);
  const [resume, setResume] = useState<SavedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [newDeck, setNewDeck] = useState("");
  const [deckError, setDeckError] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/decks").then((r) => r.json()),
      fetch("/api/insights").then((r) => r.json()).catch(() => null),
    ]).then(([s, d, ins]) => {
      setStats(s);
      setDecks(d);
      if (ins) setMomentum({ streak: ins.streak ?? 0, longestStreak: ins.longestStreak ?? ins.streak ?? 0, daily: Array.isArray(ins.daily) ? ins.daily : [] });
      // sessionStorage is client-only; safe to read here inside the async callback.
      setResume(readSavedSession());
      setLoading(false);
    });
  }
  useEffect(load, []);

  async function createDeck(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeck.trim()) {
      setDeckError("Give your deck a name first — type it in the box, then press Add deck.");
      return;
    }
    setDeckError("");
    setCreating(true);
    await fetch("/api/decks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newDeck.trim() }),
    });
    setNewDeck(""); setCreating(false); load();
  }

  async function deleteDeck(id: string, name: string) {
    if (!confirm(`Delete the deck "${name}" and all its cards? This cannot be undone.`)) return;
    await fetch("/api/decks", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  if (loading || !stats) {
    return <div className="grid place-items-center py-24 text-[var(--color-muted)]"><Loader2 className="animate-spin" /></div>;
  }

  const statCards = [
    { label: "Due today", value: stats.due, icon: BookOpen, color: "var(--color-brand)" },
    { label: "New cards", value: stats.new, icon: Sparkles, color: "var(--color-accent)" },
    { label: "Reviewed today", value: stats.reviewedToday, icon: CheckCircle2, color: "var(--color-good)" },
    { label: "Hard / flagged", value: stats.hard, icon: Flame, color: "var(--color-hard)" },
  ];

  return (
    <div className="space-y-10">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 18, filter: "blur(5px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
        className="card-surface gradient-ring p-7 md:p-10 relative overflow-hidden"
      >
        <motion.div
          className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-[var(--color-accent)]/25 blur-3xl"
          animate={{ x: [0, -16, 0], y: [0, 12, 0], scale: [1, 1.18, 1] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-24 -bottom-16 w-44 h-44 rounded-full bg-[var(--color-gold)]/20 blur-3xl"
          animate={{ x: [0, 14, 0], y: [0, -10, 0], scale: [1.05, 0.9, 1.05] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -left-12 -bottom-14 w-40 h-40 rounded-full bg-[var(--color-teal)]/20 blur-3xl"
          animate={{ x: [0, 12, 0], y: [0, -8, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="eyebrow relative mb-4">Welcome back</span>
        <h1 className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl mt-3 relative tracking-tight leading-[1.15]">
          Ready to <span className="text-gradient italic">revise?</span>
        </h1>
        <p className="text-[var(--color-muted)] mt-3 max-w-lg relative">
          You have <b className="text-[var(--color-ink)]">{stats.due + stats.new}</b> cards waiting across{" "}
          <b className="text-[var(--color-ink)]">{stats.decks}</b> deck{stats.decks === 1 ? "" : "s"}.
        </p>
        <div className="flex flex-wrap gap-3 mt-6 relative">
          <Link id="tour-study-cta" href="/study?go=1&mode=due" className="btn btn-primary py-3 px-6">
            <Play size={17} /> Study all due ({stats.due + stats.new})
            <span className="btn-orb"><ArrowRight size={13} /></span>
          </Link>
          <Link href="/hard" className="btn btn-ghost py-3"><Flame size={17} strokeWidth={1.75} /> Hard / flagged ({stats.hard})</Link>
          <Link href="/achievements" className="btn btn-ghost py-3"><Trophy size={17} strokeWidth={1.75} /> Trophies</Link>
        </div>
      </motion.div>

      {/* Unfinished session — pick up right where you left off. */}
      {resume && (
        <div className="card-surface p-4 flex items-center justify-between gap-3 flex-wrap fade-up" style={{ borderColor: "var(--color-brand)", background: "var(--color-tint)" }}>
          <span className="text-sm flex items-center gap-2">
            <History size={16} className="text-[var(--color-brand)] shrink-0" />
            <span><b>Unfinished session:</b> {resume.title} — {resume.done} / {resume.initialTotal} answered</span>
          </span>
          <span className="flex gap-2">
            <button onClick={() => router.push(resume.href)} className="btn btn-primary py-2 text-sm"><Play size={15} /> Resume</button>
            <button onClick={() => { clearSavedSession(); setResume(null); }} className="btn btn-ghost py-2 text-sm">Discard</button>
          </span>
        </div>
      )}

      {/* Stats */}
      <div id="tour-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
            className="card-surface card-lift p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-muted)]">{s.label}</span>
              <span
                className="grid place-items-center w-9 h-9 rounded-xl"
                style={{
                  color: s.color,
                  background: `color-mix(in srgb, ${s.color} 13%, transparent)`,
                  boxShadow: `inset 0 1px 0 var(--card-highlight), inset 0 0 0 1px color-mix(in srgb, ${s.color} 18%, transparent)`,
                }}
              >
                <s.icon size={17} strokeWidth={1.75} />
              </span>
            </div>
            <p className="text-3xl font-bold mt-2 tabular-nums tracking-tight">
              <NumberTicker value={s.value} />
            </p>
          </motion.div>
        ))}
      </div>

      {/* Momentum — streak + recent activity, the two most motivating signals. */}
      {momentum && (
        <div className="grid md:grid-cols-[minmax(0,1fr)_2fr] gap-3.5">
          <div className="card-surface p-5 flex items-center gap-4">
            <span className="grid place-items-center w-14 h-14 rounded-2xl shrink-0 text-[var(--color-hard)]"
              style={{ background: "color-mix(in srgb, var(--color-hard) 14%, transparent)", boxShadow: "inset 0 1px 0 var(--card-highlight), inset 0 0 0 1px color-mix(in srgb, var(--color-hard) 20%, transparent)" }}>
              <Flame size={26} strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-3xl font-bold tabular-nums tracking-tight leading-none">
                <NumberTicker value={momentum.streak} /> <span className="text-base font-medium text-[var(--color-muted)]">day{momentum.streak === 1 ? "" : "s"}</span>
              </p>
              <p className="text-sm text-[var(--color-muted)] mt-1">Current streak</p>
              {momentum.longestStreak > 0 && (
                <p className="text-xs text-[var(--color-muted)] mt-0.5">Best: {momentum.longestStreak} day{momentum.longestStreak === 1 ? "" : "s"}</p>
              )}
            </div>
          </div>

          <div className="card-surface p-5">
            <p className="text-sm text-[var(--color-muted)] mb-3 flex items-center gap-2"><CalendarCheck size={15} /> Last 14 days</p>
            {(() => {
              const daily = momentum.daily.slice(-14);
              const maxDaily = Math.max(1, ...daily.map((d) => d.count));
              return (
                <div className="flex items-end justify-between gap-1.5 h-20">
                  {daily.map((d) => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="relative w-full flex items-end justify-center h-full">
                        <motion.div
                          className="w-full max-w-[16px] rounded-t bg-[var(--color-brand)]"
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(d.count > 0 ? 8 : 0, (d.count / maxDaily) * 100)}%` }}
                          transition={{ duration: 0.5 }}
                          title={`${d.count} on ${d.date}`}
                        />
                      </div>
                      <span className="text-[9px] text-[var(--color-muted)]">{d.label}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Decks */}
      <div id="tour-decks">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl flex items-center gap-2.5"><Layers size={20} strokeWidth={1.75} className="text-[var(--color-brand)]" /> Your decks</h2>
        </div>

        <form onSubmit={createDeck} className="mb-5">
          <div className="flex gap-2">
            <input className="input max-w-xs" placeholder="New deck name (e.g. Anatomy)" value={newDeck} onChange={(e) => { setNewDeck(e.target.value); if (deckError) setDeckError(""); }} />
            <button className="btn btn-ghost" disabled={creating}>{creating ? <Loader2 className="animate-spin" size={16} /> : <><Plus size={16} /> Add deck</>}</button>
          </div>
          {deckError && <p className="text-sm text-[var(--color-again)] mt-1.5">{deckError}</p>}
        </form>

        {decks.length === 0 ? (
          <div className="card-surface p-10 text-center text-[var(--color-muted)]">
            No decks yet. Create one above, then <Link href="/import" className="text-[var(--color-brand)] font-medium">import some cards</Link>.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {decks.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                className="card-surface card-lift p-5 flex flex-col"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg leading-tight tracking-tight">{d.name}</h3>
                  <button onClick={() => deleteDeck(d.id, d.name)} className="text-[var(--color-muted)] hover:text-[var(--color-again)] p-1 transition-colors" title="Delete deck">
                    <Trash2 size={15} strokeWidth={1.75} />
                  </button>
                </div>
                <div className="flex gap-4 text-sm text-[var(--color-muted)] mt-3">
                  <span><b className="text-[var(--color-brand)]">{d.due}</b> due</span>
                  <span><b className="text-[var(--color-accent)]">{d.new}</b> new</span>
                  <span><b className="text-[var(--color-ink)]">{d.total}</b> total</span>
                </div>
                <button
                  onClick={() => router.push(`/study?go=1&mode=due&deckId=${d.id}&deckName=${encodeURIComponent(d.name)}`)}
                  className="btn btn-primary mt-4 w-full py-2.5">
                  <Play size={16} /> Study
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
