# Eines

Eines petites que funcionen dins del navegador, en català i pensades per al
mòbil. **Cada eina és un sol fitxer** HTML autocontingut, sense cap llibreria,
sense cap servidor i sense cap dependència: s'obre i funciona. L'única excepció
és la carpeta `ia/`, que fan servir les IA de La Cambra Fosca (més avall).

- Publicat a: https://oscarbellosido.github.io/Eines/
- **El que hi posa qui la fa servir no surt mai del seu aparell.** No hi ha
  servidor, ni enviaments, ni estadístiques. Si algun dia cal afegir res que
  hagi de sortir a fora, s'ha de preguntar abans.
- És el germà del repositori dels jocs (`Jocs`), amb les mateixes normes i les
  mateixes trampes ja apreses. Aquí no hi van jocs, i allà no hi van eines.

## Les eines

| Fitxer | Nom a la web | Què fa | Any |
|---|---|---|---|
| `cambra-fosca.html` | La Cambra Fosca | Retoca, arregla (també les cares), treu el soroll, posa color, esborra coses, treu el fons i amplia fotografies | 2026 |
| `revisio.html` | La Revisió | Repassa la seguretat d'un mòbil Android | 2026 |

## Estructura

```
index.html            la portada, amb una fitxa per eina
cambra-fosca.html     l'editor de fotografies
revisio.html          la revisió de seguretat del mòbil
ia/                   el motor i els models de la IA (vegeu ia/LLEGEIX.md)
cambra-fosca.webmanifest   la fitxa de la Cambra Fosca com a app (nom, icones, colors)
cambra-fosca-sw.js         el que la fa anar sense connexió, un cop instal·lada
icones/               les icones de l'app
thumbs/               una captura de cada eina, 480 × 300
prova.mjs             la prova: la portada i totes les eines
```

## Com s'afegeix una eina nova

1. Un fitxer nou a l'arrel, amb el nom en català i amb guionets
   (`cambra-fosca.html`), autocontingut.
2. Una fitxa a `index.html`, a l'apartat que li toqui (si no n'hi ha cap que hi
   vagi bé, un apartat nou amb el seu `h2`).
3. Una captura a `thumbs/`, de 480 × 300: s'obté obrint l'eina amb el navegador
   a 768 × 480 i reduint-la. Ha d'ensenyar l'eina funcionant, no una pantalla
   buida.
4. La seva part a `prova.mjs`.
5. Una línia a la taula d'aquí dalt.

**Cada eina porta un enllaç de tornada a la portada** (`a.back`, «← EINES»), a
l'esquerra de la barra de dalt. A les pantalles estretes es queda només amb la
fletxa.

## La Cambra Fosca

Tot passa damunt de tres llenços (`canvas`) que no es veuen, i un de sol que
sí que es veu:

| | |
|---|---|
| `baseCanvas` | la foto original amb els girs, les inversions i el retall ja aplicats |
| `paintCanvas` | el que has pintat a sobre (pinzell, goma, tampó, text) |
| `workCanvas` | els dos de dalt ajuntats i passats pels ajustos |
| `#view` | el que es veu, amb el zoom fet amb CSS |

Coses que no s'han de desfer sense entendre-les:

- **Les pinzellades no es guarden com una imatge, es guarden com una llista
  del que has fet** (`S.ops`: els punts, la mida, la duresa, l'opacitat i el
  color). La capa de pintura es torna a dibuixar a partir de la llista. Per
  això desfer no gasta memòria: amb una foto de 12 megapíxels, guardar una
  còpia de la capa a cada pas serien 48 MB per pas. I per això, quan la
  imatge gira o es retalla, el que s'ha de moure són les coordenades de la
  llista (`mapOps`), no cap imatge.
- **Mentre pintes, només es torna a dibuixar la pinzellada d'ara** damunt de
  com estava la capa abans de començar-la (`savePaintSnap` /
  `restorePaintSnap`). Tornant-les a pintar totes a cada moviment del dit,
  amb cent pinzellades fetes el pinzell ja anava a batzegades.
- **El que es veu a la pantalla no es calcula a mida sencera.** Es calcula
  com a molt a 1.600 px (`renderScale`) i només es puja la resolució quan
  fas zoom. Desant, en canvi, sempre es treballa a mida sencera
  (`renderInto`). Amb una foto de mòbil, fer tot el tractament a mida
  sencera a cada moviment d'un control són dècimes de segon per fotograma i
  els controls van a salts.
- **Els ajustos que van canal per canal (exposició, temperatura, contrast,
  brillantor) es fan amb una taula de 256 valors** i no amb un càlcul per
  píxel. Així el cost no depèn de la mida de la foto. El que no es pot fer
  amb una taula —saturació, intensitat, gir de to, ombres i llums altes,
  vinyeta, gra— va al bucle de píxels, i cada cosa es salta si val zero.
- **El difuminat és un desenfocament de caixa passat tres vegades**
  (`boxBlur`), que s'assembla prou a un de gaussià i és molt més barat. La
  nitidesa i la claredat són la mateixa funció amb un radi diferent
  (`unsharp`): la claredat és la nitidesa amb un radi gros.
- **El radi dels efectes va lligat a l'escala** amb què s'està pintant. Si
  no, el difuminat es veuria d'una manera a la pantalla i d'una altra al
  fitxer desat.
- **Les miniatures dels filtres es fan amb la foto de qui la fa servir**, no
  amb cap imatge d'exemple: un quadradet del mig, passat per cada preajust.
  Un filtre només es pot triar si veus què farà a la teva foto.

**El tampó de clonar** copia el que hi ha a l'origen (la creueta) allà on
pintes: el punt p rep el que hi ha a p + (origen − on ha començat la
pinzellada). **Va estar molt de temps amb el signe girat** i copiava de
l'altra banda: l'usuari va fixar l'origen al sofà vermell, pintava al
costat i hi sortia el verd del fons. La prova ho mira amb una foto meitat
verda i meitat vermella. Al mòbil no hi ha tecla Alt: **el primer toc sense
origen el fixa** (i no pinta res), i **«Tria l'origen»** fa que el toc
següent el canviï. Mentre pintes, **la creueta segueix el dit** (diu d'on
s'està copiant), i en acabar torna a l'origen: cada pinzellada torna a
començar a copiar des d'allà.

**La imatge d'exemple.** En obrir-se no hi ha cap foto, i una pàgina buida no
ensenya res del que sap fer. Per això es pinta sola una escena (`makeSample`):
cel de posta, serralades, aigua amb reflex, gra i cantonades fosques. No és cap
fotografia baixada d'enlloc —seria pes i drets d'autor—, surt sempre igual (la
llavor és fixa) i té de tot perquè tots els ajustos s'hi notin: si el cel fos
llis, la vinyeta i el gra no es veurien.

**La pestanya Mida.** L'usuari va demanar primer poder dir «300 mm d'ample» i
que l'alt es fes sol (es va posar al quadre de Desa, i a l'Amplia un «A
mida»), i després va trobar confús tenir la mida en dos llocs: va demanar un
apartat per a la mida i la resolució, que **Desa** només triés el format i
que l'**Amplia** fos només per guanyar qualitat. Ara és així:

- **Mida** (`pintaMidaFoto`): diu quant fa la foto (en punts i, a la seva
  resolució, en mm) i la deixa canviar en **px, mm o cm**, sempre
  proporcional (escrivint un, l'altre es calcula; per una altra forma, primer
  es retalla), amb la **resolució** (`S.ppp`, 300 de partida, la normal per
  imprimir). Els botons Com és · 50% · 25% hi són igual. **Aplica**
  (`aplicaMida`): si només canvia la resolució, la foto no es toca; si
  canvien els punts, es fa de la mida nova (reduint molt, a passos de la
  meitat, que d'un sol cop surten dents). Com quan s'amplia, la foto nova
  passa a ser la foto i desfer la torna com era, resolució inclosa (`ppp` a
  `snap`).
- **En punts, la resolució només canvia quant fa imprès; en mm o cm, canviar
  la resolució manté la mida impresa** i canvien els punts. És el que la
  persona espera segons la unitat en què pensa.
- **Si la mida és més gran que la foto**, avisa en taronja (s'estirarà, a
  quants ppp sortiria amb els punts que té) i ofereix **✦ Fes-la més gran
  amb IA** (`midaAmbIA`), que fa servir el càlcul de l'antic «A mida» de
  l'Amplia (`plaAmplia`, més avall) amb el mode Mòbil / Ordinador de
  l'Amplia. Aleshores el botó destacat és el de la IA, no Aplica.
- **Les caselles es tornen a calcular a cada tecla sense refer el panell**,
  que si no perdrien el cursor. **I tornen a partir de la foto quan aquesta o
  la seva resolució canvien** (també desfent): si no, després de desfer una
  resolució, les caselles seguien dient l'antiga i els mil·límetres sortien
  malament (la prova ho va trobar).
- **El fitxer porta escrita la resolució** (`posaPPP`), sempre (en PNG i
  JPG): el navegador no ho fa, i sense això el programa que imprimeix suposa
  72 o 96 ppp i la foto de 300 mm surt d'un metre. Al PNG és un tros `pHYs`
  (punts per metre, amb la seva suma de control, `crc32`); al JPG, la
  capçalera JFIF (punts per polzada; si no n'hi ha, se n'hi posa una). Al
  WEBP no hi ha manera senzilla i el quadre de Desa ho diu.
- **Massa gran per a l'aparell, no es deixa aplicar** (`MAX_DESA_MP`: 40
  megapíxels al mòbil, 150 a l'ordinador, i mai més de 16.384 px per costat,
  que és el que deixen fer els navegadors), i diu per què.
