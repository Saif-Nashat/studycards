"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Upload, FileText, Package, Eye, CheckCircle2, Loader2, FileUp, Sparkles, Lightbulb } from "lucide-react";
import { startImport, dismissImport, useImportState } from "@/lib/importManager";

interface Deck { id: string; name: string; }

export default function ImportPage() {
  const [tab, setTab] = useState<"text" | "apkg">("text");
  const [decks, setDecks] = useState<Deck[]>([]);
  useEffect(() => { fetch("/api/decks").then((r) => r.json()).then((d) => setDecks(Array.isArray(d) ? d : [])); }, []);

  return (
    <div className="max-w-3xl mx-auto">
      <span className="eyebrow mb-2.5">Library intake</span>
      <h1 className="font-display text-3xl md:text-4xl flex items-center gap-2.5 mb-1 tracking-tight"><Upload size={26} strokeWidth={1.75} className="text-[var(--color-brand)]" /> Import cards</h1>
      <p className="text-[var(--color-muted)] mb-4 mt-1">Add cards you made with AI — claude.ai, ChatGPT or Gemini — or load a free community Anki deck.</p>

      <div className="card-surface p-4 bg-[var(--color-tint)] text-sm text-[var(--color-muted)] flex gap-3 mb-5">
        <Lightbulb size={18} className="text-[var(--color-gold)] shrink-0 mt-0.5" />
        <span>
          <b className="text-[var(--color-ink)]">Use any material you like — in any language.</b> Turn university slides, textbooks, lecture notes or
          articles into flashcards as CSV or JSON — and get creative: it doesn&apos;t have to be medicine. Language vocabulary,
          law, history, coding, exam prep of any kind… if it fits on a flashcard, you can study it here. Cards can be written
          in <b className="text-[var(--color-ink)]">any language</b> — Arabic and other right-to-left scripts display correctly, and you can even mix languages on the same card.
        </span>
      </div>

      <div id="tour-import" className="flex gap-2 mb-5">
        <button onClick={() => setTab("text")} className={`btn ${tab === "text" ? "btn-primary" : "btn-ghost"}`}><FileText size={16} /> AI cards</button>
        <button onClick={() => setTab("apkg")} className={`btn ${tab === "apkg" ? "btn-primary" : "btn-ghost"}`}><Package size={16} /> Anki deck (.apkg)</button>
      </div>

      {tab === "text" ? <TextImport decks={decks} /> : <ApkgImport />}
    </div>
  );
}

function TextImport({ decks }: { decks: Deck[] }) {
  const [text, setText] = useState("");
  const [deckMode, setDeckMode] = useState<"existing" | "new">(decks.length ? "existing" : "new");
  const [deckId, setDeckId] = useState("");
  const [deckName, setDeckName] = useState("");
  const [preview, setPreview] = useState<{ count: number; sample: { front: string; back: string }[]; deckName?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ added: number; skipped: number } | null>(null);
  const [error, setError] = useState("");

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ""));
    reader.readAsText(f);
  }

  async function doPreview() {
    setError(""); setResult(null); setBusy(true);
    const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, preview: true }) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error); return; }
    setPreview(data);
  }

  async function doImport() {
    setError(""); setBusy(true);
    const body: Record<string, unknown> = { text };
    if (deckMode === "existing" && deckId) body.deckId = deckId;
    if (deckMode === "new" && deckName.trim()) body.deckName = deckName.trim();
    const res = await fetch("/api/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setError(data.error); return; }
    setResult(data); setPreview(null); setText("");
  }

  return (
    <div className="space-y-4">
      <div className="card-surface p-4 bg-[var(--color-tint)] text-sm text-[var(--color-muted)] flex gap-3">
        <Sparkles size={18} className="text-[var(--color-brand)] shrink-0 mt-0.5" />
        <span>Need cards? Use the ready-made prompt on the <Link href="/settings" className="text-[var(--color-brand)] font-medium">Settings</Link> page in claude.ai (best results), ChatGPT or Gemini, then paste the result here (or upload the .json/.csv file). Any source works — paste from your own slides, notes or a book, on any subject you want to learn.</span>
      </div>

      <div className="card-surface p-5 space-y-3">
        <label className="block">
          <span className="text-sm font-medium">Paste your cards here</span>
          <textarea className="input mt-1 font-mono text-sm" rows={8} placeholder='Paste JSON or CSV here…' value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} />
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="btn btn-ghost cursor-pointer text-sm">
            <FileUp size={16} /> Upload a file
            <input type="file" accept=".json,.csv,.txt,.tsv,application/json,text/csv,text/plain,text/tab-separated-values" className="hidden" onChange={onFile} />
          </label>
          <button onClick={doPreview} className="btn btn-ghost text-sm" disabled={busy || !text.trim()}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Eye size={16} />} Preview
          </button>
        </div>
      </div>

      {preview && (
        <div className="card-surface p-5 fade-up">
          <p className="font-semibold mb-2">Found {preview.count} cards. Where should they go?</p>
          <div className="flex gap-3 mb-3 flex-wrap items-center">
            <label className="flex items-center gap-1.5 text-sm"><input type="radio" checked={deckMode === "existing"} onChange={() => setDeckMode("existing")} /> Existing deck</label>
            {deckMode === "existing" && (
              <select className="input max-w-[220px]" value={deckId} onChange={(e) => setDeckId(e.target.value)}>
                <option value="">Choose…</option>
                {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            <label className="flex items-center gap-1.5 text-sm"><input type="radio" checked={deckMode === "new"} onChange={() => setDeckMode("new")} /> New deck</label>
            {deckMode === "new" && (
              <input className="input max-w-[220px]" placeholder={preview.deckName || "Deck name"} value={deckName} onChange={(e) => setDeckName(e.target.value)} />
            )}
          </div>
          <div className="space-y-2 mb-4 max-h-52 overflow-y-auto">
            {preview.sample.map((c, i) => (
              <div key={i} className="text-sm border border-[var(--color-line)] rounded-lg p-2.5">
                <p dir="auto" className="font-medium">{c.front}</p>
                <p dir="auto" className="text-[var(--color-muted)]">{c.back}</p>
              </div>
            ))}
          </div>
          <button onClick={doImport} className="btn btn-primary" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />} Import {preview.count} cards
          </button>
        </div>
      )}

      {error && <div className="card-surface p-4 text-[var(--color-again)] text-sm">{error}</div>}
      {result && (
        <div className="card-surface p-5 fade-up" style={{ background: "var(--color-tint)", borderColor: "var(--color-brand)" }}>
          <p className="flex items-center gap-2 font-semibold text-[var(--color-brand)]"><CheckCircle2 size={18} /> Imported {result.added} cards! {result.skipped > 0 && `(${result.skipped} duplicates skipped)`}</p>
          <Link href="/" className="btn btn-primary mt-3">Go study</Link>
        </div>
      )}
    </div>
  );
}

