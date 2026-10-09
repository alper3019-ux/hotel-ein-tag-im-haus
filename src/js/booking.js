/**
 * Buchungsleiste (ehrliche Attrappe):
 * - prüft die Eingaben wirklich (Anreise nicht in der Vergangenheit, Abreise nach Anreise, max. 30 Nächte)
 * - meldet dann offen, dass in der Demo keine Buchungsengine angebunden ist (keine vorgetäuschte Verfügbarkeit)
 * - nach dem Hero erscheint ein Dock; „Verfügbarkeit prüfen“ öffnet einen Dialog, in den dasselbe
 *   Formular verschoben wird (es gibt nur ein Formular, keine doppelten IDs)
 */
import { $, $$ } from './utils.js';

const fmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
const fmtY = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (v) => { if (!v) return null; const [y, m, d] = v.split('-').map(Number); return new Date(y, m - 1, d); };

export function setupBooking({ scrollTo }) {
  const form = $('#booking');
  const slot = $('.booking-slot');
  const dialog = $('#booking-dialog');
  const dialogSlot = $('[data-booking-dialog-slot]');
  const dock = $('[data-dock]');
  const summary = $('[data-dock-summary]');
  const status = $('#booking-status');
  const arrive = $('#arrive'), depart = $('#depart'), adults = $('#adults'), kids = $('#kids');

  const today = new Date(); today.setHours(0, 0, 0, 0);
  arrive.min = iso(today);
  depart.min = iso(new Date(today.getTime() + 864e5));

  const setInvalid = (el, bad) => (bad ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid'));

  function updateSummary() {
    const a = parse(arrive.value), d = parse(depart.value);
    const guests = `${adults.value} Erw.${kids.value !== '0' ? ` + ${kids.value} Ki.` : ''}`;
    summary.textContent = a && d && d > a ? `${fmt.format(a)} – ${fmt.format(d)} · ${guests}` : `Zeitraum wählen · ${guests}`;
  }
  arrive.addEventListener('change', () => {
    const a = parse(arrive.value);
    if (a) { depart.min = iso(new Date(a.getTime() + 864e5)); if (!depart.value || parse(depart.value) <= a) depart.value = iso(new Date(a.getTime() + 2 * 864e5)); }
    updateSummary();
  });
  [depart, adults, kids].forEach((el) => el.addEventListener('change', updateSummary));
  updateSummary();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    status.className = 'booking__status';
    const a = parse(arrive.value), d = parse(depart.value);
    let msg = '';
    setInvalid(arrive, false); setInvalid(depart, false);
    if (!a) { msg = 'Bitte wählen Sie ein Anreisedatum.'; setInvalid(arrive, true); }
    else if (a < today) { msg = 'Die Anreise liegt in der Vergangenheit.'; setInvalid(arrive, true); }
    else if (!d) { msg = 'Bitte wählen Sie ein Abreisedatum.'; setInvalid(depart, true); }
    else if (d <= a) { msg = 'Die Abreise muss nach der Anreise liegen.'; setInvalid(depart, true); }
    else if ((d - a) / 864e5 > 30) { msg = 'Online sind höchstens 30 Nächte möglich. Für längere Aufenthalte schreiben Sie uns bitte.'; setInvalid(depart, true); }
    if (msg) { status.textContent = msg; status.classList.add('is-err'); form.querySelector('[aria-invalid="true"]')?.focus(); return; }
    const nights = Math.round((d - a) / 864e5);
    const guests = `${adults.value} Erwachsene${kids.value !== '0' ? `, ${kids.value} ${kids.value === '1' ? 'Kind' : 'Kinder'}` : ''}`;
    status.textContent = `Demo: ${nights} ${nights === 1 ? 'Nacht' : 'Nächte'} (${fmtY.format(a)} bis ${fmtY.format(d)}), ${guests}. An dieser Stelle würde die Buchungsengine des Hotels die echte Verfügbarkeit abfragen. In dieser Demo wurde nichts geprüft, reserviert oder gespeichert.`;
    status.classList.add('is-demo');
  });

  /* Dock: sichtbar, sobald die Buchungsleiste im Hero aus dem Bild ist (und solange der Dialog zu ist) */
  let slotVisible = true;
  const setDock = () => {
    const show = !slotVisible && !dialog.open;
    dock.hidden = false;
    dock.classList.toggle('is-hidden', !show);
    dock.inert = !show;
    document.documentElement.style.setProperty('--dock-h', show ? '84px' : '0px');
  };
  new IntersectionObserver(([en]) => { slotVisible = en.isIntersecting || en.boundingClientRect.top > 0; setDock(); }, { threshold: 0 }).observe(slot);

  function openDialog(trigger) {
    if (slotVisible && slot.contains(form) && slot.getBoundingClientRect().top < window.innerHeight * 0.8) { arrive.focus(); return; }
    $$('dialog[open]').forEach((d) => d !== dialog && d.close());
    dialogSlot.append(form);
    dialog.showModal();
    dialog._trigger = trigger;
    setDock();
    arrive.focus();
  }
  dialog.addEventListener('close', () => { slot.append(form); setDock(); dialog._trigger?.focus?.(); });
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-booking]');
    if (!t) return;
    e.preventDefault();
    openDialog(t);
  });
  return { openDialog, scrollTo };
}
