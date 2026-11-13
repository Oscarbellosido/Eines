"""Construeix MobileSAM (Chaoning Zhang i altres, llicència Apache 2.0:
https://github.com/ChaoningZhang/MobileSAM) en format ONNX, per seleccionar
un objecte de la foto tocant-lo. El fitxer de pesos és al mateix repositori
(weights/mobile_sam.pt) i es llegeix sense executar res, amb llegeix_pth.py.

Són dues xarxes, com al Segment Anything original:

- sam-mira.onnx, la que mira la foto (TinyViT): entrada [1,3,1024,1024], la
  foto amb el costat llarg de 1024 i normalitzada com fa SAM (menys la
  mitjana i dividida per la desviació, amb zeros on no arriba); sortida
  [1,256,64,64]. Es passa una sola vegada per foto.
- sam-toca.onnx, la que, amb el que ha vist i on has tocat, dona el contorn:
  entrades `vist` [1,256,64,64], `punts` [1,N,2] (en punts de la foto feta
  de 1024) i `tipus` [1,N] (1 = és d'aquí, 0 = no n'és, -1 = res); sortides
  `mascares` [1,4,256,256] (positiu = dins) i `qualitat` [1,4]. Va de
  seguida, i es passa a cada toc.

Es munten peça a peça igual que al codi original (mobile_sam/modeling:
tiny_vit_sam.py, prompt_encoder.py, mask_decoder.py, transformer.py), amb la
normalització (BatchNorm) dins de les convolucions i els pesos amb la meitat de
precisió.

    python fes_sam.py mobile_sam.pt <carpeta de sortida>
"""
import itertools, os, sys
import numpy as np, onnx
from onnx import helper as h, numpy_helper as nh, TensorProto as T
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from llegeix_pth import llegeix
from fes_fons import pesos_a_mitja_precisio


class Graf:
    def __init__(self, p):
        self.p, self.fets = p, set()
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

    def forma(self, x, f): return self.op('Reshape', [x, self.cte(f, np.int64)])
    def gira(self, x, perm): return self.op('Transpose', [x], perm=perm)

    def tros(self, x, eix, ini, fi):
        return self.op('Slice', [x, self.cte([ini], np.int64), self.cte([fi], np.int64), self.cte([eix], np.int64)])

    def gelu(self, x):
        e = self.op('Erf', [self.op('Mul', [x, self.cte(1 / np.sqrt(2))])])
        return self.op('Mul', [self.op('Mul', [x, self.cte(0.5)]), self.op('Add', [e, self.cte(1.0)])])

    def conv_bn(self, x, pre, stride=1, pad=0, grups=1):
        """Conv2d_BN de TinyViT, amb la BatchNorm ja ficada a la convolució."""
        w = self.w(pre + '.c.weight')
        g, b, m, v = (self.w(f'{pre}.bn.{k}') for k in ('weight', 'bias', 'running_mean', 'running_var'))
        self.fets.add(pre + '.bn.num_batches_tracked')
        k = g / np.sqrt(v + 1e-5)
        return self.op('Conv', [x, self.cte(w * k[:, None, None, None]), self.cte(b - m * k)],
                       kernel_shape=list(w.shape[2:]), strides=[stride, stride], pads=[pad] * 4, group=grups)

    def conv(self, x, pre, pad=0):
        w = self.w(pre + '.weight')
        e = [x, self.cte(w)] + ([self.cte(self.w(pre + '.bias'))] if pre + '.bias' in self.p else [])
        return self.op('Conv', e, kernel_shape=list(w.shape[2:]), pads=[pad] * 4)

    def lineal(self, x, pre):
        return self.op('Add', [self.op('MatMul', [x, self.cte(self.w(pre + '.weight').T)]), self.cte(self.w(pre + '.bias'))])

    def ln(self, x, pre, eps=1e-5):   # LayerNorm sobre l'últim eix
        return self.op('LayerNormalization', [x, self.cte(self.w(pre + '.weight')), self.cte(self.w(pre + '.bias'))], axis=-1, epsilon=eps)

    def ln2d(self, x, pre):           # LayerNorm2d de SAM: sobre els canals, eps 1e-6
        return self.gira(self.ln(self.gira(x, [0, 2, 3, 1]), pre, 1e-6), [0, 3, 1, 2])

    def model(self, nom, entrades, sortides, ignora=()):
        falten = {k for k in self.p if k not in self.fets and not k.startswith(ignora)}
        if falten: raise SystemExit(f'pesos sense fer servir: {sorted(falten)[:6]}')
        g = h.make_graph(self.nodes, nom, entrades, sortides, self.inits)
        m = h.make_model(g, opset_imports=[h.make_opsetid('', 17)], producer_name='Eines')
        m.ir_version = 8
        onnx.checker.check_model(m)
        return m


