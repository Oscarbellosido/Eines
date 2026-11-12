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
  for (const m of ['realesr-general-x4v3-v2', 'realesrgan-x4plus', 'migan-512']) {
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
  await p.click('#tab-amp');
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
    await p.click('#tab-amp'); await p.click('#iaMode-ordinador');
    if (!await p.locator('#iaGo').isDisabled()) problemes.push('una foto de 24 megapíxels es deixa ampliar a l\'ordinador');
    if (!(await avisBenEscrit('foto molt gran')).includes('ja és molt gran')) problemes.push('amb una foto molt gran, l\'avís no diu que ja és molt gran');
  }

  // el model lleuger, ×4
  await obre(64, 48);
  await p.click('#tab-amp');
  await p.click('#iaMode-mobil'); await p.click('#iaF-4');
  await p.click('#iaGo');
  await acaba();
  if (await mida() !== '256 × 192 px') problemes.push('el model lleuger ×4 no dona la mida que toca: ' + await mida());
  if (!(await historial()).includes('Amplia ×4 · model lleuger')) problemes.push('l\'ampliació no surt a l\'historial');
  // en acabar, a dalt del panell diu que s'ha fet, abans que cap avís de «no hi cap»
  // (l'usuari va esperar una hora i el primer que va veure va ser un avís vermell)
  await p.click('#tab-amp');
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
  await p.click('#tab-amp');
  if (!(await text('#iaLinies')).includes('no cal baixar res')) problemes.push('la segona vegada torna a dir que s\'ha de baixar el model');

  // aturar a mig fer deixa la foto com era
  await obre(400, 300);
  await p.click('#tab-amp');
  await p.click('#iaMode-mobil'); await p.click('#iaF-2');
  await p.click('#iaGo');
  await p.waitForFunction(() => /Tros [1-9]/.test(document.querySelector('#velDetall').textContent), null, { timeout: 120000 });
  await p.click('#velAtura');
  await acaba();
  if (await mida() !== '400 × 300 px') problemes.push('aturant a mig fer, la foto ha canviat: ' + await mida());
  if ((await historial()).some(h => h.startsWith('Amplia'))) problemes.push('una ampliació aturada surt a l\'historial');

  // una feina llarga (el model gran sense gràfica): ho diu de seguida i pregunta,
  // amb el percentatge a la pestanya; i «Atura» deixa la foto com era
  await p.click('#tab-amp');
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
  await p.click('#tab-amp');
  await p.click('#iaMode-ordinador'); await p.click('#iaF-4');
  await p.click('#iaGo');
  await acaba(600000);
  if (await mida() !== '128 × 96 px') problemes.push('el model gran ×4 no dona la mida que toca: ' + await mida());

  console.log(`${problemes.length > abansDe ? '✗' : '✓'} ampliar amb IA (pel processador): lleuger ×4, gran ×4, límits, aturar, desfer i refer, i la segona vegada sense baixar res`);
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

    // esborrar de debò
    await dit(ziga(290, 340, 250, 372, 12));
    await q.click('#treuGo');
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
    console.log(`${problemes.length > abansT ? '✗' : '✓'} esborrar coses amb el dit (pel processador): pintar amb el dit, el vermell no es desa, netejar, esborrar la paret de maons sense tocar la resta, desfer i refer, i una foto gran`);
    await ctx.close();
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
