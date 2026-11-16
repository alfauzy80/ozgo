// ==========================================
// SERVICE WORKER OZgo App
// ==========================================
// PENTING: Naikkan CACHE_VERSION setiap kali
// Anda mengubah ozgo.html / manifest.json / aset statis.

const CACHE_VERSION = 'ozgo-v12';

const ASSETS_TO_CACHE = [
  './',
  './ozgo.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap',
  // Logo cover — di-cache agar setelah kunjungan pertama langsung instan
  'https://cdn.jsdelivr.net/gh/alfauzy80/ozgo@main/assets/logo.png',
  'https://raw.githubusercontent.com/alfauzy80/ozgo/main/assets/logo.png'
];

// INSTALL: simpan aset ke cache (tahan 1 aset gagal)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => {
          return cache.add(url).catch(err => {
            console.warn('[SW] Gagal menyimpan aset:', url, err);
          });
        })
      );
    })
  );
});

// ACTIVATE: hapus cache versi lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION) {
            console.log('[SW] Menghapus cache lama:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH: Network First untuk dokumen, Cache First untuk aset statis
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') return;
  if (!req.url.startsWith('http')) return;

  // A. Dokumen HTML → Network First (fallback ke cache)
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(req, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match('./ozgo.html').then(r => r || caches.match('./'));
        })
    );
    return;
  }

  // B. Aset statis (termasuk logo) → Cache First
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(req).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => {
          cache.put(req, responseClone);
        });
        return response;
      }).catch(() => {
        if (req.destination === 'image') {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#1f2937"/></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
      });
    })
  );
});