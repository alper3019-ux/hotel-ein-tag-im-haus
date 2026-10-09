/**
 * „Ein Tag im Haus“: gepinnte Bühne, Scroll-Fortschritt 0…1 = 06:00…23:00 Uhr.
 * - ScrollTrigger pinnt .day__stage (pin + scrub), Strecke ≈ 0,9 Bildschirmhöhen je Station.
 * - Uhr, Fortschrittsleiste, aktive Station und ein CSS-Himmelsverlauf folgen dem Fortschritt.
 *   Der CSS-Verlauf ist zugleich Fallback, solange three.js lädt oder ohne WebGL.
 * - three.js-Szene (src/webgl/valley.js) wird erst geladen, wenn der Abschnitt näher kommt.
 * - Reduzierte Bewegung: kein Pin, kein 3D, alle Stationen als Karten (Klasse .is-static).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { $, $$, reducedMotion, isMobile, hasWebGL, pad2 } from './utils.js';

const SKY = [ // Stunde: oben, Mitte, unten
  [6, '#f0a774', '#f6d0a0', '#b9b8a0'],
  [8, '#9cc3e4', '#d7e6ef', '#b8c7b5'],
  [12, '#5f9fd8', '#a9cdea', '#c9d8de'],
  [17, '#d99a5f', '#f2c891', '#c7a77c'],
  [20, '#3c3f6e', '#8e5d78', '#d4825a'],
  [23, '#050a1a', '#0d1630', '#1b2744'],
];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
function skyAt(h) {
  let i = 0; while (i < SKY.length - 2 && h > SKY[i + 1][0]) i++;
  const t = Math.min(1, Math.max(0, (h - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0])));
  return [1, 2, 3].map((k) => mix(hex(SKY[i][k]), hex(SKY[i + 1][k]), t));
}

export function setupDayStory({ scrollTo }) {
  const section = $('#tag');
  const stage = $('[data-day-stage]', section);
  const stations = $$('.station', section);
  const ticks = $$('[data-tick]', section);
  const clock = $('[data-clock]', section);
  const fill = $('[data-fill]', section);
  const times = stations.map((s) => Number(s.dataset.time));
  const n = stations.length;

  if (reducedMotion) {
    section.classList.add('is-static');
    return { static: true };
  }

  let scene = null, active = -1;
  const hourAt = (p) => { const x = Math.min(n - 1, Math.max(0, p * (n - 1))); const i = Math.min(n - 2, Math.floor(x)); return times[i] + (times[i + 1] - times[i]) * (x - i); };

  function update(p) {
    const h = hourAt(p);
    const mins = Math.round((h * 60) / 5) * 5;
    clock.textContent = `${pad2(Math.floor(mins / 60) % 24)}:${pad2(mins % 60)}`;
    fill.style.transform = `scaleX(${p})`;
    const idx = Math.round(p * (n - 1));
    if (idx !== active) {
      active = idx;
      stations.forEach((s, i) => s.classList.toggle('is-active', i === idx));
      ticks.forEach((t, i) => { t.classList.toggle('is-active', i === idx); if (i === idx) t.setAttribute('aria-current', 'step'); else t.removeAttribute('aria-current'); });
    }
    const [a, b, c] = skyAt(h);
    stage.style.setProperty('--sky-top', a); stage.style.setProperty('--sky-mid', b); stage.style.setProperty('--sky-low', c);
    scene?.setHour(h);
    section.dataset.hour = h.toFixed(2);
  }

  const st = ScrollTrigger.create({
    trigger: stage,
    pin: true,
    start: 'top top',
    end: () => `+=${Math.round(window.innerHeight * 0.9 * (n - 1))}`,
    scrub: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onUpdate: (self) => update(self.progress),
  });
  update(0);

  // Sprungmarken (Zeitleiste + Hero-Chips) scrollen an die passende Stelle der Strecke
  const jump = (i) => scrollTo(st.start + ((st.end - st.start) * i) / (n - 1) + 2);
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#station-"]');
    if (!a) return;
    e.preventDefault();
    jump(Number(a.getAttribute('href').split('-')[1]));
  });

  // three.js nachladen, sobald der Abschnitt näher kommt.
  // Die WebGL-Prüfung (erzeugt einen eigenen GL-Kontext, auf schwachen Geräten teuer) läuft
  // erst in start(), also nicht während des ersten Seitenaufbaus (wie Konzept 1/3).
  {
    // erst laden, wenn der Abschnitt naht UND jemand tatsächlich scrollt/interagiert
    // (oder per Deeplink direkt dort landet) – hält den Erstaufruf leicht
    let near = false, engaged = false, started = false;
    const start = async () => {
      if (started || !near || !engaged) return;
      started = true;
      io.disconnect();
      if (!hasWebGL()) return; // ohne WebGL bleibt der CSS-Himmel
      try {
        const { createValley } = await import('../webgl/valley.js');
        scene = createValley($('.day__canvas', section), { mobile: isMobile(), onFirstFrame: () => section.classList.add('is-ready') });
        scene.setHour(hourAt(st.progress), true);
        new IntersectionObserver(([e2]) => scene.setVisible(e2.isIntersecting)).observe(stage);
      } catch (err) {
        console.warn('3D-Szene nicht verfügbar, CSS-Himmel bleibt aktiv.', err);
      }
    };
    const io = new IntersectionObserver(([en]) => {
      near = en.isIntersecting;
      if (near && en.intersectionRatio > 0 && en.boundingClientRect.top < innerHeight * 0.5) engaged = true;
      start();
    }, { rootMargin: '0px 0px 100% 0px', threshold: [0, 0.01] });
    io.observe(section);
    const engage = () => {
      engaged = true;
      ['scroll', 'wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => removeEventListener(t, engage));
      start();
    };
    ['scroll', 'wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((t) => addEventListener(t, engage, { passive: true }));
  }
  window.__dayST = st; // für Screenshot-/Testskripte
  return { st };
}
