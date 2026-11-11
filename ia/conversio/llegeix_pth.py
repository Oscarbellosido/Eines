"""Llegeix un fitxer .pth de PyTorch sense PyTorch.
Un .pth és un zip amb un pickle que descriu els tensors i els bytes a part.
L'unpickler només accepta les tres o quatre peces que fan falta per
reconstruir tensors: qualsevol altra cosa (codi) s'atura."""
import io, zipfile, pickle, collections
import numpy as np

TIPUS = {'FloatStorage': np.float32, 'HalfStorage': np.float16, 'DoubleStorage': np.float64,
         'LongStorage': np.int64, 'IntStorage': np.int32}

def llegeix(cami):
    z = zipfile.ZipFile(cami)
    pkl = [n for n in z.namelist() if n.endswith('data.pkl')][0]
    prefix = pkl[:-len('data.pkl')]

    def tensor(storage, offset, size, stride, *resta):
        arr = storage
        st = [s * arr.itemsize for s in stride]
        return np.lib.stride_tricks.as_strided(arr[offset:], shape=tuple(size), strides=st).copy()

    class Lector(pickle.Unpickler):
        def find_class(self, mod, nom):
            if (mod, nom) == ('collections', 'OrderedDict'): return collections.OrderedDict
            if (mod, nom) == ('torch._utils', '_rebuild_tensor_v2'): return tensor
            if (mod, nom) == ('torch._utils', '_rebuild_parameter'): return lambda t, *a: t
            if mod == 'torch' and nom in TIPUS: return nom
            raise pickle.UnpicklingError(f'no permès: {mod}.{nom}')
        def persistent_load(self, pid):
            _, tipus, clau, _lloc, _n = pid
            return np.frombuffer(z.read(f'{prefix}data/{clau}'), dtype=TIPUS[tipus])

    return Lector(io.BytesIO(z.read(pkl))).load()
