/*
 * Never lose an entry (Lisa 17 Nov 2026; OV12 20 Nov 2026): the line above a screen that shows what this phone is
 * still holding to send, and anything the records refused.
 *   BLDOutboxLine.mount(save, beforeEl)   save = BLDSave.create(...); the line goes just before beforeEl
 * Fewest words (staff screens). The phone also sends by itself every minute; "Send now" tries at once.
 * An entry held over 5 hours is not sent by itself: the person checks the records, then sends or removes it.
 */
(function (root) {
  'use strict';
  var CSS = '.outbox{margin:8px 16px;padding:10px 12px;border-radius:12px;border:2px solid var(--ljr-3);background:var(--card);display:grid;gap:8px}'
    + '.outbox[hidden]{display:none}.outbox p{margin:0}.outbox .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.outbox button{min-height:44px}';

  function el(doc, tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(doc, text, quiet, fn) { var b = el(doc, 'button', quiet ? 'btn quiet' : 'btn', text); b.type = 'button'; b.onclick = fn; return b; }
  function what(f, table) {
    var w = (f && (f.area_id || f.check_type_id || f.subject_id)) || table || 'entry';
    return String(w).replace(/^(area|cty|sub)-/, '');
  }
  function hhmm(at) { return String(at || '').slice(11, 16); }

  function mount(save, beforeEl) {
    if (!save || !save.outbox || !beforeEl || !beforeEl.parentNode) return null;
    var doc = beforeEl.ownerDocument;
    if (!doc.getElementById('outbox-css')) { var st = el(doc, 'style'); st.id = 'outbox-css'; st.textContent = CSS; doc.head.appendChild(st); }
    var box = el(doc, 'div', 'outbox'); box.id = 'outbox'; box.hidden = true; box.setAttribute('role', 'status');
    beforeEl.parentNode.insertBefore(box, beforeEl);
    var busy = false;
    function draw() {
      var items = save.outbox.items(), rf = save.outbox.refused();
      var fresh = items.filter(function (x) { return !x.old; }), old = items.filter(function (x) { return x.old; });
      box.textContent = ''; box.hidden = !items.length && !rf.length;
      if (fresh.length) {
        var signIn = !!(save.outbox.needsSignIn && save.outbox.needsSignIn());   // 22 Nov 2026: the sign-in has ended
        var p1 = el(doc, 'p', '', fresh.length + (signIn ? ' waiting: sign in again to send. ' : ' waiting to send. ') + 'Kept on this phone: do not type again.');
        p1.setAttribute('data-outbox-waiting', String(fresh.length));
        if (signIn) p1.setAttribute('data-outbox-sign-in', '');
        var go = btn(doc, busy ? 'Sending...' : 'Send now', false, function () {
          busy = true; draw();
          save.outbox.flush().then(function () { busy = false; draw(); }, function () { busy = false; draw(); });
        });
        go.disabled = busy; go.setAttribute('data-outbox-send', '');
        var r1 = el(doc, 'div', 'row'); r1.appendChild(p1); r1.appendChild(go); box.appendChild(r1);
      }
      old.forEach(function (x) {
        var p = el(doc, 'p', '', 'Not confirmed: ' + what(x.fields, x.table) + ' (' + hhmm(x.at) + '). Check the records first.');
        p.setAttribute('data-outbox-old', x.id);
        var send = btn(doc, 'Send', false, function () { save.outbox.flush({ old: true }).then(draw, draw); });
        var rm = btn(doc, 'Remove', true, function () { save.outbox.remove(x.id); });
        var r = el(doc, 'div', 'row'); r.appendChild(p); r.appendChild(send); r.appendChild(rm); box.appendChild(r);
      });
      rf.forEach(function (x) {
        var p2 = el(doc, 'p', '', 'Not saved: ' + what(x.fields, x.table) + ' (' + hhmm(x.at) + '). ' + (x.message || x.code || '') + ' Enter it again.');
        p2.setAttribute('data-outbox-refused', x.id);
        var ok = btn(doc, 'OK', true, function () { save.outbox.dismissRefused(x.id); });
        var r2 = el(doc, 'div', 'row'); r2.appendChild(p2); r2.appendChild(ok); box.appendChild(r2);
      });
    }
    save.outbox.onChange(draw); draw();
    return { draw: draw, el: box };
  }

  var api = { mount: mount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BLDOutboxLine = api;
}(typeof window !== 'undefined' ? window : this));
