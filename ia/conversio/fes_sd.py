"""Prepara Stable Diffusion 1.5 Inpainting (Runway i Stability AI; llicència
CreativeML OpenRAIL-M: https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-inpainting),
la IA que, al mode Ordinador, pot «reconstruir» el que s'esborra a «Esborra
coses»: no omple el forat amb el que hi ha al voltant, com LaMa, sinó que hi
pinta una cosa nova que hi lligui.

El projecte només publica els pesos per a PyTorch. Es parteix d'una conversió a
ONNX feta amb les eines de sempre (diffusers i torch.onnx), en 32 bits:

    https://huggingface.co/JasonYANG170/sd15-inpainting-onnx-fp32
    (sha256 de cada fitxer, a SHA, aquí es comproven: són els que dona
    Hugging Face; el SHA256SUMS de la conversió és d'abans i no hi lliga)

i abans de fer-la servir es comprova que els pesos són els oficials
(`compara`, amb els .safetensors del projecte, que es llegeixen amb numpy sense
executar res): cada pes oficial, en 16 bits, és exactament un dels de l'ONNX.
Un fitxer ONNX només són dades: es llegeix amb `onnx` i `onnxruntime`, que no
executen res del que porta més enllà de les seves peces normals.

Què s'hi fa:
- **Mides fixes** (una sola imatge de 512 × 512, el «latent» de 64 × 64) i es
  calcula d'avançada tot el que no depèn de la foto (l'optimització «bàsica»
  d'onnxruntime): així desapareixen els milers de peces que només calculen
  mides, i les Constant i ConstantOfShape, que la gràfica no sap fer.
- **Fora les sumes de zeros** (`treu_zeros`). L'atenció de l'exportació suma
  una taula de zeros a cada capa, i amb les mides fixes aquelles taules es
  tornen pesos: la UNet sortia d'1,6 GB, la meitat zeros (cinc taules de
  [8, 4096, 4096]), i a la memòria del navegador haurien estat 2,7 GB més.
- **La frase buida va dins de la UNet.** Stable Diffusion es guia per una
  frase (en anglès) que passa abans per una altra IA, el codificador de text
  (123 milions de números més). Per esborrar no cal cap frase: es calcula aquí,
  una vegada, el que el codificador dona per a la frase buida, i es desa dins
  de la UNet com un pes més, en lloc de l'entrada `encoder_hidden_states`. Al
  principi es deixava l'entrada amb aquell valor de partida, però el motor
  avisava (a la consola, com un error) que així no podia precalcular res. Si
  algun dia s'hi vol posar una frase, s'ha de tornar a fer el model amb
  l'entrada (i amb un altre nom, que els navegadors no el tornarien a baixar).
- **Els pesos es desen amb 8 bits** (pesos_a_8_bits, com el color, CodeFormer
  i BiRefNet): la UNet passa de 3,4 GB a uns 860 MB, i a la memòria també (el
  motor no els ajunta en carregar-la).
- **Es parteix en trossos de 95 MB** (sd-unet-q8.onnx.1, .2...), que l'app
  baixa i ajunta. Els dos trossos del VAE (el que passa de la foto al
  «latent» i al revés) són fitxers sols: sd-vae-enc-q8.onnx i sd-vae-dec-q8.onnx.

Entrades de la UNet: `sample` [1,9,64,64] (el latent amb soroll, la màscara i
el latent de la foto amb el forat) i `timestep` [1] (float); sortida `out_sample` [1,4,64,64], el
soroll que hi veu. El VAE: la foto [1,3,512,512] de −1 a 1 ↔ el latent
[1,4,64,64] (sense multiplicar per 0,18215: això ho fa l'app).

    python fes_sd.py <carpeta de l'ONNX> ../models
    python fes_sd.py --compara <carpeta de l'ONNX> <carpeta dels .safetensors oficials>
"""
import collections, hashlib, json, os, struct, sys, tempfile
import numpy as np, onnx, onnxruntime as ort
from onnx import numpy_helper as nh
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fes_color import pesos_a_8_bits, TROS

