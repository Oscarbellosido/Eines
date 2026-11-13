"""Prepara la IA que posa color a les fotos en blanc i negre (DDColor, de
DAMO Academy, llicència Apache 2.0: https://github.com/piddnad/DDColor).

Els pesos originals només són a Hugging Face i a ModelScope, que no es poden
baixar des d'on es treballa. Per això es parteix del DDColor gros (DDColor-L,
245 milions de números) ja convertit a ONNX pel projecte FaceFusion:

    https://github.com/facefusion/facefusion-assets/releases/download/models-3.0.0/ddcolor.onnx
    (980 MB; el seu .hash, un CRC32, diu cab3b659, i aquí es comprova)

Un fitxer ONNX només són dades (una llista de peces i els seus números): es
llegeix amb el mòdul `onnx`, que no executa res del que porta.

Què s'hi fa:
- Els pesos es desen amb 8 bits (de -127 a 127) i una escala per a cada canal
  de sortida, i una peça DequantizeLinear els torna a fer números normals quan
  calen. De 980 MB a 248, i el resultat canvia menys d'un nivell sobre 255 de
  mitjana. El motor no ajunta aquestes peces amb els pesos en carregar el
  model (ho deixa per a cada passada), així que a la memòria els pesos també
  ocupen 248 MB i no 980: és el que el fa possible en un mòbil.
- Es parteix en trossos de menys de 95 MB, que GitHub no accepta fitxers de
  més de 100 MB. L'app els baixa i els ajunta.

Entrada: la foto en grisos (la mateixa grisor als tres canals), de 0 a 1, de
N × N (la foto es fa quadrada). Sortida: els dos canals de color (a i b de
l'espai Lab) a la mateixa mida. La claredat (L) es treu de la foto original.

    python fes_color.py ddcolor.onnx <carpeta de sortida>
"""
import collections, os, sys, zlib
import numpy as np, onnx
from onnx import helper as h, numpy_helper as nh, TensorProto as T

CRC_ORIGINAL = 'cab3b659'
TROS = 95 * 1000 * 1000


def crc32(cami):
    c = 0
    with open(cami, 'rb') as f:
        while True:
            b = f.read(1 << 24)
            if not b: return format(c, '08x')
            c = zlib.crc32(b, c)


def pesos_a_8_bits(m, minim=4096):
    """Cada pes gros (de 2 dimensions o més) es desa en 8 bits amb una escala
    per canal. L'eix de l'escala és el de les sortides: el 0 a les convolucions
    i a les Gemm (transB), l'últim quan és la segona entrada d'un MatMul."""
    g = m.graph
    usos = collections.defaultdict(list)
    for n in g.node:
        for k, x in enumerate(n.input): usos[x].append((n.op_type, k))
    nous, dqs = [], []
    for ini in g.initializer:
        if ini.data_type != T.FLOAT or len(ini.dims) < 2 or np.prod(ini.dims) < minim or not usos[ini.name]:
            nous.append(ini); continue
        a = nh.to_array(ini).astype(np.float32)
        eix = a.ndim - 1 if all(u == ('MatMul', 1) for u in usos[ini.name]) else 0
        mx = np.abs(a).max(axis=tuple(i for i in range(a.ndim) if i != eix))
        esc = np.where(mx > 0, mx / 127, 1).astype(np.float32)
        forma = [1] * a.ndim; forma[eix] = -1
        q = np.clip(np.round(a / esc.reshape(forma)), -127, 127).astype(np.int8)
        nom = ini.name
        nous += [nh.from_array(q, nom + '_q8'), nh.from_array(esc, nom + '_esc'),
                 nh.from_array(np.zeros_like(esc, np.int8), nom + '_zp')]
        dqs.append(h.make_node('DequantizeLinear', [nom + '_q8', nom + '_esc', nom + '_zp'], [nom], axis=eix))
    del g.initializer[:]; g.initializer.extend(nous)
    nodes = dqs + list(g.node)
    del g.node[:]; g.node.extend(nodes)
    return len(dqs)


if __name__ == '__main__':
    origen, desti = sys.argv[1], sys.argv[2]
    if crc32(origen) != CRC_ORIGINAL: sys.exit('el fitxer no és el que es coneix (CRC32 diferent)')
    m = onnx.load(origen)
    print('pesos a 8 bits:', pesos_a_8_bits(m))
    onnx.checker.check_model(m)
    dades = m.SerializeToString()
    os.makedirs(desti, exist_ok=True)
    n = 0
    for i in range(0, len(dades), TROS):
        n += 1
        with open(os.path.join(desti, f'color.onnx.{n}'), 'wb') as f: f.write(dades[i:i + TROS])
    print(f'{len(dades)} bytes en {n} trossos')
