/*
 * Donorly service worker.
 *
 * Strategy is deliberately conservative to avoid the stale-build problem:
 *  - /_next/static/* is content-hashed -> cache-first is always safe.
 *  - Fonts (Google Fonts) -> cache-first.
 *  - Navigations and API calls -> network only (never cached), so users
 *    always get the current build and live data.
 */
const STATIC_CACHE = "donorly-static-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;

  const isHashedStatic =
    url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
  const isFont =
    url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  const isIcon =
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.json");

  if (!isHashedStatic && !isFont && !isIcon) return; // network as usual

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    }),
  );
});
