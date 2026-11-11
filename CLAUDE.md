# Eines

Eines petites que funcionen dins del navegador, en català i pensades per al
mòbil. **Cada eina és un sol fitxer** HTML autocontingut, sense cap llibreria,
sense cap servidor i sense cap dependència: s'obre i funciona.

- Publicat a: https://oscarbellosido.github.io/Eines/
- **El que hi posa qui la fa servir no surt mai del seu aparell.** No hi ha
  servidor, ni enviaments, ni estadístiques. Si algun dia cal afegir res que
  hagi de sortir a fora, s'ha de preguntar abans.
- És el germà del repositori dels jocs (`Jocs`), amb les mateixes normes i les
  mateixes trampes ja apreses. Aquí no hi van jocs, i allà no hi van eines.

## Les eines

| Fitxer | Nom a la web | Què fa | Any |
|---|---|---|---|
| `cambra-fosca.html` | La Cambra Fosca | Retoca fotografies | 2026 |

## Estructura

```
index.html            la portada, amb una fitxa per eina
cambra-fosca.html     l'editor de fotografies
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

**La imatge d'exemple.** En obrir-se no hi ha cap foto, i una pàgina buida no
ensenya res del que sap fer. Per això es pinta sola una escena (`makeSample`):
cel de posta, serralades, aigua amb reflex, gra i cantonades fosques. No és cap
fotografia baixada d'enlloc —seria pes i drets d'autor—, surt sempre igual (la
llavor és fixa) i té de tot perquè tots els ajustos s'hi notin: si el cel fos
llis, la vinyeta i el gra no es veurien.

**Desar la imatge.** A la web funciona la baixada normal del navegador
(`desaFitxer`). La pàgina també es pot publicar com a *artifact* de claude.ai,
i allà el navegador no deixa que una pàgina es baixi res ella mateixa: s'ha de
demanar a la plataforma (`claude.use('downloads')`). Es prova primer la
plataforma i, si no hi és, l'enllaç de tota la vida. **Si es toca una de les
dues bandes, s'ha de comprovar l'altra.**

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
  el fitxer de debò.

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
