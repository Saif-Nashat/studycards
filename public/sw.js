/* MediCards service worker.
 *
 * Two jobs:
 *   1. Make the app installable + usable offline — cache the app shell and the
 *      build's immutable static assets, with an offline fallback page.
 *   2. Background-sync study reviews — if a rating is submitted while offline,
 *      queue it in IndexedDB and replay it once the network (or a Background
 *      Sync event) comes back, so no review is silently lost.
 *
 * Hand-written on purpose (no Workbox / build step) so it stays legible and has
 * zero coupling to the Next build pipeline. Bump VERSION to force a cache reset.
 */

const VERSION = "v1";
const SHELL_CACHE = `medicards-shell-${VERSION}`;
const RUNTIME_CACHE = `medicards-runtime-${VERSION}`;
const OFFLINE_URL = "/offline";

// Auth-free assets safe to precache. cache.addAll is atomic, so every entry
// here must always return 200 without a session (see proxy.ts PUBLIC_PATHS).
const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // Take over as soon as we're ready instead of waiting for every tab to close.
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      // Control already-open pages, and drain anything queued from a past run.
      .then(() => self.clients.claim())
      .then(() => flushReviews().catch(() => {}))
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only ever touch our own origin (leave Clarity, fonts, etc. alone).
  if (url.origin !== self.location.origin) return;

  // Study reviews: keep them even when the network is down, replay them later.
  if (request.method === "POST" && url.pathname === "/api/study/review") {
    event.respondWith(handleReview(request));
    return;
  }

  // Every other mutation and every API GET goes straight to the network,
  // untouched — user data is never cached (a stale answer is worse than none).
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) return;

  // Page loads: network-first, so a fresh deploy is always picked up while
  // online; fall back to the last-seen shell, then the offline page.
  if (request.mode === "navigate") {
    event.respondWith(navigationHandler(request));
    return;
  }

  // Build assets are content-hashed and immutable → cache-first is safe + fast.
  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|ico|wasm|webmanifest)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Anything else GET: network-first with a cache fallback.
  event.respondWith(networkFirst(request));
});

// ---- Caching strategies ---------------------------------------------------

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && res.ok) (await caches.open(RUNTIME_CACHE)).put(request, res.clone());
    return res;
  } catch {
    return cached || Response.error();
  }
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    if (res && res.ok) (await caches.open(RUNTIME_CACHE)).put(request, res.clone());
    return res;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("offline and not cached");
  }
}

async function navigationHandler(request) {
  try {
    const res = await fetch(request);
    if (res && res.ok) (await caches.open(RUNTIME_CACHE)).put(request, res.clone());
    return res;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return (
      offline ||
      new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain" } })
    );
  }
}

// ---- Background sync for study reviews ------------------------------------

const DB_NAME = "medicards-sync";
const STORE = "review-queue";
const SYNC_TAG = "sync-reviews";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function queueReview(body) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).add({ body, ts: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

function allReviews() {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      })
  );
}

function deleteReview(id) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      })
  );
}

// Intercept a review POST: try the network, and only if that fails do we stash
// the rating and ask for a background sync. The app is told it's safely queued
// (202) so the study session keeps flowing exactly as if it had saved.
async function handleReview(request) {
  // A body can only be read once — grab it up front in case we need to queue it.
  let body = null;
  try {
    body = await request.clone().text();
  } catch {
    body = null;
  }

  try {
    return await fetch(request);
  } catch {
    if (body != null) {
      try {
        await queueReview(body);
        if ("sync" in self.registration) {
          await self.registration.sync.register(SYNC_TAG);
        }
      } catch {
        /* Background Sync unsupported (Safari/Firefox) — the client's
           reconnect message drains the queue instead. */
      }
    }
    return new Response(JSON.stringify({ ok: true, queued: true }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Replay every queued review in order. Throwing aborts the run so a Background
// Sync event will retry the survivors later.
async function flushReviews() {
  const items = await allReviews();
  for (const item of items) {
    const res = await fetch("/api/study/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: item.body,
      credentials: "same-origin",
    });
    // Any real HTTP response means the server handled it — a 2xx saved it, and a
    // 4xx (e.g. an expired session, a deleted card) will never save no matter
    // how often we retry. Either way, stop replaying this one. Only a 5xx or a
    // thrown network error leaves it queued for the next attempt.
    if (res.ok || (res.status >= 400 && res.status < 500)) {
      await deleteReview(item.id);
    } else {
      throw new Error(`review replay got ${res.status}`);
    }
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) event.waitUntil(flushReviews());
});

// Fallback drain for browsers without Background Sync: the page pokes us when it
// loads and whenever the connection returns.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data === "flush-reviews" || (data && data.type === "flush-reviews")) {
    event.waitUntil(flushReviews().catch(() => {}));
  }
});
