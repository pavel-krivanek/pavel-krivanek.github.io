'use strict';
const CACHE = 'metronome-tempo-v1';
const PRECACHE = [
  './', './index.html', './manifest.webmanifest', './service-worker.js',
  './icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(n => n.startsWith('metronome-tempo-') && n !== CACHE).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) { const clone=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(request,clone))); }
      return response;
    }).catch(() => caches.match(request).then(match => match || caches.match('./index.html'))));
  } else {
    event.respondWith(caches.match(request).then(match => match || fetch(request).then(response => {
      if (response.ok) {const clone=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(request,clone)));}
      return response;
    })));
  }
});
