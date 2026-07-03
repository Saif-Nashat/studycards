"use client";

import { useState } from "react";
import { RotateCcw, AlertTriangle, Check, Loader2, ShieldCheck } from "lucide-react";

// A guarded "reset my study progress" control for the Settings page. It wipes
// review history and spaced-repetition scheduling, but never touches decks or
// cards — so the wording, the two-step confirm, and the success message all
// reassure the user of exactly that.
export default function ResetProgressPanel() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ reviewsCleared: number; cardsReset: number } | null>(null);

  async function reset() {
    setBusy(true);
    const res = await fetch("/api/reset-progress", { method: "POST" }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    setConfirming(false);
    if (res?.ok) setDone({ reviewsCleared: res.reviewsCleared, cardsReset: res.cardsReset });
  }

  return (
    <section className="card-surface p-6">
      <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
        <RotateCcw size={18} className="text-[var(--color-brand)]" /> Reset study progress
      </h2>
      <p className="text-[var(--color-muted)] text-sm mb-4">
        Start fresh: this clears your review history, streaks and insights, and makes every card &ldquo;new&rdquo; again.
        <b className="text-[var(--color-ink)]"> Your decks and cards are never deleted</b> — only your progress is reset.
      </p>

      <div className="flex items-center gap-2 text-sm text-[var(--color-muted)] mb-4">
        <ShieldCheck size={16} className="text-[var(--color-good)]" />
        Decks, cards, images, tags and your manual flags are all kept.
      </div>

      {done ? (
        <div className="rounded-xl border border-[var(--color-brand)] bg-[var(--color-tint)] p-4 text-sm flex items-center gap-2 text-[var(--color-brand)] font-semibold">
          <Check size={18} /> Progress reset — {done.cardsReset} card{done.cardsReset === 1 ? "" : "s"} set back to new
          {done.reviewsCleared > 0 && <> and {done.reviewsCleared} review{done.reviewsCleared === 1 ? "" : "s"} cleared</>}.
        </div>
      ) : confirming ? (
        <div className="rounded-xl border border-[var(--color-hard)] bg-[var(--color-danger-bg)] p-4 fade-up">
          <p className="flex items-center gap-2 font-semibold text-[var(--color-again)] mb-3">
            <AlertTriangle size={18} /> Reset all progress? This can&apos;t be undone.
          </p>
          <div className="flex gap-2">
            <button onClick={reset} disabled={busy} className="btn btn-primary text-sm">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />} Yes, reset my progress
            </button>
            <button onClick={() => setConfirming(false)} disabled={busy} className="btn btn-ghost text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} className="btn btn-ghost text-sm text-[var(--color-again)] border-[var(--color-line)] hover:bg-[var(--color-danger-bg)]">
          <RotateCcw size={16} /> Reset my progress
        </button>
      )}
    </section>
  );
}
