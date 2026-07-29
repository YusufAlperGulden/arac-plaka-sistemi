const CACHE_NAME = 'plaka-sistemi-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/static/css/style.css',
  '/static/js/main.js',
  '/static/manifest.json',
  '/static/icon-192x192.png',
  '/static/icon-512x512.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  // Sadece GET isteklerini cachele
  if (event.request.method !== 'GET') return;
  
  // API isteklerini cache'e alma (Her zaman ağa git)
  if (event.request.url.includes('/api/')) {
      event.respondWith(fetch(event.request));
      return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache'te varsa onu döndür, yoksa internetten indir
        return response || fetch(event.request);
      })
  );
});
