// sw.js — service worker for offline shell caching.
//
// IMPORTANT: browsers only allow service workers over HTTPS or localhost.
// On http://<lan-ip>:8283/ this will fail to register — that's expected.
// The offline banner (in app.js) uses polling and works everywhere.
//
// Cache strategy:
//   - App shell (html, css, js, i18n, favicon, manifest): cache-first
//   - /api/*: never cached — always live
//   - third-party (CDN): passthrough, no caching

const CACHE = 'house-chat-v1';

const SHELL = [
  '/',
  '/index.html',
  '/app.css',
  '/favicon.svg',
  '/manifest.json',
  '/js/app.js',
  '/js/api.js',
  '/js/i18n.js',
  '/js/chat.js',
  '/js/context.js',
  '/js/sections.js',
  '/i18n/en.json',
  '/i18n/be.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => { /* some entries missing — install anyway */ })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // API: never cache.
  if (url.pathname.startsWith('/api/')) return;

  // Cross-origin (CDN): let the browser handle it.
  if (url.origin !== self.location.origin) return;

  // Same-origin shell: cache-first, fall back to network, fall back to index.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
