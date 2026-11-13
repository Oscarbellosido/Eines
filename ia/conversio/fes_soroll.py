"""Construeix en format ONNX la xarxa que treu el soroll i el gra («Soroll i
borrós»), a partir del fitxer original (que es llegeix sense executar res,
amb llegeix_pth.py):

- SCUNet (Kai Zhang i altres, llicència Apache 2.0), la versió per a fotos de
  debò («real», PSNR): treu el soroll, el gra i els quadrets del JPEG.
      https://github.com/cszn/KAIR/releases/download/v1.0/scunet_color_real_psnr.pth

La xarxa es munta peça a peça igual que al codi original
(models/network_scunet.py), però amb una mida fixa de tros (T × T): així les
finestres, el seu desplaçament i les seves màscares surten calculats
d'avançada, i la gràfica no s'ha de tornar a preparar a cada tros. L'app fa la
foto per trossos.

Entrada i sortida: la foto en RGB de 0 a 1, d'1 × 3 × T × T. Els pesos es
desen amb la meitat de precisió (pesos_a_mitja_precisio, com l'IS-Net).

    python fes_soroll.py scunet_color_real_psnr.pth soroll.onnx 256
"""
import os, sys
import numpy as np, onnx
from onnx import helper as h, numpy_helper as nh, TensorProto as T
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from llegeix_pth import llegeix
from fes_fons import pesos_a_mitja_precisio


class Graf:
    def __init__(self, pesos):
        self.p = {k: np.asarray(v, np.float32) for k, v in pesos.items()}
        self.fets = set()
        self.nodes, self.inits, self.n, self.ctes = [], [], 0, {}

    def nom(self, pre):
        self.n += 1
        return f'{pre}_{self.n}'

    def w(self, clau):            # un pes del fitxer (cadascun, una sola vegada)
        self.fets.add(clau)
        return self.p[clau]

    def cte(self, arr, dt=np.float32):
        arr = np.ascontiguousarray(np.asarray(arr, dt))
        n = self.nom('c')
        self.inits.append(nh.from_array(arr, n))
        return n

    def op(self, tipus, entrades, **atr):
        s = self.nom(tipus.lower())
        self.nodes.append(h.make_node(tipus, entrades, [s], **atr))
        return s

    def conv(self, x, pre, pad=0, stride=1, grups=1, biaix=True):
        w = self.w(pre + '.weight')
        e = [x, self.cte(w)]
        if biaix and pre + '.bias' in self.p: e.append(self.cte(self.w(pre + '.bias')))
        return self.op('Conv', e, kernel_shape=list(w.shape[2:]), strides=[stride, stride],
                       pads=[pad] * 4, group=grups)

    def lineal(self, x, pre):     # nn.Linear sobre l'últim eix
        y = self.op('MatMul', [x, self.cte(self.w(pre + '.weight').T)])
        return self.op('Add', [y, self.cte(self.w(pre + '.bias'))])

    def forma(self, x, f):
        return self.op('Reshape', [x, self.cte(f, np.int64)])

    def gira(self, x, perm):
        return self.op('Transpose', [x], perm=perm)

    def tros(self, x, eix, ini, fi):
        return self.op('Slice', [x, self.cte([ini], np.int64), self.cte([fi], np.int64), self.cte([eix], np.int64)])

    def gelu(self, x):            # nn.GELU() exacta: 0,5·x·(1 + erf(x/√2))
        e = self.op('Erf', [self.op('Mul', [x, self.cte(1 / np.sqrt(2))])])
        return self.op('Mul', [self.op('Mul', [x, self.cte(0.5)]), self.op('Add', [e, self.cte(1.0)])])

    def model(self, nom, entrada, sortida, mida):
        falten = set(self.p) - self.fets
        if falten: raise SystemExit(f'hi ha pesos que no s\'han fet servir: {sorted(falten)[:5]}')
        g = h.make_graph(self.nodes, nom, [h.make_tensor_value_info(entrada, T.FLOAT, mida)],
                         [h.make_tensor_value_info(sortida, T.FLOAT, mida)], self.inits)
        m = h.make_model(g, opset_imports=[h.make_opsetid('', 17)], producer_name='Eines')
        m.ir_version = 8
        onnx.checker.check_model(m)
        return m


