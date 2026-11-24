// Service Worker – estrategia Cache First
// Cambia la versión cuando modifiques archivos para forzar la actualización del caché.
const NOMBRE_CACHE = 'inspeccion-pwa-v2';

const ARCHIVOS_PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Instalación: precachea la "app shell"
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(NOMBRE_CACHE)
      .then((cache) => cache.addAll(ARCHIVOS_PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activación: elimina cachés de versiones anteriores y toma control de las páginas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres
          .filter((nombre) => nombre !== NOMBRE_CACHE)
          .map((nombre) => caches.delete(nombre))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: Cache First -> si no está en caché, va a la red y guarda la copia
self.addEventListener('fetch', (event) => {
  const peticion = event.request;

  // Solo se cachean peticiones GET del mismo origen
  if (peticion.method !== 'GET' || new URL(peticion.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(peticion)
      .then((respuestaCache) => {
        if (respuestaCache) {
          return respuestaCache;
        }

        return fetch(peticion)
          .then((respuestaRed) => {
            if (respuestaRed && respuestaRed.ok) {
              const copia = respuestaRed.clone();
              caches.open(NOMBRE_CACHE).then((cache) => cache.put(peticion, copia));
            }
            return respuestaRed;
          })
          .catch(() => {
            // Sin red: para navegaciones, devolvemos la página principal cacheada
            if (peticion.mode === 'navigate') {
              return caches.match('./index.html');
            }
            return Response.error();
          });
      })
  );
});
