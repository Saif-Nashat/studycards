"use client";

import { useState } from "react";
import { Settings, Copy, Check, LifeBuoy, Sparkles, Package, Phone, GraduationCap, PlayCircle } from "lucide-react";
import { CLAUDE_PROMPT } from "@/lib/prompt";
import StoragePanel from "@/components/StoragePanel";
import ResetProgressPanel from "@/components/ResetProgressPanel";
import { OPEN_TUTORIAL_EVENT } from "@/components/Tutorial";

export default function SettingsPage() {
  const [copied, setCopied] = useState(false);

  function copyPrompt() {
    navigator.clipboard.writeText(CLAUDE_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Settings size={22} /> Settings &amp; help</h1>

      {/* Tutorial */}
      <section className="card-surface p-6">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1"><GraduationCap size={18} className="text-[var(--color-brand)]" /> How to use StudyCards</h2>
        <p className="text-[var(--color-muted)] text-sm mb-4">
          New here, or want a refresher? Replay the guided tour of every feature — from studying and building tests to importing your own material.
        </p>
        <button onClick={() => window.dispatchEvent(new Event(OPEN_TUTORIAL_EVENT))} className="btn btn-primary text-sm">
          <PlayCircle size={16} /> Show me the tutorial
        </button>
      </section>

      {/* Storage */}
      <StoragePanel />

      {/* Prompt */}
      <section className="card-surface p-6">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1"><Sparkles size={18} className="text-[var(--color-brand)]" /> Make cards on claude.ai</h2>
        <p className="text-[var(--color-muted)] text-sm mb-4">
          1. Click copy below. 2. Go to <b>claude.ai</b> and paste it. 3. Replace the last line with text copied from your MRCOG PDF.
          4. Claude replies with a JSON block — copy it. 5. Paste it into the <b>Import</b> page here.
        </p>
        <div className="relative">
          <pre className="bg-[#0f172a] text-[#e2e8f0] rounded-xl p-4 text-xs overflow-x-auto max-h-72 whitespace-pre-wrap">{CLAUDE_PROMPT}</pre>
          <button onClick={copyPrompt} className="btn btn-primary absolute top-3 right-3 py-1.5 px-3 text-sm">
            {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
          </button>
        </div>
      </section>

      {/* Free decks */}
      <section className="card-surface p-6">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1"><Package size={18} className="text-[var(--color-brand)]" /> Free USMLE / OB-GYN decks</h2>
        <p className="text-[var(--color-muted)] text-sm">
          Get free community Anki decks from <b>ankiweb.net/shared</b> — search for <b>AnKing</b>, <b>Zanki</b>, or <b>Lightyear</b> (Step 1 &amp; 2).
          Download the <code>.apkg</code> file and load it on the <b>Import → Anki deck</b> tab. These are free and community-made, so double-check facts as you study.
        </p>
      </section>

      {/* Reset progress */}
      <ResetProgressPanel />

      {/* Customer support */}
      <section className="card-surface p-6">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1"><LifeBuoy size={18} className="text-[var(--color-brand)]" /> Customer support &amp; contact</h2>
        <p className="text-[var(--color-muted)] text-sm mb-4">
          Need help, hit a problem, or have a question or suggestion? Get in touch — we&apos;re happy to help you get the most out of your studying.
        </p>
        <a
          href="tel:0792704886"
          className="inline-flex items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-tint)] px-4 py-3 font-semibold hover:border-[var(--color-brand)] transition"
        >
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-[var(--color-chip-bg)] text-[var(--color-brand)]">
            <Phone size={18} />
          </span>
          <span>
            <span className="block text-xs font-normal text-[var(--color-muted)]">Call or text us</span>
            <span className="text-lg tracking-wide">0792704886</span>
          </span>
        </a>
      </section>
    </div>
  );
}
