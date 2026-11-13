# Els fitxers de la IA de La Cambra Fosca

Aquesta carpeta és l'única excepció a la norma d'«un sol fitxer» de les Eines.
La fa servir la pestanya **✦ IA** de La Cambra Fosca (les ratllades,
esborrar coses, les cares, el fons i ampliar), i només es baixa el que cal
quan algú les fa servir. Res d'aquí no envia cap foto enlloc: el model corre dins
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

### `models/cares-troba.onnx` i `models/cares-arregla.onnx.1` i `.2` — arreglar les cares

| Fitxer | Model | Projecte | Per a què |
|---|---|---|---|
| `cares-troba.onnx` | RetinaFace amb MobileNet 0.25 (1,6 MB) | facexlib, https://github.com/xinntao/facexlib (llicència **MIT**, `models/LICENSE-FACEXLIB`) | troba les cares i cinc punts de cada una |
| `cares-arregla.onnx.1` i `.2` | GFPGAN v1.4 (167 MB, en dos trossos) | GFPGAN, de Tencent ARC, https://github.com/TencentARC/GFPGAN (llicència **Apache 2.0**, `models/LICENSE-GFPGAN`) | torna nítida una cara posada dreta a 512 × 512 |

**Compte amb la llicència de GFPGAN**: és Apache 2.0, però el fitxer de
llicència avisa que una part del codi ve de StyleGAN2, de NVIDIA, la llicència
del qual només permet un ús no comercial. Aquí es fa servir la versió
«clean», que no porta les peces especials de NVIDIA, i la xarxa s'ha tornat a
muntar peça a peça, però els pesos són els entrenats per Tencent sobre aquella
arquitectura. Per a ús personal no hi ha cap problema; si s'ha de fer servir
per a feina pagada, val la pena mirar-ho.

Els originals, amb aquestes empremtes:

```
2979b33ffafda5d74b6948cd7a5b9a7a62f62b949cef24e95fd15d2883a65220  detection_mobilenet0.25_Final.pth  (facexlib v0.1.0)
e2cd4703ab14f4d01fd1383a8a8b266f9a5833dacee8e6a79d3bf21a1b6be5ad  GFPGANv1.4.pth  (GFPGAN v1.3.4)
```

**Canvis respecte dels originals** (la llicència Apache demana dir-ho): la
xarxa de GFPGAN s'ha muntat en ONNX amb la normalització de cada convolució
ja aplicada als pesos, les convolucions modulades de StyleGAN2 fetes com a
multiplicar, convolució normal i normalitzar (dona el mateix amb una sola cara
a la vegada), el soroll fix que porta el fitxer en lloc d'un d'aleatori, i els
pesos desats amb la meitat de precisió. El fitxer es parteix en dos trossos
(GitHub no n'accepta de més de 100 MB) i l'app els ajunta.

Entrades: RetinaFace, la foto en BGR menys (104, 117, 123), amb els costats
múltiples de 32; GFPGAN, la cara alineada amb els cinc punts a la plantilla de
512 de facexlib, en RGB de −1 a 1.

### `models/ratllades.onnx` — trobar les ratllades d'una foto vella

És la xarxa que troba les ratllades, els plecs i les taques del projecte
**Bringing Old Photos Back to Life**, de Microsoft
(https://github.com/microsoft/Bringing-Old-Photos-Back-to-Life). Llicència
**MIT**: és a `models/LICENSE-RATLLADES`, tal com la publiquen. L'original és
`checkpoints/detection/FT_Epoch_latest.pt`, dins de `global_checkpoints.zip`
de la seva versió v1.0, amb aquestes empremtes:

```
3ff4c52a3a65d71e458ff24b1d7339b326d216ef793c2027761e11efb30f7882  global_checkpoints.zip
b2d7ab04e9b3885c6b1991bb7a0b823129dd6e3ac078a9fd059ebd2a7ba59a95  FT_Epoch_latest.pt
```

Aquell fitxer fa 451 MB perquè porta també el que es fa servir per entrenar;
la xarxa en si són 37,6 milions de números, i aquí es desen amb la meitat de
precisió (75 MB). Entrada: la foto en grisos, de −1 a 1, amb el costat curt de
256; sortida: la probabilitat de ratllada de cada punt (es talla a 0,4, com al
projecte). Troba sobretot les ratllades clares, que són les típiques; les
fosques, gairebé no.

### `models/u2netp.onnx` i `models/isnet-fp16.onnx` — treure el fons

| Fitxer | Model | Projecte | Per a què |
|---|---|---|---|
| `u2netp.onnx` | U²-Net petit (4,4 MB) | https://github.com/xuebinqin/U-2-Net | el mode **Mòbil** |
| `isnet-fp16.onnx` | IS-Net general (86 MB) | https://github.com/xuebinqin/DIS | el mode **Ordinador** |

Tots dos són de Xuebin Qin i altres, amb llicència **Apache 2.0**: és a
`models/LICENSE-U2NET` i `models/LICENSE-ISNET`, tal com la publiquen. Els
originals en format ONNX són els que publica el projecte rembg (Daniel Gatis,
llicència MIT) a https://github.com/danielgatis/rembg/releases/tag/v0.0.0, amb
aquestes empremtes:

```
309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8  u2netp.onnx
60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a  isnet-general-use.onnx
```

**Canvis respecte dels originals** (la llicència Apache demana dir-ho): a tots
dos s'hi ha deixat només la primera sortida, que és la que es fa servir; i a
l'IS-Net els pesos es desen amb la meitat de precisió (float16) i es tornen a
fer normals en carregar-lo, perquè el fitxer passi de 178 MB a 86 MB. El
resultat canvia menys d'una mil·lèsima.

L'entrada és la foto reduïda a 320 × 320 (U²-Net) o 1024 × 1024 (IS-Net),
dividida pel punt més clar i amb la mitjana i la desviació de cada model, com
fa rembg. La sortida diu, per a cada punt, si és del davant (1) o del fons (0).

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

Els de les cares surten de `conversio/fes_cares.py`, que llegeix els dos
fitxers originals (del format antic de PyTorch, sense executar res):

```
python conversio/fes_cares.py <carpeta amb els dos .pth> models
```

El de les ratllades surt de `conversio/fes_ratllades.py`, que llegeix el
fitxer original (del format antic de PyTorch, sense executar res) i munta la
xarxa peça a peça:

```
python conversio/fes_ratllades.py FT_Epoch_latest.pt models/ratllades.onnx
```

Els de treure el fons surten de `conversio/fes_fons.py`, a partir dels dos
originals de rembg:

```
python conversio/fes_fons.py <carpeta amb u2netp.onnx i isnet-general-use.onnx> models
```
