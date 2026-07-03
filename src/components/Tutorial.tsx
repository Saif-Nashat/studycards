"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, ArrowRight, ArrowLeft, Check, GraduationCap,
  Home, BookOpen, FlaskConical, Flame, BarChart3, Trophy, NotebookPen, Upload, Settings, Sparkles, Lightbulb,
} from "lucide-react";

// A first-login walkthrough of the whole app. It opens automatically the first
// time (tracked in localStorage) and can be re-opened any time from Settings by
// dispatching the `studycards:open-tutorial` window event. Mounted once, globally,
// from the root layout.

const SEEN_KEY = "sc_tutorial_seen";
export const OPEN_TUTORIAL_EVENT = "studycards:open-tutorial";

interface Step {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    icon: GraduationCap,
    title: "Welcome to StudyCards 👋",
    body: (
      <>
        <p>StudyCards helps you learn and <b>remember</b> using <b>spaced repetition</b> — it shows each card again right before you&apos;d forget it, so facts actually stick.</p>
        <p className="mt-2">This quick tour walks through everything. It takes about a minute — you can skip it anytime and reopen it later from <b>Settings</b>.</p>
      </>
    ),
  },
  {
    icon: Home,
    title: "Your home dashboard",
    body: (
      <>
        <p>The <b>Home</b> page is your starting point. At a glance you&apos;ll see how many cards are <b>due</b> today, your <b>decks</b>, and shortcuts to jump straight into studying.</p>
        <p className="mt-2">Further down, <b>Study by topic</b> lets you drill a single subject across all your decks.</p>
      </>
    ),
  },
  {
    icon: BookOpen,
    title: "Studying cards",
    body: (
      <>
        <p>Press <b>Show answer</b> (or the space bar), then rate how it went:</p>
        <ul className="mt-2 space-y-1 text-sm">
          <li><span className="font-semibold text-[var(--color-again)]">Again</span> — you forgot; you&apos;ll see it again soon.</li>
          <li><span className="font-semibold text-[var(--color-hard)]">Hard</span> — you struggled; shorter gap.</li>
          <li><span className="font-semibold text-[var(--color-good)]">Good</span> — you knew it; normal gap.</li>
          <li><span className="font-semibold text-[var(--color-easy)]">Easy</span> — too easy; longer gap.</li>
        </ul>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Shortcuts: <b>Space</b> reveals, <b>1–4</b> rate, <b>F</b> flags a card to revisit.</p>
      </>
    ),
  },
  {
    icon: FlaskConical,
    title: "Build a custom test",
    body: (
      <>
        <p>On the <b>Study</b> page you can create a focused session: pick <b>subjects</b>, choose which cards (new, unanswered, flagged…), and how many.</p>
        <p className="mt-2">Add a <b>timer</b> (stopwatch or Pomodoro focus/break cycles) and a <b>goal</b> (a number of cards or minutes) — hit it and you get a little celebration. 🎯</p>
      </>
    ),
  },
  {
    icon: Flame,
    title: "Hard cards collect automatically",
    body: (
      <>
        <p>Any card you rate <b>Again</b> or <b>Hard</b>, or <b>flag</b> during study, gathers on the <b>Hard cards</b> page.</p>
        <p className="mt-2">It&apos;s your personal &ldquo;revisit these&rdquo; pile — drill them in one go whenever you want.</p>
      </>
    ),
  },
  {
    icon: BarChart3,
    title: "Track your progress",
    body: (
      <>
        <p><b>Insights</b> shows your day streak, cards reviewed, all-time accuracy, a daily activity chart, and your <b>weakest topics</b> so you know where to focus.</p>
      </>
    ),
  },
  {
    icon: Trophy,
    title: "Earn trophies",
    body: (
      <>
        <p>The <b>Trophies</b> page rewards you as you study — for streaks, totals, mastering cards, and more.</p>
        <p className="mt-2">There&apos;s always a next one to chase. Keeping a <b>daily streak</b> is the fastest way to collect them. 🏆</p>
      </>
    ),
  },
  {
    icon: NotebookPen,
    title: "Your notebook",
    body: (
      <>
        <p>A personal scratchpad for the whole app — jot summaries, mnemonics, and reminders. It saves automatically.</p>
        <p className="mt-2">Format your notes with headings, lists, <b>text colour</b>, <b>highlighting</b> and text size. You can open it right inside a study session too.</p>
      </>
    ),
  },
  {
    icon: Upload,
    title: "Import — from any material",
    body: (
      <>
        <p>Three easy ways to add cards:</p>
        <ul className="mt-2 space-y-1 text-sm">
          <li>• <b>Anki decks (.apkg)</b> — download free community decks (e.g. AnKing, Zanki on ankiweb.net), images and all.</li>
          <li>• <b>CSV or JSON</b> — paste or upload your own.</li>
          <li>• <b>claude.ai prompt</b> — on the Settings page, copy the ready-made prompt, paste your material into claude.ai, and bring the result back here.</li>
        </ul>
        <div className="mt-3 flex gap-2 rounded-xl bg-[var(--color-tint)] p-3 text-sm">
          <Lightbulb size={18} className="text-[var(--color-gold)] shrink-0 mt-0.5" />
          <span>
            <b>Use whatever material you like.</b> Turn your <b>university slides</b>, textbooks or lecture notes into cards — and get creative:
            it doesn&apos;t have to be medicine. Learn a <b>language</b>, history, law, coding… anything that fits on a flashcard works here.
          </span>
        </div>
      </>
    ),
  },
  {
    icon: Settings,
    title: "Settings & support",
    body: (
      <>
        <p>In <b>Settings</b> you can check your database storage, get the claude.ai card-making prompt, and <b>reset your progress</b> for a fresh start (your decks and cards are always kept).</p>
        <p className="mt-2">Need help? Customer support is one tap away, and you can <b>replay this tutorial</b> from here anytime.</p>
      </>
    ),
  },
];

