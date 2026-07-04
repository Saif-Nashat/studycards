"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Plus, Flag, Pencil, Trash2, Loader2, X, Layers, Repeat, Bug, ImagePlus } from "lucide-react";
import { resolveImageSrc } from "@/components/CardFace";

interface Deck { id: string; name: string; }
interface Card {
  id: string; type: string; front: string; back: string; extra: string; mnemonic?: string; tags: string; source: string;
  flagged: boolean; isLeech?: boolean; imageFront?: string; imageBack?: string; deckId: string; deck?: { name: string };
}

const EMPTY: Partial<Card> = { type: "basic", front: "", back: "", extra: "", mnemonic: "", tags: "", source: "", imageFront: "", imageBack: "" };

// Shrink an uploaded image to a data URL so it can live in the database.
function fileToResizedDataURL(file: File, maxDim = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BrowsePage() {
  return (
    <Suspense fallback={<div className="grid place-items-center py-24 text-[var(--color-muted)]"><Loader2 className="animate-spin" /></div>}>
      <BrowseInner />
    </Suspense>
  );
}

function BrowseInner() {
  const searchParams = useSearchParams();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [deckFilter, setDeckFilter] = useState("");
  const [editing, setEditing] = useState<Partial<Card> | null>(null);

  const loadCards = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (deckFilter) params.set("deckId", deckFilter);
    fetch(`/api/cards?${params}`).then((r) => r.json()).then((d) => { setCards(d); setLoading(false); });
  }, [q, deckFilter]);

  useEffect(() => { fetch("/api/decks").then((r) => r.json()).then(setDecks); }, []);
  useEffect(() => { const t = setTimeout(loadCards, 250); return () => clearTimeout(t); }, [loadCards]);

  async function toggleFlag(c: Card) {
    await fetch("/api/cards", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, flagged: !c.flagged }) });
    setCards((list) => list.map((x) => (x.id === c.id ? { ...x, flagged: !x.flagged } : x)));
  }
  async function remove(c: Card) {
    if (!confirm("Delete this card?")) return;
    await fetch("/api/cards", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) });
    setCards((list) => list.filter((x) => x.id !== c.id));
  }
  async function addReverse(c: Card) {
    await fetch("/api/cards", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deckId: c.deckId, type: "basic", front: c.back, back: c.front,
        tags: c.tags, source: c.source, imageFront: c.imageBack || "", imageBack: c.imageFront || "",
      }),
    });
    loadCards();
  }

  return (
    <div>
      <div id="tour-browse" className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <span className="eyebrow mb-2.5">Collection</span>
          <h1 className="font-display text-3xl md:text-4xl flex items-center gap-2.5 tracking-tight"><Layers size={26} strokeWidth={1.75} className="text-[var(--color-brand)]" /> Browse cards</h1>
        </div>
        <button onClick={() => setEditing({ ...EMPTY, deckId: deckFilter || decks[0]?.id })} className="btn btn-primary">
          <Plus size={18} /> Add card
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]" />
          <input className="input pl-9" placeholder="Search questions, answers, tags…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="input max-w-[220px]" value={deckFilter} onChange={(e) => setDeckFilter(e.target.value)}>
          <option value="">All decks</option>
          {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-[var(--color-muted)]"><Loader2 className="animate-spin" /></div>
      ) : cards.length === 0 ? (
        <div className="card-surface p-10 text-center text-[var(--color-muted)]">No cards found.</div>
      ) : (
        <>
          <p className="text-sm text-[var(--color-muted)] mb-2">{cards.length} card{cards.length === 1 ? "" : "s"}</p>
          <div className="space-y-2">
            {cards.map((c) => (
              <div key={c.id} className="card-surface p-4 flex items-start gap-3">
                <span className="chip shrink-0 mt-0.5">{c.type}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium flex items-center gap-2">
                    {c.isLeech && <span className="chip" style={{ background: "var(--color-danger-bg)", color: "var(--color-again)" }}><Bug size={11} /> Leech</span>}
                    <span className="truncate">{c.front.replace(/\{\{c\d+::(.*?)(::.*?)?\}\}/g, "[$1]")}</span>
                    {(c.imageFront || c.imageBack) && <ImagePlus size={13} className="text-[var(--color-muted)] shrink-0" />}
                  </p>
                  <p className="text-sm text-[var(--color-muted)] truncate">{c.type === "list" ? c.back.replace(/[[\]"]/g, "") : c.back}</p>
                  <div className="flex gap-2 mt-1.5 flex-wrap">
                    {c.deck?.name && <span className="text-xs text-[var(--color-muted)]">{c.deck.name}</span>}
                    {c.tags && <span className="text-xs text-[var(--color-brand)]">{c.tags}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {c.type === "basic" && <button onClick={() => addReverse(c)} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-muted)]" title="Create a reverse copy: a new card with question & answer swapped, so you can recall the fact in both directions"><Repeat size={16} /></button>}
                  <button onClick={() => toggleFlag(c)} className={`p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] ${c.flagged ? "text-[var(--color-hard)]" : "text-[var(--color-muted)]"}`} title="Flag"><Flag size={16} /></button>
                  <button onClick={() => setEditing(c)} className="p-1.5 rounded-lg hover:bg-[var(--color-surface-2)] text-[var(--color-muted)]" title="Edit"><Pencil size={16} /></button>
                  <button onClick={() => remove(c)} className="p-1.5 rounded-lg hover:bg-[var(--color-danger-bg)] text-[var(--color-muted)] hover:text-[var(--color-again)]" title="Delete"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && (
        <EditModal
          card={editing}
          decks={decks}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadCards(); }}
        />
      )}
    </div>
  );
}

function EditModal({ card, decks, onClose, onSaved }: { card: Partial<Card>; decks: Deck[]; onClose: () => void; onSaved: () => void; }) {
  const [form, setForm] = useState<Partial<Card>>(card);
  const [saving, setSaving] = useState(false);
  const [alsoReverse, setAlsoReverse] = useState(false);
  const isNew = !card.id;

  function set<K extends keyof Card>(k: K, v: Card[K]) { setForm((f) => ({ ...f, [k]: v })); }

  async function pickImage(side: "imageFront" | "imageBack", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { set(side, await fileToResizedDataURL(file)); } catch { alert("Couldn't read that image."); }
  }

  async function save() {
    if (!form.front?.trim() || !form.deckId) { alert("Please fill in the question and pick a deck."); return; }
    setSaving(true);
    if (isNew) {
      await fetch("/api/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (alsoReverse && form.type === "basic") {
        await fetch("/api/cards", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, front: form.back, back: form.front, imageFront: form.imageBack || "", imageBack: form.imageFront || "" }),
        });
      }
    } else {
      await fetch("/api/cards", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    }
    setSaving(false); onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="card-surface p-6 w-full max-w-lg fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{isNew ? "Add card" : "Edit card"}</h3>
          <button onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-ink)]"><X size={20} /></button>
        </div>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-sm font-medium">Deck</span>
              <select className="input mt-1" value={form.deckId || ""} onChange={(e) => set("deckId", e.target.value)}>
                <option value="">Choose…</option>
                {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            <label className="block"><span className="text-sm font-medium">Type</span>
              <select className="input mt-1" value={form.type || "basic"} onChange={(e) => set("type", e.target.value)}>
                <option value="basic">Basic (Q &amp; A)</option>
                <option value="cloze">Cloze (fill-in-blank)</option>
                <option value="list">List</option>
              </select>
            </label>
          </div>
          <label className="block"><span className="text-sm font-medium">Question / front{form.type === "cloze" ? " (use {{c1::hidden text}})" : ""}</span>
            <textarea className="input mt-1" rows={3} value={form.front || ""} onChange={(e) => set("front", e.target.value)} />
          </label>
          {form.type !== "cloze" && (
            <label className="block"><span className="text-sm font-medium">Answer / back{form.type === "list" ? " (one item per line)" : ""}</span>
              <textarea className="input mt-1" rows={3} value={form.back || ""} onChange={(e) => set("back", e.target.value)} />
            </label>
          )}
          <label className="block"><span className="text-sm font-medium">Explanation — why it&apos;s correct (optional)</span>
            <textarea className="input mt-1" rows={2} value={form.extra || ""} onChange={(e) => set("extra", e.target.value)} />
          </label>
          <label className="block"><span className="text-sm font-medium">Mnemonic (optional)</span>
            <textarea className="input mt-1" rows={2} value={form.mnemonic || ""} onChange={(e) => set("mnemonic", e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-sm font-medium">Tags (comma-separated)</span>
              <input className="input mt-1" value={form.tags || ""} onChange={(e) => set("tags", e.target.value)} />
            </label>
            <label className="block"><span className="text-sm font-medium">Source (optional)</span>
              <input className="input mt-1" value={form.source || ""} onChange={(e) => set("source", e.target.value)} />
            </label>
          </div>

          {/* Images */}
          <div className="grid grid-cols-2 gap-3">
            {(["imageFront", "imageBack"] as const).map((side) => (
              <div key={side}>
                <span className="text-sm font-medium">{side === "imageFront" ? "Image on question" : "Image on answer"}</span>
                {form[side] ? (
                  <div className="mt-1 relative">
                    {/* Imported cards can hold several images (newline-joined); preview the first. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveImageSrc(String(form[side]).split("\n")[0])} alt="" className="rounded-lg max-h-28 border border-[var(--color-line)]" />
                    <button onClick={() => set(side, "")} className="absolute top-1 right-1 bg-[var(--color-surface)] rounded-full p-0.5 shadow text-[var(--color-again)]"><X size={14} /></button>
                  </div>
                ) : (
                  <label className="btn btn-ghost mt-1 w-full cursor-pointer text-sm py-2">
                    <ImagePlus size={15} /> Add image
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(side, e)} />
                  </label>
                )}
              </div>
            ))}
          </div>

          {isNew && form.type === "basic" && (
            <div>
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" checked={alsoReverse} onChange={(e) => setAlsoReverse(e.target.checked)} />
                <Repeat size={15} /> Also create the reverse card (answer → question)
              </label>
              <p className="text-xs text-[var(--color-muted)] mt-1 ml-6">
                Makes a second card with the question and answer swapped, so you learn the fact in <b>both
                directions</b>. Example: &quot;Capital of France?&nbsp;→&nbsp;Paris&quot; also becomes
                &quot;Paris is the capital of…?&nbsp;→&nbsp;France&quot;. Both cards are scheduled independently.
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button onClick={save} className="btn btn-primary" disabled={saving}>{saving ? <Loader2 className="animate-spin" size={16} /> : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
