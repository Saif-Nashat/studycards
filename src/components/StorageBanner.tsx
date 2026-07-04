"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { formatBytes, type StorageUsage } from "@/lib/format";

// App-wide banner that warns when the (free) database is getting full, so you
// can clear out decks before imports start failing. It only appears once you
// cross 80% — below that it stays out of the way.
export default function StorageBanner() {
  const pathname = usePathname();
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (pathname === "/login") return;
    let active = true;
    const load = () =>
      fetch("/api/storage")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (active && d && !d.error) setUsage(d); })
        .catch(() => {});
    load();
    // Re-check every few minutes so it notices a big import without a reload.
    const t = setInterval(load, 5 * 60 * 1000);
    return () => { active = false; clearInterval(t); };
  }, [pathname]);

  if (!usage || pathname === "/login") return null;
  if (usage.level === "ok") return null;
  // A warning can be dismissed for the session; a critical one keeps nagging.
  if (dismissed && usage.level !== "critical") return null;

  const critical = usage.level === "critical";
  const bg = critical ? "#fef2f2" : "#fffbeb";
  const border = critical ? "var(--color-again)" : "var(--color-hard)";
  const fg = critical ? "var(--color-again)" : "#92400e";

  return (
    <div className="px-4 py-2.5 text-sm border-b" style={{ background: bg, borderColor: border }}>
      <div className="mx-auto max-w-6xl flex items-center gap-3">
        <AlertTriangle size={18} style={{ color: border }} className="shrink-0" />
        <p style={{ color: fg }} className="flex-1">
          <b>{critical ? "Your storage share is almost full" : "Your storage share is filling up"}</b> — using{" "}
          <b>{formatBytes(usage.usedBytes)}</b> of your {formatBytes(usage.limitBytes)} ({usage.pct}%).{" "}
          {critical
            ? "New imports will be blocked. Free up space by deleting a deck you don't need."
            : "Consider deleting a large deck soon."}{" "}
          <Link href="/settings#storage" className="underline font-semibold">Manage storage</Link>
        </p>
        {!critical && (
          <button onClick={() => setDismissed(true)} aria-label="Dismiss" style={{ color: fg }} className="shrink-0 hover:opacity-70">
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
