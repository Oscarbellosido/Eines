# Els fitxers de l'ampliació amb IA

Aquesta carpeta és l'única excepció a la norma d'«un sol fitxer» de les Eines.
La fa servir la pestanya **Amplia** de La Cambra Fosca, i només es baixa quan
algú amplia una foto. Res d'aquí no envia cap foto enlloc: el model corre dins
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