# ------------------------------------------------------- el que mira la foto
def mbconv(g, x, pre):
    y = g.gelu(g.conv_bn(x, pre + '.conv1'))
    C = g.p[pre + '.conv2.c.weight'].shape[0]
    y = g.gelu(g.conv_bn(y, pre + '.conv2', pad=1, grups=C))
    y = g.conv_bn(y, pre + '.conv3')
    return g.gelu(g.op('Add', [y, x]))


def fusiona(g, x, pre, stride):       # PatchMerging; x en NCHW
    y = g.gelu(g.conv_bn(x, pre + '.conv1'))
    C = g.p[pre + '.conv1.c.weight'].shape[0]
    y = g.gelu(g.conv_bn(y, pre + '.conv2', stride=stride, pad=1, grups=C))
    return g.conv_bn(y, pre + '.conv3')


def bloc_vit(g, x, pre, C, H, heads, ws):
    """TinyViTBlock. x en NCHW [1, C, H, H]. L'atenció va per finestres de
    ws × ws; si H no és múltiple de ws, s'hi afegeixen zeros (que també
    compten a l'atenció, com al codi original), i després es treuen."""
    kd = C // heads
    t = g.gira(x, [0, 2, 3, 1])                                   # [1, H, H, C]
    pad = (ws - H % ws) % ws; P = H + pad; nw = P // ws
    y = t
    if pad: y = g.op('Pad', [y, g.cte([0, 0, 0, 0, 0, pad, pad, 0], np.int64)])
    y = g.forma(g.gira(g.forma(y, [1, nw, ws, nw, ws, C]), [0, 1, 3, 2, 4, 5]), [nw * nw, ws * ws, C])
    a = pre + '.attn'
    y = g.ln(y, a + '.norm')
    qkv = g.forma(g.lineal(y, a + '.qkv'), [nw * nw, ws * ws, heads, 3 * kd])   # cada cap: q, k, v
    q, k, v = (g.gira(g.tros(qkv, 3, i * kd, (i + 1) * kd), [0, 2, 1, 3]) for i in range(3))
    at = g.op('Mul', [g.op('MatMul', [q, g.gira(k, [0, 1, 3, 2])]), g.cte(kd ** -0.5)])
    # el biaix de l'atenció, segons la distància entre els dos punts de la finestra
    punts = list(itertools.product(range(ws), range(ws))); ofs, idx = {}, []
    for p1 in punts:
        for p2 in punts:
            o = (abs(p1[0] - p2[0]), abs(p1[1] - p2[1]))
            if o not in ofs: ofs[o] = len(ofs)
            idx.append(ofs[o])
    ab = g.w(a + '.attention_biases')[:, np.array(idx).reshape(ws * ws, ws * ws)]
    at = g.op('Softmax', [g.op('Add', [at, g.cte(ab[None])])], axis=-1)
    o = g.forma(g.gira(g.op('MatMul', [at, v]), [0, 2, 1, 3]), [nw * nw, ws * ws, C])
    o = g.lineal(o, a + '.proj')
    o = g.forma(g.gira(g.forma(o, [1, nw, nw, ws, ws, C]), [0, 1, 3, 2, 4, 5]), [1, P, P, C])
    if pad: o = g.tros(g.tros(o, 1, 0, H), 2, 0, H)
    t = g.op('Add', [t, o])
    x = g.conv_bn(g.gira(t, [0, 3, 1, 2]), pre + '.local_conv', pad=1, grups=C)
    t = g.gira(x, [0, 2, 3, 1])
    m = g.lineal(g.gelu(g.lineal(g.ln(t, pre + '.mlp.norm'), pre + '.mlp.fc1')), pre + '.mlp.fc2')
    return g.gira(g.op('Add', [t, m]), [0, 3, 1, 2])


