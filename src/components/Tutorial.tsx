"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X, ArrowRight, ArrowLeft, Check, GraduationCap, Sparkles } from "lucide-react";

// An interactive, cross-page walkthrough. Instead of a static slideshow it
// actually navigates to each page, spotlights the real piece of UI it's
// talking about (dimming everything else), and explains what you can do
// there. Opens automatically on first login (tracked in localStorage) and can
// be replayed from Settings via the `studycards:open-tutorial` window event.
// Mounted once, globally, from the root layout.

const SEEN_KEY = "sc_tutorial_seen";
export const OPEN_TUTORIAL_EVENT = "studycards:open-tutorial";

interface Step {
  route: string;            // page this step lives on
  selector?: string;        // element to spotlight; omitted = centered card
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    route: "/",
    title: "Welcome to StudyCards 👋",
    body: (
      <>
        <p>StudyCards helps you learn and <b>remember</b> using <b>spaced repetition</b> — each card comes back right before you&apos;d forget it, so facts actually stick.</p>
        <p className="mt-2">This tour walks you through the app <b>page by page</b>, pointing at the real buttons as we go. Takes ~2 minutes — skip anytime and replay it later from <b>Settings</b>.</p>
      </>
    ),
  },
  {
    route: "/",
    selector: "#tour-stats",
    title: "Your day at a glance",
    body: (
      <p>These four numbers greet you every day: cards <b>due</b> for review, brand-new cards waiting, what you&apos;ve <b>reviewed today</b>, and your hard/flagged pile.</p>
    ),
  },
  {
    route: "/",
    selector: "#tour-study-cta",
    title: "One tap starts your day",
    body: (
      <p>This button studies <b>everything due today</b> across all decks — the fastest way in. Most days, this is the only button you need.</p>
    ),
  },
  {
    route: "/",
    selector: "#tour-decks",
    title: "Your decks",
    body: (
      <p>Every deck shows its due / new / total counts and has its own <b>Study</b> button. Create decks here, or delete ones you&apos;re done with (that also frees their storage).</p>
    ),
  },
  {
    route: "/study",
    selector: "#tour-test-builder",
    title: "Build a custom test",
    body: (
      <>
        <p>The <b>Study</b> page is a test builder: pick <b>subjects</b>, choose which cards (new, unanswered, flagged…), and how many.</p>
        <p className="mt-2">Below, you can add a <b>timer</b> (stopwatch or Pomodoro) and a session <b>goal</b> — hit it and you get a little celebration. 🎯</p>
      </>
    ),
  },
  {
    route: "/study",
    title: "Rating cards — the core habit",
    body: (
      <>
        <p>During study: press <b>Show answer</b> (Space), then rate yourself honestly:</p>
        <ul className="mt-2 space-y-1 text-sm">
          <li><span className="font-semibold text-[var(--color-again)]">Again</span> — forgot; comes back in ~1 minute.</li>
          <li><span className="font-semibold text-[var(--color-hard)]">Hard</span> — struggled; shorter gap next time.</li>
          <li><span className="font-semibold text-[var(--color-good)]">Good</span> — knew it; normal gap.</li>
          <li><span className="font-semibold text-[var(--color-easy)]">Easy</span> — instant recall; much longer gap.</li>
        </ul>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Shortcuts: <b>Space</b> reveals · <b>1–4</b> rate · <b>F</b> flags · <b>← →</b> move around.</p>
      </>
    ),
  },
  {
    route: "/hard",
    selector: "#tour-hard",
    title: "Hard cards collect themselves",
    body: (
      <p>Cards you rate <b>Hard</b> — plus anything you <b>flag</b> — gather here automatically. It&apos;s your personal &ldquo;revisit these&rdquo; pile; drill them all in one go whenever you like.</p>
    ),
  },
  {
    route: "/insights",
    selector: "#tour-insights",
    title: "Watch your progress grow",
    body: (
      <p><b>Insights</b> tracks your day <b>streak</b>, reviews, and all-time accuracy — and further down, your <b>weakest topics</b> with a Drill button for each, so you always know where to focus.</p>
    ),
  },
  {
    route: "/achievements",
    selector: "#tour-trophies",
    title: "Earn trophies",
    body: (
      <p>Studying earns you <b>trophies</b> — for streaks, totals, and mastering cards. There&apos;s always a next one to chase; a daily streak is the fastest way to collect them. 🏆</p>
    ),
  },
  {
    route: "/notebook",
    selector: "#tour-notebook",
    title: "Your notebook",
    body: (
      <p>A personal scratchpad that <b>saves automatically</b> — summaries, mnemonics, reminders. Format with headings, lists, colour and highlights. It also slides out <b>inside study sessions</b> (the 📓 icon).</p>
    ),
  },
  {
    route: "/browse",
    selector: "#tour-browse",
    title: "Browse & edit everything",
    body: (
      <p>Search and filter all your cards, <b>add your own</b>, edit, flag, or delete. The ↔ button creates a <b>reverse copy</b> of a card (answer becomes the question) so you learn facts in both directions.</p>
    ),
  },
  {
    route: "/import",
    selector: "#tour-import",
    title: "Import — from any material",
    body: (
      <>
        <p>Two ways in: paste <b>claude.ai cards</b> (JSON/CSV), or upload a full <b>Anki deck (.apkg)</b> — images included, free community decks like AnKing work great.</p>
        <p className="mt-2">And it&apos;s not just medicine: <b>university slides, notes, books, languages, law, code</b> — if it fits on a flashcard, it works here.</p>
      </>
    ),
  },
  {
    route: "/settings",
    selector: "#tour-prompt",
    title: "The card-making prompt",
    body: (
      <p>Copy this ready-made prompt into <b>claude.ai</b>, paste any study material under it, and you get perfectly formatted cards back — explanations and mnemonics included. Bring the result to the Import page.</p>
    ),
  },
  {
    route: "/settings",
    selector: "#storage",
    title: "Your storage share",
    body: (
      <p>Every account owns a fixed slice of the database, so nobody can eat into your space. This panel shows what&apos;s using room and lets you free space by deleting a deck. You can also <b>replay this tour</b> from Settings anytime.</p>
    ),
  },
  {
    route: "/",
    title: "You're all set 🎉",
    body: (
      <>
        <p>That&apos;s everything. The golden rule of spaced repetition: <b>a little every day beats a lot once a week</b>.</p>
        <p className="mt-2">Go ahead — study your first cards now.</p>
      </>
    ),
  },
];

