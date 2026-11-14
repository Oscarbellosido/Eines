// El Worker «eines-ia» de Cloudflare: entrega els models de la IA de La
// Cambra Fosca, que són a l'espai R2 «eines-models» (lligat com a MODELS).
// Només llegeix: no hi ha manera de pujar ni d'esborrar res des d'aquí, i no
// apunta res de qui ho demana. La foto no hi passa mai: només els models.
//
// És aquí per tenir-lo al repositori; el que hi ha desplegat és aquest mateix
// codi (es desplega amb l'API de Cloudflare, vegeu ia/LLEGEIX.md).

const CORS = {
  'Access-Control-Allow-Origin': '*',          // els models són públics: la web els baixa des de github.io
  'Access-Control-Expose-Headers': 'Content-Length, ETag',
};

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS')
      return new Response(null, { headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, HEAD', 'Access-Control-Max-Age': '86400' } });
    if (req.method !== 'GET' && req.method !== 'HEAD')
      return new Response('Només es pot llegir.', { status: 405, headers: CORS });
    const nom = decodeURIComponent(new URL(req.url).pathname.slice(1));
    // només noms de model: lletres, números, guions i punts (res de carpetes)
    if (!/^[\w-]+(\.[\w-]+)*\.onnx(\.\d+)?$/.test(nom))
      return new Response('No hi és.', { status: 404, headers: CORS });
    const obj = req.method === 'HEAD' ? await env.MODELS.head(nom) : await env.MODELS.get(nom);
    if (!obj) return new Response('No hi és.', { status: 404, headers: CORS });
    const h = new Headers(CORS);
    h.set('Content-Type', 'application/octet-stream');
    h.set('Content-Length', String(obj.size));
    h.set('ETag', obj.httpEtag);
    // l'app ja els desa a la seva memòria; això només és per al navegador
    h.set('Cache-Control', 'public, max-age=86400');
    return new Response(req.method === 'HEAD' ? null : obj.body, { headers: h });
  },
};
