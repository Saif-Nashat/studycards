"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Flag, Play, Trash2, Loader2 } from "lucide-react";
import StudySession from "@/components/StudySession";
import type { CardData } from "@/components/CardFace";

interface HardCard extends CardData {
  lastRating: string;
  deck?: { name: string };
}

export default function HardPage() {
  const [cards, setCards] = useState<HardCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [studying, setStudying] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/cards?hard=1")
      .then((r) => r.json())
      .then((d) => { setCards(d); setLoading(false); });
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

  if (studying) {
    return (
      <div>
        <button onClick={() => { setStudying(false); load(); }} className="btn btn-ghost mb-4 text-sm">← Done</button>
        <StudySession mode="hard" title="Drilling your hard cards" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <span className="grid place-items-center w-10 h-10 rounded-xl bg-orange-100 text-orange-500"><Flame size={22} /></span>
        <h1 className="text-2xl font-bold">Hard / Review-later</h1>
      </div>
      <p className="text-[var(--color-muted)] mb-6">
        Cards you rated <b>Again</b> or <b>Hard</b>, plus any you flagged <Flag size={13} className="inline" /> during study.
      </p>

      {loading ? (
        <div className="grid place-items-center py-20 text-[var(--color-muted)]"><Loader2 className="animate-spin" /></div>
      ) : cards.length === 0 ? (
        <div className="card-surface p-10 text-center">
          <p className="text-[var(--color-muted)]">Nothing here yet. Cards you find tricky will collect here automatically. 🎯</p>
          <Link href="/study" className="btn btn-primary mt-5">Start studying</Link>
        </div>
      ) : (
        <>
          <button onClick={() => setStudying(true)} className="btn btn-primary mb-5">
            <Play size={18} /> Drill these {cards.length} cards
          </button>
          <div className="space-y-2.5">
            {cards.map((c) => (
              <div key={c.id} className="card-surface p-4 flex items-start gap-3 fade-up">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.front.replace(/\{\{c\d+::(.*?)(::.*?)?\}\}/g, "[$1]")}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-muted)]">
                    {c.deck?.name && <span className="chip">{c.deck.name}</span>}
                    {c.lastRating && <span>last: {c.lastRating}</span>}
                    {c.flagged && <span className="text-[var(--color-hard)] flex items-center gap-1"><Flag size={11} /> flagged</span>}
                  </div>
                </div>
                {c.flagged && (
                  <button onClick={() => unflag(c.id)} className="text-[var(--color-muted)] hover:text-[var(--color-again)] p-1" title="Remove flag">
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
