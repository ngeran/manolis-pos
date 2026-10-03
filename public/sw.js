/*
 * Service worker — installability + offline app shell.
 * Static assets & fonts: cache-first (immutable/hashed).
 * Navigations: network-first (4s timeout) → cache → /offline page.
 * API calls: never intercepted (the app shows stale-data banners itself).
 */
const VERSION = "v1";
const SHELL_CACHE = `manolis-shell-${VERSION}`;
const ASSET_CACHE = `manolis-assets-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
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
            .filter((k) => ![SHELL_CACHE, ASSET_CACHE].includes(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Cross-origin: Google Fonts (Material Symbols, Outfit) — cache-first so
  // icons render offline. Everything else cross-origin: ignore.
  if (url.origin !== self.location.origin) {
    if (/fonts\.(gstatic|googleapis)\.com$/.test(url.hostname)) {
      event.respondWith(cacheFirst(req, ASSET_CACHE));
    }
    return;
  }

  // Same-origin API: always network (the UI handles offline state).
  if (url.pathname.startsWith("/api/")) return;

  // Immutable hashed assets and images: cache-first.
  if (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname.startsWith("/icons/") ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req, ASSET_CACHE));
    return;
  }

  // Page navigations: network-first with offline fallback.
  if (req.mode === "navigate") {
    event.respondWith(networkFirstNavigation(req));
  }
});

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") {
    const cache = await caches.open(cacheName);
    cache.put(req, res.clone());
  }
  return res;
}

async function networkFirstNavigation(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(req, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    const offline = await cache.match(OFFLINE_URL);
    return offline || Response.error();
  }
}
