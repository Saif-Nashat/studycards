"use client";

import { useEffect } from "react";

// Cursor-tracking spotlight for interactive cards. One delegated,
// rAF-throttled pointermove listener writes --mx/--my custom properties onto
// whichever .card-lift element the pointer is over; globals.css paints a soft
// radial glow at that point. Renders nothing — it's pure behaviour.
export default function Spotlight() {
  useEffect(() => {
    let raf = 0;
    let lastEvent: PointerEvent | null = null;

    function paint() {
      raf = 0;
      const e = lastEvent;
      if (!e) return;
      const el = (e.target as Element | null)?.closest?.(".card-lift");
      if (!(el instanceof HTMLElement)) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(2)}%`);
      el.style.setProperty("--my", `${(((e.clientY - r.top) / r.height) * 100).toFixed(2)}%`);
    }

    function onMove(e: PointerEvent) {
      lastEvent = e;
      if (!raf) raf = requestAnimationFrame(paint);
    }

    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