# ------------------------------------------------------------------ SCUNet
WS = 8          # la mida de les finestres de l'atenció


def finestres_scunet(g, x, H, C, desplaca, pre):
    """WMSA: atenció dins de finestres de 8 × 8, amb el biaix de posició relativa
    i, a les desplaçades (SW), la màscara que separa els trossos que el
    desplaçament ha ajuntat. x: [1, H, H, C] (NHWC)."""
    hd = 32; heads = C // hd; nw = H // WS; s = WS // 2
    if desplaca:              # torch.roll(x, (-s, -s), (1, 2))
        for eix in (1, 2):
            x = g.op('Concat', [g.tros(x, eix, s, H), g.tros(x, eix, 0, s)], axis=eix)
    x = g.forma(x, [1, nw, WS, nw, WS, C])
    x = g.gira(x, [0, 1, 3, 2, 4, 5])
    x = g.forma(x, [nw * nw, WS * WS, C])
    qkv = g.lineal(x, pre + '.embedding_layer')                    # [N, 64, 3C]
    qkv = g.gira(g.forma(qkv, [nw * nw, WS * WS, 3, heads, hd]), [2, 3, 0, 1, 4])   # [3, h, N, 64, hd]
    q, k, v = (g.op('Squeeze', [g.tros(qkv, 0, i, i + 1), g.cte([0], np.int64)]) for i in range(3))
    sim = g.op('MatMul', [q, g.gira(k, [0, 1, 3, 2])])             # [h, N, 64, 64]
    sim = g.op('Mul', [sim, g.cte(hd ** -0.5)])
    # el biaix de posició relativa (relative_embedding del codi original)
    rp = g.w(pre + '.relative_position_params')                    # [h, 15, 15]
    cord = np.array([[i, j] for i in range(WS) for j in range(WS)])
    rel = cord[:, None, :] - cord[None, :, :] + WS - 1
    biaix = rp[:, rel[:, :, 0], rel[:, :, 1]]                      # [h, 64, 64]
    sim = g.op('Add', [sim, g.cte(biaix[:, None])])
    if desplaca:
        # generate_mask: a l'última fila de finestres, els punts de dalt (p1 < s)
        # no es veuen amb els de baix, i el mateix amb les columnes. Es desa
        # partida (fila i columna) i se suma: el que s'amaga rep -1e4.
        p = np.arange(WS); dalt = p < s
        talla = dalt[:, None] != dalt[None, :]                     # [8, 8]
        A = np.zeros((nw, WS, WS, WS, WS), np.float32)             # [w1, p1, p2, p3, p4]
        A[-1] = np.where(talla[:, None, :, None], -1e4, 0)
        B = np.zeros((nw, WS, WS, WS, WS), np.float32)             # [w2, p1, p2, p3, p4]
        B[-1] = np.where(talla[None, :, None, :], -1e4, 0)
        A = A.reshape(nw, 1, WS * WS, WS * WS); B = B.reshape(1, nw, WS * WS, WS * WS)
        m = g.op('Add', [g.cte(A), g.cte(B)])                      # [nw, nw, 64, 64]
        sim = g.op('Add', [sim, g.forma(m, [1, nw * nw, WS * WS, WS * WS])])
    pr = g.op('Softmax', [sim], axis=-1)
    o = g.op('MatMul', [pr, v])                                    # [h, N, 64, hd]
    o = g.forma(g.gira(o, [1, 2, 0, 3]), [nw * nw, WS * WS, C])
    o = g.lineal(o, pre + '.linear')
    o = g.forma(o, [1, nw, nw, WS, WS, C])
    o = g.forma(g.gira(o, [0, 1, 3, 2, 4, 5]), [1, H, H, C])
    if desplaca:              # torch.roll(x, (s, s), (1, 2))
        for eix in (1, 2):
            o = g.op('Concat', [g.tros(o, eix, H - s, H), g.tros(o, eix, 0, H - s)], axis=eix)
    return o