- **La unitat i la resolució de partida es recorden** en aquest aparell
  (`cambra-fosca-mida`); en obrir una foto, `S.ppp` és la recordada.
- Els números s'escriuen amb coma (`127,5`) i s'accepten amb coma o punt.
- **Cinc pestanyes a 320 px**: per sota de 400 px es fan una mica més
  estretes.

**Desa** només té el format, la qualitat i el nom, i diu quant farà i on es
canvia la mida. Avisa si el JPG perdrà la transparència o si el WEBP no
guardarà la resolució.

**Desar la imatge.** A la web funciona la baixada normal del navegador
(`desaFitxer`). La pàgina també es pot publicar com a *artifact* de claude.ai,
i allà el navegador no deixa que una pàgina es baixi res ella mateixa: s'ha de
demanar a la plataforma (`claude.use('downloads')`). Es prova primer la
plataforma i, si no hi és, l'enllaç de tota la vida. **Si es toca una de les
dues bandes, s'ha de comprovar l'altra.**

## La Cambra Fosca: els menús

L'usuari va trobar els menús embolicats quan ja hi havia cinc IA: les cares
eren a Ajustos (sota Endreça), les ratllades dins de l'eina d'esborrar,
l'Amplia i el Fons tenien una pestanya cadascuna i **cadascuna el seu
«Mòbil / Ordinador»**. Ara les pestanyes són **Ajustos · Filtres · ✦ IA ·
Mida · Historial**:

