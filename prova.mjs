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

// Per provar només unes parts (la prova sencera triga uns 25 minuts):
//   node prova.mjs cares fons
// Les parts: retall, tampo, arregla, amplia, esborra, ratllades, cares, fons,
// sd, antiga, auto, baixades, enganxa, color, cloudflare, soroll, paper, extres, continua, app, revisio, visites. La portada i el bàsic de
// la Cambra Fosca es proven sempre. Abans de desar un canvi, la sencera.
const NOMES = process.argv.slice(2);
const vol = n => !NOMES.length || NOMES.includes(n);
const problemes = [];
const errors = [];
// les eines d'IA són a la pestanya ✦ IA, cadascuna en una targeta: obre la que toca
async function obreTargeta(pg, k) {
  await pg.click('#tab-ia');
  if (await pg.locator('#iaCos-' + k).isHidden()) await pg.click('#iaCap-' + k);
}

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
  if (r.eines !== 8) problemes.push(`la Cambra Fosca té ${r.eines} eines i n'ha de tenir 8`);
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

// La pestanya Mida: la mida en px, mm o cm (sempre proporcional) i la
// resolució. Aplicar-la canvia la foto (i desfer la torna), i desant, el
// fitxer porta escrita la resolució (si no, el programa que l'imprimeix suposa
// 72 o 96 ppp i la foto de 300 mm surt d'un metre). A Desa només hi ha el
// format: l'usuari va trobar confús tenir la mida allà i a l'Amplia.
{
  const abansM = problemes.length;
  const { readFileSync } = await import('fs');
  const { crc32 } = await import('zlib');
  const val = sel => p.locator(sel).inputValue();
  const escriu = async (sel, v) => { await p.fill(sel, ''); await p.locator(sel).pressSequentially(String(v)); await p.waitForTimeout(80); };
  const mida = async () => (await p.locator('#stDims').innerText()).match(/(\d+) × (\d+)/).slice(1).map(Number);
  const historial = () => p.locator('.hitem span').allInnerTexts();
  const desa = async fmt => {
    await p.click('#btnSave'); await p.waitForTimeout(300);
    if (fmt) await p.locator('.dlg .chip', { hasText: fmt }).click();
    const b = p.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await p.click('.dlg .btn.primary');
    const d = await b;
    return d ? readFileSync(await d.path()) : null;
  };
  const [W0, H0] = await mida();
  // a Desa ja no hi ha la mida, només diu on es canvia
  await p.click('#btnSave'); await p.waitForTimeout(300);
  if (await p.locator('#expW').count()) problemes.push('al quadre de Desa encara hi ha la mida');
  if (!(await p.locator('#expDims').innerText()).includes('pestanya Mida')) problemes.push('el quadre de Desa no diu que la mida es canvia a la pestanya Mida');
  await p.click('.dlg footer .btn:not(.primary)');

  await p.click('#tab-mida'); await p.waitForTimeout(200);
  if (await val('#midaW') !== String(W0) || await val('#midaH') !== String(H0)) problemes.push(`a la pestanya Mida, la mida no és la de la foto (${await val('#midaW')} × ${await val('#midaH')})`);
  // en punts, la resolució només canvia quant fa imprès
  await escriu('#midaPPP', 150);
  if (await p.locator('#midaAplica').innerText() !== 'Aplica la resolució') problemes.push('canviant només la resolució, el botó no diu «Aplica la resolució»');
  await p.click('#midaAplica'); await p.waitForTimeout(300);
  if ((await mida()).join() !== [W0, H0].join() || !(await historial()).includes('Resolució: 150 ppp') || !(await p.locator('#midaAra').innerText()).includes('150 ppp'))
    problemes.push('canviant la resolució en punts, la foto ha canviat de mida o no s\'apunta');
  await p.click('#btnUndo'); await p.waitForTimeout(300);
  if (!(await p.locator('#midaAra').innerText()).includes('300 ppp')) problemes.push('desfer no torna la resolució d\'abans');

  await p.click('#midaU-mm');
  const mmW = Math.round(W0 / 300 * 25.4 * 10) / 10;
  if (await val('#midaW') !== String(mmW).replace('.', ',')) problemes.push(`en mil·límetres, la foto de ${W0} px a 300 ppp hauria de fer ${mmW} mm i diu ${await val('#midaW')}`);
  await escriu('#midaW', 300);
  const pw = Math.round(300 / 25.4 * 300), ph = Math.round(300 / 25.4 * 300 * H0 / W0);
  const mmH = String(Math.round(300 * H0 / W0 * 10) / 10).replace('.', ',');
  if (await val('#midaH') !== mmH) problemes.push(`posant 300 mm d'ample, l'alt hauria de ser ${mmH} mm i és ${await val('#midaH')}`);
  if (!(await p.locator('#midaRes').innerText()).includes(`${pw} × ${ph} px`)) problemes.push('no diu de quants punts farà la foto: ' + await p.locator('#midaRes').innerText());
  if (!(await p.locator('#midaAvis').isVisible()) || !(await p.locator('#midaAvis').innerText()).includes('ppp')) problemes.push('fent-la més gran que la foto, no avisa que quedarà tova ni a quants ppp sortiria');
  if (!await p.locator('#midaIA').isVisible()) problemes.push('fent-la més gran que la foto, no ofereix fer-la més gran amb IA');
  // l'alt també mana
  await escriu('#midaH', 150);
  const wDeH = String(Math.round(150 * W0 / H0 * 10) / 10).replace('.', ',');
  if (await val('#midaW') !== wDeH) problemes.push(`escrivint 150 mm d'alt, l'ample hauria de ser ${wDeH} mm i és ${await val('#midaW')}`);
  await escriu('#midaW', 300);
  await p.click('#midaAplica'); await p.waitForTimeout(500);
  if ((await mida()).join() !== [pw, ph].join()) problemes.push(`aplicant 300 mm a 300 ppp, la foto hauria de fer ${pw} × ${ph} px i en fa ${await mida()}`);
  if (!(await historial()).includes(`Mida: ${pw} × ${ph} px`)) problemes.push('canviar la mida no surt a l\'historial');
  const png = await desa();
  if (!png) problemes.push('desant després de canviar la mida no s\'ha baixat res');
  else {
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20), i = png.indexOf('pHYs');
    if (w !== pw || h !== ph) problemes.push(`el PNG de 300 mm hauria de fer ${pw} × ${ph} px i en fa ${w} × ${h}`);
    if (i < 0) problemes.push('el PNG no porta escrita la resolució (pHYs)');
    else {
      const ppm = png.readUInt32BE(i + 4), unitat = png[i + 12];
      if (ppm !== Math.round(300 / 0.0254) || unitat !== 1) problemes.push(`el PNG diu ${ppm} punts per metre (unitat ${unitat}) en lloc de 300 ppp`);
      if (crc32(png.subarray(i, i + 13)) !== png.readUInt32BE(i + 13)) problemes.push('el tros de la resolució del PNG té la suma de control malament');
    }
    if (png.indexOf('pHYs', i + 4) >= 0) problemes.push('el PNG porta la resolució escrita dues vegades');
  }
  await p.click('#btnUndo'); await p.waitForTimeout(500);
  if ((await mida()).join() !== [W0, H0].join()) problemes.push('desfer no torna la foto a la mida d\'abans');

  // en centímetres, a 150 ppp, i desada en JPG
  await p.click('#tab-mida'); await p.click('#midaU-cm');
  await escriu('#midaPPP', 150);
  await escriu('#midaW', 10);
  const jw = Math.round(10 / 2.54 * 150), jh = Math.round(10 / 2.54 * 150 * H0 / W0);
  await p.click('#midaAplica'); await p.waitForTimeout(400);
  const jpg = await desa('JPG');
  if (!jpg) problemes.push('desant en JPG no s\'ha baixat res');
  else {
    let w = 0, h = 0;
    for (let o = 2; o < jpg.length - 9 && jpg[o] === 0xFF;) {
      const m = jpg[o + 1], l = jpg.readUInt16BE(o + 2);
      if (m >= 0xC0 && m <= 0xC3) { h = jpg.readUInt16BE(o + 5); w = jpg.readUInt16BE(o + 7); break; }
      o += 2 + l;
    }
    if (w !== jw || h !== jh) problemes.push(`el JPG de 10 cm a 150 ppp hauria de fer ${jw} × ${jh} px i en fa ${w} × ${h}`);
    const jfif = jpg.toString('latin1', 6, 11) === 'JFIF\0';
    if (!jfif || jpg[13] !== 1 || jpg.readUInt16BE(14) !== 150 || jpg.readUInt16BE(16) !== 150)
      problemes.push(`el JPG no porta escrits 150 ppp (unitat ${jpg[13]}, ${jpg.readUInt16BE(14)} × ${jpg.readUInt16BE(16)})`);
  }
  // massa gran: no es pot aplicar, i diu per què
  await p.click('#tab-mida');
  await escriu('#midaPPP', 300); await escriu('#midaW', 300);
  if (!await p.locator('#midaAplica').isDisabled() || !(await p.locator('#midaAvis').innerText()).includes('massa gran'))
    problemes.push('una mida que l\'aparell no pot fer (300 cm a 300 ppp) es deixa aplicar, o no diu per què');

  // a 320 px, les cinc pestanyes i la pestanya Mida hi caben
  await p.setViewportSize({ width: 320, height: 640 });
  await p.waitForTimeout(300);
  const q = await p.evaluate(() => { const t = document.querySelector('.tabs');
    return { tabs: t.scrollWidth - t.clientWidth, tallades: [...t.children].filter(b => b.scrollWidth > b.clientWidth + 1).length,
             pagina: document.documentElement.scrollWidth - innerWidth }; });
  if (q.tabs > 1 || q.tallades || q.pagina > 1) problemes.push(`a 320 px, les pestanyes o la pestanya Mida no hi caben (${JSON.stringify(q)})`);
  await p.click('#midaU-px');
  await p.setViewportSize({ width: 1280, height: 800 });
  console.log(`${problemes.length > abansM ? '✗' : '✓'} la pestanya Mida: la resolució sola, 300 mm d'ample amb l'alt proporcional (${pw} × ${ph} px, 300 ppp escrits al PNG), desfer, 10 cm a 150 ppp en JPG, massa gran, a 320 px, i Desa sense mida`);

// Els menús endreçats: totes les IA a la pestanya ✦ IA, en targetes (una
// d'oberta), amb un sol «On ho fas»; Endreça a l'eina Retalla
{
  const abansIA = problemes.length;
  await p.setViewportSize({ width: 1280, height: 800 }); await p.waitForTimeout(200);
  const pest = await p.locator('.tabs .tab').allInnerTexts();
  if (pest.join('·') !== 'Ajustos·Filtres·✦ IA·Mida·Historial') problemes.push('les pestanyes no són Ajustos · Filtres · ✦ IA · Mida · Historial: ' + pest.join(' · '));
  await p.click('#tab-ia');
  const est = () => p.evaluate(() => ({
    targetes: [...document.querySelectorAll('#pane-ia .targeta')].map(t => t.id.replace('iaTarg-', '')),
    oberts: [...document.querySelectorAll('#pane-ia .targeta-cos')].filter(c => !c.hidden).map(c => c.id.replace('iaCos-', '')),
    modes: document.querySelectorAll('[id^="iaMode-"]').length,
    altres: document.querySelectorAll('[id^="fonsMode-"]').length }));
  let e = await est();
  if (e.targetes.join() !== 'antiga,ratllades,nitida,esborra,cares,color,fons,amp') problemes.push('les targetes de la IA no són les set, per ordre: ' + e.targetes);
  if (e.modes !== 2 || e.altres) problemes.push(`no hi ha un sol «On ho fas» per a totes les IA (${e.modes} botons de mode, ${e.altres} del fons)`);
  await p.click('#iaCap-cares'); e = await est();
  if (e.oberts.join() !== 'cares') problemes.push('obrint «Cares» no queda oberta només aquesta: ' + e.oberts);
  await p.click('#iaCap-fons'); e = await est();
  if (e.oberts.join() !== 'fons') problemes.push('obrint «Fons», «Cares» no es tanca: ' + e.oberts);
  if (!await p.locator('#fonsGo').isVisible()) problemes.push('a la targeta del fons no hi ha el botó');
  await p.click('#iaCap-fons'); e = await est();
  if (e.oberts.length) problemes.push('tornant a tocar la targeta oberta no es tanca');
  // per mode: el del fons i el de l'amplia segueixen el mateix
  await p.click('#iaMode-ordinador'); await p.click('#iaCap-amp');
  if (!(await p.locator('#pane-amp').innerText()).includes('Ordinador')) problemes.push('l\'Amplia no diu que fa servir el mode triat a dalt');
  await p.click('#iaMode-mobil');
  // esborrar coses: el botó porta a la vareta
  await p.click('#iaCap-esborra'); await p.click('#iaVesEsborra');
  if (await p.getAttribute('#tool-treu', 'aria-pressed') !== 'true') problemes.push('«Pinta el que vols treure» no posa l\'eina d\'esborrar');
  if (await p.locator('#opts #treuRatllades').count()) problemes.push('el botó de les ratllades encara és a l\'eina d\'esborrar');
  // ajustos: només l'arregla-la sola; Endreça és al Retalla
  await p.click('#tab-adj');
  if (await p.locator('#pane-adj #sl-endreca, #pane-adj #cares').count()) problemes.push('Endreça o les cares encara són a Ajustos');
  await p.click('#tool-crop');
  if (!await p.locator('#opts #sl-endreca').isVisible()) problemes.push('Endreça no és a l\'eina Retalla');
  await p.click('#tool-move');
  // a 320 px, les targetes hi caben
  await p.setViewportSize({ width: 320, height: 640 }); await p.waitForTimeout(200);
  await p.click('#tab-ia'); await p.click('#iaCap-cares');
  const v = await p.evaluate(() => ({ pagina: document.documentElement.scrollWidth - innerWidth,
    caps: [...document.querySelectorAll('.targeta-cap')].filter(b => b.scrollWidth > b.clientWidth + 1).length }));
  if (v.pagina > 1 || v.caps) problemes.push('a 320 px, les targetes de la IA no hi caben: ' + JSON.stringify(v));
  await p.click('#iaCap-cares');
  await p.setViewportSize({ width: 1280, height: 800 }); await p.waitForTimeout(200);
  await p.click('#tab-adj');
  console.log(`${problemes.length > abansIA ? '✗' : '✓'} els menús: les set IA a la pestanya ✦ IA (una targeta oberta, un sol «On ho fas»), Endreça al Retalla, i a 320 px`);
}
}
await p.close();

// ------------------------------- la Cambra Fosca: el retall amb el dit
// Al mòbil, arrossegant un tirador del marc amunt o avall, el navegador
// s'emportava el gest per desplaçar la pàgina i el marc es quedava a mig camí
// (ho va trobar l'usuari). Es prova amb un dit de debò, no amb el ratolí.
if (vol('retall')) {
  const abansDe = problemes.length;
  const { devices } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
  const ctx = await navegador.newContext({ ...devices['Pixel 7'] });
  const p = await ctx.newPage();
  vigila(p, 'retall amb el dit');
  await p.goto(fitxer('cambra-fosca.html'));
  await p.waitForTimeout(1200);
  await p.tap('#tool-crop'); await p.waitForTimeout(300);
  const cdp = await ctx.newCDPSession(p);
  const arrossega = async (sel, dx, dy) => {
    await p.locator(sel).scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
    const c = await p.locator(sel).boundingBox(), x = c.x + c.width / 2, y = c.y + c.height / 2;
    const abans = { marc: await p.locator('#cropBox').boundingBox(), scroll: await p.evaluate(() => scrollY + document.querySelector('#stage').scrollTop) };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 12; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 12, y: y + dy * i / 12 }] });
      await p.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(300);
    return { abans, despres: { marc: await p.locator('#cropBox').boundingBox(), scroll: await p.evaluate(() => scrollY + document.querySelector('#stage').scrollTop) } };
  };
  // el tirador de baix, 60 px amunt: el marc s'ha d'escurçar 60 px, i la pàgina no s'ha de moure
  let r = await arrossega('#cropBox .h.s', 0, -60);
  const escurca = r.abans.marc.height - r.despres.marc.height;
  if (Math.abs(escurca - 60) > 3) problemes.push(`arrossegant el tirador de baix 60 px amb el dit, el marc s'escurça ${escurca.toFixed(0)} px`);
  if (r.despres.scroll !== r.abans.scroll) problemes.push('arrossegant un tirador del retall amb el dit, es desplaça la pàgina');
  // el marc sencer, 30 px avall
  r = await arrossega('#cropBox .g.h1', 0, 30);
  const baixa = r.despres.marc.y - r.abans.marc.y;
  if (Math.abs(baixa - 30) > 3) problemes.push(`arrossegant el marc 30 px avall amb el dit, es mou ${baixa.toFixed(0)} px`);
  if (r.despres.scroll !== r.abans.scroll) problemes.push('arrossegant el marc del retall amb el dit, es desplaça la pàgina');
  // els tiradors, prou grossos per al dit
  const t = await p.locator('#cropBox .h.se').boundingBox();
  if (t.width < 18) problemes.push(`al mòbil, els tiradors del retall fan ${t.width.toFixed(0)} px: massa petits per al dit`);
  console.log(`${problemes.length > abansDe ? '✗' : '✓'} el retall amb el dit: el tirador i el marc es mouen el que toca, i la pàgina no es desplaça`);
  await ctx.close();
}

// ------------------------------- la Cambra Fosca: el tampó de clonar
// Ha de copiar el que hi ha a l'origen. Anava amb el signe girat i copiava de
// l'altra banda: l'usuari fixava l'origen al sofà vermell i hi sortia el verd
// del fons. Al mòbil, a més, no hi ha Alt: el primer toc fixa l'origen.
if (vol('tampo')) {
  const abansC = problemes.length;
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const q = await ctx.newPage();
  vigila(q, 'tampó');
  await q.goto(fitxer('cambra-fosca.html'));
  await q.waitForTimeout(1200);
  // a dalt verd, a baix vermell
  const dades = await q.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 300;
    const x = c.getContext('2d'); x.fillStyle = '#2f8a3a'; x.fillRect(0, 0, 400, 150); x.fillStyle = '#c0242a'; x.fillRect(0, 150, 400, 150);
    return c.toDataURL('image/png'); });
  await q.setInputFiles('#file', { name: 'sofa.png', mimeType: 'image/png', buffer: Buffer.from(dades.split(',')[1], 'base64') });
  await q.waitForTimeout(600);
  await q.click('#tool-clone');
  await q.evaluate(() => { for (const [id, v] of [['opt-Mida', 30], ['opt-Duresa', 100], ['opt-Opacitat', 100]]) {
    const r = document.getElementById(id); r.value = v; r.dispatchEvent(new Event('input')); } });
  const cdp = await ctx.newCDPSession(q);
  const v = await q.locator('#view').boundingBox(), e = v.width / 400;
  const a = (x, y) => ({ x: v.x + x * e, y: v.y + y * e });
  const toc = async punts => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a(...punts[0])] });
    for (const pt of punts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [a(...pt)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await q.waitForTimeout(250);
  };
  const color = (x, y) => q.evaluate(([x, y]) => [...document.querySelector('#view').getContext('2d').getImageData(x, y, 1, 1).data], [x, y]);
  // primer toc, al vermell: fixa l'origen (sense Alt) i no pinta res
  const passos = (await q.locator('.hitem span').allInnerTexts()).length;
  await toc([[100, 225]]);
  if (!await q.locator('#cloneSrc').isVisible() || (await q.locator('.hitem span').allInnerTexts()).length !== passos)
    problemes.push('al mòbil, el primer toc del tampó no fixa l\'origen (o hi pinta)');
  // pintant al verd, 200 a la dreta i 150 amunt de l'origen, hi ha de sortir el vermell
  await toc([[300, 75], [315, 75], [330, 75], [345, 75]]);
  const c = await color(320, 75);
  if (!(c[0] > 150 && c[1] < 90)) problemes.push(`el tampó no copia el que hi ha a l'origen: on hi havia verd, amb l'origen al vermell, hi ha ${c.slice(0, 3)}`);
  if ((await color(320, 120)).slice(0, 3).join() !== (await color(380, 120)).slice(0, 3).join()) problemes.push('el tampó ha pintat fora d\'on ha passat el dit');
  // en acabar la pinzellada, la creueta torna a l'origen
  const marca = await q.evaluate(() => { const m = document.querySelector('#cloneSrc'); return [parseFloat(m.style.left), parseFloat(m.style.top)]; });
  const z = await q.evaluate(() => document.querySelector('#view').getBoundingClientRect().width / 400);
  if (Math.abs(marca[0] - 100 * z) > 2 || Math.abs(marca[1] - 225 * z) > 2) problemes.push('en acabar de pintar, la creueta del tampó no torna a l\'origen');
  // «Tria l'origen»: el toc següent el canvia
  await q.click('#cloneTria');
  await toc([[50, 50]]);
  const m2 = await q.evaluate(() => parseFloat(document.querySelector('#cloneSrc').style.left));
  if (Math.abs(m2 - 50 * z) > 2) problemes.push('amb «Tria l\'origen», el toc no canvia l\'origen del tampó');
  console.log(`${problemes.length > abansC ? '✗' : '✓'} el tampó de clonar: copia de l'origen, el primer toc el fixa al mòbil, la creueta i «Tria l'origen»`);
  await ctx.close();
}

// ------------------------------- la Cambra Fosca: Arregla-la sola i Endreça
// Es fa una foto «bona» (cel, paret grisa, un full blanc i objectes de color),
// s'espatlla de les maneres típiques i es mira si «Arregla-la sola» l'acosta a
// la bona; i que a la bona i a una posta de sol no els toqui el color.
if (vol('arregla')) {
  const abansDe = problemes.length;
  const p = await navegador.newPage({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  vigila(p, 'arregla');
  await p.goto(fitxer('cambra-fosca.html'));
  await p.waitForTimeout(1200);
  const { readFileSync } = await import('fs');
  // la foto bona, i una manera d'espatllar-la: x → mul·x^gamma, canal per canal
  const foto = (esp) => p.evaluate((esp) => {
    const W = 600, H = 400, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 170); g.addColorStop(0, 'rgb(110,160,215)'); g.addColorStop(1, 'rgb(166,202,215)');
    x.fillStyle = g; x.fillRect(0, 0, W, 170);
    x.fillStyle = 'rgb(150,148,142)'; x.fillRect(0, 170, W, 160);       // paret grisa
    x.fillStyle = 'rgb(95,90,84)'; x.fillRect(0, 330, W, 70);           // terra
    x.fillStyle = 'rgb(80,110,80)'; x.beginPath(); x.moveTo(0, 170); x.lineTo(120, 110); x.lineTo(260, 170); x.fill();
    x.fillStyle = 'rgb(70,100,75)'; x.beginPath(); x.moveTo(300, 170); x.lineTo(460, 95); x.lineTo(600, 170); x.fill();
    x.fillStyle = 'rgb(236,236,232)'; x.fillRect(60, 200, 140, 120);     // full blanc
    x.fillStyle = 'rgb(30,30,30)'; x.beginPath(); x.ellipse(130, 265, 40, 35, 0, 0, 7); x.fill();
    x.fillStyle = 'rgb(178,40,38)'; x.fillRect(250, 210, 80, 120);
    x.fillStyle = 'rgb(60,120,190)'; x.beginPath(); x.arc(430, 270, 50, 0, 7); x.fill();
    x.fillStyle = 'rgb(70,140,60)'; x.fillRect(500, 240, 70, 90);
    if (esp) {
      const id = x.getImageData(0, 0, W, H), d = id.data;
      for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++)
        d[i + k] = 255 * esp.mul[k] * Math.pow(d[i + k] / 255, esp.gamma || 1) + 255 * (esp.mes || 0);
      x.putImageData(id, 0, 0);
    }
    return c.toDataURL('image/png');
  }, esp);
  const obre = async (dades, nom = 'foto.png') => {
    await p.setInputFiles('#file', { name: nom, mimeType: 'image/png', buffer: Buffer.from(dades.split(',')[1], 'base64') });
    await p.waitForTimeout(400);
  };
  const valors = () => p.evaluate(() => Object.fromEntries(
    ['exposure', 'contrast', 'highlights', 'shadows', 'temperature', 'tint', 'vibrance'].map(k => [k, +document.querySelector('#sl-' + k).value])));
  const desa = async () => {
    await p.click('#btnSave'); await p.waitForTimeout(250);
    const b = p.waitForEvent('download'); await p.click('.dlg .btn.primary');
    return 'data:image/png;base64,' + readFileSync(await (await b).path()).toString('base64');
  };
  // diferència mitjana amb la bona, i el tint d'un tros de paret (en % sobre la bona)
  const compara = (a, bona) => p.evaluate(async ([a, bona]) => {
    const px = async src => { const i = new Image(); await new Promise(ok => { i.onload = ok; i.src = src; });
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const da = await px(a), db = await px(bona);
    let s = 0; for (let i = 0; i < da.length; i += 4) s += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
    const paret = d => { let r = 0, g = 0, b = 0, n = 0;
      for (let y = 180; y < 320; y++) for (let x = 208; x < 244; x++) { const i = (y * 600 + x) * 4; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      return (r - b) / ((r + g + b) / 3); };
    return { dif: s / (da.length / 4 * 3), tint: (paret(da) - paret(db)) * 100 };
  }, [a, bona]);

  const bona = await foto(null);
  // `millora`: fins on ha de baixar la diferència amb la bona. A les de llum,
  // clarament (el 85%). A les de color, el que compta és el tint (més avall), i
  // aquí només es demana que no empitjori: la temperatura i el matís no desfan
  // exactament un tint fet canal per canal, i la diferència total baixa poc.
  const casos = [
    { nom: 'bona', esp: null },
    { nom: 'fosca', esp: { mul: [.75, .75, .75], gamma: 1.9 }, millora: .85 },
    { nom: 'cremada', esp: { mul: [.6, .6, .6], gamma: .55, mes: .38 }, millora: .85 },
    { nom: 'groga', esp: { mul: [1.06, .98, .70] }, millora: 1 },
    { nom: 'blava', esp: { mul: [.78, .92, 1.08] }, millora: 1 },
    { nom: 'fosca i groga', esp: { mul: [.83, .75, .53], gamma: 1.6 }, millora: .85 },
  ];
  const fila = [];
  for (const c of casos) {
    const espatllada = c.esp ? await foto(c.esp) : bona;
    const abans = await compara(espatllada, bona);
    await obre(espatllada);
    await p.click('#arregla');
    const v = await valors();
    const despres = await compara(await desa(), bona);
    const diu = await p.locator('#arreglaRes').innerText();
    fila.push(`${c.nom} ${abans.dif.toFixed(0)}→${despres.dif.toFixed(0)}`);
    if (c.nom === 'bona') {
      if (Object.values(v).some(x => x !== 0)) problemes.push('«Arregla-la sola» ha tocat una foto que ja estava bé: ' + JSON.stringify(v));
      if (!diu.includes('ja estava bé')) problemes.push('a una foto bona, «Arregla-la sola» no diu que ja estava bé: ' + diu);
    } else if (despres.dif > abans.dif * c.millora)
      problemes.push(`«Arregla-la sola» no ha millorat prou la foto ${c.nom} (diferència amb la bona: ${abans.dif.toFixed(1)} → ${despres.dif.toFixed(1)})`);
    if (Math.abs(abans.tint) > 20) {            // les que tenen un tint fort: s'ha de reduir a la meitat, sense passar a l'altre cantó
      if (Math.abs(despres.tint) > Math.abs(abans.tint) * 0.5 || Math.sign(despres.tint) === -Math.sign(abans.tint) && Math.abs(despres.tint) > 12)
        problemes.push(`a la foto ${c.nom}, el tint no s'ha arreglat bé (${abans.tint.toFixed(0)}% → ${despres.tint.toFixed(0)}%)`);
    }
    if (c.nom === 'fosca' && !diu.includes('més clara')) problemes.push('a la foto fosca no diu que l\'ha aclarida: ' + diu);
    if (c.nom === 'groga' && !diu.includes('menys groga')) problemes.push('a la foto groga no diu que l\'ha fet menys groga: ' + diu);
    // prémer-lo dues vegades dona el mateix
    if (c.nom === 'groga') { await p.click('#arregla'); if (JSON.stringify(await valors()) !== JSON.stringify(v)) problemes.push('prémer «Arregla-la sola» dues vegades no dona el mateix'); }
  }
  // la posta de sol de mostra: el color no es toca (el sol taronja no és cap tint)
  await p.reload(); await p.waitForTimeout(1200);
  await p.click('#arregla');
  const posta = await valors();
  if (posta.temperature || posta.tint) problemes.push(`«Arregla-la sola» ha canviat el color de la posta de sol: temperatura ${posta.temperature}, matís ${posta.tint}`);
  // desfer amaga el que deia, que ja no seria veritat
  await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
  if (await p.locator('#arreglaRes').isVisible()) problemes.push('després de desfer, encara surt el que havia fet «Arregla-la sola»');

  // Endreça: un horitzó tort 5° ha de quedar recte
  const tort = await p.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 600; c.height = 400; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 400); g.addColorStop(0, '#5a8ccc'); g.addColorStop(1, '#c8d27a');
    x.fillStyle = g; x.fillRect(0, 0, 600, 400);
    const t = Math.tan(5 * Math.PI / 180);
    x.strokeStyle = '#0a0a0a'; x.lineWidth = 9; x.beginPath(); x.moveTo(-50, 200 - t * 350); x.lineTo(650, 200 + t * 350); x.stroke();
    return c.toDataURL('image/png');
  });
  const inclinacio = src => p.evaluate(async src => {
    const i = new Image(); await new Promise(ok => { i.onload = ok; i.src = src; });
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(i, 0, 0);
    const y = cx => { const d = x.getImageData(cx, 0, 1, c.height).data; let s = 0, n = 0;
      for (let k = 0; k < c.height; k++) if (d[k * 4] < 60) { s += k; n++; } return s / n; };
    return Math.atan((y(Math.round(c.width * .8)) - y(Math.round(c.width * .2))) / (c.width * .6)) * 180 / Math.PI;
  }, src);
  const posaEndreca = g => p.evaluate(g => { const r = document.querySelector('#sl-endreca'); r.value = g; r.dispatchEvent(new Event('input', { bubbles: true })); }, g);
  await obre(tort, 'torta.png');
  await p.click('#tool-crop');           // Endreça és a l'eina Retalla
  await posaEndreca(-5);
  const previa = await p.evaluate(() => ({ t: document.querySelector('#view').style.transform, reixa: !document.querySelector('#reixa').hidden }));
  if (!previa.t.includes('rotate(-5deg)') || !previa.reixa) problemes.push('moure Endreça no ensenya la foto girada amb la reixa: ' + JSON.stringify(previa));
  if (await p.locator('#stDims').innerText() !== '600 × 400 px') problemes.push('moure Endreça ja canvia la foto, abans d\'APLICA');
  await p.click('#endrecaCancela');
  if (await p.evaluate(() => document.querySelector('#view').style.transform)) problemes.push('Cancel·la no treu el gir de la vista');
  await posaEndreca(-5);
  await p.click('#endrecaAplica'); await p.waitForTimeout(300);
  if (await p.locator('#stDims').innerText() !== '531 × 354 px') problemes.push('Endreça −5° no retalla el que toca: ' + await p.locator('#stDims').innerText());
  const recte = await inclinacio(await desa());
  if (Math.abs(recte) > 0.3) problemes.push(`l'horitzó endreçat encara fa ${recte.toFixed(2)}° (abans ${(await inclinacio(tort)).toFixed(2)}°)`);
  if (!(await p.locator('.hitem span').allInnerTexts()).some(h => h.startsWith('Endreça'))) problemes.push('Endreça no surt a l\'historial');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
  if (await p.locator('#stDims').innerText() !== '600 × 400 px') problemes.push('desfer no torna la foto d\'abans d\'endreçar');

  console.log(`${problemes.length > abansDe ? '✗' : '✓'} Arregla-la sola (diferència amb la bona: ${fila.join(', ')}) i Endreça (5° → ${recte.toFixed(2)}°)`);
  await p.close();
}

