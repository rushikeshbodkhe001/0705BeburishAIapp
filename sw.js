// Service Worker — caches app shell + scanner libraries for offline use
const CACHE = 'rish-ofs-v1';
const SHELL = [
  './',
  './index.html',
];
const RUNTIME_HOSTS = [
  'cdn.jsdelivr.net',
  'tessdata.projectnaptha.com',
  'world.openfoodfacts.org',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Cache-first for app shell + scanner libs/models
  if (url.origin === location.origin || RUNTIME_HOSTS.some(h => url.host.includes(h))) {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(req, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
  }
});
