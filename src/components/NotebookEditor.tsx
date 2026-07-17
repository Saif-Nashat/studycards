"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check, Loader2, NotebookPen, AlertTriangle, CloudOff, RefreshCw, Eraser,
  Bold, Underline, Strikethrough,
  List, ListOrdered, Quote, RemoveFormatting,
  Highlighter, Type, AlignLeft, AlignCenter, AlignRight,
} from "lucide-react";

// A self-contained editor for the app-wide notebook. Loads on mount, autosaves
// (debounced) as you type. Used full-screen on /notebook and inside the study drawer.
//
// Notes are stored as HTML so you can format them (headings, bold, lists, …).
// Older notebooks were saved as plain text; we detect that and convert on load so
// nothing is lost.

const PLACEHOLDER = "Write anything here — it saves automatically.";

// Mirror the server ceiling in /api/notebook so we fail fast with a clear
// message instead of firing a doomed multi-MB request from a phone.
const MAX_NOTEBOOK_CHARS = 2_000_000;
// Cap pasted images so a couple of phone screenshots can't blow past the limit.
const PASTED_IMAGE_MAX_DIM = 1280;

// Shrink a pasted image file to a data URI small enough to live in a note.
async function compressImageToDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, PASTED_IMAGE_MAX_DIM / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) { bmp.close?.(); return ""; }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  // WebP is far smaller; browsers that can't encode it fall back to PNG.
  return canvas.toDataURL("image/webp", 0.7);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Decide whether stored content is already HTML or legacy plain text, and return
// HTML safe to drop into the editor.
function toHtml(stored: string): string {
  if (!stored) return "";
  // Heuristic: real saved notes contain at least one HTML tag we emit. Includes
  // font/span so notes that only use colour, highlight or size still count as HTML.
  const looksLikeHtml = /<(p|div|br|h[1-3]|ul|ol|li|strong|em|b|i|u|a|blockquote|s|font|span)\b/i.test(stored);
  if (looksLikeHtml) return stored;
  // Legacy plain text: escape it and keep line breaks.
  return escapeHtml(stored).replace(/\r?\n/g, "<br>");
}

type Cmd =
  | { kind: "inline"; command: string }
  | { kind: "block"; tag: string }
  | { kind: "list"; command: "insertUnorderedList" | "insertOrderedList" }
  | { kind: "listRoman" }
  | { kind: "align"; command: "justifyLeft" | "justifyCenter" | "justifyRight" }
  | { kind: "color"; command: "hiliteColor"; value: string }
  | { kind: "fontSize"; value: string }
  | { kind: "clear" };

interface Tool {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  cmd: Cmd;
  // For showing the pressed/active state.
  active?: () => boolean;
}

// Highlight swatches. Highlighted text always gets forced dark ink (see the
// `.rich-text span[style*="background-color"]` rule in globals.css), so every
// swatch here must stay LIGHT enough for that dark ink to read — while being
// saturated enough to show clearly on the dark-theme surface too. That keeps a
// highlight looking identical and legible in both light and dark themes.
const HIGHLIGHT_COLORS = ["#fde68a", "#fca5a5", "#fdba74", "#86efac", "#7dd3fc", "#c4b5fd", "#f9a8d4", "#5eead4"];
// Only three sizes now — mapped onto execCommand's font-size scale. "Small" is
// the old normal (3), "Medium" the old large (5), "Large" the old huge (6).
const FONT_SIZES = [
  { label: "Small", value: "3" },
  { label: "Medium", value: "5" },
  { label: "Large", value: "6" },
];

