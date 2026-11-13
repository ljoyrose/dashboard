/*!
 * BLDDone - one look, on every staff screen, for "the save script has this". Lisa: show a tick once received.
 *   BLDDone.mark(el, {outcome, at, who, extra})  a tick line on the card: "Done 14:32 · Sam" (or "Concern noted", "Not done noted"),
 *                                                 and the card's main button greys (it still works, for a second time that day)
 *   BLDDone.saving(el)                            straight after the tap: "Saving..." and the button is off until the reply
 *   BLDDone.wait(el, text)                        sent but not received yet (no signal): a clock, never a tick
 *   BLDDone.fail(el, text)                        a red line; the button stays as it was
 *   BLDDone.clear(el)
 * el is the card. Its main button carries data-done-btn. A tick only ever follows a reply that says saved.
 * Nothing here names a job, a dog or a person: `who` is whatever the saved row or the reply says.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDDone = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var WORD = { ok: 'Done', recorded: 'Done', concern: 'Concern noted', not_done: 'Not done noted' };
  var TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M4 12l5 5L20 6"/></svg>';
  var CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

  /** 14:32, London time, from an ISO time or a Date. */
  function hhmm(at) {
    var d = at ? new Date(at) : new Date();
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' }).format(d);
  }
  /** "Done 14:32 · Sam" */
  function text(s) {
    s = s || {};
    return [(WORD[s.outcome] || 'Done') + ' ' + hhmm(s.at), s.who, s.extra].filter(function (x) { return x && String(x).trim(); }).join(' · ');
  }
  function line(el) {
    var n = el.querySelector(':scope > .done-line');
    if (!n) { n = el.ownerDocument.createElement('p'); n.className = 'done-line'; n.setAttribute('role', 'status'); el.appendChild(n); }
    return n;
  }
  function btn(el, grey, busy) {
    var b = el.querySelector('[data-done-btn]');
    if (!b) return;
    b.classList.toggle('is-done', !!grey); b.disabled = !!busy;
    if (busy) b.setAttribute('aria-busy', 'true'); else b.removeAttribute('aria-busy');
  }
  function set(el, cls, icon, words) {
    var n = line(el);
    n.className = 'done-line ' + cls;
    n.innerHTML = icon ? '<span class="done-ic">' + icon + '</span>' : '';
    var t = el.ownerDocument.createElement('span'); t.textContent = words; n.appendChild(t);
    return n;
  }

  function mark(el, s) {
    if (!el) return;
    el.classList.add('is-done'); el.classList.toggle('is-concern', !!s && (s.outcome === 'concern' || s.outcome === 'not_done'));
    set(el, s && (s.outcome === 'concern' || s.outcome === 'not_done') ? 'flag' : 'good', TICK, text(s));
    btn(el, true);
  }
  function saving(el, words) { if (!el) return; el.classList.remove('is-done', 'is-concern'); set(el, 'wait', CLOCK, words || 'Saving...'); btn(el, false, true); }
  function wait(el, words) { if (!el) return; el.classList.remove('is-done', 'is-concern'); set(el, 'wait', CLOCK, words || 'Waiting for signal'); btn(el, false); }
  function fail(el, words) { if (!el) return; el.classList.remove('is-done', 'is-concern'); set(el, 'bad', '', words || 'Not saved. Try again.'); btn(el, false); }
  function clear(el) { if (!el) return; el.classList.remove('is-done', 'is-concern'); var n = el.querySelector(':scope > .done-line'); if (n) n.remove(); btn(el, false); }

  return { mark: mark, saving: saving, wait: wait, fail: fail, clear: clear, text: text, hhmm: hhmm, TICK: TICK };
}));
