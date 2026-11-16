// Service Worker OZgo App
const CACHE_VERSION = 'ozgo-v12'; // Naikkan versi setiap update
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './logo.png', // <-- LOGO DIMASUKKAN KE SINI AGAR CACHED
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 1. Install: Simpan semua file ke Cache HP
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn('Gagal cache:', url)))
      );
    })
  );
});

// 2. Activate: Hapus cache lama jika ada update versi
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch: Ambil dari cache dulu (Cache First), jika tidak ada baru ke internet
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(req).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const responseClone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, responseClone));
        return response;
      }).catch(() => {
        // Jika offline & yang diminta adalah halaman, tampilkan index.html
        if (req.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});