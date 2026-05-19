/// <reference lib="webworker" />

/* eslint-disable no-restricted-globals */
declare const self: ServiceWorkerGlobalScope;

const SW_VERSION = "v1";
const CACHE_NAMES = {
  // Static shell — cached for the lifetime of the SW
  static: `retailos-static-${SW_VERSION}`,
  // API responses — stale-while-revalidate for 5 min
  api: `retailos-api-${SW_VERSION}`,
  // Fallback page so the app loads even when offline
  fallback: `retailos-fallback`,
};

// ── Assets to prefetch on install ──────────────────────────────────────────
const STATIC_ASSETS = [
  "/",
  "/_next/static/css/app/layout.css",
  "/_next/static/chunks/app/page.js",
  "/_next/static/chunks/app/layout.js",
  "/manifest.json",
  "/icons/icon-192.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAMES.static)
      .then((cache) => cache.addAll(STATIC_ASSETS.map((a) => new URL(a, self.location.origin).toString())))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    // Drop all old-version caches
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => !Object.values(CACHE_NAMES).includes(n))
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Network strategies ─────────────────────────────────────────────────────
function isNavigateRequest(req: Request): boolean {
  const dest = req.destination;
  return dest === "document" || req.mode === "navigate";
}

function isApiRequest(req: Request): boolean {
  const url = new URL(req.url);
  return url.pathname.startsWith("/api/");
}

function isStaticAsset(req: Request): boolean {
  const url = new URL(req.url);
  return (
    url.origin === self.location.origin &&
    (
      url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname === "/manifest.json"
    )
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle same-origin and GET requests
  if (new URL(req.url).origin !== self.location.origin) return;
  if (req.method !== "GET") return;

  if (isNavigateRequest(req)) {
    // Network-first for full-page navigations with offline fallback
    event.respondWith(networkFirstWithFallback(req));
    return;
  }

  if (isApiRequest(req)) {
    // Stale-while-revalidate: serve from cache immediately, update in background
    event.respondWith(staleWhileRevalidate(req, CACHE_NAMES.api, 5 * 60 * 1000));
    return;
  }

  if (isStaticAsset(req)) {
    // Cache-first for static files
    event.respondWith(cacheFirst(req, CACHE_NAMES.static));
    return;
  }
});

// ── Strategy: cache-first ──────────────────────────────────────────────────
async function cacheFirst(req: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  if (fresh.ok) {
    const cache = await caches.open(cacheName);
    cache.put(req, fresh.clone());
  }
  return fresh;
}

// ── Strategy: stale-while-revalidate ───────────────────────────────────────
async function staleWhileRevalidate(
  req: Request,
  cacheName: string,
  maxAgeMs: number,
): Promise<Response> {
  const cached = await caches.match(req);

  // Fire background fetch regardless
  const bgFetch = fetch(req)
    .then((fresh) => {
      if (fresh.ok) {
        // evict stale entries older than maxAgeMs
        purgeOld(cacheName, maxAgeMs);
        return caches.open(cacheName).then((cache) => cache.put(req, fresh));
      }
      return fresh;
    })
    .catch(() => undefined);

  // Return cached copy immediately if available
  if (cached) {
    bgFetch.then(() => undefined).catch(() => undefined);
    return cached;
  }

  // No cache — await the network
  const fresh = await bgFetch;
  if (fresh) return fresh;

  // Network also failed — serve empty JSON
  return new Response(JSON.stringify({ error: "offline" }), {
    headers: { "Content-Type": "application/json" },
  });
}

// ── Strategy: network-first with offline HTML fallback ─────────────────────
async function networkFirstWithFallback(req: Request): Promise<Response> {
  try {
    const fresh = await fetch(req);
    if (fresh.ok) {
      // Cache a copy of the successful navigated page
      const cache = await caches.open(CACHE_NAMES.fallback);
      cache.put(req, fresh.clone());
      return fresh;
    }
    throw new Error("response not ok");
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;

    // Closest offline-fallback page
    const fallback = await caches.match("/");
    return fallback ??
      new Response("RetailOS is offline. Please reconnect.", {
        headers: { "Content-Type": "text/plain" },
      });
  }
}

// ── House-keeping: remove entries older than maxAgeMs ──────────────────────
async function purgeOld(cacheName: string, maxAgeMs: number) {
  const cache = await caches.open(cacheName);
  const keys: string[] = [];
  for await (const req of cache.keys()) {
    keys.push(req.url);
  }
  await Promise.all(
    keys.map(async (url) => {
      try {
        const resp = await cache.match(url);
        if (!resp || !resp.headers.get("date")) return;
        const entryTime = new Date(resp.headers.get("date")!).getTime();
        if (Date.now() - entryTime > maxAgeMs) {
          await cache.delete(url);
        }
      } catch { /* ignore individual failures */ }
    })
  );
}

// ── Listen for skip-waiting from clients ───────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
