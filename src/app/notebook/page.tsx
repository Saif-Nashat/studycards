"use client";

import { NotebookPen } from "lucide-react";
import NotebookEditor from "@/components/NotebookEditor";

export default function NotebookPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <span className="eyebrow mb-2.5">Scratchpad</span>
      <h1 className="font-display text-3xl md:text-4xl flex items-center gap-2.5 mb-1 tracking-tight"><NotebookPen size={26} strokeWidth={1.75} className="text-[var(--color-brand)]" /> Notebook</h1>
      <p className="text-[var(--color-muted)] mb-5 mt-1">Your personal scratchpad for the whole app. Jot notes here anytime — it&apos;s saved automatically.</p>
      <div id="tour-notebook" className="card-surface p-5 h-[72vh]">
        <NotebookEditor />
      </div>
    </div>
  );
}
