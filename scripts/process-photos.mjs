/**
 * Erzeugt aus den Original-Fotos (Wikimedia Commons, siehe photos/sources.json)
 * responsive AVIF- und WebP-Dateien in public/photos/ sowie public/photos/manifest.json.
 *   PHOTO_SRC=/pfad/zu/originalen node scripts/process-photos.mjs
 * Die Originale liegen nicht im Repository (Download-URL + SHA-1 in photos/sources.json).
 * Bearbeitung: nur Zuschnitt, Skalierung und Formatwandlung (keine Retusche).
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = process.env.PHOTO_SRC || '/workspace/photo-orig/k2';
const OUT = resolve('public/photos');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const sources = JSON.parse(readFileSync('photos/sources.json', 'utf8'));

// aspect = Breite/Höhe (null = Original); fx/fy = Bildschwerpunkt für den Zuschnitt
const JOBS = [
  ['hero', 'hero', 16 / 9, 0.5, 0.55, [960, 1440, 1920, 2560]],
  ['hero', 'hero-portrait', 3 / 4, 0.62, 0.6, [480, 720, 840, 1080]],
  ['morgen', 'morgen', 4 / 5, 0.5, 0.5, [480, 720, 1080]],
  ['fruehstueck', 'fruehstueck', 4 / 5, 0.5, 0.62, [480, 720, 1080]],
  ['berg', 'berg', 4 / 5, 0.62, 0.5, [480, 720, 1080]],
  ['spa', 'spa', 4 / 5, 0.45, 0.5, [480, 720, 1080]],
  ['tisch', 'tisch', 4 / 5, 0.5, 0.55, [480, 720, 1080]],
  ['stille', 'stille', 4 / 5, 0.72, 0.45, [480, 720, 1080]],
  ['zimmer-stube', 'zimmer-stube', 4 / 3, 0.5, 0.6, [640, 960, 1440]],
  ['zimmer-suite', 'zimmer-suite', 4 / 3, 0.5, 0.6, [640, 960, 1440]],
  ['zimmer-bad', 'zimmer-bad', 4 / 3, 0.5, 0.6, [640, 960, 1440]],
  ['kulinarik', 'kulinarik', 4 / 5, 0.58, 0.68, [480, 720, 1080]],
  ['spa', 'spa-wide', 16 / 10, 0.5, 0.55, [960, 1440, 1920]],
  ['berg', 'berg-wide', 21 / 9, 0.5, 0.5, [960, 1600, 2400]],
  ['gipfel', 'gipfel', 4 / 3, 0.5, 0.5, [640, 960, 1440]],
];

function cropBox(w, h, aspect, fx = 0.5, fy = 0.5) {
  if (!aspect) return { left: 0, top: 0, width: w, height: h };
  let cw = w, ch = Math.round(w / aspect);
  if (ch > h) { ch = h; cw = Math.round(h * aspect); }
  return { left: Math.round(Math.min(Math.max(fx * w - cw / 2, 0), w - cw)), top: Math.round(Math.min(Math.max(fy * h - ch / 2, 0), h - ch)), width: cw, height: ch };
}

const manifest = {};
let total = 0;
for (const [key, name, aspect, fx, fy, widths] of JOBS) {
  const src = resolve(SRC, sources[key].file);
  const meta = await sharp(src).metadata();
  const [W, H] = (meta.orientation || 1) >= 5 ? [meta.height, meta.width] : [meta.width, meta.height];
  const box = cropBox(W, H, aspect, fx, fy);
  const cropped = await sharp(src).rotate().extract(box).toBuffer();
  const files = [];
  for (const w of widths.filter((x) => x <= box.width)) {
    const h = Math.round((w * box.height) / box.width);
    const img = sharp(cropped).resize(w, h, { kernel: 'lanczos3' });
    const avif = await img.clone().avif({ quality: 50, effort: 5 }).toBuffer();
    const webp = await img.clone().webp({ quality: 72, effort: 6 }).toBuffer();
    writeFileSync(resolve(OUT, `${name}-${w}.avif`), avif);
    writeFileSync(resolve(OUT, `${name}-${w}.webp`), webp);
    total += avif.length + webp.length;
    files.push({ w, h, avif: avif.length, webp: webp.length });
  }
  manifest[name] = { source: key, width: files.at(-1).w, height: files.at(-1).h, files };
  console.log(name, files.map((f) => `${f.w}w ${(f.avif / 1024).toFixed(0)}K/${(f.webp / 1024).toFixed(0)}K`).join(' | '));
}
const hs = resolve(SRC, sources.hero.file);
const hm = await sharp(hs).metadata();
await sharp(hs).rotate().extract(cropBox(hm.width, hm.height, 1200 / 630, 0.5, 0.55)).resize(1200, 630).jpeg({ quality: 78, mozjpeg: true }).toFile('public/og.jpg');
writeFileSync(resolve(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log('gesamt', (total / 1024 / 1024).toFixed(1), 'MB');
