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
  if (e.targetes.join() !== 'ratllades,nitida,esborra,cares,color,fons,amp') problemes.push('les targetes de la IA no són les set, per ordre: ' + e.targetes);
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
{
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
{
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
{
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
  for (const m of ['realesr-general-x4v3-v2', 'realesrgan-x4plus', 'migan-512', 'u2netp', 'isnet-fp16', 'ratllades', 'cares-troba']) {
    const bytes = readFileSync(join(AQUI, 'ia/models', m + '.onnx'));
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

  // ----------------------------- esborrar coses amb el dit (MI-GAN)
  // Amb un mòbil simulat i el dit de debò: es pinta de vermell un objecte
  // d'una paret de maons i la IA l'ha de treure i continuar la paret, sense
  // tocar res de la resta de la foto. El vermell només va a la pantalla.
  {
    const abansT = problemes.length;
    const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, acceptDownloads: true });
    const q = await ctx.newPage();
    vigila(q, 'esborra');
    await q.goto(BASE);
    await q.waitForTimeout(1500);
    // una paret de maons amb un objecte vermell al davant; a escala «e»
    const paret = e => q.evaluate(e => {
      const c = document.createElement('canvas'); c.width = 640 * e; c.height = 480 * e;
      const x = c.getContext('2d'); x.scale(e, e);
      const g = x.createLinearGradient(0, 0, 0, 200); g.addColorStop(0, '#5b8fd0'); g.addColorStop(1, '#a8c8e8');
      x.fillStyle = g; x.fillRect(0, 0, 640, 200);
      x.fillStyle = '#8f8a82'; x.fillRect(0, 200, 640, 200);
      x.strokeStyle = '#6f6a62'; x.lineWidth = 2;
      for (let j = 200; j < 400; j += 20) for (let i = -40; i < 680; i += 40) x.strokeRect(i + ((j / 20) % 2) * 20, j, 40, 20);
      x.fillStyle = '#5a544c'; x.fillRect(0, 400, 640, 80);
      x.fillStyle = '#d02a2a'; x.fillRect(280, 250, 70, 120);
      return c.toDataURL('image/png');
    }, e);
    const obreParet = async e => {
      const dades = await paret(e);
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
      await q.waitForTimeout(250);
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
    console.log(`${problemes.length > abansT ? '✗' : '✓'} esborrar coses amb el dit (pel processador): pintar amb el dit, el vermell no es desa, netejar, la goma del vermell, zoom amb dos dits, el botó que sura, esborrar la paret de maons sense tocar la resta, abans i després, desfer i refer, i una foto gran`);
    await ctx.close();
  }

  // ------------------------------------- trobar i esborrar ratllades
  // Una foto vella feta aquí mateix (cel, muntanyes, una casa, arbustos, tons
  // sepia i gra) amb ratllades clares i un plec, que se sap on són: la IA les
  // ha de marcar, deixar el que hi ha la goma, i l'esborrador les ha de treure
  // sense tocar la resta.
  {
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
    if (!(await q.locator('.hitem span').allInnerTexts()).includes('Esborra les ratllades (IA)')) problemes.push('esborrar les ratllades no surt a l\'historial');
    const c2 = await compara();
    if (!(c2.err < c1.errVella * 0.25)) problemes.push(`a les ratllades marcades, la foto no s'acosta prou a la neta (diferència ${c2.err.toFixed(1)}; abans ${c1.errVella.toFixed(1)})`);
    if (c2.canviFora > 0.5) problemes.push(`esborrant les ratllades, ha canviat la resta de la foto (${c2.canviFora.toFixed(2)} de mitjana)`);
    if (c2.zona < c2.zonaVella * 0.8) problemes.push(`on s'havia tret el vermell amb la goma, la ratllada s'ha esborrat igualment (diferència ${c2.zona.toFixed(1)} de ${c2.zonaVella.toFixed(1)})`);
    await q.click('#btnUndo'); await q.waitForTimeout(400);
    if ((await compara()).err < c1.errVella * 0.9) problemes.push('desfer no torna les ratllades');
    console.log(`${problemes.length > abansR ? '✗' : '✓'} trobar i esborrar ratllades (pel processador): en marca el ${(c1.trobat * 100).toFixed(0)}% (i de més, el ${(c1.demes * 100).toFixed(2)}%), la goma les respecta, les marcades, de ${c1.errVella.toFixed(0)} a ${c2.err.toFixed(0)} de diferència amb la foto neta, i desfer`);
    await q.close();
  }

  // ------------------------------------------------- arreglar les cares
  // Una cara dibuixada aquí mateix (cabell, ulls, nas, boca) i borrosa: la IA
  // l'ha de trobar i tornar-la nítida, al seu lloc (els ulls on eren), sense
  // tocar la resta de la foto. «Suau» n'ha de canviar menys que «Fort». En una
  // foto sense cares, ho ha de dir. No es fa servir la foto de ningú.
  {
    const abansC = problemes.length;
    const q = await navegador.newPage({ viewport: { width: 1280, height: 800 } });
    vigila(q, 'cares');
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
    const arregla = async forca => {
      await obreTargeta(q, 'cares'); await q.click('#caresF-' + forca); await q.click('#cares');
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
    await arregla('fort');
    if (!(await q.locator('.hitem span').allInnerTexts()).includes('Arregla les cares (1)')) problemes.push('arreglar les cares no surt a l\'historial amb 1 cara: ' + (await q.locator('.hitem span').allInnerTexts()).join(' · '));
    const cara = await mira([170, 150, 140, 170]), fora = await mira([540, 40, 160, 160]);
    if (!(cara.nit > cara.nit0 * 1.3)) problemes.push(`la cara arreglada no és més nítida (${cara.nit.toFixed(2)} contra ${cara.nit0.toFixed(2)})`);
    if (fora.max > 0) problemes.push(`arreglant la cara ha canviat el quadre de la paret, lluny de la cara (${fora.max})`);
    // els ulls continuen on eren (si la cara es tornés a un altre lloc, no hi serien)
    for (const ex of [200, 280]) { const v = await ull(ex, 207); if (v > 110) problemes.push(`després d'arreglar la cara, l'ull de ${ex},207 ja no hi és (lluminositat ${v.toFixed(0)})`); }
    if (!(await q.locator('#caresRes').innerText()).includes('amb el processador')) problemes.push('després d\'arreglar les cares no diu amb què s\'ha fet');
    const difFort = cara.dif;
    await q.click('#btnUndo'); await q.waitForTimeout(300);
    if ((await mira([170, 150, 140, 170])).max > 0) problemes.push('desfer no torna la cara d\'abans');
    await arregla('suau');
    const suau = await mira([170, 150, 140, 170]);
    if (!(suau.dif < difFort * 0.75)) problemes.push(`«Suau» canvia la cara tant com «Fort» (${suau.dif.toFixed(1)} contra ${difFort.toFixed(1)})`);
    // una foto sense cares (la d'exemple): ho diu i no hi toca
    await q.setInputFiles('#file', { name: 'paisatge.png', mimeType: 'image/png', buffer: Buffer.from((await q.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 300;
      const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, '#5b8fd0'); g.addColorStop(1, '#3a5a2a'); x.fillStyle = g; x.fillRect(0, 0, 400, 300); return c.toDataURL('image/png'); })).split(',')[1], 'base64') });
    await q.waitForTimeout(500);
    await arregla('fort');
    if (!(await q.locator('#stMsg').innerText()).includes('No he trobat cap cara') || (await q.locator('.hitem span').allInnerTexts()).length !== 1)
      problemes.push('en una foto sense cares, no diu que no n\'ha trobat cap o hi ha tocat');
    console.log(`${problemes.length > abansC ? '✗' : '✓'} arreglar les cares (pel processador): troba la cara dibuixada, nitidesa de ${cara.nit0.toFixed(1)} a ${cara.nit.toFixed(1)}, els ulls al seu lloc, la resta igual, «Suau» menys que «Fort», sense cares ho diu, i desfer`);
    await q.close();
  }

  // ------------------------------------------------- treure el fons
  // Un gerro blau sobre una paret amb taques i una taula: se sap exactament
  // quins punts són el gerro. Transparent, blanc, d'un color i difuminat (sense
  // aura del color del gerro al voltant), desar en JPG i PNG, desfer, i el model
  // gran una vegada.
  {
    const abansF = problemes.length;
    const q = await navegador.newPage({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
    vigila(q, 'fons');
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
    console.log(`${problemes.length > abansF ? '✗' : '✓'} treure el fons (pel processador): transparent (encerta el ${(e1 * 100).toFixed(1)}% amb el model petit i el ${(e2 * 100).toFixed(1)}% amb el gran), blanc, d'un color, difuminat sense aura, desar en JPG i PNG, i desfer`);
    await q.close();
  }
  // ------------------------------------------------- posar color
  // Un paisatge en grisos dibuixat aquí (cel, muntanyes, mar, sorra): que hi
  // posi color, que la claredat de cada punt sigui la mateixa d'abans (el
  // detall és el de la foto), que «Suau» faci els colors més apagats, que la
  // segona vegada no torni a baixar res, desfer, i que avisi si la foto ja té
  // colors (però no si és sèpia).
  {
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
  // ------------------------------------------------- soroll i borrós
  // Una foto dibuixada aquí (degradats, cercles, ratlles i lletres): amb
  // soroll, «Treu el soroll» l'ha d'acostar molt a la neta, «Suau» menys; amb
  // una foto més petita que un tros, també; i, desenfocada, «Fes-la més
  // nítida» l'ha d'acostar a la neta. La mida no canvia, desfer la torna, i la
  // segona vegada no es torna a baixar res.
  {
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

// ------------------------------- la Cambra Fosca com a app que s'instal·la
// Chrome mateix diu si es pot instal·lar (i per què no), el programa de sense
// connexió només s'ha d'ocupar de la Cambra Fosca, i amb la xarxa tallada
// l'editor s'ha d'obrir igual. Es serveix com a GitHub, a /Eines/.
{
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
  await ctx.setOffline(false);

  // el botó d'instal·lar (quan el navegador el deixa sortir) hi cap a 320
  await p.setViewportSize({ width: 320, height: 700 }); await p.waitForTimeout(200);
  await p.evaluate(() => { document.querySelector('#btnInstal').hidden = false; });
  if (await p.evaluate(() => { const t = document.querySelector('.topbar'); return t.scrollWidth > t.clientWidth + 1; }))
    problemes.push('amb el botó INSTAL·LA, la barra de dalt no hi cap a 320 px');

  console.log(`${problemes.length > abansDe ? '✗' : '✓'} com a app: Chrome la deixa instal·lar, s'obre sense connexió, i no toca la Revisió`);
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
