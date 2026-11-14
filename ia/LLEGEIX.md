# Els fitxers de la IA de La Cambra Fosca

**Els models (`models/*.onnx`) ja no són al repositori**: són a Cloudflare R2
(l'espai `eines-models`) i els entrega el Worker `eines-ia`
(`worker-models.js`), perquè GitHub Pages no deixa publicar més d'1 GB.
`models_r2.py` els hi puja i els en baixa (per a les proves). Les llicències
continuen aquí, a `models/`. El que diu aquest fitxer de cada model (d'on
surt, empremtes, canvis) continua valent.

Aquesta carpeta és l'única excepció a la norma d'«un sol fitxer» de les Eines.
La fa servir la pestanya **✦ IA** de La Cambra Fosca (les ratllades,
el soroll, esborrar coses (també tocant l'objecte), les cares, el color, el fons i ampliar), i només es baixa el que cal
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

### `models/lama-512.onnx.1` i `.2` — esborrar coses al mode Ordinador

És **LaMa** («big-lama»), de Samsung AI Center, https://github.com/advimman/lama,
amb llicència **Apache 2.0** (`models/LICENSE-LAMA`). 51 milions de números. El
fitxer és el que publica el projecte IOPaint a GitHub (els pesos originals són
en un servei de fitxers que des d'aquí no s'hi arriba), en format TorchScript:

```
344c77bbcb158f17dd143070d1e789f38a66c04202311ae3a258ef66667a9ea9  big-lama.pt
https://github.com/Sanster/models/releases/download/add_big_lama/big-lama.pt
```

**Canvis respecte de l'original** (la llicència Apache demana dir-ho): la xarxa
es munta peça a peça en ONNX amb una mida fixa de 512 × 512; les
transformades de Fourier de les FourierUnit (rfftn i irfftn) es fan com a
multiplicacions de matrius amb les taules de sinus i cosinus (el motor no sap
fer-les a la gràfica), i l'script comprova abans que donen el mateix que
numpy; la normalització (BatchNorm) es fa com a multiplicar i sumar; els pesos
amb la meitat de precisió, en dos trossos.

Entrades: `foto` [1,3,512,512] de 0 a 1 i `mascara` [1,1,512,512], 1 on s'ha
d'omplir. Sortida: la foto plena, de 0 a 1.

### `models/sam-mira.onnx` i `models/sam-toca.onnx` — tocar l'objecte

És **MobileSAM**, de Chaoning Zhang i altres (Kyung Hee University),
https://github.com/ChaoningZhang/MobileSAM, amb llicència **Apache 2.0**
(`models/LICENSE-MOBILESAM`): la versió petita del Segment Anything de Meta,
que troba el contorn d'un objecte a partir d'un punt. 10 milions de números.
Els pesos són al mateix repositori:

```
6dbb90523a35330fedd7f1d3dfc66f995213d81b29a5ca8108dbcdd4e37d6c2f  weights/mobile_sam.pt
```

**Canvis respecte de l'original** (la llicència Apache demana dir-ho): les dues
xarxes (la que mira la foto, TinyViT, i la que dona el contorn) es munten
peça a peça en ONNX; la normalització (BatchNorm) dins de les convolucions, el
posicional de la imatge calculat d'avançada, el codificador dels punts dins
del graf, i els pesos amb la meitat de precisió.

- `sam-mira.onnx`: entrada [1,3,1024,1024], la foto amb el costat llarg de
  1024, menys la mitjana i partida per la desviació (com SAM), amb zeros on
  no arriba; sortida [1,256,64,64].
- `sam-toca.onnx`: entrades `vist` (la sortida de l'altra), `punts` [1,N,2]
  (en punts de la foto de 1024) i `tipus` [1,N] (1 = és d'aquí, 0 = no n'és,
  −1 = res); sortides `mascares` [1,4,256,256] i `qualitat` [1,4].

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

### `models/soroll.onnx` — treure el soroll i el gra

És **SCUNet**, de Kai Zhang i altres (ETH Zuric), https://github.com/cszn/SCUNet,
amb llicència **Apache 2.0** (`models/LICENSE-SCUNET`): la versió per a fotos de
debò, la que treu el soroll, el gra i els quadrets del JPEG sense saber de
quin tipus són (`scunet_color_real_psnr`). 18 milions de números. El fitxer
original és a les versions del projecte KAIR, del mateix autor:

```
fa78899ba2caec9d235a900e91d96c689da71c42029230c2028b00f09f809c2e  scunet_color_real_psnr.pth  (KAIR v1.0)
```

**Canvis respecte de l'original** (la llicència Apache demana dir-ho): la
xarxa s'ha muntat en ONNX amb una mida fixa de 256 × 256, de manera que les
finestres de l'atenció, el seu desplaçament i les màscares surten calculats
d'avançada (el codi original els calcula a cada passada), la màscara amb
−10.000 en lloc de −∞, i els pesos amb la meitat de precisió. L'app fa la foto
per trossos de 256 amb 16 punts de context.

Entrada i sortida: la foto en RGB de 0 a 1, d'1 × 3 × 256 × 256.

**El borrós no té model propi**: es fa amb el model lleuger d'ampliar (el de
dalt), que amplia el tros per 4 i el torna a la seva mida. Es va provar el
**Restormer** de desenfocament (MIT, 26 milions de números) i, amb fotos de
mostra desenfocades a posta, gairebé no hi guanyava res i de vegades s'hi
inventava textures; el model lleuger, usat així, les acostava més a la foto
nítida a totes les proves i no s'ha de baixar res més.

### `models/color.onnx.1`, `.2` i `.3` — posar color a les fotos en blanc i negre

És **DDColor**, de DAMO Academy (Alibaba), https://github.com/piddnad/DDColor,
amb llicència **Apache 2.0** (`models/LICENSE-DDCOLOR`). És la versió grossa
(DDColor-L: un ConvNeXt gran que mira la foto i un descodificador amb cent
«consultes de color» que decideixen els colors), 245 milions de números.

**D'on s'ha tret.** Els pesos del projecte només són a Hugging Face i a
ModelScope, que des d'on es treballa no s'hi arriba. El projecte FaceFusion
(https://github.com/facefusion/facefusion-assets, versió `models-3.0.0`) en
publica una conversió a ONNX, `ddcolor.onnx`, que és la que es fa servir. Té
els noms de les peces del codi original (`encoder.arch.stages...`,
`decoder.color_decoder...`) i, provada amb fotos de mostra, acoloreix com
diu el projecte. FaceFusion no diu de quina de les versions grosses és (la
«modelscope», que és la que el projecte recomana, o la del paper). El
fitxer, amb aquesta empremta (i el CRC32 `cab3b659` que publica FaceFusion):

```
dd6156f056d0690891ef35f9ee87176d4d976ab19bbd36e57d18e841e064d797  ddcolor.onnx
```

**Canvis respecte de l'original** (la llicència Apache demana dir-ho): els
pesos es desen amb 8 bits i una escala per canal (DequantizeLinear), de 980 MB
a 237, i el fitxer es parteix en tres trossos (GitHub no n'accepta de més de
100 MB), que l'app ajunta. El resultat canvia menys d'un nivell sobre 255 de
mitjana.

Entrada: la foto en grisos (la mateixa grisor als tres canals), de 0 a 1, de
N × N; l'app fa servir 256 (mode Mòbil) o 384 (mode Ordinador). Sortida: els
canals a i b de l'espai Lab a la mateixa mida, que l'app fa grans i ajunta amb
la claredat (L) de la foto.

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

Els de tocar l'objecte surten de `conversio/fes_sam.py`:

```
python conversio/fes_sam.py mobile_sam.pt models
```

LaMa surt de `conversio/fes_lama.py`, que en llegeix només els pesos (amb
el lector de `fes_migan.py`, sense executar res del codi que porta) i la munta
amb les transformades fetes amb matrius:

```
python conversio/fes_lama.py big-lama.pt models
```

El del soroll surt de `conversio/fes_soroll.py`, que llegeix el fitxer
original (sense executar res) i munta la xarxa peça a peça, amb la mida de tros
fixa:

```
python conversio/fes_soroll.py scunet_color_real_psnr.pth models/soroll.onnx 256
```

El del color surt de `conversio/fes_color.py`, que parteix del
`ddcolor.onnx` de FaceFusion (en comprova el CRC32), en desa els pesos amb 8
bits i el parteix en trossos:

```
python conversio/fes_color.py ddcolor.onnx models
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
