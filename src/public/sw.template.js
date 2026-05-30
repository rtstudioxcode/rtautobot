// =========================
// 🔑 VERSION (inject จาก server)
// =========================
const VERSION = "__CACHE_VERSION__";
const CACHE_NAME = `rtsmm-cache-${VERSION}`;

// =========================
// INSTALL
// =========================
self.addEventListener('install', event => {
  self.skipWaiting();
});

// =========================
// ACTIVATE (ล้าง cache เก่า)
// =========================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('rtsmm-cache-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// =========================
// 🔥 HELPER
// =========================
function shouldCache(req) {
  const url = req.url;

  if (req.method !== 'GET') return false;
  if (!url.startsWith(self.location.origin)) return false;
  if (url.includes('/api/pricing')) return false;

  return (
    url.includes('/api/service-groups') ||
    url.includes('/api/subcategories') ||
    url.includes('/api/platforms')
  );
}

// =========================
// FETCH (SWR SAFE)
// =========================
self.addEventListener('fetch', event => {
  const req = event.request;

  if (!shouldCache(req)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);

    if (cached) return cached;

    try {
      const res = await fetch(req);
      if (res && res.ok) {
        cache.put(req, res.clone());
      }
      return res;

    } catch {

      return new Response(
        JSON.stringify({ ok: false, offline: true }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
  })());
});