- **Ajustos**: «Arregla-la sola» a dalt (és d'ajustos: mou els controls) i
  els controls de sempre.
- **✦ IA** (`construeixIA`, `pintaIA`): a dalt, **un sol «On ho fas»** per a
  totes (`IA.mode`), i una **targeta** per a cada IA, per l'ordre en què
  s'arregla una foto vella (`TARGETES`): Ratllades i taques, Soroll i borrós,
  Esborra coses, Cares, Color, Fons i Amplia. **Només una d'oberta** (`IA.targeta`), que al mòbil
  no s'hagi de baixar tant; tocant-la oberta, es tanca. El Fons i l'Amplia
  es pinten dins de la seva targeta (`#pane-fons`, `#pane-amp`, que ara són
  dins), i diuen amb quin mode van.
- **Esborra coses** es pinta a la foto, o sigui que la targeta només porta a
  la vareta (`#iaVesEsborra`); al mòbil, a més, puja fins a la foto
  (`veuFoto`). La vareta segueix a la tira d'eines.
- **Endreça** és a l'eina Retalla, amb girar i invertir.
- Les eines no han canviat gens: només de lloc.

## La Cambra Fosca: arregla la foto

L'usuari va preguntar si es podien arreglar fotos mal fetes «com fa ChatGPT».
El que fa ChatGPT (entendre la foto i tornar-la a pintar: «treu la gent del
fons») és un model enorme que corre als seus servidors i no es pot fer a
l'aparell. Es van proposar tres coses que sí: un botó que arregla sol la
claredat i el color, esborrar coses amb una IA (LaMa, uns 200 MB) i arreglar
cares (GFPGAN, uns 350 MB). L'usuari va triar començar per la primera. A dalt
de la pestanya Ajustos hi ha **Arregla la foto**:

**✦ Arregla-la sola** (`calculaArregla`). **No fa cap màgia: mou els mateixos
controls d'ajust de sota**, perquè es vegi què ha fet i es pugui retocar, i ho
diu amb paraules («Ara és més clara i menys groga»). Mira la foto i ho
arregla per aquest ordre: el tint de color, la claredat, el contrast, les
ombres tapades i les llums cremades, i els colors apagats. Toca vuit controls
(`ARREGLA.CONTROLA`) i deixa la resta (filtres, vinyeta, gra...) com eren.
Prémer-lo dues vegades dona el mateix.

Coses que no s'han de desfer sense entendre-les:

- **Per triar quant mou cada control, prova valors** sobre una còpia de la
  foto de 256 px, passant-la pel mateix tractament que la pantalla
  (`pipeline`), i mira el que en surt (`bisecta`). Així el que diuen els
  números és el que es veu, sigui com sigui per dins cada control. Triga
  una o dues dècimes.
- **Una foto que ja està bé no s'ha de tocar.** Per això els marges de «ja
  està bé» són amples (`MED_ZONA`, `ESTESA_MIN`): la claredat del mig, entre
  0,32 i 0,62, i el contrast, només si del més fosc al més clar no arriba a
  0,75. Amb marges estrets, a la foto bona de la prova li canviava la claredat
  i el contrast.
- **El color és el més delicat, i es va haver de fer tres vegades.** Ara hi
  ha dues pistes: el color de les parts més clares (que solen ser blanques:
  un paper, un núvol) diu **quant** s'ha de corregir, i el color de mitjana
  de tota la foto **només té dret a vet**: si diu el sentit contrari, no es
  toca el color. Així una posta de sol (el sol és taronja, però el cel és
  blau) es queda com és. Les dues maneres d'abans fallaven:
  - buscar els objectes grisos de la foto: amb un tint fort, un objecte blau
    es torna grisós, i la foto groga sortia encara més groga;
  - corregir només el que digués la pista més prudent: la mitjana es deixa
    enganyar pels colors de l'escena (el cel blau, les muntanyes verdes), i la
    foto groga es quedava groga i la blava es tornava rosa.
- **Les parts més clares descarten només els cremats de debò (254)**: amb un
  límit de 250, el paper blanc d'una foto groguenca (vermell a 250) quedava
  fora, i és justament la millor pista.
- **El color es corregeix un 80% del que caldria** (`COLOR_PART`), i fins a 90
  de temperatura: una foto feta a casa amb llum de bombeta en necessita més de
  70.
- **El que deia el botó s'amaga** si obres una altra foto o desfàs, que ja no
  seria veritat.

Com va, amb les fotos espatllades de la prova (diferència mitjana amb la foto
bona, de 0 a 255): la fosca de 71 a 35, la cremada de 65 a 23, la fosca i
groga de 68 a 33, i a la groga i la blava el tint baixa a menys de la meitat.
La bona i la posta de sol de mostra no es toquen de color.

**Endreça** (`aplicaEndreca`, a l'eina **Retalla**, amb girar i invertir:
tot el que canvia la forma de la foto, junt; mentre el control és mogut, el
marc del retall s'amaga): un control de −15° a +15° per redreçar una foto
torta. Mentre es mou, **només gira la imatge de la pantalla** (CSS), amb una
reixa al damunt per veure-hi les rectes; la foto no es toca fins a **Aplica**,
que si no cada retoc la tornaria a passar pel girat i la perdria. En
aplicar-ho, la foto es retalla el just perquè no quedin cantonades buides, amb
la mateixa forma (`escalaEndreca`), i passa a ser la foto, com quan s'amplia:
les pinzellades giren amb ella i desfer la torna com era. Qualsevol altra cosa
que facis amb la foto mentre el control és mogut el cancel·la.

**Arregla les cares** (pestanya ✦ IA, targeta «Cares»). L'usuari arregla
fotos deteriorades i ho va triar d'una llista: que les cares borroses o
malmeses quedin nítides. Dues xarxes, convertides per
`ia/conversio/fes_cares.py`:

- **RetinaFace (MobileNet 0.25, 1,6 MB, de facexlib)** troba les cares i cinc
  punts de cada una (els ulls, el nas i les comissures de la boca)
  (`trobaCares`): la foto com a molt de 1.280 punts, amb els costats múltiples
  de 32, en BGR menys la mitjana. Es queden les cares que el model veu segures
  al **97%**, com al projecte original (amb el 80% hi entrava un tros de
  passamà), sense repetides i amb els ulls a 5 punts o més.
- **GFPGAN v1.4 (167 MB, de Tencent)** arregla cada cara posada dreta a
  512 × 512 (`arreglaUnaCara`): amb els cinc punts es calcula el gir, l'escala
  i el desplaçament que els porten a la plantilla de facexlib (`semblanca`,
  mínims quadrats), la cara arreglada es torna al seu lloc amb el gir de
  tornada i **s'enganxa un quadrat amb les vores suaus** (`mascaraCara`, 25
  punts cap a dins i uns 8 de fos), que és el que fa el projecte original
  sense el model que retalla la cara pel contorn.
- **Força**: «Fort», «Mitjà» i «Suau» barregen la cara arreglada amb
  l'original (100%, 70%, 45%): GFPGAN de vegades deixa la cara massa
  perfecta.
- **GFPGAN fa 87 milions de números**: 167 MB amb mitja precisió, en **dos
  trossos** (GitHub no n'accepta de més de 100 MB) que l'app baixa i ajunta
  (`preparaSessioCares`). És gran per al mòbil (amb els pesos desplegats a la
  memòria són uns 500 MB) i ho diu.
- Les convolucions de StyleGAN2 depenen de cada cara; al graf es fan com a
  multiplicar l'entrada per l'estil, convolució normal i multiplicar per la
  normalització, calculada amb un producte de matrius. El soroll és el fix que
  porta el fitxer: la mateixa foto dona sempre el mateix.
- **La llicència**: GFPGAN és Apache 2.0, però una part del codi ve de
  StyleGAN2, de NVIDIA, només per a ús no comercial (`ia/LLEGEIX.md`). Es fa
  servir la versió «clean», sense les peces especials de NVIDIA.
- Sense gràfica, al contenidor tres cares triguen uns 45 segons comptant la
  preparació. Es va comprovar amb fotos de prova del projecte GFPGAN (no són
  al repositori): les cares surten nítides i al seu lloc.

## La Cambra Fosca: soroll i borrós

L'usuari arregla fotos velles i ho va triar d'una llista. És la targeta
**Soroll i borrós** de la pestanya ✦ IA (`fesNitida`), amb dues opcions:

- **Té soroll o gra**: **SCUNet** (Apache 2.0, 18 milions de números, 39 MB
  amb mitja precisió), la versió per a fotos de debò, que treu el soroll, el
  gra i els quadrets del JPEG. `ia/conversio/fes_soroll.py` la munta peça a
  peça amb **trossos fixos de 256** (les finestres de l'atenció, el
  desplaçament i les màscares, calculats d'avançada): l'app la passa per
  trossos de 224 amb 16 de context (`ampliaImatge` amb `k:1, fix:true`; si la
  foto és més petita que un tros, es repeteix la vora). A les fotos de mostra
  amb soroll fort, de 24 a 31-33 dB.
- **Està borrosa**: **no hi ha model propi**. El model lleuger d'ampliar
  amplia cada tros per 4 i el torna a la seva mida (`ampliaImatge` amb
  `f:1`): en ampliar torna nítid el que era tou. Es va provar el Restormer de
  desenfocament (MIT) i, amb fotos desenfocades a posta, el model lleuger les
  acostava més a la nítida a totes les proves (amb un desenfocament suau,
  +1,8 dB contra 0), i el Restormer de vegades s'hi inventava textures com
  de pintura. NAFNet, que és el que fa servir més gent, només és a Google
  Drive, que des del contenidor no s'hi arriba.
- **Força**: Fort, Mitjà i Suau barregen el resultat amb l'original (100%,
  70%, 45%), com a les cares.
- **És lent**: SCUNet fa molts càlculs per punt. Al contenidor, sense
  gràfica, un tros triga uns segons; una foto d'un megapíxel són uns 25
  trossos. Per això fa servir la mateixa pregunta que ampliar: si trigarà més
  de 3 minuts, ho diu i pregunta (`preguntaTemps`).
- La foto nova passa a ser la foto i desfer la torna, com amb les altres IA.

## La Cambra Fosca: posar color

L'usuari arregla fotos velles i ho va triar d'una llista: que les fotos en
blanc i negre (o en sèpia) quedin en color. És la targeta **Color** de la
pestanya ✦ IA (`posaColor`). Fa servir **DDColor** (Apache 2.0), la versió
grossa, amb els pesos en 8 bits (237 MB, en tres trossos).

- **El model només dona el color** (els canals a i b de l'espai Lab) d'una
  versió quadrada i petita de la foto en grisos (`acoloreix`); es fa gran fins
  a la mida de la foto i s'ajunta amb la claredat (L) de cada punt de la foto
  original. Per això **el detall no es perd** i la claredat queda igual (la
  prova ho mira). Si la foto és en sèpia, el seu to desapareix: la L és la
  mateixa i el color és el de la IA.
- **El mateix model als dos modes**, a una mida diferent (`IA.color.N`): al
  Mòbil, 256 punts (és a la mida que es va entrenar i va més de pressa); a
  l'Ordinador, 384. Es van provar 256, 384 i 512 contra els colors de debò de
  quatre fotos de mostra: a 384 és on s'equivoca menys de mitjana, i a 512 de
  vegades fa taques (un vestit meitat verd i meitat blau).
- **Força**: Fort, Mitjà i Suau multipliquen el color per 1, 0,75 i 0,5. No
  es barreja amb l'original, que en una foto en sèpia tornaria a portar la
  sèpia.
- **Els colors són inventats**, i la targeta ho diu: la pell, el cel i les
  plantes els encerta sovint; la roba i els objectes, no sempre.
- **Si la foto ja té colors, ho diu** (`fotoTeColor`): la IA els canviaria
  pels seus. La sèpia té color però sempre del mateix to, així que el que es
  mira és **com varia el to** entre els punts amb prou color (desviació
  circular): la sèpia de prova varia menys d'1°, les fotos de color més de 10°,
  i el límit és 6°.
- **Els pesos en 8 bits no s'ajunten amb el model en carregar-lo** (el motor
  deixa les peces DequantizeLinear per a cada passada): així a la memòria
  també ocupen 237 MB i no 980. Amb els pesos a mitja precisió, com els
  altres, haurien fet 490 MB i la web hauria passat d'1 GB, que és el màxim de
  GitHub Pages.
- **D'on surt**: els pesos del projecte només són a Hugging Face i a
  ModelScope, que des del contenidor no s'hi arriba; es parteix de la
  conversió a ONNX que publica FaceFusion a GitHub (`ia/LLEGEIX.md`).
- Sense gràfica, al contenidor una foto de 600 × 400 triga uns 18 segons al
  mode Ordinador comptant la preparació. El que fa el navegador es va comparar
  amb el mateix càlcul fet a part, en Python: 1,6 nivells de diferència sobre
  255 de mitjana.

## La Cambra Fosca: ampliar amb IA

L'usuari va demanar poder ampliar una foto guanyant qualitat, com fa Upscayl,
i que hi hagués **dues opcions: una per al mòbil i una per a l'ordinador**, que
té molta més capacitat. És la targeta **Amplia** de la pestanya ✦ IA. Fa servir les mateixes
xarxes neuronals que Upscayl (Real-ESRGAN), que corren dins del navegador amb
ONNX Runtime Web. La foto no surt de l'aparell.

| Mode | Model | Pes | Màxim del resultat |
|---|---|---|---|
| Mòbil | `realesr-general-x4v3-v2` (lleuger) | 4,9 MB | 16 megapíxels |
| Ordinador | `realesrgan-x4plus` (gran) | 67 MB | 64 megapíxels |

De partida es tria el mode pel tipus de pantalla, però es pot canviar.

**Per què és l'excepció a «un sol fitxer».** El motor (15 o 29 MB) i els
models (5 o 67 MB) no poden anar dins de l'HTML: el farien inservible per a
qui no amplia res, i tenen llicència pròpia. Van a `ia/`, del mateix web (cap
altre servidor), i només es baixen la primera vegada que algú amplia. Després
queden a la memòria del navegador (`caches`, `cambra-fosca-ia-1`), també
sense connexió. `ia/LLEGEIX.md` diu d'on surt cada fitxer i amb quina
llicència, i `ia/conversio/` té els scripts que fan els models: **els `.onnx`
no s'han de tocar a mà**, es tornen a fer amb aquells scripts.

Coses que no s'han de desfer sense entendre-les:

- **Els models es van fer sense PyTorch.** El servidor de PyTorch és tancat
  des del contenidor on es treballa, i el de PyPI arrossega 2 GB. Per això
  `llegeix_pth.py` llegeix els pesos directament (i, de pas, no executa res
  del que porta el fitxer: només accepta números), i `fes_onnx.py` construeix
  les dues xarxes peça a peça. Es va comprovar que funcionen reduint una
  imatge a la quarta part i tornant-la a ampliar.
- **Cada aparell baixa només el motor que pot fer servir** (`IA.motors`): el
  de la gràfica (WebGPU, 29 MB) si en té, i el del processador (15 MB) si no.
  El de la gràfica també sap anar amb el processador si la gràfica falla.
- **Primer es prova la gràfica sola, i només si no arrenca, el processador**
  (`preparaSessio`), i es diu: al panell («el motor no l'ha pogut fer
  arrencar», amb el motiu) i al «✓ Feta» («amb la gràfica» o «amb el
  processador»). Abans es demanaven totes dues de cop, i si la gràfica fallava
  el motor passava al processador sense dir res: l'usuari, amb l'Edge, va
  esperar una hora i no hi havia manera de saber per què.
- **El «✓ Feta» porta una línia de detalls** (`IA.fet.detalls`): el navegador,
  gràfica o processador, i **a quina velocitat ha anat** (GFLOP/s, sense el
  primer tros, que porta la preparació; `macPx` diu quantes multiplicacions fa
  cada model per píxel). Amb la gràfica han de ser centenars; amb el
  processador, poques desenes. És per a qui hagi de revisar per què ha trigat
  tant: l'usuari en pot enviar una captura.
- **Cap model no pot fer servir peces que la gràfica no sap fer** (la llista és
  a `docs/webgpu-operators.md` del paquet `onnxruntime-web`): aquelles peces
  van al processador i tornen, i amb gràfica i tot va lent. El model lleuger
  original tenia 33 PRelu, que no hi són; ara es fa amb ReLU, multiplicar i
  sumar (`fes_onnx.py`), dona el mateix i pel processador va fins i tot una
  mica més de pressa. Per això el fitxer es diu `-v2`, i en obrir-se s'esborra
  de la memòria del navegador el de la primera versió. La prova mira que cap
  model porti PRelu.
- **Sense gràfica, el motor treballa en un fil a part** (`ort.env.wasm.proxy`).
  Si no, el navegador es quedaria glaçat uns segons a cada tros.
- **Es treballa per trossos** (`ampliaImatge`), sempre de la mateixa mida
  (que la gràfica no s'hagi de tornar a preparar a cada un), amb **16 píxels
  de context** al voltant (`MARGE`) que després es llencen. Comparat amb el
  model passat de cop sobre tota la imatge, la diferència més gran a les
  costures és de 4 nivells sobre 255: no es veu. La memòria no depèn de la
  mida de la foto.
- **Fora de la foto es repeteix la vora**, no s'hi posa negre. Amb negre (que
  és el que fa el model passat de cop) a les vores de la foto surt un marc
  fosc.
- **El model sempre amplia per 4.** Per a ×2, cada tros es redueix a la
  meitat amb el seu marge i tot, abans de posar-lo: així tampoc no hi ha
  costures. Vol dir que ×2 costa el mateix temps que ×4.
- **La transparència no la toca el model**: s'amplia a part, a la manera
  normal, només si la foto en té.
- **La foto ampliada passa a ser la foto** (`S.src`): els girs i el retall hi
  queden aplicats, les pinzellades es fan grans amb ella (`mapOps` i la
  mida), i els ajustos es continuen aplicant a sobre. L'historial recorda
  quina foto hi havia (`src` a `snap`), i per això desfer torna a la petita.
- **Mentre amplia, no es pot tocar res**: un vel tapa la pantalla, amb la
  barra, quants trossos queden i quant temps, i el botó d'**Atura**. Aturar
  deixa la foto com era i no apunta res a l'historial.
- **Si trigarà més de 3 minuts, ho diu de seguida i pregunta** (`IA.LLARG`,
  `preguntaTemps`): al segon tros ja se sap el temps, i el vel diu quant
  trigarà, que el model del mòbil va unes 15 vegades més de pressa, i
  «Continua igualment» o «Atura». L'usuari va ampliar per 4 amb el model gran
  una foto de 3 megapíxels i va estar **una hora** esperant sense que res li
  hagués dit que trigaria tant. El temps de pensar-s'ho no compta per al
  càlcul del que queda.
- **Mentre amplia, la pantalla no s'apaga** (`navigator.wakeLock`): si
  s'apaga, el mòbil atura la pàgina i la feina es queda a mig fer. Quan la
  pàgina torna a ser visible es torna a demanar, que el navegador ho deixa
  anar en amagar-la.
- **La pestanya del navegador diu per on va** («37% · Ampliant»), i al final
  «✓ Ampliada», que es veu des d'una altra pestanya. Torna a dir «La Cambra
  Fosca» uns segons després de tornar a mirar la pàgina.
- **En acabar, a dalt de tot del panell diu «✓ Feta»**, amb el temps i la
  mida d'abans i de després (`IA.fet`, només mentre la foto és aquella). Sense
  això, després de l'hora d'espera el primer que l'usuari va veure va ser
  l'avís de «no hi cap», que parlava de **tornar-la a ampliar**, i es pensava
  que havia fallat.
- **Els límits del resultat (16 i 64 megapíxels) són per la memòria.** Si
  la persona tria ×4 i no hi cap, es queda ×4 i se li diu per què no pot. Al
  principi passava sol a ×2 sense dir res, i l'avís no sortia mai. L'avís és
  **taronja, no vermell** (no és cap error), i diu el que passa segons el
  cas (`#iaNoHiCap`): que per 4 no hi cap però per 2 sí; que la foto **ja
  l'has ampliada** (tornar-la a ampliar s'inventaria detall a sobre del que
  ja s'havia inventat); que **ja és molt gran** (l'ampliació és per a fotos
  petites); o, al mòbil, que des de l'ordinador sí que es pot. Abans deia
  sempre el mateix, amb una frase que començava en minúscula.
- **La capa de pintura i l'esborrany només existeixen si s'hi ha pintat**
  (`ensurePaint`, `ensureScratch`), i la base no és cap còpia quan la foto
  no està girada ni retallada. Abans hi havia quatre llenços de la mida de la
  foto: amb una foto ampliada a 6000 px, 576 MB.
- **Neteja el soroll i el gra.** És com són aquests models: a una foto vella
  o de WhatsApp li va molt bé, i a una amb gra a posta, el treu. El que s'ha
  perdut del tot (unes lletres petitíssimes) no ho recupera: s'inventa una
  cosa que s'hi assembla.

**Ampliar «a mida»** (ara des de la pestanya Mida, amb «✦ Fes-la més gran amb
IA»; a l'Amplia ja només hi ha ×2 i ×4). Abans era un «A mida (mm)» de
l'Amplia: l'usuari ho va demanar perquè, desant a 300 mm, l'eina li deia que
l'ampliés primer, i després el va trobar confús allà.

- **El model sempre fa ×2 o ×4** (`plaAmplia`): el primer que n'hi ha prou, i
  després la foto es deixa a la mida justa (una reducció normal, de bona
  qualitat). Si cal més de 4 vegades, o si en aquest mode ×4 no cap a la
  memòria i es fa ×2, la resta s'estira a la manera normal, i el panell ho
  diu (i, al mòbil, que amb el mode Ordinador ho faria tot el model).
- Si la mida demanada ja és la de la foto o més petita, el botó de la IA no
  surt: n'hi ha prou amb «Aplica».
- En acabar, la foto queda a la resolució que s'havia triat (`S.ppp`), i la
  unitat i la resolució es desen com a les de partida.

**El camí de la gràfica no es pot provar al contenidor**, que no en té (ni
amb SwiftShader). Està fet perquè, si falla, vagi amb el processador. **Al
seu ordinador, amb l'Edge, la gràfica funciona**: una foto de 1057 × 949 per
4 amb el model gran, 72 trossos, 13 minuts, **83 GFLOP/s**. És poc per a una
gràfica (deu ser una d'integrada, i el motor diu que les convolucions encara
no són ràpides a la gràfica), però no és cap error. L'hora d'aquell primer dia
també va ser amb la gràfica, a aquesta velocitat: la foto era tres vegades més
gran. Si mai es vol fer anar més de pressa, les vies són fer els models de
mitja precisió (`shader-f16`, si la gràfica en sap) o trossos més grossos
(menys marge per tros); totes dues s'han de mesurar a l'ordinador de
l'usuari, que aquí no es pot.

La línia de detalls deia «Chrome 157» a l'Edge: l'Edge també diu «Chrome/...»,
abans del seu nom, i s'agafava el primer. Ara `quinNavegador` busca primer els
noms propis (Edge, Opera, Samsung) i la prova ho mira amb el que envien els
navegadors de debò.

Com va de temps, sense gràfica i en un sol fil (el contenidor): una imatge de
200 × 150 per 4 triga 11 segons amb el model lleuger, i per 2 triga dos minuts
i mig amb el gran. El gran, sense gràfica, és per a fotos petites.

## La Cambra Fosca: esborrar coses amb el dit

L'usuari va demanar poder **treure coses d'una foto pintant-les amb el dit**
(una persona del fons, un cable, una taca), que és el que fa ChatGPT i que
abans s'havia deixat per més endavant. Es van mirar tres models que corren
dins del navegador: **LaMa** (200 MB, el millor però massa pesat per al
mòbil), **MI-GAN** (25 MB, de Picsart, fet a posta per a mòbils) i
OpenCV (sense IA, només difumina). L'usuari va triar **MI-GAN**. És l'eina
**Esborra coses (IA)** de la tira (la vareta, tecla X).

- Es pinta de **vermell** el que es vol treure (`S.mascara`, ratlles en
  coordenades de la base, com les pinzellades) i es prem **Esborra-ho**. El
  vermell **només es dibuixa a la pantalla** (`pintaVista`, damunt del que ja
  s'ha tractat), no és cap capa: desant no hi surt mai. **Neteja el vermell**,
  Esc i canviar d'eina el treuen, i qualsevol canvi de la foto també
  (`buildBase`), que ja no seria al seu lloc. No va a l'historial.
- **El model només treballa a 512 × 512** (`treuAmbIA`). Es retalla un tros
  al voltant del vermell, **2,2 vegades més gran que el forat** i com a mínim
  de 160 px (perquè vegi què hi ha al voltant), es fa de 512, el model
  l'omple i es torna a la mida de debò. **Només s'enganxa on hi havia vermell**,
  amb la vora esvaïda: la resta de la foto queda exactament com era, i la
  prova ho mira píxel a píxel. Si el tros fa més de 512, el que s'hi posa és
  una mica més tou que la resta; amb objectes petits, ni es nota.
- **El forat es fa 4 píxels (a 512) més gros que el vermell**: la vora d'un
  objecte gairebé mai no es pinta del tot, i sense això en quedava una aura.
- **L'entrada del model és com la del projecte original**: quatre canals, el
  primer la màscara menys 0,5 (1 = es queda, 0 = s'esborra) i els altres la
  foto de −1 a 1 amb el forat a zero. Si s'inverteix la màscara, el model
  omple amb una taca llisa: la prova ho veu perquè hi ha d'haver maons.
- **La foto esborrada passa a ser la foto**, com quan s'amplia: els girs i el
  retall hi queden aplicats, les pinzellades no es mouen (la mida és la
  mateixa) i desfer torna a la d'abans. **Treballa amb la foto, no amb el que
  s'hi ha pintat a sobre**: el pinzell i el text queden com eren, i l'eina ho
  diu.
- **Fa servir el mateix motor que ampliar** (`preparaMotor`, `creaSessio`:
  primer la gràfica, i si no arrenca, el processador), amb una sessió seva
  (`IA.treu`). La primera vegada baixa el model (25 MB) i, si no s'havia
  ampliat mai, el motor; després va sense connexió. Sense gràfica, el
  contenidor ho fa en uns 4 segons comptant la preparació.
- **Mentre treballa, el mateix vel que ampliar**, que no deixa tocar res.

Després de provar-la, l'usuari va demanar tres millores per al mòbil:

- **La goma del vermell** («Pinta vermell» / «Treu vermell», `S.mascGoma`):
  les ratlles de goma van a la mateixa llista amb `goma:true` i es dibuixen
  amb `destination-out`, o sigui que treuen el que hi havia a sota, tant a la
  pantalla com a la màscara que va al model. Només compten per al tros les
  ratlles que pinten. Si la goma ho ha tret tot, no es fa res i es diu.
- **Zoom amb dos dits, a totes les eines** (`pessiga`, al `#stage` i en la
  fase de captura, abans que l'eina vegi el dit). El primer dit ja ha
  començat a pintar quan arriba el segon: aquella ratlla es llença
  (`cancelaTraca`, que també treu la pinzellada de `S.ops` sense apuntar res
  a l'historial). Mentre quedi algun dit a sobre (`dosDits`) no es pinta ni
  es desplaça res més. El punt de la foto que hi havia entre els dos dits s'hi
  queda. El fons de la taula porta `touch-action:pan-x pan-y`: un dit hi fa
  córrer la pàgina, però el navegador no fa zoom de tota la pàgina.
- **«Esborra-ho» sura a sota de la pantalla** (`#treuFlota`), només al mòbil
  (fins a 760 px) i només quan hi ha vermell: allà les opcions de l'eina
  queden sota la foto i, després de pintar, les havies d'anar a buscar. La X
  de netejar és petita i separada, que el gros és el que es prem sempre.

**«✦ Troba les ratllades»**, a la targeta «Ratllades i taques» de la pestanya
✦ IA (en prémer-lo, es passa sola a l'eina d'esborrar, que és on es repassa). L'usuari arregla
fotos deteriorades i va triar això d'una llista: que la IA marqui sola les
ratllades, els plecs i les taques clares d'una foto vella, i l'esborrador les
tregui. Fa servir la xarxa de detecció de **Bringing Old Photos Back to
Life** (Microsoft, MIT), convertida per `ia/conversio/fes_ratllades.py`.

- **Marca, no esborra**: el que troba es posa com a vermell
  (`mapaRatllades` → una entrada `ras` a `S.mascara`, una imatge en lloc de
  ratlles), i la persona ho repassa amb «Pinta vermell» i «Treu vermell»
  abans de prémer «Esborra-ho». La goma funciona igual perquè el vermell es
  dibuixa per ordre (`tracaMascara`).
- **Treballa com el projecte original**: la foto en grisos, de −1 a 1, amb el
  costat curt de 256 (els dos costats múltiples de 16), i el que passa de 0,4
  és ratllada. Es va provar a 384 i 512 i no en trobava més. El mapa es fa
  gran fins a 2.048 punts com a molt (amb les vores suaus i tallat al 0,4).
- **Troba sobretot les ratllades clares**, que són les típiques de les fotos
  velles; les fosques gairebé no, i els plecs rectes de vegades només a
  trossos. Les que falten es pinten a mà.
- **Amb ratllades, l'esborrador va per trossos** (`treuPerTrossos`): una
  ratllada travessa tota la foto, i fent-ho com amb un objecte (un tros al
  voltant reduït a 512) el que s'hi posava quedava tou. Ara es fan trossos de
  512 a la mida de debò, només els que tenen vermell; cada tros veu el que ja
  han arreglat els d'abans i només es queda el seu mig (32 punts de marge),
  que la vora la fa el tros del costat. El forat es fa 3 punts més gros a
  cada banda. A la prova, a les ratllades marcades la diferència amb la foto
  neta baixa de 107 a 22, i la resta de la foto no canvia.
- **La xarxa fa 37,6 milions de números** (75 MB amb mitja precisió; el fitxer
  original de Microsoft en fa 451 perquè porta el que es fa servir per
  entrenar, i està en el format antic de PyTorch, que `fes_ratllades.py`
  llegeix sense executar res). Al contenidor, buscar triga uns segons i
  esborrar una foto de 900 punts, uns 10.

**L'historial ja no guarda fotos sense límit** (`retallaHistorial`). Ampliar i
esborrar fan una foto nova sencera, i per poder desfer l'historial guarda les
d'abans: amb una foto de 12 megapíxels, cada una són 48 MB, i deu esborrades
deixarien el mòbil sense memòria. Quan les fotos guardades passen de 300 MB
(900 a l'ordinador, `MEMORIA_HIST`), es llencen els passos més vells, i sempre
se'n queden dues (l'actual i la d'abans): desfer l'últim sempre es pot, però
després de moltes esborrades potser ja no es pot tornar a la foto del principi.

**Al mode Ordinador, LaMa.** L'usuari ho va triar de la llista de millores:
un esborrador millor per a forats i taques grosses. **LaMa** («big-lama», de
Samsung, Apache 2.0, 51 milions de números, 99 MB amb mitja precisió, en dos
trossos) és el que es va descartar al principi perquè era massa gros per al
mòbil; ara és el del mode Ordinador (`IA.mode`), i el Mòbil continua amb
MI-GAN. Amb tres fotos de mostra i forats grossos, l'error dins dels forats
va ser de 11,5 contra 20,5 de MI-GAN (sobre 255), i on MI-GAN posava una taca
estranya, LaMa refeia la vora de la tassa.

- **Les dues IA es fan servir pel mateix camí** (`treuAmbIA` i
  `treuPerTrossos`, a 512 × 512); només canvia com se'ls dona el tros i com
  el tornen (`omple512`): MI-GAN, quatre canals de −1 a 1 amb la màscara
  menys 0,5; LaMa, la foto de 0 a 1 i la màscara a part (1 = s'omple).
- **Les transformades de Fourier de LaMa es fan amb matrius.** És el que
  l'omple tan bé (veu tota la foto alhora), però el motor no sap fer-les a la
  gràfica. Com que la mida és fixa (els blocs treballen a 64 × 64), es fan com
  a multiplicacions per les taules de sinus i cosinus (`fes_lama.py`, que
  comprova abans que donen el mateix que numpy).
- **Va més lenta**: al contenidor, sense gràfica, uns segons per tros de 512.
  La targeta i les opcions de l'eina diuen quina IA fa servir cada mode.
- L'historial diu «Esborra amb IA · LaMa» quan és ella.
- El fitxer és el que publica IOPaint a GitHub (TorchScript); `fes_lama.py`
  només en llegeix els pesos, amb el lector de `fes_migan.py`, i munta la
  xarxa com al codi original.

**Tocar l'objecte (MobileSAM).** L'usuari el va triar d'una llista: pintar
el vermell amb el dit és el més pesat al mòbil. A l'eina d'esborrar hi ha un
tercer mode, **«✦ Toca l'objecte»** (`S.mascToca`), i a la targeta, el botó
gros **«✦ Toca el que vols treure»** (`#iaVesToca`); «Pinta el que vols
treure» queda a sota.

- **MobileSAM** (Apache 2.0, 10 milions de números, 24 MB amb mitja
  precisió) són dues xarxes (`ia/conversio/fes_sam.py`): la que **mira la
  foto** (`samMira`, la foto de 1024 normalitzada com SAM; uns segons, una
  vegada per foto: `IA.sam.vistDe`) i la que, amb el punt tocat, **dona el
  contorn** (`samContorn`, de seguida). En dona tres i es queda el que ella
  creu millor (`qualitat`).
- **El contorn es posa com a vermell**: una entrada `ras` amb `obj:true` i la
  `caixa` que ocupa. Es repassa amb «Pinta vermell» i «Treu vermell» com
  qualsevol altre, i cada toc n'afegeix un altre objecte. **No és cap
  ratllada**: «Esborra-ho» el treu com un objecte (un tros al voltant de la
  capsa, `treuAmbIA`), no per trossos de la foto sencera.
- **El toc es mira en aixecar el dit**, i només si no s'ha mogut ni ha arribat
  un segon dit (un zoom no és cap toc; `cancelaTraca` també el llença).
- **El que ha vist es guarda com a números, no com a tensor** (`IA.sam.vist`)
  i a cada toc se'n dona una còpia: sense gràfica, el motor treballa en un
  fil a part i s'emporta el que se li passa. Al principi el segon toc fallava
  (la prova ho va trobar).
- A la prova, sobre la paret de maons amb un objecte blau, un toc n'agafa el
  100% i res de més.

**Com es va fer el model.** Picsart publica MI-GAN en PyTorch, i la versió que
es podia baixar d'aquí és la «TorchScript» (`migan_traced.pt`), que porta el
model escrit a dins en una mena de Python. `ia/conversio/fes_migan.py` el
llegeix **sense executar-lo** (el desmunta amb el mòdul `ast`) i tradueix cada
operació a ONNX; si hi troba res que no coneix, s'atura. Només hi surten peces
que la gràfica sap fer (Conv, ConvTranspose, LeakyRelu, Mul, Add, Clip, Pad).
**Va estar malament la primera vegada**: les constants del codi (el guany √2
de cada capa) són a la carpeta `constants/` del fitxer, no a `data/` amb els
pesos, i llegint-les d'allà sortia un número qualsevol i el model omplia
sempre amb gris llis. Es va veure perquè, mirant capa per capa, tot quedava a
zero després de la primera multiplicació.

## La Cambra Fosca: treure el fons

L'usuari ho va triar d'una llista de millores. És la targeta **Fons** de la pestanya ✦ IA: deixa
sol el que hi ha al davant (una persona, un objecte) i el fons el fa
**transparent**, **blanc**, **d'un color** o **difuminat** (com el mode retrat
del mòbil). Dos models, amb el mateix «On ho fas: Mòbil / Ordinador» de dalt
de la pestanya (`IA.mode`, compartit):

| Mode | Model | Pes | Entrada |
|---|---|---|---|
| Mòbil | U²-Net petit (`u2netp`) | 4,4 MB | 320 × 320 |
| Ordinador | IS-Net (`isnet-fp16`) | 86 MB | 1024 × 1024 |

Coses que no s'han de desfer sense entendre-les:

- **Els models ja eren ONNX** (els del projecte rembg) i `fes_fons.py` només
  hi deixa la primera sortida (els originals en donaven fins a dotze, i
  algunes eren imatges intermèdies de 64 MB) i, a l'IS-Net, desa els pesos
  amb la meitat de precisió: **GitHub no accepta fitxers de més de 100 MB** i
  l'original en fa 178. El resultat canvia menys d'una mil·lèsima, i sense
  les sortides que sobraven va el doble de ràpid.
- **El model diu què és del davant en petit** (`alfaDelDavant`), i el mapa es
  fa gran fins a la mida de la foto amb les vores suaus. Els punts gairebé
  segurs (per sota del 4% o per sobre del 96%) es fan segurs del tot: si no,
  el fons quedava com una boira.
- **El difuminat no deixa aura** (`fonsDifuminat`): es difumina el fons tot
  sol (cada punt pesa el que té de fons) i es divideix pel pes. Difuminant la
  foto sencera, al voltant de la persona quedava una aura del seu color (fins
  a 25 nivells; la prova ho mira a 12 punts de la vora). Es fa a 900 punts
  com a molt i es torna a fer gran, que difuminat no es nota.
- **La foto sense fons passa a ser la foto**, com quan s'esborra o s'amplia,
  i desfer torna a la d'abans.
- **On la foto és transparent, es veu un escaquer** (el fons del `#view`).
- **El JPG no guarda la transparència**: desant en JPG una foto transparent,
  a sota s'hi posa blanc (abans hi sortia negre) i el quadre de Desa ho avisa
  (`teTransparencia`). El ✓ Fet ja diu que per desar-la transparent cal PNG.
- Sense gràfica, al contenidor el model petit triga uns 3 segons i el gran
  uns 15.

## La Cambra Fosca: abans i després

**Mantenint premut «Abans»** (a la barra de dalt, al costat de desfer; o la
tecla `\`), es veu la foto **tal com es va obrir** (`S.original`): sense
ajustos, ni pinzell, ni el que s'hi ha esborrat o ampliat. En deixar-lo
anar, torna la retocada. A dalt a l'esquerra hi diu ABANS.

- **Només canvia el que es veu** (`pintaAbans`, des de `pintaVista`): no toca
  res de la foto ni apunta res a l'historial. Si la foto fa la mateixa forma
  que l'original, queda exactament a sobre; si s'ha retallat o girat, surt
  sencera i centrada.
- **Es fa mantenint premut, no amb un toc**, perquè el que interessa és
  comparar anant i tornant. El botó porta `touch-action:none` i no deixa
  sortir el menú del dit llarg. Un toc curt diu a la ratlla de sota com va.
- `S.original` guarda la foto oberta encara que l'historial l'hagi llençat
  per memòria (és una foto més, no una per pas).

## La Cambra Fosca com a app

L'usuari la va voler **sola, separada de la Revisió, i que es pogués
instal·lar**. No cal cap repositori a part: es pot instal·lar des d'on és, i
instal·lada és una app per si sola, amb la seva icona (el llum taronja de la
cambra fosca amb una lent al mig), que s'obre directament a l'editor, sense
la barra del navegador, sense la portada i també sense connexió.

- **`cambra-fosca.webmanifest`** és la fitxa: nom, icones, colors, i que
  s'obri sola (`display: standalone`) començant a `cambra-fosca.html`.
- **L'abast és `./cambra-fosca`, no tota la carpeta**: així l'app només és la
  Cambra Fosca. Si l'abast fos `/Eines/`, la portada i la Revisió també
  quedarien dins de l'app.
- **`cambra-fosca-sw.js`** és el que la fa anar sense connexió. Es registra
  amb el mateix abast (la Revisió no hi passa), demana sempre primer a la
  xarxa (així sempre és la versió nova) i, si no n'hi ha, treu la còpia
  desada. **No toca els models ni el motor** (`.onnx`, `.wasm`, i els
  trossos dels models partits, `.onnx.1`...): ja els desa l'app mateixa, i
  desats dues vegades ocuparien el doble. Els trossos s'hi colaven fins que
  es va afegir el color: les cares ja ocupaven 167 MB de més. **Cada canvi en un
  dels fitxers de la seva llista, pujar `VERSIO`**, que si no l'app sense
  connexió serviria la vella.
- **El botó INSTAL·LA** (`#btnInstal`) només surt quan el navegador diu que
  es pot (`beforeinstallprompt`: Chrome i Edge). A la resta, l'ajuda explica
  com fer-ho des del menú.
- **Instal·lada, no hi ha l'enllaç «← EINES»**
  (`@media (display-mode: standalone)`): l'app va sola.
- **Les icones**: 192 i 512 per a tot, una de 512 «maskable» amb el dibuix
  dins la zona del mig (el mòbil hi retalla la forma que vol, rodona o
  quadrada) i una de 180 per als iPhone. Es van fer dibuixant-les amb el
  navegador.
- **Chrome no serveix per comprovar si està ben feta**: les versions noves
  deixen «instal·lar» gairebé qualsevol pàgina, i amb una fitxa que l'obria
  com una pàgina normal no s'hi va queixar. Per això la prova mira la fitxa
  ella mateixa.

## La Revisió

L'usuari va demanar una eina que vigilés el mòbil «en pla antivirus», per si
hi havia virus o portes del darrere. **Això no es pot fer amb una pàgina web**,
i no se n'ha de fer cap que ho faci veure: el navegador no deixa veure ni les
apps instal·lades, ni els fitxers, ni res del que corre per sota. Una pàgina
que digués «escanejant... cap virus» seria teatre, i donaria tranquil·litat
sense motiu. L'eina ho diu a la primera pantalla.

El que fa és una **revisió guiada**: tretze comprovacions (`PASSOS`), de la
més important a la que menys, que són les portes per on entra el perill de
debò a un Android. Les mira la persona, que és l'única que hi té accés, i
respon **✓ TOT BÉ**, **⚠ NO ESTÀ BÉ** o **? NO HO SÉ**. Al final, un resum amb
el que cal arreglar, per ordre.

- **L'escaneig de debò és Play Protect**, que ja ve amb Android i sí que pot
  mirar les apps. És la segona comprovació, i l'eina hi envia.
- **Cada comprovació diu per què importa, on es mira, què és normal, què no
  ho és i què s'ha de fer.** Si se n'hi afegeix una, ha de portar les cinc
  coses, i el `pes` (3, 2 o 1) que decideix l'ordre al resum.
- **Els noms dels menús canvien segons la marca del mòbil** (i molta gent el
  té en castellà). Per això cada comprovació porta la paraula que s'ha de
  buscar a la lupa de Configuració, en català i en castellà (`cerca`). Sense
  això, a mig camí ja no trobes el menú.
- **El pedaç de seguretat es jutja per la data que hi posa la persona**, no
  per la versió d'Android: fins a 3 mesos, bé; fins a 12, endarrerit; més,
  malament (`PEDAC_BE`, `PEDAC_MAL`). La data no es fa vella; una llista de
  versions «bones», sí.
- **`ANDROID_MORT` s'ha de repassar un cop l'any.** És l'última versió
  d'Android que ja no rep pedaços de Google (la 12, des del març del 2025).
  Només s'avisa de les que és segur que no en reben; de les altres no es diu
  res.
- **El Chrome d'ara diu sempre «Android 10; K»**, sigui quina sigui la
  versió. La de debò es demana a part (`userAgentData`), i aquell 10 no es té
  en compte: si no, a tothom li sortiria que té un Android vell.
- **Tot es desa en aquest mòbil i no s'envia res** (`revisio-actual`, i
  `revisio-historial` amb la data i els tres números de cada revisió acabada,
  per comparar amb la del mes passat). L'única cosa que surt a fora és un
  enllaç a la revisió de seguretat de Google, que obre la persona tocant-lo, i
  l'eina ho diu.
- **Una revisió surt una sola vegada a l'historial**: si des del resum tornes
  a una comprovació i la canvies, s'actualitza la mateixa fila.
- **Començar de nou és petit i pregunta abans**, que esborra el que portes.
- **El botó que es prem gairebé sempre (TOT BÉ) va sol i gros; els altres
  dos, a sota i més petits.** Va sortir aixafat en una ratlla: el peu és una
  columna i, amb `flex:1 1 0`, l'alçada li quedava a zero. La prova el tocava
  igualment i no ho veia; ara mira que cap botó faci menys de 40 px d'alt.

És per a Android. Si algun dia es fa per a iPhone, són unes altres
comprovacions i uns altres menús: una llista a part, no la mateixa amb retocs.

## Disposició: les trampes

Les mateixes que al repositori dels jocs, i ja ens han mossegat allà:

- **`100vh` no és l'alçada visible al mòbil.** Compta l'espai de la barra del
  navegador, així que és més alt del que es veu. Aquí s'usa `height:100%` a
  `html` i `body`, i el coixí de les barres del sistema va al `:root`
  (`env(safe-area-inset-*)`).
- **Tot ha de cabre a 320 px.** Comprovar-ho sempre a 320, 360 i 390. A la
  Cambra Fosca la barra de dalt no hi cabia en una filera: a partir de 760 px
  es parteix en dues (a dalt, tornar enrere, el nom i DESA; a sota, obrir,
  desfer i el zoom) i les dreceres de teclat desapareixen, que amb el dit no
  serveixen de res. A 400 px les eines de la tira es fan més petites.
- **Un botó que et pot perjudicar no pot tocar el que prems sempre**, i va a
  l'altra punta de la filera i més petit.
- **Tot el que s'arrossega amb el dit porta `touch-action:none`**, que si no
  el navegador s'emporta el gest per desplaçar la pàgina. Va passar amb el
  marc del retall: arrossegant un tirador amunt o avall, la pàgina es movia i
  el marc es quedava a mig camí (es movia 20 px de 60). El llenç ja el
  portava; el retall, no. Al mòbil, a més, els tiradors fan 20 px i tenen una
  zona invisible al voltant per al dit (44 px en total): de 13 px no hi havia
  manera d'encertar-los.
- **Un sol tema, el fosc.** A la Cambra Fosca és a posta: els tons d'una
  fotografia es jutgen amb un voltant fosc i neutre. Qui vulgui mirar-la sobre
  blanc té els tres fons de taula a les opcions de l'eina Mou.

## Com es prova

`node prova.mjs` (cal Playwright; al contenidor és a
`/opt/node22/lib/node_modules/playwright`). Obre les pàgines amb un navegador
de debò i comprova:

- **la portada**: que no vessi a 320, 360, 390, 768 i 1280 px, que cada fitxa
  porti a un fitxer que existeix, que les captures es vegin i que no salti cap
  error;
- **la Cambra Fosca**: que no vessi a cap d'aquelles mides, que no salti cap
  error, que els filtres, els controls d'ajust, el pinzell, el retall, desfer
  i refer i l'historial facin el que han de fer, i que el botó de desar generi
  el fitxer de debò;
- **el retall amb el dit**, amb un mòbil simulat i un dit de debò (no el
  ratolí): que arrossegant el tirador de baix 60 px el marc s'escurci 60 px,
  que arrossegant el marc es mogui el que toca, que la pàgina no es desplaci,
  i que els tiradors siguin prou grossos. Es va comprovar que la prova falla
  sense el `touch-action:none`;
- **el tampó de clonar**, amb el dit: que el primer toc fixi l'origen sense
  pintar, que pintant al verd amb l'origen al vermell hi surti vermell (i
  res fora d'on ha passat el dit), que la creueta torni a l'origen i que
  «Tria l'origen» el canviï. Amb el signe d'abans, la prova falla;
- **arreglar les cares** (també serveix el repositori ella mateixa): sobre
  una cara dibuixada i borrosa (no es fa servir la foto de ningú; RetinaFace
  la veu segura al 99%), que la trobi i la torni més nítida, que els ulls
  continuïn on eren, que la resta de la foto no canviï, que desfer la torni,
  que «Suau» la canviï menys que «Fort», i que en una foto sense cares ho
  digui i no hi toqui. Es va comprovar que falla tornant la cara amb el gir
  d'anada, sense la força o amb els cinc punts mal descodificats;
- **la pestanya Mida**: que Desa ja no tingui la mida i digui on és; que la
  resolució sola no canviï els punts (i desfer la torni); que en mm la foto
  faci els que toca a 300 ppp, que posant 300 mm d'ample l'alt surti
  proporcional (i escrivint l'alt, l'ample), que avisi que quedarà tova i
  ofereixi la IA; que Aplica la deixi als punts justos, que s'apunti, que el
  PNG desat faci aquells punts i porti 300 ppp escrits (amb la suma de
  control bona i una sola vegada) i que desfer la torni; en cm a 150 ppp, el
  JPG també; que una mida massa gran no es pugui aplicar; i que a 320 px les
  cinc pestanyes hi càpiguen. Es va comprovar que falla si el fitxer no porta
  la resolució triada, i va trobar que després de desfer una resolució les
  caselles en deien una altra;
- **els menús**: que les pestanyes siguin Ajustos · Filtres · ✦ IA · Mida ·
  Historial; que a ✦ IA hi hagi les targetes per ordre, només una
  d'oberta (i que tornant-la a tocar es tanqui), un sol «On ho fas» que
  segueixen el fons i l'amplia; que «Pinta el que vols treure» posi la
  vareta; que Endreça i les cares ja no siguin a Ajustos i Endreça sigui al
  Retalla; i que a 320 px les targetes hi càpiguen;
- **soroll i borrós** (també serveix el repositori ella mateixa): sobre una
  foto dibuixada amb soroll, que «Treu el soroll» la deixi a menys de la
  meitat de diferència amb la neta, que «Suau» quedi entre mig, que funcioni
  amb una foto més petita que un tros, que desfer la torni i que la segona
  vegada no es baixi res; i sobre la mateixa desenfocada, que «Fes-la més
  nítida» l'acosti a la neta. La mida no ha de canviar. Es va comprovar que
  falla sense els trossos fixos, sense la força o si el borrós no torna el
  tros a la seva mida;
- **posar color** (també serveix el repositori ella mateixa): sobre un
  paisatge dibuixat i passat a grisos, que hi posi color, que el cel quedi
  blau, que la claredat de cada punt sigui la d'abans, que surti a
  l'historial i digui «✓ Color posat», que desfer torni els grisos, que
  «Suau» deixi la meitat de color, que la segona vegada no torni a baixar
  res, i que avisi si la foto ja té colors però no si és sèpia. Es va
  comprovar que falla amb a i b girats, sense la força, amb la claredat mal
  calculada o si la sèpia compta com a color;
- **arregla la foto**: es fa una foto «bona» (cel, paret grisa, un full
  blanc, objectes de color) i s'espatlla de cinc maneres (fosca, cremada,
  groga, blava, i fosca i groga). «Arregla-la sola» ha de deixar la bona com
  era, millorar clarament les de llum, reduir el tint de les de color a menys
  de la meitat sense passar a l'altre cantó, dir-ho amb paraules, donar el
  mateix si es prem dues vegades i no tocar el color de la posta de sol de
  mostra. Endreça: que la vista prèvia giri sense tocar la foto, que Cancel·la
  ho desfaci, i que un horitzó tort 5° quedi recte amb la mida que toca. Es va
  comprovar que la prova falla si el vet del color va al revés o si endreça
  cap a l'altre costat;
- **ampliar amb IA** (aquesta part serveix el repositori ella mateixa, que el
  motor es llegeix amb `fetch` i des de file:// no es pot): que les quatre
  pestanyes hi càpiguen, els límits de cada mode, el model lleuger per 4, que
  el resultat s'assembli a la foto (ni soroll ni colors canviats), desfer i
  refer, que la segona vegada no torni a baixar res, que aturar a mig fer
  deixi la foto com era, i el model gran per 4 amb una foto petita. També:
  que en acabar surti «✓ Feta» el primer, amb la mida; que amb una feina
  llarga surti la pregunta (amb el temps i el consell del model del mòbil, i
  el percentatge a la pestanya) i que «Atura» deixi la foto com era; i que
  l'avís de «no hi cap» digui que la foto ja és molt gran quan ho és, sense
  cap frase en minúscula; que el «✓ Feta» digui amb què s'ha fet; i que cap
  model porti peces que la gràfica no sap fer (PRelu). Es va comprovar que la
  prova falla si es canvien els colors, si el botó d'aturar no atura, si
  l'avís torna a començar una frase en minúscula o amb el model lleuger vell.
  I més gran amb IA des de la pestanya Mida: que l'Amplia ja no tingui «A
  mida», que no s'ofereixi la IA per fer-la més petita, que avisi quan cal
  estirar, que a 10 mm amplii per 2 i deixi la foto als punts justos (amb la
  mida a l'historial i al «✓ Feta»), i que després la pestanya Mida digui 10
  mm a 300 ppp. Es va comprovar (quan era a l'Amplia) que falla sense
  deixar-la a la mida justa o si el model sempre fa ×4.
- **esborrar coses amb el dit**, amb un mòbil simulat i un dit de debò (també
  serveix el repositori ella mateixa): que la tira d'eines, amb l'eina nova,
  hi càpiga a 320 px; que «Esborra-ho» no es pugui prémer sense vermell; que
  pintant amb el dit la pàgina no es desplaci i el vermell es vegi; que el
  vermell no surti al fitxer desat; que «Neteja el vermell» i canviar d'eina
  el treguin; i que, sobre una paret de maons amb un objecte vermell, l'objecte
  desaparegui, hi quedi paret amb maons (no una taca llisa) i **la resta de la
  foto no canviï ni un nivell**; desfer i refer; i el mateix amb una foto de
  1.600 px, més gran que el model. Es va comprovar que la prova falla amb la
  màscara al revés, enganxant el tros sencer, sense el vermell a la pantalla i
  si canviar d'eina no el treu. Al mode Ordinador, el mateix amb LaMa
  (l'objecte fora, paret amb maons, la resta intacta, «· LaMa» a
  l'historial, dos trossos baixats i la segona vegada cap). Tocant
  l'objecte (MobileSAM): que el botó de la targeta posi el mode, que digui
  quant es baixa, que un toc agafi l'objecte blau sencer (95% o més) i poca
  paret (15% com a molt), que «Esborra-ho» el tregui sense tocar la resta, i
  que un altre toc, després de desfer, torni a anar sense baixar res (va
  trobar que el segon toc fallava). A més: la goma del vermell (treu on passa i
  no enlloc més; si ho treu tot, no es fa res i es diu), el zoom amb dos dits
  sense que en quedi cap ratlla (amb el vermell i amb el pinzell), que el
  botó que sura surti sencer al mòbil i no a l'ordinador, i que mantenint
  premut «Abans» es vegi l'objecte esborrat i deixant-lo anar ja no, sense
  apuntar res a l'historial. Es va comprovar que falla si la goma pinta, si
  el segon dit no llença la ratlla, si «Abans» no ensenya res o si el botó
  no sura;
- **trobar i esborrar ratllades** (també serveix el repositori ella mateixa):
  sobre una foto vella feta a mida (sepia, muntanyes, una casa, gra) amb tres
  ratllades clares i un plec, que la IA en marqui almenys el 70% i no marqui
  res on no n'hi ha (menys del 0,05%); que la goma en protegeixi un tros (que
  no s'esborra); que a les marcades la foto s'acosti a la neta (a menys d'un
  quart de la diferència d'abans) sense tocar la resta; i desfer. Es va
  comprovar que falla amb la foto mal preparada per a la IA, sense dibuixar el
  vermell de la IA a la màscara o enganxant el tros sencer;
- **treure el fons** (també serveix el repositori ella mateixa): sobre un
  gerro blau d'una foto feta a mida, que encerti el gerro (mirant un punt de
  cada 6, fora de la vora) amb el model petit i amb el gran; transparent,
  blanc i d'un color; que desant en JPG el fons surti blanc i ho avisi, i en
  PNG transparent; desfer; i que el difuminat difumini el fons, no toqui el
  gerro i no hi deixi aura. Es va comprovar que falla amb el mapa al revés,
  difuminant amb el gerro inclòs, sense difuminar o amb el JPG sense blanc;
- **com a app**: la fitxa (que s'obri sola, que comenci a la Cambra Fosca,
  que l'abast no agafi tota la carpeta, el nom i els colors, i que les icones
  hi siguin i facin la mida que diuen, amb una de «maskable»), que el programa
  de sense connexió s'ocupi de la Cambra Fosca i no de la Revisió, que sense
  xarxa l'editor s'obri igual, que no desi els trossos dels models, i que el
  botó INSTAL·LA hi càpiga a 320 px. Es
  va comprovar que la prova falla amb una fitxa que l'obre com una pàgina
  normal, o sense la icona «maskable»;
- **la Revisió**: que no vessi, i feta sencera amb el dit a 320 px: que el
  pedaç no deixi continuar sense data i jutgi bé una data bona i una de
  vella, que enrere torni on eres, que les tretze comprovacions arribin al
  resum amb els números que toquen, que es desi i es reprengui on era, que
  des del resum es pugui arreglar una comprovació sense apuntar-la dues
  vegades, que començar de nou pregunti, que compari amb la revisió d'abans,
  i que a cada pantalla els botons hi càpiguen, sencers i sense aixafar.

Si es toca res del tractament de píxels o de la disposició, aquesta prova és la
primera cosa que s'ha de mirar.

## Com treballa l'usuari

**Aquí i al codi no s'escriu el seu nom**: es diu «l'usuari». El repositori és
públic. Tampoc no s'hi escriuen correus ni res personal.

Fa servir el mòbil gairebé sempre i no és programador: les explicacions han de
dir què s'ha de tocar i per què, sense donar per suposat cap terme tècnic. Tot
en català, comentaris del codi inclosos. Els commits també, i expliquen **què
passava**, no només què s'ha tocat. Quan alguna cosa falla, primer
reproduir-la i després arreglar-la.
