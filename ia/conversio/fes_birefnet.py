"""Prepara BiRefNet (Peng Zheng i altres, llicència MIT:
https://github.com/ZhengPeng7/BiRefNet), la IA de «Treu el fons» del mode
Ordinador, que retalla molt millor que l'IS-Net les vores fines: cabells, pèl.

Parteix de l'ONNX que publica el mateix projecte a GitHub, la versió entrenada
a 512 × 512 (la de 1024 necessita uns 6 GB de memòria mentre treballa, i un
navegador no en pot fer servir tants):

    https://github.com/ZhengPeng7/BiRefNet/releases/download/v1/BiRefNet-general-resolution_512x512-fp16-epoch_216.onnx
    (sha256 18b64a27..., aquí es comprova)

Un fitxer ONNX només són dades: es llegeix amb `onnx` i `onnxruntime`, que no
executen res del que porta més enllà de les seves peces normals.

Què s'hi fa:
- **Es calcula d'avançada tot el que no depèn de la foto** (l'optimització
  «bàsica» d'onnxruntime, que només fa servir peces normals d'ONNX): el
  fitxer original porta milers de peces que només calculen mides, i dues
  menes de peça (Mod i Sum) que el motor no sap fer a la gràfica. Les Mod
  desapareixen soles; les Sum es tornen sumes de dues en dues (Add).
- **S'hi afegeix la sigmoide al final**: el model original dona el resultat
  sense passar-lo de 0 a 1.
- **Els pesos es desen amb 8 bits** (pesos_a_8_bits, com el del color): de 930
  MB a 241, i a la memòria també ocupen 241 (el motor no els ajunta en
  carregar el model). Comparat amb els pesos sencers, el 0,2% dels punts canvia
  de costat (del davant al fons), tots a la vora.
- **Es parteix en trossos de 95 MB** (birefnet-512-q8.onnx.1, .2, .3), com el
  del color, que l'app baixa i ajunta.

Entrada [1,3,512,512], la foto de 0 a 1 menys la mitjana d'ImageNet i partida
per la desviació; sortida [1,1,512,512], de 0 a 1 (1 = del davant).

    python fes_birefnet.py BiRefNet-general-resolution_512x512-fp16-epoch_216.onnx ../models
"""
import collections, hashlib, os, sys, tempfile
import onnx, onnxruntime as ort
from onnx import helper as h
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fes_color import pesos_a_8_bits, TROS

SHA = '18b64a270d3abe7d36e665500c3f24136bcaf7616771b4cb21c6e8c57fec7237'

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
    nodes = []
    for n in m.graph.node:
        if n.op_type == 'Sum':                 # la gràfica no la sap fer: sumes de dues en dues
            acc = n.input[0]
            for i, x in enumerate(n.input[1:]):
                out = n.output[0] if i == len(n.input) - 2 else f'{n.output[0]}_s{i}'
                nodes.append(h.make_node('Add', [acc, x], [out])); acc = out
        else: nodes.append(n)
    sortida = m.graph.output[0]
    nodes.append(h.make_node('Sigmoid', [sortida.name], ['alfa']))
    del m.graph.node[:]; m.graph.node.extend(nodes)
    nova = onnx.helper.make_tensor_value_info('alfa', sortida.type.tensor_type.elem_type, [1, 1, 512, 512])
    del m.graph.output[:]; m.graph.output.extend([nova])
    print('pesos a 8 bits:', pesos_a_8_bits(m))
    onnx.checker.check_model(m)
    print(dict(collections.Counter(n.op_type for n in m.graph.node)))
    dades = m.SerializeToString()
    os.makedirs(desti, exist_ok=True)
    n = 0
    for i in range(0, len(dades), TROS):
        n += 1
        with open(os.path.join(desti, f'birefnet-512-q8.onnx.{n}'), 'wb') as f: f.write(dades[i:i + TROS])
    print(f'{len(dades)} bytes en {n} trossos')
