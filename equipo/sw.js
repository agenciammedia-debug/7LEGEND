// 7LEGEND · App del equipo: abre aunque no haya señal (los registros se guardan en el celular)
const CACHE = 'legend-equipo-v1';
const BASE = ['./', 'manifest.json', '../config.js', '../comun.js', '../img/equipo-192.png', '../img/equipo-180.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // el backend nunca se guarda en caché
  e.respondWith(
    fetch(e.request).then(r => {
      const copia = r.clone();
      caches.open(CACHE).then(c => c.put(e.request.mode === 'navigate' ? './' : e.request, copia));
      return r;
    }).catch(() => caches.match(e.request.mode === 'navigate' ? './' : e.request, { ignoreSearch: true }))
  );
});
