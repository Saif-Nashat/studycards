"use client";

import Link from "next/link";
import { Settings, LifeBuoy, Package, Phone, GraduationCap, PlayCircle } from "lucide-react";
import StoragePanel from "@/components/StoragePanel";
import ResetProgressPanel from "@/components/ResetProgressPanel";
import { OPEN_TUTORIAL_EVENT } from "@/components/Tutorial";

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <span className="eyebrow mb-2.5">Control room</span>
        <h1 className="font-display text-3xl md:text-4xl flex items-center gap-2.5 tracking-tight"><Settings size={26} strokeWidth={1.75} className="text-[var(--color-brand)]" /> Settings &amp; help</h1>
      </div>

      {/* Tutorial */}
      <section className="card-surface p-6">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1"><GraduationCap size={18} className="text-[var(--color-brand)]" /> How to use MediCards</h2>
        <p className="text-[var(--color-muted)] text-sm mb-4">
          New here, or want a refresher? Replay the guided tour of every feature — from studying and building tests to importing your own material.
        </p>
        <button onClick={() => window.dispatchEvent(new Event(OPEN_TUTORIAL_EVENT))} className="btn btn-primary text-sm">
          <PlayCircle size={16} /> Show me the tutorial
        </button>
      </section>

      {/* Storage */}
      <StoragePanel />

      {/* Free decks */}
      <section className="card-surface p-6">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1"><Package size={18} className="text-[var(--color-brand)]" /> Free USMLE / OB-GYN decks</h2>
        <p className="text-[var(--color-muted)] text-sm">
          Get free community Anki decks from{" "}
          <a href="https://ankiweb.net/shared/decks" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--color-brand)] hover:underline">ankiweb.net/shared</a> — search
          for <a href="https://ankiweb.net/shared/decks?search=anking" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--color-brand)] hover:underline">AnKing</a>,{" "}
          <a href="https://ankiweb.net/shared/decks?search=zanki" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--color-brand)] hover:underline">Zanki</a>, or{" "}
          <a href="https://ankiweb.net/shared/decks?search=lightyear" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--color-brand)] hover:underline">Lightyear</a> (Step 1 &amp; 2).
          Download the <code>.apkg</code> file and load it on the <Link href="/import" className="font-semibold text-[var(--color-brand)] hover:underline">Import → Anki deck</Link> tab.
          These are free and community-made, so double-check facts as you study.
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
