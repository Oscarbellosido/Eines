"""Construeix MI-GAN (esborrar coses d'una foto) en format ONNX, a partir del
fitxer original de PyTorch (migan_traced.pt, «TorchScript»).

Aquest tipus de fitxer porta escrit a dins, en un llenguatge que s'assembla al
Python, com està fet el model. Aquí aquest codi **es llegeix, però no
s'executa mai**: es desmunta com un text (amb el mòdul `ast` del Python) i
cada operació que hi surt es tradueix a la peça ONNX que li correspon. Només
se'n coneixen vuit (les que fa servir MI-GAN); qualsevol altra cosa atura la
conversió. Els pesos es llegeixen amb el mateix lector prudent dels altres
models: només números.

Entrada [1,4,512,512]: el primer canal és la màscara menys 0,5 (1 = es queda,
0 = s'esborra) i els altres tres, la foto de -1 a 1 multiplicada per la
màscara. Sortida [1,3,512,512], de -1 a 1.

    python fes_migan.py migan_traced.pt migan-512.onnx
"""
import ast, collections, io, pickle, sys, zipfile
import numpy as np, onnx
from onnx import helper as h, TensorProto as T, numpy_helper as nh

TIPUS = {'FloatStorage': np.float32, 'HalfStorage': np.float16, 'DoubleStorage': np.float64}


class Modul:
    """Un mòdul del fitxer: només se'n guarda l'estat (pesos i submòduls)."""
    def __setstate__(self, estat):
        self.estat = estat


def llegeix(cami):
    z = zipfile.ZipFile(cami)
    pkl = [n for n in z.namelist() if n.endswith('/data.pkl')][0]
    arrel = pkl[:-len('data.pkl')]
    classes = {}

    def tensor(storage, offset, size, stride, *_):
        st = [s * storage.itemsize for s in stride]
        return np.lib.stride_tricks.as_strided(storage[offset:], shape=tuple(size), strides=st).copy()

    class Lector(pickle.Unpickler):
        def __init__(self, fitxer, carpeta):
            super().__init__(fitxer)
            self.carpeta = carpeta

        def find_class(self, mod, nom):
            if (mod, nom) == ('collections', 'OrderedDict'): return collections.OrderedDict
            if (mod, nom) == ('torch._utils', '_rebuild_tensor_v2'): return tensor
            if mod == 'torch' and nom in TIPUS: return nom
            if mod.startswith('__torch__.'):
                # una classe buida nostra, que només desa l'estat: res del fitxer no s'executa
                return classes.setdefault(mod + '.' + nom, type(nom, (Modul,), {'ruta': mod + '.' + nom}))
            raise pickle.UnpicklingError(f'no permès: {mod}.{nom}')

        def persistent_load(self, pid):
            _, tipus, clau, _, _ = pid
            return np.frombuffer(z.read(f'{arrel}{self.carpeta}/{clau}'), dtype=TIPUS[tipus])

    # Els pesos són a «data/» i les constants del codi, a «constants/»: llegint
    # les constants de «data/», el guany de cada capa (√2) sortia d'un pes
    # qualsevol (-0,00009) i la xarxa no feia res.
    model = Lector(io.BytesIO(z.read(arrel + 'data.pkl')), 'data').load()
    constants = Lector(io.BytesIO(z.read(arrel + 'constants.pkl')), 'constants').load()
    codi = {n[len(arrel + 'code/'):]: z.read(n).decode() for n in z.namelist()
            if n.startswith(arrel + 'code/') and n.endswith('.py')}
    return model, constants, codi