function ApkgImport() {
  const [file, setFile] = useState<File | null>(null);
  const [deckName, setDeckName] = useState("");
  // The import itself runs in a global manager (src/lib/importManager.ts), so
  // leaving this page doesn't interrupt it — come back (or watch the floating
  // pill on other pages) and the progress is still here.
  const state = useImportState();
  const busy = state.status === "running";
  const progress = state.status === "running" ? state.progress : null;
  const result = state.status === "done" ? state.result : null;
  const error =
    state.status === "error"
      ? state.addedSoFar > 0
        ? `Imported ${state.addedSoFar} cards, then stopped: ${state.message}`
        : state.message
      : "";

  function upload() {
    if (!file || busy) return;
    // The deck is unpacked and its images shrunk right here in the browser,
    // then uploaded in small pieces — hosting caps request bodies at ~4.5MB,
    // so a 100MB+ deck could never be posted whole (it got a bare 413).
    startImport(file, deckName.trim());
  }

  return (
    <div className="space-y-4">
      <div className="card-surface p-4 bg-[var(--color-tint)] text-sm text-[var(--color-muted)] flex gap-3">
        <Package size={18} className="text-[var(--color-brand)] shrink-0 mt-0.5" />
        <span>Download free decks from <a href="https://ankiweb.net/shared/decks" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--color-brand)] hover:underline">ankiweb.net/shared</a> (e.g. search &quot;AnKing&quot; or &quot;Zanki&quot; for USMLE Step 1/2), or upload your own media-rich decks (UWorld, etc.) — pictures and audio clips are imported too (video is skipped). Big decks (100MB+) are fine: the deck is unpacked right on your device and uploaded in small pieces, it just takes a few minutes — and you can keep using the app while it runs (just don&apos;t close the tab). If a deck won&apos;t load, re-export it from the Anki app with the &quot;Support older Anki versions&quot; option ticked.</span>
      </div>

      <div className="card-surface p-5 space-y-3">
        <label className="btn btn-ghost cursor-pointer w-full justify-center py-6 border-dashed">
          <FileUp size={18} /> {file ? file.name : "Choose a .apkg file"}
          {/* The MIME types matter on phones: with only an unknown ".apkg"
              extension, Android/iOS fall back to "any file" and offer the
              gallery/camera — which can't hold an apkg. Naming zip +
              octet-stream (what .apkg downloads are stored as) makes the
              picker go straight to the file browser. */}
          <input type="file" accept=".apkg,application/zip,application/octet-stream" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); dismissImport(); }} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Deck name (optional — defaults to the file name)</span>
          <input className="input mt-1" value={deckName} onChange={(e) => setDeckName(e.target.value)} placeholder="e.g. USMLE Step 1 — AnKing" />
        </label>
        <button onClick={upload} className="btn btn-primary" disabled={busy || !file}>
          {busy ? (
            <><Loader2 className="animate-spin" size={16} /> {progress?.phase === "cards" ? `Importing ${progress.done.toLocaleString()} / ${progress.total.toLocaleString()} cards…` : "Reading deck…"}</>
          ) : (
            <><Upload size={16} /> Import deck</>
          )}
        </button>
        {busy && progress?.phase === "cards" && (
          <div className="h-1.5 rounded-full bg-[var(--color-line)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-brand)] transition-[width] duration-300"
              style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {error && <div className="card-surface p-4 text-[var(--color-again)] text-sm">{error}</div>}
      {result && (
        <div className="card-surface p-5 fade-up" style={{ background: "var(--color-tint)", borderColor: "var(--color-brand)" }}>
          <p className="flex items-center gap-2 font-semibold text-[var(--color-brand)]"><CheckCircle2 size={18} /> Imported {result.added} cards into &quot;{result.deckName}&quot;! {result.skipped > 0 && `(${result.skipped} empty or duplicate cards skipped)`}</p>
          <Link href="/" className="btn btn-primary mt-3">Go study</Link>
        </div>
      )}
    </div>
  );
}
