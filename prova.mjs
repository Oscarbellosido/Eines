// Comprova les Eines: la portada i cada eina. Obre les pàgines amb un
// navegador de debò i mira que no vessin a cap mida, que no salti cap error de
// JavaScript i que les eines facin el que han de fer.
//
//   node prova.mjs

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { resolve, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const fitxer = n => 'file://' + resolve(AQUI, n);

// Les mides de sempre: el mòbil més estret que es fa servir, dos de corrents,
// una tauleta i un ordinador.
const MIDES = [320, 360, 390, 768, 1280];

const problemes = [];
const errors = [];

function vigila(pagina, on) {
  pagina.on('pageerror', e => errors.push(`${on}: ${e.message}`));
  pagina.on('console', m => { if (m.type() === 'error') errors.push(`${on}: ${m.text()}`); });
}

// Mira que una pàgina no se surti de la pantalla a cap mida.
async function noVessa(navegador, nom, extra) {
  for (const ample of MIDES) {
    const p = await navegador.newPage({ viewport: { width: ample, height: 740 } });
    vigila(p, `${nom} a ${ample}px`);
    await p.goto(fitxer(nom));
    await p.waitForTimeout(1800);
    const r = await p.evaluate(() => ({
      pagina: document.documentElement.scrollWidth,
      finestra: document.documentElement.clientWidth,
    }));
    const vessa = r.pagina > r.finestra + 1;
    if (vessa) problemes.push(`${nom} vessa a ${ample}px (${r.pagina} de ${r.finestra})`);
    let diu = '';
    if (extra) diu = await extra(p, ample) || '';
    console.log(`${vessa ? '✗' : '✓'} ${nom.padEnd(20)} ${String(ample + 'px').padEnd(7)} ${r.pagina}/${r.finestra} ${diu}`);
    await p.close();
  }
}

const navegador = await chromium.launch();

// ------------------------------------------------------------------ portada
await noVessa(navegador, 'index.html', async (p, ample) => {
  const r = await p.evaluate(() => ({
    fitxes: [...document.querySelectorAll('a.eina')].map(a => ({
      href: a.getAttribute('href'),
      nom: a.querySelector('b')?.textContent.trim() || '',
      descripcio: a.querySelector('span')?.textContent.trim() || '',
    })),
    // una captura que no ha carregat té naturalWidth 0
    trencades: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).length,
    titols: document.querySelectorAll('h2').length,
  }));
  if (!r.fitxes.length) problemes.push('la portada no té cap fitxa');
  if (r.trencades) problemes.push(`a la portada hi ha ${r.trencades} captures que no es veuen (${ample}px)`);
  if (!r.titols) problemes.push('la portada no té cap apartat');
  for (const f of r.fitxes) {
    if (!f.href || !existsSync(resolve(AQUI, f.href)))
      problemes.push(`la fitxa «${f.nom}» porta a ${f.href}, que no existeix`);
    if (!f.nom) problemes.push('hi ha una fitxa sense nom');
    if (!f.descripcio) problemes.push(`la fitxa «${f.nom}» no diu què fa l'eina`);
  }
  return `${r.fitxes.length} eina(es)`;
});

// ------------------------------------------------------- la Cambra Fosca
await noVessa(navegador, 'cambra-fosca.html', async p => {
  const r = await p.evaluate(() => ({
    barra: document.querySelector('.topbar').scrollWidth,
    barraCap: document.querySelector('.topbar').clientWidth,
    eines: document.querySelectorAll('.tool').length,
    tornar: !!document.querySelector('a.back'),
    mides: document.querySelector('#stDims').textContent,
  }));
  if (r.barra > r.barraCap + 1) problemes.push(`la barra de dalt de la Cambra Fosca vessa (${r.barra} de ${r.barraCap})`);
  if (r.eines !== 7) problemes.push(`la Cambra Fosca té ${r.eines} eines i n'ha de tenir 7`);
  if (!r.tornar) problemes.push('la Cambra Fosca no té l\'enllaç de tornada a la portada');
  return `barra ${r.barra}/${r.barraCap} · ${r.mides}`;
});

