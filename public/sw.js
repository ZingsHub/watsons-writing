/* Watson's Writing service worker: works offline after the first visit.
   Bump VERSION whenever index.html changes so devices pick up the new copy. */
const VERSION = 'ww-v7';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', '/audio/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)
    /* save every voice clip up front so her voice works offline too */
    .then(() => c.match('/audio/manifest.json')).then((r) => r.json())
    .then((m) => c.addAll(Object.values(m).filter((u, i, a) => a.indexOf(u) === i)))
    .catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
/* answer a byte-range request (Safari's <audio>) from a saved full copy */
function ranged(res, range) {
  return res.arrayBuffer().then((buf) => {
    const n = buf.byteLength, m = /^bytes=(\d*)-(\d*)$/.exec(range) || [];
    const start = m[1] ? +m[1] : m[2] ? Math.max(0, n - +m[2]) : 0;
    const end = m[1] && m[2] ? Math.min(+m[2], n - 1) : n - 1;
    if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + n } });
    return new Response(buf.slice(start, end + 1), { status: 206, headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Accept-Ranges': 'bytes',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + n, 'Content-Length': String(end - start + 1) } });
  });
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !fonts) return;
  /* pages: network first (so updates arrive), fall back to the saved copy when offline */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('/', copy)); return res; })
        .catch(() => caches.match('/'))
    );
    return;
  }
  /* voice clips requested in pieces: serve the piece from the saved clip, or go to the network */
  if (sameOrigin && req.headers.has('range')) {
    e.respondWith(caches.match(url.pathname).then((hit) => hit ? ranged(hit, req.headers.get('range')) : fetch(req)));
    return;
  }
  /* everything else: saved copy first, refresh it in the background */
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; }).catch(() => hit);
      return hit || net;
    })
  );
});
