"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Play, FlaskConical, Flame, BookOpen } from "lucide-react";
import StudySession from "@/components/StudySession";

function StudyInner() {
  const params = useSearchParams();
  const go = params.get("go");

  // When "go" is present, run a session using the URL parameters.
  if (go) {
    const deckId = params.get("deckId") || undefined;
    const deckName = params.get("deckName") || undefined;
    const tag = params.get("tag") || undefined;
    const tagName = params.get("tagName") || tag;
    const tags = params.get("tags") || undefined;
    const source = params.get("source") || undefined;
    const limit = Number(params.get("limit")) || undefined;
    const mode = (params.get("mode") as "due" | "all" | "custom" | "hard") || "due";

    const title = mode === "custom" ? "Custom test"
      : tag ? `Topic: ${tagName}`
      : deckName ? `Studying: ${deckName}`
      : "Studying all due cards";

    return <StudySession mode={mode} deckId={deckId} tag={tag} tags={tags} source={source} limit={limit} title={title} />;
  }

  return <TestBuilder />;
}

interface Tag { tag: string; total: number; ready: number; }

function TestBuilder() {
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [source, setSource] = useState<"all" | "new" | "unanswered" | "flagged">("all");
  const [count, setCount] = useState(20);

  useEffect(() => { fetch("/api/tags").then((r) => r.json()).then((d) => { setTags(d); setLoading(false); }); }, []);

  function toggle(tag: string) {
    setSelected((s) => { const n = new Set(s); n.has(tag) ? n.delete(tag) : n.add(tag); return n; });
  }

  function startTest() {
    const p = new URLSearchParams({ go: "1", mode: "custom", source, limit: String(count) });
    if (selected.size) p.set("tags", Array.from(selected).join(","));
    router.push(`/study?${p}`);
  }

  const SOURCES: { key: typeof source; label: string; desc: string }[] = [
    { key: "all", label: "All cards", desc: "Everything matching your subjects" },
    { key: "new", label: "New cards", desc: "Cards you haven't started yet" },
    { key: "unanswered", label: "Unanswered", desc: "Never reviewed even once" },
    { key: "flagged", label: "Flagged", desc: "Cards you marked to revisit" },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold flex items-center gap-2 mb-1"><FlaskConical size={24} /> Create a test</h1>
      <p className="text-[var(--color-muted)] mb-5">Pick your subjects and which cards to include, then start. Or use a quick option below.</p>

      {/* Quick options */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <Link href="/study?go=1&mode=due" className="btn btn-ghost"><BookOpen size={16} /> Study all due</Link>
        <Link href="/study?go=1&mode=hard" className="btn btn-ghost"><Flame size={16} /> Hard cards</Link>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-[var(--color-muted)]"><Loader2 className="animate-spin" /></div>
      ) : (
        <>
          {/* Subjects */}
          <div className="card-surface p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold">1. Subjects {selected.size > 0 && <span className="text-sm font-normal text-[var(--color-muted)]">({selected.size} selected)</span>}</h2>
              {selected.size > 0 && <button onClick={() => setSelected(new Set())} className="text-sm text-[var(--color-brand)]">Clear</button>}
            </div>
            {tags.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No tags yet — import some cards first.</p>
            ) : (
              <>
                <p className="text-xs text-[var(--color-muted)] mb-2">Leave all unselected to include every subject.</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => {
                    const on = selected.has(t.tag);
                    return (
                      <button key={t.tag} onClick={() => toggle(t.tag)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${on ? "bg-[var(--color-brand)] text-white border-transparent" : "bg-white border-[var(--color-line)] hover:border-[var(--color-brand)]"}`}>
                        {t.tag} <span className={on ? "opacity-80" : "text-[var(--color-muted)]"}>{t.total}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Source */}
          <div className="card-surface p-5 mb-4">
            <h2 className="font-bold mb-3">2. Card source</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {SOURCES.map((s) => (
                <button key={s.key} onClick={() => setSource(s.key)}
                  className={`text-left p-3 rounded-xl border transition ${source === s.key ? "border-[var(--color-brand)] bg-[#f3f6ff]" : "border-[var(--color-line)] hover:border-[var(--color-brand)]"}`}>
                  <div className="font-medium flex items-center gap-2">
                    <span className={`w-3.5 h-3.5 rounded-full border-2 ${source === s.key ? "border-[var(--color-brand)] bg-[var(--color-brand)]" : "border-[var(--color-muted)]"}`} />
                    {s.label}
                  </div>
                  <div className="text-xs text-[var(--color-muted)] mt-0.5 ml-5">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div className="card-surface p-5 mb-5">
            <h2 className="font-bold mb-3">3. How many cards</h2>
            <div className="flex items-center gap-3 flex-wrap">
              {[10, 20, 40, 80].map((n) => (
                <button key={n} onClick={() => setCount(n)} className={`btn ${count === n ? "btn-primary" : "btn-ghost"} py-2 px-4`}>{n}</button>
              ))}
              <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} className="input max-w-[100px]" />
            </div>
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
