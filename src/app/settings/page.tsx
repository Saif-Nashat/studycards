"use client";

import { useState } from "react";
import { Settings, Copy, Check, KeyRound, Sparkles, Package } from "lucide-react";
import { CLAUDE_PROMPT } from "@/lib/prompt";
import StoragePanel from "@/components/StoragePanel";

export default function SettingsPage() {
  const [copied, setCopied] = useState(false);

  function copyPrompt() {
    navigator.clipboard.writeText(CLAUDE_PROMPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Settings size={22} /> Settings &amp; help</h1>

      {/* Storage */}
      <StoragePanel />

      {/* Prompt */}
      <section className="card-surface p-6">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1"><Sparkles size={18} className="text-[var(--color-brand)]" /> Make cards on claude.ai</h2>
        <p className="text-[var(--color-muted)] text-sm mb-4">
          1. Click copy below. 2. Go to <b>claude.ai</b> and paste it. 3. Replace the last line with text copied from your MRCOG PDF.
          4. Claude replies with a JSON block — copy it. 5. Paste it into the <b>Import</b> page here.
        </p>
        <div className="relative">
          <pre className="bg-[#0f172a] text-[#e2e8f0] rounded-xl p-4 text-xs overflow-x-auto max-h-72 whitespace-pre-wrap">{CLAUDE_PROMPT}</pre>
          <button onClick={copyPrompt} className="btn btn-primary absolute top-3 right-3 py-1.5 px-3 text-sm">
            {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
          </button>
        </div>
      </section>

      {/* Free decks */}
      <section className="card-surface p-6">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1"><Package size={18} className="text-[var(--color-brand)]" /> Free USMLE / OB-GYN decks</h2>
        <p className="text-[var(--color-muted)] text-sm">
          Get free community Anki decks from <b>ankiweb.net/shared</b> — search for <b>AnKing</b>, <b>Zanki</b>, or <b>Lightyear</b> (Step 1 &amp; 2).
          Download the <code>.apkg</code> file and load it on the <b>Import → Anki deck</b> tab. These are free and community-made, so double-check facts as you study.
        </p>
      </section>

      {/* Password */}
      <section className="card-surface p-6">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1"><KeyRound size={18} className="text-[var(--color-brand)]" /> Change your password</h2>
        <p className="text-[var(--color-muted)] text-sm">
          Your password lives in a file called <code>.env</code> (when running on your laptop) or in your hosting settings (when online).
          To change it on your laptop, open <code>.env</code> in the <code>studycards</code> folder and edit the line
          <code className="block bg-[var(--color-surface-2)] rounded px-2 py-1 my-1">APP_PASSWORD=&quot;your-new-password&quot;</code>
          then restart the app. The deployment guide explains how to set it online.
        </p>
      </section>
    </div>
  );
}