// que es pugui editar de debò
const p = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
vigila(p, 'editant');
await p.goto(fitxer('cambra-fosca.html'));
await p.waitForTimeout(1800);

const abans = await p.evaluate(() => document.querySelector('#view').toDataURL().length);
if (abans < 5000) problemes.push('la imatge d\'exemple no s\'ha pintat');

await p.click('#tab-fil');
await p.waitForTimeout(800);
const miniatures = await p.evaluate(() => document.querySelectorAll('#fgrid .fcard').length);
if (miniatures !== 10) problemes.push(`hi ha ${miniatures} filtres i n'hi ha d'haver 10`);
await p.click('#fc-cinema');
await p.waitForTimeout(700);
const ambFiltre = await p.evaluate(() => document.querySelector('#view').toDataURL().length);
if (ambFiltre === abans) problemes.push('el filtre no ha canviat la imatge');

await p.click('#tab-adj');
await p.evaluate(() => {
  const r = document.querySelector('#sl-exposure');
  r.value = 30;
  r.dispatchEvent(new Event('input', { bubbles: true }));
  r.dispatchEvent(new Event('change', { bubbles: true }));
});
await p.waitForTimeout(600);
if (await p.evaluate(() => document.querySelector('#view').toDataURL().length) === ambFiltre)
  problemes.push('l\'exposició no ha canviat la imatge');

// el pinzell, arrossegant el dit de debò
await p.keyboard.press('b');
const caixa = await p.locator('#view').boundingBox();
await p.mouse.move(caixa.x + 100, caixa.y + 100);
await p.mouse.down();
for (let i = 0; i < 12; i++) await p.mouse.move(caixa.x + 100 + i * 20, caixa.y + 110 + Math.sin(i / 2) * 30);
await p.mouse.up();
await p.waitForTimeout(500);

// El retall ha de fer la imatge més petita, i desfer l'ha de tornar. S'ha
// d'arrossegar el tirador de debò: movent el marc amb CSS, el joc no se
// n'assabenta i el retall surt igual que abans (ens hi vam encallar).
const midaAbans = await p.evaluate(() => document.querySelector('#stDims').textContent);
await p.keyboard.press('c');
await p.waitForTimeout(400);
const tirador = await p.locator('#cropBox .h.se').boundingBox();
await p.mouse.move(tirador.x + tirador.width / 2, tirador.y + tirador.height / 2);
await p.mouse.down();
await p.mouse.move(tirador.x - 160, tirador.y - 100, { steps: 10 });
await p.mouse.up();
await p.waitForTimeout(200);
await p.keyboard.press('Enter');
await p.waitForTimeout(800);
const retallat = await p.evaluate(() => document.querySelector('#stDims').textContent);
if (retallat === midaAbans) problemes.push('el retall no ha canviat la mida de la imatge');
await p.keyboard.press('Control+z');
await p.waitForTimeout(500);
const desfet = await p.evaluate(() => document.querySelector('#stDims').textContent);
if (desfet !== midaAbans) problemes.push(`desfer no ha tornat la mida (${desfet} en lloc de ${midaAbans})`);
await p.keyboard.press('Control+Shift+z');
await p.waitForTimeout(500);

const historial = await p.evaluate(() => [...document.querySelectorAll('.hitem span')].map(n => n.textContent));
const falten = ['Obre exemple.png', 'Filtre: Cinema', 'Exposició +30', 'Pinzellada']
  .filter(pas => !historial.includes(pas));
for (const pas of falten) problemes.push(`a l'historial hi falta «${pas}»`);
console.log(`${falten.length ? '✗' : '✓'} historial: ${historial.join(' · ')}`);

