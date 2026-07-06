"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion";
import { X, ArrowRight, ArrowLeft, Check, GraduationCap, Sparkles } from "lucide-react";

// An interactive, cross-page walkthrough. Instead of a static slideshow it
// actually navigates to each page, spotlights the real piece of UI it's
// talking about (dimming everything else), and explains what you can do
// there. Opens automatically on first login (tracked in localStorage) and can
// be replayed from Settings via the `medicards:open-tutorial` window event.
// Mounted once, globally, from the root layout.

const SEEN_KEY = "sc_tutorial_seen";
export const OPEN_TUTORIAL_EVENT = "medicards:open-tutorial";

interface Step {
  route: string;            // page this step lives on
  selector?: string;        // element to spotlight; omitted = centered card
  title: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    route: "/",
    title: "Welcome to MediCards 👋",
    body: (
      <p>MediCards helps you <b>remember</b> using <b>spaced repetition</b> — each card comes back right before you&apos;d forget it, so facts actually stick. This quick tour points out the essentials — skip anytime and replay it later from <b>Settings</b>.</p>
    ),
  },
  {
    route: "/",
    selector: "#tour-study-cta",
    title: "One tap starts your day",
    body: (
      <p>The numbers up top show what&apos;s <b>due</b>, what&apos;s <b>new</b>, and what you&apos;ve done today. This button studies <b>everything due</b> in one tap — most days, it&apos;s the only button you need.</p>
    ),
  },
  {
    route: "/",
    selector: "#tour-decks",
    title: "Your decks",
    body: (
      <p>Every deck shows its due / new / total counts and has its own <b>Study</b> button. Create decks here, or delete ones you&apos;re done with to free their storage.</p>
    ),
  },
  {
    route: "/study",
    selector: "#tour-test-builder",
    title: "Study & rate cards",
    body: (
      <>
        <p>The <b>Study</b> page builds custom tests — pick subjects and card types, add an optional timer and goal.</p>
        <p className="mt-2">In a session, press <b>Space</b> to reveal, then rate <b>Again / Hard / Good / Easy</b> (keys <b>1–4</b>) — honest ratings set when each card returns. <b>F</b> flags a card; Hard and flagged cards collect in the <b>Hard</b> pile to drill later.</p>
      </>
    ),
  },
  {
    route: "/insights",
    selector: "#tour-insights",
    title: "Track your progress",
    body: (
      <p><b>Insights</b> tracks your <b>streak</b>, reviews, and all-time accuracy, and surfaces your <b>weakest topics</b> with a Drill button for each. Studying also earns <b>trophies</b> 🏆 — a daily streak is the fastest way to collect them.</p>
    ),
  },
  {
    route: "/notebook",
    selector: "#tour-notebook",
    title: "Your notebook",
    body: (
      <p>A personal scratchpad that <b>saves automatically</b> — summaries, mnemonics, reminders. It also slides out <b>inside study sessions</b> (the 📓 icon).</p>
    ),
  },
  {
    route: "/browse",
    selector: "#tour-browse",
    title: "Browse & edit everything",
    body: (
      <p>Search, filter, and edit every card — or <b>add your own</b>. The ↔ button makes a <b>reverse copy</b> (answer becomes the question) so you learn facts both ways.</p>
    ),
  },
  {
    route: "/import",
    selector: "#tour-import",
    title: "Import from any material",
    body: (
      <p>Two ways in: paste <b>claude.ai cards</b> (JSON/CSV), or upload an <b>Anki deck (.apkg)</b> — images included. <b>Settings</b> has a ready-made prompt: drop it into claude.ai with any material (slides, notes, books, any language) and paste the cards back here.</p>
    ),
  },
  {
    route: "/",
    title: "You're all set 🎉",
    body: (
      <p>That&apos;s the tour. The golden rule: <b>a little every day beats a lot once a week</b>. Your storage share and a replay of this tour live in <b>Settings</b> — now go study your first cards.</p>
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
  const [step, setStep] = useState(0);       // the step we're heading to
  const [shownStep, setShownStep] = useState(0); // the step the card is showing — advances once its page/target is ready
  const [rect, setRect] = useState<Rect | null>(null); // spotlight rect at settle time; drives card placement only
  const targetRef = useRef<HTMLElement | null>(null);

  // Spotlight geometry lives in motion values, not React state. Touch scrolling
  // fires dozens of events per second; re-rendering and re-targeting a spring on
  // each one is exactly the phone jank users feel. Motion values move the hole
  // as a pure transform (compositor work, no re-render, no repaint of the huge
  // dimming shadow).
  const sx = useMotionValue(0);
  const sy = useMotionValue(0);
  const sw = useMotionValue(0);
  const sh = useMotionValue(0);
  const glides = useRef<{ stop: () => void }[]>([]);
  const hadSpot = useRef(false); // was a spotlight visible before this step? (glide vs snap)
  // The tour moves the browser ONLY when the user drives it (Next / Back / dots),
  // never as a side effect of being open. pendingRoute is the page a hop we issued
  // is heading to (so the effect waits, rather than bailing, until it arrives);
  // freshOpen marks the instant after opening, when the tour may be sitting on a
  // page that isn't step 0's home — there it shows the card in place instead of
  // yanking the user or mistaking it for them leaving.
  const pendingRoute = useRef<string | null>(null);
  const freshOpen = useRef(false);
  // Latest pathname / step, readable from handlers without a stale closure.
  const pathnameRef = useRef(pathname);
  const stepRef = useRef(step);
  useEffect(() => { pathnameRef.current = pathname; stepRef.current = step; });

  const stopGlides = useCallback(() => {
    for (const g of glides.current) g.stop();
    glides.current = [];
  }, []);

  const close = useCallback((markSeen: boolean) => {
    if (markSeen) { try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ } }
    setOpen(false);
    setRect(null);
    targetRef.current = null;
    hadSpot.current = false;
    pendingRoute.current = null;
    freshOpen.current = false;
    stopGlides();
  }, [stopGlides]);

  // The one path that changes step and moves the browser. Wired to Next / Back /
  // dots / arrow keys — an explicit user action, so it may always navigate.
  const goToStep = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(STEPS.length - 1, next));
    freshOpen.current = false; // the user is driving now
    setStep(clamped);
    const target = STEPS[clamped];
    if (target.route !== pathnameRef.current) {
      pendingRoute.current = target.route;
      router.push(target.route);
    }
  }, [router]);

  // Auto-open on first ever visit (once localStorage says otherwise, never again).
  // Guarded by a ref: this effect re-runs on every route change (pathname is a
  // dependency so it can fire after leaving /login), but it must only auto-open
  // once per app load — the tour itself navigates between pages, and without
  // the guard each navigation would reset it back to step 1.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (pathname === "/login" || autoOpened.current) return;
    autoOpened.current = true;
    let seen = false;
    try { seen = localStorage.getItem(SEEN_KEY) === "1"; } catch { seen = true; }
    // Post-mount on purpose: the server renders the tour closed, so reading
    // localStorage must wait until after hydration to avoid a mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!seen) { setStep(0); setShownStep(0); freshOpen.current = true; setOpen(true); }
  }, [pathname]);

  // Re-open on demand (from the Settings button).
  useEffect(() => {
    function onOpen() { setStep(0); setShownStep(0); setRect(null); freshOpen.current = true; setOpen(true); }
    window.addEventListener(OPEN_TUTORIAL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TUTORIAL_EVENT, onOpen);
  }, []);

  // The heart of the tour: on each step, navigate to the right page, wait for
  // the target element to exist, scroll it into view and measure it. The card
  // keeps showing the PREVIOUS step (fully readable) until all that is done,
  // then flips — so a slow page load never shows a half-faded "hanging" card.
  useEffect(() => {
    if (!open) return;
    const s = STEPS[step];
    if (!s) return;
    let cancelled = false;

    (async () => {
      if (pathname !== s.route) {
        if (pendingRoute.current === s.route) {
          // Mid-hop: a Next/Back we issued is still settling — wait for arrival.
          return;
        }
        if (freshOpen.current) {
          // The tour just opened on a page that isn't this step's home. Don't
          // move the user and don't treat it as them leaving — show the card
          // (the welcome step has no spotlight) right where they are.
          freshOpen.current = false;
          targetRef.current = null;
          hadSpot.current = false;
          setRect(null);
          setShownStep(step);
          return;
        }
        // Not our hop and not a fresh open: the user navigated the browser
        // themselves (back button, typed URL). Never trap them — step aside so
        // they land where they wanted.
        close(true);
        return;
      }

      // We're on the right page for this step.
      pendingRoute.current = null;
      freshOpen.current = false;

      if (!s.selector) {
        targetRef.current = null;
        hadSpot.current = false;
        setRect(null);
        setShownStep(step);
        return;
      }
      const el = await waitFor(s.selector);
      if (cancelled) return;
      if (!el) {
        // Target missing (e.g. empty account) — fall back to a centered card.
        targetRef.current = null;
        hadSpot.current = false;
        setRect(null);
        setShownStep(step);
        return;
      }
      // Detach the scroll-follower while we glide to the new target — it snaps
      // the spotlight to the element's live position, which would cut the
      // glide animation short.
      targetRef.current = null;
      el.scrollIntoView({ block: "center" });
      // Let the scroll and the page's entrance animations settle, then measure.
      setTimeout(() => {
        if (cancelled) return;
        const r0 = el.getBoundingClientRect();
        const r = { top: r0.top - PAD, left: r0.left - PAD, width: r0.width + PAD * 2, height: r0.height + PAD * 2 };
        stopGlides();
        if (hadSpot.current) {
          // Size snaps (resizing repaints the full-screen dim shadow, so keep
          // it to a single frame); position glides on the compositor.
          sw.set(r.width); sh.set(r.height);
          glides.current = [
            animate(sx, r.left, { type: "spring", stiffness: 300, damping: 30 }),
            animate(sy, r.top, { type: "spring", stiffness: 300, damping: 30 }),
          ];
        } else {
          sx.set(r.left); sy.set(r.top); sw.set(r.width); sh.set(r.height);
        }
        hadSpot.current = true;
        targetRef.current = el;
        setRect(r);
        setShownStep(step);
      }, 250);
    })();

    return () => { cancelled = true; };
  }, [open, step, pathname, stopGlides, sx, sy, sw, sh, close]);

  // Keep the spotlight glued to its element while the user scrolls — straight
  // into the motion values (one rAF per frame, no re-render, no spring
  // re-target: that per-event work was the phone jank). The card deliberately
  // does NOT follow scroll: it was placed when the step settled, and pinning it
  // keeps it on-screen no matter how far the user scrolls — following the
  // element used to walk it right off the viewport.
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    function follow() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = targetRef.current;
        if (!el) return;
        stopGlides();
        const r = el.getBoundingClientRect();
        sx.set(r.left - PAD); sy.set(r.top - PAD);
        sw.set(r.width + PAD * 2); sh.set(r.height + PAD * 2);
      });
    }
    // A resize (rotation, split view, window drag) can genuinely invalidate
    // the card's placement, so re-derive it then — debounced, because iOS
    // fires resize continuously while the URL bar collapses mid-scroll.
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    function onResize() {
      follow();
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const el = targetRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
      }, 150);
    }
    window.addEventListener("scroll", follow, { capture: true, passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
    };
  }, [open, stopGlides, sx, sy, sw, sh]);

  // Keyboard navigation while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close(true);
      else if (e.key === "ArrowRight") goToStep(stepRef.current + 1);
      else if (e.key === "ArrowLeft") goToStep(stepRef.current - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, goToStep]);

  if (pathname === "/login") return null;

  const s = STEPS[step];
  const sShown = STEPS[shownStep];
  const isLast = step === STEPS.length - 1;

  // Where the explanation card goes: under the spotlight if there's room,
  // above it otherwise; centered when nothing is spotlit. On phones it's a
  // bottom sheet so it never covers the highlighted element's context.
  // Every branch is clamped to the viewport — the target can sit partly
  // off-screen (or end up there after a rotation), and the card must never
  // follow it out.
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
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
    if (spaceBelow > CARD_EST) cardStyle = { top: clamp(below, 16, vh - CARD_EST), left: "50%", transform: "translateX(-50%)" };
    else if (rect.top > CARD_EST) cardStyle = { bottom: clamp(vh - rect.top + 16, 16, vh - CARD_EST), left: "50%", transform: "translateX(-50%)" };
    else cardStyle = { left: "50%", bottom: "1rem", transform: "translateX(-50%)" };
  }

  return (
    <AnimatePresence>
      {open && s && sShown && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70]"
          aria-modal="true" role="dialog"
        >
          {/* Click-shield: swallows clicks on the dimmed page. */}
          <div className="absolute inset-0" onClick={() => {}} />

          {/* Spotlight: a rounded cutout that glides between targets. The huge
              box-shadow paints the dim layer everywhere except the hole. Its
              position/size come straight from motion values (x/y are
              transforms), so scrolling moves it on the compositor without
              re-rendering or repainting the shadow. */}
          {rect ? (
            <motion.div
              className="absolute top-0 left-0 rounded-2xl pointer-events-none"
              style={{
                x: sx, y: sy, width: sw, height: sh,
                boxShadow: "0 0 0 9999px rgba(2, 12, 6, 0.6), 0 0 0 2px color-mix(in srgb, var(--color-mint) 70%, transparent), 0 0 24px -2px var(--shadow-glow)",
              }}
            />
          ) : (
            // No backdrop-blur here on purpose: blurring the whole page while
            // the overlay fades is a big paint cost on phones.
            <div className="absolute inset-0 bg-[rgba(2,12,6,0.65)]" />
          )}

          {/* The step card. Positioning lives on a plain wrapper div: the card
              itself is animated by framer-motion, which owns its transform —
              putting the translateX(-50%) centering on the same element gets
              overwritten by the animation and the card drifts half off screen
              (most visibly on phones). */}
          <div className="fixed w-[calc(100vw-2rem)] max-w-md z-10" style={cardStyle}>
          <motion.div
            key={shownStep}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="card-surface gradient-ring p-5 md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => close(true)} className="absolute top-3.5 right-3.5 text-[var(--color-muted)] hover:text-[var(--color-ink)]" title="Close tour"><X size={18} /></button>

            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-[var(--color-muted)] mb-2.5">
              <Sparkles size={13} className="text-[var(--color-brand)]" /> GUIDED TOUR · {shownStep + 1} / {STEPS.length}
            </div>

            <h2 className="text-lg font-bold leading-tight flex items-center gap-2">
              {shownStep === 0 && <span className="logo-badge grid place-items-center w-8 h-8 rounded-xl text-white shrink-0"><GraduationCap size={16} /></span>}
              {sShown.title}
            </h2>

            <div className="mt-2.5 text-sm text-[var(--color-ink)]/90 leading-relaxed max-h-[38vh] overflow-y-auto">
              {sShown.body}
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1 my-4 flex-wrap">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToStep(i)}
                  aria-label={`Go to step ${i + 1}`}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === shownStep ? 20 : 6,
                    background: i === shownStep ? "var(--color-brand)" : "var(--color-line)",
                  }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              {step > 0 ? (
                <button onClick={() => goToStep(step - 1)} className="btn btn-ghost text-sm py-2"><ArrowLeft size={15} /> Back</button>
              ) : (
                <button onClick={() => close(true)} className="btn btn-ghost text-sm py-2 text-[var(--color-muted)]">Skip tour</button>
              )}

              {isLast ? (
                <button onClick={() => close(true)} className="btn btn-primary py-2"><Check size={15} /> Start studying</button>
              ) : (
                <button onClick={() => goToStep(step + 1)} className="btn btn-primary py-2">Next <ArrowRight size={15} /></button>
              )}
            </div>
          </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
