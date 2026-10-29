// Relative paths work with GitHub Pages project subpaths and custom domains.
// Change VERSION when updating the application files.
const CACHE_PREFIX = 'tone-comparison-pwa-';
const CACHE_NAME = CACHE_PREFIX + 'v1';
const APP_SHELL = [
  './', './index.html', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'
];
const OFFLINE_PAGE = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, clone)));
      }
      return response;
    }).catch(async () =>
      (await caches.match(request)) || (await caches.match(OFFLINE_PAGE)) || Response.error()
    ));
    return;
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) {
      const clone = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request, clone)));
    }
    return response;
  })));
});
