"use client";

import { NotebookPen } from "lucide-react";
import NotebookEditor from "@/components/NotebookEditor";

export default function NotebookPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-1"><NotebookPen size={22} /> Notebook</h1>
      <p className="text-[var(--color-muted)] mb-5">Your personal scratchpad for the whole app. Jot notes here anytime — it&apos;s saved automatically.</p>
      <div className="card-surface p-5 h-[72vh]">
        <NotebookEditor />
      </div>
    </div>
  );
}