// ------------------------------------------- la Cambra Fosca: ampliar amb IA
// El motor i els models es llegeixen amb `fetch`, i des d'una pàgina file://
// el navegador no ho deixa fer: aquesta part serveix el repositori ella
// mateixa. Aquí no hi ha gràfica (WebGPU), o sigui que es prova el camí del
// processador; el de la gràfica només es pot provar en un aparell que en tingui.
{
  const { createServer } = await import('http');
  const { readFileSync, statSync } = await import('fs');
  const { extname, join } = await import('path');
  const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
                  '.wasm': 'application/wasm', '.png': 'image/png' };
  const servidor = createServer((q, r) => {
    const f = join(AQUI, decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(AQUI) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': TIPUS[extname(f)] || 'application/octet-stream', 'content-length': statSync(f).size });
    r.end(readFileSync(f));
  });
  await new Promise(ok => servidor.listen(0, '127.0.0.1', ok));
  const BASE = `http://127.0.0.1:${servidor.address().port}/cambra-fosca.html`;
  const abansDe = problemes.length;
  // Cap model no pot fer servir peces que la gràfica (WebGPU) no sap fer:
  // aquelles peces van al processador i tornen, i amb gràfica i tot va lent.
  // El model lleuger en tenia 33 de PRelu. (La llista de les que sí que sap fer
  // és a docs/webgpu-operators.md del paquet onnxruntime-web.)
  for (const m of ['realesr-general-x4v3-v2', 'realesrgan-x4plus', 'migan-512', 'u2netp', 'birefnet-512-q8', 'ratllades', 'cares-troba']) {
    const f = join(AQUI, 'ia/models', m + '.onnx');
    // els grossos van en trossos (.onnx.1, .onnx.2...): s'ajunten
    const bytes = existsSync(f) ? readFileSync(f) : Buffer.concat([1, 2, 3, 4].map(n => f + '.' + n).filter(existsSync).map(t => readFileSync(t)));
    if (!bytes.length) problemes.push(`no hi ha el model ${m}`);
    if (bytes.includes('PRelu')) problemes.push(`el model ${m} fa servir PRelu, que la gràfica no sap fer`);
  }
  // La línia de detalls diu el navegador. L'Edge també diu «Chrome/...» abans
  // del seu nom, i sortia com a «Chrome 157». Es prova la funció tal com és a
  // l'eina, amb el que envien els navegadors de debò.
  {
    const font = readFileSync(join(AQUI, 'cambra-fosca.html'), 'utf8').match(/function quinNavegador\([\s\S]*?\n\}/)[0];
    const quin = new Function(font + '; return quinNavegador;')();
    const casos = [
      ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0', 'Edge 157'],
      ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36', 'Chrome 157'],
      ['Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36', 'Samsung Internet 28'],
      ['Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0', 'Firefox 140'],
    ];
    for (const [ua, toca] of casos) if (quin(ua) !== toca) problemes.push(`la línia de detalls diu «${quin(ua)}» en lloc de «${toca}»`);
  }
  if (vol('amplia')) {
  const p = await navegador.newPage({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  vigila(p, 'amplia');
  await p.goto(BASE);
  await p.waitForTimeout(1500);
  const text = sel => p.locator(sel).innerText();
  const mida = () => text('#stDims');
  const historial = () => p.locator('.hitem span').allInnerTexts();
  const acaba = async (maxim = 300000) => {      // espera que se'n vagi el vel
    const t0 = Date.now();
    while (!(await p.evaluate(() => document.querySelector('#vel').hidden))) {
      if (Date.now() - t0 > maxim) { problemes.push('l\'ampliació no s\'acaba mai'); return; }
      await p.waitForTimeout(200);
    }
  };
  // una imatge petita feta aquí mateix: degradat, un cercle i un quadre
  const fesImatge = (w, h) => p.evaluate(([w, h]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a5a9c'); g.addColorStop(1, '#e0a050');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#f2d24a'; x.beginPath(); x.arc(w * .3, h * .45, h * .28, 0, 7); x.fill();
    x.fillStyle = '#7a2230'; x.fillRect(w * .6, h * .35, w * .3, h * .55);
    return c.toDataURL('image/png');
  }, [w, h]);
  const obre = async (w, h) => {
    const dades = await fesImatge(w, h);
    await p.setInputFiles('#file', { name: 'petita.png', mimeType: 'image/png', buffer: Buffer.from(dades.split(',')[1], 'base64') });
    await p.waitForTimeout(600);
  };

  // la pestanya hi cap a totes les mides, sense tallar-se
  for (const ample of [320, 1280]) {
    await p.setViewportSize({ width: ample, height: 800 });
    await p.waitForTimeout(200);
    const t = await p.evaluate(() => { const t = document.querySelector('.tabs');
      return { vessa: t.scrollWidth > t.clientWidth + 1, tallades: [...t.children].filter(b => b.scrollWidth > b.clientWidth + 1).length }; });
    if (t.vessa || t.tallades) problemes.push(`a ${ample}px les pestanyes no hi caben`);
  }
  await p.setViewportSize({ width: 1280, height: 800 });

  // els límits: amb la foto de mostra (1500 × 1000), al mòbil ×4 no hi cap
  await obreTargeta(p, 'amp');
  await p.click('#iaMode-mobil');
  if (await text('#iaGo') !== 'Amplia ×2') problemes.push('al mòbil, amb una foto que per 4 no hi cap, no tria ×2 de partida: ' + await text('#iaGo'));
  await p.click('#iaF-4');
  if (!await p.locator('#iaGo').isDisabled() || !(await p.locator('#iaNoHiCap').count()))
    problemes.push('triant ×4 quan no hi cap, no avisa o el botó no queda desactivat');
  await p.click('#iaMode-ordinador');
  if (await text('#iaGo') !== 'Amplia ×4' || await p.locator('#iaGo').isDisabled())
    problemes.push('a l\'ordinador, la mateixa foto per 4 hauria de cabre');
  // quan no hi cap, el missatge ha de dir per què, segons el cas, i ben escrit
  // (abans deia sempre el mateix, i amb una frase que començava en minúscula)
  const avisBenEscrit = async on => {
    const t = await text('#iaNoHiCap');
    // després d'un punt, majúscula (després de dos punts, en català, minúscula)
    if (/\. [a-zàèéíòóúç]/.test(t)) problemes.push(`l'avís de mida (${on}) té una frase que comença en minúscula: ${t}`);
    return t;
  };
  await p.click('#iaMode-mobil'); await p.click('#iaF-4');
  if (!(await avisBenEscrit('mòbil ×4')).startsWith('Per 4 faria')) problemes.push('al mòbil ×4 amb la foto de mostra, l\'avís no diu que triï ×2');
  {  // una foto de 24 megapíxels, a l'ordinador: ja és molt gran
    const gran = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 6000; c.height = 4000;
      const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 6000, 4000); g.addColorStop(0, '#345'); g.addColorStop(1, '#dca');
      x.fillStyle = g; x.fillRect(0, 0, 6000, 4000); return c.toDataURL('image/jpeg', .8); });
    await p.setInputFiles('#file', { name: 'gran.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(gran.split(',')[1], 'base64') });
    await p.waitForTimeout(1500);
    await obreTargeta(p, 'amp'); await p.click('#iaMode-ordinador');
    if (!await p.locator('#iaGo').isDisabled()) problemes.push('una foto de 24 megapíxels es deixa ampliar a l\'ordinador');
    if (!(await avisBenEscrit('foto molt gran')).includes('ja és molt gran')) problemes.push('amb una foto molt gran, l\'avís no diu que ja és molt gran');
  }

  // el model lleuger, ×4
  await obre(64, 48);
  await obreTargeta(p, 'amp');
  await p.click('#iaMode-mobil'); await p.click('#iaF-4');
  await p.click('#iaGo');
  await acaba();
  if (await mida() !== '256 × 192 px') problemes.push('el model lleuger ×4 no dona la mida que toca: ' + await mida());
  if (!(await historial()).includes('Amplia ×4 · model lleuger')) problemes.push('l\'ampliació no surt a l\'historial');
  // en acabar, a dalt del panell diu que s'ha fet, abans que cap avís de «no hi cap»
  // (l'usuari va esperar una hora i el primer que va veure va ser un avís vermell)
  await obreTargeta(p, 'amp');
  const fet = await p.evaluate(() => { const f = document.querySelector('#iaFet'), a = document.querySelector('#iaNoHiCap');
    return { text: f ? f.textContent : '', primer: !!f && (!a || (f.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING)) }; });
  if (!fet.text.includes('Feta') || !fet.text.includes('64 × 48 a 256 × 192')) problemes.push('en acabar d\'ampliar, no diu que s\'ha fet ni la mida: ' + fet.text);
  if (!fet.primer) problemes.push('en acabar d\'ampliar, el missatge de «Feta» no surt el primer');
  // i diu amb què s'ha fet (aquí no hi ha gràfica): si no, no hi ha manera de
  // saber per què ha trigat el que ha trigat
  if (!fet.text.includes('amb el processador') || !(await p.locator('#iaDetalls').count()) || !(await text('#iaDetalls')).includes('processador'))
    problemes.push('el missatge de «Feta» no diu si s\'ha fet amb la gràfica o amb el processador: ' + fet.text);
  // que s'assembli a la foto: comparada amb una ampliació normal, ha de ser a prop (no soroll) però no igual
  await p.click('#btnSave'); await p.waitForTimeout(300);
  const baixada = p.waitForEvent('download'); await p.click('.dlg .btn.primary');
  const png = readFileSync(await (await baixada).path()).toString('base64');
  const semblanca = await p.evaluate(async ([png, original]) => {
    const carrega = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
    const [a, b] = await Promise.all([carrega('data:image/png;base64,' + png), carrega(original)]);
    const c = document.createElement('canvas'); c.width = a.width; c.height = a.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(a, 0, 0); const da = x.getImageData(0, 0, c.width, c.height).data;
    x.imageSmoothingQuality = 'high'; x.drawImage(b, 0, 0, c.width, c.height); const db = x.getImageData(0, 0, c.width, c.height).data;
    let s = 0; for (let i = 0; i < da.length; i += 4) s += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]);
    return s / (da.length / 4 * 3);
  }, [png, await fesImatge(64, 48)]);
  if (!(semblanca > 0.3 && semblanca < 12)) problemes.push(`el resultat no s'assembla a la foto com hauria (diferència mitjana ${semblanca.toFixed(1)})`);

  // desfer torna a la foto petita, i refer a l'ampliada
  await p.keyboard.press('Control+z'); await p.waitForTimeout(400);
  if (await mida() !== '64 × 48 px') problemes.push('desfer no torna a la foto d\'abans d\'ampliar: ' + await mida());
  await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(400);
  if (await mida() !== '256 × 192 px') problemes.push('refer no torna a l\'ampliada: ' + await mida());

  // la segona vegada no torna a baixar res
  await obreTargeta(p, 'amp');
  if (!(await text('#iaLinies')).includes('no cal baixar res')) problemes.push('la segona vegada torna a dir que s\'ha de baixar el model');

  // Més gran amb IA fins a uns mil·límetres, des de la pestanya Mida (abans
  // era «A mida» a l'Amplia, i l'usuari ho trobava confús). A l'Amplia
  // només hi ha ×2 i ×4.
  {
    if (await p.locator('#iaF-mida').count()) problemes.push('a l\'Amplia encara hi ha «A mida»');
    await obre(64, 48);
    await obreTargeta(p, 'amp'); await p.click('#iaMode-mobil');
    await p.click('#tab-mida'); await p.click('#midaU-mm');
    const posa = async (sel, v) => { await p.fill(sel, ''); await p.locator(sel).pressSequentially(String(v)); await p.waitForTimeout(80); };
    if (await p.locator('#midaPPP').inputValue() !== '300') problemes.push('la pestanya Mida no comença a 300 ppp');
    // 3 mm és més petit que la foto (64 px a 300 ppp són 5,4 mm): no cal IA
    await posa('#midaW', 3);
    if (await p.locator('#midaIA').isVisible()) problemes.push('fent-la més petita, ofereix fer-la més gran amb IA');
    // 30 mm són 354 px: més de 4 vegades, el model fa ×4 i la resta s'estira
    await posa('#midaW', 30);
    if (!(await text('#midaPlaIA')).includes('s\'estira')) problemes.push('demanant més de 4 vegades, no avisa que la resta s\'estira: ' + await text('#midaPlaIA'));
    // 10 mm són 118 px: el model amplia per 2 i es deixa a la mida justa
    await posa('#midaW', 10);
    const w = Math.round(10 / 25.4 * 300), h = Math.round(w * 48 / 64);
    const hmm = String(Math.round(h / 300 * 25.4 * 10) / 10).replace('.', ',');
    if (!(await text('#midaPlaIA')).includes('per 2')) problemes.push('no diu per quant amplia el model: ' + await text('#midaPlaIA'));
    await p.click('#midaIA');
    await acaba();
    if (await mida() !== `${w} × ${h} px`) problemes.push(`ampliant a 10 mm a 300 ppp, la foto hauria de fer ${w} × ${h} px i fa ${await mida()}`);
    if (!(await historial()).includes(`Amplia a 10 × ${hmm} mm · model lleuger`)) problemes.push('ampliar a mida no surt a l\'historial amb la mida');
    await p.click('#tab-mida');
    if (!(await text('#midaAra')).includes('300 ppp') || await p.locator('#midaW').inputValue() !== '10')
      problemes.push(`després d'ampliar a 10 mm, la pestanya Mida no diu 10 mm (${await p.locator('#midaW').inputValue()})`);
    await obreTargeta(p, 'amp');
    if (!(await text('#iaFet')).includes('Ampliada a 10')) problemes.push('en acabar d\'ampliar a mida, el «✓ Feta» no diu la mida');
    if (await p.locator('#iaGo').innerText() === 'Amplia ×mida') problemes.push('després d\'ampliar a mida, l\'Amplia es queda «a mida»');
  }

  // aturar a mig fer deixa la foto com era
  await obre(400, 300);
  await obreTargeta(p, 'amp');
  await p.click('#iaMode-mobil'); await p.click('#iaF-2');
  await p.click('#iaGo');
  await p.waitForFunction(() => /Tros [1-9]/.test(document.querySelector('#velDetall').textContent), null, { timeout: 120000 });
  await p.click('#velAtura');
  await acaba();
  if (await mida() !== '400 × 300 px') problemes.push('aturant a mig fer, la foto ha canviat: ' + await mida());
  if ((await historial()).some(h => h.startsWith('Amplia'))) problemes.push('una ampliació aturada surt a l\'historial');

  // una feina llarga (el model gran sense gràfica): ho diu de seguida i pregunta,
  // amb el percentatge a la pestanya; i «Atura» deixa la foto com era
  await obreTargeta(p, 'amp');
  await p.click('#iaMode-ordinador'); await p.click('#iaF-2');
  await p.click('#iaGo');
  try {
    await p.waitForSelector('#velPregunta:not([hidden])', { timeout: 240000 });
    const preg = await text('#velPreguntaText');
    if (!/trigarà uns .*min/.test(preg) || !preg.includes('Mòbil')) problemes.push('la pregunta d\'una feina llarga no diu quant trigarà ni que el model del mòbil va més de pressa: ' + preg);
    if (!/^\d+% · Ampliant/.test(await p.title())) problemes.push('mentre amplia, la pestanya no diu per on va: ' + await p.title());
    if (await p.locator('#velAtura').isVisible()) problemes.push('mentre pregunta, també surt l\'altre botó d\'aturar');
    await p.click('#velNo');
    await acaba();
    if (await mida() !== '400 × 300 px') problemes.push('responent «Atura» a la pregunta, la foto ha canviat: ' + await mida());
    if (await p.title() !== 'La Cambra Fosca') problemes.push('després d\'aturar, la pestanya no torna a dir «La Cambra Fosca»: ' + await p.title());
  } catch (e) { problemes.push('amb una feina llarga no ha sortit la pregunta de si es vol continuar'); await p.click('#velAtura').catch(() => {}); await acaba(); }

  // el model gran, ×4, amb una foto petita (sense gràfica va molt a poc a poc)
  await obre(32, 24);
  await obreTargeta(p, 'amp');
  await p.click('#iaMode-ordinador'); await p.click('#iaF-4');
  await p.click('#iaGo');
  await acaba(600000);
  if (await mida() !== '128 × 96 px') problemes.push('el model gran ×4 no dona la mida que toca: ' + await mida());

  console.log(`${problemes.length > abansDe ? '✗' : '✓'} ampliar amb IA (pel processador): lleuger ×4, gran ×4, a mida en mil·límetres (des de la pestanya Mida), límits, aturar, desfer i refer, i la segona vegada sense baixar res`);
  await p.close();
  }

  // ----------------------------- esborrar coses amb el dit (MI-GAN)
  // Amb un mòbil simulat i el dit de debò: es pinta de vermell un objecte
  // d'una paret de maons i la IA l'ha de treure i continuar la paret, sense
  // tocar res de la resta de la foto. El vermell només va a la pantalla.
  if (vol('esborra')) {
    const abansT = problemes.length;
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, acceptDownloads: true });
    const q = await ctx.newPage();
    vigila(q, 'esborra');
    await q.goto(BASE);
    await q.waitForTimeout(1500);
    // una paret de maons amb un objecte vermell al davant; a escala «e»
    const paret = (e, col) => q.evaluate(([e, col]) => {
      const c = document.createElement('canvas'); c.width = 640 * e; c.height = 480 * e;
      const x = c.getContext('2d'); x.scale(e, e);
      const g = x.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, '#5b8fd0'); g.addColorStop(1, '#a8c8e8');
      x.fillStyle = g; x.fillRect(0, 0, 640, 200);
      x.fillStyle = '#8f8a82'; x.fillRect(0, 200, 640, 200);
      x.strokeStyle = '#6f6a62'; x.lineWidth = 2;
      for (let j = 200; j < 400; j += 20) for (let i = -40; i < 680; i += 40) x.strokeRect(i + ((j / 20) % 2) * 20, j, 40, 20);
      x.fillStyle = '#5a544c'; x.fillRect(0, 400, 640, 80);
      x.fillStyle = col || '#d02a2a'; x.fillRect(280, 250, 70, 120);
      return c.toDataURL('image/png');
    }, [e, col]);
    const obreParet = async (e, col) => {
      const dades = await paret(e, col);
      await q.setInputFiles('#file', { name: 'paret.png', mimeType: 'image/png', buffer: Buffer.from(dades.split(',')[1], 'base64') });
      await q.waitForTimeout(800);
      return dades;
    };
    // el color mitjà, el més diferent de l'original i com de variat és (els
    // maons) dins d'un rectangle del que es veu
    const mira = (r, original) => q.evaluate(async ([r, original]) => {
      const v = document.querySelector('#view'), d = v.getContext('2d').getImageData(r[0], r[1], r[2], r[3]).data;
      let o = null;
      if (original) {
        const i = new Image(); await new Promise(ok => { i.onload = ok; i.src = original; });
        const c = document.createElement('canvas'); c.width = v.width; c.height = v.height;
        const x = c.getContext('2d'); x.drawImage(i, 0, 0, v.width, v.height); o = x.getImageData(r[0], r[1], r[2], r[3]).data;
      }
      let s = [0, 0, 0], l2 = 0, max = 0; const n = d.length / 4;
      for (let k = 0; k < d.length; k += 4) {
        s[0] += d[k]; s[1] += d[k + 1]; s[2] += d[k + 2];
        const l = (d[k] + d[k + 1] + d[k + 2]) / 3; l2 += l * l;
        if (o) max = Math.max(max, Math.abs(d[k] - o[k]), Math.abs(d[k + 1] - o[k + 1]), Math.abs(d[k + 2] - o[k + 2]));
      }
      const m = s.map(v => v / n), lm = (m[0] + m[1] + m[2]) / 3;
      return { m, var: Math.sqrt(Math.max(0, l2 / n - lm * lm)), max, ample: v.width };
    }, [r, original]);
    const cdp = await ctx.newCDPSession(q);
    const dit = async punts => {      // punts en píxels de la foto
      const v = await q.locator('#view').boundingBox(), e = v.width / (await mira([0, 0, 1, 1])).ample;
      const a = ([x, y]) => ({ x: v.x + x * e, y: v.y + y * e });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a(punts[0])] });
      for (const pt of punts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [a(pt)] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await q.waitForTimeout(150);
    };
    const ziga = (x0, x1, y0, y1, pas) => { const z = []; for (let y = y0; y <= y1; y += pas) z.push([x0, y], [x1, y + pas / 2]); return z; };
    const acabaT = async () => { await q.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 300000 }); };

    // la tira d'eines, amb una eina més, encara hi cap a 320 px sense desplaçar-la
    await q.setViewportSize({ width: 320, height: 700 });
    await q.waitForTimeout(200);
    const tira = await q.evaluate(() => { const r = document.querySelector('#rail'); return r.scrollWidth - r.clientWidth; });
    if (tira > 1) problemes.push(`a 320 px la tira d'eines no hi cap (en sobren ${tira} px)`);
    await q.setViewportSize({ width: 390, height: 844 });
    await q.waitForTimeout(200);

    const original = await obreParet(1);
    await q.click('#tool-treu');
    await q.waitForTimeout(200);
    if (!await q.locator('#treuGo').isDisabled()) problemes.push('«Esborra-ho» es pot prémer sense haver pintat res');
    if (!(await q.locator('#treuInfo').innerText()).includes('no surt de l\'aparell')) problemes.push('l\'eina d\'esborrar no diu que la foto no surt de l\'aparell');
    await q.evaluate(() => { const r = document.querySelector('#opt-Mida'); r.value = 40; r.dispatchEvent(new Event('input')); });
    const vora = [273, 300, 5, 5];            // un tros de paret que el pinzell agafa, al costat de l'objecte
    const grisa = (await mira(vora)).m;
    const scroll0 = await q.evaluate(() => scrollY);
    await dit(ziga(290, 340, 250, 372, 12));
    if (await q.evaluate(() => scrollY) !== scroll0) problemes.push('pintant el vermell amb el dit, la pàgina s\'ha desplaçat');
    if (await q.locator('#treuGo').isDisabled()) problemes.push('després de pintar, «Esborra-ho» no es pot prémer');
    const pintada = (await mira(vora)).m;
    if (!(pintada[0] - grisa[0] > 30 && pintada[1] < grisa[1])) problemes.push('el que es pinta per esborrar no es veu vermell a la pantalla');
    // el vermell no va mai al fitxer desat
    {
      await q.click('#btnSave'); await q.waitForTimeout(300);
      const baixada = q.waitForEvent('download'); await q.click('.dlg .btn.primary');
      const png = readFileSync(await (await baixada).path()).toString('base64');
      const c = await q.evaluate(async png => { const i = new Image(); await new Promise(ok => { i.onload = ok; i.src = 'data:image/png;base64,' + png; });
        const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0);
        return [...x.getImageData(275, 304, 1, 1).data]; }, png);
      if (Math.abs(c[0] - c[1]) > 25) problemes.push('el vermell d\'esborrar ha sortit al fitxer desat');
      await q.click('#tool-treu');     // desar no canvia d'eina, però per si de cas
    }
    // «Neteja el vermell» el treu, i canviar d'eina també
    if (await q.locator('#treuGo').isDisabled()) await dit(ziga(290, 340, 250, 372, 12));
    await q.click('#treuNeteja'); await q.waitForTimeout(150);
    if (!await q.locator('#treuGo').isDisabled() || Math.abs((await mira(vora)).m[0] - grisa[0]) > 4) problemes.push('«Neteja el vermell» no el treu');
    await dit(ziga(290, 340, 250, 372, 12));
    await q.click('#tool-move'); await q.click('#tool-treu'); await q.waitForTimeout(150);
    if (!await q.locator('#treuGo').isDisabled()) problemes.push('canviant d\'eina, el vermell s\'hi queda');

    // la goma del vermell: on hi passa, el vermell se'n va i la resta es queda
    const dreta = [353, 300, 5, 5], grisaD = (await mira(dreta)).m;
    await dit(ziga(290, 340, 250, 372, 12));
    // a l'ordinador el botó que sura no hi és (les opcions ja es veuen al costat)
    await q.setViewportSize({ width: 1280, height: 800 }); await q.waitForTimeout(300);
    if (await q.locator('#treuFlota').isVisible()) problemes.push('a l\'ordinador també surt el botó «Esborra-ho» que sura');
    await q.setViewportSize({ width: 390, height: 844 }); await q.waitForTimeout(300);
    await q.click('#treuMode-goma');
    await dit(ziga(262, 290, 285, 320, 8));
    if (Math.abs((await mira(vora)).m[0] - grisa[0]) > 4) problemes.push('la goma del vermell no el treu');
    if ((await mira(dreta)).m[0] - grisaD[0] < 30) problemes.push('la goma del vermell n\'ha tret on no hi ha passat');
    // si la goma el treu tot, no hi ha res per esborrar i la foto no es toca
    await q.evaluate(() => { const r = document.querySelector('#opt-Mida'); r.value = 200; r.dispatchEvent(new Event('input')); });
    await dit(ziga(200, 420, 180, 440, 40));
    await q.click('#treuGo'); await acabaT();
    if ((await q.locator('.hitem span').allInnerTexts()).includes('Esborra amb IA') || !(await q.locator('#stMsg').innerText()).includes('No queda'))
      problemes.push('amb tot el vermell tret amb la goma, «Esborra-ho» ha fet alguna cosa o no ho diu');
    if (await q.locator('#treuNeteja').isEnabled()) await q.click('#treuNeteja');
    await q.click('#treuMode-pinta');
    await q.evaluate(() => { const r = document.querySelector('#opt-Mida'); r.value = 40; r.dispatchEvent(new Event('input')); });

    // dos dits: zoom pessigant. El primer dit ja havia començat a pintar: aquella
    // ratlla s'ha de llençar. Amb el vermell i amb el pinzell.
    const pessiga = async () => {
      const v = await q.locator('#view').boundingBox(), cx = v.x + v.width / 2, cy = v.y + v.height / 2;
      const z0 = parseInt(await q.locator('#zoomRead').innerText());
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 30, y: cy, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 34, y: cy + 4, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 34, y: cy + 4, id: 1 }, { x: cx + 30, y: cy, id: 2 }] });
      for (let i = 1; i <= 10; i++)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 34 - i * 9, y: cy + 4, id: 1 }, { x: cx + 30 + i * 9, y: cy, id: 2 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await q.waitForTimeout(300);
      const z1 = parseInt(await q.locator('#zoomRead').innerText());
      await q.click('#zoomRead'); await q.waitForTimeout(300);     // torna a encabir-la
      return z1 / z0;
    };
    const zv = await pessiga();
    if (!(zv > 1.8)) problemes.push(`pessigant amb dos dits, el zoom no creix com hauria (×${zv.toFixed(2)})`);
    if (!await q.locator('#treuGo').isDisabled()) problemes.push('fent zoom amb dos dits, s\'hi queda una ratlla de vermell');
    const passos = (await q.locator('.hitem span').allInnerTexts()).length;
    await q.click('#tool-brush');
    const zp = await pessiga();
    if (!(zp > 1.8) || (await q.locator('.hitem span').allInnerTexts()).length !== passos) problemes.push('fent zoom amb dos dits amb el pinzell, s\'hi queda una pinzellada');
    await q.click('#tool-treu');

    // esborrar de debò, amb el botó que sura a sota (al mòbil, les opcions
    // queden sota la foto)
    await dit(ziga(290, 340, 250, 372, 12));
    {
      const f = await q.locator('#treuFlota').boundingBox();
      if (!f || f.y + f.height > 844 || f.x < 0 || f.x + f.width > 390) problemes.push('al mòbil, després de pintar no surt el botó «Esborra-ho» a sota, sencer');
    }
    await q.click(await q.locator('#treuFlotaGo').isVisible() ? '#treuFlotaGo' : '#treuGo');
    await acabaT();
    if (!(await q.locator('.hitem span').allInnerTexts()).includes('Esborra amb IA')) problemes.push('esborrar amb IA no surt a l\'historial');
    const forat = await mira([280, 250, 70, 120], original), paretBona = await mira([420, 250, 70, 120]);
    if (forat.m[0] - forat.m[1] > 25) problemes.push(`l'objecte vermell no s'ha esborrat (color mitjà ${forat.m.map(Math.round)})`);
    if (forat.m.some((v, i) => Math.abs(v - paretBona.m[i]) > 22)) problemes.push(`on hi havia l'objecte no hi ha paret (${forat.m.map(Math.round)} contra ${paretBona.m.map(Math.round)})`);
    // que hi hagi maons i no una taca llisa del color del mig
    if (forat.var < paretBona.var * 0.35) problemes.push(`on hi havia l'objecte la paret ha quedat llisa, sense maons (variació ${forat.var.toFixed(1)} contra ${paretBona.var.toFixed(1)})`);
    // la resta de la foto, intacta (lluny del forat, ni un nivell de diferència)
    for (const r of [[0, 0, 640, 200], [0, 200, 200, 280], [450, 200, 190, 280]]) {
      const m = await mira(r, original);
      if (m.max > 0) problemes.push(`esborrant, ha canviat la foto lluny del forat (${r}: diferència ${m.max})`);
    }
    if ((await mira(vora)).m[0] - (await mira(vora)).m[1] > 25) problemes.push('després d\'esborrar, el vermell de pintar s\'hi queda');
    if (!(await q.locator('#treuInfo').innerText()).includes('amb el processador')) problemes.push('després d\'esborrar no diu amb què s\'ha fet: ' + await q.locator('#treuInfo').innerText());
    if (await q.locator('#treuFlota').isVisible()) problemes.push('després d\'esborrar, el botó que sura s\'hi queda');
    // mantenint premut «Abans» es veu l'objecte (la foto com era); deixant-lo anar, ja no
    {
      const passosAbans = (await q.locator('.hitem span').allInnerTexts()).length;
      const b = await q.locator('#btnAbans').boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await q.waitForTimeout(500);       // (menys de 300 ms seria un toc, que posa la cortina)
      if ((await mira([290, 260, 50, 100])).m[0] < 180 || !await q.locator('#etAbans').isVisible()) problemes.push('mantenint premut «Abans» no es veu la foto com era');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await q.waitForTimeout(250);
      if ((await mira([290, 260, 50, 100])).m[0] > 170 || await q.locator('#etAbans').isVisible()) problemes.push('deixant anar «Abans» no torna la foto retocada');
      if ((await q.locator('.hitem span').allInnerTexts()).length !== passosAbans)
        problemes.push('«Abans» ha apuntat alguna cosa a l\'historial');
    }
    // desfer torna l'objecte, i refer el torna a treure
    await q.click('#btnUndo'); await q.waitForTimeout(400);
    if ((await mira([290, 260, 50, 100])).m[0] < 180) problemes.push('desfer no torna l\'objecte esborrat');
    await q.click('#btnRedo'); await q.waitForTimeout(400);
    if ((await mira([290, 260, 50, 100])).m[0] > 170) problemes.push('refer no torna a esborrar l\'objecte');

    // una foto més gran que el model (1600 × 1200): el tros es redueix a 512 i
    // es torna a fer gran, i la resta de la foto continua intacta
    const gran = await obreParet(2.5);
    await q.click('#tool-treu');
    await q.evaluate(() => { const r = document.querySelector('#opt-Mida'); r.value = 90; r.dispatchEvent(new Event('input')); });
    await dit(ziga(725, 850, 625, 930, 30));
    await q.click('#treuGo');
    await acabaT();
    const fg = await mira([700, 625, 175, 300]);
    if (fg.m[0] - fg.m[1] > 25) problemes.push(`a la foto gran, l'objecte vermell no s'ha esborrat (${fg.m.map(Math.round)})`);
    for (const r of [[0, 0, 1600, 450], [0, 500, 450, 700], [1150, 500, 450, 700]]) {
      const m = await mira(r, gran);
      if (m.max > 0) problemes.push(`a la foto gran, esborrant ha canviat la foto lluny del forat (${r}: ${m.max})`);
    }
    // el mode Ordinador fa servir LaMa: la mateixa paret, i el mateix que abans
    // (l'objecte fora, paret amb maons, la resta intacta), i surt amb el seu nom
    let baixadesLama = 0;
    q.on('request', r => { if (/lama-512\.onnx/.test(r.url())) baixadesLama++; });
    const originalL = await obreParet(1);
    await obreTargeta(q, 'esborra'); await q.click('#iaMode-ordinador'); await q.click('#iaVesEsborra');
    await q.waitForTimeout(900);          // puja fins a la foto, a poc a poc
    if (!(await q.locator('#treuInfo').innerText()).includes('LaMa')) problemes.push('al mode Ordinador, l\'eina d\'esborrar no diu que fa servir LaMa');
    await q.evaluate(() => { const r = document.querySelector('#opt-Mida'); r.value = 40; r.dispatchEvent(new Event('input')); });
    await dit(ziga(290, 340, 250, 372, 12));
    await q.click(await q.locator('#treuFlotaGo').isVisible() ? '#treuFlotaGo' : '#treuGo');
    await acabaT();
    if (!(await q.locator('.hitem span').allInnerTexts()).includes('Esborra amb IA · LaMa')) problemes.push('al mode Ordinador no s\'ha esborrat amb LaMa (historial: ' + (await q.locator('.hitem span').allInnerTexts()).slice(-1) + ')');
    const foratL = await mira([280, 250, 70, 120], originalL), paretL = await mira([420, 250, 70, 120]);
    if (foratL.m[0] - foratL.m[1] > 25) problemes.push(`amb LaMa, l'objecte vermell no s'ha esborrat (${foratL.m.map(Math.round)})`);
    if (foratL.m.some((v, i) => Math.abs(v - paretL.m[i]) > 22)) problemes.push(`amb LaMa, on hi havia l'objecte no hi ha paret (${foratL.m.map(Math.round)} contra ${paretL.m.map(Math.round)})`);
    if (foratL.var < paretL.var * 0.35) problemes.push(`amb LaMa, la paret ha quedat llisa, sense maons (${foratL.var.toFixed(1)} contra ${paretL.var.toFixed(1)})`);
    for (const r of [[0, 0, 640, 200], [0, 200, 200, 280], [450, 200, 190, 280]]) {
      const m = await mira(r, originalL);
      if (m.max > 0) problemes.push(`amb LaMa, ha canviat la foto lluny del forat (${r}: diferència ${m.max})`);
    }
    if (baixadesLama !== 2) problemes.push(`LaMa s'havia de baixar en dos trossos, i se n'han baixat ${baixadesLama}`);
    // la segona vegada, sense baixar res
    await q.click('#btnUndo'); await q.waitForTimeout(400);
    await dit(ziga(290, 340, 250, 372, 12));
    await q.click(await q.locator('#treuFlotaGo').isVisible() ? '#treuFlotaGo' : '#treuGo');
    await acabaT();
    if (baixadesLama !== 2) problemes.push('la segona vegada, LaMa es torna a baixar');
    // tocar l'objecte: la IA (MobileSAM) en troba el contorn i el posa de
    // vermell; l'objecte sencer, i poc més. Després s'esborra com sempre.
    // (L'objecte, aquí, és blau: el vermell de sobre s'hi veu.)
    let baixadesSam = 0;
    q.on('request', r => { if (/sam-(mira|toca)\.onnx/.test(r.url())) baixadesSam++; });
    const originalS = await obreParet(1, '#2a5ad0');
    await obreTargeta(q, 'esborra'); await q.click('#iaMode-mobil'); await q.click('#iaVesToca');
    await q.waitForTimeout(900);
    if (await q.getAttribute('#treuMode-toca', 'aria-pressed') !== 'true') problemes.push('«Toca el que vols treure» no posa l\'eina en mode de tocar');
    if (!(await q.locator('#treuInfo').innerText()).includes('MB')) problemes.push('tocant l\'objecte, no diu quant es baixa la primera vegada');
    await dit([[315, 310]]);
    await q.waitForFunction(() => document.querySelector('#vel').hidden && !document.querySelector('#treuGo').disabled, null, { timeout: 300000 });
    // quant de l'objecte (280-350 × 250-370) s'ha tornat vermellós, i quant de la paret del voltant
    const vermell = await q.evaluate(async original => {
      const i = new Image(); await new Promise(ok => { i.onload = ok; i.src = original; });
      const c = document.createElement('canvas'); c.width = 640; c.height = 480; const x = c.getContext('2d'); x.drawImage(i, 0, 0);
      const o = x.getImageData(0, 0, 640, 480).data;
      const v = document.querySelector('#view'), d = v.getContext('2d').getImageData(0, 0, 640, 480).data;
      let dins = 0, nd = 0, fora = 0;
      for (let y = 200; y < 420; y += 2) for (let xx = 220; xx < 410; xx += 2) {
        const k = (y * 640 + xx) * 4, es = xx >= 282 && xx < 348 && y >= 252 && y < 368, roig = d[k] - o[k] > 30;
        if (xx >= 278 && xx < 352 && y >= 248 && y < 372 && !es) continue;     // la vora mateixa no compta
        if (es) { nd++; if (roig) dins++; } else if (roig) fora++;
      }
      return { dins: dins / nd, fora: fora / nd };
    }, originalS);
    if (vermell.dins < 0.95 || vermell.fora > 0.15) problemes.push(`tocant l'objecte, el contorn no és el de l'objecte (n'agafa el ${(vermell.dins * 100).toFixed(0)}% i de més el ${(vermell.fora * 100).toFixed(0)}%)`);
    await q.click(await q.locator('#treuFlotaGo').isVisible() ? '#treuFlotaGo' : '#treuGo');
    await acabaT();
    const foratS = await mira([280, 250, 70, 120], originalS);
    if (foratS.m[2] - foratS.m[0] > 25) problemes.push(`tocant l'objecte i esborrant, no se n'ha anat (${foratS.m.map(Math.round)})`);
    for (const r of [[0, 0, 640, 200], [0, 200, 200, 280], [450, 200, 190, 280]]) {
      const m = await mira(r, originalS);
      if (m.max > 0) problemes.push(`tocant l'objecte i esborrant, ha canviat la foto lluny (${r}: ${m.max})`);
    }
    // una altra foto: un toc torna a mirar-la, però no torna a baixar res
    await q.click('#btnUndo'); await q.waitForTimeout(400);
    await q.click('#treuMode-toca');
    await dit([[315, 310]]);
    await q.waitForFunction(() => document.querySelector('#vel').hidden && !document.querySelector('#treuGo').disabled, null, { timeout: 300000 });
    if (baixadesSam !== 2) problemes.push(`la IA de tocar s'havia de baixar una sola vegada (dos fitxers), i n'hi ha hagut ${baixadesSam}`);
    if (await q.locator('#treuNeteja').isEnabled()) await q.click('#treuNeteja');
    console.log(`${problemes.length > abansT ? '✗' : '✓'} esborrar coses amb el dit (pel processador): pintar amb el dit, el vermell no es desa, netejar, la goma del vermell, zoom amb dos dits, el botó que sura, esborrar la paret de maons sense tocar la resta, abans i després, desfer i refer, una foto gran, amb LaMa al mode Ordinador, i tocant l'objecte (${(vermell.dins * 100).toFixed(0)}% de l'objecte, ${(vermell.fora * 100).toFixed(0)}% de més)`);
    await ctx.close();
  }

  // ------------------------------------- trobar i esborrar ratllades
  // Una foto vella feta aquí mateix (cel, muntanyes, una casa, arbustos, tons
  // sepia i gra) amb ratllades clares i un plec, que se sap on són: la IA les
  // ha de marcar, deixar el que hi ha la goma, i l'esborrador les ha de treure
  // sense tocar la resta.
  // Stable Diffusion, al mode Ordinador: en lloc d'omplir el forat amb el
  // que hi ha al voltant, s'hi inventa el que hi falta. Aquí, sense gràfica,
  // va molt a poc a poc: es fa amb 4 passos, que és poc però ja treu l'objecte.
  if (vol('sd')) {
    const abansSD = problemes.length;
    const p = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
    vigila(p, 'sd');
    let baixadesSD = 0;
    p.on('request', r => { if (/sd-(unet|vae-enc|vae-dec)-q8\.onnx/.test(r.url())) baixadesSD++; });
    await p.goto(BASE);
    await p.waitForTimeout(1500);
    const dades = await p.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 480;
      const x = c.getContext('2d');
      x.fillStyle = '#8f8a82'; x.fillRect(0, 0, 640, 480);
      x.strokeStyle = '#6f6a62'; x.lineWidth = 2;
      for (let j = 0; j < 480; j += 20) for (let i = -40; i < 680; i += 40) x.strokeRect(i + ((j / 20) % 2) * 20, j, 40, 20);
      x.fillStyle = '#d02a2a'; x.fillRect(280, 180, 70, 120);
      return c.toDataURL('image/png');
    });
    await p.setInputFiles('#file', { name: 'paret.png', mimeType: 'image/png', buffer: Buffer.from(dades.split(',')[1], 'base64') });
    await p.waitForTimeout(800);
    // el color mitjà i el més diferent de l'original, dins d'un rectangle
    const mira = r => p.evaluate(async ([r, original]) => {
      const v = document.querySelector('#view'), d = v.getContext('2d').getImageData(r[0], r[1], r[2], r[3]).data;
      const i = new Image(); await new Promise(ok => { i.onload = ok; i.src = original; });
      const c = document.createElement('canvas'); c.width = v.width; c.height = v.height;
      const x = c.getContext('2d'); x.drawImage(i, 0, 0); const o = x.getImageData(r[0], r[1], r[2], r[3]).data;
      let s = [0, 0, 0], max = 0; const n = d.length / 4;
      for (let k = 0; k < d.length; k += 4) { for (let j = 0; j < 3; j++) { s[j] += d[k + j]; max = Math.max(max, Math.abs(d[k + j] - o[k + j])); } }
      return { m: s.map(v => v / n), max };
    }, [r, dades]);
    const pinta = async () => {
      const v = await p.locator('#view').boundingBox(), e = v.width / await p.evaluate(() => document.querySelector('#view').width);
      await p.mouse.move(v.x + 290 * e, v.y + 185 * e); await p.mouse.down();
      for (let y = 185; y <= 300; y += 10) { await p.mouse.move(v.x + 290 * e, v.y + y * e, { steps: 3 }); await p.mouse.move(v.x + 342 * e, v.y + (y + 5) * e, { steps: 3 }); }
      await p.mouse.up(); await p.waitForTimeout(300);
    };
    const acaba = () => p.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 1500000 });
    const historial = () => p.locator('.hitem span').allInnerTexts();
    const posa = (id, v) => p.evaluate(([id, v]) => { const r = document.querySelector(id); r.value = v; r.dispatchEvent(new Event('input')); }, [id, v]);

    // al mode Mòbil no es pot triar (ni hi cabria ni hi aniria), i ho diu
    await obreTargeta(p, 'esborra');
    await p.click('#iaMode-mobil');
    if (await p.locator('#iaQuin').isVisible()) problemes.push('al mode Mòbil es pot triar Stable Diffusion');
    if (!(await p.locator('#iaQuinInfo').innerText()).includes('mode Ordinador')) problemes.push('al mode Mòbil, la targeta no diu que Stable Diffusion és al mode Ordinador');
    // al mode Ordinador, LaMa de partida, sense control de passos
    await p.click('#iaMode-ordinador');
    if (!await p.locator('#iaQuin').isVisible() || await p.locator('#iaQuin-normal').getAttribute('aria-pressed') !== 'true')
      problemes.push('al mode Ordinador no es pot triar l\'esborrador, o no hi ha LaMa triada de partida');
    await p.click('#iaQuin-sd');
    const info = await p.locator('#iaQuinInfo').innerText();
    if (!/inventa/.test(info) || !/MB/.test(info)) problemes.push('triant Stable Diffusion, la targeta no diu què fa ni quant fa: ' + info);
    const llic = await p.locator('#iaQuinInfo a').getAttribute('href').catch(() => null);
    if (llic !== 'ia/models/LICENSE-SD' || !existsSync(join(AQUI, llic))) problemes.push('triant Stable Diffusion, no hi ha l\'enllaç a la seva llicència (o el fitxer no hi és)');
    await p.click('#iaVesEsborra'); await p.waitForTimeout(400);
    if (await p.locator('#treuQuin-sd').getAttribute('aria-pressed') !== 'true') problemes.push('a les opcions de l\'eina no surt Stable Diffusion triat');
    if (!await p.locator('#opt-Passos').count()) problemes.push('amb Stable Diffusion, no hi ha el control dels passos');
    if (!/Stable Diffusion[\s\S]*La primera vegada es baixa/.test(await p.locator('#treuInfo').innerText())) problemes.push('l\'eina no diu que fa servir Stable Diffusion ni quant es baixa: ' + await p.locator('#treuInfo').innerText());
    // a «Tria tu els passos», les ratllades s'esborren amb el que hi ha triat, i ho diu
    if (!/Stable Diffusion/.test(await p.locator('#antigaInfo').textContent())) problemes.push('a «Tria tu els passos» no diu que les ratllades s\'esborraran amb Stable Diffusion');

    // esborrar l'objecte: 4 passos, pas a pas a la barra
    await posa('#opt-Passos', 4); await posa('#opt-Mida', 40);
    await pinta();
    const t0 = Date.now();
    await p.click('#treuGo');
    let vistPas = false;
    try { await p.waitForFunction(() => /Pas [1-4] de 4/.test(document.querySelector('#velDetall').textContent), null, { timeout: 1200000 }); vistPas = true; } catch (e) {}
    if (!vistPas) problemes.push('mentre reconstrueix, la barra no diu per quin pas va');
    await acaba();
    const temps = ((Date.now() - t0) / 1000).toFixed(0);
    if (!(await historial()).includes('Esborra amb IA · Stable Diffusion')) problemes.push('esborrar amb Stable Diffusion no surt a l\'historial: ' + (await historial()).slice(-1));
    if (baixadesSD !== 12) problemes.push(`Stable Diffusion s'havia de baixar en 12 fitxers (10 trossos de la UNet i el VAE), i se n'han baixat ${baixadesSD}`);
    const forat = await mira([280, 180, 70, 120]), paret = await mira([420, 180, 70, 120]);
    if (forat.m[0] - forat.m[1] > 25) problemes.push(`amb Stable Diffusion, l'objecte vermell no s'ha esborrat (${forat.m.map(Math.round)})`);
    if (forat.m.some((v, i) => Math.abs(v - paret.m[i]) > 30)) problemes.push(`amb Stable Diffusion, on hi havia l'objecte no hi ha paret (${forat.m.map(Math.round)} contra ${paret.m.map(Math.round)})`);
    for (const r of [[0, 0, 640, 140], [0, 140, 230, 340], [400, 140, 240, 340]]) {
      const m = await mira(r);
      if (m.max > 0) problemes.push(`amb Stable Diffusion, ha canviat la foto lluny del forat (${r}: diferència ${m.max})`);
    }
    if (await p.evaluate(() => document.documentElement.dataset.iaVives) !== 'treu') problemes.push('després de Stable Diffusion, a la memòria hi ha altres IA: ' + await p.evaluate(() => document.documentElement.dataset.iaVives));
    if (!(await p.locator('#treuInfo').innerText()).includes('amb el processador')) problemes.push('després de reconstruir no diu amb què s\'ha fet');
    const primera = await p.evaluate(() => Array.from(document.querySelector('#view').getContext('2d').getImageData(280, 180, 70, 120).data));
    // una altra vegada: no es baixa res, i en surt una altra (la llavor canvia)
    await p.click('#btnUndo'); await p.waitForTimeout(400);
    await pinta();
    await p.click('#treuGo'); await acaba();
    if (baixadesSD !== 12) problemes.push('la segona vegada, Stable Diffusion es torna a baixar');
    const segona = await p.evaluate(() => Array.from(document.querySelector('#view').getContext('2d').getImageData(280, 180, 70, 120).data));
    // (amb la mateixa llavor sortiria exactament igual; en una paret tan llisa,
    // dues llavors donen coses semblants, però no iguals)
    let dif = 0; for (let k = 0; k < primera.length; k++) if (k % 4 !== 3) dif += Math.abs(primera[k] - segona[k]); dif /= primera.length * 3 / 4;
    if (dif < 0.3) problemes.push(`tornant-hi, Stable Diffusion fa exactament el mateix (diferència ${dif.toFixed(2)}): la llavor no canvia`);
    // aturar a mig fer: la foto com era, i res a l'historial (amb molts passos,
    // si trigarà més de 3 minuts, abans pregunta)
    await p.click('#btnUndo'); await p.waitForTimeout(400);
    const passosHist = (await historial()).length;
    await posa('#opt-Passos', 40);
    await pinta();
    await p.click('#treuGo');
    await p.waitForFunction(() => /Pas [2-9] de 40/.test(document.querySelector('#velDetall').textContent) || !document.querySelector('#velPregunta').hidden, null, { timeout: 1200000 });
    if (await p.locator('#velPregunta').isVisible()) {
      if (!(await p.locator('#velPreguntaText').innerText()).includes('Stable Diffusion')) problemes.push('la pregunta d\'una feina llarga no parla de Stable Diffusion: ' + await p.locator('#velPreguntaText').innerText());
      await p.click('#velNo');
    } else await p.click('#velAtura');
    await acaba();
    if ((await historial()).length !== passosHist) problemes.push('una reconstrucció aturada surt a l\'historial');
    await p.click('#treuNeteja'); await p.waitForTimeout(300);     // (el vermell de pintar s'hi queda)
    if ((await mira([280, 180, 70, 120])).max > 0) problemes.push('aturant Stable Diffusion a mig fer, la foto ha canviat');
    if (/Reconstruint/.test(await p.title())) problemes.push('després d\'aturar, la pestanya encara diu «Reconstruint»');
    // «Arregla-la» no fa servir mai Stable Diffusion, encara que estigui triat:
    // una foto sèpia esquerdada (prou gran perquè no li calgui fer-la més gran)
    // s'arregla amb LaMa, sense baixar res de Stable Diffusion, i la tria es queda
    {
      const sepia = await p.evaluate(() => {
        const w = 1300, h = 900, c = document.createElement('canvas'); c.width = w; c.height = h;
        const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#b29c7a'); g.addColorStop(1, '#5e4c38'); x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.filter = 'blur(8px)'; x.fillStyle = '#6f5c46'; x.fillRect(300, 300, 700, 500); x.filter = 'none';
        let s = 5; const r = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
        x.lineCap = 'round'; x.lineJoin = 'round';
        for (let i = 0; i < 25; i++) { let px = r() * w, py = r() * h, a = r() * 6.28; x.strokeStyle = 'rgba(243,238,226,0.9)'; x.lineWidth = 2 + r() * 3; x.beginPath(); x.moveTo(px, py);
          for (let k = 0; k < 40; k++) { a += (r() - .5) * 0.9; px += Math.cos(a) * 7; py += Math.sin(a) * 7; x.lineTo(px, py); } x.stroke(); }
        return c.toDataURL('image/png');
      });
      await p.setInputFiles('#file', { name: 'sepia.png', mimeType: 'image/png', buffer: Buffer.from(sepia.split(',')[1], 'base64') });
      await p.waitForTimeout(800);
      await obreTargeta(p, 'antiga');
      const baixadesAbans = baixadesSD;
      await p.click('#autoGo');
      await p.waitForFunction(() => document.querySelector('#vel').hidden && !document.querySelector('#autoGo').disabled, null, { timeout: 1200000 });
      await p.waitForTimeout(500);
      const h = await historial(), pla = await p.evaluate(() => document.documentElement.dataset.autoPla);
      if (!/ratllades/.test(pla) || !h.some(t => t === 'Esborra les ratllades (IA) · LaMa')) problemes.push('amb Stable Diffusion triat, «Arregla-la» no ha esborrat les ratllades amb LaMa: ' + pla + ' / ' + h.join(' · '));
      if (h.some(t => /Stable Diffusion/.test(t)) || baixadesSD !== baixadesAbans) problemes.push('«Arregla-la» ha fet servir Stable Diffusion: ' + h.join(' · '));
      await obreTargeta(p, 'esborra');
      if (await p.locator('#iaQuin-sd').getAttribute('aria-pressed') !== 'true') problemes.push('després d\'«Arregla-la», Stable Diffusion ja no és el triat a «Esborra coses»');
      await p.click('#iaVesEsborra'); await p.waitForTimeout(300);
    }
    // tornant a LaMa, fora el control dels passos; al mode Mòbil, fora la tria
    await p.click('#treuQuin-normal'); await p.waitForTimeout(200);
    if (await p.locator('#opt-Passos').count()) problemes.push('tornant a LaMa, hi queda el control dels passos');
    await obreTargeta(p, 'esborra'); await p.click('#iaMode-mobil'); await p.waitForTimeout(200);
    if (await p.locator('#treuQuin').isVisible()) problemes.push('al mode Mòbil, a les opcions de l\'eina encara es pot triar Stable Diffusion');
    console.log(`${problemes.length > abansSD ? '✗' : '✓'} Stable Diffusion al mode Ordinador (4 passos pel processador, ${temps} s): la tria, la llicència, l'objecte fora sense tocar la resta, una altra vegada sense baixar res i diferent, aturar, i «Arregla-la» sense`);
    await p.close();
  }

  if (vol('ratllades')) {
    const abansR = problemes.length;
    const q = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
    vigila(q, 'ratllades');
    await q.goto(BASE);
    await q.waitForTimeout(1500);
    const fotos = await q.evaluate(() => {
      const W = 900, H = 640, fa = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
      const [nc, n] = fa();
      const g = n.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#c8b9a0'); g.addColorStop(1, '#8c7d5a'); n.fillStyle = g; n.fillRect(0, 0, W, H);
      n.fillStyle = '#6e5f4b'; n.beginPath(); [[0, 420], [200, 260], [380, 400], [560, 230], [900, 430], [900, 640], [0, 640]].forEach(([x, y], i) => i ? n.lineTo(x, y) : n.moveTo(x, y)); n.fill();
      n.fillStyle = '#aa9678'; n.fillRect(520, 380, 180, 140); n.fillStyle = '#5a4637'; n.beginPath(); n.moveTo(500, 380); n.lineTo(610, 300); n.lineTo(720, 380); n.fill();
      n.fillStyle = '#3c3228'; n.fillRect(590, 440, 40, 80);
      n.fillStyle = '#504b37'; for (let x = 60; x < 880; x += 70) { n.beginPath(); n.ellipse(x + 20, 530, 20, 30, 0, 0, 7); n.fill(); }
      const im = n.getImageData(0, 0, W, H), d = im.data; let s = 9;
      for (let k = 0; k < d.length; k += 4) { s = (s * 1103515245 + 12345) >>> 0; const r = ((s >>> 8) / 16777216 - 0.5) * 22; d[k] += r; d[k + 1] += r; d[k + 2] += r; }
      n.putImageData(im, 0, 0);
      const [vc, v] = fa(), [mc, m] = fa();
      v.drawImage(nc, 0, 0); m.fillStyle = '#000'; m.fillRect(0, 0, W, H);
      const ratlla = (pts, gruix, color) => { for (const [x, col] of [[v, color], [m, '#fff']]) { x.strokeStyle = col; x.lineWidth = gruix; x.lineCap = 'round';
        x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); } };
      const corba = (p0, p1, amp) => Array.from({ length: 60 }, (_, i) => [p0[0] + (p1[0] - p0[0]) * i / 59, p0[1] + (p1[1] - p0[1]) * i / 59 + amp * Math.sin(i / 59 * 3)]);
      ratlla(corba([80, 40], [300, 600], 18), 3, '#f5f0e6');
      ratlla(corba([420, 20], [860, 300], 10), 2, '#faf8f0');
      ratlla(corba([150, 350], [700, 620], 25), 4, '#f0ebe1');
      ratlla([[0, 300], [900, 330]], 5, '#ebe6d7');          // un plec
      return [vc.toDataURL('image/png'), nc.toDataURL('image/png'), mc.toDataURL('image/png')];
    });
    const [vella, neta, mascara] = fotos.map(u => Buffer.from(u.split(',')[1], 'base64'));
    await q.setInputFiles('#file', { name: 'vella.png', mimeType: 'image/png', buffer: vella });
    await q.waitForTimeout(700);
    await obreTargeta(q, 'ratllades');
    if (!(await q.locator('#treuRatlladesInfo').innerText()).includes('MB')) problemes.push('el botó de les ratllades no diu quant es baixa la primera vegada');
    await q.click('#treuRatllades');
    await q.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 300000 });
    await q.waitForTimeout(200);
    // compara el que es veu amb la foto neta, la vella i on són les ratllades
    const compara = () => q.evaluate(async ([neta, vella, mascara]) => {
      const carrega = src => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.src = 'data:image/png;base64,' + src; });
      const dades = i => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
      const [dn, dv, dm] = (await Promise.all([neta, vella, mascara].map(carrega))).map(dades);
      const v = document.querySelector('#view'), dr = v.getContext('2d').getImageData(0, 0, v.width, v.height).data;
      const W = 900, H = 640, prop = new Uint8Array(W * H);     // a menys de 10 punts d'una ratllada
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (dm[(y * W + x) * 4] > 127)
        for (let yy = Math.max(0, y - 10); yy < Math.min(H, y + 11); yy++) for (let xx = Math.max(0, x - 10); xx < Math.min(W, x + 11); xx++) prop[yy * W + xx] = 1;
      let vermell = 0, rat = 0, vermellFora = 0, fora = 0, errA = 0, errV = 0, canviFora = 0, zona = [0, 0, 0];
      const vermellA = k => dr[k] - dr[k + 1] > 60;
      // la primera vegada es recorda què s'ha marcat de vermell: l'esborrat es
      // jutja allà (el que la IA no ha trobat, no l'ha d'esborrar)
      const marcat = window.__marcat || (window.__marcat = Uint8Array.from({ length: W * H }, (_, i) => vermellA(i * 4) ? 1 : 0));
      for (let i = 0, k = 0; i < W * H; i++, k += 4) {
        const e = (a, b) => (Math.abs(a[k] - b[k]) + Math.abs(a[k + 1] - b[k + 1]) + Math.abs(a[k + 2] - b[k + 2])) / 3;
        const x = i % W, y = (i / W) | 0, aZona = x >= 70 && x < 115 && y >= 60 && y < 160;   // el tros de la goma
        if (dm[k] > 127 && aZona) { zona[0] += e(dr, dn); zona[1] += e(dv, dn); zona[2]++; }
        else if (dm[k] > 127) { rat++; if (vermellA(k)) vermell++; if (marcat[i]) { errA += e(dr, dn); errV += e(dv, dn); zona[3] = (zona[3] || 0) + 1; } }
        else if (!prop[i]) { fora++; if (vermellA(k)) vermellFora++; canviFora += e(dr, dv); }
      }
      return { trobat: vermell / rat, demes: vermellFora / fora, err: errA / zona[3], errVella: errV / zona[3], canviFora: canviFora / fora,
               zona: zona[0] / zona[2], zonaVella: zona[1] / zona[2] };
    }, [neta, vella, mascara].map(b => b.toString('base64')));
    const c1 = await compara();
    if (c1.trobat < 0.7) problemes.push(`la IA de les ratllades només n'ha marcat el ${(c1.trobat * 100).toFixed(0)}%`);
    if (c1.demes > 0.0005) problemes.push(`la IA de les ratllades ha marcat de vermell el ${(c1.demes * 100).toFixed(1)}% de la foto on no n'hi ha`);
    if (await q.locator('#treuGo').isDisabled()) problemes.push('després de trobar les ratllades, «Esborra-ho» no es pot prémer');
    // només una IA a la memòria: ara hi ha la de les ratllades, i en esborrar
    // s'ha de deixar anar (abans s'hi quedaven totes, i al mòbil no hi cabien)
    const vives = () => q.evaluate(() => document.documentElement.dataset.iaVives);
    if (await vives() !== 'ratllades') problemes.push('després de buscar ratllades, a la memòria no hi ha només la seva IA: ' + await vives());
    // amb la goma es treu el vermell d'un tros de la primera ratllada: allà no s'ha d'esborrar
    await q.click('#treuMode-goma');
    await q.evaluate(() => { const r = document.querySelector('#opt-Mida'); r.value = 60; r.dispatchEvent(new Event('input')); });
    { const v = await q.locator('#view').boundingBox(), e = v.width / 900;
      await q.mouse.move(v.x + 92 * e, v.y + 70 * e); await q.mouse.down();
      for (let i = 1; i <= 10; i++) await q.mouse.move(v.x + (92 + i * 1.5) * e, v.y + (70 + i * 8) * e);
      await q.mouse.up(); await q.waitForTimeout(200); }
    await q.click('#treuGo');
    await q.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 600000 });
    await q.waitForTimeout(300);
    if (!(await q.locator('.hitem span').allInnerTexts()).some(t => t.startsWith('Esborra les ratllades (IA)'))) problemes.push('esborrar les ratllades no surt a l\'historial');
    if (await vives() !== 'treu') problemes.push('en esborrar, la IA de les ratllades no s\'ha deixat anar de la memòria: ' + await vives());
    const c2 = await compara();
    if (!(c2.err < c1.errVella * 0.25)) problemes.push(`a les ratllades marcades, la foto no s'acosta prou a la neta (diferència ${c2.err.toFixed(1)}; abans ${c1.errVella.toFixed(1)})`);
    if (c2.canviFora > 0.5) problemes.push(`esborrant les ratllades, ha canviat la resta de la foto (${c2.canviFora.toFixed(2)} de mitjana)`);
    if (c2.zona < c2.zonaVella * 0.8) problemes.push(`on s'havia tret el vermell amb la goma, la ratllada s'ha esborrat igualment (diferència ${c2.zona.toFixed(1)} de ${c2.zonaVella.toFixed(1)})`);
    await q.click('#btnUndo'); await q.waitForTimeout(400);
    if ((await compara()).err < c1.errVella * 0.9) problemes.push('desfer no torna les ratllades');
    // tornar a buscar-les: la IA es torna a preparar de la memòria del navegador, sense baixar res
    { const baixats = []; const apunta = r => { if (/\.onnx/.test(r.url())) baixats.push(r.url()); }; q.on('request', apunta);
      await obreTargeta(q, 'ratllades'); await q.click('#treuRatllades');
      await q.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 600000 }); await q.waitForTimeout(300);
      q.off('request', apunta);
      if (await vives() !== 'ratllades') problemes.push('tornant a buscar ratllades, a la memòria no hi ha només la seva IA: ' + await vives());
      if (baixats.length) problemes.push('tornant a buscar ratllades, la IA s\'ha tornat a baixar: ' + baixats);
      if ((await compara()).trobat < 0.7) problemes.push('la segona vegada, la IA de les ratllades no les troba'); }
    console.log(`${problemes.length > abansR ? '✗' : '✓'} trobar i esborrar ratllades (pel processador): en marca el ${(c1.trobat * 100).toFixed(0)}% (i de més, el ${(c1.demes * 100).toFixed(2)}%), la goma les respecta, les marcades, de ${c1.errVella.toFixed(0)} a ${c2.err.toFixed(0)} de diferència amb la foto neta, i desfer`);
    await q.close();
  }

  // ------------------------------------------------- arreglar les cares
  // Una cara dibuixada aquí mateix (cabell, ulls, nas, boca) i borrosa: la IA
  // l'ha de trobar i tornar-la nítida, al seu lloc (els ulls on eren), sense
  // tocar la resta de la foto. «Suau» n'ha de canviar menys que «Fort». En una
  // foto sense cares, ho ha de dir. No es fa servir la foto de ningú.
  if (vol('cares')) {
    const abansC = problemes.length; let sepiaDisp = null;
    const q = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
    vigila(q, 'cares');
    const demanatsC = [];
    q.on('request', r => { const m = r.url().match(/(codeformer|cares-arregla)[^/]*$/); if (m) demanatsC.push(m[0]); });
    await q.goto(BASE);
    await q.waitForTimeout(1500);
    const dibuix = await q.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 720; c.height = 480; const x = c.getContext('2d');
      x.fillStyle = '#788ca0'; x.fillRect(0, 0, 720, 480);
      x.fillStyle = '#5a7a4a'; x.fillRect(0, 380, 720, 100);
      x.filter = 'blur(2px)';
      const el = (cx, cy, rx, ry, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fill(); };
      el(240, 195, 100, 135, '#462d1e');                       // cabell
      el(150, 220, 15, 30, '#d7aa8c'); el(330, 220, 15, 30, '#d7aa8c');   // orelles
      el(240, 220, 80, 120, '#e1b496');                        // cara
      for (const ex of [200, 280]) {
        el(ex, 207, 22, 12, '#fafafa'); el(ex, 207, 9, 9, '#463228'); el(ex, 207, 4, 4, '#0a0a0a');
        x.strokeStyle = '#3c281e'; x.lineWidth = 6; x.beginPath(); x.moveTo(ex - 25, 180); x.lineTo(ex + 22, 176); x.stroke();
      }
      x.fillStyle = '#cd9b7d'; x.beginPath(); x.moveTo(240, 215); x.lineTo(225, 265); x.lineTo(255, 265); x.fill();
      el(240, 295, 35, 10, '#aa4646');
      x.fillStyle = '#e1b496'; x.fillRect(180, 335, 120, 145);
      x.fillStyle = '#283c64'; x.fillRect(120, 400, 240, 80);
      x.filter = 'none';
      x.fillStyle = '#c8a050'; x.fillRect(560, 60, 120, 120);   // un quadre a la paret, lluny de la cara
      return c.toDataURL('image/png');
    });
    const original = Buffer.from(dibuix.split(',')[1], 'base64');
    const obre = async () => { await q.setInputFiles('#file', { name: 'cara.png', mimeType: 'image/png', buffer: original }); await q.waitForTimeout(600); };
    // ia: 'codeformer' (amb semb, de 0 a 1) o 'gfpgan' (amb la força)
    const arregla = async (ia, opc) => {
      await obreTargeta(q, 'cares'); await q.click('#caresIA-' + ia);
      if (ia === 'gfpgan') await q.click('#caresF-' + opc);
      else await q.evaluate(v => { const r = document.querySelector('#caresSemb'); r.value = String(v); r.dispatchEvent(new Event('input')); }, opc);
      await q.click('#cares');
      await q.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 600000 });
      await q.waitForTimeout(300);
    };
    // nitidesa (quant canvia d'un punt al del costat) i diferència amb l'original, en un rectangle
    const mira = r => q.evaluate(async ([r, orig]) => {
      const i = new Image(); await new Promise(ok => { i.onload = ok; i.src = 'data:image/png;base64,' + orig; });
      const c = document.createElement('canvas'); c.width = 720; c.height = 480; const x = c.getContext('2d'); x.drawImage(i, 0, 0);
      const o = x.getImageData(r[0], r[1], r[2], r[3]).data, d = document.querySelector('#view').getContext('2d').getImageData(r[0], r[1], r[2], r[3]).data;
      const l = (a, k) => (a[k] + a[k + 1] + a[k + 2]) / 3;
      let nit = 0, nit0 = 0, dif = 0, max = 0;
      for (let k = 0; k < d.length; k += 4) {
        if ((k / 4) % r[2] < r[2] - 1) { nit += Math.abs(l(d, k + 4) - l(d, k)); nit0 += Math.abs(l(o, k + 4) - l(o, k)); }
        const e = Math.max(Math.abs(d[k] - o[k]), Math.abs(d[k + 1] - o[k + 1]), Math.abs(d[k + 2] - o[k + 2]));
        dif += e; max = Math.max(max, e);
      }
      const n = d.length / 4; return { nit: nit / n, nit0: nit0 / n, dif: dif / n, max };
    }, [r, original.toString('base64')]);
    const ull = async (x, y) => (await q.evaluate(([x, y]) => [...document.querySelector('#view').getContext('2d').getImageData(x - 2, y - 2, 5, 5).data]
      .reduce((s, v, i) => i % 4 === 3 ? s : s + v, 0) / 75, [x, y]));

    await obre();
    if (!(await q.locator('#caresInfo').innerText()).includes('MB')) problemes.push('el botó de les cares no diu quant es baixa la primera vegada');
    // de partida, CodeFormer, amb el control al mig
    await obreTargeta(q, 'cares');
    if (await q.getAttribute('#caresIA-codeformer', 'aria-pressed') !== 'true' || !await q.locator('#caresSemb').isVisible()) problemes.push('a les cares, de partida no hi ha CodeFormer triat amb el seu control');
    await arregla('codeformer', 0.5);
    if (!(await q.locator('.hitem span').allInnerTexts()).includes('Arregla les cares (1 · CodeFormer)')) problemes.push('arreglar les cares amb CodeFormer no surt a l\'historial amb 1 cara: ' + (await q.locator('.hitem span').allInnerTexts()).join(' · '));
    if (demanatsC.sort().join() !== 'codeformer-q8.onnx.1,codeformer-q8.onnx.2') problemes.push('CodeFormer no s\'ha baixat en els seus dos trossos: ' + demanatsC);
    const cara = await mira([170, 150, 140, 170]), fora = await mira([540, 40, 160, 160]);
    if (!(cara.nit > cara.nit0 * 1.3)) problemes.push(`la cara arreglada no és més nítida (${cara.nit.toFixed(2)} contra ${cara.nit0.toFixed(2)})`);
    if (fora.max > 0) problemes.push(`arreglant la cara ha canviat el quadre de la paret, lluny de la cara (${fora.max})`);
    // els ulls continuen on eren (si la cara es tornés a un altre lloc, no hi serien)
    for (const ex of [200, 280]) { const v = await ull(ex, 207); if (v > 110) problemes.push(`després d'arreglar la cara, l'ull de ${ex},207 ja no hi és (lluminositat ${v.toFixed(0)})`); }
    if (!(await q.locator('#caresRes').innerText()).includes('amb el processador')) problemes.push('després d\'arreglar les cares no diu amb què s\'ha fet');
    await q.click('#btnUndo'); await q.waitForTimeout(300);
    if ((await mira([170, 150, 140, 170])).max > 0) problemes.push('desfer no torna la cara d\'abans');
    // «més semblant» ha de canviar la cara menys que «més nítida», i no s'ha de
    // tornar a baixar res
    await arregla('codeformer', 0);
    const nitida = await mira([170, 150, 140, 170]);
    await q.click('#btnUndo'); await q.waitForTimeout(300);
    await arregla('codeformer', 1);
    const semblant = await mira([170, 150, 140, 170]);
    if (!(semblant.dif < nitida.dif * 0.85)) problemes.push(`a CodeFormer, «més semblant» canvia la cara tant com «més nítida» (${semblant.dif.toFixed(1)} contra ${nitida.dif.toFixed(1)})`);
    if (demanatsC.length !== 2) problemes.push('CodeFormer s\'ha tornat a baixar: ' + demanatsC);
    await q.click('#btnUndo'); await q.waitForTimeout(300);
    // GFPGAN, la d'abans: «Suau» menys que «Fort»
    await arregla('gfpgan', 'fort');
    const fort = await mira([170, 150, 140, 170]);
    if (!(fort.nit > fort.nit0 * 1.3)) problemes.push(`la cara arreglada amb GFPGAN no és més nítida (${fort.nit.toFixed(2)} contra ${fort.nit0.toFixed(2)})`);
    if (!(await q.locator('.hitem span').allInnerTexts()).includes('Arregla les cares (1)')) problemes.push('arreglar les cares amb GFPGAN no surt a l\'historial');
    const difFort = fort.dif;
    await q.click('#btnUndo'); await q.waitForTimeout(300);
    await arregla('gfpgan', 'suau');
    const suau = await mira([170, 150, 140, 170]);
    if (!(suau.dif < difFort * 0.75)) problemes.push(`«Suau» canvia la cara tant com «Fort» (${suau.dif.toFixed(1)} contra ${difFort.toFixed(1)})`);
    // en sèpia, la cara arreglada ha de quedar del to de la foto, no de colors
    // (amb una foto de l'usuari, CodeFormer hi posava ulls blaus i llavis rosats)
    { await q.click('#btnUndo').catch(() => {}); await q.waitForTimeout(200);
      const sepia = Buffer.from((await q.evaluate(async orig => { const i = new Image(); await new Promise(ok => { i.onload = ok; i.src = 'data:image/png;base64,' + orig; });
        const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0);
        const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
        for (let k = 0; k < d.length; k += 4) { const g = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]; d[k] = Math.min(255, g * 1.07); d[k + 1] = g * 0.95; d[k + 2] = g * 0.78; }
        x.putImageData(im, 0, 0); return c.toDataURL('image/png'); }, original.toString('base64'))).split(',')[1], 'base64');
      await q.setInputFiles('#file', { name: 'sepia.png', mimeType: 'image/png', buffer: sepia }); await q.waitForTimeout(500);
      await arregla('codeformer', 0.5);
      // la dispersió del to (en graus) dels punts de la cara amb color: la sèpia, gairebé un sol to
      const dispersio = await q.evaluate(() => { const v = document.querySelector('#view'), e = v.width / 720, d = v.getContext('2d').getImageData(Math.round(170 * e), Math.round(150 * e), Math.round(140 * e), Math.round(170 * e)).data;
        let sx = 0, sy = 0, n = 0; for (let k = 0; k < d.length; k += 4) { const r = d[k], g = d[k + 1], b = d[k + 2], a = r - (g + b) / 2, bb = (g - b) * 0.866, cr = Math.hypot(a, bb); if (cr > 6) { sx += a / cr; sy += bb / cr; n++; } }
        const R = n ? Math.hypot(sx, sy) / n : 1; return Math.sqrt(-2 * Math.log(Math.max(R, 1e-9))) * 180 / Math.PI; });
      if (!(await q.locator('.hitem span').allInnerTexts()).some(t => t.startsWith('Arregla les cares'))) problemes.push('en una foto en sèpia, no s\'ha arreglat la cara');
      else if (dispersio > 4) problemes.push(`en una foto en sèpia, la cara arreglada surt de colors (el to varia ${dispersio.toFixed(1)}°; la sèpia, gairebé gens)`);
      sepiaDisp = dispersio; }
    // una foto sense cares (la d'exemple): ho diu i no hi toca
    await q.setInputFiles('#file', { name: 'paisatge.png', mimeType: 'image/png', buffer: Buffer.from((await q.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 300;
      const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, '#5b8fd0'); g.addColorStop(1, '#3a5a2a'); x.fillStyle = g; x.fillRect(0, 0, 400, 300); return c.toDataURL('image/png'); })).split(',')[1], 'base64') });
    await q.waitForTimeout(500);
    await arregla('codeformer', 0.5);
    if (!(await q.locator('#stMsg').innerText()).includes('No he trobat cap cara') || (await q.locator('.hitem span').allInnerTexts()).length !== 1)
      problemes.push('en una foto sense cares, no diu que no n\'ha trobat cap o hi ha tocat');
    console.log(`${problemes.length > abansC ? '✗' : '✓'} arreglar les cares (pel processador): troba la cara dibuixada, CodeFormer (nitidesa de ${cara.nit0.toFixed(1)} a ${cara.nit.toFixed(1)}; «semblant» canvia ${semblant.dif.toFixed(1)} i «nítida» ${nitida.dif.toFixed(1)}), GFPGAN («Suau» menys que «Fort»), en sèpia la cara es queda del to de la foto (${sepiaDisp == null ? '?' : sepiaDisp.toFixed(1)}°), els ulls al seu lloc, la resta igual, sense cares ho diu, i desfer`);
    await q.close();
  }

  // ------------------------------------------------- treure el fons
  // Un gerro blau sobre una paret amb taques i una taula: se sap exactament
  // quins punts són el gerro. Transparent, blanc, d'un color i difuminat (sense
  // aura del color del gerro al voltant), desar en JPG i PNG, desfer, i el model
  // gran una vegada.
  if (vol('fons')) {
    const abansF = problemes.length;
    const q = await navegador.newPage({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
    vigila(q, 'fons');
    const demanats = [];
    q.on('request', r => { const m = r.url().match(/birefnet[^/]*$/); if (m) demanats.push(m[0]); });
    await q.goto(BASE);
    await q.waitForTimeout(1500);
    const dades = await q.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 600; c.height = 450; const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, 450); g.addColorStop(0, '#d2c6b0'); g.addColorStop(1, '#8c8270'); x.fillStyle = g; x.fillRect(0, 0, 600, 450);
      x.filter = 'blur(10px)';
      [['#b48cd2', 120, 80, 50], ['#d28c78', 200, 160, 45], ['#8cc8b4', 450, 70, 40], ['#c8b48c', 500, 220, 55]].forEach(([col, cx, cy, r]) => { x.fillStyle = col; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); });
      x.filter = 'none'; x.fillStyle = '#6e4f37'; x.fillRect(0, 340, 600, 110);
      const gg = x.createRadialGradient(260, 190, 10, 300, 250, 170); gg.addColorStop(0, '#3a74d0'); gg.addColorStop(1, '#0e2448');
      x.fillStyle = gg; x.beginPath(); x.ellipse(300, 250, 80, 110, 0, 0, 7); x.fill();
      x.fillRect(270, 100, 60, 60); x.beginPath(); x.ellipse(300, 100, 42, 16, 0, 0, 7); x.fill();
      return c.toDataURL('image/png');
    });
    const original = Buffer.from(dades.split(',')[1], 'base64');
    const dins = (x, y) => ((x - 300) / 80) ** 2 + ((y - 250) / 110) ** 2 < 1 || (x >= 270 && x < 330 && y >= 100 && y < 160) || ((x - 300) / 42) ** 2 + ((y - 100) / 16) ** 2 < 1;
    const obre = async () => { await q.setInputFiles('#file', { name: 'gerro.png', mimeType: 'image/png', buffer: original }); await q.waitForTimeout(600); };
    const fesho = async (mode, darrere) => {
      await obreTargeta(q, 'fons'); await q.click('#iaMode-' + mode); await q.click('#fonsD-' + darrere);
      await q.click('#fonsGo');
      await q.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 300000 });
      await q.waitForTimeout(300);
    };
    const punts = () => q.evaluate(() => { const v = document.querySelector('#view'); return [...v.getContext('2d').getImageData(0, 0, v.width, v.height).data]; });
    const at = (d, x, y) => d.slice((y * 600 + x) * 4, (y * 600 + x) * 4 + 4);
    // com d'encertat: mirant un punt de cada 6, quants coincideixen amb el gerro
    const encert = d => { let si = 0, tot = 0;
      for (let y = 3; y < 450; y += 6) for (let x = 3; x < 600; x += 6) {
        const m = dins(x, y), r = (y - 250) ** 2 + (x - 300) ** 2; if (Math.abs(Math.sqrt(r) - 95) < 18) continue;   // la vora, no
        tot++; if ((at(d, x, y)[3] > 127) === m) si++; }
      return si / tot; };

    await obre();
    await fesho('mobil', 'transparent');
    let d = await punts();
    const e1 = encert(d);
    if (e1 < 0.97) problemes.push(`treient el fons (mòbil), no encerta el gerro: ${(e1 * 100).toFixed(1)}% dels punts`);
    if (at(d, 300, 260)[3] < 250 || at(d, 30, 30)[3] > 5) problemes.push(`treient el fons, el gerro no queda sencer o el fons no queda transparent (${at(d, 300, 260)[3]}, ${at(d, 30, 30)[3]})`);
    if (!(await q.locator('.hitem span').allInnerTexts()).includes('Treu el fons (transparent)')) problemes.push('treure el fons no surt a l\'historial');
    if (!(await q.locator('#fonsFet').innerText()).includes('PNG')) problemes.push('després de treure el fons no diu que per desar-la transparent cal PNG');
    // desant: en JPG el fons surt blanc (i ho avisa); en PNG, transparent
    {
      const desa = async fmt => {
        await q.click('#btnSave'); await q.waitForTimeout(300);
        await q.locator('.dlg .chip', { hasText: fmt }).click(); await q.waitForTimeout(100);
        const avis = await q.locator('#expAvis').innerText();
        const b = q.waitForEvent('download'); await q.click('.dlg .btn.primary');
        const f = readFileSync(await (await b).path()).toString('base64');
        const c = await q.evaluate(async ([f, mime]) => { const i = new Image(); await new Promise(ok => { i.onload = ok; i.src = 'data:' + mime + ';base64,' + f; });
          const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0);
          return [...x.getImageData(30, 30, 1, 1).data]; }, [f, fmt === 'JPG' ? 'image/jpeg' : 'image/png']);
        return { avis, c };
      };
      const j = await desa('JPG');
      if (!j.avis.includes('JPG no guarda')) problemes.push('desant en JPG una foto sense fons, no avisa que el fons sortirà blanc');
      if (Math.min(...j.c.slice(0, 3)) < 235) problemes.push(`desant en JPG una foto sense fons, el fons no surt blanc (${j.c.slice(0, 3)})`);
      const pn = await desa('PNG');
      if (pn.c[3] > 5) problemes.push('desant en PNG, el fons no queda transparent');
    }
    // desfer torna el fons
    await q.click('#btnUndo'); await q.waitForTimeout(300);
    if ((await punts())[(30 * 600 + 30) * 4 + 3] !== 255) problemes.push('desfer no torna el fons');

    // blanc i d'un color
    await fesho('mobil', 'blanc');
    d = await punts();
    if (Math.min(...at(d, 30, 30).slice(0, 3)) < 245 || at(d, 300, 260)[2] < 80) problemes.push(`amb fons blanc, el fons no és blanc o el gerro no hi és (${at(d, 30, 30)}, ${at(d, 300, 260)})`);
    await q.click('#btnUndo'); await q.waitForTimeout(300);
    await q.click('#fonsD-color');
    await q.evaluate(() => { const i = document.querySelector('#fonsColor'); i.value = '#00c000'; i.dispatchEvent(new Event('input')); });
    await fesho('mobil', 'color');
    d = await punts();
    { const c = at(d, 30, 30); if (!(c[1] > 170 && c[0] < 30 && c[2] < 30)) problemes.push(`amb fons de color verd, el fons és ${c.slice(0, 3)}`); }
    await q.click('#btnUndo'); await q.waitForTimeout(300);

    // difuminat: el fons es difumina, el gerro no, i al voltant del gerro no hi
    // queda una aura blava (el fons es difumina sense el gerro)
    const abans = await punts();
    await fesho('mobil', 'difuminat');
    d = await punts();
    // la nitidesa: el salt més gran d'un punt al de sota, a la vora de la taula
    // (que és ben nítida); difuminada, el salt es reparteix i es fa petit
    const nitidesa = dd => { let s = 0, n = 0; const l = (x, y) => { const v = at(dd, x, y); return (v[0] + v[1] + v[2]) / 3; };
      for (let x = 30; x < 150; x++) { let m = 0; for (let y = 320; y < 360; y++) m = Math.max(m, Math.abs(l(x, y + 1) - l(x, y))); s += m; n++; } return s / n; };
    if (!(nitidesa(d) < nitidesa(abans) * 0.6)) problemes.push(`amb el fons difuminat, el fons no està més difuminat (nitidesa ${nitidesa(d).toFixed(2)} contra ${nitidesa(abans).toFixed(2)})`);
    { const g = at(d, 300, 260), g0 = at(abans, 300, 260); if (Math.max(...g.map((v, i) => Math.abs(v - g0[i]))) > 6) problemes.push('amb el fons difuminat, el gerro també ha canviat'); }
    // a 12 punts de la vora del gerro, la paret (que era llisa) ha de ser com era:
    // amb aura, s'hi enfosqueix i s'hi torna blavosa fins a 25 nivells
    for (const [x, y] of [[392, 250], [208, 250], [300, 372]]) {
      const c = at(d, x, y), c0 = at(abans, x, y);
      if (Math.max(...[0, 1, 2].map(i => Math.abs(c[i] - c0[i]))) > 8) problemes.push(`amb el fons difuminat, al voltant del gerro hi queda una aura blava (${x},${y}: ${c.slice(0, 3)} i abans ${c0.slice(0, 3)})`);
    }
    if (!(await q.locator('.hitem span').allInnerTexts()).includes('Difumina el fons')) problemes.push('difuminar el fons no surt a l\'historial');
    await q.click('#btnUndo'); await q.waitForTimeout(300);

    // el model gran (el de l'ordinador), una vegada
    await fesho('ordinador', 'transparent');
    const e2 = encert(await punts());
    if (e2 < 0.97) problemes.push(`treient el fons (ordinador), no encerta el gerro: ${(e2 * 100).toFixed(1)}% dels punts`);
    if (!(await q.locator('#fonsFet').innerText()).includes('amb el processador')) problemes.push('després de treure el fons no diu amb què s\'ha fet');
    // el gran és el BiRefNet, en tres trossos, i la targeta ho diu
    if (demanats.sort().join() !== 'birefnet-512-q8.onnx.1,birefnet-512-q8.onnx.2,birefnet-512-q8.onnx.3') problemes.push('el model gran del fons no s\'ha baixat en els tres trossos del BiRefNet: ' + demanats);
    if (!(await q.locator('#pane-fons').innerText()).includes('BiRefNet')) problemes.push('la targeta del fons no diu que el mode Ordinador fa servir BiRefNet');
    // la segona vegada no torna a baixar res
    await q.click('#btnUndo'); await q.waitForTimeout(300);
    const nDemanats = demanats.length;
    await fesho('ordinador', 'blanc');
    if (demanats.length !== nDemanats) problemes.push('la segona vegada, el BiRefNet es torna a baixar');
    console.log(`${problemes.length > abansF ? '✗' : '✓'} treure el fons (pel processador): transparent (encerta el ${(e1 * 100).toFixed(1)}% amb el model petit i el ${(e2 * 100).toFixed(1)}% amb el gran), blanc, d'un color, difuminat sense aura, desar en JPG i PNG, i desfer`);
    await q.close();
  }
  // ------------------------------------------------- posar color
  // Un paisatge en grisos dibuixat aquí (cel, muntanyes, mar, sorra): que hi
  // posi color, que la claredat de cada punt sigui la mateixa d'abans (el
  // detall és el de la foto), que «Suau» faci els colors més apagats, que la
  // segona vegada no torni a baixar res, desfer, i que avisi si la foto ja té
  // colors (però no si és sèpia).
  if (vol('color')) {
    const abansCo = problemes.length;
    const q = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
    vigila(q, 'color');
    let baixades = 0;
    q.on('request', r => { if (/color\.onnx\.\d/.test(r.url())) baixades++; });
    await q.goto(BASE);
    await q.waitForTimeout(1500);
    const fes = to => q.evaluate(to => {
      const c = document.createElement('canvas'); c.width = 600; c.height = 400; const x = c.getContext('2d');
      let g = x.createLinearGradient(0, 0, 0, 220); g.addColorStop(0, '#5a8ac8'); g.addColorStop(1, '#d8e6f0'); x.fillStyle = g; x.fillRect(0, 0, 600, 220);
      x.fillStyle = '#4f6a3a'; x.beginPath(); x.moveTo(0, 220); [[80, 120], [170, 175], [260, 95], [380, 180], [470, 130], [600, 200], [600, 230], [0, 230]].forEach(([a, b]) => x.lineTo(a, b)); x.fill();
      g = x.createLinearGradient(0, 230, 0, 320); g.addColorStop(0, '#2e6f9a'); g.addColorStop(1, '#1d4f73'); x.fillStyle = g; x.fillRect(0, 225, 600, 95);
      x.fillStyle = '#d9c39a'; x.fillRect(0, 320, 600, 80);
      let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(0,0,0,${rnd() * 0.08})`; x.fillRect(rnd() * 600, 320 + rnd() * 80, 2, 2); }
      if (to !== 'color') {
        const d = x.getImageData(0, 0, 600, 400), p = d.data;
        for (let i = 0; i < p.length; i += 4) { const v = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
          if (to === 'sepia') { p[i] = Math.min(255, v * 1.07); p[i + 1] = v * 0.88; p[i + 2] = v * 0.68; } else p[i] = p[i + 1] = p[i + 2] = v; }
        x.putImageData(d, 0, 0);
      }
      return c.toDataURL('image/png');
    }, to);
    const obre = async (to) => { await q.setInputFiles('#file', { name: to + '.png', mimeType: 'image/png', buffer: Buffer.from((await fes(to)).split(',')[1], 'base64') }); await q.waitForTimeout(700); };
    // la claredat (L) i el color (a, b) de cada punt del que es veu
    const lab = () => q.evaluate(() => {
      const v = document.querySelector('#view'), d = v.getContext('2d').getImageData(0, 0, v.width, v.height).data;
      const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }, f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
      const L = [], A = [], B = [];
      for (let i = 0; i < d.length; i += 4) { const r = lin(d[i]), g = lin(d[i + 1]), b = lin(d[i + 2]);
        const fx = f((0.412453 * r + 0.357580 * g + 0.180423 * b) / 0.950456), fy = f(0.212671 * r + 0.715160 * g + 0.072169 * b), fz = f((0.019334 * r + 0.119193 * g + 0.950227 * b) / 1.088754);
        L.push(116 * fy - 16); A.push(500 * (fx - fy)); B.push(200 * (fy - fz)); }
      return { L, A, B, w: v.width };
    });
    const croma = m => m.A.reduce((s, a, i) => s + Math.hypot(a, m.B[i]), 0) / m.A.length;
    const fesho = async (forca) => {
      await obreTargeta(q, 'color'); await q.click('#iaMode-mobil'); await q.click('#colorF-' + forca);
      await q.click('#colorGo');
      await q.waitForTimeout(300);
      await q.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 600000 });
      await q.waitForTimeout(300);
    };
    await obre('gris');
    const m0 = await lab();
    await obreTargeta(q, 'color');
    const info0 = await q.locator('#colorInfo').innerText();
    if (!info0.includes('MB')) problemes.push('el color no diu quant es baixa la primera vegada: ' + info0);
    if (info0.includes('ja té colors')) problemes.push('una foto en grisos diu que ja té colors');
    await fesho('fort');
    const m1 = await lab(), c1 = croma(m1);
    const dL = m1.L.reduce((s, l, i) => s + Math.abs(l - m0.L[i]), 0) / m1.L.length;
    // el cel (la franja de dalt) i el mar: de quin color han quedat
    const franja = (m, y0, y1) => { let a = 0, b = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = 0; x < m.w; x++) { a += m.A[y * m.w + x]; b += m.B[y * m.w + x]; n++; } return [a / n, b / n]; };
    const cel = franja(m1, 5, 60);
    if (c1 < 6) problemes.push(`posar color no hi posa prou color (croma mitjana ${c1.toFixed(1)})`);
    if (dL > 1.5) problemes.push(`posar color canvia la claredat de la foto (${dL.toFixed(2)} de mitjana): el detall ha de ser el de la foto`);
    if (!(cel[1] < -3)) problemes.push(`el cel no ha quedat blau (a ${cel[0].toFixed(1)}, b ${cel[1].toFixed(1)}): potser a i b van girats`);
    if (!(await q.locator('.hitem span').allInnerTexts()).includes('Posa color')) problemes.push('posar color no surt a l\'historial');
    const res = await q.locator('#colorRes');
    if (await res.isHidden() || !(await res.innerText()).startsWith('✓')) problemes.push('després de posar color no diu «✓ Color posat»');
    const baixadesAbans = baixades;
    // desfer torna la foto en grisos
    await q.keyboard.press('Control+z'); await q.waitForTimeout(400);
    if (croma(await lab()) > 0.5) problemes.push('desfer no torna la foto en grisos');
    // «Suau», la segona vegada: colors més apagats i sense baixar res
    await fesho('suau');
    const c2 = croma(await lab());
    if (!(c2 > c1 * 0.4 && c2 < c1 * 0.6)) problemes.push(`«Suau» no apaga els colors a la meitat (fort ${c1.toFixed(1)}, suau ${c2.toFixed(1)})`);
    if (baixades !== baixadesAbans) problemes.push('la segona vegada, el color torna a baixar la IA');
    // una foto que ja té colors ho diu; una de sèpia, no
    await obre('color'); await obreTargeta(q, 'color');
    if (!(await q.locator('#colorInfo').innerText()).includes('ja té colors')) problemes.push('amb una foto en color no avisa que la IA li canviarà els colors');
    await obre('sepia'); await obreTargeta(q, 'color');
    if ((await q.locator('#colorInfo').innerText()).includes('ja té colors')) problemes.push('una foto en sèpia diu que ja té colors');
    console.log(`${problemes.length > abansCo ? '✗' : '✓'} posar color (pel processador): croma ${c1.toFixed(1)}, el cel blau (b ${cel[1].toFixed(1)}), la claredat igual (${dL.toFixed(2)}), «Suau» ${c2.toFixed(1)}, la segona vegada sense baixar res, desfer, i l'avís de les fotos que ja tenen colors (no amb la sèpia)`);
    await q.close();
  }
  // ------------------------------------- restaurar una foto antiga, tot seguit
  // Una foto vella feta aquí: descolorida, amb una cara dibuixada i borrosa,
  // soroll i dues ratllades clares lluny de la cara. Amb els quatre passos
  // triats, s'han de fer tots seguits, cadascun apuntat a l'Historial, dient
  // per quin pas va, i al final només hi ha d'haver una IA a la memòria.
  if (vol('antiga')) {
    const abansA = problemes.length;
    const q = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
    vigila(q, 'antiga');
    await q.goto(BASE);
    await q.waitForTimeout(1500);
    const foto = await q.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 720; c.height = 480; const x = c.getContext('2d');
      x.fillStyle = '#788ca0'; x.fillRect(0, 0, 720, 480);
      x.fillStyle = '#5a7a4a'; x.fillRect(0, 380, 720, 100);
      x.filter = 'blur(2px)';
      const el = (cx, cy, rx, ry, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fill(); };
      el(240, 195, 100, 135, '#462d1e'); el(150, 220, 15, 30, '#d7aa8c'); el(330, 220, 15, 30, '#d7aa8c'); el(240, 220, 80, 120, '#e1b496');
      for (const ex of [200, 280]) { el(ex, 207, 22, 12, '#fafafa'); el(ex, 207, 9, 9, '#463228'); el(ex, 207, 4, 4, '#0a0a0a');
        x.strokeStyle = '#3c281e'; x.lineWidth = 6; x.beginPath(); x.moveTo(ex - 25, 180); x.lineTo(ex + 22, 176); x.stroke(); }
      x.fillStyle = '#cd9b7d'; x.beginPath(); x.moveTo(240, 215); x.lineTo(225, 265); x.lineTo(255, 265); x.fill();
      el(240, 295, 35, 10, '#aa4646');
      x.fillStyle = '#e1b496'; x.fillRect(180, 335, 120, 145); x.fillStyle = '#283c64'; x.fillRect(120, 400, 240, 80);
      x.filter = 'none';
      // amb els colors esvaïts i amb soroll (del tot en gris i ja sense soroll, la
      // cara dibuixada és tan llisa que la IA no la veu com una cara)
      const im = x.getImageData(0, 0, 720, 480), d = im.data; let s = 5;
      for (let k = 0; k < d.length; k += 4) { s = (s * 1103515245 + 12345) >>> 0; const g = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2], r = ((s >>> 8) / 16777216 - 0.5) * 26;
        for (let j = 0; j < 3; j++) d[k + j] = g + (d[k + j] - g) * 0.35 + r; }
      x.putImageData(im, 0, 0);
      // dues ratllades clares, lluny de la cara
      x.lineCap = 'round';
      const corba = (p0, p1, amp) => Array.from({ length: 50 }, (_, i) => [p0[0] + (p1[0] - p0[0]) * i / 49, p0[1] + (p1[1] - p0[1]) * i / 49 + amp * Math.sin(i / 49 * 3)]);
      for (const [pts, gruix] of [[corba([470, 20], [690, 300], 14), 3], [corba([400, 330], [700, 460], 10), 3]]) {
        x.strokeStyle = '#f7f4ee'; x.lineWidth = gruix; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); }
      return c.toDataURL('image/png');
    });
    await q.setInputFiles('#file', { name: 'avis.png', mimeType: 'image/png', buffer: Buffer.from(foto.split(',')[1], 'base64') });
    await q.waitForTimeout(600);
    await obreTargeta(q, 'antiga');
    // els passos a mà són a «Tria tu els passos», tancat de partida
    if (await q.locator('#antigaPassos').isVisible()) problemes.push('a «Arregla-la tota», els passos a mà es veuen sense obrir «Tria tu els passos»');
    await q.click('#antigaTria'); await q.waitForTimeout(200);
    // de partida: ratllades, soroll i cares, sense el color; i diu quant es baixa
    const triats = () => q.evaluate(() => [...document.querySelectorAll('#antigaPassos .chip')].filter(c => c.getAttribute('aria-pressed') === 'true').map(c => c.id.slice(8)).join());
    if (await triats() !== 'ratllades,soroll,cares') problemes.push('a «Restaura una foto antiga», de partida no hi ha ratllades, soroll i cares: ' + await triats());
    if (!(await q.locator('#antigaInfo').innerText()).includes('MB')) problemes.push('«Restaura una foto antiga» no diu quant es baixa la primera vegada');
    await q.click('#antigaP-color');
    if (!(await q.locator('#antigaInfo').innerText()).includes('inventa')) problemes.push('triant el color, no diu que els colors són inventats');
    // sense cap pas, no es pot prémer
    for (const k of ['ratllades', 'soroll', 'cares', 'color']) await q.click('#antigaP-' + k);
    if (!await q.locator('#antigaGo').isDisabled()) problemes.push('sense cap pas triat, «Restaura-la» es pot prémer');
    for (const k of ['ratllades', 'soroll', 'cares', 'color']) await q.click('#antigaP-' + k);
    // el que es veu del vel mentre treballa
    await q.evaluate(() => { window.__passos = new Set(); new MutationObserver(() => { const m = document.querySelector('#velText').textContent.match(/^Pas \d de \d/); if (m) window.__passos.add(m[0]); })
      .observe(document.querySelector('#velText'), { childList: true, characterData: true, subtree: true }); });
    const color0 = await q.evaluate(() => { const v = document.querySelector('#view'), d = v.getContext('2d').getImageData(0, 0, v.width, v.height).data; let t = 0;
      for (let k = 0; k < d.length; k += 4) t += Math.max(d[k], d[k + 1], d[k + 2]) - Math.min(d[k], d[k + 1], d[k + 2]); return t / (d.length / 4); });
    const mira = () => q.evaluate(() => { const v = document.querySelector('#view'), x = v.getContext('2d'), e = v.width / 720;
      const tros = (a, b, w, h) => x.getImageData(Math.round(a * e), Math.round(b * e), Math.round(w * e), Math.round(h * e));
      // soroll: quant canvia d'un punt al del costat en un tros llis del fons
      const f = tros(40, 30, 80, 80), fd = f.data; let sor = 0, n = 0;
      for (let k = 0; k + 4 < fd.length; k += 4) { if ((k / 4) % f.width < f.width - 1) { sor += Math.abs(fd[k] - fd[k + 4]); n++; } }
      // la ratllada de dalt a la dreta: el punt més clar d'un tros que travessa
      const r = tros(540, 80, 80, 80).data; let clar = 0; for (let k = 0; k < r.length; k += 4) clar = Math.max(clar, Math.min(r[k], r[k + 1], r[k + 2]));
      const t = tros(0, 0, 720, 480).data; let col = 0; for (let k = 0; k < t.length; k += 4) col += Math.max(t[k], t[k + 1], t[k + 2]) - Math.min(t[k], t[k + 1], t[k + 2]);
      return { soroll: sor / n, clar, color: col / (t.length / 4) }; });
    const m0 = await mira();
    await q.click('#antigaGo');
    await q.waitForFunction(() => !document.querySelector('#vel').hidden, null, { timeout: 10000 }).catch(() => {});
    await q.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 1500000 });
    await q.waitForTimeout(500);
    const hist = await q.locator('.hitem span').allInnerTexts(), m1 = await mira();
    const vol_ = ['Esborra les ratllades (IA)', 'Treu el soroll', 'Arregla les cares (1 · CodeFormer)', 'Posa color'];
    if (hist.slice(1).map(t => t.replace(' · LaMa', '')).join('|') !== vol_.join('|')) problemes.push('restaurant la foto antiga, a l\'historial no hi ha els quatre passos per ordre: ' + hist.join(' · '));
    const passos = await q.evaluate(() => [...window.__passos].sort().join());
    if (passos !== 'Pas 1 de 4,Pas 2 de 4,Pas 3 de 4,Pas 4 de 4') problemes.push('mentre restaura, el vel no diu per quin pas va: ' + passos);
    if (!(m1.soroll < m0.soroll * 0.5)) problemes.push(`restaurant la foto antiga, el soroll no ha baixat prou (${m0.soroll.toFixed(1)} → ${m1.soroll.toFixed(1)})`);
    if (!(m1.clar < m0.clar - 40)) problemes.push(`restaurant la foto antiga, la ratllada encara hi és (el punt més clar, ${m0.clar} → ${m1.clar})`);
    if (!(m1.color > m0.color + 4)) problemes.push(`restaurant la foto antiga, no hi ha posat color (${m0.color.toFixed(1)} → ${m1.color.toFixed(1)})`);
    const resu = await q.locator('#antigaRes').innerText();
    if (!resu.includes('✓ Restaurada') || !resu.includes('ratllades tretes, soroll tret, cares arreglades i color posat')) problemes.push('al final no diu què ha fet: ' + resu);
    if (await q.evaluate(() => document.documentElement.dataset.iaVives) !== 'color') problemes.push('després de restaurar, a la memòria no hi ha només l\'última IA: ' + await q.evaluate(() => document.documentElement.dataset.iaVives));
    if (await q.evaluate(() => document.querySelector('#wrap').dataset.tool) === 'treu') problemes.push('després de restaurar, l\'eina es queda a la d\'esborrar');
    // desfer torna pas a pas
    await q.click('#btnUndo'); await q.waitForTimeout(400);
    if (!((await mira()).color < m1.color - 4)) problemes.push('desfer l\'últim pas de la restauració no treu el color');
    // aturar-la a mig fer: es queda el que ja s'havia fet, i ho diu
    await q.setInputFiles('#file', { name: 'avis.png', mimeType: 'image/png', buffer: Buffer.from(foto.split(',')[1], 'base64') });
    await q.waitForTimeout(600);
    await obreTargeta(q, 'antiga');
    await q.click('#antigaGo');
    await q.waitForFunction(() => /^Pas 2 de 4/.test(document.querySelector('#velText').textContent), null, { timeout: 600000 });
    await q.click('#velAtura');
    await q.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 600000 });
    await q.waitForTimeout(400);
    const hist2 = await q.locator('.hitem span').allInnerTexts();
    if (hist2.length !== 2 || !hist2[1].startsWith('Esborra les ratllades')) problemes.push('aturant la restauració al segon pas, a l\'historial no hi ha només el primer: ' + hist2.join(' · '));
    if (!(await q.locator('#antigaRes').innerText()).includes('aturada')) problemes.push('aturant la restauració, no diu que s\'ha aturat: ' + await q.locator('#antigaRes').innerText());
    console.log(`${problemes.length > abansA ? '✗' : '✓'} restaurar una foto antiga (pel processador): els quatre passos seguits i apuntats (soroll de ${m0.soroll.toFixed(1)} a ${m1.soroll.toFixed(1)}, la ratllada de ${m0.clar} a ${m1.clar}, color de ${m0.color.toFixed(1)} a ${m1.color.toFixed(1)}), el pas al vel, una sola IA a la memòria, desfer i aturar`);
    await q.close();
  }

  // ------------------------------------- arreglar-la tota, sola
  // «✦ Arregla-la» mira la foto i decideix sol els passos. Una foto vella (la
  // mateixa de la prova d'abans: descolorida, amb soroll, dues ratllades i
  // una cara borrosa, de 720 punts) ha de passar per tots; una d'avui, gran,
  // nítida i sense cares, no s'ha de tocar ni baixar cap IA grossa; i amb una
  // en blanc i negre, el color només si s'ha marcat.
  if (vol('auto')) {
    const abansU = problemes.length; let esquerdes = null;
    const q = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
    vigila(q, 'auto');
    const baixats = []; q.on('request', r => { const m = r.url().match(/([\w-]+)\.onnx/); if (m) baixats.push(m[1]); });
    await q.goto(BASE); await q.waitForTimeout(1500);
    const foto = await q.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 720; c.height = 480; const x = c.getContext('2d');
      x.fillStyle = '#788ca0'; x.fillRect(0, 0, 720, 480);
      x.fillStyle = '#5a7a4a'; x.fillRect(0, 380, 720, 100);
      x.filter = 'blur(2px)';
      const el = (cx, cy, rx, ry, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fill(); };
      el(240, 195, 100, 135, '#462d1e'); el(150, 220, 15, 30, '#d7aa8c'); el(330, 220, 15, 30, '#d7aa8c'); el(240, 220, 80, 120, '#e1b496');
      for (const ex of [200, 280]) { el(ex, 207, 22, 12, '#fafafa'); el(ex, 207, 9, 9, '#463228'); el(ex, 207, 4, 4, '#0a0a0a');
        x.strokeStyle = '#3c281e'; x.lineWidth = 6; x.beginPath(); x.moveTo(ex - 25, 180); x.lineTo(ex + 22, 176); x.stroke(); }
      x.fillStyle = '#cd9b7d'; x.beginPath(); x.moveTo(240, 215); x.lineTo(225, 265); x.lineTo(255, 265); x.fill();
      el(240, 295, 35, 10, '#aa4646');
      x.fillStyle = '#e1b496'; x.fillRect(180, 335, 120, 145); x.fillStyle = '#283c64'; x.fillRect(120, 400, 240, 80);
      x.filter = 'none';
      // amb els colors esvaïts i amb soroll (del tot en gris i ja sense soroll, la
      // cara dibuixada és tan llisa que la IA no la veu com una cara)
      const im = x.getImageData(0, 0, 720, 480), d = im.data; let s = 5;
      for (let k = 0; k < d.length; k += 4) { s = (s * 1103515245 + 12345) >>> 0; const g = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2], r = ((s >>> 8) / 16777216 - 0.5) * 26;
        for (let j = 0; j < 3; j++) d[k + j] = g + (d[k + j] - g) * 0.35 + r; }
      x.putImageData(im, 0, 0);
      // dues ratllades clares, lluny de la cara
      x.lineCap = 'round';
      const corba = (p0, p1, amp) => Array.from({ length: 50 }, (_, i) => [p0[0] + (p1[0] - p0[0]) * i / 49, p0[1] + (p1[1] - p0[1]) * i / 49 + amp * Math.sin(i / 49 * 3)]);
      for (const [pts, gruix] of [[corba([470, 20], [690, 300], 14), 3], [corba([400, 330], [700, 460], 10), 3]]) {
        x.strokeStyle = '#f7f4ee'; x.lineWidth = gruix; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); }
      return c.toDataURL('image/png');
    });
    const fotoVella = Buffer.from(foto.split(',')[1], 'base64');
    const fes = (w, h, codi) => q.evaluate(([w, h, codi]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); new Function('x', 'w', 'h', codi)(x, w, h); return c.toDataURL('image/png'); }, [w, h, codi]).then(u => Buffer.from(u.split(',')[1], 'base64'));
    const espera = async (max = 1500000) => { await q.waitForFunction(() => !document.querySelector('#vel').hidden, null, { timeout: 8000 }).catch(() => {});
      await q.waitForFunction(() => document.querySelector('#vel').hidden && !document.querySelector('#autoGo').disabled, null, { timeout: max }); await q.waitForTimeout(500); };
    const pla = () => q.evaluate(() => document.documentElement.dataset.autoPla || '');
    const hist = () => q.locator('.hitem span').allInnerTexts();
    // ---- una d'avui: gran, nítida, sense cares ni soroll. Des del botó d'Ajustos.
    const avui = await fes(1600, 1000, `const g=x.createLinearGradient(0,0,0,1000);g.addColorStop(0,'#3a7bd5');g.addColorStop(.6,'#bfe3ff');g.addColorStop(.61,'#3f8f3f');g.addColorStop(1,'#245a24');x.fillStyle=g;x.fillRect(0,0,w,h);
      x.fillStyle='#c0392b';x.fillRect(200,500,300,260);x.fillStyle='#f1c40f';x.beginPath();x.arc(1200,250,90,0,7);x.fill();x.fillStyle='#ecf0f1';x.fillRect(800,560,420,200);
      x.strokeStyle='#222';x.lineWidth=6;for(let i=0;i<12;i++){x.beginPath();x.moveTo(820+i*35,560);x.lineTo(820+i*35,760);x.stroke();}`);
    await q.setInputFiles('#file', { name: 'avui.png', mimeType: 'image/png', buffer: avui }); await q.waitForTimeout(600);
    await q.click('#tab-adj'); await q.waitForTimeout(200);
    await q.click('#arreglaTota');
    await espera();
    if (await pla() !== 'cares,llum') problemes.push('a una foto d\'avui, gran i neta, «Arregla-la» hi planeja passos que no li calen: ' + await pla());
    if (!await q.locator('#iaCos-antiga').isVisible()) problemes.push('el botó d\'Ajustos no porta a la targeta «Arregla-la tota»');
    { const t = await q.locator('#antigaRes').innerText();
      if (!/No li calia buscar ratllades.*treure el soroll.*fer-la més gran/.test(t)) problemes.push('a una foto d\'avui, no diu què no li calia: ' + t); }
    if (baixats.some(b => !/cares-troba/.test(b) && !/wasm/.test(b))) problemes.push('a una foto d\'avui sense cares, «Arregla-la» ha baixat IA que no li calien: ' + [...new Set(baixats)].join(', '));
    if ((await hist()).some(t => /IA|soroll|cares|Amplia/.test(t))) problemes.push('a una foto d\'avui, «Arregla-la» hi ha passat IA: ' + (await hist()).join(' · '));
    // ---- la foto vella: tots els passos
    await q.setInputFiles('#file', { name: 'avis.png', mimeType: 'image/png', buffer: fotoVella }); await q.waitForTimeout(600);
    await q.click('#iaMode-mobil');
    await obreTargeta(q, 'antiga');
    if (!(await q.locator('#autoInfo').innerText()).includes('MB')) problemes.push('«Arregla-la tota» no diu quant es pot arribar a baixar');
    await q.click('#autoGo');
    await espera();
    const p1 = await pla(), h1 = await hist();
    if (p1 !== 'ratllades,soroll,cares,llum,amplia') problemes.push('a la foto vella, «Arregla-la» no planeja ratllades, soroll, cares, llum i fer-la més gran: ' + p1);
    for (const [pas, txt] of [['ratllades', 'Esborra les ratllades (IA)'], ['soroll', 'Treu el soroll'], ['cares', 'Arregla les cares (1 · CodeFormer)'], ['amplia', 'Amplia ×2']])
      if (!h1.some(t => t.startsWith(txt))) problemes.push(`a la foto vella, «Arregla-la» no ha fet «${pas}»: ` + h1.join(' · '));
    if (await q.locator('#stDims').innerText() !== '1440 × 960 px') problemes.push('a la foto vella de 720 punts, no l\'ha feta el doble de gran: ' + await q.locator('#stDims').innerText());
    { const t = await q.locator('#antigaRes').innerText();
      if (!t.includes('✓ Arreglada') || !t.includes('una cara arreglada') || !t.includes('2 vegades més gran')) problemes.push('al final de la foto vella, no diu què ha fet: ' + t); }
    // ---- una foto molt esquerdada (com una de l'usuari, amb el 20% de la foto
    // plena d'esquerdes; aquesta, de mentida, en té un 12%): s'han d'esborrar, no
    // prendre-les per la textura (fins llavors, a partir del 6% no es tocaven).
    // Les esquerdes han de ser corbes i irregulars: rectes i regulars, la IA no
    // les reconeix (no s'assemblen a les de debò).
    { const esquerdada = await fes(700, 900, `const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#a89678');g.addColorStop(1,'#5a4a38');x.fillStyle=g;x.fillRect(0,0,w,h);
x.filter='blur(6px)';x.fillStyle='#6b5a45';x.fillRect(150,260,400,480);x.fillStyle='#c2ae8e';x.beginPath();x.ellipse(350,230,90,110,0,0,7);x.fill();x.fillStyle='#3e3326';x.fillRect(0,760,w,140);x.filter='none';
const im=x.getImageData(0,0,w,h),d=im.data;let s=11;const r=()=>{s=(s+0x6D2B79F5)|0;let t=Math.imul(s^(s>>>15),1|s);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};
for(let k=0;k<d.length;k+=4){const n=(r()-.5)*18;d[k]+=n;d[k+1]+=n;d[k+2]+=n;}x.putImageData(im,0,0);
x.lineCap='round';x.lineJoin='round';
for(let i=0;i<70;i++){let px=r()*w,py=r()*h,a=r()*6.28;x.strokeStyle='rgba(243,238,226,'+(0.75+r()*0.25)+')';x.lineWidth=1.5+r()*3.5;x.beginPath();x.moveTo(px,py);
  const n=25+r()*60;for(let k=0;k<n;k++){a+=(r()-.5)*0.9;px+=Math.cos(a)*6;py+=Math.sin(a)*6;x.lineTo(px,py);}x.stroke();}`);
      await q.setInputFiles('#file', { name: 'esquerdada.png', mimeType: 'image/png', buffer: esquerdada }); await q.waitForTimeout(600);
      await obreTargeta(q, 'antiga'); await q.click('#autoGo'); await espera();
      const h = await hist(), t = await q.locator('#antigaRes').innerText();
      esquerdes = h.filter(x => x.startsWith('Esborra les ratllades')).length;
      if (!esquerdes || t.includes('massa')) problemes.push('en una foto molt esquerdada, «Arregla-la» no esborra les esquerdes (les pren per la textura?): ' + t.slice(0, 160)); }
    // ---- en blanc i negre: el color només si s'ha marcat (es mira el pla i s'atura)
    const bn = await fes(1600, 1000, `const g=x.createLinearGradient(0,0,0,1000);g.addColorStop(0,'#bbb');g.addColorStop(1,'#444');x.fillStyle=g;x.fillRect(0,0,w,h);x.fillStyle='#222';x.fillRect(300,400,400,300);x.fillStyle='#eee';x.beginPath();x.arc(1100,500,180,0,7);x.fill();`);
    for (const ambColor of [false, true]) {
      await q.setInputFiles('#file', { name: 'bn.png', mimeType: 'image/png', buffer: bn }); await q.waitForTimeout(600);
      await obreTargeta(q, 'antiga');
      if ((await q.getAttribute('#autoColor', 'aria-pressed') === 'true') !== ambColor) await q.click('#autoColor');
      await q.evaluate(() => { delete document.documentElement.dataset.autoPla; });
      await q.click('#autoGo');
      await q.waitForFunction(() => !!document.documentElement.dataset.autoPla && !document.querySelector('#vel').hidden, null, { timeout: 20000 }).catch(() => {});
      const p = await pla();
      await q.click('#velAtura').catch(() => {}); await espera();
      if (p !== (ambColor ? 'ratllades,cares,color,llum' : 'ratllades,cares,llum')) problemes.push(`a una foto en blanc i negre ${ambColor ? 'amb' : 'sense'} «Posa-hi color», el pla és ${p}`);
      if (!ambColor && !(await q.locator('#antigaRes').innerText()).includes('aturada')) problemes.push('aturant «Arregla-la», no diu que s\'ha aturat: ' + await q.locator('#antigaRes').innerText());
    }
    await q.close();
    // ---- a 320 px, la targeta hi cap
    const m = await navegador.newPage({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });
    await m.goto(BASE); await m.waitForTimeout(1200); await m.click('#tab-ia'); await m.click('#iaCap-antiga'); await m.waitForTimeout(300);
    { const r = await m.evaluate(() => { const c = document.querySelector('#iaCos-antiga').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, dins: [...document.querySelectorAll('#iaCos-antiga button')].filter(b => b.offsetParent).every(b => { const x = b.getBoundingClientRect(); return x.left >= c.left - 0.5 && x.right <= c.right + 0.5; }), gros: document.querySelector('#autoGo').getBoundingClientRect().height >= 38 }; });
      if (r.sw > 320 || !r.dins || !r.gros) problemes.push('a 320 px, la targeta «Arregla-la tota» no hi cap: ' + JSON.stringify(r)); }
    await m.close();
    console.log(`${problemes.length > abansU ? '✗' : '✓'} arreglar-la tota, sola: una foto d'avui no es toca ni baixa res de gros, la vella passa per ratllades, soroll, cares, llum i més gran, una de molt esquerdada s'esborra (${esquerdes} passades), el color només si es marca, aturar, i a 320 px`);
  }

  // ------------------------------------- les IA baixades: quant ocupen, i esborrar-les
  if (vol('baixades')) {
    const abansB = problemes.length;
    const q = await navegador.newPage({ viewport: { width: 320, height: 700 }, hasTouch: true, isMobile: true });
    vigila(q, 'baixades');
    const demanats = []; q.on('request', r => { if (/u2netp\.onnx/.test(r.url())) demanats.push(1); });
    await q.goto(BASE); await q.waitForTimeout(1500);
    await q.click('#tab-ia'); await q.waitForTimeout(300);
    if (!await q.locator('#baixadesBuit').count()) problemes.push('sense cap IA baixada, la llista no diu que no n\'hi ha cap');
    const fons = async () => { await obreTargeta(q, 'fons'); await q.click('#iaMode-mobil'); await q.click('#fonsD-blanc'); await q.click('#fonsGo');
      await q.waitForFunction(() => !document.querySelector('#vel').hidden, null, { timeout: 5000 }).catch(() => {});
      await q.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 300000 }); await q.waitForTimeout(400); };
    await fons();
    const files = () => q.evaluate(() => [...document.querySelectorAll('#baixadesLlista .baixada')].map(f => f.firstChild.textContent));
    const f1 = await files();
    if (f1.join('|') !== 'El motor (amb el processador)|Fons · Mòbil') problemes.push('després de treure un fons, la llista de baixades no té el motor i la IA del fons: ' + f1.join('|'));
    if (!/Ocupen 19 MB/.test(await q.locator('#baixadesTotal').innerText().catch(() => ''))) problemes.push('la llista de baixades no diu quant ocupen (19 MB): ' + await q.locator('#baixadesTotal').innerText().catch(() => ''));
    { const r = await q.evaluate(() => { const g = document.querySelector('#iaBaixades').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, dins: [...document.querySelectorAll('#iaBaixades button')].every(b => { const x = b.getBoundingClientRect(); return x.left >= g.left - 0.5 && x.right <= g.right + 0.5; }) }; });
      if (r.sw > 320 || !r.dins) problemes.push('a 320 px, la llista de baixades no hi cap: ' + JSON.stringify(r)); }
    // s'esborra la del fons: surt de la llista, ja no és a la memòria del navegador, i la targeta torna a dir que es baixa
    await q.locator('#baixadesLlista .baixada', { hasText: 'Fons' }).locator('button').click(); await q.waitForTimeout(500);
    if ((await files()).join('|') !== 'El motor (amb el processador)') problemes.push('esborrant la IA del fons, no surt de la llista: ' + (await files()).join('|'));
    if (await q.evaluate(async () => { for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) if (/u2netp/.test(r.url)) return true; return false; })) problemes.push('esborrant la IA del fons, es queda a la memòria del navegador');
    // totes: demana dos tocs
    await q.click('#baixadesTotes'); await q.waitForTimeout(300);
    if (!(await q.locator('#baixadesTotes').innerText()).includes('Segur') || !(await files()).length) problemes.push('«Esborra-les totes» no pregunta abans');
    await q.click('#baixadesTotes'); await q.waitForTimeout(500);
    if (!await q.locator('#baixadesBuit').count()) problemes.push('«Esborra-les totes» (dos tocs) no les esborra');
    // i tornant a obrir la pàgina i fent-la servir, es torna a baixar i a apuntar
    // (sense tornar a obrir, encara és carregada i no cal baixar res)
    await q.reload(); await q.waitForTimeout(1500); const n0 = demanats.length;
    await fons();
    if (demanats.length !== n0 + 1 || !(await files()).includes('Fons · Mòbil')) problemes.push('després d\'esborrar-la, la IA del fons no es torna a baixar o no torna a la llista');
    console.log(`${problemes.length > abansB ? '✗' : '✓'} les IA baixades: la llista amb el que ocupen, esborrar-ne una, esborrar-les totes (dos tocs), tornar-la a baixar, i a 320 px`);
    await q.close();
  }

  // ------------------------------------- afegir una imatge a sobre, i una foto de fons
  // Tallar i enganxar entre dues fotos: una segona imatge que es mou, es fa
  // gran, es gira i s'enganxa; treure-li el fons amb la IA; i, a la targeta del
  // fons, posar-hi una altra foto al darrere.
  if (vol('enganxa')) {
    const abansE = problemes.length;
    const q = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
    vigila(q, 'enganxa');
    await q.goto(BASE); await q.waitForTimeout(1500);
    const fes = (w, h, codi) => q.evaluate(([w, h, codi]) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); new Function('x', 'w', 'h', codi)(x, w, h); return c.toDataURL('image/png'); }, [w, h, codi]).then(u => Buffer.from(u.split(',')[1], 'base64'));
    const gris = await fes(800, 600, "x.fillStyle='#808080';x.fillRect(0,0,w,h);");
    const dosColors = await fes(200, 100, "x.fillStyle='#e00000';x.fillRect(0,0,100,100);x.fillStyle='#0000e0';x.fillRect(100,0,100,100);");
    const obre = async (sel, nom, buf) => { await q.setInputFiles(sel, { name: nom, mimeType: 'image/png', buffer: buf }); await q.waitForTimeout(600); };
    const punt = (bx, by) => q.evaluate(([bx, by]) => { const v = document.querySelector('#view'), e = v.width / 800; return [...v.getContext('2d').getImageData(Math.round(bx * e), Math.round(by * e), 1, 1).data]; }, [bx, by]);
    const es = (c, quin) => quin === 'vermell' ? c[0] > 180 && c[2] < 70 : quin === 'blau' ? c[2] > 180 && c[0] < 70 : Math.abs(c[0] - 128) < 12 && Math.abs(c[2] - 128) < 12;
    const aPant = async (bx, by) => { const v = await q.locator('#view').boundingBox(), z = v.width / 800; return [v.x + bx * z, v.y + by * z]; };
    const arrossega = async (de, a) => { const p = await aPant(...de), f = await aPant(...a); await q.mouse.move(...p); await q.mouse.down(); await q.mouse.move(...f, { steps: 6 }); await q.mouse.up(); await q.waitForTimeout(150); };
    const historial = () => q.locator('.hitem span').allInnerTexts();
    await obre('#file', 'gris.png', gris);
    if (!await q.locator('#objGo').isVisible()) problemes.push('a l\'eina Mou no hi ha «Afegeix una imatge a sobre»');
    await obre('#file2', 'dos.png', dosColors);
    if (!await q.locator('#obj').isVisible() || !await q.locator('#objBar').isVisible() || !await q.locator('#objFons').isVisible()) problemes.push('afegint una imatge, no surt a sobre de la foto amb els seus botons');
    if (!es(await punt(400, 300), 'gris') || (await historial()).length !== 1) problemes.push('la imatge afegida es pinta a la foto (o s\'apunta) abans d\'enganxar-la');
    // es mou (120 a la dreta i 60 avall) i, amb el punt de la cantonada, es fa una vegada i mitja més gran
    await arrossega([400, 300], [520, 360]);
    await arrossega([520 + 100, 360 + 50], [520 + 150, 360 + 75]);
    await q.click('#objSi'); await q.waitForTimeout(500);
    if (!(await historial()).includes('Enganxa una imatge') || await q.locator('#obj').isVisible() || await q.locator('#objBar').isVisible() || !await q.locator('#objGo').isVisible()) problemes.push('«Enganxa-la» no l\'apunta a l\'historial, o la imatge i els seus botons s\'hi queden');
    { const c = [await punt(520 - 140, 360), await punt(520 + 140, 360), await punt(520 - 160, 360), await punt(520 + 160, 360), await punt(520 - 60, 360 - 68), await punt(520 - 60, 360 - 82)];
      if (!es(c[0], 'vermell') || !es(c[1], 'blau') || !es(c[2], 'gris') || !es(c[3], 'gris') || !es(c[4], 'vermell') || !es(c[5], 'gris')) problemes.push('la imatge enganxada no és on s\'ha deixat ni de la mida que s\'ha fet (300 × 150 a 520,360): ' + JSON.stringify(c)); }
    await q.click('#btnUndo'); await q.waitForTimeout(300);
    if (!es(await punt(520 - 100, 360), 'gris')) problemes.push('desfer no treu la imatge enganxada');
    // girada un quart de volta amb el punt de la cantonada, com un mirall i mig transparent
    await obre('#file2', 'dos.png', dosColors);
    await q.click('#objMirall'); await q.waitForTimeout(150);
    await arrossega([400 + 100, 300 + 50], [400 - 50, 300 + 100]);       // el punt, un quart de volta més enllà
    await q.evaluate(() => { const r = document.querySelector('#objOp'); r.value = 50; r.dispatchEvent(new Event('input')); });
    await q.keyboard.press('Enter'); await q.waitForTimeout(500);
    { const dalt = await punt(400, 300 - 60), baix = await punt(400, 300 + 60), costat = await punt(400 + 75, 300);
      // amb el mirall el blau és a l'esquerra; girat un quart, a dalt. Mig transparent sobre gris: (64,64,176) i (176,64,64)
      const mig = (c, o) => Math.abs(c[0] - o[0]) < 22 && Math.abs(c[1] - o[1]) < 22 && Math.abs(c[2] - o[2]) < 22;
      if (!mig(dalt, [64, 64, 176]) || !mig(baix, [176, 64, 64]) || !es(costat, 'gris')) problemes.push('girada un quart, com un mirall i mig transparent, la imatge enganxada no és com toca: ' + JSON.stringify([dalt, baix, costat])); }
    // Cancel·la i Esc no enganxen res
    await obre('#file2', 'dos.png', dosColors); const n0 = (await historial()).length;
    await q.click('#objNo'); await q.waitForTimeout(200);
    await obre('#file2', 'dos.png', dosColors); await q.keyboard.press('Escape'); await q.waitForTimeout(200);
    if ((await historial()).length !== n0 || await q.locator('#obj').isVisible()) problemes.push('cancel·lant (amb el botó o amb Esc), la imatge s\'enganxa o s\'hi queda');

    // ---- treure-li el fons: d'un gerro blau sobre una paret clara, només en queda el gerro
    const verd = await fes(900, 700, "x.fillStyle='#20a040';x.fillRect(0,0,w,h);");
    const gerro = await fes(600, 450, `const g=x.createLinearGradient(0,0,0,450);g.addColorStop(0,'#d2c6b0');g.addColorStop(1,'#8c8270');x.fillStyle=g;x.fillRect(0,0,600,450);
      x.filter='blur(10px)';[['#b48cd2',120,80,50],['#d28c78',200,160,45],['#8cc8b4',450,70,40],['#c8b48c',500,220,55]].forEach(([col,cx,cy,r])=>{x.fillStyle=col;x.beginPath();x.arc(cx,cy,r,0,7);x.fill();});
      x.filter='none';x.fillStyle='#6e4f37';x.fillRect(0,340,600,110);
      const gg=x.createRadialGradient(260,190,10,300,250,170);gg.addColorStop(0,'#3a74d0');gg.addColorStop(1,'#0e2448');
      x.fillStyle=gg;x.beginPath();x.ellipse(300,250,80,110,0,0,7);x.fill();x.fillRect(270,100,60,60);x.beginPath();x.ellipse(300,100,42,16,0,0,7);x.fill();`);
    // (per afegir-lo, el gerro no és al mig de la seva imatge sinó 120 punts a la dreta:
    // així es veu si, en retallar-lo al contorn, es mou de lloc)
    const gerroDret = await fes(600, 450, `const g=x.createLinearGradient(0,0,0,450);g.addColorStop(0,'#d2c6b0');g.addColorStop(1,'#8c8270');x.fillStyle=g;x.fillRect(0,0,600,450);
      x.fillStyle='#6e4f37';x.fillRect(0,340,600,110);x.translate(120,0);
      const gg=x.createRadialGradient(260,190,10,300,250,170);gg.addColorStop(0,'#3a74d0');gg.addColorStop(1,'#0e2448');
      x.fillStyle=gg;x.beginPath();x.ellipse(300,250,80,110,0,0,7);x.fill();x.fillRect(270,100,60,60);x.beginPath();x.ellipse(300,100,42,16,0,0,7);x.fill();`);
    await obre('#file', 'verd.png', verd);
    await q.click('#tab-ia'); await q.click('#iaMode-mobil');
    await obre('#file2', 'gerro.png', gerroDret);
    const caixa0 = await q.locator('#obj').boundingBox();
    if (!(await q.locator('#opts').innerText()).includes('MB')) problemes.push('«Treu-li el fons» no diu quant es baixa la primera vegada');
    await q.click('#objFons');
    await q.waitForFunction(() => !document.querySelector('#vel').hidden, null, { timeout: 5000 }).catch(() => {});
    await q.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 300000 }); await q.waitForTimeout(400);
    const caixa1 = await q.locator('#obj').boundingBox();
    if (await q.locator('#objFons').innerText() !== 'Torna-li el fons') problemes.push('després de treure el fons de la imatge afegida, no s\'ofereix de tornar-l\'hi: ' + await q.locator('#stMsg').innerText());
    if (!(caixa1.width < caixa0.width * 0.5 && caixa1.height > caixa1.width)) problemes.push(`sense el fons, la imatge afegida no es retalla al contorn del gerro (de ${Math.round(caixa0.width)}×${Math.round(caixa0.height)} a ${Math.round(caixa1.width)}×${Math.round(caixa1.height)})`);
    // «Torna-li el fons» la deixa com era, i es torna a treure
    await q.click('#objFons'); await q.waitForTimeout(200);
    { const c = await q.locator('#obj').boundingBox(); if (Math.abs(c.width - caixa0.width) > 2 || Math.abs(c.x - caixa0.x) > 2) problemes.push('«Torna-li el fons» no deixa la imatge afegida com era'); }
    await q.click('#objFons');
    await q.waitForFunction(() => !document.querySelector('#vel').hidden, null, { timeout: 5000 }).catch(() => {});
    await q.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 300000 }); await q.waitForTimeout(400);
    await q.click('#objSi'); await q.waitForTimeout(500);
    { // el gerro era a 420,250 d'una imatge de 600 posada a 450 d'ample al mig (450,350): a la foto, a 540,368.75
      const p9 = (bx, by) => q.evaluate(([bx, by]) => { const v = document.querySelector('#view'), e = v.width / 900; return [...v.getContext('2d').getImageData(Math.round(bx * e), Math.round(by * e), 1, 1).data]; }, [bx, by]);
      const g = await p9(540, 369), paret = await p9(248, 204), taula = await p9(300, 480), vora = await p9(540 + 80, 369 - 60);
      // la boca del gerro és a 244 de la foto: just a sobre hi ha d'haver verd, i just a sota, gerro
      const sobre = await p9(540, 234), boca = await p9(540, 254);
      if (!(sobre[1] > 130 && sobre[0] < 70) || !(boca[2] > boca[0] + 30)) problemes.push('en treure-li el fons, el gerro es mou de lloc: ' + JSON.stringify([sobre, boca]));
      const verdC = c => c[1] > 130 && c[0] < 70 && c[2] < 100;
      if (!(g[2] > g[0] + 40 && g[2] > g[1])) problemes.push('enganxant el gerro sense fons, el gerro no és on era: ' + g);
      if (!verdC(paret) || !verdC(taula) || !verdC(vora)) problemes.push('enganxant el gerro sense fons, s\'hi enganxa també la paret o la taula: ' + JSON.stringify([paret, taula, vora])); }

    // ---- la targeta del fons: una altra foto al darrere
    await obre('#file', 'gerro.png', gerro);
    await obreTargeta(q, 'fons'); await q.click('#iaMode-mobil'); await q.click('#fonsD-foto');
    if (!await q.locator('#fonsGo').isDisabled() || !(await q.locator('#fonsFotoNom').innerText()).includes('cap')) problemes.push('amb «Una foto» i sense haver-ne triat cap, el botó es pot prémer');
    await obre('#file3', 'platja.png', await fes(300, 300, "x.fillStyle='#e000e0';x.fillRect(0,0,150,300);x.fillStyle='#00d0d0';x.fillRect(150,0,150,300);"));
    if (await q.locator('#fonsGo').isDisabled() || await q.locator('#fonsGo').innerText() !== 'Canvia el fons' || !(await q.locator('#fonsFotoNom').innerText()).includes('platja.png')) problemes.push('després de triar la foto del fons, el botó no diu «Canvia el fons» o no diu quina és');
    await q.click('#fonsGo');
    await q.waitForFunction(() => !document.querySelector('#vel').hidden, null, { timeout: 5000 }).catch(() => {});
    await q.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 300000 }); await q.waitForTimeout(400);
    { const p6 = (bx, by) => q.evaluate(([bx, by]) => { const v = document.querySelector('#view'), e = v.width / 600; return [...v.getContext('2d').getImageData(Math.round(bx * e), Math.round(by * e), 1, 1).data]; }, [bx, by]);
      const esq = await p6(40, 40), dre = await p6(560, 40), g = await p6(300, 260);
      if (!(esq[0] > 180 && esq[1] < 60 && esq[2] > 180) || !(dre[0] < 60 && dre[1] > 170 && dre[2] > 170) || !(g[2] > g[0] + 40)) problemes.push('amb una foto de fons, el fons no és la foto triada (omplint-lo tot) o el gerro no hi és: ' + JSON.stringify([esq, dre, g]));
      if (!(await historial()).includes('Canvia el fons (una foto)')) problemes.push('canviar el fons per una foto no surt a l\'historial'); }
    await q.close();

    // ---- al mòbil: amb dos dits es fa gran i es gira (i la foto no es mou), i tot hi cap a 320 px
    const m = await navegador.newPage({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });
    vigila(m, 'enganxa mòbil');
    await m.goto(BASE); await m.waitForTimeout(1500);
    await m.setInputFiles('#file', { name: 'gris.png', mimeType: 'image/png', buffer: gris }); await m.waitForTimeout(600);
    await m.setInputFiles('#file2', { name: 'dos.png', mimeType: 'image/png', buffer: dosColors }); await m.waitForTimeout(900);
    const zoom0 = await m.locator('#zoomRead').inputValue().catch(() => m.locator('#zoomRead').innerText());
    const mida = () => m.evaluate(() => { const o = document.querySelector('#obj'); return { w: parseFloat(o.style.width), gir: o.style.transform }; });
    const m0 = await mida(), c = await m.locator('#obj').boundingBox(), cx = c.x + c.width / 2, cy = c.y + c.height / 2;
    const cdp = await m.context().newCDPSession(m);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 15, y: cy, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 15, y: cy, id: 1 }, { x: cx + 15, y: cy, id: 2 }] });
    for (const k of [0.25, 0.5, 0.75, 1]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 15 - 15 * k, y: cy - 30 * k, id: 1 }, { x: cx + 15 + 15 * k, y: cy + 30 * k, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await m.waitForTimeout(300);
    const m1 = await mida(), zoom1 = await m.locator('#zoomRead').inputValue().catch(() => m.locator('#zoomRead').innerText());
    if (!(m1.w > m0.w * 1.8) || m1.gir === m0.gir || zoom1 !== zoom0) problemes.push(`amb dos dits, la imatge afegida no es fa gran i es gira, o es mou la foto (ample ${m0.w.toFixed(0)} → ${m1.w.toFixed(0)}, ${m0.gir} → ${m1.gir}, zoom ${zoom0} → ${zoom1})`);
    { const r = await m.evaluate(() => { const b = document.querySelector('#objBar').getBoundingClientRect(), n = document.querySelector('#objNansa').getBoundingClientRect();
        return { barra: b.left >= 0 && b.right <= 320 && b.width > 100, nansa: n.width >= 40 && n.height >= 40, sw: document.documentElement.scrollWidth, tact: getComputedStyle(document.querySelector('#obj')).touchAction,
                 botons: [...document.querySelectorAll('#opts button')].every(x => x.getBoundingClientRect().right <= 320.5) }; });
      if (!r.barra || !r.nansa || r.sw > 320 || r.tact !== 'none' || !r.botons) problemes.push('al mòbil, la imatge afegida i els seus botons no hi caben a 320 px: ' + JSON.stringify(r)); }
    await m.close();
    console.log(`${problemes.length > abansE ? '✗' : '✓'} afegir una imatge a sobre: moure-la, fer-la gran i girar-la (també amb dos dits), mirall, transparència, enganxar, desfer i cancel·lar; treure-li el fons amb la IA; i una altra foto de fons`);
  }

  // ------------------------------------- els models es baixen de Cloudflare
  // A internet, els models no són a GitHub sinó a Cloudflare R2, i els
  // entrega el Worker «eines-ia». Aquí es fa veure que la web és a internet
  // (una adreça que no és l'ordinador mateix) i el Worker es fa amb les còpies
  // locals: la IA del fons s'ha de baixar del Worker i no de GitHub, i
  // funcionar. Res no surt a internet.
  if (vol('cloudflare')) {
    const abansW = problemes.length;
    // (sense el programa de sense connexió: el navegador el buscaria a una adreça inventada)
    const ctxW = await navegador.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    const q = await ctxW.newPage();
    vigila(q, 'worker');
    const demanats = [];
    q.on('request', r => { if (/\.onnx/.test(r.url())) demanats.push(r.url()); });
    const serveix = (route, f) => {
      if (!existsSync(f) || statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
      route.fulfill({ status: 200, body: readFileSync(f), headers: { 'content-type': TIPUS[extname(f)] || 'application/octet-stream', 'access-control-allow-origin': '*' } });
    };
    await q.route('https://eines.prova/**', route => {
      const cami = decodeURIComponent(new URL(route.request().url()).pathname);
      if (cami.startsWith('/ia/models/')) return route.fulfill({ status: 404, body: '' });     // a GitHub ja no hi són
      serveix(route, join(AQUI, cami));
    });
    await q.route('https://eines-ia.oscarbellosido.workers.dev/**', route =>
      serveix(route, join(AQUI, 'ia/models', decodeURIComponent(new URL(route.request().url()).pathname))));
    await q.goto('https://eines.prova/cambra-fosca.html');
    await q.waitForTimeout(1500);
    await obreTargeta(q, 'fons'); await q.click('#iaMode-mobil'); await q.click('#fonsD-blanc'); await q.click('#fonsGo');
    await q.waitForTimeout(300);
    await q.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 300000 });
    if (!demanats.length || !demanats.every(u => u.startsWith('https://eines-ia.oscarbellosido.workers.dev/')))
      problemes.push('a internet, els models no es baixen del Worker de Cloudflare: ' + demanats.join(', '));
    if (!(await q.locator('.hitem span').allInnerTexts()).some(t => t.startsWith('Treu el fons'))) problemes.push('amb els models del Worker, treure el fons no ha funcionat: ' + await q.locator('#stMsg').innerText());
    console.log(`${problemes.length > abansW ? '✗' : '✓'} els models, de Cloudflare: a internet es baixen del Worker (${demanats.length}) i no de GitHub, i funcionen`);
    await ctxW.close();
  }

  // ------------------------------------------------- soroll i borrós
  // Una foto dibuixada aquí (degradats, cercles, ratlles i lletres): amb
  // soroll, «Treu el soroll» l'ha d'acostar molt a la neta, «Suau» menys; amb
  // una foto més petita que un tros, també; i, desenfocada, «Fes-la més
  // nítida» l'ha d'acostar a la neta. La mida no canvia, desfer la torna, i la
  // segona vegada no es torna a baixar res.
  if (vol('soroll')) {
    const abansN = problemes.length;
    const q = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
    vigila(q, 'nitida');
    let baixades = 0;
    q.on('request', r => { if (/soroll\.onnx/.test(r.url())) baixades++; });
    await q.goto(BASE);
    await q.waitForTimeout(1500);
    const fes = (w, h, tipus) => q.evaluate(([w, h, tipus]) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#c9a27a'); g.addColorStop(0.5, '#6d8fb0'); g.addColorStop(1, '#3c5a3a');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) { x.fillStyle = ['#e8d8b0', '#7a2e2e', '#2e4a7a', '#f2f2ee', '#222'][i % 5]; x.beginPath(); x.arc((i * 97) % w, (i * 61) % h + 30, 18 + (i * 7) % 30, 0, 7); x.fill(); }
      x.fillStyle = '#111'; for (let i = 0; i < 12; i++) x.fillRect(20 + i * 9, h - 70, 3, 50);
      x.font = 'bold 28px sans-serif'; x.fillStyle = '#fff'; x.fillText('Cambra', w * 0.45, h * 0.3);
      const neta = x.getImageData(0, 0, w, h);
      if (tipus === 'soroll') {
        const d = x.getImageData(0, 0, w, h), p = d.data; let s = 11;
        const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
        for (let i = 0; i < p.length; i += 4) for (let k = 0; k < 3; k++) {
          const n = Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(6.2832 * rnd()) * 20; p[i + k] += n; }
        x.putImageData(d, 0, 0);
      } else if (tipus === 'borros') {
        const t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').putImageData(neta, 0, 0);
        x.filter = 'blur(1.6px)'; x.drawImage(t, 0, 0); x.filter = 'none';
      }
      window.__neta = [...neta.data];
      return c.toDataURL('image/png');
    }, [w, h, tipus]);
    const obre = async (w, h, tipus) => { await q.setInputFiles('#file', { name: tipus + '.png', mimeType: 'image/png', buffer: Buffer.from((await fes(w, h, tipus)).split(',')[1], 'base64') }); await q.waitForTimeout(700); };
    // diferència mitjana del que es veu amb la foto neta (de 0 a 255)
    const dif = () => q.evaluate(() => { const v = document.querySelector('#view'), d = v.getContext('2d').getImageData(0, 0, v.width, v.height).data, n = window.__neta;
      let s = 0, c = 0; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) { s += Math.abs(d[i + k] - n[i + k]); c++; } return s / c; });
    const fesho = async (que, forca) => {
      await obreTargeta(q, 'nitida'); await q.click('#iaMode-mobil'); await q.click('#nitQ-' + que); await q.click('#nitF-' + forca);
      await q.click('#nitGo');
      await q.waitForTimeout(300);
      await q.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 900000 });
      await q.waitForTimeout(300);
    };
    await obre(420, 300, 'soroll');
    const d0 = await dif();
    await obreTargeta(q, 'nitida');
    if (!(await q.locator('#nitInfo').innerText()).includes('MB')) problemes.push('«Soroll i borrós» no diu quant es baixa la primera vegada');
    await fesho('soroll', 'fort');
    const d1 = await dif();
    if (!(d1 < d0 * 0.5)) problemes.push(`«Treu el soroll» no acosta prou la foto a la neta (de ${d0.toFixed(1)} a ${d1.toFixed(1)})`);
    if (await q.locator('#stDims').innerText() !== '420 × 300 px') problemes.push('«Treu el soroll» canvia la mida de la foto: ' + await q.locator('#stDims').innerText());
    if (!(await q.locator('.hitem span').allInnerTexts()).includes('Treu el soroll')) problemes.push('«Treu el soroll» no surt a l\'historial');
    if (await q.locator('#nitRes').isHidden()) problemes.push('després de treure el soroll no diu «✓ Soroll tret»');
    const baixadesAbans = baixades;
    await q.keyboard.press('Control+z'); await q.waitForTimeout(400);
    if (Math.abs(await dif() - d0) > 0.3) problemes.push('desfer no torna la foto amb el soroll');
    await fesho('soroll', 'suau');
    const d2 = await dif();
    if (!(d2 > d1 + 1 && d2 < d0 - 1)) problemes.push(`«Suau» no queda entre l'original i «Fort» (original ${d0.toFixed(1)}, fort ${d1.toFixed(1)}, suau ${d2.toFixed(1)})`);
    if (baixades !== baixadesAbans) problemes.push('la segona vegada, «Treu el soroll» torna a baixar la IA');
    // una foto més petita que un tros de la IA (256)
    await obre(200, 150, 'soroll');
    const p0 = await dif();
    await fesho('soroll', 'fort');
    const p1 = await dif();
    if (!(p1 < p0 * 0.6) || await q.locator('#stDims').innerText() !== '200 × 150 px') problemes.push(`amb una foto més petita que un tros, el soroll no va bé (de ${p0.toFixed(1)} a ${p1.toFixed(1)}, ${await q.locator('#stDims').innerText()})`);
    // borrosa
    await obre(420, 300, 'borros');
    const b0 = await dif();
    await fesho('borros', 'fort');
    const b1 = await dif();
    if (!(b1 < b0 - 0.3)) problemes.push(`«Fes-la més nítida» no acosta la foto borrosa a la neta (de ${b0.toFixed(2)} a ${b1.toFixed(2)})`);
    if (await q.locator('#stDims').innerText() !== '420 × 300 px') problemes.push('«Fes-la més nítida» canvia la mida de la foto');
    if (!(await q.locator('.hitem span').allInnerTexts()).includes('Fes-la més nítida')) problemes.push('«Fes-la més nítida» no surt a l\'historial');
    console.log(`${problemes.length > abansN ? '✗' : '✓'} soroll i borrós (pel processador): el soroll de ${d0.toFixed(1)} a ${d1.toFixed(1)} (suau ${d2.toFixed(1)}), una foto petita de ${p0.toFixed(1)} a ${p1.toFixed(1)}, la borrosa de ${b0.toFixed(2)} a ${b1.toFixed(2)}, la mida igual, desfer, i la segona vegada sense baixar res`);
    await q.close();
  }
  servidor.close();
}

