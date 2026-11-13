"""Construeix en format ONNX les dues xarxes de «Arregla les cares»:

1. RetinaFace amb MobileNet 0.25 (troba les cares i cinc punts de cadascuna:
   els ulls, el nas i les comissures de la boca), a partir de
   detection_mobilenet0.25_Final.pth del projecte facexlib (MIT):
   https://github.com/xinntao/facexlib/releases/tag/v0.1.0
2. GFPGAN v1.4 (arregla una cara posada dreta a 512 × 512), a partir de
   GFPGANv1.4.pth del projecte GFPGAN de Tencent ARC (Apache 2.0):
   https://github.com/TencentARC/GFPGAN/releases/tag/v1.3.4

Tots dos fitxers són del format antic de PyTorch i es llegeixen sense
executar res (el lector de fes_ratllades.py). Les xarxes es munten peça a peça
igual que al codi original (facexlib/detection/retinaface*.py i
gfpgan/archs/gfpganv1_clean_arch.py + stylegan2_clean_arch.py), amb la
normalització ja ficada dins de cada convolució.

Detalls de GFPGAN:
- Cada «convolució modulada» de StyleGAN2 depèn de la cara: els pesos es
  multipliquen per un estil i es tornen a normalitzar. Amb una sola cara a la
  vegada és el mateix que multiplicar l'entrada per l'estil, fer la convolució
  amb els pesos de sempre i multiplicar la sortida per la normalització, que
  es calcula amb un producte de matrius (W2 · estil², on W2 és la suma dels
  quadrats de cada filtre). Així no cal cap peça estranya.
- El soroll que StyleGAN2 hi afegeix és el que porta el fitxer desat (sempre
  el mateix): així la mateixa foto dona sempre el mateix.
- Els pesos es desen amb la meitat de precisió (174 MB), i el fitxer es parteix
  en dos trossos de menys de 100 MB, que GitHub no n'accepta de més grossos;
  l'app els torna a ajuntar.

Entrades i sortides:
- RetinaFace: [1,3,alt,ample] en BGR, menys la mitjana (104, 117, 123), amb
  l'alt i l'ample múltiples de 32. Surten les caixes [1,N,4], la probabilitat
  de cara [1,N,2] i els punts [1,N,10], per als «anchors» de cada nivell.
- GFPGAN: [1,3,512,512] en RGB de -1 a 1; surt el mateix.

    python fes_cares.py <carpeta amb els dos .pth> <carpeta de sortida>
"""
import collections, os, sys
import numpy as np, onnx
from onnx import helper as h, numpy_helper as nh, TensorProto as T
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fes_ratllades import llegeix_antic
from fes_fons import pesos_a_mitja_precisio


class Graf:
    def __init__(self, pesos):
        self.p = {k.replace('module.', ''): v for k, v in pesos.items()}
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

    def w(self, k):
        return self.p[k].astype(np.float32)

    def conv(self, x, pre, pad=0, stride=1, grups=1, bn=None, w=None, b=None):
        w = self.w(pre + '.weight') if w is None else w
        if b is None:
            b = self.w(pre + '.bias') if (pre and pre + '.bias' in self.p) else np.zeros(w.shape[0], np.float32)
        if bn:
            g, be, m, v = (self.w(f'{bn}.{k}') for k in ('weight', 'bias', 'running_mean', 'running_var'))
            k = g / np.sqrt(v + 1e-5)
            w = w * k[:, None, None, None]
            b = (b - m) * k + be
        return self.op('Conv', [x, self.cte(w), self.cte(b)], kernel_shape=list(w.shape[2:]),
                       strides=[stride, stride], pads=[pad] * 4, group=grups)

    def lrelu(self, x, a):
        return self.op('LeakyRelu', [x], alpha=float(a)) if a else self.op('Relu', [x])

    def escala(self, x, f):     # interpolació bilineal (align_corners=False)
        return self.op('Resize', [x, '', self.cte([1, 1, f, f])], mode='linear',
                       coordinate_transformation_mode='half_pixel')


