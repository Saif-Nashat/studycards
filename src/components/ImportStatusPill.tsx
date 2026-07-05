"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Loader2, Package, X } from "lucide-react";
import { useImportState, dismissImport } from "@/lib/importManager";

// Floating status for a deck import that keeps running while the user browses
// other pages (the import itself lives in src/lib/importManager.ts). Hidden on
// the Import page, which shows the full progress UI inline. Mounted once,
// globally, from the root layout.

export default function ImportStatusPill() {
  const state = useImportState();
  const pathname = usePathname();

  // A finished import shouldn't linger forever if the user ignores it.
  useEffect(() => {
    if (state.status !== "done") return;
    const t = setTimeout(dismissImport, 12_000);
    return () => clearTimeout(t);
  }, [state.status]);

  const hidden = pathname === "/import" || pathname === "/login" || state.status === "idle";

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-4 right-4 z-[60] max-w-[min(24rem,calc(100vw-2rem))]"
        >
          <div className="card-surface p-3.5 pr-4 text-sm flex items-center gap-3 shadow-lg">
            {state.status === "running" && (
              <>
                <Loader2 size={18} className="animate-spin text-[var(--color-brand)] shrink-0" />
                <Link href="/import" className="min-w-0">
                  <span className="font-medium block truncate">Importing &quot;{state.deckName}&quot;…</span>
                  <span className="text-[var(--color-muted)] text-xs">
                    {state.progress?.phase === "cards"
                      ? `${state.progress.done.toLocaleString()} / ${state.progress.total.toLocaleString()} cards — keep this tab open`
                      : "Reading deck — keep this tab open"}
                  </span>
                </Link>
              </>
            )}
            {state.status === "done" && (
              <>
                <CheckCircle2 size={18} className="text-[var(--color-brand)] shrink-0" />
                <span className="min-w-0">
                  <span className="font-medium block truncate">Imported {state.result.added.toLocaleString()} cards into &quot;{state.result.deckName}&quot;</span>
                  {state.result.skipped > 0 && (
                    <span className="text-[var(--color-muted)] text-xs">{state.result.skipped.toLocaleString()} empty or duplicate cards skipped</span>
                  )}
                </span>
                <button onClick={dismissImport} className="text-[var(--color-muted)] hover:text-[var(--color-ink)] shrink-0" title="Dismiss"><X size={16} /></button>
              </>
            )}
            {state.status === "error" && (
              <>
                <Package size={18} className="text-[var(--color-again)] shrink-0" />
                <span className="min-w-0 text-[var(--color-again)]">
                  <span className="font-medium block">Deck import stopped</span>
                  <span className="text-xs block">
                    {state.addedSoFar > 0 ? `Imported ${state.addedSoFar.toLocaleString()} cards first — ` : ""}
                    <Link href="/import" className="underline">see details</Link>
                  </span>
                </span>
                <button onClick={dismissImport} className="text-[var(--color-muted)] hover:text-[var(--color-ink)] shrink-0" title="Dismiss"><X size={16} /></button>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