// ------------------------------- la Cambra Fosca: redreçar una foto de paper
// Una «foto de paper» de 4 per 3 (un escaquer de colors) vista de costat damunt
// d'una taula, feta amb una càmera de mentida (un pla girat i projectat). Posant
// els quatre punts a les cantonades, ha de quedar plana, amb els colors al seu
// lloc i amb la forma de debò (4:3), que no surt de les llargades dels costats.
if (vol('paper')) {
  const abansP = problemes.length;
  const q = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
  vigila(q, 'paper');
  await q.goto(fitxer('cambra-fosca.html'));
  await q.waitForTimeout(1500);
  const escena = await q.evaluate(() => {
    const W = 900, H = 700, f = 900, PW = 400, PH = 300;
    const color = (u, v) => { const i = Math.floor(u / 50), j = Math.floor(v / 50), k = i * 7 + j * 13; return [40 + (k * 53) % 200, 40 + (k * 97) % 200, 40 + (k * 29) % 200]; };
    // el pla de la foto: girat sobre tres eixos i allunyat
    const a = 0.80, b = -0.55, g = 0.14, c = Math.cos, s = Math.sin;
    const Rx = [[1, 0, 0], [0, c(a), -s(a)], [0, s(a), c(a)]], Ry = [[c(b), 0, s(b)], [0, 1, 0], [-s(b), 0, c(b)]], Rz = [[c(g), -s(g), 0], [s(g), c(g), 0], [0, 0, 1]];
    const mul = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((t, v, k) => t + v * B[k][j], 0)));
    const R = mul(Rx, mul(Ry, Rz)), esc = 1.5 / PW, T = [0, 0, 2.6];
    const projecta = (u, v) => { const X = (u - PW / 2) * esc, Y = (v - PH / 2) * esc;
      const x = R[0][0] * X + R[0][1] * Y + T[0], y = R[1][0] * X + R[1][1] * Y + T[1], z = R[2][0] * X + R[2][1] * Y + T[2]; return [f * x / z + W / 2, f * y / z + H / 2]; };
    // de la imatge al pla: la recta de cada punt, tallada amb el pla
    const n = [R[0][2], R[1][2], R[2][2]], nT = n[0] * T[0] + n[1] * T[1] + n[2] * T[2];
    const k = document.createElement('canvas'); k.width = W; k.height = H; const x = k.getContext('2d'), im = x.createImageData(W, H), d = im.data;
    for (let py = 0, o = 0; py < H; py++) for (let px = 0; px < W; px++, o += 4) {
      const r = [(px + 0.5 - W / 2) / f, (py + 0.5 - H / 2) / f, 1], t = nT / (n[0] * r[0] + n[1] * r[1] + n[2] * r[2]);
      const P = [r[0] * t - T[0], r[1] * t - T[1], r[2] * t - T[2]];
      const u = (R[0][0] * P[0] + R[1][0] * P[1] + R[2][0] * P[2]) / esc + PW / 2, v = (R[0][1] * P[0] + R[1][1] * P[1] + R[2][1] * P[2]) / esc + PH / 2;
      const col = u >= 0 && u < PW && v >= 0 && v < PH ? color(u, v) : [96 + (px * 3 + py) % 9, 70, 48];
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255; }
    x.putImageData(im, 0, 0);
    const cant = [projecta(0, 0), projecta(PW, 0), projecta(PW, PH), projecta(0, PH)];
    const costats = [0, 1, 2, 3].map(i => Math.hypot(cant[i][0] - cant[(i + 1) % 4][0], cant[i][1] - cant[(i + 1) % 4][1]));
    return { png: k.toDataURL('image/png'), cant, simple: (costats[0] + costats[2]) / (costats[1] + costats[3]) };
  });
  await q.setInputFiles('#file', { name: 'paper.png', mimeType: 'image/png', buffer: Buffer.from(escena.png.split(',')[1], 'base64') });
  await q.waitForTimeout(600);
  await q.keyboard.press('c'); await q.waitForTimeout(300);
  await q.click('#paperGo'); await q.waitForTimeout(400);
  if (!await q.locator('#paper').isVisible() || !await q.locator('#paperBar').isVisible() || await q.locator('#cropBox').isVisible()) problemes.push('«Foto de paper» no posa els quatre punts i els botons, o deixa el marc del retall a sobre');
  // Cancel·la no toca res
  await q.click('#paperNo'); await q.waitForTimeout(200);
  if (await q.locator('#paper').isVisible() || (await q.locator('.hitem span').allInnerTexts()).length !== 1) problemes.push('cancel·lant la foto de paper, els punts s\'hi queden o s\'ha apuntat alguna cosa');
  await q.click('#paperGo'); await q.waitForTimeout(400);
  // els punts, a les cantonades (no per ordre: el primer punt va a la de baix a la dreta)
  const arrossega = async (i, [bx, by]) => {
    const v = await q.locator('#view').boundingBox(), z = v.width / 900, h = await q.locator(`#paper .pc[data-i="${i}"]`).boundingBox();
    await q.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await q.mouse.down();
    await q.mouse.move(v.x + bx * z, v.y + by * z, { steps: 6 });
    const lupa = await q.locator('#lupa').isVisible(); await q.mouse.up(); await q.waitForTimeout(80); return lupa; };
  const lupes = [];
  for (const [i, c] of [[0, 2], [1, 3], [2, 0], [3, 1]]) lupes.push(await arrossega(i, escena.cant[c]));
  if (!lupes.every(Boolean)) problemes.push('mentre s\'arrossega un punt de la foto de paper, no surt la lupa');
  if (await q.locator('#lupa').isVisible()) problemes.push('en deixar anar el punt, la lupa s\'hi queda');
  await q.click('#paperSi'); await q.waitForTimeout(1500);
  const res = await q.evaluate(() => { const v = document.querySelector('#view'), x = v.getContext('2d'), w = v.width, h = v.height;
    const color = (u, vv) => { const i = Math.floor(u / 50), j = Math.floor(vv / 50), k = i * 7 + j * 13; return [40 + (k * 53) % 200, 40 + (k * 97) % 200, 40 + (k * 29) % 200]; };
    let pitjor = 0; for (let j = 0; j < 6; j++) for (let i = 0; i < 8; i++) { const d = x.getImageData(Math.round((i + 0.5) / 8 * w), Math.round((j + 0.5) / 6 * h), 1, 1).data, c = color(i * 50 + 25, j * 50 + 25);
      pitjor = Math.max(pitjor, Math.abs(d[0] - c[0]), Math.abs(d[1] - c[1]), Math.abs(d[2] - c[2])); }
    return { pitjor, mida: document.querySelector('#stDims').textContent }; });
  const [rw, rh] = res.mida.match(/\d+/g).map(Number);
  if (res.pitjor > 30) problemes.push(`redreçant la foto de paper, els quadres no queden al seu lloc (un color s'allunya ${res.pitjor} nivells)`);
  if (Math.abs(rw / rh / (4 / 3) - 1) > 0.05) problemes.push(`la foto de paper redreçada no fa la forma de debò: ${rw} × ${rh} (${(rw / rh).toFixed(3)}; hauria de ser 1,333, i amb les llargades dels costats sortiria ${escena.simple.toFixed(3)})`);
  if (Math.abs(escena.simple / (4 / 3) - 1) < 0.05) problemes.push('la prova de la foto de paper no té prou perspectiva per distingir la forma de debò de la dels costats');
  if (!(await q.locator('.hitem span').allInnerTexts()).includes('Redreça la foto de paper') || await q.locator('#paper').isVisible() || await q.locator('#paperBar').isVisible()) problemes.push('redreçar la foto de paper no surt a l\'historial, o els punts s\'hi queden');
  await q.click('#btnUndo'); await q.waitForTimeout(400);
  if (await q.locator('#stDims').innerText() !== '900 × 700 px') problemes.push('desfer no torna la foto d\'abans de redreçar-la');
  // tres punts en ratlla no són cap quadrilàter: ho diu i no toca res
  await q.keyboard.press('c'); await q.waitForTimeout(200); await q.click('#paperGo'); await q.waitForTimeout(300);
  await arrossega(0, [100, 100]); await arrossega(1, [450, 100]); await arrossega(2, [800, 100]); await arrossega(3, [450, 600]);
  await q.click('#paperSi'); await q.waitForTimeout(400);
  if (!(await q.locator('#stMsg').innerText()).includes('cantonades') || await q.locator('#stDims').innerText() !== '900 × 700 px') problemes.push('amb tres punts en ratlla, la foto de paper es redreça igualment o no diu què passa');
  await q.close();
  // al mòbil: des de la targeta de restaurar, i que tot hi càpiga a 320 px
  const m = await navegador.newPage({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });
  vigila(m, 'paper mòbil');
  await m.goto(fitxer('cambra-fosca.html')); await m.waitForTimeout(1500);
  await m.click('#tab-ia'); await m.click('#iaCap-antiga'); await m.waitForTimeout(300); await m.click('#antigaPaper'); await m.waitForTimeout(900);
  { const r = await m.evaluate(() => { const b = document.querySelector('#paperBar').getBoundingClientRect(), p = [...document.querySelectorAll('#paper .pc')].map(x => x.getBoundingClientRect());
      return { on: document.querySelector('#paper').classList.contains('on'), barra: b.left >= 0 && b.right <= 320 && b.width > 100, punts: p.every(x => x.width >= 40 && x.height >= 40), sw: document.documentElement.scrollWidth,
               tact: getComputedStyle(document.querySelector('#paper .pc')).touchAction, eina: document.querySelector('#wrap').dataset.tool }; });
    if (!r.on || !r.barra || !r.punts || r.sw > 320 || r.tact !== 'none' || r.eina !== 'crop') problemes.push('al mòbil, des de la targeta de restaurar, la foto de paper no es posa bé o no hi cap a 320 px: ' + JSON.stringify(r)); }
  await m.close();
  console.log(`${problemes.length > abansP ? '✗' : '✓'} redreçar una foto de paper: els quatre punts amb la lupa, queda plana (els colors a ${res.pitjor} nivells) i amb la forma de debò (${(rw / rh).toFixed(3)}; pels costats, ${escena.simple.toFixed(3)}), cancel·lar, desfer, tres punts en ratlla, i al mòbil`);
}

