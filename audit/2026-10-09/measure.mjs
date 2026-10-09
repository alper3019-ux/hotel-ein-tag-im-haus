// Usage: node measure.mjs <url> <outDir> [runs=3]
// Lighthouse 13 (Node-API, Standard-Mobilprofil bzw. desktop-config, simuliertes Throttling),
// je Formfaktor N Läufe in frischem Headless-Chrome, Median je Kennzahl.
// Danach Playwright (Chrome): axe-core 4.x nach Scroll durch die Seite, Konsolenfehler, HTTP-Status aller Requests.
import fs from 'node:fs';
import path from 'node:path';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from '/workspace/site-3d/node_modules/playwright/index.mjs';

const [url, outDir, runsArg] = process.argv.slice(2);
const runs = Number(runsArg || 3);
fs.mkdirSync(outDir, { recursive: true });
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const summary = { url, date: new Date().toISOString(), method: `Lighthouse ${'13'} Node-API, ${runs} Läufe je Formfaktor, Median; axe-core nach Scroll; Playwright-Chrome`, lighthouse: {}, axe: {}, console: {}, requests: {} };

for (const ff of ['mobile', 'desktop']) {
  const res = [];
  for (let i = 0; i < runs; i++) {
    const chrome = await chromeLauncher.launch({ chromePath: '/usr/bin/google-chrome', chromeFlags: ['--headless=new', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    let r;
    try { r = await lighthouse(url, { port: chrome.port, output: ['json'], logLevel: 'error' }, ff === 'desktop' ? desktopConfig : undefined); }
    catch (e) { console.log('LH-Fehler, Lauf wird wiederholt:', e.code || e.message); }
    finally { await chrome.kill(); }
    if (!r || r.lhr.runtimeError) { if (r) console.log('runtimeError, Lauf wird wiederholt:', r.lhr.runtimeError.code); if ((summary.retries = (summary.retries || 0) + 1) > 6) throw new Error('zu viele Fehlläufe'); i--; continue; }
    const lhr = r.lhr;
    const cat = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
    const m = (id) => lhr.audits[id]?.numericValue;
    res.push({ cat, lcp: m('largest-contentful-paint'), cls: m('cumulative-layout-shift'), tbt: m('total-blocking-time'), fcp: m('first-contentful-paint'), si: m('speed-index'), bytes: m('total-byte-weight') });
    fs.writeFileSync(path.join(outDir, `lh-${ff}-${i}.json`), r.report[0]);
  }
  const keys = Object.keys(res[0].cat);
  summary.lighthouse[ff] = {
    runs: res,
    median: { ...Object.fromEntries(keys.map((k) => [k, median(res.map((x) => x.cat[k]))])),
      ...Object.fromEntries(['lcp', 'cls', 'tbt', 'fcp', 'si', 'bytes'].map((k) => [k, Math.round(median(res.map((x) => x[k])) * 1000) / 1000])) },
  };
  console.log(ff, JSON.stringify(summary.lighthouse[ff].median), 'perf/run', res.map((x) => x.cat.performance).join(','));
}

const axeSrc = fs.readFileSync('/workspace/audit/node_modules/axe-core/axe.min.js', 'utf8');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const [name, opts] of [['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }], ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = []; const reqs = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => reqs.push({ url: r.url(), status: 'failed', err: r.failure()?.errorText }));
  page.on('response', (r) => reqs.push({ url: r.url(), status: r.status() }));
  await page.goto(url, { waitUntil: 'load', timeout: 180000 }); await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(2500);
  await page.addScriptTag({ content: axeSrc });
  const ax = await page.evaluate(async () => await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
  const v = ax.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.length, help: x.help, targets: x.nodes.slice(0, 6).map((n) => n.target.join(' ')) }));
  const byImpact = {}; for (const x of v) byImpact[x.impact] = (byImpact[x.impact] || 0) + 1;
  summary.axe[name] = { violations: v.length, byImpact, list: v };
  summary.console[name] = errors;
  const bad = reqs.filter((r) => r.status === 'failed' || r.status >= 400);
  summary.requests[name] = { total: reqs.length, bad };
  console.log('axe', name, v.length, JSON.stringify(byImpact), v.map((x) => `${x.id}:${x.impact}:${x.nodes}`).join(' '), '| console errors', errors.length, '| requests', reqs.length, 'bad', bad.length);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
