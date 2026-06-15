"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check, Loader2, NotebookPen,
  Bold, Italic, Underline, Strikethrough,
  Heading1, Heading2, List, ListOrdered, Quote, RemoveFormatting,
} from "lucide-react";

// A self-contained editor for the app-wide notebook. Loads on mount, autosaves
// (debounced) as you type. Used full-screen on /notebook and inside the study drawer.
//
// Notes are stored as HTML so you can format them (headings, bold, lists, …).
// Older notebooks were saved as plain text; we detect that and convert on load so
// nothing is lost.

const PLACEHOLDER =
  "Write anything here — summaries, things to look up, mnemonics, reminders. Use the toolbar to add headings, bold, and lists. It stays across all your sessions.";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Decide whether stored content is already HTML or legacy plain text, and return
// HTML safe to drop into the editor.
function toHtml(stored: string): string {
  if (!stored) return "";
  // Heuristic: real saved notes contain at least one HTML tag we emit.
  const looksLikeHtml = /<(p|div|br|h[1-3]|ul|ol|li|strong|em|b|i|u|a|blockquote|s)\b/i.test(stored);
  if (looksLikeHtml) return stored;
  // Legacy plain text: escape it and keep line breaks.
  return escapeHtml(stored).replace(/\r?\n/g, "<br>");
}

type Cmd =
  | { kind: "inline"; command: string }
  | { kind: "block"; tag: string }
  | { kind: "list"; command: "insertUnorderedList" | "insertOrderedList" }
  | { kind: "clear" };

interface Tool {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  cmd: Cmd;
  // For showing the pressed/active state.
  active?: () => boolean;
}

export default function NotebookEditor({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [, force] = useState(0); // re-render to refresh toolbar active states
  const editorRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load once and seed the editor's HTML directly (so the caret never jumps).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/notebook")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (editorRef.current) editorRef.current.innerHTML = toHtml(d.content || "");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const save = useCallback(() => {
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const html = editorRef.current?.innerHTML ?? "";
      await fetch("/api/notebook", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: html }),
      }).catch(() => {});
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    }, 700);
  }, []);

  // Apply a formatting command to the current selection, then keep focus + save.
  function run(cmd: Cmd) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    try {
      if (cmd.kind === "inline") document.execCommand(cmd.command);
      else if (cmd.kind === "list") document.execCommand(cmd.command);
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
    force((n) => n + 1);
    save();
  }

  const tools: (Tool | "divider")[] = [
    { icon: Bold, title: "Bold (Ctrl+B)", cmd: { kind: "inline", command: "bold" }, active: () => queryState("bold") },
    { icon: Italic, title: "Italic (Ctrl+I)", cmd: { kind: "inline", command: "italic" }, active: () => queryState("italic") },
    { icon: Underline, title: "Underline (Ctrl+U)", cmd: { kind: "inline", command: "underline" }, active: () => queryState("underline") },
    { icon: Strikethrough, title: "Strikethrough", cmd: { kind: "inline", command: "strikeThrough" }, active: () => queryState("strikeThrough") },
    "divider",
    { icon: Heading1, title: "Heading", cmd: { kind: "block", tag: "h1" }, active: () => currentBlockTag() === "h1" },
    { icon: Heading2, title: "Subheading", cmd: { kind: "block", tag: "h2" }, active: () => currentBlockTag() === "h2" },
    { icon: Quote, title: "Quote", cmd: { kind: "block", tag: "blockquote" }, active: () => currentBlockTag() === "blockquote" },
    "divider",
    { icon: List, title: "Bullet list", cmd: { kind: "list", command: "insertUnorderedList" }, active: () => queryState("insertUnorderedList") },
    { icon: ListOrdered, title: "Numbered list", cmd: { kind: "list", command: "insertOrderedList" }, active: () => queryState("insertOrderedList") },
    "divider",
    { icon: RemoveFormatting, title: "Clear formatting", cmd: { kind: "clear" } },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <span className="text-sm text-[var(--color-muted)] flex items-center gap-1.5"><NotebookPen size={15} /> Auto-saved to this device&apos;s database</span>
        <span className="text-xs text-[var(--color-muted)] flex items-center gap-1">
          {status === "saving" && <><Loader2 size={12} className="animate-spin" /> Saving…</>}
          {status === "saved" && <><Check size={12} className="text-[var(--color-good)]" /> Saved</>}
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
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-[var(--color-muted)]"><Loader2 className="animate-spin" /></div>
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          data-placeholder={PLACEHOLDER}
          onInput={save}
          onKeyUp={() => force((n) => n + 1)}
          onMouseUp={() => force((n) => n + 1)}
          className={`rich-text input font-sans overflow-y-auto w-full flex-1 ${compact ? "min-h-[55vh]" : "min-h-[65vh]"}`}
        />
      )}
    </div>
  );
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
