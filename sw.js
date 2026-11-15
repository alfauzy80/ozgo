// Service Worker Sederhana untuk memenuhi standar PWA Chrome
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Aplikasi berhasil diinstal.');
});

self.addEventListener('fetch', (e) => {
    // Tidak melakukan cache apa-apa (hanya agar terbaca sistem sebagai PWA)
    e.respondWith(fetch(e.request));
});