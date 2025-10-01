const CACHE_NAME = 'gmemo-cache-v1';
const urlsToCache = [
  './',
  './index.html',
  './css/bootstrap-icons-old.min.css',
  './css/bootstrap-icons.min.css',
  './css/bootstrap.min.css',
  './css/style.css',
  './icons/icon-192x192.png',
  './icons/icon-512x512-maskable.png',
  './icons/icon-512x512.png',
  './js/bootstrap.bundle.min.js',
  './js/fabric.min.js',
  './js/script.js',
  './js/supabase.js',
  './js/lodash.min.js',
  './webfonts/bootstrap-icons.woff',
  './webfonts/bootstrap-icons.woff2',
  './firstscreen.json',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Handle API requests that may fail when offline
  if (event.request.url.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Return a mock response when offline
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
  } else {
    // Handle regular requests with cache-first strategy
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(event.request).catch(() => {
            // For non-API requests, try to serve a fallback if we can't fetch
            if (event.request.destination === 'document') {
              return caches.match('./index.html');
            }
          });
        }
      )
    );
  }
});