def layernorm(g, x, pre):     # nn.LayerNorm sobre l'últim eix
    return g.op('LayerNormalization', [x, g.cte(g.w(pre + '.weight')), g.cte(g.w(pre + '.bias'))], axis=-1, epsilon=1e-5)


def bloc_scunet(g, x, pre, C2, H, desplaca):
    """ConvTransBlock: meitat convolució, meitat Swin. x: [1, 2·C2, H, H]."""
    y = g.conv(x, pre + '.conv1_1')
    cx, tx = g.tros(y, 1, 0, C2), g.tros(y, 1, C2, 2 * C2)
    c = g.conv(g.op('Relu', [g.conv(cx, pre + '.conv_block.0', pad=1)]), pre + '.conv_block.2', pad=1)
    cx = g.op('Add', [c, cx])
    t = g.gira(tx, [0, 2, 3, 1])
    b = pre + '.trans_block'
    t = g.op('Add', [t, finestres_scunet(g, layernorm(g, t, b + '.ln1'), H, C2, desplaca, b + '.msa')])
    m = g.lineal(g.gelu(g.lineal(layernorm(g, t, b + '.ln2'), b + '.mlp.0')), b + '.mlp.2')
    t = g.gira(g.op('Add', [t, m]), [0, 3, 1, 2])
    r = g.conv(g.op('Concat', [cx, t], axis=1), pre + '.conv1_2')
    return g.op('Add', [x, r])


def scunet(pesos, mida, config=(4, 4, 4, 4, 4, 4, 4), dim=64):
    assert mida % 64 == 0
    g = Graf(pesos)
    x1 = g.conv('entrada', 'm_head.0', pad=1)

    def etapa(x, nom, n, C2, H, primer=0):
        for i in range(n):
            # 'W' als parells i 'SW' als senars (el codi original només posa 'W'
            # si input_resolution <= 8, i amb el valor de sempre, 256, mai no passa)
            x = bloc_scunet(g, x, f'{nom}.{primer + i}', C2, H, i % 2 == 1)
        return x
    H = mida
    x2 = g.conv(etapa(x1, 'm_down1', config[0], dim // 2, H), f'm_down1.{config[0]}', stride=2)
    x3 = g.conv(etapa(x2, 'm_down2', config[1], dim, H // 2), f'm_down2.{config[1]}', stride=2)
    x4 = g.conv(etapa(x3, 'm_down3', config[2], 2 * dim, H // 4), f'm_down3.{config[2]}', stride=2)
    x = etapa(x4, 'm_body', config[3], 4 * dim, H // 8)

    def puja(x, nom):
        w = g.w(nom + '.weight')
        return g.op('ConvTranspose', [x, g.cte(w)], kernel_shape=[2, 2], strides=[2, 2])
    x = etapa(puja(g.op('Add', [x, x4]), 'm_up3.0'), 'm_up3', config[4], 2 * dim, H // 4, 1)
    x = etapa(puja(g.op('Add', [x, x3]), 'm_up2.0'), 'm_up2', config[5], dim, H // 2, 1)
    x = etapa(puja(g.op('Add', [x, x2]), 'm_up1.0'), 'm_up1', config[6], dim // 2, H, 1)
    y = g.conv(g.op('Add', [x, x1]), 'm_tail.0', pad=1)
    return g.model('scunet', 'entrada', y, [1, 3, mida, mida])


if __name__ == '__main__':
    origen, desti, mida = sys.argv[1], sys.argv[2], int(sys.argv[3])
    m = scunet(llegeix(origen), mida)
    pesos_a_mitja_precisio(m)
    onnx.checker.check_model(m)
    onnx.save(m, desti)
    print(desti, os.path.getsize(desti) // 1048576, 'MB')
