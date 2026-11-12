# Eines

Eines petites que funcionen dins del navegador, en català i pensades per al
mòbil. Cada una és **un sol fitxer**, sense cap llibreria i sense cap servidor.

**https://oscarbellosido.github.io/Eines/**

El que hi poses no surt del teu aparell: no hi ha servidor, ni enviaments, ni
estadístiques.

| Eina | Què fa |
|---|---|
| [La Cambra Fosca](https://oscarbellosido.github.io/Eines/cambra-fosca.html) | Retoca fotografies: llum, color, filtres, retall, pinzell, tampó de clonar i text. Arregla soles les fotos fosques, cremades o de colors estranys, les endreça si són tortes, hi esborra coses pintant-les amb el dit i les amplia amb IA. Mantenint premut «Abans» es veu com era |
| [La Revisió](https://oscarbellosido.github.io/Eines/revisio.html) | Repassa la seguretat d'un mòbil Android en tretze comprovacions guiades |

La Cambra Fosca **es pot instal·lar com una app**, amb la seva icona i sense
connexió: el botó INSTAL·LA de dalt, o al menú del navegador «Instal·la
l'aplicació» o «Afegeix a la pantalla d'inici».

Els jocs són a [la seva col·lecció](https://oscarbellosido.github.io/Jocs/).

L'ampliació amb IA fa servir els models de
[Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN) (llicència BSD); esborrar
coses, el model [MI-GAN](https://github.com/Picsart-AI-Research/MI-GAN) de
Picsart AI Research (llicència MIT); i tots dos, el motor
[ONNX Runtime Web](https://github.com/microsoft/onnxruntime) (llicència MIT).
Tot és a `ia/`, amb les seves llicències; `ia/LLEGEIX.md` ho explica.

## Provar-les

```
node prova.mjs
```

Obre les pàgines amb un navegador de debò i comprova que no vessin a cap mida
de pantalla, que no salti cap error i que les eines facin el que han de fer.
