const SW_CLEANUP_JS = `
/* RTAUTOBOT legacy service worker cleanup.
 * This project no longer uses a service worker/PWA cache.
 * The file is kept so old browsers with an existing registration can update,
 * unregister themselves, and stop requesting /sw.js as a 404.
 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch (e) {}

    try {
      await self.registration.unregister();
    } catch (e) {}

    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        try { client.navigate(client.url); } catch (e) {}
      }
    } catch (e) {}
  })());
});

self.addEventListener('fetch', () => {
  // Intentionally do nothing. Network should be handled by the browser/Next.js.
});
`;

export const dynamic = 'force-static';

export function GET() {
  return new Response(SW_CLEANUP_JS, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Service-Worker-Allowed': '/',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
