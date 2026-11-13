"""Construeix LaMa («big-lama», de Samsung AI, llicència Apache 2.0:
https://github.com/advimman/lama) en format ONNX, per a l'esborrador del mode
Ordinador. Parteix del fitxer que publica el projecte IOPaint a GitHub:

    https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt

És un fitxer «TorchScript», que porta el model escrit a dins en una mena de
Python. Aquí d'aquell codi no se n'executa res: només se'n llegeixen els pesos
(amb el lector prudent de fes_migan.py, que només accepta números) i la xarxa
es munta peça a peça igual que al codi original
(saicinpainting/training/modules/ffc.py, amb la configuració de big-lama:
FFCResNetGenerator, 18 blocs, ratio_gin 0,75, sense LFU).

La gràcia de LaMa són les convolucions de Fourier (FourierUnit): passen la
meitat «global» dels canals a freqüències (rfftn), hi fan una convolució i
tornen (irfftn). Per això omple bé forats grossos. El motor del navegador no
sap fer transformades de Fourier a la gràfica; com que la mida és fixa (els
blocs treballen a 64 × 64), aquí es fan com a multiplicacions de matrius amb
les taules de sinus i cosinus (`dft2`, `idft2`), que la gràfica fa bé. Abans
de desar, l'script comprova que donen el mateix que numpy.fft.

Entrades: `foto` [1,3,512,512] de 0 a 1 i `mascara` [1,1,512,512], 1 on s'ha
d'omplir. Sortida [1,3,512,512] de 0 a 1, amb la resta de la foto ja posada
(com al model original). Pesos amb la meitat de precisió, en dos trossos de
menys de 95 MB.

    python fes_lama.py big-lama.pt <carpeta de sortida>
"""
import os, sys
import numpy as np, onnx
from onnx import helper as h, numpy_helper as nh, TensorProto as T
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fes_migan
from fes_fons import pesos_a_mitja_precisio

MIDA = 512
TROS = 95 * 1000 * 1000


def pesos_de(cami):
    fes_migan.TIPUS.update({'LongStorage': np.int64, 'IntStorage': np.int32})
    model, _, _ = fes_migan.llegeix(cami)
    pes = {}

    def recorre(m, pre):
        for k, v in m.estat.items() if isinstance(m.estat, dict) else []:
            if isinstance(v, fes_migan.Modul): recorre(v, pre + k + '.')
            elif isinstance(v, np.ndarray) and v.dtype != np.int64: pes[pre + k] = v.astype(np.float32)
    recorre(model, '')
    return {k[len('generator.model.'):]: v for k, v in pes.items()}


def taules_dft(n):
    """Les taules de la transformada de Fourier de mida n (normalitzada «ortho»)."""
    k = np.arange(n)
    ang = 2 * np.pi * np.outer(k, k) / n
    m = n // 2 + 1
    c_r, s_r = np.cos(ang[:, :m]), np.sin(ang[:, :m])           # [n, m]: endavant, real → meitat
    pes = np.full(m, 2.0); pes[0] = 1; pes[-1] = 1                # irfft: la meitat que falta compta doble
    ci, si = pes[:, None] * np.cos(ang[:m, :]), pes[:, None] * np.sin(ang[:m, :])  # [m, n]: tornada
    return c_r, s_r, np.cos(ang), np.sin(ang), ci, si


