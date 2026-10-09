/**
 * Vite-Konfiguration (Ziel: GitHub Pages, Werte aus .env).
 *   VITE_BASE      Unterpfad, z. B. "/hotel-ein-tag-im-haus/"
 *   VITE_SITE_URL  absolute URL mit Schrägstrich am Ende (canonical, og:url, Sitemap)
 *
 * Zwei kleine HTML-Plugins:
 *  - <x-pic name="…" sizes="…" alt="…" [eager] [class="…"]></x-pic> wird anhand von
 *    public/photos/manifest.json zu <picture> mit AVIF/WebP-srcset, width/height (kein CLS).
 *  - <!--bildrechte--> wird durch die Tabelle aus photos/sources.json ersetzt.
 */
import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const root = import.meta.dirname;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function htmlPhotos(base) {
  const manifest = JSON.parse(readFileSync(resolve(root, 'public/photos/manifest.json'), 'utf8'));
  const sources = JSON.parse(readFileSync(resolve(root, 'photos/sources.json'), 'utf8'));
  const attr = (s, n) => (s.match(new RegExp(`\\b${n}="([^"]*)"`)) || [])[1];
  return {
    name: 'html-photos',
    transformIndexHtml(html) {
      html = html.replace(/<x-pic\b([^>]*)><\/x-pic>/g, (_, a) => {
        const name = attr(a, 'name');
        const m = manifest[name];
        if (!m) throw new Error(`Foto "${name}" fehlt im Manifest`);
        const eager = /\beager\b/.test(a);
        const set = (fmt) => m.files.map((f) => `${base}photos/${name}-${f.w}.${fmt} ${f.w}w`).join(', ');
        const mid = m.files[Math.min(1, m.files.length - 1)];
        const cls = attr(a, 'class');
        return `<picture${cls ? ` class="${cls}"` : ''}><source type="image/avif" srcset="${set('avif')}" sizes="${attr(a, 'sizes')}"><source type="image/webp" srcset="${set('webp')}" sizes="${attr(a, 'sizes')}"><img src="${base}photos/${name}-${mid.w}.webp" width="${m.width}" height="${m.height}" alt="${attr(a, 'alt') ?? ''}" ${eager ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"'}></picture>`;
      });
      html = html.replace('<!--bildrechte-->', () => {
        const used = {};
        for (const [n, m] of Object.entries(manifest)) (used[m.source] ||= []).push(n);
        const rows = Object.entries(sources).map(([k, s]) => `<tr><td>${esc((used[k] || [k]).join(', '))}</td><td><a href="${esc(s.page)}">${esc(s.title)}</a></td><td>${esc(s.author)}</td><td>${s.licenseUrl ? `<a href="${esc(s.licenseUrl)}">${esc(s.license)}</a>` : esc(s.license)}</td></tr>`).join('\n');
        return `<div class="table-wrap" tabindex="0" role="region" aria-label="Bildnachweise"><table><thead><tr><th scope="col">Verwendung</th><th scope="col">Datei (Wikimedia Commons)</th><th scope="col">Urheber:in</th><th scope="col">Lizenz</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      });
      return html;
    },
  };
}

function seoFiles(siteUrl) {
  return {
    name: 'seo-files',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n` });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n  <url><loc>${siteUrl}bildrechte.html</loc></url>\n</urlset>\n` });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'VITE_');
  const base = env.VITE_BASE || '/';
  return {
    base,
    plugins: [htmlPhotos(base), seoFiles(env.VITE_SITE_URL)],
    build: {
      outDir: 'dist',
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        input: {
          main: resolve(root, 'index.html'),
          impressum: resolve(root, 'impressum.html'),
          datenschutz: resolve(root, 'datenschutz.html'),
          bildrechte: resolve(root, 'bildrechte.html'),
          notfound: resolve(root, '404.html'),
        },
      },
    },
  };
});
