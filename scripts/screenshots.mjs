/**
 * Screenshots + Konsolenprüfung (Playwright, Chrome mit SwiftShader-WebGL).
 *   URL=http://localhost:4180/hotel-ein-tag-im-haus/ OUT=screens node scripts/screenshots.mjs [desktop|mobile|reduced|all]
 * Meldet Konsolenfehler/-warnungen, Seitenfehler, HTTP-Fehler und Drittanbieter-Requests.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const URL = process.env.URL || 'http://localhost:4180/hotel-ein-tag-im-haus/';
const OUT = process.env.OUT || 'screens';
const mode = process.argv[2] || 'all';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--lang=de-DE', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const origin = new globalThis.URL(URL).origin;
let failed = false;

async function run(name, ctxOpts, { day = [], sections = [], reduced = false, extras } = {}) {
  const ctx = await browser.newContext({ ...ctxOpts, reducedMotion: reduced ? 'reduce' : 'no-preference', locale: 'de-DE' });
  const page = await ctx.newPage();
  const errors = [], third = new Set(), bad = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
  page.on('request', (r) => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) third.add(r.url()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}-hero.png` });
  for (const f of day) {
    await page.evaluate((f) => { const st = window.__dayST; const y = st ? st.start + (st.end - st.start) * f + 2 : document.querySelector('#tag').offsetTop; window.scrollTo(0, y); }, f);
    await page.waitForTimeout(f === day[0] ? 6000 : 2500);
    const info = await page.evaluate(() => `hour=${document.querySelector('#tag').dataset.hour} ready=${document.querySelector('#tag').classList.contains('is-ready')}`);
    const file = `${OUT}/${name}-tag-${String(Math.round(f * 100)).padStart(3, '0')}.png`;
    await page.screenshot({ path: file });
    console.log(name, file, info);
  }
  for (const id of sections) {
    await page.evaluate((id) => window.scrollTo(0, document.getElementById(id).getBoundingClientRect().top + scrollY - 70), id);
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/${name}-${id}.png` });
  }
  if (extras) await extras(page, name);
  console.log(`${name}: Konsole ${errors.length ? errors.join(' | ') : 'keine Fehler/Warnungen'}; HTTP>=400: ${bad.length ? bad.join(', ') : 'keine'}; Drittanbieter: ${third.size ? [...third].join(', ') : 0}`);
  if (errors.length || bad.length || third.size) failed = true;
  await ctx.close();
}

const extras = async (page, name) => {
  // Buchung: ungültig, dann gültig (Demo-Hinweis)
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(800);
  await page.click('.booking__submit'); await page.waitForTimeout(300);
  console.log(name, 'Buchung leer:', await page.textContent('#booking-status'));
  const d = new Date(); d.setDate(d.getDate() + 10);
  const iso = (x) => x.toISOString().slice(0, 10);
  await page.fill('#arrive', iso(d)); await page.dispatchEvent('#arrive', 'change');
  await page.click('.booking__submit'); await page.waitForTimeout(300);
  console.log(name, 'Buchung gültig:', await page.textContent('#booking-status'));
  await page.screenshot({ path: `${OUT}/${name}-booking-demo.png` });
  // Dock + Dialog
  await page.evaluate(() => window.scrollTo(0, document.getElementById('kulinarik').offsetTop)); await page.waitForTimeout(1500);
  await page.click('.dock__btn'); await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}-booking-dialog.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  // Zimmer-Dialog
  await page.evaluate(() => window.scrollTo(0, document.getElementById('zimmer').offsetTop)); await page.waitForTimeout(1500);
  await page.click('[data-room-open="suite"]'); await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}-room-dialog.png` });
  await page.keyboard.press('Escape'); await page.waitForTimeout(800);
};

if (mode === 'all' || mode === 'desktop') await run('desktop', { viewport: { width: 1440, height: 900 } }, { day: [0, 0.2, 0.4, 0.6, 0.8, 1], sections: ['zimmer', 'kulinarik', 'spa', 'umgebung', 'angebote', 'anfrage'], extras });
if (mode === 'all' || mode === 'mobile') await run('mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, { day: [0, 0.6, 1], sections: ['zimmer', 'umgebung'], extras });
if (mode === 'all' || mode === 'reduced') await run('reduced', { viewport: { width: 1440, height: 900 } }, { sections: ['tag'], reduced: true });
await browser.close();
process.exitCode = failed ? 1 : 0;