def mira(p):
    g = Graf({k[len('image_encoder.'):]: v for k, v in p.items() if k.startswith('image_encoder.')})
    x = g.conv_bn(g.gelu(g.conv_bn('foto', 'patch_embed.seq.0', 2, 1)), 'patch_embed.seq.2', 2, 1)   # 256 × 256 × 64
    for b in range(2): x = mbconv(g, x, f'layers.0.blocks.{b}')
    x = fusiona(g, x, 'layers.0.downsample', 2)                    # 128 × 128 × 128
    for b in range(2): x = bloc_vit(g, x, f'layers.1.blocks.{b}', 128, 128, 4, 7)
    x = fusiona(g, x, 'layers.1.downsample', 2)                    # 64 × 64 × 160
    for b in range(6): x = bloc_vit(g, x, f'layers.2.blocks.{b}', 160, 64, 5, 14)
    x = fusiona(g, x, 'layers.2.downsample', 1)                    # 64 × 64 × 320 (sense reduir)
    for b in range(2): x = bloc_vit(g, x, f'layers.3.blocks.{b}', 320, 64, 10, 7)
    x = g.ln2d(g.conv(x, 'neck.0'), 'neck.1')
    x = g.ln2d(g.conv(x, 'neck.2', pad=1), 'neck.3')
    for k in g.p:
        if k.endswith('num_batches_tracked'): g.fets.add(k)
    return g.model('sam-mira', [h.make_tensor_value_info('foto', T.FLOAT, [1, 3, 1024, 1024])],
                   [h.make_tensor_value_info(x, T.FLOAT, [1, 256, 64, 64])], ignora=('norm_head', 'head'))


# ------------------------------------------- el que dona el contorn del toc
def atencio(g, q, k, v, pre, heads=8):
    Q, K, V = g.lineal(q, pre + '.q_proj'), g.lineal(k, pre + '.k_proj'), g.lineal(v, pre + '.v_proj')
    d = g.p[pre + '.q_proj.weight'].shape[0]; c = d // heads
    sep = lambda t: g.gira(g.forma(t, [1, -1, heads, c]), [0, 2, 1, 3])
    a = g.op('Softmax', [g.op('Mul', [g.op('MatMul', [sep(Q), g.gira(sep(K), [0, 1, 3, 2])]), g.cte(1 / np.sqrt(c))])], axis=-1)
    o = g.forma(g.gira(g.op('MatMul', [a, sep(V)]), [0, 2, 1, 3]), [1, -1, d])
    return g.lineal(o, pre + '.out_proj')


def mlp(g, x, pre, n):
    for i in range(n):
        x = g.lineal(x, f'{pre}.layers.{i}')
        if i < n - 1: x = g.op('Relu', [x])
    return x


