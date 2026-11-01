// Phone install support. Keeps ONLY the site's own page files so the dashboard opens fast and opens at all
// when offline. It never stores Google Drive data, the sign-in token, or anything from another address:
// Google requests are not touched (no respondWith), so they go straight to the network as before.
var CACHE = 'ljr-shell-v5'; // v5: factory, food and marketplace pages added (JOB 35). v4: house.css added. Bump this when the page files change.
var SHELL = [
  './', 'index.html', 'auth.js', 'config.js', 'toolkit.js', 'tokens.css', 'house.css', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
  'money/', 'money/index.html', 'money/core.js', 'cdhub/', 'cdhub/index.html', 'studio/', 'studio/index.html',
  'factory/', 'factory/index.html', 'food/', 'food/index.html', 'marketplace/', 'marketplace/index.html'
];
var BASE = self.registration ? new URL(self.registration.scope) : new URL('./', self.location);
var ALLOWED = SHELL.map(function (p) { return new URL(p, BASE).pathname; });

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// Network first (so a new version shows at once), the kept copy only when the network fails.
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || ALLOWED.indexOf(url.pathname) < 0) return;
  if (req.headers.get('Authorization')) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res.ok && res.type === 'basic') { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(url.pathname, copy); }); }
    return res;
  }, function () {
    return caches.match(url.pathname).then(function (hit) { return hit || caches.match(new URL('index.html', BASE).pathname); });
  }));
});
