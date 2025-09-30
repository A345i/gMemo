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
  './webfonts/bootstrap-icons.woff2'
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
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
