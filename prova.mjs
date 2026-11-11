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
