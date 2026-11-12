# Eines

Eines petites que funcionen dins del navegador, en català i pensades per al
mòbil. **Cada eina és un sol fitxer** HTML autocontingut, sense cap llibreria,
sense cap servidor i sense cap dependència: s'obre i funciona. L'única excepció
és la carpeta `ia/`, que fan servir l'ampliació i l'esborrat amb IA de La Cambra Fosca (més avall).

- Publicat a: https://oscarbellosido.github.io/Eines/
- **El que hi posa qui la fa servir no surt mai del seu aparell.** No hi ha
  servidor, ni enviaments, ni estadístiques. Si algun dia cal afegir res que
  hagi de sortir a fora, s'ha de preguntar abans.
- És el germà del repositori dels jocs (`Jocs`), amb les mateixes normes i les
  mateixes trampes ja apreses. Aquí no hi van jocs, i allà no hi van eines.

## Les eines

| Fitxer | Nom a la web | Què fa | Any |
|---|---|---|---|
| `cambra-fosca.html` | La Cambra Fosca | Retoca, arregla, esborra coses i amplia fotografies | 2026 |
| `revisio.html` | La Revisió | Repassa la seguretat d'un mòbil Android | 2026 |

## Estructura

```
index.html            la portada, amb una fitxa per eina
cambra-fosca.html     l'editor de fotografies
revisio.html          la revisió de seguretat del mòbil
ia/                   el motor i els models de la IA: ampliar i esborrar (vegeu ia/LLEGEIX.md)
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

**Desar a una mida en mil·límetres.** L'usuari va demanar poder dir «300 mm
d'ample» i que l'alt es fes sol. És al quadre de **Desa**: ample × alt en
**px, mm o cm**, sempre proporcional (escrivint un, l'altre es calcula; per
una altra forma, primer es retalla), i en mm o cm, la **resolució** (300 ppp
de partida, la normal per imprimir). Els botons Com és · 50% · 25% hi són
igual.

- **Els mil·límetres no existeixen sense resolució**: una foto només té
  píxels. 300 mm a 300 ppp són 3.543 px. El quadre diu sempre de quants
  píxels farà el fitxer i quant farà imprès.
- **El fitxer porta escrita la resolució** (`posaPPP`): el navegador no ho
  fa, i sense això el programa que imprimeix suposa 72 o 96 ppp i la foto de
  300 mm surt d'un metre. Al PNG és un tros `pHYs` (punts per metre, amb la
  seva suma de control, `crc32`); al JPG, la capçalera JFIF (punts per
  polzada; si no n'hi ha, se n'hi posa una). Al WEBP no hi ha manera
  senzilla i el quadre ho diu. En píxels no s'hi escriu res.
- **Si la mida és més gran que la foto, avisa en taronja**: s'estirarà i
  quedarà tova, a quants ppp sortiria amb els píxels que té, i que es pot
  ampliar abans amb IA.
- **Massa gran per a l'aparell, no es deixa desar** (`MAX_DESA_MP`: 40
  megapíxels al mòbil, 150 a l'ordinador, i mai més de 16.384 px per costat,
  que és el que deixen fer els navegadors), i diu per què.
- **La unitat i la resolució es recorden** en aquest aparell
  (`cambra-fosca-mida`); la mida no, que cada foto és diferent.
- Els números s'escriuen amb coma (`127,5`) i s'accepten amb coma o punt.
- **Des de l'avís, «Amplia-la a aquesta mida amb IA»** (`#expAmplia`) tanca
  el quadre i obre l'Amplia «A mida» amb aquells mil·límetres ja posats. El
  botó es fa **una sola vegada** i només s'amaga o s'ensenya: al principi es
  refeia a cada canvi, i en tocar-lo la casella perdia el cursor, el quadre
  es tornava a pintar i el botó de sota el dit ja era un altre (el toc es
  perdia, i la prova ho va trobar).

**Desar la imatge.** A la web funciona la baixada normal del navegador
(`desaFitxer`). La pàgina també es pot publicar com a *artifact* de claude.ai,
i allà el navegador no deixa que una pàgina es baixi res ella mateixa: s'ha de
demanar a la plataforma (`claude.use('downloads')`). Es prova primer la
plataforma i, si no hi és, l'enllaç de tota la vida. **Si es toca una de les
dues bandes, s'ha de comprovar l'altra.**

## La Cambra Fosca: arregla la foto

L'usuari va preguntar si es podien arreglar fotos mal fetes «com fa ChatGPT».
El que fa ChatGPT (entendre la foto i tornar-la a pintar: «treu la gent del
fons») és un model enorme que corre als seus servidors i no es pot fer a
l'aparell. Es van proposar tres coses que sí: un botó que arregla sol la
claredat i el color, esborrar coses amb una IA (LaMa, uns 200 MB) i arreglar
cares (GFPGAN, uns 350 MB). L'usuari va triar començar per la primera. A dalt
del panell d'ajustos hi ha **Arregla la foto**, amb dues coses:

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

