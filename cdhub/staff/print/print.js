/*!
 * Print room signs, dog kennel cards (not collars) and litter cards, and show the phone set-up QR.
 * Owner page: needs an OWNER code on this device. Each QR holds only a random id, kept in BLD-qr_tag.
 */
(function () {
  'use strict';
  var CODE_KEY = 'bld.device.code', ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', LEN = 8;
  var screen = document.getElementById('screen'), save = BLDSave.create({});
  var base = location.origin + location.pathname.replace(/print\/(index\.html)?$/, '');
  save.TABLES.qr_tag = { label: 'QR codes', file: 'BLD-qr_tag.csv', fields: { tag: { type: 'text', required: true, label: 'Tag' }, kind: { type: 'enum', values: ['area', 'subject', 'litter', 'site', 'thermometer'], required: true, label: 'Kind' }, ref_id: { type: 'text', required: true, label: 'Refers to' } } };
  save.TABLES.thermometer = { label: 'Thermometers', file: 'BLD-thermometer.csv', fields: { name: { type: 'text', required: true, label: 'Name' }, area_id: { type: 'ref', lookup: 'area', required: true, label: 'Room' } } };
  function h(t, a, k) { var e = document.createElement(t); Object.keys(a || {}).forEach(function (x) { if (x === 'text') e.textContent = a[x]; else if (x === 'class') e.className = a[x]; else if (x === 'html') e.innerHTML = a[x]; else if (x.slice(0, 2) === 'on') e.addEventListener(x.slice(2), a[x]); else e.setAttribute(x, a[x]); }); (k || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return e; }
  function newTag() { var a = new Uint8Array(LEN), s = ''; crypto.getRandomValues(a); for (var i = 0; i < LEN; i++) s += ALPHABET.charAt(a[i] % ALPHABET.length); return s; }
  function say(t, k) { msg.className = 'msg ' + (k || ''); msg.textContent = t; }
  var msg = h('p', { class: 'msg noprint', role: 'status' });
  screen.appendChild(h('h1', { class: 'noprint', text: 'Print QR cards' }));
  var code = ''; try { code = localStorage.getItem(CODE_KEY) || ''; } catch (e) { /* no storage */ }
  if (!save.getScriptUrlSet() || !code) { screen.appendChild(h('p', { class: 'sub', text: 'Set up this device on the staff page first, with an owner code.' })); return; }
  save.setCode(code, false);
  screen.appendChild(h('p', { class: 'sub noprint', text: 'Each code holds only a random id. Printing again reuses the same codes.' }));
  var opts = h('div', { class: 'opts noprint' }), sheet = h('div', { class: 'sheet' });
  screen.appendChild(opts); screen.appendChild(msg); screen.appendChild(sheet);
  var T = null;
  function load() {
    say('Loading...');
    return save.checkStatus().then(function () { return save.readMany(['area', 'subject', 'occupancy', 'subject_status', 'qr_tag', 'litter', 'thermometer'], ['subject_status', 'litter', 'thermometer']); }).then(function (r) {
      if (!r.ok) { say(r.message || 'Could not load the lists.', 'bad'); return false; }
      T = r.tables; say(''); return true;
    });
  }
  function current(kind, refId) { return (T.qr_tag || []).filter(function (t) { return t.kind === kind && t.ref_id === refId && String(t.active).toLowerCase() !== 'false'; })[0]; }
  function card(tag, title, big) { return h('div', { class: 'qcard' + (big ? ' big' : '') }, [h('div', { html: BLDQr.svg(base + '#s/' + tag, 'QR code for ' + title) }), h('b', { text: title }), h('small', { text: tag })]); }
  function make(kind, items) {
    sheet.textContent = '';
    var missing = items.filter(function (it) { return !current(kind, it.id); }), i = 0, failed = '';
    (function next() {
      if (i < missing.length && !failed) {
        say('Making code ' + (i + 1) + ' of ' + missing.length + '...');
        var tag = newTag(), it = missing[i];
        save.submit('qr_tag', { tag: tag, kind: kind, ref_id: it.id }).then(function (r) {
          if (r.ok) { T.qr_tag.push({ tag: tag, kind: kind, ref_id: it.id, active: 'true' }); i++; } else failed = r.message;
          next();
        });
        return;
      }
      items.forEach(function (it) { var t = current(kind, it.id); if (t) sheet.appendChild(card(t.tag, it.label, kind === 'area')); });
      say(failed ? 'Stopped: ' + failed : (sheet.children.length + ' cards ready. Use your browser’s Print.'), failed ? 'bad' : 'good');
    }());
  }
  function btn(text, fn) { return h('button', { class: 'btn', type: 'button', text: text, onclick: fn }); }
  /** Draws one person's code as a QR on this screen only: nothing is saved, printed, logged or sent. */
  function privateQr() {
    var url = '', timer = 0; try { url = localStorage.getItem('bld.scriptUrl') || ''; } catch (e) { /* none */ }
    sheet.textContent = ''; say('');
    var box = h('div', { class: 'qcard big noprint', 'data-private': '1' });
    var input = h('input', { class: 'inp', type: 'password', autocomplete: 'off', 'aria-label': 'Their staff code', placeholder: 'Paste their staff code' });
    var holder = h('div');
    function clear() { clearTimeout(timer); window.removeEventListener('beforeprint', clear); input.value = ''; holder.textContent = ''; say('QR removed.'); }
    var show = h('button', { class: 'btn', type: 'button', text: 'Show QR', onclick: function () {
      var c = input.value.trim(), link = base + '#join=' + encodeURIComponent(c) + '&url=' + url;
      input.value = '';
      if (!c) { say('Paste their staff code first.', 'bad'); return; }
      try { holder.innerHTML = BLDQr.svg(link, 'Private set-up QR'); } catch (e) { holder.textContent = ''; say('That is too long for a QR code. Use the normal set-up QR.', 'bad'); return; }
      link = ''; c = '';
      clearTimeout(timer); timer = setTimeout(clear, 120000);
      window.addEventListener('beforeprint', clear);
      say('They scan this once. It disappears in 2 minutes.', 'good');
    } });
    box.appendChild(h('b', { text: 'Private set-up' }));
    box.appendChild(h('small', { text: 'This QR holds their code. Do not screenshot, photograph or message it.' }));
    [input, show, holder, h('button', { class: 'btn quiet', type: 'button', text: 'Remove QR', onclick: clear })].forEach(function (n) { box.appendChild(n); });
    sheet.appendChild(box);
  }
  /** One thermometer per place: the owner names it and picks its room; its card is made straight away. */
  function addThermometer() {
    if (!T.thermometer) { say('The thermometer list is not switched on yet.', 'warn'); return; }
    sheet.textContent = ''; say('');
    var name = h('input', { class: 'inp', type: 'text', maxlength: '40', 'aria-label': 'Thermometer name', placeholder: 'Name' });
    var room = h('select', { class: 'inp', 'aria-label': 'Room' }, [h('option', { value: '', text: 'Room' })].concat(T.area.filter(BLDOccupancy.inUse).map(function (a) { return h('option', { value: a.id, text: a.code || a.id }); })));
    var go = h('button', { class: 'btn', type: 'button', text: 'Save', onclick: function () {
      if (!name.value.trim() || !room.value) { say('Name and room, please.', 'bad'); return; }
      go.disabled = true; say('Saving...');
      save.submit('thermometer', { name: name.value.trim(), area_id: room.value }).then(function (r) {
        go.disabled = false;
        if (!r.ok) { say(r.message || 'Not saved.', 'bad'); return; }
        if (r.status !== 'saved' || !r.id) { say(r.message, 'good'); return; }
        var id = r.id;
        T.thermometer.push({ id: id, name: name.value.trim(), area_id: room.value, active: 'true' });
        make('thermometer', [{ id: id, label: name.value.trim() }]);
      });
    } });
    sheet.appendChild(h('div', { class: 'qcard big noprint' }, [h('b', { text: 'Add thermometer' }), name, room, go]));
  }
  load().then(function (ok) {
    if (!ok) return;
    var onSite = {}; BLDOccupancy.dailyList(T).dogs.forEach(function (d) { onSite[d.id] = true; });   // same list as The Board: not dogs that have left
    opts.appendChild(btn('Whole-site code', function () { make('site', [{ id: 'site', label: 'Today' }]); }));
    opts.appendChild(btn('Room signs', function () { make('area', T.area.map(function (a) { return { id: a.id, label: a.code || a.id }; })); }));
    opts.appendChild(btn('Dog kennel cards', function () { make('subject', T.subject.filter(function (s) { return onSite[s.id]; }).map(function (s) { return { id: s.id, label: s.name || s.id }; })); }));
    opts.appendChild(btn('Litter cards', function () {
      if (!(T.litter || []).length) { say('The litter list is not switched on yet.', 'warn'); return; }
      var names = {}; T.subject.forEach(function (s) { names[s.id] = s.name; });
      make('litter', T.litter.map(function (l) { return { id: l.id, label: 'Litter of ' + (names[l.dam_subject_id] || l.id) }; }));
    }));
    opts.appendChild(btn('Thermometer cards', function () {
      if (!T.thermometer) { say('The thermometer list is not switched on yet.', 'warn'); return; }
      make('thermometer', T.thermometer.filter(function (t) { return String(t.active).toLowerCase() !== 'false'; }).map(function (t) { return { id: t.id, label: t.name || t.id }; }));
    }));
    opts.appendChild(btn('Add thermometer', addThermometer));
    opts.appendChild(btn('Phone set-up QR', function () {
      var url = ''; try { url = localStorage.getItem('bld.scriptUrl') || ''; } catch (e) { /* none */ }
      sheet.textContent = '';
      sheet.appendChild(h('div', { class: 'qcard big' }, [h('div', { html: BLDQr.svg(base + '#setup=' + encodeURIComponent(url), 'Phone set-up QR') }), h('b', { text: 'Set up a phone' }), h('small', { text: 'Show on screen. Do not pin up or photograph.' })]));
      say('Staff scan this once, then type their own code.', 'good');
    }));
    opts.appendChild(btn('Private set-up QR', privateQr));
  });
}());
