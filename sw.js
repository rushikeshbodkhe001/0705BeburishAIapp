// Service Worker — caches scanner libs offline; HTML is always fresh.
const CACHE = 'rish-ofs-v8-2026-04-28-popups';
const RUNTIME_HOSTS = [
  'cdn.jsdelivr.net',
  'tessdata.projectnaptha.com',
  'unpkg.com',
  'world.openfoodfacts.org',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];
// Try to pre-fetch the heavy stuff so it's ready offline
const PRECACHE_BEST_EFFORT = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(PRECACHE_BEST_EFFORT.map(u =>
      fetch(u, { mode: 'cors' }).then(r => r.ok ? c.put(u, r) : null).catch(()=>{})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    // Wipe ALL old caches
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    // Take control of any open page immediately
    await self.clients.claim();
    // Force-reload every controlled page so they pick up the new HTML
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    list.forEach(c => { try { c.navigate ? c.navigate(c.url) : c.postMessage({ type: 'RELOAD' }); } catch(e){} });
  })());
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
