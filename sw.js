// ==========================================
// SERVICE WORKER OZgo App — v14
// Naikkan CACHE_VERSION setiap kali index.html /
// manifest.json / aset statis diubah.
// ==========================================
const CACHE_VERSION = 'ozgo-v14';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap',
  'https://cdn.jsdelivr.net/gh/alfauzy80/ozgo@main/assets/logo.png',
  'https://raw.githubusercontent.com/alfauzy80/ozgo/main/assets/logo.png'
];

// Precache tahan gagal + fallback no-cors untuk aset tanpa header CORS
async function precache(cache, url) {
  try { await cache.add(url); return; } catch (_) {}
  try {
    const res = await fetch(url, { mode: 'no-cors', cache: 'reload' });
    await cache.put(url, res);
  } catch (e) {
    console.warn('[SW] Gagal precache:', url, e);
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      Promise.allSettled(PRECACHE_ASSETS.map(url => precache(cache, url)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;

  // A. Dokumen → Network First, fallback cache
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.status === 200) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch {
        const cache = await caches.open(CACHE_VERSION);
        return (await cache.match(req))
          || (await cache.match('./index.html'))
          || (await cache.match('./'))
          || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
      }
    })());
    return;
  }

  // B. Aset → Stale-While-Revalidate
  event.respondWith((async () => {
    const networkPromise = fetch(req).then(res => {
      if (res && res.status === 200 && res.type !== 'opaque') {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, clone));
      }
      return res;
    }).catch(() => null);

    event.waitUntil(networkPromise.then(() => {}).catch(() => {}));

    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(req);
    if (cached) return cached;

    const fresh = await networkPromise;
    if (fresh) return fresh;

    if (req.destination === 'image') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#1f2937"/></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    return new Response('', { status: 504, statusText: 'Offline' });
  })());
});