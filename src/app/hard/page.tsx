"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Flame, Flag, Play, Trash2, Loader2, Bug } from "lucide-react";
import StudySession from "@/components/StudySession";
import HelpCenter from "@/components/HelpCenter";
import type { CardData } from "@/components/CardFace";

interface HardCard extends CardData {
  lastRating: string;
  deck?: { name: string };
}

type Filter = "all" | "flagged" | "hard";

export default function HardPage() {
  const [cards, setCards] = useState<HardCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [studying, setStudying] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  function load() {
    setLoading(true);
    fetch("/api/cards?hard=1")
      .then((r) => r.json())
      .then((d) => { setCards(Array.isArray(d) ? d : []); setLoading(false); });
  }
  useEffect(load, []);

  async function unflag(id: string) {
    await fetch("/api/cards", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, flagged: false }),
    });
    setCards((c) => c.filter((x) => x.id !== id));
  }

  // A card is here for one of two reasons — it was flagged by hand, or the app
  // marked it hard (last rated Hard, or a repeat-failure "leech"). The filter
  // lets the user look at each group on its own.
  const isHard = (c: HardCard) => c.lastRating === "hard" || c.isLeech;
  const counts = useMemo(() => ({
    all: cards.length,
    flagged: cards.filter((c) => c.flagged).length,
    hard: cards.filter(isHard).length,
  }), [cards]);
  const filtered = cards.filter((c) =>
    filter === "flagged" ? c.flagged : filter === "hard" ? isHard(c) : true
  );

  if (studying) {
    return (
      <div>
        <button onClick={() => { setStudying(false); load(); }} className="btn btn-ghost mb-4 text-sm">← Done</button>
        <StudySession mode="hard" title="Drilling your hard cards" />
      </div>
    );
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: `All (${counts.all})` },
    { key: "flagged", label: `Flagged (${counts.flagged})` },
    { key: "hard", label: `Hard (${counts.hard})` },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <span className="eyebrow mb-2.5">Focus queue</span>
      <div id="tour-hard" className="flex items-center gap-3 mb-1">
        <span className="grid place-items-center w-11 h-11 rounded-xl text-[var(--color-hard)]" style={{ background: "color-mix(in srgb, var(--color-hard) 13%, transparent)", boxShadow: "inset 0 1px 0 var(--card-highlight), inset 0 0 0 1px color-mix(in srgb, var(--color-hard) 20%, transparent)" }}><Flame size={22} strokeWidth={1.75} /></span>
        <h1 className="font-display text-3xl md:text-4xl tracking-tight">Hard / Flagged</h1>
        <HelpCenter />
      </div>
      <p className="text-[var(--color-muted)] mb-5">
        Two kinds of card gather here: ones <b>you flagged</b> <Flag size={13} className="inline" /> to revisit, and ones the app marked <b className="text-[var(--color-hard)]">hard</b>{" "}because you rated them Hard (or kept failing them). Cards rated &quot;Again&quot; aren&apos;t listed — they come straight back in your normal queue.
      </p>

      {loading ? (
        <div className="grid place-items-center py-20 text-[var(--color-muted)]"><Loader2 className="animate-spin" /></div>
      ) : cards.length === 0 ? (
        <div className="card-surface p-10 text-center">
          <p className="text-[var(--color-muted)]">Nothing here yet. Cards you flag or find tricky will collect here automatically. 🎯</p>
          <Link href="/study" className="btn btn-primary mt-5">Start studying</Link>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4 flex-wrap justify-between">
            <button onClick={() => setStudying(true)} className="btn btn-primary">
              <Play size={18} /> Drill all {cards.length} cards
            </button>
            <div className="flex gap-1.5 flex-wrap">
              {FILTERS.map((f) => (
                <button key={f.key} onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${filter === f.key ? "bg-[var(--color-brand)] text-white border-transparent" : "bg-[var(--color-surface)] border-[var(--color-line)] hover:border-[var(--color-brand)]"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2.5">
            {filtered.map((c) => (
              <div key={c.id} className="card-surface p-4 flex items-start gap-3 fade-up">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.front.replace(/\{\{c\d+::(.*?)(::.*?)?\}\}/g, "[$1]")}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {/* Why this card is here — coloured so the reason reads at a glance. */}
                    {c.flagged && (
                      <span className="chip !text-xs" style={{ background: "color-mix(in srgb, var(--color-hard) 15%, transparent)", color: "var(--color-hard)" }}>
                        <Flag size={11} /> Flagged
                      </span>
                    )}
                    {c.lastRating === "hard" && (
                      <span className="chip !text-xs" style={{ background: "color-mix(in srgb, var(--color-hard) 12%, transparent)", color: "var(--color-hard)" }}>
                        Rated hard
                      </span>
                    )}
                    {c.isLeech && (
                      <span className="chip !text-xs" style={{ background: "var(--color-danger-bg)", color: "var(--color-again)" }}>
                        <Bug size={11} /> Leech
                      </span>
                    )}
                    {c.deck?.name && <span className="text-xs text-[var(--color-muted)]">{c.deck.name}</span>}
                  </div>
                </div>
                {c.flagged && (
                  <button onClick={() => unflag(c.id)} className="text-[var(--color-muted)] hover:text-[var(--color-again)] p-1 shrink-0" title="Remove flag">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
