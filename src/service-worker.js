// CashCount Service Worker — Offline-Cache der App-Shell.
// WICHTIG: Bei jeder Änderung an ausgelieferten Dateien CACHE_VERSION erhöhen
// und neue Dateien in APP_SHELL ergänzen (siehe CLAUDE.md).

const CACHE_VERSION = 'cashcount-v6';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/config.js',
  './js/money.js',
  './js/db.js',
  './js/exporter.js',
  './js/app.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first für die App-Shell; Netz nur als Fallback (App ist offline-first).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
