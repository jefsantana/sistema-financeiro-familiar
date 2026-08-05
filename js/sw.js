const CACHE_NAME = 'financas-familiar-v1';
const ARQUIVOS = [
  './',
  './index.html',
  './css/reset.css',
  './css/variables.css',
  './css/style.css',
  './css/responsive.css',
  './js/main.js'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS))
  );
});

self.addEventListener('fetch', (evento) => {
  evento.respondWith(
    caches.match(evento.request).then((resposta) => resposta || fetch(evento.request))
  );
});