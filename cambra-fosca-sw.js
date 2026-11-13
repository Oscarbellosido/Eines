// El que fa que La Cambra Fosca, instal·lada com a app, s'obri també sense
// connexió. Només s'ocupa de la Cambra Fosca (s'hi registra amb l'abast
// «cambra-fosca»): la portada de les Eines i la Revisió no hi passen.
//
// Cada canvi en un fitxer d'aquesta llista: pujar la versió, que si no l'app
// instal·lada sense connexió seguiria servint la vella.
const VERSIO='cambra-fosca-v16';
const FITXERS = [
  'cambra-fosca.html',
  'cambra-fosca.webmanifest',
  'icones/cambra-fosca-192.png',
  'icones/cambra-fosca-512.png',
  'icones/cambra-fosca-maskable-512.png',
  'icones/cambra-fosca-180.png',
];
// "cache: reload": sense, en desar una versió nova el navegador hi podia posar
// la seva còpia vella, i et quedaves amb l'app antiga.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIO).then(c => c.addAll(FITXERS.map(f => new Request(f, { cache: 'reload' })))));
  self.skipWaiting();
});

// Només s'esborren les versions velles d'aquesta llista. La memòria on l'app
// desa el motor i els models d'ampliar («cambra-fosca-ia-...») no es toca.
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(claus => Promise.all(claus
    .filter(k => k.startsWith('cambra-fosca-v') && k !== VERSIO)
    .map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  // Els models i el motor (desenes de MB) els desa l'app mateixa a la seva
  // memòria: si també els desés aquí, ocuparien el doble.
  // (també els trossos dels que van partits: cares-arregla.onnx.1, color.onnx.2...)
  if (/\.(onnx(\.\d+)?|wasm)$/.test(url.pathname)) return;
  // Les lletres de Google: la primera vegada de la xarxa, després de la memòria.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSIO).then(c => c.match(r).then(m => m || fetch(r).then(res => { c.put(r, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== location.origin) return;
  // La resta: de la xarxa si n'hi ha (així sempre és la versió nova), i si no,
  // de la memòria.
  e.respondWith(
    fetch(r).then(res => {
      if (res.ok) { const copia = res.clone(); caches.open(VERSIO).then(c => c.put(r, copia)); }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: true }))
  );
});
