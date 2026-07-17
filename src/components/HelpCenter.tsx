"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  HelpCircle, X, LifeBuoy,
  Home, BookOpen, Flame, BarChart3, Trophy, NotebookPen, Layers, Upload, Settings,
} from "lucide-react";

// A per-page help overlay. The button lives in the nav next to Settings; when
// clicked it opens a panel whose content is chosen from the CURRENT route — so
// "Help" always explains the page the user is actually looking at. This is the
// deeper, page-specific companion to the one-time welcome Tutorial: the tour is
// a quick end-to-end intro, this is on-demand detail for wherever you are.

interface HelpContent {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  intro: string;
  sections: { heading: string; items: string[] }[];
}

// Keyed by route. Exact match for "/"; every other key matches by prefix, so
// "/study?go=1" and "/study" share one entry. Ordered specific → general.
const HELP: Record<string, HelpContent> = {
  "/": {
    icon: Home,
    title: "Home",
    intro: "Your daily launchpad — everything waiting for you today, at a glance.",
    sections: [
      { heading: "What you're looking at", items: [
        "Due — cards scheduled for review today.",
        "New — cards you haven't studied yet.",
        "Day streak 🔥 — how many days in a row you've studied.",
      ] },
      { heading: "Start studying", items: [
        "Tap “Study all due” to review everything waiting in one session — most days it's the only button you need.",
        "Each deck shows its own momentum, so you can jump straight into just one.",
      ] },
    ],
  },
  "/study": {
    icon: BookOpen,
    title: "Study",
    intro: "Build a study session exactly the way you want it.",
    sections: [
      { heading: "Set it up", items: [
        "Pick one or more decks, and choose which cards to include (due, new, all, hard…).",
        "Set how many cards, and add an optional timer or pomodoro.",
        "Left mid-session? A Resume banner brings you back to where you stopped.",
      ] },
      { heading: "During a session", items: [
        "Tap the card to reveal the answer (or press Space on a keyboard).",
        "Rate how well you knew it — tap a button or press keys 1–4. Rate honestly and each card finds its own rhythm.",
        "Press F to flag a card you want to revisit later.",
        "Open the 📓 notebook drawer to jot a note without losing your place.",
      ] },
    ],
  },
  "/hard": {
    icon: Flame,
    title: "Hard / flagged",
    intro: "A focused queue of just the cards giving you trouble.",
    sections: [
      { heading: "What lands here", items: [
        "Cards you flag yourself (press F while studying).",
        "Cards you rate Hard, or keep failing (leeches), are collected here automatically.",
      ] },
      { heading: "How to use it", items: [
        "Drill only these tricky cards to turn your weak spots into strong ones.",
      ] },
    ],
  },
  "/insights": {
    icon: BarChart3,
    title: "Insights",
    intro: "See how your revision is going over time.",
    sections: [
      { heading: "Your numbers", items: [
        "Day streak, cards reviewed today and over the last 7 days, and all-time accuracy.",
        "A 14-day activity chart, plus a breakdown of how you've been rating cards.",
      ] },
      { heading: "Act on it", items: [
        "Your weakest decks are listed with a Drill button — study them in one tap.",
        "Card maturity shows how well-learned your collection is; “mature” cards (21+ day interval) are sticking.",
      ] },
      { heading: "Trophies tab", items: [
        "Switch to the Trophies tab at the top to see the rewards you've earned for studying.",
      ] },
    ],
  },
  "/achievements": {
    icon: Trophy,
    title: "Trophies",
    intro: "Rewards you earn as you build a study habit.",
    sections: [
      { heading: "How it works", items: [
        "Studying unlocks trophies and earns you points.",
        "“Next up” shows the closest trophy to chase next.",
        "Keeping a daily streak alive is the fastest way to collect them all.",
      ] },
    ],
  },
  "/notebook": {
    icon: NotebookPen,
    title: "Notebook",
    intro: "A personal scratchpad for the whole app — summaries, mnemonics, reminders.",
    sections: [
      { heading: "Good to know", items: [
        "It saves automatically as you type.",
        "Use the toolbar for bold, highlights, lists and text sizes.",
        "Paste images straight in — they're shrunk automatically to fit.",
        "It also slides out inside study sessions (the 📓 icon), so you can note something without losing your place.",
      ] },
    ],
  },
  "/browse": {
    icon: Layers,
    title: "Browse cards",
    intro: "Your whole card collection — searchable and editable.",
    sections: [
      { heading: "Find cards", items: [
        "Search questions and answers, or filter by deck.",
        "Cards are shown 10 per page; use Prev / Next to move through them.",
      ] },
      { heading: "Edit cards", items: [
        "Add a new card with the “Add card” button.",
        "Edit ✏️, flag 🚩, or delete 🗑 any card.",
        "Make a reverse copy of a basic card to learn a fact in both directions.",
      ] },
      { heading: "Import tab", items: [
        "Switch to the Import tab at the top to add new cards from AI or an Anki deck.",
      ] },
    ],
  },
  "/import": {
    icon: Upload,
    title: "Import cards",
    intro: "Bring in cards on any subject — two ways.",
    sections: [
      { heading: "Make your own with AI", items: [
        "Copy the ready-made claude AI prompt, then paste in any slides, notes or book chapter — Claude writes the cards for you.",
        "Paste Claude's reply back here (or upload the .json / .csv file it gives you).",
      ] },
      { heading: "Upload an Anki deck", items: [
        "Already have a .apkg file? Upload it — images and audio come across too.",
        "Free community decks (AnKing, Zanki, Lightyear…) are on ankiweb.net/shared.",
      ] },
    ],
  },
  "/settings": {
    icon: Settings,
    title: "Settings",
    intro: "Your control room for the whole app.",
    sections: [
      { heading: "What's here", items: [
        "Replay the guided tour anytime.",
        "Check how much of your storage you've used, and free up room by deleting decks.",
        "Reset your study progress if you want a clean slate.",
        "Switch between light and dark themes with the toggle in the top bar.",
        "Find contact details if you need a hand.",
      ] },
    ],
  },
};

