"use client";

import { useEffect, useState } from "react";
import { Share, Plus, X } from "lucide-react";

// iOS Safari can't fire a programmatic install prompt (no beforeinstallprompt on
// WebKit), so the only way to install MediCards there is Share → Add to Home
// Screen. This dismissible hint shows those steps — but only on an iOS device
// that hasn't already installed the app, and only until the user dismisses it.
const DISMISS_KEY = "sc_ios_install_hint";

export default function IosInstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Deferred past the mount commit: the check reads only static browser facts,
    // so there's no reason to force a synchronous re-render cascade during the
    // first paint — and it lets hydration settle before the hint can appear.
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        if (localStorage.getItem(DISMISS_KEY)) return;
        const ua = window.navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
        // Already installed (launched from the home screen) — nothing to prompt.
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (window.navigator as unknown as { standalone?: boolean }).standalone === true;
        if (isIOS && !standalone) setShow(true);
      } catch {
        /* privacy-mode localStorage / no matchMedia — just don't show it */
      }
    });
    return () => { cancelled = true; };
  }, []);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-3 pointer-events-none">
      <div className="pointer-events-auto card-surface mx-auto max-w-md p-4 flex items-start gap-3 shadow-2xl fade-up"
        style={{ borderColor: "var(--color-brand)" }}>
        <span className="grid place-items-center w-10 h-10 rounded-xl shrink-0 text-[var(--color-brand)]"
          style={{ background: "var(--color-tint)" }}>
          <Share size={18} strokeWidth={1.75} />
        </span>
        <div className="flex-1 min-w-0 text-sm">
          <p className="font-semibold mb-0.5">Install MediCards</p>
          <p className="text-[var(--color-muted)]">
            Tap the Share button <Share size={13} className="inline align-[-2px]" /> in Safari, then
            choose <b className="text-[var(--color-ink)]">Add to Home Screen</b>{" "}
            <Plus size={13} className="inline align-[-2px]" /> to open it like an app.
          </p>
        </div>
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