SHA = {
    'text_encoder/model.onnx': 'f733b4c88a6e45e88460e00d683a465b546ac7b8c307db4a3b33c49f939a9789',
    'unet/model.onnx': 'd6abc46fc2bf96e4fca7dff950beaa67646f9bd0bdd93fcf8621ef122ae8feab',
    'unet/model.onnx_data': 'df01d68458269b62670c8e287743c2a59f613b21039a5d8937ef2d522c677fe9',
    'vae_encoder/model.onnx': '8912a7e136a1c3ea21699d170a0e98e89608f8eb8213ba27f7e1a2709aebc517',
    'vae_decoder/model.onnx': '668fa7d9b511fa5ce87280b4f0b0e5177483de7c3ffea7166b47c2b7284a47f2',
}
# la frase buida, com la tokenitza CLIP: començament, final i, fins a 77, el
# farciment, que a SD 1.5 és el mateix «final» (<|endoftext|>)
BUIDA = np.array([[49406] + [49407] * 76], np.int64)


def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 24), b''): h.update(b)
    return h.hexdigest()


def comprova(origen):
    for f, s in SHA.items():
        if sha256(os.path.join(origen, f)) != s: sys.exit(f'{f}: el fitxer no és el que es coneix')


# --- comparar amb els pesos oficials -------------------------------------
def llegeix_st(p):
    """Un .safetensors són vuit bytes amb la llargada de la capçalera, la
    capçalera en JSON i els números: es llegeix sense executar res."""
    with open(p, 'rb') as f:
        n = struct.unpack('<Q', f.read(8))[0]; cap = json.loads(f.read(n)); base = 8 + n
    mm = np.memmap(p, dtype=np.uint8, mode='r')
    tipus = {'F16': np.float16, 'F32': np.float32}
    for k, v in cap.items():
        if k == '__metadata__' or v['dtype'] not in tipus: continue     # (els números de posició, enters)
        a, b = v['data_offsets']
        yield k, np.frombuffer(mm[base + a:base + b], dtype=tipus[v['dtype']]).reshape(v['shape'])


def empremta(a):
    # només els números, no la forma: les normalitzacions es desen com a
    # [C,1,1] a l'ONNX i com a [C] als oficials
    a = np.ascontiguousarray(a.astype(np.float16)).ravel()
    return hashlib.sha1(a.tobytes()).hexdigest()


def compara(onnxp, stp, prefixos=None):
    m = onnx.load(onnxp)
    em, mida = {}, {}
    for ini in m.graph.initializer:
        a = nh.to_array(ini)
        if a.dtype != np.float32 or a.size < 2: continue
        em[empremta(a)] = ini.name; mida[ini.name] = a.size
        if a.ndim == 2: em[empremta(a.T)] = ini.name        # els Linear, transposats per al MatMul
    usats, falten, n = set(), [], 0
    for k, a in llegeix_st(stp):
        if prefixos and not k.startswith(prefixos): continue
        n += 1
        x = em.get(empremta(a))
        if x is None and a.ndim == 4 and a.shape[2:] == (1, 1): x = em.get(empremta(a[:, :, 0, 0].T))
        if x is None: falten.append((k, a.shape))
        else: usats.add(x)
    sobren = [k for k in mida if k not in usats and mida[k] >= 64]
    print(f'  {os.path.basename(os.path.dirname(onnxp))}: {n} pesos oficials, {len(falten)} sense parella; '
          f'{len(sobren)} pesos de l\'ONNX que no són cap dels oficials')
    for f in falten[:10]: print('    falta', f)
    for s in sobren[:10]: print('    sobra', s, mida[s])
    return not falten


# --- preparar --------------------------------------------------------------
def optimitza(origen, tmp, nom):
    """L'optimització «bàsica» d'onnxruntime, amb les mides fixes (una sola
    imatge: les dimensions lliures, que es diuen `batch_size`, a 1): es
    calcula tot el que no depèn de l'entrada. La UNet fa més de 2 GB i es desa
    amb els pesos a part. Es fa sobre el fitxer original, sense copiar-lo."""
    o = ort.SessionOptions()
    o.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
    o.add_free_dimension_override_by_name('batch_size', 1)
    o.optimized_model_filepath = os.path.join(tmp, nom + '-opt.onnx')
    o.add_session_config_entry('session.optimized_model_external_initializers_file_name', nom + '-opt.dades')
    o.add_session_config_entry('session.optimized_model_external_initializers_min_size_in_bytes', '1024')
    ort.InferenceSession(origen, o, providers=['CPUExecutionProvider'])
    m = onnx.load(o.optimized_model_filepath)
    for v in list(m.graph.input) + list(m.graph.output):     # i que el fitxer també ho digui
        for d in v.type.tensor_type.shape.dim:
            if d.dim_param: d.dim_value = 1
    return m


