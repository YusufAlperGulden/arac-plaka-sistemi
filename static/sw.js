const CACHE_NAME = 'arac-plaka-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/static/css/style.css',
  '/static/js/main.js',
  '/static/manifest.json',
  '/static/icon-192x192.png',
  '/static/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Düşük öncelikli basit cache stratejisi: Cache'de varsa onu ver, yoksa ağdan al.
      return response || fetch(event.request);
    })
  );
});
