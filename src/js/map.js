/** Umgebungskarte: Routen-Umschalter (aria-pressed) hebt die SVG-Route hervor und zeigt Beispielwerte. */
import { $, $$, reducedMotion } from './utils.js';
import { gsap } from 'gsap';

const ROUTES = {
  see: { km: '4,2 km', hm: '60 hm', t: 'ca. 1 Std.', text: 'Einmal um den See, flach und auch im Morgennebel gut zu gehen.' },
  alm: { km: '9,0 km', hm: '480 hm', t: 'ca. 3 Std.', text: 'Über den Waldweg hinauf zur oberen Alm, Einkehr möglich (Öffnungszeiten: Platzhalter).' },
  gipfel: { km: '14,5 km', hm: '1.150 hm', t: 'ca. 6–7 Std.', text: 'Lange Tagestour mit felsigem Schlussstück. Trittsicherheit nötig, nur bei stabilem Wetter.' },
};

export function setupMap() {
  const btns = $$('[data-route-btn]');
  const paths = $$('.route');
  function select(key) {
    btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.routeBtn === key)));
    paths.forEach((p) => p.classList.toggle('is-active', p.dataset.route === key));
    const r = ROUTES[key];
    for (const k of ['km', 'hm', 't', 'text']) $(`[data-r="${k}"]`).textContent = r[k];
    const p = paths.find((x) => x.dataset.route === key);
    if (p && !reducedMotion) {
      const len = p.getTotalLength();
      gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', onComplete: () => gsap.set(p, { clearProps: 'strokeDasharray,strokeDashoffset' }) });
    }
  }
  btns.forEach((b) => b.addEventListener('click', () => select(b.dataset.routeBtn)));
  select('see');
}