**Endreça** (`aplicaEndreca`): un control de −15° a +15° per redreçar una foto
torta. Mentre es mou, **només gira la imatge de la pantalla** (CSS), amb una
reixa al damunt per veure-hi les rectes; la foto no es toca fins a **Aplica**,
que si no cada retoc la tornaria a passar pel girat i la perdria. En
aplicar-ho, la foto es retalla el just perquè no quedin cantonades buides, amb
la mateixa forma (`escalaEndreca`), i passa a ser la foto, com quan s'amplia:
les pinzellades giren amb ella i desfer la torna com era. Qualsevol altra cosa
que facis amb la foto mentre el control és mogut el cancel·la.

## La Cambra Fosca: ampliar amb IA

L'usuari va demanar poder ampliar una foto guanyant qualitat, com fa Upscayl,
i que hi hagués **dues opcions: una per al mòbil i una per a l'ordinador**, que
té molta més capacitat. És la pestanya **Amplia**. Fa servir les mateixes
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

**«A mida (mm)»**: a més de ×2 i ×4, es pot dir l'ample que es vol, en mm, cm
o px, i la resolució. L'usuari ho va demanar perquè, desant a 300 mm, l'eina
li deia que l'ampliés primer i a l'Amplia només hi havia ×2 i ×4.

- **El model sempre fa ×2 o ×4** (`plaAmplia`): el primer que n'hi ha prou, i
  després la foto es deixa a la mida justa (una reducció normal, de bona
  qualitat). Si cal més de 4 vegades, o si en aquest mode ×4 no cap a la
  memòria i es fa ×2, la resta s'estira a la manera normal, i el panell ho
  diu (i, al mòbil, que amb el mode Ordinador ho faria tot el model).
- Si la mida demanada ja és la de la foto o més petita, no deixa ampliar i
  diu que n'hi ha prou de posar els mil·límetres en desar.
- **La unitat i la resolució són les mateixes del quadre de Desa**
  (`cambra-fosca-mida`), i en acabar s'hi desen: desant, la foto ja surt a
  300 mm sense tocar res.
- **Les caselles es tornen a calcular a cada tecla sense refer el panell**
  (`pintaMidaAmp`), que si no perdrien el cursor mentre escrius.

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

**L'historial ja no guarda fotos sense límit** (`retallaHistorial`). Ampliar i
esborrar fan una foto nova sencera, i per poder desfer l'historial guarda les
d'abans: amb una foto de 12 megapíxels, cada una són 48 MB, i deu esborrades
deixarien el mòbil sense memòria. Quan les fotos guardades passen de 300 MB
(900 a l'ordinador, `MEMORIA_HIST`), es llencen els passos més vells, i sempre
se'n queden dues (l'actual i la d'abans): desfer l'últim sempre es pot, però
després de moltes esborrades potser ja no es pot tornar a la foto del principi.

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
  desada. **No toca els models ni el motor** (`.onnx`, `.wasm`): ja els desa
  l'app mateixa, i desats dues vegades ocuparien el doble. **Cada canvi en un
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
- **desar a mida**: en mil·límetres, la foto fa els que toca a 300 ppp;
  posant 300 mm d'ample l'alt surt proporcional, i escrivint l'alt, l'ample;
  avisa que quedarà tova; el PNG fa els píxels que toca i porta 300 ppp
  escrits (amb la suma de control bona i una sola vegada); en cm a 150 ppp,
  el JPG també; es recorda la unitat; una mida massa gran no es deixa desar;
  i a 320 px el quadre hi cap. Es va comprovar que falla sense escriure la
  resolució, amb l'alt que no mana, amb la unitat del JPG malament o amb la
  suma de control del PNG malament;
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
  I «A mida»: que comenci en mm a 300 ppp, que no deixi ampliar a una mida
  més petita que la foto, que avisi quan cal estirar, que a 10 mm amplii per
  2 i deixi la foto als píxels justos (amb la mida a l'historial i al «✓
  Feta»), que desant ja surti a 10 mm, i que el botó de l'avís de «Desa»
  porti a l'Amplia amb la mida posada (i no surti quan no cal). Es va
  comprovar que falla sense deixar-la a la mida justa, si el model sempre fa
  ×4 o si no es desa la unitat en acabar.
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
  si canviar d'eina no el treu. A més: la goma del vermell (treu on passa i
  no enlloc més; si ho treu tot, no es fa res i es diu), el zoom amb dos dits
  sense que en quedi cap ratlla (amb el vermell i amb el pinzell), que el
  botó que sura surti sencer al mòbil i no a l'ordinador, i que mantenint
  premut «Abans» es vegi l'objecte esborrat i deixant-lo anar ja no, sense
  apuntar res a l'historial. Es va comprovar que falla si la goma pinta, si
  el segon dit no llença la ratlla, si «Abans» no ensenya res o si el botó
  no sura;
- **com a app**: la fitxa (que s'obri sola, que comenci a la Cambra Fosca,
  que l'abast no agafi tota la carpeta, el nom i els colors, i que les icones
  hi siguin i facin la mida que diuen, amb una de «maskable»), que el programa
  de sense connexió s'ocupi de la Cambra Fosca i no de la Revisió, que sense
  xarxa l'editor s'obri igual, i que el botó INSTAL·LA hi càpiga a 320 px. Es
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