function helpFor(pathname: string): HelpContent {
  if (pathname === "/") return HELP["/"];
  const key = Object.keys(HELP).find((k) => k !== "/" && pathname.startsWith(k));
  return key ? HELP[key] : HELP["/"];
}

export default function HelpCenter() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close on route change so help never lingers with stale content.
  useEffect(() => { setOpen(false); }, [pathname]);

  // Lock background scroll while the panel is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname === "/login") return null;

  const help = helpFor(pathname);
  const Icon = help.icon;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`Help for this page — ${help.title}`}
        aria-label="Help for this page"
        className="relative flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-300 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
      >
        <HelpCircle size={15} strokeWidth={1.75} />
        <span>Help</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[80] grid place-items-center p-4"
            style={{ background: "rgba(2, 12, 6, 0.62)" }}
            aria-modal="true" role="dialog"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="card-surface gradient-ring p-6 md:p-7 relative w-full max-w-md max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => setOpen(false)} className="absolute top-3.5 right-3.5 text-[var(--color-muted)] hover:text-[var(--color-ink)]" title="Close help"><X size={18} /></button>

              <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-[var(--color-muted)] mb-3">
                <HelpCircle size={13} className="text-[var(--color-brand)]" /> HELP FOR THIS PAGE
              </div>

              <span
                className="grid place-items-center w-12 h-12 rounded-2xl mb-3.5 text-[var(--color-brand)]"
                style={{ background: "color-mix(in srgb, var(--color-brand) 14%, transparent)", boxShadow: "inset 0 1px 0 var(--card-highlight), inset 0 0 0 1px color-mix(in srgb, var(--color-brand) 20%, transparent)" }}
              >
                <Icon size={24} />
              </span>

              <h2 className="text-xl font-bold leading-tight mb-1">{help.title}</h2>
              <p className="text-sm text-[var(--color-muted)] mb-5">{help.intro}</p>

              <div className="space-y-5">
                {help.sections.map((sec) => (
                  <div key={sec.heading}>
                    <h3 className="text-sm font-bold mb-2">{sec.heading}</h3>
                    <ul className="space-y-1.5">
                      {sec.items.map((item, i) => (
                        <li key={i} className="text-sm text-[var(--color-ink)]/90 leading-relaxed flex gap-2">
                          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--color-line)] flex items-center gap-2 text-xs text-[var(--color-muted)]">
                <LifeBuoy size={13} /> Still stuck? Find contact details under Settings.
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
