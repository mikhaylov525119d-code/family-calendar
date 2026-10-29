// Keeps the app opening without internet. Data itself is cached by Firestore.
// App files: network first, so updates arrive at once; the cache is the offline fallback.
// Firebase SDK files are versioned in the URL, so they are served from the cache.
const CACHE = 'fc-v3';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/util.js', 'js/dates.js', 'js/recur.js', 'js/push.js', 'js/config.js', 'js/firebase.js', 'js/store.js',
  'js/session.js', 'js/state.js', 'js/events.js', 'js/ui.js', 'js/render.js', 'js/checklist.js',
  'js/views/login.js', 'js/views/calendar.js', 'js/views/sheets.js', 'js/views/lists.js', 'js/views/settings.js',
  'icons/apple-touch-icon.png', 'icons/icon-192.png',
];
const SDK = 'https://www.gstatic.com/firebasejs/';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Payload from notifier/notify.js: { title, body, tag, url }
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data?.json() || {}; } catch { d = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Семейный календарь', {
    body: d.body || '',
    tag: d.tag,
    icon: 'icons/icon-192.png',
    data: { url: d.url || './' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const open = list[0];
    if (!open) return self.clients.openWindow(url);
    open.postMessage({ type: 'open', url });
    return open.focus();
  }));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (req.url.startsWith(SDK)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    })));
    return;
  }

  if (new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html'))),
  );
});
