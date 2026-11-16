// ==========================================
// SERVICE WORKER OZgo App
// ==========================================

// 1. Tentukan nama versi Cache. 
// PENTING: Ubah angka ini (misal ke v2, v3) setiap kali Anda mengupdate file ozgo.html
const CACHE_VERSION = 'ozgo-v9';

// 2. Daftar file yang wajib disimpan di HP pengguna (App Shell)
const ASSETS_TO_CACHE = [
  './',
  './ozgo.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // Aset CDN (Tailwind & FontAwesome)
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// 3. PROSES INSTALL: Simpan semua file ke dalam Cache HP
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Paksa service worker baru langsung aktif
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      console.log('[SW] Membuka cache & menyimpan aset...');
      // Gunakan Promise.allSettled agar jika 1 aset gagal (misal internet putus), 
      // aset lain tetap tersimpan dan proses install tidak gagal total.
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

// 4. PROSES ACTIVATE: Hapus cache versi lama jika ada update
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
    }).then(() => self.clients.claim()) // Ambil kendali atas tab yang sedang terbuka
  );
});

// 5. PROSES FETCH: Strategi pengambilan data (Network First vs Cache First)
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Abaikan request selain GET (misal POST dari form)
  if (req.method !== 'GET') return;

  // Abaikan request dari ekstensi browser atau chrome-extension://
  if (!req.url.startsWith('http')) return;

  // A. Strategi untuk Halaman HTML (Network First)
  // Jika user buka aplikasi, coba ambil dari internet dulu (agar selalu update).
  // Jika internet mati, ambil dari cache.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          // Simpan versi terbaru ke cache
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(req, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Jika offline, tampilkan ozgo.html dari cache
          return caches.match('./ozgo.html');
        })
    );
    return;
  }

  // B. Strategi untuk Aset Statis/CSS/Gambar (Cache First)
  // Jika butuh gambar/CSS, cari di cache dulu (lebih cepat).
  // Jika tidak ada di cache, baru download dari internet.
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(req).then((response) => {
        // Jangan cache response yang gagal atau tidak valid
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }

        // Simpan ke cache untuk digunakan di masa depan
        const responseClone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => {
          cache.put(req, responseClone);
        });

        return response;
      }).catch(() => {
        // Jika offline & file tidak ada di cache & yang diminta adalah gambar, 
        // kembalikan gambar placeholder (opsional)
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