export default function NotebookEditor({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, force] = useState(0); // re-render to refresh toolbar active states
  // Which popover (if any) is open: list style, highlight colour, or font size.
  const [openMenu, setOpenMenu] = useState<null | "list" | "highlight" | "size">(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  // Toolbar active-state refreshes coalesce into one per frame — recomputing
  // ~15 queryCommandState calls on every keystroke is real jank on phones.
  const refreshRaf = useRef(0);
  // The selection is lost when a toolbar control steals focus, so we stash the
  // active Range on mousedown and restore it before applying a colour/size.
  const savedRange = useRef<Range | null>(null);

  function rememberSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreSelection() {
    const r = savedRange.current;
    if (!r) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(r);
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (refreshRaf.current) cancelAnimationFrame(refreshRaf.current);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Load the notebook and seed the editor's HTML directly (so the caret never
  // jumps). On failure we must NOT hand the editor an empty document — the next
  // autosave would then overwrite the real notes with nothing. Show a retry.
  const load = useCallback(() => {
    fetch("/api/notebook")
      .then(async (r) => {
        if (!r.ok) throw new Error(`load failed: ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!mounted.current) return;
        if (editorRef.current) editorRef.current.innerHTML = toHtml(d.content || "");
        setLoading(false);
      })
      .catch(() => {
        if (!mounted.current) return;
        setLoadFailed(true);
        setLoading(false);
      });
  }, []);

  // Initial fetch: the editor starts in its loading state, so `load` only needs
  // to set state from inside its async callbacks (no synchronous setState here).
  useEffect(() => { load(); }, [load]);

  // Retry button: reset to the loading state, then fetch again.
  const retryLoad = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    load();
  }, [load]);

  const save = useCallback(() => {
    // Skip the flicker of re-rendering "Saving…" on every keystroke.
    setStatus((prev) => (prev === "saving" ? prev : "saving"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const html = editorRef.current?.innerHTML ?? "";
      if (html.length > MAX_NOTEBOOK_CHARS) {
        if (mounted.current) setStatus("error");
        return;
      }
      try {
        const res = await fetch("/api/notebook", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: html }),
        });
        if (!mounted.current) return;
        // The old code always claimed "Saved" even on a rejected save (over the
        // size limit, or Vercel's request cap) — the note was silently lost.
        setStatus(res.ok ? "saved" : "error");
        if (res.ok) setTimeout(() => { if (mounted.current) setStatus("idle"); }, 1500);
      } catch {
        if (mounted.current) setStatus("error");
      }
    }, 700);
  }, []);

  // Coalesced toolbar refresh (see refreshRaf above).
  const refreshToolbar = useCallback(() => {
    if (refreshRaf.current) return;
    refreshRaf.current = requestAnimationFrame(() => {
      refreshRaf.current = 0;
      force((n) => n + 1);
    });
  }, []);

  // Compress pasted images before they enter the note. Everything else pastes
  // as PLAIN text: a native paste carries the source page's fonts, colours and
  // highlights into the note, and that styling is almost never what the user
  // wants — formatting belongs to the toolbar here, not to wherever the text
  // was copied from.
  const onPaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageItem = Array.from(items).find((it) => it.kind === "file" && it.type.startsWith("image/"));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (!file) return;
      e.preventDefault();
      compressImageToDataUrl(file)
        .then((url) => {
          if (!url || !editorRef.current) return;
          editorRef.current.focus();
          document.execCommand("insertHTML", false, `<img src="${url}" style="max-width:100%">`);
          save();
        })
        .catch(() => { /* drop the paste rather than bloat the note past the limit */ });
      return;
    }
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    // insertText (not innerHTML surgery) keeps the caret position, the user's
    // undo history, and any formatting they've already toggled on at the caret.
    if (text) document.execCommand("insertText", false, text);
  }, [save]);

  // Apply a formatting command to the current selection, then keep focus + save.
  function run(cmd: Cmd) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    // Colour/size controls live outside the editor, so the selection was lost on
    // click — put it back before running the command.
    if (cmd.kind === "color" || cmd.kind === "fontSize") restoreSelection();
    try {
      if (cmd.kind === "inline") document.execCommand(cmd.command);
      else if (cmd.kind === "list") document.execCommand(cmd.command);
      else if (cmd.kind === "listRoman") {
        // No native "roman list" command: make an ordered list, then switch the
        // enclosing <ol> to lower-roman numbering via an inline style (which
        // beats the `list-style: decimal` stylesheet rule).
        document.execCommand("insertOrderedList");
        nearestOrderedList()?.style.setProperty("list-style-type", "lower-roman");
      }
      else if (cmd.kind === "align") document.execCommand(cmd.command);
      else if (cmd.kind === "color") {
        // Emit an inline-style span (not the deprecated <font>) carrying the
        // background-color, which the CSS highlight rule then keys off to force
        // legible dark ink on top — so highlights read in light and dark alike.
        document.execCommand("styleWithCSS", false, "true");
        document.execCommand(cmd.command, false, cmd.value);
        document.execCommand("styleWithCSS", false, "false");
      }
      else if (cmd.kind === "fontSize") document.execCommand("fontSize", false, cmd.value);
      else if (cmd.kind === "clear") {
        document.execCommand("removeFormat");
        document.execCommand("formatBlock", false, "p");
      } else if (cmd.kind === "block") {
        // Toggle the block: if we're already in this tag, drop back to a paragraph.
        const current = currentBlockTag();
        document.execCommand("formatBlock", false, current === cmd.tag ? "p" : cmd.tag);
      }
    } catch {
      /* execCommand can throw in odd selection states — ignore */
    }
    setOpenMenu(null);
    force((n) => n + 1);
    save();
  }

  const tools: (Tool | "divider")[] = [
    { icon: Bold, title: "Bold (Ctrl+B)", cmd: { kind: "inline", command: "bold" }, active: () => queryState("bold") },
    { icon: Underline, title: "Underline (Ctrl+U)", cmd: { kind: "inline", command: "underline" }, active: () => queryState("underline") },
    { icon: Strikethrough, title: "Strikethrough", cmd: { kind: "inline", command: "strikeThrough" }, active: () => queryState("strikeThrough") },
    "divider",
    { icon: Quote, title: "Quote", cmd: { kind: "block", tag: "blockquote" }, active: () => currentBlockTag() === "blockquote" },
    "divider",
    { icon: AlignLeft, title: "Align left", cmd: { kind: "align", command: "justifyLeft" }, active: () => queryState("justifyLeft") },
    { icon: AlignCenter, title: "Align centre", cmd: { kind: "align", command: "justifyCenter" }, active: () => queryState("justifyCenter") },
    { icon: AlignRight, title: "Align right", cmd: { kind: "align", command: "justifyRight" }, active: () => queryState("justifyRight") },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <span className="text-sm text-[var(--color-muted)] flex items-center gap-1.5"><NotebookPen size={15} /> Auto-saved to this device&apos;s database</span>
        <span className="text-xs text-[var(--color-muted)] flex items-center gap-1">
          {status === "saving" && <><Loader2 size={12} className="animate-spin" /> Saving…</>}
          {status === "saved" && <><Check size={12} className="text-[var(--color-good)]" /> Saved</>}
          {status === "error" && <span className="text-[var(--color-again)] flex items-center gap-1"><AlertTriangle size={12} /> Not saved — note may be too large</span>}
        </span>
      </div>

      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 mb-2 p-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] flex-wrap">
        {tools.map((t, i) =>
          t === "divider" ? (
            <span key={i} className="w-px h-5 bg-[var(--color-line)] mx-1" />
          ) : (
            <button
              key={i}
              type="button"
              title={t.title}
              aria-label={t.title}
              data-active={t.active?.() ? "true" : "false"}
              className="rt-tool"
              // Keep the text selection while clicking the button.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => run(t.cmd)}
            >
              <t.icon size={16} />
            </button>
          )
        )}

        <span className="w-px h-5 bg-[var(--color-line)] mx-1" />

        {/* Lists — bullet / numbered / roman collapsed into one dropdown */}
        <MenuButton id="list" icon={List} title="Lists" openMenu={openMenu} setOpenMenu={setOpenMenu} onRemember={rememberSelection}>
          <div className="flex flex-col gap-0.5 w-max">
            <button type="button" className="rt-size-item flex items-center gap-2 text-left px-2.5 py-1 rounded-md hover:bg-[var(--color-surface-2)] whitespace-nowrap"
              onClick={() => run({ kind: "list", command: "insertUnorderedList" })}>
              <List size={14} /> Bullet list
            </button>
            <button type="button" className="rt-size-item flex items-center gap-2 text-left px-2.5 py-1 rounded-md hover:bg-[var(--color-surface-2)] whitespace-nowrap"
              onClick={() => run({ kind: "list", command: "insertOrderedList" })}>
              <ListOrdered size={14} /> Numbered list
            </button>
            <button type="button" className="rt-size-item flex items-center gap-2 text-left px-2.5 py-1 rounded-md hover:bg-[var(--color-surface-2)] whitespace-nowrap"
              onClick={() => run({ kind: "listRoman" })}>
              <span className="w-3.5 text-center text-xs font-semibold italic">i</span> Roman list
            </button>
          </div>
        </MenuButton>

        {/* Highlight colour */}
        <MenuButton id="highlight" icon={Highlighter} title="Highlight colour" openMenu={openMenu} setOpenMenu={setOpenMenu} onRemember={rememberSelection}>
          <div className="grid grid-cols-4 gap-1.5 w-max">
            {HIGHLIGHT_COLORS.map((c) => (
              <button key={c} type="button" title={c} className="w-6 h-6 rounded-md border border-[var(--color-line)]"
                style={{ background: c }} onClick={() => run({ kind: "color", command: "hiliteColor", value: c })} />
            ))}
            <button type="button" title="No highlight" className="w-6 h-6 rounded-md border border-[var(--color-line)] grid place-items-center text-[var(--color-muted)]"
              onClick={() => run({ kind: "color", command: "hiliteColor", value: "transparent" })}>
              <RemoveFormatting size={13} />
            </button>
          </div>
        </MenuButton>

        {/* Font size */}
        <MenuButton id="size" icon={Type} title="Text size" openMenu={openMenu} setOpenMenu={setOpenMenu} onRemember={rememberSelection}>
          <div className="flex flex-col gap-0.5 w-max">
            {FONT_SIZES.map((s) => (
              <button key={s.value} type="button" className="rt-size-item text-left px-2.5 py-1 rounded-md hover:bg-[var(--color-surface-2)] whitespace-nowrap"
                onClick={() => run({ kind: "fontSize", value: s.value })}>
                {s.label}
              </button>
            ))}
          </div>
        </MenuButton>

        <span className="w-px h-5 bg-[var(--color-line)] mx-1" />

        {/* Clear formatting — deliberately a labelled, tinted button (not just an
            icon) so it's obvious and hard to hit by accident. */}
        <button
          type="button"
          title="Clear all formatting from the selected text"
          aria-label="Clear formatting"
          className="rt-clear"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run({ kind: "clear" })}
        >
          <Eraser size={14} /> Clear
        </button>
      </div>

      {loadFailed ? (
        <div className="grid place-items-center flex-1 text-center px-4">
          <div>
            <CloudOff size={26} className="mx-auto mb-2 text-[var(--color-muted)]" />
            <p className="text-sm text-[var(--color-muted)] mb-3 max-w-xs">Couldn&apos;t load your notebook. Your notes are safe on the server — check your connection and try again.</p>
            <button type="button" onClick={retryLoad} className="btn btn-primary py-2"><RefreshCw size={15} /> Try again</button>
          </div>
        </div>
      ) : (
        <div className="relative flex-1 min-h-0 flex flex-col">
          {loading && (
            <div className="absolute inset-0 z-10 grid place-items-center text-[var(--color-muted)] bg-[var(--color-surface)]"><Loader2 className="animate-spin" /></div>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            dir="auto"
            role="textbox"
            aria-multiline="true"
            data-placeholder={PLACEHOLDER}
            onInput={save}
            onKeyUp={refreshToolbar}
            onMouseUp={refreshToolbar}
            onPaste={onPaste}
            className={`rich-text input font-sans overflow-y-auto w-full flex-1 ${compact ? "min-h-[55vh]" : "min-h-[65vh]"}`}
          />
        </div>
      )}
    </div>
  );
}

// A colour / size popover button: remembers the selection on mousedown (before
// focus moves to the toolbar), then opens a small palette. Defined at module
// scope so it isn't re-created on every render of the editor.
type MenuId = "list" | "highlight" | "size";
function MenuButton({
  id, icon: Icon, title, openMenu, setOpenMenu, onRemember, children,
}: {
  id: MenuId;
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  openMenu: MenuId | null;
  setOpenMenu: React.Dispatch<React.SetStateAction<MenuId | null>>;
  onRemember: () => void;
  children: React.ReactNode;
}) {
  return (
    <span className="relative">
      <button
        type="button"
        title={title}
        aria-label={title}
        data-active={openMenu === id ? "true" : "false"}
        className="rt-tool"
        onMouseDown={(e) => { e.preventDefault(); onRemember(); }}
        onClick={() => setOpenMenu((m) => (m === id ? null : id))}
      >
        <Icon size={16} />
      </button>
      {openMenu === id && (
        <div className="absolute z-20 top-full left-0 mt-1 p-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] shadow-lg" onMouseDown={(e) => e.preventDefault()}>
          {children}
        </div>
      )}
    </span>
  );
}

// The <ol> the caret currently sits inside, if any — used to retag a fresh
// ordered list as lower-roman.
function nearestOrderedList(): HTMLElement | null {
  const sel = window.getSelection();
  const node = sel && sel.rangeCount > 0 ? sel.anchorNode : null;
  const el = node ? (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element)) : null;
  return (el?.closest?.("ol") as HTMLElement | null) ?? null;
}

// Whether the given inline/list command is currently applied at the caret.
function queryState(command: string): boolean {
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
}

// The block-level tag the caret currently sits in (h1/h2/blockquote/p/…).
function currentBlockTag(): string {
  try {
    const v = document.queryCommandValue("formatBlock");
    return String(v || "").toLowerCase();
  } catch {
    return "";
  }
}
