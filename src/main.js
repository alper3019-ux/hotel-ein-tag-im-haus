/**
 * Hotel Wolkenstille (fiktiv) – Einstiegspunkt.
 * Kein Custom-Cursor, keine Magnet-Buttons; nativer Mauszeiger.
 */
import './styles/main.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { $, $$, reducedMotion } from './js/utils.js';
import { createSmoothScroll } from './js/smooth-scroll.js';
import { setupBooking } from './js/booking.js';
import { setupDayStory } from './js/day-story.js';
import { setupRooms } from './js/rooms.js';
import { setupMap } from './js/map.js';
import { setupContact } from './js/contact.js';

gsap.registerPlugin(ScrollTrigger, SplitText);
document.documentElement.classList.add('js');
if (!reducedMotion) document.documentElement.classList.add('js-motion');

const { scrollTo } = createSmoothScroll({ reduced: reducedMotion });

/* Navigation */
const nav = $('[data-nav]');
const toggle = $('.nav__toggle');
const menu = $('#mobile-menu');
const setSolid = () => nav.classList.toggle('is-solid', window.scrollY > 40 || !menu.hidden);
window.addEventListener('scroll', setSolid, { passive: true });
setSolid();
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  menu.hidden = !open;
  toggle.textContent = open ? 'Schließen' : 'Menü';
  setSolid();
});
$$('a[href^="#"]:not([href^="#station-"])').forEach((a) => a.addEventListener('click', (e) => {
  if (a.hasAttribute('data-open-booking')) return;
  const id = a.getAttribute('href');
  const el = id.length > 1 && document.querySelector(id);
  if (!el) return;
  e.preventDefault();
  if (!menu.hidden) toggle.click();
  scrollTo(id === '#top' ? 0 : el);
  history.replaceState(null, '', id);
}));

setupBooking({ scrollTo });
setupDayStory({ scrollTo });
setupRooms();
setupMap();
setupContact();

/* Bewegung: Hero-Titel zeilenweise, Abschnitts-Reveals, leichte Parallaxe */
if (!reducedMotion) {
  const title = $('[data-split]');
  // Zeilen-Intro nur auf großen Screens: auf Mobilgeräten ist die H1 das LCP-Element
  // und soll sofort stehen (Messung: Render-Delay ~2 s mit Intro)
  if (matchMedia('(min-width: 901px)').matches) document.fonts.ready.then(() => {
    const split = SplitText.create(title, { type: 'lines', mask: 'lines', autoSplit: true, onSplit: (self) => gsap.from(self.lines, { yPercent: 105, duration: 1.1, ease: 'expo.out', stagger: 0.12, delay: 0.1 }) });
    return split;
  });
  gsap.from('.hero__lead, .hero__times, .hero .eyebrow', { opacity: 0, y: 18, duration: 1, ease: 'power3.out', stagger: 0.08, delay: 0.45 });
  ScrollTrigger.batch('[data-reveal]', { start: 'top 88%', once: true, onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 }) });
  $$('[data-parallax] img').forEach((img) => gsap.fromTo(img, { yPercent: -6, scale: 1.12 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: img.closest('[data-parallax]'), scrub: true } }));
  gsap.fromTo('.spa__media img', { yPercent: -8, scale: 1.15 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.spa', scrub: true } });
  window.addEventListener('load', () => ScrollTrigger.refresh());
}
