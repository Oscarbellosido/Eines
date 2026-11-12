"""Prepara els dos models de «Treu el fons» a partir dels que publica el
projecte rembg (https://github.com/danielgatis/rembg, pàgina de versions
v0.0.0), que ja són ONNX:

- u2netp.onnx (U²-Net petit, 4,6 MB): el del mode Mòbil. Entrada de 320 × 320.
- isnet-general-use.onnx (IS-Net, 178 MB): el del mode Ordinador. Entrada de
  1024 × 1024.

Un fitxer ONNX només són dades (una llista de peces i els seus números): es
llegeix amb el mòdul `onnx`, que no executa res del que porta.

Què s'hi fa:
- Es deixa només la primera sortida, que és la bona. Els originals en donen
  set (U²-Net) o dotze (IS-Net), i a l'IS-Net algunes són imatges intermèdies
  de 64 × 512 × 512: el motor les calcularia i les copiaria per res.
- A l'IS-Net, els pesos es desen amb la meitat de precisió (float16) i una
  peça Cast els torna a fer normals en carregar el model. Així el fitxer fa la
  meitat (GitHub no n'accepta de més de 100 MB) i el motor, en preparar-lo,
  els converteix una sola vegada: els càlculs es fan igual que abans.

    python fes_fons.py <carpeta amb els dos originals> <carpeta de sortida>
"""
import sys, os
import numpy as np, onnx
from onnx import helper as h, numpy_helper as nh, TensorProto as T


def nomes_la_primera_sortida(m):
    entrada = [i.name for i in m.graph.input if i.name not in {x.name for x in m.graph.initializer}]
    return onnx.utils.Extractor(m).extract_model(entrada, [m.graph.output[0].name])


def pesos_a_mitja_precisio(m, minim=1024):
    nous, casts = [], []
    for ini in m.graph.initializer:
        if ini.data_type == T.FLOAT and np.prod(ini.dims) >= minim:
            a = nh.to_array(ini).astype(np.float16)
            nous.append(nh.from_array(a, ini.name + '_f16'))
            casts.append(h.make_node('Cast', [ini.name + '_f16'], [ini.name], to=T.FLOAT))
        else:
            nous.append(ini)
    del m.graph.initializer[:]
    m.graph.initializer.extend(nous)
    nodes = casts + list(m.graph.node)
    del m.graph.node[:]
    m.graph.node.extend(nodes)
    return len(casts)


def fes(origen, desti):
    os.makedirs(desti, exist_ok=True)
    m = nomes_la_primera_sortida(onnx.load(os.path.join(origen, 'u2netp.onnx')))
    onnx.checker.check_model(m)
    onnx.save(m, os.path.join(desti, 'u2netp.onnx'))

    m = nomes_la_primera_sortida(onnx.load(os.path.join(origen, 'isnet-general-use.onnx')))
    n = pesos_a_mitja_precisio(m)
    onnx.checker.check_model(m)
    onnx.save(m, os.path.join(desti, 'isnet-fp16.onnx'))
    print('isnet: pesos a mitja precisió:', n)


if __name__ == '__main__':
    fes(sys.argv[1], sys.argv[2])
