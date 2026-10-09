// Usage: node ab.mjs <urlA(before)> <urlB(after)> <outDir> [runs=5]
// Gepaarte, abwechselnde Messung A/B (A,B,A,B,...) je Formfaktor, damit wechselnde Rechnerlast beide gleich trifft.
// Lighthouse 13.5 (mobil: Standardprofil Moto G Power, simuliertes 4G + 4x CPU; desktop: desktop-config), Median.
// Danach axe-core 4.14 (nach Scroll durch die Seite), Konsolenfehler und HTTP-Status aller Requests für A und B.
import fs from 'node:fs';
import path from 'node:path';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from '/workspace/site-3d/node_modules/playwright/index.mjs';

const [A, B, outDir, runsArg] = process.argv.slice(2);
const runs = Number(runsArg || 5);
fs.mkdirSync(outDir, { recursive: true });
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const out = { A, B, date: new Date().toISOString(), runs, lighthouse: { A: {}, B: {} }, axe: { A: {}, B: {} }, console: { A: {}, B: {} }, badRequests: { A: {}, B: {} } };

let retries = 0;
async function lh(url, ff) {
  for (;;) {
    let r = null;
    try { r = await lh1(url, ff); } catch (e) { console.log('LH-Fehler, wiederholt:', e.code || e.message); }
    if (r) return r;
    if (++retries > 8) throw new Error('zu viele Fehlläufe');
  }
}
async function lh1(url, ff) {
  const chrome = await chromeLauncher.launch({ chromePath: '/usr/bin/google-chrome', chromeFlags: ['--headless=new', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const r = await lighthouse(url, { port: chrome.port, output: ['json'], logLevel: 'error' }, ff === 'desktop' ? desktopConfig : undefined);
    const l = r.lhr; if (l.runtimeError) { console.log('runtimeError', l.runtimeError.code); return null; }
    const m = (id) => l.audits[id]?.numericValue;
    return { cat: Object.fromEntries(Object.entries(l.categories).map(([k, v]) => [k, Math.round(v.score * 100)])), lcp: m('largest-contentful-paint'), cls: m('cumulative-layout-shift'), tbt: m('total-blocking-time'), fcp: m('first-contentful-paint'), si: m('speed-index'), bytes: m('total-byte-weight'), bench: l.environment.benchmarkIndex, json: r.report[0] };
  } finally { await chrome.kill(); }
}
for (const ff of ['mobile', 'desktop']) {
  const res = { A: [], B: [] };
  for (let i = 0; i < runs; i++) {
    for (const k of (i % 2 ? ['B', 'A'] : ['A', 'B'])) {
      const r = await lh(k === 'A' ? A : B, ff);
      fs.writeFileSync(path.join(outDir, `lh-${k}-${ff}-${i}.json`), r.json); delete r.json;
      res[k].push(r);
    }
  }
  for (const k of ['A', 'B']) {
    const rs = res[k]; const keys = Object.keys(rs[0].cat);
    out.lighthouse[k][ff] = { runs: rs, median: { ...Object.fromEntries(keys.map((c) => [c, median(rs.map((x) => x.cat[c]))])), ...Object.fromEntries(['lcp', 'cls', 'tbt', 'fcp', 'si', 'bytes'].map((c) => [c, Math.round(median(rs.map((x) => x[c])) * 1000) / 1000])) } };
    console.log(k, ff, JSON.stringify(out.lighthouse[k][ff].median), 'perf/run', rs.map((x) => x.cat.performance).join(','), 'bench', rs.map((x) => Math.round(x.bench)).join(','));
  }
}
const axeSrc = fs.readFileSync('/workspace/audit/node_modules/axe-core/axe.min.js', 'utf8');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const k of ['A', 'B']) for (const [name, opts] of [['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }], ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
  const ctx = await browser.newContext(opts); const page = await ctx.newPage();
  const errors = []; const bad = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => bad.push({ url: r.url(), status: 'failed', err: r.failure()?.errorText }));
  page.on('response', (r) => { if (r.status() >= 400) bad.push({ url: r.url(), status: r.status() }); });
  await page.goto(k === 'A' ? A : B, { waitUntil: 'load', timeout: 180000 }); await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3500);
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(3000);
  await page.addScriptTag({ content: axeSrc });
  const ax = await page.evaluate(async () => await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
  const v = ax.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.length, targets: x.nodes.slice(0, 6).map((n) => n.target.join(' ')) }));
  const byImpact = {}; for (const x of v) byImpact[x.impact] = (byImpact[x.impact] || 0) + 1;
  out.axe[k][name] = { violations: v.length, byImpact, list: v }; out.console[k][name] = errors; out.badRequests[k][name] = bad;
  console.log('axe', k, name, v.length, JSON.stringify(byImpact), v.map((x) => `${x.id}:${x.impact}:${x.nodes}`).join(' '), '| console errors', errors.length, JSON.stringify(errors).slice(0, 300), '| bad requests', bad.length, JSON.stringify(bad).slice(0, 300));
  await ctx.close();
}
await browser.close();
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(out, null, 2));