// ------------------------------- la Cambra Fosca: la cortina, compartir i les fotos enormes
if (vol('extres')) {
  const abansX = problemes.length;
  // ---- la cortina d'abans i després: un toc a «Abans» la posa, i la ratlla s'arrossega
  const q = await navegador.newPage({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  vigila(q, 'extres');
  await q.goto(fitxer('cambra-fosca.html'));
  await q.waitForTimeout(1500);
  const dades = await q.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const x = c.getContext('2d');
    x.fillStyle = '#2060c0'; x.fillRect(0, 0, 800, 600); return c.toDataURL('image/png'); });
  const blava = Buffer.from(dades.split(',')[1], 'base64');
  await q.setInputFiles('#file', { name: 'blava.png', mimeType: 'image/png', buffer: blava });
  await q.waitForTimeout(600);
  // en blanc i negre, que es vegi la diferència: abans blau, ara gris
  await q.click('#tab-fil'); await q.waitForTimeout(500); await q.click('#fc-bn'); await q.waitForTimeout(500);
  const punt = fx => q.evaluate(fx => { const v = document.querySelector('#view'); return [...v.getContext('2d').getImageData(Math.round(v.width * fx), Math.round(v.height / 2), 1, 1).data]; }, fx);
  const esBlau = c => c[2] - c[0] > 60;
  if (esBlau(await punt(0.25))) problemes.push('la prova de la cortina no pot començar: el filtre no ha tret el blau');
  const passos0 = (await q.locator('.hitem span').allInnerTexts()).length;
  await q.click('#btnAbans'); await q.waitForTimeout(400);
  if (!await q.locator('#cortina').isVisible() || !await q.locator('#etAra').isVisible() || !await q.locator('#etAbans').isVisible()) problemes.push('un toc a «Abans» no posa la cortina amb els rètols ABANS i ARA');
  if (!esBlau(await punt(0.25)) || esBlau(await punt(0.75))) problemes.push(`amb la cortina al mig, l'esquerra no és la foto d'abans o la dreta no és la d'ara (${await punt(0.25)} · ${await punt(0.75)})`);
  // s'arrossega la ratlla cap a l'esquerra, fins a un quart
  { const c = await q.locator('#cortina').boundingBox(), v = await q.locator('#view').boundingBox();
    await q.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await q.mouse.down();
    await q.mouse.move(v.x + v.width * 0.25, c.y + c.height / 2, { steps: 8 }); await q.mouse.up(); await q.waitForTimeout(300); }
  if (!esBlau(await punt(0.12)) || esBlau(await punt(0.40))) problemes.push(`arrossegant la ratlla fins a un quart, la cortina no s'ha mogut (${await punt(0.12)} · ${await punt(0.40)})`);
  if ((await q.locator('.hitem span').allInnerTexts()).length !== passos0) problemes.push('la cortina ha apuntat alguna cosa a l\'historial');
  // el fitxer desat no porta la cortina
  { await q.click('#btnSave'); await q.waitForTimeout(300);
    if (await q.locator('#expComparteix').count()) problemes.push('on el navegador no sap compartir, surt el botó «Comparteix»');
    const [baixada] = await Promise.all([q.waitForEvent('download'), q.locator('.dlg footer .primary').click()]);
    const png = (await import('fs')).readFileSync(await baixada.path()).toString('base64');
    const c = await q.evaluate(async b => { const i = new Image(); await new Promise(ok => { i.onload = ok; i.src = 'data:image/png;base64,' + b; });
      const k = document.createElement('canvas'); k.width = i.width; k.height = i.height; const x = k.getContext('2d'); x.drawImage(i, 0, 0); return [...x.getImageData(40, 300, 1, 1).data]; }, png);
    if (esBlau(c)) problemes.push('la cortina surt al fitxer desat'); await q.waitForTimeout(300); }
  // un altre toc la treu
  await q.click('#btnAbans'); await q.waitForTimeout(400);
  if (await q.locator('#cortina').isVisible() || await q.locator('#etAra').isVisible() || esBlau(await punt(0.12))) problemes.push('un altre toc a «Abans» no treu la cortina');
  // girada de costat ja no fa la mateixa forma: no es posa, i ho diu
  await q.keyboard.press('c'); await q.waitForTimeout(300);
  await q.locator('#opts button', { hasText: /90|Gira/ }).first().click(); await q.waitForTimeout(400);
  await q.keyboard.press('v'); await q.waitForTimeout(200);
  if ((await q.locator('#stDims').innerText()).startsWith('600')) {
    await q.click('#btnAbans'); await q.waitForTimeout(400);
    if (await q.locator('#cortina').isVisible() || !(await q.locator('#stMsg').innerText()).includes('mantén premut')) problemes.push('amb la foto girada de costat, la cortina es posa igualment o no diu què fer: ' + await q.locator('#stMsg').innerText());
  } else problemes.push('la prova de la cortina no ha pogut girar la foto: ' + await q.locator('#stDims').innerText());
  await q.close();

  // ---- compartir: on el navegador en sap (aquí se'n fa veure), surt el botó i comparteix el fitxer
  const ctxC = await navegador.newContext({ viewport: { width: 320, height: 700 }, hasTouch: true, isMobile: true });
  await ctxC.addInitScript(() => { window.__compartit = []; navigator.canShare = d => !!(d && d.files && d.files.length);
    navigator.share = async d => { window.__compartit.push(...d.files.map(f => ({ nom: f.name, tipus: f.type, mida: f.size }))); }; });
  const c = await ctxC.newPage(); vigila(c, 'compartir');
  await c.goto(fitxer('cambra-fosca.html')); await c.waitForTimeout(1500);
  await c.setInputFiles('#file', { name: 'blava.png', mimeType: 'image/png', buffer: blava }); await c.waitForTimeout(600);
  await c.click('#btnSave'); await c.waitForTimeout(300);
  if (!await c.locator('#expComparteix').isVisible()) problemes.push('on el navegador sap compartir, no surt el botó «Comparteix»');
  else {
    const r = await c.evaluate(() => { const p = document.querySelector('.dlg footer').getBoundingClientRect(); return [...document.querySelectorAll('.dlg footer button')].every(b => { const x = b.getBoundingClientRect(); return x.left >= p.left - 0.5 && x.right <= p.right + 0.5 && x.height >= 28; }) && document.documentElement.scrollWidth <= 320; });
    if (!r) problemes.push('a 320 px, els tres botons del quadre de Desa no hi caben');
    await c.locator('.dlg .chip', { hasText: 'JPG' }).click();
    await c.click('#expComparteix'); await c.waitForTimeout(1200);
    const f = await c.evaluate(() => window.__compartit);
    if (f.length !== 1 || f[0].nom !== 'blava-retocada.jpg' || f[0].tipus !== 'image/jpeg' || !(f[0].mida > 500)) problemes.push('«Comparteix» no ha compartit el fitxer que tocava: ' + JSON.stringify(f));
    if (await c.locator('.dlg').count()) problemes.push('després de compartir, el quadre de Desa no es tanca');
  }
  // ---- les fotos enormes (aquí, un mòbil: el límit són 16 megapíxels)
  const gran = Buffer.from((await c.evaluate(() => { const k = document.createElement('canvas'); k.width = 5000; k.height = 4000; const x = k.getContext('2d'); x.fillStyle = '#7a5'; x.fillRect(0, 0, 5000, 4000); return k.toDataURL('image/png'); })).split(',')[1], 'base64');
  if (!await c.evaluate(() => matchMedia('(pointer:coarse)').matches)) problemes.push('la prova de les fotos enormes no fa veure bé un mòbil');
  await c.setInputFiles('#file', { name: 'enorme.png', mimeType: 'image/png', buffer: gran }); await c.waitForTimeout(1500);
  const t = await c.locator('#granText').innerText().catch(() => '');
  if (!t.includes('5000 × 4000') || !t.includes('20 megapíxels') || !t.includes('4472 × 3578')) problemes.push('obrint una foto de 20 megapíxels al mòbil, no avisa ni diu a quina mida l\'obriria: ' + t);
  if ((await c.locator('#stDims').innerText()).startsWith('5000')) problemes.push('la foto enorme s\'obre abans de preguntar');
  { const r = await c.evaluate(() => { const g = document.querySelector('#granSencera'), o = document.querySelector('.dlg footer .primary'); if (!g || !o) return null; return { petit: g.getBoundingClientRect().height < o.getBoundingClientRect().height && parseFloat(getComputedStyle(g).fontSize) < parseFloat(getComputedStyle(o).fontSize) && !g.closest('footer'), cap: document.documentElement.scrollWidth <= 320 }; });
    if (!r || !r.petit || !r.cap) problemes.push('al quadre de la foto enorme, «sencera igualment» no és el botó petit o no hi cap a 320 px: ' + JSON.stringify(r)); }
  await c.locator('.dlg footer .primary').click(); await c.waitForTimeout(1500);
  if (await c.locator('#stDims').innerText() !== '4472 × 3578 px') problemes.push('«Obre-la més petita» no la deixa a 16 megapíxels: ' + await c.locator('#stDims').innerText());
  await c.setInputFiles('#file', { name: 'enorme.png', mimeType: 'image/png', buffer: gran }); await c.waitForTimeout(1500);
  await c.click('#granSencera').catch(() => problemes.push('no hi ha el botó d\'obrir-la sencera')); await c.waitForTimeout(1500);
  if (await c.locator('#stDims').innerText() !== '5000 × 4000 px') problemes.push('«Obre-la sencera igualment» no l\'obre sencera: ' + await c.locator('#stDims').innerText());
  // una de normal (12 megapíxels) s'obre sense preguntar
  const normal = Buffer.from((await c.evaluate(() => { const k = document.createElement('canvas'); k.width = 4000; k.height = 3000; const x = k.getContext('2d'); x.fillStyle = '#a75'; x.fillRect(0, 0, 4000, 3000); return k.toDataURL('image/png'); })).split(',')[1], 'base64');
  await c.setInputFiles('#file', { name: 'normal.png', mimeType: 'image/png', buffer: normal }); await c.waitForTimeout(1500);
  if (await c.locator('.dlg').count() || await c.locator('#stDims').innerText() !== '4000 × 3000 px') problemes.push('una foto de 12 megapíxels no s\'obre directament');
  await ctxC.close();
  console.log(`${problemes.length > abansX ? '✗' : '✓'} la cortina d'abans i després (un toc, arrossegar, no es desa, girada no), compartir (on se'n sap, a 320 px) i les fotos enormes (avisa, més petita, sencera, i les normals sense preguntar)`);
}

