"use client";

import { useEffect, useState } from "react";
import { Eraser, AlertTriangle, Loader2, Check } from "lucide-react";

// A self-serve "start this trial account fresh" control. It only appears on the
// shared TRIAL account: whoever is trying the app can wipe it back to the clean
// starter pack in one click, so the next person doesn't inherit their decks,
// notes and progress. Members never see this — it's gated on role.
export default function TrialResetPanel() {
  const [isTrial, setIsTrial] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => setIsTrial(d?.role === "trial")).catch(() => {});
  }, []);

  if (!isTrial) return null;

  async function reset() {
    setBusy(true);
    const res = await fetch("/api/trial-reset", { method: "POST" }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    setConfirming(false);
    if (res?.ok) setDone(true);
  }

  return (
    <section className="card-surface p-6" style={{ borderColor: "var(--color-hard)" }}>
      <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
        <Eraser size={18} className="text-[var(--color-hard)]" /> Start this trial fresh
      </h2>
      <p className="text-[var(--color-muted)] text-sm mb-4">
        This is the shared <b className="text-[var(--color-ink)]">trial account</b>. Wipe everything back to the
        starter pack — <b className="text-[var(--color-ink)]">all decks, imported cards, notes and progress here are deleted</b> —
        so the next person trying MediCards begins clean. This can&apos;t be undone.
      </p>

      {done ? (
        <div className="rounded-xl border border-[var(--color-brand)] bg-[var(--color-tint)] p-4 text-sm">
          <p className="flex items-center gap-2 text-[var(--color-brand)] font-semibold mb-2">
            <Check size={18} /> Trial account reset to the starter pack.
          </p>
          <button onClick={() => window.location.reload()} className="btn btn-primary text-sm">Reload the app</button>
        </div>
      ) : confirming ? (
        <div className="rounded-xl border border-[var(--color-hard)] bg-[var(--color-danger-bg)] p-4 fade-up">
          <p className="flex items-center gap-2 font-semibold text-[var(--color-again)] mb-3">
            <AlertTriangle size={18} /> Delete everything on the trial account and restore the starter pack?
          </p>
          <div className="flex gap-2">
            <button onClick={reset} disabled={busy} className="btn btn-primary text-sm">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Eraser size={16} />} Yes, wipe and start fresh
            </button>
            <button onClick={() => setConfirming(false)} disabled={busy} className="btn btn-ghost text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)} className="btn btn-ghost text-sm text-[var(--color-again)] border-[var(--color-line)] hover:bg-[var(--color-danger-bg)]">
          <Eraser size={16} /> Reset the trial account
        </button>
      )}
    </section>
  );
}
