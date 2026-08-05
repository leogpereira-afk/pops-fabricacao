// Service worker do Pops & Fabricação. Shell cacheado pra abrir sem sinal no
// chão de fábrica; API NUNCA passa pelo cache (bypass por host supabase.co).
const CACHE = 'pops-shell-v10';
const SHELL = ['./', './index.html', './styles.css', './config.js', './auth.js',
  './store.js', './app.js', './logo-impresilk.png', './manifest.webmanifest'];
self.addEventListener('install', e => {
  // cache:'reload' em cada arquivo: sem isto o SW guarda o que estiver no cache
  // HTTP do navegador (o Pages manda max-age=600) e passa a SERVIR a versão
  // velha até o próximo bump — ou seja, a equipe não recebe a correção que
  // acabou de subir. Buscar da rede na instalação é o que garante o shell novo.
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
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