def comprova_dft(n=8):
    """dft2 i idft2 (en numpy, igual que al graf) contra numpy.fft."""
    c_r, s_r, ch, sh, ci, si = taules_dft(n)
    x = np.random.default_rng(0).normal(size=(3, n, n))
    ar, ai = x @ c_r, -(x @ s_r)
    yr, yi = (ch @ ar + sh @ ai) / n, (ch @ ai - sh @ ar) / n
    ref = np.fft.rfftn(x, axes=(-2, -1), norm='ortho')
    assert np.allclose(yr, ref.real) and np.allclose(yi, ref.imag), 'la dft no quadra'
    zr, zi = np.random.default_rng(1).normal(size=(2, 3, n, n // 2 + 1))
    br, bi = ch @ zr - sh @ zi, ch @ zi + sh @ zr
    out = (br @ ci - bi @ si) / n
    ref = np.fft.irfftn(zr + 1j * zi, s=(n, n), axes=(-2, -1), norm='ortho')
    assert np.allclose(out, ref), 'la dft inversa no quadra'


class Graf:
    def __init__(self, pes):
        self.p, self.fets = pes, set()
        self.nodes, self.inits, self.n = [], [], 0

    def nom(self, pre):
        self.n += 1
        return f'{pre}_{self.n}'

    def w(self, k):
        self.fets.add(k)
        return self.p[k]

    def cte(self, a, dt=np.float32):
        n = self.nom('c')
        self.inits.append(nh.from_array(np.ascontiguousarray(np.asarray(a, dt)), n))
        return n

    def op(self, tipus, e, **atr):
        s = self.nom(tipus.lower())
        self.nodes.append(h.make_node(tipus, e, [s], **atr))
        return s

    def mirall(self, x, p):   # reflection_pad2d
        return self.op('Pad', [x, self.cte([0, 0, p, p, 0, 0, p, p], np.int64)], mode='reflect')

    def conv(self, x, pre, k, stride=1, pad_mirall=0):
        if pad_mirall: x = self.mirall(x, pad_mirall)
        e = [x, self.cte(self.w(pre + '.weight'))]
        if pre + '.bias' in self.p: e.append(self.cte(self.w(pre + '.bias')))
        return self.op('Conv', e, kernel_shape=[k, k], strides=[stride, stride])

    def bn(self, x, pre):     # BatchNorm (en mode de fer servir): multiplicar i sumar per canal
        g, b, m, v = (self.w(f'{pre}.{k}') for k in ('weight', 'bias', 'running_mean', 'running_var'))
        esc = g / np.sqrt(v + 1e-5)
        return self.op('Add', [self.op('Mul', [x, self.cte(esc[None, :, None, None])]),
                               self.cte((b - m * esc)[None, :, None, None])])

    def relu(self, x): return self.op('Relu', [x])

    def tros(self, x, eix, ini, fi):
        return self.op('Slice', [x, self.cte([ini], np.int64), self.cte([fi], np.int64), self.cte([eix], np.int64)])

    def mm(self, a, b): return self.op('MatMul', [a, b])

    def fourier(self, x, pre, C, n):
        """FourierUnit: rfftn → (real, imaginari) com a canals → conv 1×1 → BN →
        ReLU → irfftn. Les transformades, amb multiplicacions de matrius."""
        c_r, s_r, ch, sh, ci, si = (self.cte(t) for t in taules_dft(n))
        ar, ai = self.mm(x, c_r), self.op('Neg', [self.mm(x, s_r)])               # al llarg de W
        yr = self.op('Add', [self.mm(ch, ar), self.mm(sh, ai)])                    # al llarg de H
        yi = self.op('Sub', [self.mm(ch, ai), self.mm(sh, ar)])
        k = self.cte(1.0 / n)
        yr, yi = self.op('Mul', [yr, k]), self.op('Mul', [yi, k])
        m = n // 2 + 1
        u = self.cte([2], np.int64)
        y = self.op('Concat', [self.op('Unsqueeze', [yr, u]), self.op('Unsqueeze', [yi, u])], axis=2)
        y = self.op('Reshape', [y, self.cte([1, 2 * C, n, m], np.int64)])           # canal = c·2 + (re, im)
        y = self.relu(self.bn(self.op('Conv', [y, self.cte(self.w(pre + '.conv_layer.weight'))], kernel_shape=[1, 1]), pre + '.bn'))
        y = self.op('Reshape', [y, self.cte([1, C, 2, n, m], np.int64)])
        zr = self.op('Squeeze', [self.tros(y, 2, 0, 1), u])
        zi = self.op('Squeeze', [self.tros(y, 2, 1, 2), u])
        br = self.op('Sub', [self.mm(ch, zr), self.mm(sh, zi)])                    # tornada al llarg de H
        bi = self.op('Add', [self.mm(ch, zi), self.mm(sh, zr)])
        out = self.op('Sub', [self.mm(br, ci), self.mm(bi, si)])                   # i al llarg de W (c2r)
        return self.op('Mul', [out, k])

    def espectral(self, x, pre, n):
        y = self.relu(self.bn(self.conv(x, pre + '.conv1.0', 1), pre + '.conv1.1'))
        C = self.p[pre + '.conv1.0.weight'].shape[0]
        y = self.op('Add', [y, self.fourier(y, pre + '.fu', C, n)])
        return self.conv(y, pre + '.conv2', 1)

    def ffc(self, xl, xg, pre, n):
        """FFC_BN_ACT amb la meitat local (xl) i la global (xg)."""
        f = pre + '.ffc'
        ol = self.op('Add', [self.conv(xl, f + '.convl2l', 3, pad_mirall=1), self.conv(xg, f + '.convg2l', 3, pad_mirall=1)])
        og = self.op('Add', [self.conv(xl, f + '.convl2g', 3, pad_mirall=1), self.espectral(xg, f + '.convg2g', n)])
        return self.relu(self.bn(ol, pre + '.bn_l')), self.relu(self.bn(og, pre + '.bn_g'))


def construeix(pes):
    g = Graf(pes)
    foto, masc = 'foto', 'mascara'
    menys = g.op('Sub', [g.cte(1.0), masc])
    x = g.op('Concat', [g.op('Mul', [foto, menys]), masc], axis=1)
    x = g.relu(g.bn(g.conv(g.mirall(x, 3), '1.ffc.convl2l', 7), '1.bn_l'))
    x = g.relu(g.bn(g.conv(x, '2.ffc.convl2l', 3, 2, pad_mirall=1), '2.bn_l'))
    x = g.relu(g.bn(g.conv(x, '3.ffc.convl2l', 3, 2, pad_mirall=1), '3.bn_l'))
    xl = g.relu(g.bn(g.conv(x, '4.ffc.convl2l', 3, 2, pad_mirall=1), '4.bn_l'))
    xg = g.relu(g.bn(g.conv(x, '4.ffc.convl2g', 3, 2, pad_mirall=1), '4.bn_g'))
    n = MIDA // 8
    for b in range(5, 23):    # els 18 blocs de Fourier
        l1, g1 = g.ffc(xl, xg, f'{b}.conv1', n)
        l2, g2 = g.ffc(l1, g1, f'{b}.conv2', n)
        xl, xg = g.op('Add', [xl, l2]), g.op('Add', [xg, g2])
    x = g.op('Concat', [xl, xg], axis=1)
    for c, b in ((24, 25), (27, 28), (30, 31)):
        x = g.op('ConvTranspose', [x, g.cte(g.w(f'{c}.weight')), g.cte(g.w(f'{c}.bias'))],
                 kernel_shape=[3, 3], strides=[2, 2], pads=[1, 1, 1, 1], output_padding=[1, 1])
        x = g.relu(g.bn(x, str(b)))
    y = g.op('Sigmoid', [g.conv(g.mirall(x, 3), '34', 7)])
    y = g.op('Add', [g.op('Mul', [masc, y]), g.op('Mul', [menys, foto])])
    falten = set(g.p) - g.fets
    if falten: raise SystemExit(f'pesos sense fer servir: {sorted(falten)[:6]}')
    graf = h.make_graph(g.nodes, 'lama',
                        [h.make_tensor_value_info(foto, T.FLOAT, [1, 3, MIDA, MIDA]),
                         h.make_tensor_value_info(masc, T.FLOAT, [1, 1, MIDA, MIDA])],
                        [h.make_tensor_value_info(y, T.FLOAT, [1, 3, MIDA, MIDA])], g.inits)
    m = h.make_model(graf, opset_imports=[h.make_opsetid('', 17)], producer_name='Eines')
    m.ir_version = 8
    onnx.checker.check_model(m)
    return m


if __name__ == '__main__':
    comprova_dft(); comprova_dft(64)
    m = construeix(pesos_de(sys.argv[1]))
    pesos_a_mitja_precisio(m)
    onnx.checker.check_model(m)
    dades = m.SerializeToString()
    desti = sys.argv[2]; os.makedirs(desti, exist_ok=True)
    n = 0
    for i in range(0, len(dades), TROS):
        n += 1
        with open(os.path.join(desti, f'lama-512.onnx.{n}'), 'wb') as f: f.write(dades[i:i + TROS])
    print(f'{len(dades)} bytes en {n} trossos')
