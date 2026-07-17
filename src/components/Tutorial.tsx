"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, ArrowRight, ArrowLeft, Check, GraduationCap, Sparkles,
  BookOpen, FlaskConical, BarChart3, NotebookPen, Upload, Smartphone, Flag,
} from "lucide-react";

// A lightweight, static welcome walkthrough. Deliberately NOT the old cross-page
// spotlight tour: that navigated between real pages, tracked live DOM geometry,
// and painted a full-screen box-shadow dim layer that repainted on every scroll
// — which was the phone jank. This version is a single centered modal that fades
// between self-contained steps. No navigation, no scroll-following, no spotlight,
// no backdrop blur — so it stays smooth on low-end devices and never breaks when
// the underlying UI moves.
//
// Opens automatically on first ever visit (tracked in localStorage) and can be
// replayed from Settings via the `medicards:open-tutorial` window event. Mounted
// once, globally, from the root layout.

const SEEN_KEY = "sc_tutorial_seen";
export const OPEN_TUTORIAL_EVENT = "medicards:open-tutorial";

interface Step {
  icon: React.ComponentType<{ size?: number }>;
  color: string;
  title: string;
  body: React.ReactNode;
  visual?: React.ReactNode; // optional small inline illustration (cheap, pure CSS)
}

// A cheap inline demo of the four rating buttons — no images, just chips.
function RatingDemo() {
  const rows: [string, string][] = [
    ["Again", "var(--color-again)"],
    ["Hard", "var(--color-hard)"],
    ["Good", "var(--color-good)"],
    ["Easy", "var(--color-easy)"],
  ];
  return (
    <div className="grid grid-cols-4 gap-1.5 mt-1">
      {rows.map(([label, color], i) => (
        <div key={label} className="rounded-lg py-2 text-center text-white text-xs font-bold" style={{ background: color }}>
          {label}
          <span className="block text-[10px] font-medium opacity-90">{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

const STEPS: Step[] = [
  {
    icon: GraduationCap,
    color: "var(--color-brand)",
    title: "Welcome to MediCards 👋",
    body: (
      <p>MediCards helps you <b>remember</b> with <b>spaced repetition</b> — each card comes back right before you&apos;d forget it, so facts actually stick. Here&apos;s a 60-second tour. You can skip anytime and replay it later from <b>Settings</b>.</p>
    ),
  },
  {
    icon: BookOpen,
    color: "var(--color-brand)",
    title: "One tap starts your day",
    body: (
      <p>Your home screen shows what&apos;s <b>due</b>, what&apos;s <b>new</b>, and your <b>day streak</b> 🔥. The big <b>“Study all due”</b> button reviews everything waiting in one tap — most days it&apos;s the only button you need.</p>
    ),
  },
  {
    icon: Sparkles,
    color: "var(--color-good)",
    title: "Rate honestly — cards find their rhythm",
    body: (
      <p>In a session, <b>tap the card</b> to reveal the answer (or press <b>Space</b> on a keyboard), then <b>tap a rating button</b> (or press keys <b>1–4</b>). <b>Rate honestly and each card finds its own rhythm</b> — easy cards fade far into the future, hard ones come back soon until they stick.</p>
    ),
    visual: <RatingDemo />,
  },
  {
    icon: Flag,
    color: "var(--color-hard)",
    title: "Hard & flagged cards",
    body: (
      <p>Press <b>F</b> to <b>flag</b> a card you want to revisit. Cards you rate <b>Hard</b> (or keep failing) are collected automatically. Both live in the <b>Hard / Flagged</b> tab, where you can drill just the tricky ones.</p>
    ),
  },
  {
    icon: FlaskConical,
    color: "var(--color-accent)",
    title: "Build a custom study session",
    body: (
      <p>The <b>Study</b> page lets you pick your <b>decks</b> and which cards to include, set how many, and add an optional <b>timer</b> or pomodoro. Leave home mid-session? A <b>Resume</b> banner brings you right back where you left off.</p>
    ),
  },
  {
    icon: BarChart3,
    color: "var(--color-teal)",
    title: "Track your progress",
    body: (
      <p><b>Insights</b> shows your <b>streak</b>, accuracy, recent activity, and your <b>weakest decks</b> — each with a Drill button. Studying also earns <b>trophies</b> 🏆; a daily streak is the fastest way to collect them.</p>
    ),
  },
  {
    icon: NotebookPen,
    color: "var(--color-gold)",
    title: "Your notebook",
    body: (
      <p>A personal scratchpad that <b>saves automatically</b> — summaries, mnemonics, reminders. It also slides out <b>inside study sessions</b> (the 📓 icon) so you can jot a note without losing your place.</p>
    ),
  },
  {
    icon: Upload,
    color: "var(--color-brand)",
    title: "Bring in cards — any subject",
    body: (
      <p>Go to the <b>Import</b> page. There are two ways to add cards:</p>
    ),
    visual: (
      <div className="mt-2 space-y-2 text-sm">
        <div className="rounded-lg p-2.5 bg-[color-mix(in_srgb,var(--color-brand)_10%,transparent)] border border-[var(--color-hairline)]">
          <b>1. Make your own with AI.</b> Copy the ready-made <b>claude.ai</b> prompt on the Import page, paste in any slides, notes or book chapter, and it writes the cards for you. Then paste them back in.
        </div>
        <div className="rounded-lg p-2.5 bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] border border-[var(--color-hairline)]">
          <b>2. Upload an Anki deck.</b> Already have a <b>.apkg</b> file? Upload it — images and audio come across too.
        </div>
        <p className="text-[var(--color-muted)]">You can edit or add cards by hand anytime under <b>Browse</b>.</p>
      </div>
    ),
  },
  {
    icon: Smartphone,
    color: "var(--color-accent)",
    title: "Install it like an app",
    body: (
      <p>Add MediCards to your phone or tablet home screen for a full-screen, one-tap app. On <b>iPhone/iPad</b>: Safari → <b>Share</b> → <b>Add to Home Screen</b>. On <b>Android</b>: the browser menu → <b>Install app</b>.</p>
    ),
  },
  {
    icon: Check,
    color: "var(--color-good)",
    title: "You're all set 🎉",
    body: (
      <p>That&apos;s the tour. The golden rule: <b>a little every day beats a lot once a week</b>. You can replay this anytime from <b>Settings</b> — now go study your first cards!</p>
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

  // Auto-open once on first ever visit (never on the login screen). Guarded so
  // ordinary navigation between pages can't reopen it. Reading localStorage must
  // wait until after mount to avoid a hydration mismatch.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (pathname === "/login" || autoOpened.current) return;
    autoOpened.current = true;
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === "1"; } catch { seen = true; }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen) { setStep(0); setOpen(true); }
  }, [pathname]);

  // Replay from Settings.
  useEffect(() => {
    function onOpen() { setStep(0); setOpen(true); }
    window.addEventListener(OPEN_TUTORIAL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TUTORIAL_EVENT, onOpen);
  }, []);

  // Lock background scroll while open (no scroll → nothing to repaint behind us).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const go = useCallback((next: number) => {
    setStep((s) => Math.max(0, Math.min(STEPS.length - 1, next === -1 ? s : next)));
  }, []);

  // Keyboard navigation.
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
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;
  const Icon = s.icon;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[70] grid place-items-center p-4"
          style={{ background: "rgba(2, 12, 6, 0.62)" }}
          aria-modal="true" role="dialog"
          onClick={() => close(true)}
        >
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="card-surface gradient-ring p-6 md:p-7 relative"
            >
              <button onClick={() => close(true)} className="absolute top-3.5 right-3.5 text-[var(--color-muted)] hover:text-[var(--color-ink)]" title="Close tour"><X size={18} /></button>

              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-[var(--color-muted)] mb-3">
                <Sparkles size={13} className="text-[var(--color-brand)]" /> GUIDED TOUR · {step + 1} / {STEPS.length}
              </div>

              <span
                className="grid place-items-center w-12 h-12 rounded-2xl mb-3.5"
                style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 14%, transparent)`, boxShadow: `inset 0 1px 0 var(--card-highlight), inset 0 0 0 1px color-mix(in srgb, ${s.color} 20%, transparent)` }}
              >
                <Icon size={24} />
              </span>

              <h2 className="text-xl font-bold leading-tight mb-2">{s.title}</h2>

              <div className="text-sm text-[var(--color-ink)]/90 leading-relaxed max-h-[42vh] overflow-y-auto">
                {s.body}
                {s.visual}
              </div>

              {/* Progress dots */}
              <div className="flex items-center justify-center gap-1 my-4 flex-wrap">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => go(i)}
                    aria-label={`Go to step ${i + 1}`}
                    className="h-1.5 rounded-full transition-all"
                    style={{ width: i === step ? 20 : 6, background: i === step ? "var(--color-brand)" : "var(--color-line)" }}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-2">
                {!isFirst ? (
                  <button onClick={() => go(step - 1)} className="btn btn-ghost text-sm py-2"><ArrowLeft size={15} /> Back</button>
                ) : (
                  <button onClick={() => close(true)} className="btn btn-ghost text-sm py-2 text-[var(--color-muted)]">Skip tour</button>
                )}

                {isLast ? (
                  <button onClick={() => close(true)} className="btn btn-primary py-2"><Check size={15} /> Start studying</button>
                ) : (
                  <button onClick={() => go(step + 1)} className="btn btn-primary py-2">Next <ArrowRight size={15} /></button>
                )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
