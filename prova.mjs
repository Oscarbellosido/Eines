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
