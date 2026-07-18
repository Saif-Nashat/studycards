"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Database, Loader2, Trash2, RefreshCw } from "lucide-react";
import { formatBytes, type StorageUsage } from "@/lib/format";

// How many decks the "Decks by size" list shows before collapsing behind a
// "Show all" toggle — keeps the Settings page short for deck-hoarders.
const DECKS_COLLAPSED = 6;

// A detailed storage view for the Settings page: how full the database is, and
// which decks take the most room, with a one-click delete to free space.
export default function StoragePanel() {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAllDecks, setShowAllDecks] = useState(false);

  // Fetch storage usage, retrying a few times before giving up. The free Neon
  // database auto-suspends when idle, so the first request after launching the
  // app has to wake it — that can be slow or fail once. Retrying with a short
  // backoff lets the panel recover on its own instead of showing an error.
  async function load() {
    setLoading(true);
    const delays = [0, 1500, 3000]; // immediate, then wait for Neon to wake
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt]) await new Promise((r) => setTimeout(r, delays[attempt]));
      const d = await fetch("/api/storage").then((r) => r.json()).catch(() => null);
      if (d && !d.error) { setUsage(d); setLoading(false); return; }
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function deleteDeck(id: string, name: string) {
    if (!confirm(`Delete the deck "${name}" and all its cards? This frees up its storage and can't be undone.`)) return;
    setBusyId(id);
    await fetch("/api/decks", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
    setBusyId(null);
    load();
  }

  const barColor = (lvl: string) =>
    lvl === "critical" ? "var(--color-again)" : lvl === "warn" ? "var(--color-hard)" : "var(--color-good)";
  // Same status colours, but the AA-safe text variant for the small % label
  // (the vivid green fails contrast on the light surface).
  const barTextColor = (lvl: string) =>
    lvl === "critical" ? "var(--color-again)" : lvl === "warn" ? "var(--color-hard)" : "var(--color-good-strong)";

  return (
    <section id="storage" className="card-surface p-6 scroll-mt-24">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold flex items-center gap-2"><Database size={18} className="text-[var(--color-brand)]" /> Your storage share</h2>
        <button onClick={load} className="btn btn-ghost py-1.5 px-2.5 text-sm" title="Refresh"><RefreshCw size={14} /></button>
      </div>
      <p className="text-[var(--color-muted)] text-sm mb-4">
        You have <b className="text-[var(--color-ink)]">{usage?.limitMb ?? 75} MB</b> of storage for your cards.
        Images and audio from imported decks use the most room. If it fills up, delete a deck you no longer need.
      </p>

      {loading && !usage ? (
        <div className="grid place-items-center gap-2 py-8 text-[var(--color-muted)] text-sm">
          <Loader2 className="animate-spin" /> Waking up the database…
        </div>
      ) : !usage ? (
        <div className="text-sm">
          <p className="text-[var(--color-again)] mb-2">Couldn&apos;t read storage usage right now — the database may still be waking up.</p>
          <button onClick={load} disabled={loading} className="btn btn-ghost text-sm">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Try again
          </button>
        </div>
      ) : (
        <>
          {usage.username && (
            <div className="flex items-center gap-2 mb-4">
              <span className="chip">Signed in as {usage.displayName || usage.username}</span>
              <span className="chip" style={usage.role === "trial" ? { background: "var(--color-gold-chip-bg)", color: "var(--color-gold-strong)" } : undefined}>
                {usage.role === "trial" ? "Trial account · 50 MB" : "Member account · 75 MB"}
              </span>
            </div>
          )}
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-sm font-medium">
              {formatBytes(usage.usedBytes)} <span className="text-[var(--color-muted)]">of {formatBytes(usage.limitBytes)} used</span>
            </span>
            <span className="text-sm font-bold" style={{ color: barTextColor(usage.level) }}>{usage.pct}%</span>
          </div>
          <div className="h-3 rounded-full bg-[var(--color-track)] overflow-hidden mb-5">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, usage.pct)}%`, background: barColor(usage.level) }} />
          </div>

          {usage.imageBytes != null && usage.imageBytes > 0 && (
            <div className="flex items-center gap-3 border border-[var(--color-line)] rounded-xl px-3.5 py-2.5 mb-3 bg-[var(--color-tint)]">
              <div className="flex-1 min-w-0">
                <p className="font-medium">Your media library</p>
                <p className="text-xs text-[var(--color-muted)]">{usage.imageCount} unique images &amp; audio clips · ~{formatBytes(usage.imageBytes)} (each file stored once across your decks)</p>
              </div>
            </div>
          )}

          {usage.decks.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No decks yet.</p>
          ) : (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)] mb-2">Decks by size</p>
              {/* Compact two-column grid so long deck collections don't need much scrolling. */}
              <div className="grid sm:grid-cols-2 gap-1.5">
                {(showAllDecks ? usage.decks : usage.decks.slice(0, DECKS_COLLAPSED)).map((d) => (
                  <div key={d.id} className="flex items-center gap-2 border border-[var(--color-line)] rounded-lg px-2.5 py-1.5">
                    <div className="flex-1 min-w-0 leading-tight">
                      <p className="font-medium text-sm truncate" title={d.name}>{d.name}</p>
                      <p className="text-[11px] text-[var(--color-muted)]">{d.cards} card{d.cards === 1 ? "" : "s"} · ~{formatBytes(d.bytes)}</p>
                    </div>
                    <button
                      onClick={() => deleteDeck(d.id, d.name)}
                      disabled={busyId === d.id}
                      className="p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-again)] hover:bg-[var(--color-danger-bg)] transition"
                      title="Delete this deck to free space"
                    >
                      {busyId === d.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                ))}
              </div>
              {usage.decks.length > DECKS_COLLAPSED && (
                <button
                  onClick={() => setShowAllDecks((v) => !v)}
                  className="btn btn-ghost w-full mt-2 py-1.5 text-sm text-[var(--color-muted)]"
                >
                  {showAllDecks
                    ? <><ChevronUp size={15} /> Show fewer</>
                    : <><ChevronDown size={15} /> Show all {usage.decks.length} decks</>}
                </button>
              )}
            </div>
          )}
          <p className="text-[11px] text-[var(--color-muted)] mt-4">
            This measures the content you store (cards + images). Six accounts have 75 MB each and the trial has 50 MB — together they fill the 500 MB database.
          </p>
        </>
      )}
    </section>
  );
}
