"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Play, FlaskConical, Flame, BookOpen, Timer, Coffee, CircleOff, Layers, History } from "lucide-react";
import StudySession, { readSavedSession, clearSavedSession, type SavedSession } from "@/components/StudySession";
import { parseTimerMode, DEFAULT_POMODORO, POMO_LIMITS, type TimerMode } from "@/lib/timer";

function StudyInner() {
  const params = useSearchParams();
  const go = params.get("go");

  // When "go" is present, run a session using the URL parameters.
  if (go) {
    const deckId = params.get("deckId") || undefined;
    const deckIds = params.get("deckIds") || undefined;
    const deckName = params.get("deckName") || undefined;
    const source = params.get("source") || undefined;
    const limit = Number(params.get("limit")) || undefined;
    const mode = (params.get("mode") as "due" | "all" | "custom" | "hard") || "due";
    const timer = parseTimerMode(params.get("timer"));
    const pomoFocus = Number(params.get("focus")) || undefined;
    const pomoBreak = Number(params.get("break")) || undefined;

    const deckCount = deckIds ? deckIds.split(",").filter(Boolean).length : 0;
    const title = mode === "custom" ? "Custom test"
      : deckName ? `Studying: ${deckName}`
      : deckCount > 0 ? `Studying: ${deckCount} deck${deckCount === 1 ? "" : "s"}`
      : "Studying all due cards";

    return <StudySession mode={mode} deckId={deckId} deckIds={deckIds} source={source} limit={limit} title={title} timer={timer} pomoFocus={pomoFocus} pomoBreak={pomoBreak} />;
  }

  return <TestBuilder />;
}

interface Deck { id: string; name: string; total: number; due: number; new: number; }