// ------------------------------- la Cambra Fosca: la feina es desa sola
// Si la pàgina es tanca, abans es perdia tot. Ara la foto i el que s'hi ha fet
// es desen en aquest aparell i, en tornar a obrir, s'ofereix de continuar.
if (vol('continua')) {
  const abansC = problemes.length;
  const q = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
  vigila(q, 'continua');
  await q.goto(fitxer('cambra-fosca.html'));
  await q.waitForTimeout(1500);
  const desada = () => q.evaluate(() => document.documentElement.dataset.feinaDesada || '');
  const vista = () => q.evaluate(() => { const v = document.querySelector('#view'); return [v.width, v.height, ...v.getContext('2d').getImageData(0, 0, v.width, v.height).data.filter((_, i) => i % 97 === 0)]; });
  const difer = (a, b) => a.length !== b.length ? 999 : a.reduce((t, v, i) => Math.max(t, Math.abs(v - b[i])), 0);
  const espera = async (abans = '') => { await q.waitForFunction(a => (document.documentElement.dataset.feinaDesada || '') !== a, abans, { timeout: 20000 }).catch(() => {}); };
  if (await q.locator('#continua').isVisible()) problemes.push('sense cap foto a mig fer, surt el rètol de continuar');
  // la d'exemple no es desa
  await q.click('#tab-fil'); await q.waitForTimeout(600); await q.click('#fc-cinema'); await q.waitForTimeout(1500);
  if (await desada()) problemes.push('la foto d\'exemple s\'ha desat com a feina a mig fer');
  // una foto: un filtre, l'exposició, una pinzellada i la mida al 50% (que canvia la foto mateixa)
  const dades = await q.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 800, 600); g.addColorStop(0, '#2a6fb0'); g.addColorStop(1, '#e0b060'); x.fillStyle = g; x.fillRect(0, 0, 800, 600);
    x.fillStyle = '#b03030'; x.fillRect(100, 100, 200, 150); x.fillStyle = '#208040'; x.beginPath(); x.arc(560, 380, 120, 0, 7); x.fill(); return c.toDataURL('image/png'); });
  await q.setInputFiles('#file', { name: 'avia.png', mimeType: 'image/png', buffer: Buffer.from(dades.split(',')[1], 'base64') });
  await q.waitForTimeout(600);
  await espera();
  if (!await desada()) problemes.push('en obrir una foto, no es desa com a feina a mig fer');
  await q.click('#tab-fil'); await q.waitForTimeout(600); await q.click('#fc-cinema'); await q.waitForTimeout(400);
  await q.click('#tab-adj');
  await q.evaluate(() => { const r = document.querySelector('#sl-exposure'); r.value = 30; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
  await q.keyboard.press('b');
  { const c = await q.locator('#view').boundingBox(); await q.mouse.move(c.x + 100, c.y + 100); await q.mouse.down();
    for (let i = 0; i < 10; i++) await q.mouse.move(c.x + 100 + i * 20, c.y + 110 + Math.sin(i / 2) * 30); await q.mouse.up(); }
  await q.keyboard.press('v');
  await q.click('#tab-mida'); await q.waitForTimeout(300);
  await q.locator('#pane-mida button', { hasText: '50%' }).click(); await q.click('#midaAplica'); await q.waitForTimeout(600);
  let d0 = await desada(); await q.waitForTimeout(1600);
  if (await desada() === d0) await espera(d0);
  await q.waitForTimeout(400);
  const abans = await vista(), midaAbans = await q.locator('#stDims').innerText();
  if (!midaAbans.includes('400 × 300')) problemes.push('la foto de la prova de continuar no fa 400 × 300: ' + midaAbans);
  // la pàgina es tanca i es torna a obrir
  await q.reload(); await q.waitForTimeout(1500);
  if (!await q.locator('#continua').isVisible()) problemes.push('en tornar a obrir la pàgina, no ofereix de continuar la foto a mig fer');
  else {
    const t = await q.locator('#continuaText').innerText();
    if (!t.includes('avia.png') || !t.includes('400 × 300')) problemes.push('el rètol de continuar no diu quina foto és ni quant fa: ' + t);
    await q.click('#continuaSi'); await q.waitForTimeout(1200);
    if (await q.locator('#continua').isVisible()) problemes.push('després de continuar, el rètol no se\'n va');
    if (await q.locator('#stDims').innerText() !== midaAbans) problemes.push(`continuant, la foto no fa el mateix (${await q.locator('#stDims').innerText()} i era ${midaAbans})`);
    const dif = difer(abans, await vista());
    if (dif > 3) problemes.push(`continuant, la foto no es veu com abans de tancar (diferència de ${dif} nivells: el filtre, l'exposició o la pinzellada no hi són)`);
    if ((await q.locator('.hitem span').allInnerTexts()).join() !== 'Continua avia.png') problemes.push('continuant, l\'historial no comença amb «Continua avia.png»: ' + await q.locator('.hitem span').allInnerTexts());
    if (await q.locator('#fileName').innerText() !== 'avia.png') problemes.push('continuant, el nom de la foto no és el d\'abans');
    // «Abans» ensenya la del principi, de 800 × 600, no la reduïda
    const o = await q.evaluate(async () => { const b = document.querySelector('#btnAbans'); const r = b.getBoundingClientRect();
      b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.x + 5, clientY: r.y + 5, pointerId: 7 })); await new Promise(r => setTimeout(r, 300));
      const v = document.querySelector('#view'), d = v.getContext('2d').getImageData(Math.round(v.width * 0.25), Math.round(v.height * 0.29), 1, 1).data;
      b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 })); return [...d]; });
    if (!(o[0] > 150 && o[1] < 80 && o[2] < 80)) problemes.push('continuant, «Abans» no ensenya la foto del principi (el quadrat vermell sense el filtre): ' + o);
    // continuar no l'esborra: un altre canvi es desa, i si es torna a tancar, hi és
    d0 = await desada();
    await q.click('#tab-fil'); await q.waitForTimeout(500); await q.click('#fc-cap'); await espera(d0); await q.waitForTimeout(300);
    const senseFiltre = await vista();
    await q.reload(); await q.waitForTimeout(1500);
    if (!await q.locator('#continua').isVisible()) problemes.push('la segona vegada que es tanca, ja no ofereix de continuar');
    else { await q.click('#continuaSi'); await q.waitForTimeout(1200);
      if (difer(senseFiltre, await vista()) > 3) problemes.push('la segona vegada, no es continua des de l\'últim canvi'); }
  }
  // descartar-la: no torna a sortir
  await q.reload(); await q.waitForTimeout(1500);
  if (await q.locator('#continua').isVisible()) { await q.click('#continuaNo'); await q.waitForTimeout(500); }
  else problemes.push('abans de descartar, el rètol de continuar no hi és');
  await q.reload(); await q.waitForTimeout(1500);
  if (await q.locator('#continua').isVisible()) problemes.push('després de descartar-la, la foto a mig fer torna a sortir');
  // a 320 px el rètol hi cap
  await q.setInputFiles('#file', { name: 'un-nom-de-foto-molt-llarg-de-les-vacances-de-l-estiu.png', mimeType: 'image/png', buffer: Buffer.from(dades.split(',')[1], 'base64') });
  await q.waitForTimeout(600); await espera();
  await q.setViewportSize({ width: 320, height: 640 }); await q.reload(); await q.waitForTimeout(1500);
  { const r = await q.evaluate(() => { const c = document.querySelector('#continua').getBoundingClientRect(), b = [...document.querySelectorAll('#continua button')].map(x => x.getBoundingClientRect());
      return { vis: !document.querySelector('#continua').hidden, esq: c.left, dre: c.right, sw: document.documentElement.scrollWidth, botons: b.every(x => x.left >= c.left && x.right <= c.right + 0.5 && x.height >= 28) }; });
    if (!r.vis || r.esq < 0 || r.dre > 320 || r.sw > 320 || !r.botons) problemes.push('a 320 px, el rètol de continuar no hi cap: ' + JSON.stringify(r)); }
  console.log(`${problemes.length > abansC ? '✗' : '✓'} la feina es desa sola: es continua on era (filtre, exposició, pinzellada i mida), «Abans», dues vegades, descartar, i a 320 px`);
  await q.close();
}