export default function Tutorial() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const close = useCallback((markSeen: boolean) => {
    if (markSeen) { try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ } }
    setOpen(false);
  }, []);

  // Auto-open on first ever visit (once localStorage says otherwise, never again).
  useEffect(() => {
    if (pathname === "/login") return;
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === "1"; } catch { seen = true; }
    // Opening here (post-mount) rather than during render is deliberate: the
    // server renders the tour closed, so deciding from localStorage must wait
    // until after hydration to avoid a mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen) { setStep(0); setOpen(true); }
  }, [pathname]);

  // Re-open on demand (from the Settings button).
  useEffect(() => {
    function onOpen() { setStep(0); setOpen(true); }
    window.addEventListener(OPEN_TUTORIAL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TUTORIAL_EVENT, onOpen);
  }, []);

  // Keyboard navigation while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(true);
      else if (e.key === "ArrowRight") setStep((s) => Math.min(STEPS.length - 1, s + 1));
      else if (e.key === "ArrowLeft") setStep((s) => Math.max(0, s - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (pathname === "/login") return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Icon = s?.icon ?? GraduationCap;

  return (
    <AnimatePresence>
      {open && s && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] grid place-items-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => close(true)}
        >
          <motion.div
            initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="card-surface gradient-ring w-full max-w-lg p-6 md:p-7 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => close(true)} className="absolute top-4 right-4 text-[var(--color-muted)] hover:text-[var(--color-ink)]" title="Close tutorial"><X size={20} /></button>

            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-muted)] mb-4">
              <Sparkles size={14} className="text-[var(--color-brand)]" /> QUICK TOUR · {step + 1} of {STEPS.length}
            </div>

            <div className="flex items-start gap-4">
              <span className="logo-badge grid place-items-center w-12 h-12 rounded-2xl text-white shrink-0"><Icon size={24} /></span>
              <div className="min-w-0">
                <h2 className="text-xl font-bold leading-tight">{s.title}</h2>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="mt-4 text-[var(--color-ink)]/90 leading-relaxed min-h-[9.5rem]"
              >
                {s.body}
              </motion.div>
            </AnimatePresence>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 my-5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  aria-label={`Go to step ${i + 1}`}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === step ? 22 : 7,
                    background: i === step ? "var(--color-brand)" : "var(--color-line)",
                  }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              {step > 0 ? (
                <button onClick={() => setStep((v) => v - 1)} className="btn btn-ghost text-sm"><ArrowLeft size={16} /> Back</button>
              ) : (
                <button onClick={() => close(true)} className="btn btn-ghost text-sm text-[var(--color-muted)]">Skip tour</button>
              )}

              {isLast ? (
                <button onClick={() => close(true)} className="btn btn-primary"><Check size={16} /> Get started</button>
              ) : (
                <button onClick={() => setStep((v) => v + 1)} className="btn btn-primary">Next <ArrowRight size={16} /></button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
