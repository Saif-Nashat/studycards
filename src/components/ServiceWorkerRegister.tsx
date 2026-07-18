"use client";

import { useEffect } from "react";

// Registers the service worker (public/sw.js) that makes MediCards installable +
// offline-capable and background-syncs study reviews. Purely an enhancement:
// every failure is swallowed so it can never block the app.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // Ask the worker to replay any reviews queued while offline.
    const flush = () => navigator.serviceWorker.controller?.postMessage("flush-reviews");

    navigator.serviceWorker
      // updateViaCache:"none" means the browser always revalidates sw.js itself,
      // so a new deploy's worker is picked up instead of a stale cached copy.
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => { /* SW unsupported or blocked — the app works without it */ });

    // Once the worker controls this page, drain the offline queue; also drain it
    // the moment the connection returns (covers browsers without Background Sync).
    navigator.serviceWorker.ready.then(flush).catch(() => {});
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);

  return null;
}