# ---------------------------------------------------------------- RetinaFace
def retinaface(pesos):
    g = Graf(pesos)
    cbn = lambda x, pre, stride=1, leaky=0.1, relu=True, k=3: (
        (lambda y: g.lrelu(y, leaky) if relu else y)(
            g.conv(x, pre + '.0', pad=k // 2, stride=stride, bn=pre + '.1')))

    def dw(x, pre, stride):
        cin = g.p[pre + '.0.weight'].shape[0]
        x = g.lrelu(g.conv(x, pre + '.0', pad=1, stride=stride, grups=cin, bn=pre + '.1'), 0.1)
        return g.lrelu(g.conv(x, pre + '.3', bn=pre + '.4'), 0.1)

    x = cbn('entrada', 'body.stage1.0', stride=2)
    for i, s in [(1, 1), (2, 2), (3, 1), (4, 2), (5, 1)]: x = dw(x, f'body.stage1.{i}', s)
    c1 = x
    for i, s in [(0, 2), (1, 1), (2, 1), (3, 1), (4, 1), (5, 1)]: x = dw(x, f'body.stage2.{i}', s)
    c2 = x
    for i, s in [(0, 2), (1, 1)]: x = dw(x, f'body.stage3.{i}', s)
    c3 = x
    o1 = cbn(c1, 'fpn.output1', k=1); o2 = cbn(c2, 'fpn.output2', k=1); o3 = cbn(c3, 'fpn.output3', k=1)
    amunt = lambda y: g.op('Resize', [y, '', g.cte([1, 1, 2, 2])], mode='nearest',
                           coordinate_transformation_mode='asymmetric', nearest_mode='floor')
    o2 = cbn(g.op('Add', [o2, amunt(o3)]), 'fpn.merge2')
    o1 = cbn(g.op('Add', [o1, amunt(o2)]), 'fpn.merge1')

    def ssh(y, pre):
        a = cbn(y, pre + '.conv3X3', relu=False)
        b1 = cbn(y, pre + '.conv5X5_1')
        b = cbn(b1, pre + '.conv5X5_2', relu=False)
        c = cbn(cbn(b1, pre + '.conv7X7_2'), pre + '.conv7x7_3', relu=False)
        return g.op('Relu', [g.op('Concat', [a, b, c], axis=1)])
    feats = [ssh(o1, 'ssh1'), ssh(o2, 'ssh2'), ssh(o3, 'ssh3')]

    def cap(nom, k):
        parts = []
        for i, f in enumerate(feats):
            y = g.conv(f, f'{nom}.{i}.conv1x1')
            y = g.op('Transpose', [y], perm=[0, 2, 3, 1])
            parts.append(g.op('Reshape', [y, g.cte([1, -1, k], np.int64)]))
        return g.op('Concat', parts, axis=1)
    caixes = cap('BboxHead', 4)
    cares = g.op('Softmax', [cap('ClassHead', 2)], axis=-1)
    punts = cap('LandmarkHead', 10)
    graf = h.make_graph(g.nodes, 'retinaface',
                        [h.make_tensor_value_info('entrada', T.FLOAT, [1, 3, 'alt', 'ample'])],
                        [h.make_tensor_value_info(caixes, T.FLOAT, [1, 'n', 4]),
                         h.make_tensor_value_info(cares, T.FLOAT, [1, 'n', 2]),
                         h.make_tensor_value_info(punts, T.FLOAT, [1, 'n', 10])], g.inits)
    return graf


# ------------------------------------------------------------------- GFPGAN
def gfpgan(pesos):
    g = Graf(pesos)
    lr = lambda y: g.lrelu(y, 0.2)

    def resblock(x, pre, f):
        y = lr(g.conv(x, pre + '.conv1', pad=1))
        y = lr(g.conv(g.escala(y, f), pre + '.conv2', pad=1))
        return g.op('Add', [y, g.conv(g.escala(x, f), pre + '.skip')])

    # el codificador (U-Net)
    feat = lr(g.conv('entrada', 'conv_body_first'))
    ponts = []
    for i in range(7):
        feat = resblock(feat, f'conv_body_down.{i}', 0.5)
        ponts.insert(0, feat)
    feat = lr(g.conv(feat, 'final_conv', pad=1))
    pla = g.op('Reshape', [feat, g.cte([1, -1], np.int64)])
    estil = g.op('Gemm', [pla, g.cte(g.w('final_linear.weight')), g.cte(g.w('final_linear.bias'))], transB=1)
    latents = g.op('Reshape', [estil, g.cte([16, 512], np.int64)])
    cond = []
    for i in range(7):
        feat = resblock(g.op('Add', [feat, ponts[i]]), f'conv_body_up.{i}', 2)
        for c in ('condition_scale', 'condition_shift'):
            cond.append(g.conv(lr(g.conv(feat, f'{c}.{i}.0', pad=1)), f'{c}.{i}.2', pad=1))

    # el descodificador (StyleGAN2)
    d = 'stylegan_decoder.'
    def latent(i):
        return g.op('Gather', [latents, g.cte([i], np.int64)], axis=0)          # [1,512]

    def modulada(x, pre, i, demod, amunt=False):
        w = g.w(pre + '.weight')[0]                                              # [out,in,k,k]
        s = g.op('Gemm', [latent(i), g.cte(g.w(pre + '.modulation.weight')), g.cte(g.w(pre + '.modulation.bias'))], transB=1)
        s4 = g.op('Reshape', [s, g.cte([1, -1, 1, 1], np.int64)])
        if amunt: x = g.escala(x, 2)
        y = g.conv(g.op('Mul', [x, s4]), None, pad=w.shape[2] // 2, w=w, b=np.zeros(w.shape[0], np.float32))
        if demod:
            w2 = (w ** 2).sum(axis=(2, 3))                                       # [out,in]
            q = g.op('Gemm', [g.op('Mul', [s, s]), g.cte(w2), g.cte(np.full(w.shape[0], 1e-8, np.float32))], transB=1)
            dd = g.op('Reciprocal', [g.op('Sqrt', [q])])
            y = g.op('Mul', [y, g.op('Reshape', [dd, g.cte([1, -1, 1, 1], np.int64)])])
        return y

    def styleconv(x, pre, i, soroll, amunt=False):
        y = modulada(x, pre + '.modulated_conv', i, True, amunt)
        y = g.op('Mul', [y, g.cte([np.float32(2 ** 0.5)])])
        y = g.op('Add', [y, g.cte(g.w(pre + '.weight')[0] * g.w(d + 'noises.' + soroll))])
        y = g.op('Add', [y, g.cte(g.w(pre + '.bias'))])
        return lr(y)

    def torgb(x, pre, i, skip):
        y = g.op('Add', [modulada(x, pre + '.modulated_conv', i, False), g.cte(g.w(pre + '.bias'))])
        return y if skip is None else g.op('Add', [y, g.escala(skip, 2)])

    out = g.cte(g.w(d + 'constant_input.weight'))
    out = styleconv(out, d + 'style_conv1', 0, 'noise0')
    skip = torgb(out, d + 'to_rgb1', 1, None)
    i = 1
    for k in range(7):
        out = styleconv(out, f'{d}style_convs.{2 * k}', i, f'noise{2 * k + 1}', amunt=True)
        c = g.p[f'{d}style_convs.{2 * k}.bias'].shape[1]
        igual = g.op('Slice', [out, g.cte([0], np.int64), g.cte([c // 2], np.int64), g.cte([1], np.int64)])
        sft = g.op('Slice', [out, g.cte([c // 2], np.int64), g.cte([c], np.int64), g.cte([1], np.int64)])
        sft = g.op('Add', [g.op('Mul', [sft, cond[i - 1]]), cond[i]])
        out = g.op('Concat', [igual, sft], axis=1)
        out = styleconv(out, f'{d}style_convs.{2 * k + 1}', i + 1, f'noise{2 * k + 2}')
        skip = torgb(out, f'{d}to_rgbs.{k}', i + 2, skip)
        i += 2
    graf = h.make_graph(g.nodes, 'gfpgan_v14',
                        [h.make_tensor_value_info('entrada', T.FLOAT, [1, 3, 512, 512])],
                        [h.make_tensor_value_info(skip, T.FLOAT, [1, 3, 512, 512])], g.inits)
    return graf


def model(graf):
    m = h.make_model(graf, opset_imports=[h.make_opsetid('', 17)], producer_name='Eines')
    m.ir_version = 8
    return m


def fes(origen, desti, trossos=2):
    os.makedirs(desti, exist_ok=True)
    rf = model(retinaface(llegeix_antic(os.path.join(origen, 'detection_mobilenet0.25_Final.pth'))))
    onnx.checker.check_model(rf)
    onnx.save(rf, os.path.join(desti, 'cares-troba.onnx'))
    gf = model(gfpgan(llegeix_antic(os.path.join(origen, 'GFPGANv1.4.pth'))['params_ema']))
    pesos_a_mitja_precisio(gf)
    onnx.checker.check_model(gf)
    dades = gf.SerializeToString()
    mida = -(-len(dades) // trossos)
    for k in range(trossos):          # en trossos de menys de 100 MB; l'app els ajunta
        with open(os.path.join(desti, f'cares-arregla.onnx.{k + 1}'), 'wb') as f:
            f.write(dades[k * mida:(k + 1) * mida])
    print('RetinaFace:', dict(collections.Counter(n.op_type for n in rf.graph.node)))
    print('GFPGAN:', dict(collections.Counter(n.op_type for n in gf.graph.node)), len(dades) // 1048576, 'MB')


if __name__ == '__main__':
    fes(sys.argv[1], sys.argv[2])
