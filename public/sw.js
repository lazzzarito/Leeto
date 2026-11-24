/* Service worker del shell de Leeto: cache-first para assets, network-first para navegación. */
const CACHE = 'leeto-shell-' + (self.__CACHE_VERSION__ || 'dev');
const PRECACHE = self.__PRECACHE__ || [];
const INDEX = '/index.html';

function store(request, response) {
  if (!response.ok || response.type !== 'basic') return;
  const copy = response.clone();
  void caches.open(CACHE).then((cache) => cache.put(request, copy));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((path) => cache.add(path))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('leeto-shell-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          store(INDEX, response);
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(INDEX, { ignoreVary: true });
          return (
            cached ??
            new Response('Sin conexión', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          );
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        store(request, response);
        return response;
      });
    }),
  );
});