// ------------------------------- la Cambra Fosca com a app que s'instal·la
// Chrome mateix diu si es pot instal·lar (i per què no), el programa de sense
// connexió només s'ha d'ocupar de la Cambra Fosca, i amb la xarxa tallada
// l'editor s'ha d'obrir igual. Es serveix com a GitHub, a /Eines/.
if (vol('app')) {
  const { createServer } = await import('http');
  const { readFileSync, statSync } = await import('fs');
  const { extname, join } = await import('path');
  const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
                  '.wasm': 'application/wasm', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const servidor = createServer((q, r) => {
    const f = join(AQUI, decodeURIComponent(q.url.split('?')[0]).replace(/^\/Eines/, ''));
    if (!f.startsWith(AQUI) || !existsSync(f) || statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': TIPUS[extname(f)] || 'application/octet-stream' });
    r.end(readFileSync(f));
  });
  await new Promise(ok => servidor.listen(0, '127.0.0.1', ok));
  const BASE = `http://127.0.0.1:${servidor.address().port}/Eines/`;
  const abansDe = problemes.length;

  // la fitxa de l'app: les icones hi són i fan la mida que diuen
  const fitxa = JSON.parse(readFileSync(join(AQUI, 'cambra-fosca.webmanifest'), 'utf8'));
  for (const ic of fitxa.icons) {
    const f = join(AQUI, ic.src);
    if (!existsSync(f)) { problemes.push(`la icona ${ic.src} no existeix`); continue; }
    const png = readFileSync(f), w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    if (`${w}x${h}` !== ic.sizes) problemes.push(`la icona ${ic.src} fa ${w}x${h} i diu ${ic.sizes}`);
  }
  if (!fitxa.icons.some(i => i.purpose === 'maskable')) problemes.push('l\'app no té cap icona «maskable» (la que el mòbil retalla en rodó)');
  // El que fa que s'obri de debò com una app. Chrome no ho comprova: les
  // versions noves deixen «instal·lar» gairebé qualsevol pàgina, i amb una
  // fitxa que l'obria com una pàgina normal no s'hi va queixar.
  if (fitxa.display !== 'standalone') problemes.push('l\'app no s\'obre sola, sense la barra del navegador (display: ' + fitxa.display + ')');
  { const u = new URL(fitxa.start_url, 'https://x/Eines/cambra-fosca.webmanifest').pathname, a = new URL(fitxa.scope, 'https://x/Eines/cambra-fosca.webmanifest').pathname;
    if (!u.startsWith(a)) problemes.push(`l'app comença a ${u}, fora del que és seu (${a})`);
    if (u !== '/Eines/cambra-fosca.html') problemes.push('l\'app no comença a la Cambra Fosca: ' + u);
    if (a.endsWith('/Eines/')) problemes.push('l\'abast de l\'app és tota la carpeta de les Eines, i agafaria també la portada i la Revisió'); }
  for (const k of ['name', 'short_name', 'theme_color', 'background_color', 'lang'])
    if (!fitxa[k]) problemes.push(`a la fitxa de l'app hi falta «${k}»`);

  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await ctx.newPage();
  vigila(p, 'app');
  await p.goto(BASE + 'cambra-fosca.html');
  await p.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(p);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  if (installabilityErrors.length) problemes.push('Chrome diu que no es pot instal·lar: ' + installabilityErrors.map(e => e.errorId).join(', '));
  const { errors: errorsFitxa } = await cdp.send('Page.getAppManifest');
  if (errorsFitxa.length) problemes.push('la fitxa de l\'app té errors: ' + errorsFitxa.map(e => e.message).join('; '));

  await p.reload(); await p.waitForTimeout(1200);
  const sw = await p.evaluate(async () => ({ ctrl: !!navigator.serviceWorker.controller, abast: (await navigator.serviceWorker.getRegistration())?.scope || '' }));
  if (!sw.ctrl) problemes.push('el programa de sense connexió no s\'ocupa de la Cambra Fosca');
  if (!sw.abast.endsWith('/Eines/cambra-fosca')) problemes.push('el programa de sense connexió no té l\'abast que toca: ' + sw.abast);
  // els models no els desa el programa de sense connexió (ja els desa l'app):
  // tampoc els trossos dels que van partits (abans sí, i ocupaven el doble)
  const desat = await p.evaluate(async () => {
    await (await fetch('ia/models/color.onnx.3')).arrayBuffer();
    await new Promise(r => setTimeout(r, 500));
    for (const k of await caches.keys()) if (k.startsWith('cambra-fosca-v') && await (await caches.open(k)).match('ia/models/color.onnx.3')) return k;
    return null;
  });
  if (desat) problemes.push('el programa de sense connexió desa també els trossos dels models (a ' + desat + '), i ocupen el doble');
  const p2 = await ctx.newPage(); await p2.goto(BASE + 'revisio.html'); await p2.waitForTimeout(400);
  if (await p2.evaluate(() => !!navigator.serviceWorker.controller)) problemes.push('el programa de sense connexió de la Cambra Fosca també s\'ocupa de la Revisió');
  await p2.close();

  await ctx.setOffline(true);
  await p.reload().catch(() => {});
  await p.waitForTimeout(1200);
  if (await p.locator('#stDims').innerText().catch(() => '') !== '1500 × 1000 px') problemes.push('sense connexió, la Cambra Fosca no s\'obre');
  // L'«aïllament»: perquè la IA faci servir uns quants nuclis del processador,
  // el programa de sense connexió posa a la pàgina dues capçaleres que GitHub
  // no envia. A partir de la segona visita (també sense xarxa, com ara) la
  // pàgina ha de ser aïllada, i la Revisió no.
  if (!await p.evaluate(() => self.crossOriginIsolated)) problemes.push('a partir de la segona visita, la Cambra Fosca no queda aïllada (la IA aniria amb un sol nucli)');
  await ctx.setOffline(false);
  // i la IA ha d'anar amb uns quants fils: els fils són fitxers de la carpeta
  // del motor, i si el programa no els cobreix, el navegador els bloqueja
  { await p.reload(); await p.waitForTimeout(1500);
    const nuclis = await p.evaluate(() => navigator.hardwareConcurrency || 1);
    await obreTargeta(p, 'fons'); await p.click('#iaMode-mobil'); await p.click('#fonsD-blanc'); await p.click('#fonsGo');
    await p.waitForFunction(() => !document.querySelector('#vel').hidden, null, { timeout: 5000 }).catch(() => {});
    await p.waitForFunction(() => document.querySelector('#vel').hidden, null, { timeout: 300000 }); await p.waitForTimeout(300);
    const fils = +(await p.evaluate(() => document.documentElement.dataset.iaFils || 0));
    if (!(await p.locator('.hitem span').allInnerTexts()).some(t => t.startsWith('Treu el fons'))) problemes.push('amb la pàgina aïllada, la IA no funciona: ' + await p.locator('#stMsg').innerText());
    if (nuclis > 1 && fils !== Math.min(4, nuclis)) problemes.push(`amb la pàgina aïllada i ${nuclis} nuclis, la IA va amb ${fils} fils`);
    const ia = await p.evaluate(async () => (await navigator.serviceWorker.getRegistration('ia/ort/x'))?.scope || '');
    if (!ia.endsWith('/Eines/ia/ort/')) problemes.push('el programa de sense connexió no cobreix la carpeta del motor de la IA: ' + ia); }

  // el botó d'instal·lar (quan el navegador el deixa sortir) hi cap a 320
  await p.setViewportSize({ width: 320, height: 700 }); await p.waitForTimeout(200);
  await p.evaluate(() => { document.querySelector('#btnInstal').hidden = false; });
  if (await p.evaluate(() => { const t = document.querySelector('.topbar'); return t.scrollWidth > t.clientWidth + 1; }))
    problemes.push('amb el botó INSTAL·LA, la barra de dalt no hi cap a 320 px');

  console.log(`${problemes.length > abansDe ? '✗' : '✓'} com a app: Chrome la deixa instal·lar, s'obre sense connexió, queda aïllada (la IA amb uns quants nuclis), i no toca la Revisió`);
  await ctx.close();
  servidor.close();
}

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
if (vol('revisio')) {
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

// ------------------------------------------------------------ les visites
// Es compten amb Cloudflare Web Analytics, però només a la web de debò: fent
// veure que les pàgines són a oscarbellosido.github.io, cadascuna ha de
// demanar el comptador amb el codi del compte; obertes des d'aquí (com a les
// proves), cap. Res no surt a internet: el comptador es fa veure.
if (vol('visites')) {
  const { readFileSync: llegeix } = await import('fs');
  const ctx = await navegador.newContext({ serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const vistos = [];
  await pg.route('https://static.cloudflareinsights.com/**', r => { vistos.push(r.request().url()); r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }); });
  await pg.route('https://oscarbellosido.github.io/Eines/**', r => {
    const f = resolve(AQUI, decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/Eines\//, '')) || 'index.html');
    if (!existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ status: 200, body: llegeix(f), contentType: f.endsWith('.html') ? 'text/html; charset=utf-8' : undefined });
  });
  const abansV = problemes.length;
  for (const pag of ['index.html', 'cambra-fosca.html', 'revisio.html']) {
    vistos.length = 0;
    await pg.goto('https://oscarbellosido.github.io/Eines/' + pag); await pg.waitForTimeout(600);
    const codi = await pg.evaluate(() => document.querySelector('script[data-cf-beacon]')?.getAttribute('data-cf-beacon') || '');
    if (!vistos.length || !codi.includes('51a8a2b170524eef90da17970c35d1a5')) problemes.push(`a la web de debò, ${pag} no compta la visita (o no amb el codi del compte)`);
    vistos.length = 0;
    await pg.goto(fitxer(pag)); await pg.waitForTimeout(400);
    if (vistos.length || await pg.evaluate(() => !!document.querySelector('script[data-cf-beacon]'))) problemes.push(`obert des d'aquí, ${pag} compta la visita (les proves no han de comptar)`);
  }
  console.log(`${problemes.length > abansV ? '✗' : '✓'} les visites: es compten només a la web de debò, a les tres pàgines`);
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
console.log(NOMES.length ? '✓ tot bé (només: ' + NOMES.join(', ') + ')' : '✓ tot bé');
