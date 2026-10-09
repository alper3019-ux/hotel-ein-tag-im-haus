/**
 * Zimmer-Details als Dialog. Wo verfügbar, morpht das Kartenbild per
 * View Transition API (document.startViewTransition) in den Dialog.
 * Ohne API oder bei „Bewegung reduzieren“: Dialog öffnet ohne Übergang.
 */
import { $, $$, reducedMotion } from './utils.js';

const ROOMS = {
  stube: { title: 'Zirbenstube', text: 'Holz, Leinen, ein Fenster zum See. Die kleinste Kategorie und die ruhigste: Die Stuben liegen zur Seeseite.', list: ['[28] m² · Doppelbett 180 × 200', 'Seeblick, Balkon', 'Dusche, Regenbrause'], price: 'ab [Preis] € pro Nacht inkl. Frühstück · Platzhalter' },
  suite: { title: 'Dachsuite', text: 'Unterm First mit offenem Dachstuhl. Über dem Bett liegt ein Dachfenster, durch das man nachts die Sterne sieht.', list: ['[46] m² · Himmelbett + Schlafsofa', 'Dachfenster, Kaminofen', 'Bad mit Wanne und Dusche'], price: 'ab [Preis] € pro Nacht inkl. Frühstück · Platzhalter' },
  bad: { title: 'Bad-Suite', text: 'Die Wanne steht mitten im Raum, die Fenster reichen bis zum Boden. Gedacht für lange Abende nach der Tour.', list: ['[52] m² · Doppelbett 200 × 200', 'Freistehende Wanne, Doppelwaschtisch', 'Ruhige Lage im Obergeschoss'], price: 'ab [Preis] € pro Nacht inkl. Frühstück · Platzhalter' },
};

const ph = (s) => s.replace(/\[([^\]]+)\]/g, '<span class="ph">[$1]</span>');

export function setupRooms() {
  const dialog = $('#room-dialog');
  const media = $('[data-room-media]', dialog);
  let lastImg = null, lastBtn = null;

  function fill(key, btn) {
    const r = ROOMS[key];
    $('[data-room-title]', dialog).textContent = r.title;
    $('[data-room-text]', dialog).textContent = r.text;
    $('[data-room-list]', dialog).innerHTML = r.list.map((li) => `<li>${ph(li)}</li>`).join('');
    $('[data-room-price]', dialog).innerHTML = ph(r.price);
    const pic = btn.querySelector('picture').cloneNode(true);
    const img = pic.querySelector('img');
    img.removeAttribute('loading');
    pic.querySelectorAll('source').forEach((s) => s.setAttribute('sizes', '(max-width: 900px) 100vw, 520px'));
    media.replaceChildren(pic);
    return img;
  }

  function open(key, btn) {
    lastBtn = btn;
    const cardImg = btn.querySelector('img');
    const go = () => { const img = fill(key, btn); dialog.showModal(); return img; };
    if (!document.startViewTransition || reducedMotion) { go(); return; }
    cardImg.style.viewTransitionName = 'room-img';
    const vt = document.startViewTransition(() => { cardImg.style.viewTransitionName = ''; lastImg = go(); lastImg.style.viewTransitionName = 'room-img'; });
    vt.finished.finally(() => { if (lastImg) lastImg.style.viewTransitionName = ''; });
  }
  function close() {
    if (!dialog.open) return;
    const cardImg = lastBtn?.querySelector('img');
    const dlgImg = media.querySelector('img');
    if (!document.startViewTransition || reducedMotion || !cardImg || !dlgImg) { dialog.close(); return; }
    dlgImg.style.viewTransitionName = 'room-img';
    const vt = document.startViewTransition(() => { dlgImg.style.viewTransitionName = ''; dialog.close(); cardImg.style.viewTransitionName = 'room-img'; });
    vt.finished.finally(() => { cardImg.style.viewTransitionName = ''; });
  }

  $$('[data-room-open]').forEach((btn) => btn.addEventListener('click', () => open(btn.dataset.roomOpen, btn)));
  dialog.querySelector('[data-close]').addEventListener('click', close);
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) close(); });
  dialog.addEventListener('close', () => lastBtn?.focus());
  dialog.querySelector('[data-open-booking]').addEventListener('click', () => dialog.close(), { capture: true });

  // Links aus „Ein Tag im Haus“ öffnen das passende Zimmer
  $$('[data-room-link]').forEach((a) => a.addEventListener('click', () => {
    const btn = $(`[data-room-open="${a.dataset.roomLink}"]`);
    if (btn) setTimeout(() => btn.focus({ preventScroll: true }), 1500);
  }));
}
