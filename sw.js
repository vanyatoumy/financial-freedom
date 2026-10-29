// Offline cache: try the network first (so updates show up), fall back to the cache when offline.
const CACHE = 'financial-freedom-v10';
const FILES = [
  './', './manifest.webmanifest', './css/styles.css',
  './js/app.js', './js/store.js', './js/logic.js', './js/ui.js', './js/defaults.js', './js/icons.js',
  './js/views/dashboard.js', './js/views/add.js', './js/views/count.js', './js/views/loans.js',
  './js/views/invest.js', './js/views/subs.js', './js/views/history.js', './js/views/settings.js',
  './js/views/setup.js', './js/views/more.js', './js/views/jar.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
