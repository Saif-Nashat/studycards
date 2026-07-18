"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Play, FlaskConical, Flame, BookOpen, Timer, Coffee, CircleOff, Layers, History } from "lucide-react";
import StudySession, { readSavedSession, clearSavedSession, type SavedSession } from "@/components/StudySession";
import { parseTimerMode, DEFAULT_POMODORO, POMO_LIMITS, type TimerMode } from "@/lib/timer";
import HelpCenter from "@/components/HelpCenter";

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

type Source = "due" | "all" | "new" | "unanswered" | "flagged";

// The most cards one session can hold. Keeps every session quick to load and a
// realistic sitting; when more cards match, the extra ones simply wait for the
// next session. Mirrored by the same cap on the server (/api/study).
const SESSION_MAX = 250;

function TestBuilder() {
  const router = useRouter();
  const params = useSearchParams();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDecks, setSelectedDecks] = useState<Set<string>>(new Set());
  const [source, setSource] = useState<Source>("all");
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

  // Preselect from the URL when arriving from a Home shortcut ("Study all due",
  // or a deck's Study button): pick the deck(s) and card source so the builder
  // opens ready to tweak the timer / count, instead of jumping straight in.
  // Applied once (a later manual change must not be clobbered on re-render).
  const preselected = useRef(false);
  useEffect(() => {
    if (preselected.current) return;
    preselected.current = true;
    const src = params.get("source");
    if (src && (["due", "all", "new", "unanswered", "flagged"] as const).includes(src as Source)) {
      setSource(src as Source);
    }
    const ids = [params.get("deckId"), ...(params.get("deckIds")?.split(",") ?? [])]
      .map((s) => s?.trim()).filter(Boolean) as string[];
    if (ids.length) setSelectedDecks(new Set(ids));
  }, [params]);

  // How many cards the current deck + source selection can draw from — powers
  // the "All" button and the max on the count field. Unknown (null) for sources
  // the decks API doesn't pre-count (unanswered / flagged); there we allow the
  // full ceiling and let the server return whatever actually matches.
  const available = useMemo(() => {
    const active = selectedDecks.size ? decks.filter((d) => selectedDecks.has(d.id)) : decks;
    if (source === "due") return active.reduce((s, d) => s + d.due + d.new, 0);
    if (source === "new") return active.reduce((s, d) => s + d.new, 0);
    if (source === "all") return active.reduce((s, d) => s + d.total, 0);
    return null;
  }, [decks, selectedDecks, source]);
  // The largest count this session can hold: the per-session cap, or fewer when
  // that's all the selection has.
  const cap = Math.min(available ?? SESSION_MAX, SESSION_MAX);
  const isMax = count >= cap && cap > 0;

  // Never let the requested count run past what's available / the cap (e.g. after
  // switching to a source with far fewer cards). Skip while decks are still
  // loading (or the selection genuinely has nothing): until then `available` is
  // 0, so clamping would collapse the default down to 1 and leave it stuck there
  // even once real decks arrive and raise the cap.
  useEffect(() => {
    if (loading || cap <= 0) return;
    setCount((c) => Math.min(c, cap));
  }, [loading, cap]);

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

  const SOURCES: { key: Source; label: string; desc: string }[] = [
    { key: "due", label: "Due today", desc: "Scheduled for review now, plus new cards" },
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
      <h1 className="font-display text-3xl md:text-4xl flex items-center gap-2.5 mb-1 tracking-tight"><FlaskConical size={26} strokeWidth={1.75} className="text-[var(--color-brand)]" /> Create a test <HelpCenter /></h1>
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
                  {[10, 20, 40, 80].filter((n) => n < cap).map((n) => (
                    <button key={n} onClick={() => setCount(n)} className={`btn ${count === n && !isMax ? "btn-primary" : "btn-ghost"} py-2 px-4`}>{n}</button>
                  ))}
                  {/* Biggest allowed for this selection: the exact count when it's
                      under the per-session cap, otherwise the cap itself. */}
                  <button onClick={() => setCount(cap)} className={`btn ${isMax ? "btn-primary" : "btn-ghost"} py-2 px-4`}>
                    {available != null && available <= SESSION_MAX ? `All (${available})` : `Max (${SESSION_MAX})`}
                  </button>
                  <input type="number" min={1} max={cap} value={count}
                    onChange={(e) => setCount(Math.max(1, Math.min(cap, Number(e.target.value))))}
                    className="input max-w-[100px]" />
                </div>
                <p className="text-xs text-[var(--color-muted)] mt-2">
                  {available != null && available > SESSION_MAX ? (
                    <><b className="text-[var(--color-ink)]">{available}</b> cards match — a session holds up to <b className="text-[var(--color-ink)]">{SESSION_MAX}</b>, so you&apos;ll study {SESSION_MAX} now and the rest wait for your next session.</>
                  ) : available != null ? (
                    <><b className="text-[var(--color-ink)]">{available}</b> card{available === 1 ? "" : "s"} available — up to {SESSION_MAX} per session.</>
                  ) : (
                    <>A session holds up to <b className="text-[var(--color-ink)]">{SESSION_MAX}</b> cards.</>
                  )}
                </p>
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
