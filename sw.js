const CACHE_NAME = 'gmemo-cache-v1';
const urlsToCache = [
  '/gMemo/',
  '/gMemo/index.html',
  '/gMemo/css/bootstrap-icons-old.min.css',
  '/gMemo/css/bootstrap-icons.min.css',
  '/gMemo/css/bootstrap.min.css',
  '/gMemo/css/style.css',
  '/gMemo/icons/icon-192x192.png',
  '/gMemo/icons/icon-512x512-maskable.png',
  '/gMemo/icons/icon-512x512.png',
  '/gMemo/js/bootstrap.bundle.min.js',
  '/gMemo/js/fabric.min.js',
  '/gMemo/js/script.js',
  '/gMemo/webfonts/bootstrap-icons.woff',
  '/gMemo/webfonts/bootstrap-icons.woff2'
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
