const CACHE_NAME = 'plaka-sistemi-v18-persistent-fleet';
const CORE_ASSETS = [
  '/',
  '/static/css/style.css',
  '/static/js/auth.js',
  '/static/js/camera.js',
  '/static/js/ocr-utils.js',
  '/static/js/main.js',
  '/static/manifest.json',
  '/static/icon-192x192.png',
  '/static/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    if (request.mode === 'navigate') {
      const appShell = await cache.match('/');
      if (appShell) {
        return appShell;
      }
    }
    throw error;
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(networkFirst(event.request));
});