// Wait for a selector to appear (pages load their data async).
function waitFor(selector: string, timeoutMs = 4000): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) return resolve(el);
      if (Date.now() - t0 > timeoutMs) return resolve(null);
      setTimeout(tick, 120);
    };
    tick();
  });
}

interface Rect { top: number; left: number; width: number; height: number; }
const PAD = 10; // breathing room around the spotlit element

export default function Tutorial() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [settled, setSettled] = useState(false); // target found (or given up) for current step
  const targetRef = useRef<HTMLElement | null>(null);

  const close = useCallback((markSeen: boolean) => {
    if (markSeen) { try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ } }
    setOpen(false);
    setRect(null);
    targetRef.current = null;
  }, []);

  // Auto-open on first ever visit (once localStorage says otherwise, never again).
  useEffect(() => {
    if (pathname === "/login") return;
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === "1"; } catch { seen = true; }
    // Post-mount on purpose: the server renders the tour closed, so reading
    // localStorage must wait until after hydration to avoid a mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen) { setStep(0); setOpen(true); }
  }, [pathname]);

  // Re-open on demand (from the Settings button).
  useEffect(() => {
    function onOpen() { setStep(0); setOpen(true); }
    window.addEventListener(OPEN_TUTORIAL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TUTORIAL_EVENT, onOpen);
  }, []);

  // The heart of the tour: on each step, navigate to the right page, wait for
  // the target element to exist, scroll it into view and measure it.
  useEffect(() => {
    if (!open) return;
    const s = STEPS[step];
    if (!s) return;
    let cancelled = false;
    setSettled(false);

    (async () => {
      if (pathname !== s.route) {
        router.push(s.route);
        return; // pathname change re-runs this effect on arrival
      }
      if (!s.selector) {
        setRect(null); targetRef.current = null; setSettled(true);
        return;
      }
      const el = await waitFor(s.selector);
      if (cancelled) return;
      if (!el) {
        // Target missing (e.g. empty account) — fall back to a centered card.
        setRect(null); targetRef.current = null; setSettled(true);
        return;
      }
      // Point the scroll-listener at the new element BEFORE scrolling, so the
      // spotlight stays glued to it while the page moves.
      targetRef.current = el;
      const r0 = el.getBoundingClientRect();
      setRect({ top: r0.top - PAD, left: r0.left - PAD, width: r0.width + PAD * 2, height: r0.height + PAD * 2 });
      el.scrollIntoView({ block: "center" });
      // Let the scroll settle before fading the card fully in.
      setTimeout(() => {
        if (cancelled) return;
        const r = el.getBoundingClientRect();
        setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
        setSettled(true);
      }, 250);
    })();

    return () => { cancelled = true; };
  }, [open, step, pathname, router]);

  // Keep the spotlight glued to its element through resizes/scrolls.
  useEffect(() => {
    if (!open) return;
    function remeasure() {
      const el = targetRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    }
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", remeasure, true);
    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", remeasure, true);
    };
  }, [open]);

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

  // Where the explanation card goes: under the spotlight if there's room,
  // above it otherwise; centered when nothing is spotlit. On phones it's a
  // bottom sheet so it never covers the highlighted element's context.
  const isPhone = typeof window !== "undefined" && window.innerWidth < 640;
  let cardStyle: React.CSSProperties;
  if (!rect) {
    // Nothing spotlit (welcome/finish/fallback): center the card.
    cardStyle = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  } else if (isPhone) {
    // On phones, a bottom sheet never covers the highlighted element's context.
    cardStyle = { left: "50%", bottom: "1rem", transform: "translateX(-50%)" };
  } else {
    const vh = window.innerHeight;
    const below = rect.top + rect.height + 16;
    const spaceBelow = vh - below;
    const CARD_EST = 300;
    if (spaceBelow > CARD_EST) cardStyle = { top: Math.min(below, vh - 40), left: "50%", transform: "translateX(-50%)" };
    else if (rect.top > CARD_EST) cardStyle = { bottom: vh - rect.top + 16, left: "50%", transform: "translateX(-50%)" };
    else cardStyle = { left: "50%", bottom: "1rem", transform: "translateX(-50%)" };
  }

  return (
    <AnimatePresence>
      {open && s && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70]"
          aria-modal="true" role="dialog"
        >
          {/* Click-shield: swallows clicks on the dimmed page. */}
          <div className="absolute inset-0" onClick={() => {}} />

          {/* Spotlight: a rounded cutout that glides between targets. The huge
              box-shadow paints the dim layer everywhere except the hole. */}
          {rect ? (
            <motion.div
              className="absolute rounded-2xl pointer-events-none"
              initial={false}
              animate={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                boxShadow: "0 0 0 9999px rgba(2, 12, 6, 0.6), 0 0 0 2px color-mix(in srgb, var(--color-mint) 70%, transparent), 0 0 24px -2px var(--shadow-glow)",
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-[rgba(2,12,6,0.6)] backdrop-blur-[2px]" />
          )}

          {/* The step card */}
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: settled || !s.selector ? 1 : 0.4, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="card-surface gradient-ring fixed w-[calc(100vw-2rem)] max-w-md p-5 md:p-6 z-10"
            style={cardStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => close(true)} className="absolute top-3.5 right-3.5 text-[var(--color-muted)] hover:text-[var(--color-ink)]" title="Close tour"><X size={18} /></button>

            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-[var(--color-muted)] mb-2.5">
              <Sparkles size={13} className="text-[var(--color-brand)]" /> GUIDED TOUR · {step + 1} / {STEPS.length}
            </div>

            <h2 className="text-lg font-bold leading-tight flex items-center gap-2">
              {step === 0 && <span className="logo-badge grid place-items-center w-8 h-8 rounded-xl text-white shrink-0"><GraduationCap size={16} /></span>}
              {s.title}
            </h2>

            <div className="mt-2.5 text-sm text-[var(--color-ink)]/90 leading-relaxed max-h-[38vh] overflow-y-auto">
              {s.body}
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1 my-4 flex-wrap">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  aria-label={`Go to step ${i + 1}`}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === step ? 20 : 6,
                    background: i === step ? "var(--color-brand)" : "var(--color-line)",
                  }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              {step > 0 ? (
                <button onClick={() => setStep((v) => v - 1)} className="btn btn-ghost text-sm py-2"><ArrowLeft size={15} /> Back</button>
              ) : (
                <button onClick={() => close(true)} className="btn btn-ghost text-sm py-2 text-[var(--color-muted)]">Skip tour</button>
              )}

              {isLast ? (
                <button onClick={() => close(true)} className="btn btn-primary py-2"><Check size={15} /> Start studying</button>
              ) : (
                <button onClick={() => setStep((v) => v + 1)} className="btn btn-primary py-2">Next <ArrowRight size={15} /></button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
