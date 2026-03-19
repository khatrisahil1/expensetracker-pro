/* eslint-disable no-restricted-globals */

const CACHE_NAME = "expense-tracker-shell-v2";
const ASSET_CACHE = "expense-tracker-assets-v2";
const FALLBACK_PAGE = "/offline.html";

const OFFLINE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/favicon.ico",
  FALLBACK_PAGE,
];

const isNavigationRequest = (request) => request.mode === "navigate";
const isAssetRequest = (request) => {
  const url = new URL(request.url);
  return (
    url.origin === self.location.origin &&
    /\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|otf|json)$/.test(url.pathname)
  );
};

// Install: cache core shell and offline page
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== ASSET_CACHE) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch: runtime caching for assets + navigation fallback
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Navigation requests - network first, fallback to offline page
  if (isNavigationRequest(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Update the cache for the current page to allow offline navigation.
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return res;
        })
        .catch(() => caches.match(FALLBACK_PAGE))
    );
    return;
  }

  // Static assets - cache first, then network
  if (isAssetRequest(event.request)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type === "opaque") {
              return response;
            }
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(event.request, copy));
            return response;
          })
          .catch(() => cached);

        return cached || networkFetch;
      })
    );
    return;
  }

  // Default: try network, fallback to cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