// desar ha de generar el fitxer
await p.click('#btnSave');
await p.waitForTimeout(400);
const baixada = p.waitForEvent('download', { timeout: 15000 }).catch(() => null);
await p.click('.dlg .btn.primary');
const desat = await baixada;
if (!desat) problemes.push('el botó de desar no ha generat cap fitxer');
console.log(`${desat ? '✓' : '✗'} desar: ${desat ? desat.suggestedFilename() : 'no s\'ha baixat res'}`);
await p.close();

// --------------------------------------------------------------- la Revisió
await noVessa(navegador, 'revisio.html', async p => {
  const r = await p.evaluate(() => ({
    comenca: !!document.querySelector('#comenca'),
    tornar: !!document.querySelector('a.back'),
    aparell: document.querySelectorAll('#aparell dt').length,
  }));
  if (!r.comenca) problemes.push('la Revisió no té el botó de començar');
  if (!r.tornar) problemes.push('la Revisió no té l\'enllaç de tornada a la portada');
  if (r.aparell < 3) problemes.push('la Revisió no diu què veu del mòbil');
  return '';
});

// Es fa sencera amb el dit, al mòbil més estret, i a cada pantalla es mira que
// els botons hi càpiguen i que no se'n talli el text.
{
  const ctx = await navegador.newContext({
    viewport: { width: 320, height: 600 }, hasTouch: true, isMobile: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  });
  const r = await ctx.newPage();
  vigila(r, 'revisió');
  await r.goto(fitxer('revisio.html'));
  await r.waitForTimeout(700);
  const abansDe = problemes.length;
  const text = sel => r.evaluate(s => document.querySelector(s)?.textContent.trim() ?? null, sel);
  const hiCap = async on => {
    const v = await r.evaluate(() => ({
      pagina: document.documentElement.scrollWidth > innerWidth + 1,
      tallats: [...document.querySelectorAll('#peu .bt')].filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent),
      fora: [...document.querySelectorAll('#peu .bt')].filter(b => b.getBoundingClientRect().right > innerWidth + 1).length,
      // un botó aixafat es pot tocar igualment amb la prova, però no amb el dit
      aixafats: [...document.querySelectorAll('#peu .bt')].filter(b => b.getBoundingClientRect().height < 40).map(b => b.textContent),
    }));
    if (v.aixafats.length) problemes.push(`a la Revisió hi ha un botó aixafat (${on}): ${v.aixafats.join(', ')}`);
    if (v.pagina) problemes.push(`la Revisió vessa a 320px (${on})`);
    if (v.tallats.length) problemes.push(`a la Revisió es talla el text d'un botó (${on}): ${v.tallats.join(', ')}`);
    if (v.fora) problemes.push(`a la Revisió un botó surt de la pantalla (${on})`);
  };
  const any = new Date().getFullYear();

  await hiCap('entrada');
  await r.tap('#comenca');
  if (await text('#onvas') !== '1 de 13') problemes.push('la Revisió no comença pel pas 1 de 13: ' + await text('#onvas'));

  // el pedaç: sense data no es pot continuar; una d'ara és bona i una de fa dos anys, dolenta
  if (!await r.evaluate(() => document.querySelector('#continua').disabled)) problemes.push('el pedaç deixa continuar sense posar la data');
  await r.selectOption('#mes', String(new Date().getMonth() + 1));
  await r.selectOption('#any', String(any));
  if (!await r.evaluate(() => !!document.querySelector('#veredicte .caixa.be'))) problemes.push('un pedaç d\'aquest mes no surt com a bo');
  await r.selectOption('#any', String(any - 2));
  if (!await r.evaluate(() => !!document.querySelector('#veredicte .caixa.mal'))) problemes.push('un pedaç de fa dos anys no surt com a dolent');
  await hiCap('pedaç');
  await r.tap('#continua');

  // enrere torna a la comprovació d'abans, amb la data que hi havies posat
  await r.tap('#enrere');
  if (await text('#onvas') !== '1 de 13' || await r.evaluate(() => document.querySelector('#any').value) !== String(any - 2))
    problemes.push('enrere no torna al pedaç amb la data posada');
  await r.tap('#continua');

  // la resta: la segona bé, la tercera malament, la quarta no ho sé, i les altres bé
  let passos = 1;
  for (let i = 2; i <= 13; i++) {
    if (await text('#onvas') !== `${i} de 13`) { problemes.push(`la Revisió no arriba al pas ${i}: ${await text('#onvas')}`); break; }
    await hiCap('pas ' + i);
    await r.tap(i === 3 ? '#mal' : i === 4 ? '#dubte' : '#be');
    passos++;
  }
  const comptes = async () => [await text('#n-be'), await text('#n-mal'), await text('#n-dubte')].join(',');
  if (await comptes() !== '10,2,1') problemes.push('el resum de la Revisió no quadra: ' + await comptes() + ' (havia de ser 10,2,1)');
  if (await text('#titol') !== 'Hi ha 2 coses per arreglar') problemes.push('el títol del resum no diu el que hi ha: ' + await text('#titol'));
  await hiCap('resum');

  // tancant i tornant-hi, la revisió feta hi és
  await r.reload(); await r.waitForTimeout(600);
  if (!await r.evaluate(() => !!document.querySelector('#veu-resum')) || !(await text('#ultima') || '').includes('2 per arreglar'))
    problemes.push('en tornar a entrar, la Revisió no recorda l\'última');

  // des del resum es pot tornar a una comprovació i arreglar-la, i no s'apunta dues vegades
  await r.tap('#veu-resum');
  await r.tap('[data-torna="desconegudes"]');
  await r.tap('#be');
  if (await comptes() !== '11,1,1') problemes.push('arreglant una comprovació des del resum, els números no canvien: ' + await comptes());
  let historial = await r.evaluate(() => JSON.parse(localStorage.getItem('revisio-historial') || '[]').length);
  if (historial !== 1) problemes.push(`una sola revisió surt ${historial} vegades a l'historial`);

  // una de nova a mig fer es reprèn on era, i començar de nou pregunta abans
  await r.tap('#inici');
  await r.tap('#comenca');
  await r.tap('#dubte');            // el pedaç: no el trobo
  await r.tap('#be');
  await r.reload(); await r.waitForTimeout(600);
  if (await text('#comenca') !== 'CONTINUA (3 DE 13)') problemes.push('la Revisió a mig fer no es reprèn on era: ' + await text('#comenca'));
  await hiCap('entrada a mig fer');
  await r.tap('#de-nou');
  if (!await r.evaluate(() => !!document.querySelector('#de-nou'))) problemes.push('començar de nou no pregunta abans');
  await r.reload(); await r.waitForTimeout(600);
  await r.tap('#comenca');
  for (let i = 3; i <= 13; i++) await r.tap('#be');
  if (!(await text('#abans') || '').includes('1 per arreglar')) problemes.push('el resum no compara amb la revisió d\'abans');
  historial = await r.evaluate(() => JSON.parse(localStorage.getItem('revisio-historial') || '[]').length);
  if (historial !== 2) problemes.push(`amb dues revisions fetes, a l'historial n'hi ha ${historial}`);

  console.log(`${problemes.length > abansDe ? '✗' : '✓'} la Revisió, sencera amb el dit a 320px: ${passos} comprovacions, resum, desar i continuar`);
  await ctx.close();
}

await navegador.close();

// ------------------------------------------------------------------ el resum
if (errors.length) problemes.push(`${errors.length} errors de JavaScript:\n   ` + errors.join('\n   '));
console.log();
if (problemes.length) {
  console.log(`✗ ${problemes.length} problema(es):`);
  for (const x of problemes) console.log('  · ' + x);
  process.exit(1);
}
console.log('✓ tot bé');
