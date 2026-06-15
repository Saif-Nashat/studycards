"use client";

import { useEffect, useState } from "react";
import { Database, Loader2, Trash2, RefreshCw } from "lucide-react";
import { formatBytes, type StorageUsage } from "@/lib/format";

// A detailed storage view for the Settings page: how full the database is, and
// which decks take the most room, with a one-click delete to free space.
export default function StoragePanel() {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const d = await fetch("/api/storage").then((r) => r.json()).catch(() => null);
    if (d && !d.error) setUsage(d);
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

  return (
    <section id="storage" className="card-surface p-6 scroll-mt-24">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold flex items-center gap-2"><Database size={18} className="text-[var(--color-brand)]" /> Database storage</h2>
        <button onClick={load} className="btn btn-ghost py-1.5 px-2.5 text-sm" title="Refresh"><RefreshCw size={14} /></button>
      </div>
      <p className="text-[var(--color-muted)] text-sm mb-4">
        Your cards, images and progress live in a free online database (Neon, ~{usage?.limitMb ?? 500} MB).
        Images from imported decks use the most space. If it fills up, delete a deck you no longer need.
      </p>

      {loading && !usage ? (
        <div className="grid place-items-center py-8 text-[var(--color-muted)]"><Loader2 className="animate-spin" /></div>
      ) : !usage ? (
        <p className="text-sm text-[var(--color-again)]">Couldn&apos;t read storage usage right now.</p>
      ) : (
        <>
          <div className="flex items-end justify-between mb-1.5">
            <span className="text-sm font-medium">
              {formatBytes(usage.usedBytes)} <span className="text-[var(--color-muted)]">of {formatBytes(usage.limitBytes)} used</span>
            </span>
            <span className="text-sm font-bold" style={{ color: barColor(usage.level) }}>{usage.pct}%</span>
          </div>
          <div className="h-3 rounded-full bg-[#eef0f7] overflow-hidden mb-5">
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, usage.pct)}%`, background: barColor(usage.level) }} />
          </div>

          {usage.imageBytes != null && usage.imageBytes > 0 && (
            <div className="flex items-center gap-3 border border-[var(--color-line)] rounded-xl px-3.5 py-2.5 mb-3 bg-[#f3f6ff]/50">
              <div className="flex-1 min-w-0">
                <p className="font-medium">Shared image library</p>
                <p className="text-xs text-[var(--color-muted)]">{usage.imageCount} unique images · ~{formatBytes(usage.imageBytes)} (de-duplicated across all decks)</p>
              </div>
            </div>
          )}

          {usage.decks.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No decks yet.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Decks by size</p>
              {usage.decks.map((d) => (
                <div key={d.id} className="flex items-center gap-3 border border-[var(--color-line)] rounded-xl px-3.5 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{d.name}</p>
                    <p className="text-xs text-[var(--color-muted)]">{d.cards} card{d.cards === 1 ? "" : "s"} · ~{formatBytes(d.bytes)}</p>
                  </div>
                  <button
                    onClick={() => deleteDeck(d.id, d.name)}
                    disabled={busyId === d.id}
                    className="btn btn-ghost py-1.5 px-2.5 text-sm text-[var(--color-again)] hover:bg-[#fef2f2]"
                    title="Delete this deck to free space"
                  >
                    {busyId === d.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-[var(--color-muted)] mt-4">
            This is an estimate of your data. The exact billed figure is in your Neon dashboard.
          </p>
        </>
      )}
    </section>
  );
}
