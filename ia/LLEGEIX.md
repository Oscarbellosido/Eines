# Els fitxers de la IA de La Cambra Fosca

Aquesta carpeta és l'única excepció a la norma d'«un sol fitxer» de les Eines.
La fan servir la pestanya **Amplia** i l'eina **Esborra coses (IA)** de La
Cambra Fosca, i només es baixa el que cal quan algú les fa servir. Res d'aquí no envia cap foto enlloc: el model corre dins
del navegador.

## D'on surt cada cosa

### `models/` — les xarxes neuronals

Són les de **Real-ESRGAN**, de Xintao Wang i altres
(https://github.com/xinntao/Real-ESRGAN), les mateixes que fa servir Upscayl.
Llicència **BSD de 3 clàusules**: és a `models/LICENSE`, tal com la publiquen.

| Fitxer | Model original | Per a què |
|---|---|---|
| `realesr-general-x4v3-v2.onnx` | `realesr-general-x4v3.pth` (versió v0.2.5.0) | el mode **Mòbil**: lleuger, 1,2 milions de paràmetres |
| `realesrgan-x4plus.onnx` | `RealESRGAN_x4plus.pth` (versió v0.1.0) | el mode **Ordinador**: el de més qualitat, 16,7 milions |

Els originals, baixats de la pàgina de versions del projecte, tenien aquestes
empremtes (SHA-256):

```
8dc7edb9ac80ccdc30c3a5dca6616509367f05fbc184ad95b731f05bece96292  realesr-general-x4v3.pth
4fa0d38905f75ac06eb49a7951b426670021be3018265fd191d2125df9d682f1  RealESRGAN_x4plus.pth
```

### `models/migan-512.onnx` — esborrar coses

És **MI-GAN**, de Picsart AI Research (https://github.com/Picsart-AI-Research/MI-GAN),
la versió de 512 × 512 entrenada amb fotos de llocs (Places2). Llicència
**MIT**, tant el codi com els pesos: és a `models/LICENSE-MIGAN`, tal com la
publiquen. Són 25 MB.

L'original és la versió «TorchScript» que publica el projecte IOPaint (del
mateix model, sense canviar res), baixada de
https://github.com/Sanster/models/releases/download/migan/migan_traced.pt,
amb aquesta empremta:

```
038b82d90416f1d1af232486d76d07665aecdd988e0f16090b1e11a61820b800  migan_traced.pt
```

L'entrada són quatre canals de 512 × 512: la màscara menys 0,5 (1 = es queda,
0 = s'esborra) i la foto de −1 a 1 amb el forat a zero. La sortida, la foto
sencera de −1 a 1 (només se n'agafa el forat).

### `ort/` — el motor

**ONNX Runtime Web** 1.31.1, de Microsoft (paquet `onnxruntime-web` de npm).
Llicència **MIT**: és a `ort/LICENSE`, tal com la publiquen. N'hi ha dues
versions, i cada aparell en baixa només una:

| Fitxers | Quan |
|---|---|
| `ort.webgpu.min.js` + `ort-wasm-simd-threaded.asyncify.*` (29 MB) | l'aparell pot fer servir la gràfica (WebGPU) |
| `ort.wasm.min.js` + `ort-wasm-simd-threaded.*` (15 MB) | no pot: va amb el processador |

## Com es tornen a fer els models

Els `.onnx` no els ha fet ningú a mà: surten dels `.pth` originals amb els dos
scripts de `conversio/`, que **no necessiten PyTorch** (només `onnx` i
`numpy`). `llegeix_pth.py` llegeix el fitxer de PyTorch sense executar res del
que porta a dins (només accepta números), i `fes_onnx.py` construeix les dues
xarxes peça a peça, igual que les defineix el projecte original.

Una diferència a posta: el model lleuger original fa servir una peça (PRelu)
que el motor no sap fer anar a la gràfica, i cada una anava al processador i
tornava. Aquí es fa amb peces equivalents (ReLU, multiplicar i sumar), que dona
el mateix resultat (diferència de 0,0000015) i va bé a la gràfica. Per això el
fitxer es diu `-v2`: el primer, amb PRelu, ja no hi és.

```
pip install onnx numpy
python conversio/fes_onnx.py <carpeta amb els dos .pth> models
```

MI-GAN surt de `conversio/fes_migan.py`. Aquell fitxer de PyTorch porta el
model escrit a dins en una mena de Python: l'script **el llegeix però no
l'executa mai** (el desmunta com un text) i tradueix cada operació a la peça
ONNX que li correspon; si en troba una que no coneix, s'atura. Només hi surten
peces que la gràfica sap fer anar.

```
python conversio/fes_migan.py migan_traced.pt models/migan-512.onnx
```
