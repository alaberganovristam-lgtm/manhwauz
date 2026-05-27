/**
 * Manhwa UZ — Service Worker
 * Strategiyalar:
 *   - CSS/JS/Font: Cache-First (tez, offline ishlaydi)
 *   - Rasmlar (cover, chapters): Cache-First + network fallback
 *   - HTML sahifalar: Network-First (yangi kontent muhim)
 *   - API: Network-First, offline da cache qaytaradi
 */

var CACHE_STATIC  = 'muz-static-v1';
var CACHE_PAGES   = 'muz-pages-v1';
var CACHE_IMAGES  = 'muz-images-v1';
var CACHE_API     = 'muz-api-v1';

var STATIC_ASSETS = [
  '/',
  '/browse',
  '/_fix.js',
  '/manifest.json',
];

/* ── Install: asosiy resurslarni oldindan cache lash ── */
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_STATIC).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* ── Activate: eski cache larni tozalash ── */
self.addEventListener('activate', function (e) {
  var validCaches = [CACHE_STATIC, CACHE_PAGES, CACHE_IMAGES, CACHE_API];
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return validCaches.indexOf(k) === -1; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* ── Fetch: barcha tarmoq so'rovlarini tutib olish ── */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = new URL(req.url);

  // Faqat GET so'rovlarini cache laymiz
  if (req.method !== 'GET') return;

  // Chrome DevTools va boshqa tizim so'rovlari
  if (!url.origin.startsWith('http')) return;

  // API so'rovlari — Network-First
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(networkFirst(req, CACHE_API));
    return;
  }

  // Rasmlar — Cache-First
  if (/\.(webp|jpg|jpeg|png|gif|avif|svg)$/i.test(url.pathname)) {
    e.respondWith(cacheFirst(req, CACHE_IMAGES));
    return;
  }

  // CSS, JS, Font — Cache-First
  if (/\.(css|js|woff2?|ttf)$/i.test(url.pathname)) {
    e.respondWith(cacheFirst(req, CACHE_STATIC));
    return;
  }

  // HTML sahifalar — Network-First
  e.respondWith(networkFirst(req, CACHE_PAGES));
});

/* ── Network-First: avval internet, bo'lmasa cache ── */
function networkFirst(req, cacheName) {
  return fetch(req).then(function (res) {
    if (res.ok) {
      caches.open(cacheName).then(function (cache) {
        cache.put(req, res.clone());
      });
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (cached) {
      return cached || offlinePage();
    });
  });
}

/* ── Cache-First: avval cache, bo'lmasa internet ── */
function cacheFirst(req, cacheName) {
  return caches.match(req).then(function (cached) {
    if (cached) return cached;
    return fetch(req).then(function (res) {
      if (res.ok) {
        caches.open(cacheName).then(function (cache) {
          // Rasm cacheni 200 ta bilan cheklash
          if (cacheName === 'muz-images-v1') {
            cache.keys().then(function (keys) {
              if (keys.length > 200) cache.delete(keys[0]);
            });
          }
          cache.put(req, res.clone());
        });
      }
      return res;
    });
  });
}

/* ── Offline fallback sahifasi ── */
function offlinePage() {
  return new Response(
    '<!DOCTYPE html><html lang="uz"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Offline — Manhwa UZ</title>' +
    '<style>body{background:#13111A;color:#fff;font-family:sans-serif;' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'min-height:100vh;margin:0;text-align:center;padding:2rem}' +
    'h1{font-size:3rem;color:#913FE2;margin-bottom:.5rem}' +
    'p{color:rgba(255,255,255,.6);margin:.5rem 0}' +
    'button{color:#913FE2;background:none;margin-top:1.5rem;display:inline-block;' +
    'border:1.5px solid #913FE2;padding:.6rem 1.5rem;border-radius:.5rem;cursor:pointer;font-size:1rem}' +
    'button:hover{background:#913FE2;color:#fff}</style></head><body>' +
    '<h1>&#9888;</h1>' +
    '<h2>Internet aloqasi yo\'q</h2>' +
    '<p>Manhwa UZ ga kirish uchun internetga ulanish kerak.</p>' +
    '<p>Avval ko\'rgan sahifalaringiz mavjud bo\'lishi mumkin.</p>' +
    '<button onclick="location.reload()">Qayta urinish</button>' +
    '</body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