function TestBuilder() {
  const router = useRouter();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDecks, setSelectedDecks] = useState<Set<string>>(new Set());
  const [source, setSource] = useState<"all" | "new" | "unanswered" | "flagged">("all");
  const [count, setCount] = useState(20);
  const [timerMode, setTimerMode] = useState<TimerMode>("none");
  const [pomoFocus, setPomoFocus] = useState(DEFAULT_POMODORO.focus);
  const [pomoBreak, setPomoBreak] = useState(DEFAULT_POMODORO.break);
  // An unfinished session (navigated away, discarded phone tab) the user can
  // jump back into instead of building a new test.
  const [resume, setResume] = useState<SavedSession | null>(null);

  useEffect(() => {
    fetch("/api/decks").then((r) => r.json()).catch(() => []).then((d) => {
      setDecks(Array.isArray(d) ? d : []);
      setResume(readSavedSession());
      setLoading(false);
    });
  }, []);

  function toggleDeck(id: string) {
    setSelectedDecks((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function startTest() {
    // Starting a fresh test replaces any lingering unfinished session.
    clearSavedSession();
    const p = new URLSearchParams({ go: "1", mode: "custom", source, limit: String(count) });
    if (selectedDecks.size) p.set("deckIds", Array.from(selectedDecks).join(","));
    if (timerMode !== "none") p.set("timer", timerMode);
    if (timerMode === "pomodoro") { p.set("focus", String(pomoFocus)); p.set("break", String(pomoBreak)); }
    router.push(`/study?${p}`);
  }

  const SOURCES: { key: typeof source; label: string; desc: string }[] = [
    { key: "all", label: "All cards", desc: "Everything matching your subjects" },
    { key: "new", label: "New cards", desc: "Cards you haven't started yet" },
    { key: "unanswered", label: "Unanswered", desc: "Never reviewed even once" },
    { key: "flagged", label: "Flagged", desc: "Cards you marked to revisit" },
  ];

  const TIMERS: { key: TimerMode; label: string; desc: string; icon: typeof Timer }[] = [
    { key: "none", label: "No timer", desc: "Just study — no clock", icon: CircleOff },
    { key: "normal", label: "Stopwatch", desc: "Counts how long you've studied", icon: Timer },
    { key: "pomodoro", label: "Pomodoro", desc: "Focus / break cycles you set", icon: Coffee },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <span className="eyebrow mb-2.5">Session builder</span>
      <h1 className="font-display text-3xl md:text-4xl flex items-center gap-2.5 mb-1 tracking-tight"><FlaskConical size={26} strokeWidth={1.75} className="text-[var(--color-brand)]" /> Create a test</h1>
      <p className="text-[var(--color-muted)] mb-5 mt-1">Pick your subjects and which cards to include, then start. Or use a quick option below.</p>

      {/* Unfinished session — offer to pick up right where the user left off. */}
      {resume && (
        <div className="card-surface p-4 mb-5 flex items-center justify-between gap-3 flex-wrap fade-up" style={{ borderColor: "var(--color-brand)", background: "var(--color-tint)" }}>
          <span className="text-sm flex items-center gap-2">
            <History size={16} className="text-[var(--color-brand)] shrink-0" />
            <span><b>Unfinished session:</b> {resume.title} — {resume.done} / {resume.initialTotal} answered</span>
          </span>
          <span className="flex gap-2">
            <button onClick={() => router.push(resume.href)} className="btn btn-primary py-2 text-sm"><Play size={15} /> Resume</button>
            <button onClick={() => { clearSavedSession(); setResume(null); }} className="btn btn-ghost py-2 text-sm">Discard</button>
          </span>
        </div>
      )}

      {/* Quick options */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link href="/study?go=1&mode=due" className="btn btn-ghost"><BookOpen size={16} /> Study all due</Link>
        <Link href="/study?go=1&mode=hard" className="btn btn-ghost"><Flame size={16} /> Hard cards</Link>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-[var(--color-muted)]"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          {/* Session sources — where the cards come from. */}
          <div id="tour-test-builder" className="card-surface p-5 mb-4">
            <h2 className="font-bold mb-4 flex items-center gap-2"><Layers size={17} /> 1. Session sources</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">Decks {selectedDecks.size > 0 && <span className="font-normal text-[var(--color-muted)]">({selectedDecks.size} selected)</span>}</p>
                  {selectedDecks.size > 0 && <button onClick={() => setSelectedDecks(new Set())} className="text-sm text-[var(--color-brand)]">All decks</button>}
                </div>
                {decks.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">No decks yet — import some cards first.</p>
                ) : (
                  <>
                    <p className="text-xs text-[var(--color-muted)] mb-2.5">Leave all unselected to study across every deck.</p>
                    <div className="flex flex-wrap gap-2">
                      {decks.map((d) => {
                        const on = selectedDecks.has(d.id);
                        return (
                          <button key={d.id} onClick={() => toggleDeck(d.id)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${on ? "bg-[var(--color-brand)] text-white border-transparent" : "bg-[var(--color-surface)] border-[var(--color-line)] hover:border-[var(--color-brand)]"}`}>
                            {d.name} <span className={on ? "opacity-80" : "text-[var(--color-muted)]"}>{d.total}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Card source</p>
                <div className="space-y-1.5">
                  {SOURCES.map((s) => (
                    <button key={s.key} onClick={() => setSource(s.key)}
                      className={`w-full text-left px-3 py-2 rounded-xl border transition flex items-center gap-2 ${source === s.key ? "border-[var(--color-brand)] bg-[var(--color-tint)]" : "border-[var(--color-line)] hover:border-[var(--color-brand)]"}`}>
                      <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${source === s.key ? "border-[var(--color-brand)] bg-[var(--color-brand)]" : "border-[var(--color-muted)]"}`} />
                      <span className="font-medium text-sm">{s.label}</span>
                      <span className="text-xs text-[var(--color-muted)] ml-auto text-right">{s.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Session settings — how the session runs. */}
          <div className="card-surface p-5 mb-5">
            <h2 className="font-bold mb-4 flex items-center gap-2"><Timer size={17} /> 2. Session settings</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-semibold mb-2">How many cards</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {[10, 20, 40, 80].map((n) => (
                    <button key={n} onClick={() => setCount(n)} className={`btn ${count === n ? "btn-primary" : "btn-ghost"} py-2 px-4`}>{n}</button>
                  ))}
                  <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} className="input max-w-[90px]" />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Timer</p>
                <div className="space-y-1.5">
                  {TIMERS.map((t) => (
                    <button key={t.key} onClick={() => setTimerMode(t.key)}
                      className={`w-full text-left px-3 py-2 rounded-xl border transition flex items-center gap-2 ${timerMode === t.key ? "border-[var(--color-brand)] bg-[var(--color-tint)]" : "border-[var(--color-line)] hover:border-[var(--color-brand)]"}`}>
                      <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${timerMode === t.key ? "border-[var(--color-brand)] bg-[var(--color-brand)]" : "border-[var(--color-muted)]"}`} />
                      <t.icon size={15} className="text-[var(--color-muted)] shrink-0" />
                      <span className="font-medium text-sm">{t.label}</span>
                      <span className="text-xs text-[var(--color-muted)] ml-auto text-right">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {timerMode === "pomodoro" && (
              <div className="fade-up mt-3 rounded-xl bg-[var(--color-tint)] p-4">
                <p className="text-sm font-medium mb-3 flex items-center gap-1.5"><Coffee size={14} /> Set your pomodoro</p>
                <div className="flex items-end gap-4 flex-wrap">
                  <label className="block">
                    <span className="text-xs text-[var(--color-muted)]">Focus (minutes)</span>
                    <input type="number" min={POMO_LIMITS.focusMin} max={POMO_LIMITS.focusMax} value={pomoFocus}
                      onChange={(e) => setPomoFocus(Math.max(1, Number(e.target.value)))} className="input mt-1 max-w-[110px]" />
                  </label>
                  <span className="text-[var(--color-muted)] pb-2.5">+</span>
                  <label className="block">
                    <span className="text-xs text-[var(--color-muted)]">Break (minutes)</span>
                    <input type="number" min={POMO_LIMITS.breakMin} max={POMO_LIMITS.breakMax} value={pomoBreak}
                      onChange={(e) => setPomoBreak(Math.max(1, Number(e.target.value)))} className="input mt-1 max-w-[110px]" />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs text-[var(--color-muted)] self-center">Quick presets:</span>
                  {[[25, 5], [50, 10], [15, 3], [90, 20]].map(([f, b]) => (
                    <button key={`${f}-${b}`} onClick={() => { setPomoFocus(f); setPomoBreak(b); }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${pomoFocus === f && pomoBreak === b ? "bg-[var(--color-brand)] text-white border-transparent" : "border-[var(--color-line)] hover:border-[var(--color-brand)]"}`}>
                      {f} + {b}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[var(--color-muted)] mt-3">
                  ☕ During a break the cards pause and a countdown appears — you can always skip the break early.
                </p>
              </div>
            )}
          </div>

          <button onClick={startTest} className="btn btn-primary w-full py-3.5 text-base"><Play size={18} /> Start test</button>
        </>
      )}
    </div>
  );
}

export default function StudyPage() {
  return (
    <Suspense fallback={<div className="text-center text-[var(--color-muted)] py-24">Loading…</div>}>
      <StudyInner />
    </Suspense>
  );
}
