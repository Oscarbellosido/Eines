"""Prepara CodeFormer (Shangchen Zhou i altres, S-Lab, NTU; llicència S-Lab 1.0,
només per a ús no comercial: https://github.com/sczhou/CodeFormer), la IA de
«Cares» per a les cares molt malmeses o molt petites de les fotos velles.

Té una cosa que la de sempre (GFPGAN) no té: un control, `weight` de 0 a 1,
entre «més nítida» (0: es refà la cara amb el que la IA sap de cares) i «més
semblant» (1: es fa més cas del que hi ha a la foto).

Parteix de la conversió a ONNX que publica FaceFusion a GitHub, com el model
del color, que el projecte només té els pesos en PyTorch:

    https://github.com/facefusion/facefusion-assets/releases/download/models-3.0.0/codeformer.onnx
    (sha256 21710e7a..., aquí es comprova)

Els pesos són els del projecte: comparats amb el seu `codeformer.pth`
(https://github.com/sczhou/CodeFormer/releases/download/v0.1.0/), els 332 que
porten el mateix nom als dos fitxers són idèntics. Un fitxer ONNX només són
dades: es llegeix amb `onnx` i `onnxruntime`, que no executen res del que porta
més enllà de les seves peces normals.

Què s'hi fa:
- **Es calcula d'avançada tot el que no depèn de la cara** (l'optimització
  «bàsica» d'onnxruntime): milers de peces que només calculen mides.
- **La tria del codi es fa amb ArgMax i Gather.** L'original busca el codi
  més probable de cada tros amb TopK, en fa un vector de zeros amb un u
  (ScatterElements) i el multiplica pel diccionari. La gràfica no sap fer ni
  TopK ni ScatterElements; ArgMax i Gather (agafar la fila del diccionari)
  donen exactament el mateix.
- **`weight` passa a ser un float32** (era un double, que la gràfica tampoc
  no sap fer, i l'original el convertia a float32 de seguida).
- **Només es deixa la sortida de la cara** (n'hi havia dues més, de proves).
- **Els pesos es desen amb 8 bits** (pesos_a_8_bits, com el color i el
  BiRefNet): de 377 MB a 95. Comparat amb l'original, la cara surt a 1 o 2
  nivells (de 255) de diferència de mitjana.
- **Es parteix en trossos de 95 MB** (codeformer-q8.onnx.1, .2).

Entrada [1,3,512,512], la cara posada dreta com la de GFPGAN, RGB de −1 a 1,
i `weight` []; sortida [1,3,512,512], de −1 a 1.

    python fes_codeformer.py codeformer.onnx ../models
"""
import collections, hashlib, os, sys, tempfile
import numpy as np, onnx, onnxruntime as ort
from onnx import helper as h, numpy_helper as nh, TensorProto as T
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fes_color import pesos_a_8_bits, TROS

SHA = '21710e7ab61c82683576c428e9c1b6fe1ed419586b7b39e394c3449c294b550f'


def cirurgia(m):
    g = m.graph
    topk = [n for n in g.node if n.op_type == 'TopK']
    assert len(topk) == 1 and topk[0].input[0] in [o for n in g.node if n.op_type == 'Softmax' for o in n.output]
    # TopK → Reshape → ScatterElements → Cast → MatMul amb el diccionari
    cami = {topk[0].output[1]}; treu = [topk[0]]
    for op in ['Reshape', 'ScatterElements', 'Cast', 'MatMul']:
        n = [n for n in g.node if n.op_type == op and set(n.input) & cami]
        assert len(n) == 1, op
        treu.append(n[0]); cami = set(n[0].output)
    mm = treu[-1]
    dicc = [i for i in mm.input if i in {x.name for x in g.initializer}]
    assert len(dicc) == 1
    # el codi més probable de cada tros (sobre els logits, que la softmax no
    # canvia l'ordre), i la seva fila del diccionari
    logits = [n for n in g.node if n.op_type == 'Softmax' and n.output[0] == topk[0].input[0]][0].input[0]
    noves = [h.make_node('ArgMax', [logits], ['codi_idx2'], axis=2, keepdims=0),
             h.make_node('Reshape', ['codi_idx2', 'codi_forma'], ['codi_idx']),
             h.make_node('Gather', [dicc[0], 'codi_idx'], [mm.output[0]], axis=0)]
    g.initializer.append(nh.from_array(np.array([-1], np.int64), 'codi_forma'))
    # weight: de double a float32, sense la conversió que hi havia
    castw = [n for n in g.node if n.op_type == 'Cast' and list(n.input) == ['weight']]
    assert len(castw) == 1
    treu.append(castw[0])
    fora = {id(n) for n in treu}
    nodes = []
    for n in g.node:
        if id(n) in fora:
            if n is mm: nodes += noves
            continue
        n.input[:] = ['weight' if i == castw[0].output[0] else i for i in n.input]
        nodes.append(n)
    del g.node[:]; g.node.extend(nodes)
    for i in g.input:
        if i.name == 'weight': i.type.tensor_type.elem_type = T.FLOAT
    # només la cara; i fora el que ja no fa res
    del g.output[:]; g.output.extend([h.make_tensor_value_info('output', T.FLOAT, [1, 3, 512, 512])])
    viu, queden = {'output'}, []
    for n in reversed(list(g.node)):
        if any(o in viu for o in n.output): queden.append(n); viu.update(n.input)
    queden.reverse(); del g.node[:]; g.node.extend(queden)
    ini = [x for x in g.initializer if x.name in viu]; del g.initializer[:]; g.initializer.extend(ini)
    del g.value_info[:]


if __name__ == '__main__':
    origen, desti = sys.argv[1], sys.argv[2]
    with open(origen, 'rb') as f:
        if hashlib.sha256(f.read()).hexdigest() != SHA: sys.exit('el fitxer no és el que es coneix')
    with tempfile.TemporaryDirectory() as tmp:
        o = ort.SessionOptions()
        o.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
        o.optimized_model_filepath = os.path.join(tmp, 'opt.onnx')
        ort.InferenceSession(origen, o, providers=['CPUExecutionProvider'])
        m = onnx.load(o.optimized_model_filepath)
    cirurgia(m)
    print('pesos a 8 bits:', pesos_a_8_bits(m))
    onnx.checker.check_model(m)
    print(dict(collections.Counter(n.op_type for n in m.graph.node)))
    dades = m.SerializeToString()
    os.makedirs(desti, exist_ok=True)
    n = 0
    for i in range(0, len(dades), TROS):
        n += 1
        with open(os.path.join(desti, f'codeformer-q8.onnx.{n}'), 'wb') as f: f.write(dades[i:i + TROS])
    print(f'{len(dades)} bytes en {n} trossos')
