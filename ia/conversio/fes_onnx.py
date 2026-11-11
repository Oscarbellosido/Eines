"""Construeix els dos models de Real-ESRGAN en format ONNX, peça a peça, a
partir dels pesos originals. Entrada i sortida: RGB de 0 a 1, [1,3,H,W]."""
import sys, numpy as np, onnx
from onnx import helper as h, TensorProto as T, numpy_helper as nh
from llegeix_pth import llegeix

class Graf:
    def __init__(s): s.nodes, s.inits, s.n = [], [], 0
    def nom(s, p): s.n += 1; return f'{p}_{s.n}'
    def cte(s, arr, p='c'):
        n = s.nom(p); s.inits.append(nh.from_array(np.ascontiguousarray(arr), n)); return n
    def op(s, tipus, entrades, **atr):
        sortida = s.nom(tipus.lower())
        s.nodes.append(h.make_node(tipus, entrades, [sortida], **atr)); return sortida
    def conv(s, x, w, b):
        return s.op('Conv', [x, s.cte(w.astype(np.float32), 'w'), s.cte(b.astype(np.float32), 'b')],
                    kernel_shape=[3, 3], pads=[1, 1, 1, 1])
    def resize(s, x, f):
        # «nearest» de PyTorch amb factor enter = asimètric i arrodonint cap avall
        return s.op('Resize', [x, '', s.cte(np.array([1, 1, f, f], np.float32), 'esc')],
                    mode='nearest', coordinate_transformation_mode='asymmetric', nearest_mode='floor')
    def model(s, x, y, nom):
        g = h.make_graph(s.nodes, nom,
            [h.make_tensor_value_info(x, T.FLOAT, [1, 3, 'h', 'w'])],
            [h.make_tensor_value_info(y, T.FLOAT, [1, 3, 'h4', 'w4'])], s.inits)
        m = h.make_model(g, opset_imports=[h.make_opsetid('', 17)], producer_name='Eines')
        m.ir_version = 8
        onnx.checker.check_model(m)
        return m

def lleuger(p):
    """SRVGGNetCompact (realesr-general-x4v3): 34 convolucions amb PReLU entre
    elles a la mida d'entrada, i al final es reparteixen els 48 canals en
    quadres de 4x4 (PixelShuffle) i se li suma la imatge ampliada a l'engròs."""
    g = Graf(); x = 'entrada'; out = x
    i = 0
    while f'body.{i}.weight' in p:
        w = p[f'body.{i}.weight']
        if w.ndim == 4:
            out = g.conv(out, w, p[f'body.{i}.bias'])
        else:
            out = g.op('PRelu', [out, g.cte(w.reshape(-1, 1, 1).astype(np.float32), 'pendent')])
        i += 1
    out = g.op('DepthToSpace', [out], blocksize=4, mode='CRD')
    out = g.op('Add', [out, g.resize(x, 4)])
    return g.model(x, out, 'realesr_general_x4v3')

def gran(p):
    """RRDBNet (RealESRGAN_x4plus): 23 blocs residuals densos, i després dues
    ampliacions per 2 amb convolució."""
    g = Graf(); x = 'entrada'
    lrelu = lambda t: g.op('LeakyRelu', [t], alpha=0.2)
    c = lambda t, k: g.conv(t, p[k + '.weight'], p[k + '.bias'])
    escala = lambda t, f: g.op('Mul', [t, g.cte(np.array(f, np.float32), 'f')])
    feat = c(x, 'conv_first')
    cos_ = feat
    for b in range(23):
        entrada_rrdb = cos_
        for r in (1, 2, 3):
            k = f'body.{b}.rdb{r}'
            xs = [cos_]
            for j in range(1, 5):
                xs.append(lrelu(c(xs[0] if j == 1 else g.op('Concat', xs, axis=1), f'{k}.conv{j}')))
            x5 = c(g.op('Concat', xs, axis=1), f'{k}.conv5')
            cos_ = g.op('Add', [escala(x5, 0.2), cos_])
        cos_ = g.op('Add', [escala(cos_, 0.2), entrada_rrdb])
    feat = g.op('Add', [feat, c(cos_, 'conv_body')])
    feat = lrelu(c(g.resize(feat, 2), 'conv_up1'))
    feat = lrelu(c(g.resize(feat, 2), 'conv_up2'))
    out = c(lrelu(c(feat, 'conv_hr')), 'conv_last')
    return g.model(x, out, 'realesrgan_x4plus')

if __name__ == '__main__':
    M = sys.argv[1]; D = sys.argv[2]
    onnx.save(lleuger(llegeix(f'{M}/realesr-general-x4v3.pth')['params']), f'{D}/realesr-general-x4v3.onnx')
    onnx.save(gran(llegeix(f'{M}/RealESRGAN_x4plus.pth')['params_ema']), f'{D}/realesrgan-x4plus.onnx')
