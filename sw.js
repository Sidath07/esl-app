// Small offline cache: app shell and content are cached after first use.
// 20261104105437 is replaced at build time (vite.config.js), so every deploy gets a fresh cache
// and the old one (with old content) is deleted on activate.
const CACHE = 'sfw-v2-20261104105437';
// Voice clips are cached on first play (not precached, so the first load stays small) and kept
// across deploys: a clip's file name is a hash of its text, so it never changes.
const AUDIO_CACHE = 'eme-voice-v1';
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest', './content/index.json'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k !== AUDIO_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.includes('/audio/')) {
    e.respondWith(
      caches.open(AUDIO_CACHE).then((c) =>
        c.match(e.request, { ignoreSearch: true }).then(
          (hit) => hit || fetch(e.request).then((res) => { if (res.ok && res.status === 200) c.put(e.request, res.clone()); return res; })
        )
      )
    );
    return;
  }
  if (url.pathname.includes('/assets/') || url.pathname.includes('/icons/')) {
    // Hashed build files never change: cache first.
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })));
    return;
  }
  // Pages and content: network first so updates arrive, cache as fallback for offline use.
  // Bypass the browser's HTTP cache (GitHub Pages sends max-age=600) so updates show at once.
  const fresh = e.request.mode === 'navigate' ? new Request(url.href, { cache: 'no-cache' }) : new Request(e.request, { cache: 'no-cache' });
  e.respondWith(
    fetch(fresh)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});