class Traductor:
    def __init__(self, constants, codi):
        self.constants = [np.asarray(c) for c in constants]
        self.codi = codi
        self.forwards = {}
        self.nodes, self.inits, self.n = [], [], 0

    # --- el graf ONNX ---
    def nom(self, p):
        self.n += 1
        return f'{p}_{self.n}'

    def cte(self, arr):
        n = self.nom('c')
        self.inits.append(nh.from_array(np.ascontiguousarray(np.asarray(arr, np.float32)), n))
        return n

    def op(self, tipus, entrades, **atr):
        s = self.nom(tipus.lower())
        self.nodes.append(h.make_node(tipus, entrades, [s], **atr))
        return s

    def tens(self, v):
        """Un valor com a entrada d'una peça: si és un número, una constant."""
        return v if isinstance(v, str) else self.cte(v)

    # --- llegir el codi ---
    def forward_de(self, ruta):
        if ruta not in self.forwards:
            parts = ruta.split('.')
            fitxer, classe = '/'.join(parts[:-1]) + '.py', parts[-1]
            arbre = ast.parse(self.codi[fitxer])
            cls = next(c for c in arbre.body if isinstance(c, ast.ClassDef) and c.name == classe)
            self.forwards[ruta] = next(f for f in cls.body if isinstance(f, ast.FunctionDef) and f.name == 'forward')
        return self.forwards[ruta]

    def crida(self, modul, args):
        f = self.forward_de(modul.ruta)
        noms = [a.arg for a in f.args.args]
        entorn = {'self': modul, **dict(zip(noms[1:], args))}
        for s in f.body:
            if isinstance(s, ast.Assign):
                v = self.ev(s.value, entorn)
                for t in s.targets:
                    self.assigna(t, v, entorn)
            elif isinstance(s, ast.Return):
                return self.ev(s.value, entorn)
            else:
                raise ValueError('construcció desconeguda: ' + ast.dump(s)[:80])

    def assigna(self, t, v, entorn):
        if isinstance(t, ast.Name): entorn[t.id] = v
        elif isinstance(t, ast.Tuple):
            for ti, vi in zip(t.elts, v): self.assigna(ti, vi, entorn)
        else: raise ValueError('assignació desconeguda')

    def ev(self, e, entorn):
        if isinstance(e, ast.Constant): return e.value
        if isinstance(e, ast.Name):
            if e.id in ('torch', 'CONSTANTS'): return e.id
            return entorn[e.id]
        if isinstance(e, ast.UnaryOp) and isinstance(e.op, ast.USub): return -self.ev(e.operand, entorn)
        if isinstance(e, (ast.Tuple, ast.List)): return [self.ev(x, entorn) for x in e.elts]
        if isinstance(e, ast.Subscript): return self.ev(e.value, entorn)[self.ev(e.slice, entorn)]
        if isinstance(e, ast.Attribute):
            base = self.ev(e.value, entorn)
            if base == 'CONSTANTS': return self.constants[int(e.attr[1:])]
            if isinstance(base, Modul):
                v = base.estat[e.attr]
                return v
            raise ValueError('atribut desconegut: ' + e.attr)
        if isinstance(e, ast.Call):
            f = e.func
            args = [self.ev(a, entorn) for a in e.args]
            if isinstance(f, ast.Attribute) and f.attr == 'forward':
                return self.crida(self.ev(f.value, entorn), args)
            if isinstance(f, ast.Attribute) and isinstance(f.value, ast.Name) and f.value.id == 'torch':
                return self.torch(f.attr, args)
        raise ValueError('expressió desconeguda: ' + ast.dump(e)[:100])

    # --- les vuit operacions que fa servir MI-GAN ---
    def torch(self, nom, a):
        if nom == '_convolution':
            x, w, b, stride, pad, dil, transposada, out_pad, grups = a[:9]
            entrades = [x, self.cte(w)] + ([self.cte(b)] if b is not None else [])
            atr = dict(kernel_shape=list(w.shape[2:]), strides=stride, pads=pad + pad, dilations=dil, group=grups)
            if transposada:
                return self.op('ConvTranspose', entrades, output_padding=out_pad, **atr)
            return self.op('Conv', entrades, **atr)
        if nom in ('leaky_relu_', 'leaky_relu'):
            return self.op('LeakyRelu', [a[0]], alpha=float(a[1]))
        if nom in ('mul', 'add', 'add_'):
            x, y = a
            if not isinstance(x, str) and not isinstance(y, str):      # dues constants: es fa aquí mateix
                return np.multiply(x, y) if nom == 'mul' else np.add(x, y)
            return self.op('Mul' if nom == 'mul' else 'Add', [self.tens(x), self.tens(y)])
        if nom == 'clamp':
            return self.op('Clip', [a[0], self.cte(np.float32(a[1])), self.cte(np.float32(a[2]))])
        if nom == 'pad':
            esq, dre, dalt, baix = a[1]       # PyTorch diu primer l'última dimensió; ONNX, els començaments i després els finals
            p = self.nom('p')
            self.inits.append(nh.from_array(np.array([0, 0, dalt, esq, 0, 0, baix, dre], np.int64), p))
            return self.op('Pad', [a[0], p], mode='constant')
        raise ValueError('operació desconeguda: torch.' + nom)


def converteix(pt, sortida):
    model, constants, codi = llegeix(pt)
    tr = Traductor(constants, codi)
    y = tr.crida(model, ['entrada'])
    g = h.make_graph(tr.nodes, 'migan_512',
                     [h.make_tensor_value_info('entrada', T.FLOAT, [1, 4, 512, 512])],
                     [h.make_tensor_value_info(y, T.FLOAT, [1, 3, 512, 512])], tr.inits)
    m = h.make_model(g, opset_imports=[h.make_opsetid('', 17)], producer_name='Eines')
    m.ir_version = 8
    onnx.checker.check_model(m)
    onnx.save(m, sortida)
    return m


if __name__ == '__main__':
    m = converteix(sys.argv[1], sys.argv[2])
    print(dict(collections.Counter(n.op_type for n in m.graph.node)))
