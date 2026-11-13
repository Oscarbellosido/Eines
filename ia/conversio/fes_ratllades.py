"""Construeix en format ONNX la xarxa que troba les ratllades, els plecs i les
taques d'una foto vella, a partir del fitxer original de Microsoft
(«Bringing Old Photos Back to Life», llicència MIT):

    checkpoints/detection/FT_Epoch_latest.pt, dins de global_checkpoints.zip
    https://github.com/microsoft/Bringing-Old-Photos-Back-to-Life/releases/tag/v1.0

El fitxer és del format antic de PyTorch (no és un zip): una sèrie de
«pickles» i després els números de cada tensor un darrere l'altre. Es llegeix
**sense executar res**: el lector només accepta les peces que fan falta per
reconstruir tensors i diccionaris, i qualsevol altra cosa l'atura.

La xarxa és una U-Net (Global/detection_models/networks.py, i el Downsample
d'antialiasing.py), que aquí es munta peça a peça igual que allà, amb la
normalització (BatchNorm) ja ficada dins de cada convolució. Els pesos es
desen amb la meitat de precisió (i es tornen normals en carregar-la): de
150 MB a 75, que GitHub no n'accepta de més de 100. Entrada: la
foto en grisos, de -1 a 1, amb el costat curt de 256 (com fa detection.py),
els dos costats múltiples de 16. Sortida: per a cada punt, la probabilitat
que sigui ratllada (ja passada per la sigmoide); el projecte la talla a 0,4.

    python fes_ratllades.py FT_Epoch_latest.pt ratllades.onnx
"""
import collections, os, pickle, struct, sys
import numpy as np, onnx
from onnx import helper as h, numpy_helper as nh, TensorProto as T
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fes_fons import pesos_a_mitja_precisio   # el mateix truc que a l'IS-Net

TIPUS = {'FloatStorage': np.float32, 'HalfStorage': np.float16, 'DoubleStorage': np.float64,
         'LongStorage': np.int64, 'IntStorage': np.int32, 'ByteStorage': np.uint8, 'BoolStorage': np.bool_}


class Tensor:                 # un tensor que encara no té els números (arriben al final del fitxer)
    def __init__(self, clau, offset, mida, passos):
        self.clau, self.offset, self.mida, self.passos = clau, offset, tuple(mida), tuple(passos)


class Res:                    # qualsevol objecte de dades que no ens cal (els paràmetres d'entrenament)
    def __init__(self, *a, **k): pass
    def __setstate__(self, s): pass


def llegeix_antic(cami):
    f = open(cami, 'rb')
    tipus = {}

    class Lector(pickle.Unpickler):
        def find_class(self, mod, nom):
            if (mod, nom) == ('collections', 'OrderedDict'): return collections.OrderedDict
            if (mod, nom) == ('torch._utils', '_rebuild_tensor_v2'):
                return lambda st, off, mida, passos, *_: Tensor(st, off, mida, passos)
            if (mod, nom) == ('torch._utils', '_rebuild_parameter'): return lambda t, *a: t
            if mod == 'torch' and nom in TIPUS: return nom
            if (mod, nom) == ('argparse', 'Namespace'): return Res
            raise pickle.UnpicklingError(f'no permès: {mod}.{nom}')

        def persistent_load(self, pid):
            _, nom_tipus, clau, _lloc, _n, vista = pid
            if vista is not None: raise pickle.UnpicklingError('vistes de memòria: no previstes')
            tipus[clau] = TIPUS[nom_tipus]
            return clau

    for _ in range(3):        # el número màgic, la versió i la informació del sistema
        Lector(f).load()
    obj = Lector(f).load()
    claus = Lector(f).load()
    dades = {}
    for clau in claus:
        n, = struct.unpack('<q', f.read(8))
        dt = np.dtype(tipus[clau])
        dades[clau] = np.frombuffer(f.read(n * dt.itemsize), dtype=dt)

    def fes(x):
        if isinstance(x, Tensor):
            a = dades[x.clau]
            st = [s * a.itemsize for s in x.passos]
            return np.lib.stride_tricks.as_strided(a[x.offset:], shape=x.mida, strides=st).copy()
        if isinstance(x, dict): return type(x)((k, fes(v)) for k, v in x.items())
        if isinstance(x, (list, tuple)): return type(x)(fes(v) for v in x)
        return x
    return fes(obj)