def toca(p):
    g = Graf(p)
    G = g.w('prompt_encoder.pe_layer.positional_encoding_gaussian_matrix')   # [2, 128]

    def pe(c):                # c de 0 a 1 → sin i cos de les freqüències a l'atzar del model
        c = g.op('MatMul', [g.op('Sub', [g.op('Mul', [c, g.cte(2.0)]), g.cte(1.0)]), g.cte(G * 2 * np.pi)])
        return g.op('Concat', [g.op('Sin', [c]), g.op('Cos', [c])], axis=-1)
    # els punts: + 0,5 (el centre del punt), partits per 1024; i el que toca a cada tipus
    pts = g.op('Div', [g.op('Add', ['punts', g.cte(0.5)]), g.cte(1024.0)])
    e = pe(pts)                                                        # [1, N, 256]
    tip = g.op('Unsqueeze', ['tipus', g.cte([2], np.int64)])           # [1, N, 1]
    es = lambda v: g.op('Cast', [g.op('Equal', [tip, g.cte(v)])], to=T.FLOAT)
    e = g.op('Mul', [e, g.op('Sub', [g.cte(1.0), es(-1.0)])])
    for v, w in ((-1.0, 'prompt_encoder.not_a_point_embed.weight'), (0.0, 'prompt_encoder.point_embeddings.0.weight'),
                 (1.0, 'prompt_encoder.point_embeddings.1.weight')):
        e = g.op('Add', [e, g.op('Mul', [es(v), g.cte(g.w(w))])])
    # el posicional de tota la imatge (64 × 64), calculat aquí: és sempre el mateix
    y, x = np.meshgrid((np.arange(64) + 0.5) / 64, (np.arange(64) + 0.5) / 64, indexing='ij')
    c = (np.stack([x, y], -1) * 2 - 1) @ G * 2 * np.pi
    img_pe = np.concatenate([np.sin(c), np.cos(c)], -1).reshape(1, 4096, 256)
    D = 'mask_decoder.'
    toks = np.concatenate([g.w(D + 'iou_token.weight'), g.w(D + 'mask_tokens.weight')], 0)[None]   # [1, 5, 256]
    tokens = g.op('Concat', [g.cte(toks), e], axis=1)
    src = g.op('Add', ['vist', g.cte(g.w('prompt_encoder.no_mask_embed.weight').reshape(1, 256, 1, 1))])
    keys = g.gira(g.forma(src, [1, 256, 4096]), [0, 2, 1])
    kpe = g.cte(img_pe)
    q = tokens
    for i in range(2):
        L = f'{D}transformer.layers.{i}'
        if i == 0: q = atencio(g, q, q, q, L + '.self_attn')
        else:
            qq = g.op('Add', [q, tokens]); q = g.op('Add', [q, atencio(g, qq, qq, q, L + '.self_attn')])
        q = g.ln(q, L + '.norm1')
        q = g.op('Add', [q, atencio(g, g.op('Add', [q, tokens]), g.op('Add', [keys, kpe]), keys, L + '.cross_attn_token_to_image')])
        q = g.ln(q, L + '.norm2')
        q = g.op('Add', [q, g.lineal(g.op('Relu', [g.lineal(q, L + '.mlp.lin1')]), L + '.mlp.lin2')])
        q = g.ln(q, L + '.norm3')
        keys = g.op('Add', [keys, atencio(g, g.op('Add', [keys, kpe]), g.op('Add', [q, tokens]), q, L + '.cross_attn_image_to_token')])
        keys = g.ln(keys, L + '.norm4')
    q = g.op('Add', [q, atencio(g, g.op('Add', [q, tokens]), g.op('Add', [keys, kpe]), keys, D + 'transformer.final_attn_token_to_image')])
    q = g.ln(q, D + 'transformer.norm_final_attn')
    s = g.forma(g.gira(keys, [0, 2, 1]), [1, 256, 64, 64])
    up = lambda x, k: g.op('ConvTranspose', [x, g.cte(g.w(k + '.weight')), g.cte(g.w(k + '.bias'))], kernel_shape=[2, 2], strides=[2, 2])
    s = g.gelu(g.ln2d(up(s, D + 'output_upscaling.0'), D + 'output_upscaling.1'))
    s = g.gelu(up(s, D + 'output_upscaling.3'))                       # [1, 32, 256, 256]
    hyper = g.op('Concat', [g.op('Unsqueeze', [mlp(g, g.tros(q, 1, 1 + i, 2 + i), f'{D}output_hypernetworks_mlps.{i}', 3), g.cte([1], np.int64)]) for i in range(4)], axis=1)
    hyper = g.forma(hyper, [1, 4, 32])
    masc = g.forma(g.op('MatMul', [hyper, g.forma(s, [1, 32, 65536])]), [1, 4, 256, 256])
    iou = g.forma(mlp(g, g.tros(q, 1, 0, 1), D + 'iou_prediction_head', 3), [1, 4])
    m = g.op('Identity', [masc]); n = g.op('Identity', [iou])
    g.nodes[-2].output[0] = 'mascares'; g.nodes[-1].output[0] = 'qualitat'
    return g.model('sam-toca', [h.make_tensor_value_info('vist', T.FLOAT, [1, 256, 64, 64]),
                                h.make_tensor_value_info('punts', T.FLOAT, [1, 'n', 2]),
                                h.make_tensor_value_info('tipus', T.FLOAT, [1, 'n'])],
                   [h.make_tensor_value_info('mascares', T.FLOAT, [1, 4, 256, 256]),
                    h.make_tensor_value_info('qualitat', T.FLOAT, [1, 4])],
                   ignora=('image_encoder', 'prompt_encoder.mask_downscaling', 'prompt_encoder.point_embeddings.2', 'prompt_encoder.point_embeddings.3'))


if __name__ == '__main__':
    p = {k: np.asarray(v, np.float32) for k, v in llegeix(sys.argv[1]).items() if v.dtype != np.int64}
    desti = sys.argv[2]; os.makedirs(desti, exist_ok=True)
    for nom, fes in (('sam-mira', mira), ('sam-toca', toca)):
        m = fes(p)
        pesos_a_mitja_precisio(m)
        onnx.checker.check_model(m)
        onnx.save(m, os.path.join(desti, nom + '.onnx'))
        print(nom, os.path.getsize(os.path.join(desti, nom + '.onnx')) // 1024, 'kB')
