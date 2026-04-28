// Service Worker — caches scanner libs offline; HTML is always fresh.
const CACHE = 'rish-ofs-v3';
const RUNTIME_HOSTS = [
  'cdn.jsdelivr.net',
  'tessdata.projectnaptha.com',
  'world.openfoodfacts.org',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App HTML/JS/CSS from same origin → NETWORK FIRST so updates land instantly
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Heavy 3rd-party libs (ZXing/Tesseract/fonts) → CACHE FIRST for offline
  if (RUNTIME_HOSTS.some(h => url.host.includes(h))) {
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