def treu_zeros(m):
    """L'atenció de l'exportació (AttnProcessor, el de sempre de diffusers) fa
    `baddbmm` amb una taula buida multiplicada per zero, i després la suma.
    Amb les mides fixes, l'optimització d'onnxruntime en fa un pes de debò:
    una taula de zeros de [8, 4096, 4096] a cada capa d'atenció de dalt de tot,
    134 MB cadascuna en 8 bits (i 4 vegades més a la memòria). Sumar zero no
    fa res: es treu la suma i la taula."""
    g = m.graph
    zeros = {i.name for i in g.initializer if np.prod(i.dims) >= 4096 and not nh.to_array(i).any()}
    renom, nodes, n_add = {}, [], 0
    for n in g.node:
        n.input[:] = [renom.get(x, x) for x in n.input]
        if n.op_type == 'Add' and any(x in zeros for x in n.input):
            altre = [x for x in n.input if x not in zeros]
            assert len(altre) == 1
            renom[n.output[0]] = altre[0]; n_add += 1
            continue
        nodes.append(n)
    assert not any(o.name in renom for o in g.output)
    del g.node[:]; g.node.extend(nodes)
    usats = {x for n in g.node for x in n.input}
    resta = [i for i in g.initializer if i.name in usats or i.name in {x.name for x in g.input}]
    assert not (zeros & {i.name for i in resta}), 'queden taules de zeros fent alguna altra cosa'
    del g.initializer[:]; g.initializer.extend(resta)
    return n_add


def desa(m, desti, nom, trossos):
    onnx.checker.check_model(m)
    print(' ', nom, dict(collections.Counter(n.op_type for n in m.graph.node)))
    dades = m.SerializeToString()
    if not trossos:
        with open(os.path.join(desti, nom), 'wb') as f: f.write(dades)
        print(f'  {len(dades)} bytes'); return
    n = 0
    for i in range(0, len(dades), TROS):
        n += 1
        with open(os.path.join(desti, f'{nom}.{n}'), 'wb') as f: f.write(dades[i:i + TROS])
    print(f'  {len(dades)} bytes en {n} trossos')


if __name__ == '__main__':
    if sys.argv[1] == '--compara':
        origen, oficial = sys.argv[2], sys.argv[3]
        ok = all([compara(os.path.join(origen, 'unet/model.onnx'), os.path.join(oficial, 'unet/diffusion_pytorch_model.fp16.safetensors')),
                  compara(os.path.join(origen, 'vae_encoder/model.onnx'), os.path.join(oficial, 'vae/diffusion_pytorch_model.fp16.safetensors'), ('encoder.', 'quant_conv.')),
                  compara(os.path.join(origen, 'vae_decoder/model.onnx'), os.path.join(oficial, 'vae/diffusion_pytorch_model.fp16.safetensors'), ('decoder.', 'post_quant_conv.')),
                  compara(os.path.join(origen, 'text_encoder/model.onnx'), os.path.join(oficial, 'text_encoder/model.fp16.safetensors'))])
        # (el VAE són dues meitats, codificar i descodificar: cada ONNX en porta
        # una, i a cadascun només s'hi busquen els pesos de la seva)
        sys.exit(0 if ok else 1)
    origen, desti = sys.argv[1], sys.argv[2]
    comprova(origen)
    os.makedirs(desti, exist_ok=True)
    # la frase buida, una vegada
    te = ort.InferenceSession(os.path.join(origen, 'text_encoder/model.onnx'), providers=['CPUExecutionProvider'])
    buida = te.run(None, {'input_ids': BUIDA})[0].astype(np.float32)
    print('frase buida:', buida.shape, float(buida.mean()), float(buida.std()))
    del te
    with tempfile.TemporaryDirectory(dir=desti) as tmp:
        for comp, nom, trossos in [('vae_encoder', 'sd-vae-enc-q8.onnx', False),
                                   ('vae_decoder', 'sd-vae-dec-q8.onnx', False),
                                   ('unet', 'sd-unet-q8.onnx', True)]:
            m = optimitza(os.path.join(origen, comp, 'model.onnx'), tmp, comp)
            print(comp, 'sumes de zeros tretes:', treu_zeros(m))
            print(comp, 'pesos a 8 bits:', pesos_a_8_bits(m))
            if comp == 'unet':
                # la frase buida, com un pes més: l'entrada se'n va
                m.graph.initializer.append(nh.from_array(buida, 'encoder_hidden_states'))
                ent = [i for i in m.graph.input if i.name != 'encoder_hidden_states']
                del m.graph.input[:]; m.graph.input.extend(ent)
            desa(m, desti, nom, trossos)
            del m
