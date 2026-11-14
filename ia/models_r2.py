"""Els models de la IA viuen a Cloudflare R2 (l'espai «eines-models»), no al
repositori: GitHub Pages no deixa publicar més d'1 GB, i amb totes les IA ja
n'hi havia 870 MB. Aquest script els hi puja i els en baixa.

    python ia/models_r2.py puja      puja els de ia/models que no hi són o han canviat
    python ia/models_r2.py baixa     baixa a ia/models els que hi falten (per a les proves)
    python ia/models_r2.py llista    què hi ha a R2

Parla amb l'API de Cloudflare (api.cloudflare.com). La clau no és enlloc del
codi ni del repositori: a l'entorn on es treballa, el servidor intermediari la
posa sol a cada petició. Fora d'aquí, cal una variable CLOUDFLARE_API_TOKEN
amb una clau que tingui «Workers R2 Storage: Edit» i «Account Settings: Read».

Es comprova que cada fitxer pujat o baixat té la mateixa empremta (MD5) que
el de l'altra banda.
"""
import hashlib, json, os, sys, urllib.request

API = 'https://api.cloudflare.com/client/v4'
ESPAI = 'eines-models'
CARPETA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models')


def crida(cami, metode='GET', cos=None, tipus='application/json'):
    req = urllib.request.Request(API + cami, data=cos, method=metode)
    if os.environ.get('CLOUDFLARE_API_TOKEN'):
        req.add_header('Authorization', 'Bearer ' + os.environ['CLOUDFLARE_API_TOKEN'])
    if cos is not None: req.add_header('Content-Type', tipus)
    with urllib.request.urlopen(req, timeout=900) as r:
        return r.read()


def compte():
    return json.loads(crida('/accounts'))['result'][0]['id']


def a_r2(acc):
    """{nom: (mida, md5)} del que hi ha a R2."""
    fets, cursor = {}, ''
    while True:
        d = json.loads(crida(f'/accounts/{acc}/r2/buckets/{ESPAI}/objects?per_page=1000' + (f'&cursor={cursor}' if cursor else '')))
        for o in d['result']: fets[o['key']] = (o['size'], o['etag'].strip('"'))
        cursor = (d.get('result_info') or {}).get('cursor')
        if not cursor or not (d.get('result_info') or {}).get('is_truncated'): return fets


def md5(cami):
    h = hashlib.md5()
    with open(cami, 'rb') as f:
        for b in iter(lambda: f.read(1 << 22), b''): h.update(b)
    return h.hexdigest()


def es_model(nom): return '.onnx' in nom


if __name__ == '__main__':
    quin = sys.argv[1] if len(sys.argv) > 1 else 'llista'
    acc = compte()
    alla = a_r2(acc)
    if quin == 'llista':
        for k, (m, e) in sorted(alla.items()): print(f'{m / 1048576:8.1f} MB  {k}')
    elif quin == 'puja':
        for nom in sorted(os.listdir(CARPETA)):
            if not es_model(nom): continue
            cami = os.path.join(CARPETA, nom); e = md5(cami)
            if alla.get(nom, (0, ''))[1] == e: print('ja hi és', nom); continue
            with open(cami, 'rb') as f:
                crida(f'/accounts/{acc}/r2/buckets/{ESPAI}/objects/{nom}', 'PUT', f.read(), 'application/octet-stream')
            print('pujat', nom)
        alla = a_r2(acc)
        mal = [n for n in os.listdir(CARPETA) if es_model(n) and alla.get(n, (0, ''))[1] != md5(os.path.join(CARPETA, n))]
        print('tot bé' if not mal else f'NO QUADREN: {mal}')
    elif quin == 'baixa':
        os.makedirs(CARPETA, exist_ok=True)
        for nom, (mida, e) in sorted(alla.items()):
            cami = os.path.join(CARPETA, nom)
            if os.path.exists(cami) and md5(cami) == e: continue
            dades = crida(f'/accounts/{acc}/r2/buckets/{ESPAI}/objects/{nom}')
            if hashlib.md5(dades).hexdigest() != e: sys.exit(f'{nom}: l\'empremta no quadra')
            with open(cami, 'wb') as f: f.write(dades)
            print('baixat', nom)
        print('tot bé')
