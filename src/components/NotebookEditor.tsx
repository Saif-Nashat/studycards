"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, NotebookPen } from "lucide-react";

// A self-contained editor for the app-wide notebook. Loads on mount, autosaves
// (debounced) as you type. Used full-screen on /notebook and inside the study drawer.
export default function NotebookEditor({ compact = false }: { compact?: boolean }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/notebook").then((r) => r.json()).then((d) => { setContent(d.content || ""); setLoading(false); });
  }, []);

  function onChange(v: string) {
    setContent(v);
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await fetch("/api/notebook", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: v }) }).catch(() => {});
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    }, 700);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-[var(--color-muted)] flex items-center gap-1.5"><NotebookPen size={15} /> Auto-saved to this device&apos;s database</span>
        <span className="text-xs text-[var(--color-muted)] flex items-center gap-1">
          {status === "saving" && <><Loader2 size={12} className="animate-spin" /> Saving…</>}
          {status === "saved" && <><Check size={12} className="text-[var(--color-good)]" /> Saved</>}
        </span>
      </div>
      {loading ? (
        <div className="grid place-items-center py-16 text-[var(--color-muted)]"><Loader2 className="animate-spin" /></div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write anything here — summaries, things to look up, mnemonics, reminders. It stays across all your sessions."
          className={`input font-sans resize-none w-full flex-1 ${compact ? "min-h-[55vh]" : "min-h-[65vh]"} leading-relaxed`}
        />
      )}
    </div>
  );
}
