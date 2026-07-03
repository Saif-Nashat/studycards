"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, Layers, Flame, CheckCircle2, Plus, Play, Trash2, Loader2, Sparkles, Tag } from "lucide-react";

interface Stats { total: number; due: number; new: number; flagged: number; hard: number; decks: number; reviewedToday: number; }
interface Deck { id: string; name: string; description: string; total: number; due: number; new: number; }
interface Tag { tag: string; total: number; ready: number; }

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDeck, setNewDeck] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/decks").then((r) => r.json()),
      fetch("/api/tags").then((r) => r.json()),
    ]).then(([s, d, t]) => { setStats(s); setDecks(d); setTags(t); setLoading(false); });
  }
  useEffect(load, []);

  async function createDeck(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeck.trim()) return;
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
    <div className="space-y-8">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="card-surface gradient-ring p-7 md:p-9 relative overflow-hidden">
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
        <p className="text-[var(--color-muted)] font-medium relative">Welcome back 👋</p>
        <h1 className="text-3xl md:text-5xl font-extrabold mt-1 relative tracking-tight">Ready to <span className="text-gradient">revise?</span></h1>
        <p className="text-[var(--color-muted)] mt-2 max-w-lg">
          You have <b className="text-[var(--color-ink)]">{stats.due + stats.new}</b> cards waiting across{" "}
          <b className="text-[var(--color-ink)]">{stats.decks}</b> deck{stats.decks === 1 ? "" : "s"}.
        </p>
        <div className="flex flex-wrap gap-3 mt-5">
          <Link href="/study?go=1&mode=due" className="btn btn-primary"><Play size={18} /> Study all due ({stats.due + stats.new})</Link>
          <Link href="/hard" className="btn btn-ghost"><Flame size={18} /> Hard cards ({stats.hard})</Link>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }} className="card-surface card-lift p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-muted)]">{s.label}</span>
              <span className="grid place-items-center w-9 h-9 rounded-xl" style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 16%, transparent)` }}>
                <s.icon size={18} />
              </span>
            </div>
            <p className="text-3xl font-bold mt-2 tabular-nums">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Decks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2"><Layers size={20} /> Your decks</h2>
        </div>

        <form onSubmit={createDeck} className="flex gap-2 mb-4">
          <input className="input max-w-xs" placeholder="New deck name (e.g. Anatomy)" value={newDeck} onChange={(e) => setNewDeck(e.target.value)} />
          <button className="btn btn-ghost" disabled={creating}>{creating ? <Loader2 className="animate-spin" size={16} /> : <><Plus size={16} /> Add deck</>}</button>
        </form>

        {decks.length === 0 ? (
          <div className="card-surface p-10 text-center text-[var(--color-muted)]">
            No decks yet. Create one above, then <Link href="/import" className="text-[var(--color-brand)] font-medium">import some cards</Link>.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {decks.map((d, i) => (
              <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }} className="card-surface card-lift p-5 flex flex-col">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg leading-tight">{d.name}</h3>
                  <button onClick={() => deleteDeck(d.id, d.name)} className="text-[var(--color-muted)] hover:text-[var(--color-again)] p-1" title="Delete deck">
                    <Trash2 size={15} />
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

      {/* Study by topic */}
      {tags.length > 0 && (
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 mb-1"><Tag size={20} /> Study by topic</h2>
          <p className="text-[var(--color-muted)] text-sm mb-4">Drill a single topic across all your decks. The number is how many are ready now.</p>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <button key={t.tag}
                onClick={() => router.push(`/study?go=1&mode=due&tag=${encodeURIComponent(t.tag)}&tagName=${encodeURIComponent(t.tag)}`)}
                className="card-surface card-lift px-3.5 py-2 text-sm font-medium transition flex items-center gap-2">
                {t.tag}
                <span className={`text-xs font-bold ${t.ready > 0 ? "text-[var(--color-brand)]" : "text-[var(--color-muted)]"}`}>{t.ready}</span>
                <span className="text-xs text-[var(--color-muted)]">/ {t.total}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
