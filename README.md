# Eines

Eines petites que funcionen dins del navegador, en català i pensades per al
mòbil. Cada una és **un sol fitxer**, sense cap llibreria i sense cap servidor.

**https://oscarbellosido.github.io/Eines/**

El que hi poses no surt del teu aparell: no hi ha servidor, ni enviaments, ni
estadístiques.

| Eina | Què fa |
|---|---|
| [La Cambra Fosca](https://oscarbellosido.github.io/Eines/cambra-fosca.html) | Retoca fotografies: llum, color, filtres, retall, pinzell, tampó de clonar i text. Arregla soles les fotos fosques, cremades o de colors estranys, i les cares borroses, en treu el soroll i el gra o les torna més nítides, posa color a les fotos en blanc i negre, les endreça si són tortes, hi esborra coses pintant-les amb el dit (i troba soles les ratllades de les fotos velles), en treu el fons (o el difumina) i les amplia amb IA. Mantenint premut «Abans» es veu com era, i a la pestanya Mida es canvia la mida, també en mil·límetres per imprimir, i la resolució |
| [La Revisió](https://oscarbellosido.github.io/Eines/revisio.html) | Repassa la seguretat d'un mòbil Android en tretze comprovacions guiades |

La Cambra Fosca **es pot instal·lar com una app**, amb la seva icona i sense
connexió: el botó INSTAL·LA de dalt, o al menú del navegador «Instal·la
l'aplicació» o «Afegeix a la pantalla d'inici».

Els jocs són a [la seva col·lecció](https://oscarbellosido.github.io/Jocs/).

L'ampliació amb IA fa servir els models de
[Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) (llicència BSD); esborrar
coses, el model [MI-GAN](https://github.com/Picsart-AI-Research/MI-GAN) de
Picsart AI Research (llicència MIT) i, al mode Ordinador, [LaMa](https://github.com/advimman/lama) de Samsung AI (Apache 2.0), i per tocar l'objecte, [MobileSAM](https://github.com/ChaoningZhang/MobileSAM) (Apache 2.0), i les ratllades les troba la xarxa de
[Bringing Old Photos Back to Life](https://github.com/microsoft/Bringing-Old-Photos-Back-to-Life)
de Microsoft (llicència MIT); el soroll, [SCUNet](https://github.com/cszn/SCUNet) (Apache 2.0); les cares, [GFPGAN](https://github.com/TencentARC/GFPGAN) de Tencent ARC
(Apache 2.0, amb part del codi de StyleGAN2 de NVIDIA, que només és per a ús no comercial)
i el detector de cares de [facexlib](https://github.com/xinntao/facexlib) (MIT); el color,
[DDColor](https://github.com/piddnad/DDColor) de DAMO Academy (Apache 2.0); treure el fons,
[U²-Net](https://github.com/xuebinqin/U-2-Net) i [IS-Net](https://github.com/xuebinqin/DIS)
(llicència Apache 2.0, en la versió del projecte [rembg](https://github.com/danielgatis/rembg));
i tots, el motor
[ONNX Runtime Web](https://github.com/microsoft/onnxruntime) (llicència MIT).
El motor és a `ia/`, amb les llicències de tot; els models, a Cloudflare R2 (no hi passa cap foto: només es baixen d'allà). `ia/LLEGEIX.md` ho explica.

## Provar-les

```
node prova.mjs
```

Obre les pàgines amb un navegador de debò i comprova que no vessin a cap mida
de pantalla, que no salti cap error i que les eines facin el que han de fer.
