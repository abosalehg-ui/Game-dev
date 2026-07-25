/* Service worker for "من الغرفة للقمة" PWA.
 * Strategy:
 *  - Pre-cache the app shell on install.
 *  - Network-first for navigations (so new releases ship immediately when
 *    online) with offline fallback to the cached index.
 *  - Stale-while-revalidate for same-origin static assets (icons, manifest).
 *  - Three.js AND the Cairo font are vendored locally under ./vendor/ and
 *    pre-cached as part of the app shell, so the game genuinely works offline from
 *    the first load. The font used to come from fonts.googleapis.com and was never
 *    pre-cached, which quietly broke that promise (and blocked first paint).
 *  - There are no third-party requests left, so no cross-origin caching rules.
 */

const VERSION = 'v1.4.0';
const APP_SHELL = `room-to-top-shell-${VERSION}`;
const RUNTIME = `room-to-top-runtime-${VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './vendor/three.module.js',
  './vendor/fonts/cairo-arabic.woff2',
  './vendor/fonts/cairo-latin.woff2',
  './vendor/fonts/cairo-latin-ext.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/icon-apple-180.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== APP_SHELL && k !== RUNTIME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1) Navigations → network-first, fall back to cached index.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 2) Same-origin static files → stale-while-revalidate.
  //    (A cache-first branch for fonts.googleapis.com / jsdelivr / unpkg / cdnjs
  //    used to live here. Nothing is loaded cross-origin any more, and leaving it
  //    in would have silently pinned any future CDN asset to its first response.)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((res) => {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(request, copy));
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});

// Allow the page to trigger an immediate activation after an update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
