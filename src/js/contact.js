/**
 * Anfrageformular im Demo-Modus: echte Validierung (aria-invalid erst nach dem Absenden,
 * Fokus aufs erste Fehlerfeld), danach ehrliche Meldung, dass nichts gesendet wurde.
 */
import { $, $$ } from './utils.js';

export function setupContact() {
  const form = $('#contact-form');
  const status = $('.form__status', form);
  const ok = (el) => (el.type === 'checkbox' ? el.checked : el.checkValidity() && el.value.trim() !== '');
  const mark = (el, bad) => { el.closest('.field, .check').classList.toggle('is-invalid', bad); bad ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid'); };
  form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid') === 'true' && ok(e.target)) mark(e.target, false); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    status.className = 'form__status';
    const bad = $$('[required]', form).filter((el) => { const b = !ok(el); mark(el, b); return b; });
    if (bad.length) { status.textContent = bad.length === 1 ? 'Bitte prüfen Sie das markierte Feld.' : `Bitte prüfen Sie die ${bad.length} markierten Felder.`; status.classList.add('is-err'); bad[0].focus(); return; }
    status.textContent = 'Demo-Modus: Ihre Angaben sind vollständig, wurden aber nicht gesendet und nicht gespeichert. Das Hotel ist fiktiv.';
    status.classList.add('is-demo');
  });
}
