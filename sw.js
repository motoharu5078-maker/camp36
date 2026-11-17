// Service Worker：アプリ本体とフォントをキャッシュして、オフラインでも起動できるようにする。
// 更新するときは VERSION を上げる。

const VERSION = 'camp36-v1';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/fonts.css',
  './css/app.css',
  './js/app.js',
  './js/dates.js',
  './js/store.js',
  './js/data.js',
  './js/calc.js',
  './js/ui.js',
  './js/photos.js',
  './js/io.js',
  './js/forms.js',
  './js/chart.js',
  './js/views/today.js',
  './js/views/face.js',
  './js/views/gym.js',
  './js/views/roadmap.js',
  './js/views/book.js',
  './js/views/video.js',
  './js/views/settings.js',
  './js/views/setup.js',
  './js/views/letter.js',
  './js/views/final.js',
  './fonts/anton.woff2',
  './fonts/zenkaku-700.woff2',
  './fonts/zenkaku-900.woff2',
  './fonts/plexmono-400.woff2',
  './fonts/plexmono-600.woff2',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('camp36-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // YouTube などの外部はそのまま通す

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    // ?date=... などのクエリが付いていても、同じファイルとして扱う
    const cached = await cache.match(req, { ignoreSearch: true });

    // キャッシュがあればすぐ返し、裏で最新版を取りにいく（次に開いたとき反映される）
    const refresh = fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        const clean = new URL(req.url);
        clean.search = '';
        cache.put(clean.href, res.clone()).catch(() => {});
      }
      return res;
    }).catch(() => null);

    if (cached) {
      event.waitUntil(refresh);
      return cached;
    }
    const res = await refresh;
    if (res) return res;
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    return new Response('offline', { status: 503, statusText: 'offline' });
  })());
});