class Graf:
    def __init__(self, pesos):
        self.p = {k.replace('module.', ''): v.astype(np.float32) for k, v in pesos.items()}
        self.nodes, self.inits, self.n = [], [], 0

    def nom(self, pre):
        self.n += 1
        return f'{pre}_{self.n}'

    def cte(self, arr, dt=np.float32):
        n = self.nom('c')
        self.inits.append(nh.from_array(np.ascontiguousarray(np.asarray(arr, dt)), n))
        return n

    def op(self, tipus, entrades, **atr):
        s = self.nom(tipus.lower())
        self.nodes.append(h.make_node(tipus, entrades, [s], **atr))
        return s

    def mirall(self, x, p):   # ReflectionPad2d
        return self.op('Pad', [x, self.cte([0, 0, p, p, 0, 0, p, p], np.int64)], mode='reflect')

    def conv(self, x, pre, bn=None, stride=1, grups=1, pesos=None):
        w = self.p[pre + '.weight'] if pesos is None else pesos
        b = self.p.get(pre + '.bias', np.zeros(w.shape[0], np.float32)) if pesos is None else np.zeros(w.shape[0], np.float32)
        if bn:                # BatchNorm (en mode de fer servir) dins de la convolució
            g, be, m, v = (self.p[f'{bn}.{k}'] for k in ('weight', 'bias', 'running_mean', 'running_var'))
            k = g / np.sqrt(v + 1e-5)
            w = w * k[:, None, None, None]
            b = (b - m) * k + be
        return self.op('Conv', [x, self.cte(w), self.cte(b)], kernel_shape=list(w.shape[2:]),
                       strides=[stride, stride], group=grups)

    def lrelu(self, x):
        return self.op('LeakyRelu', [x], alpha=0.2)

    def bloc(self, x, pre):   # UNetConvBlock, dues convolucions
        for i in (1, 5):
            x = self.lrelu(self.conv(self.mirall(x, 1), f'{pre}.block.{i}', bn=f'{pre}.block.{i + 1}'))
        return x


def construeix(pesos, profunditat=4):
    g = Graf(pesos)
    x = g.lrelu(g.conv(g.mirall('entrada', 3), 'first.1'))
    ponts = []
    for i in range(profunditat):
        ponts.append(x)
        x = g.lrelu(g.conv(g.mirall(x, 1), f'down_sample.{i}.1', bn=f'down_sample.{i}.2'))
        filt = g.p[f'down_sample.{i}.4.filt']                       # el filtre que suavitza abans de reduir
        x = g.conv(g.mirall(x, 1), None, stride=2, grups=filt.shape[0], pesos=filt)
        x = g.bloc(x, f'down_path.{i}')
    for i in range(profunditat):
        x = g.op('Resize', [x, '', g.cte([1, 1, 2, 2])], mode='linear',
                 coordinate_transformation_mode='half_pixel')          # Upsample bilineal, align_corners=False
        x = g.conv(g.mirall(x, 1), f'up_path.{i}.up.2')
        x = g.op('Concat', [x, ponts[-i - 1]], axis=1)
        x = g.bloc(x, f'up_path.{i}.conv_block')
    y = g.op('Sigmoid', [g.conv(g.mirall(x, 1), 'last.1')])
    graf = h.make_graph(g.nodes, 'ratllades',
                        [h.make_tensor_value_info('entrada', T.FLOAT, [1, 1, 'alt', 'ample'])],
                        [h.make_tensor_value_info(y, T.FLOAT, [1, 1, 'alt', 'ample'])], g.inits)
    m = h.make_model(graf, opset_imports=[h.make_opsetid('', 17)], producer_name='Eines')
    m.ir_version = 8
    onnx.checker.check_model(m)
    return m


if __name__ == '__main__':
    ck = llegeix_antic(sys.argv[1])
    m = construeix(ck['model_state'])
    pesos_a_mitja_precisio(m)
    onnx.checker.check_model(m)
    onnx.save(m, sys.argv[2])
    print(dict(collections.Counter(n.op_type for n in m.graph.node)))
