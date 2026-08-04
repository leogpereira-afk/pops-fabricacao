// Service worker do Pops & Fabricação. Shell cacheado pra abrir sem sinal no
// chão de fábrica; API NUNCA passa pelo cache (bypass por host supabase.co).
const CACHE = 'pops-shell-v3';
const SHELL = ['./', './index.html', './styles.css', './config.js', './auth.js',
  './store.js', './app.js', './logo-impresilk.png', './manifest.webmanifest'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.endsWith('supabase.co')) return;   // API sempre fresca
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true })
    .then(hit => hit || fetch(e.request)));
});
