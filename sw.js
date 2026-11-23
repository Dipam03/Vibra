const CACHE = 'vibra-shell-v3-0';
const SHELL = ['./', './index.html', './styles.css', './app.js', './config.js', './manifest.webmanifest', './assets/icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin || u.pathname.includes('/api/')) return;
  e.respondWith(fetch(e.request).then(resp => {
    const clone = resp.clone();
    if (resp.ok && (u.pathname.endsWith('.css') || u.pathname.endsWith('.js') || u.pathname.endsWith('.html'))) caches.open(CACHE).then(c => c.put(e.request, clone));
    return resp;
  }).catch(() => caches.match(e.request)));
});
