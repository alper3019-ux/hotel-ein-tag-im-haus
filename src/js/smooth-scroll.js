/**
 * Lenis (Smooth Scrolling) im GSAP-Ticker, damit ScrollTrigger und Lenis im selben Frame rechnen.
 * Bei „Bewegung reduzieren“ wird Lenis nicht gestartet (nativer Scroll).
 */
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function createSmoothScroll({ reduced }) {
  let lenis = null;
  if (!reduced) {
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  function scrollTo(target, opts = {}) {
    if (lenis) { lenis.scrollTo(target, { duration: 1.4, offset: typeof target === 'number' ? 0 : -76, ...opts }); return; }
    if (typeof target === 'number') window.scrollTo({ top: target });
    else (typeof target === 'string' ? document.querySelector(target) : target)?.scrollIntoView();
  }
  return { lenis, scrollTo };
}
