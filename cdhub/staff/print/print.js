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
  save.TABLES.thermometer = { label: 'Thermometers', file: 'BLD-thermometer.csv', fields: { name: { type: 'text', required: true, label: 'Name' }, area_id: { type: 'text', required: true, label: 'Room' } } };   // the save checks the room exists
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
    return save.checkStatus().then(function () { return save.readMany(['area', 'subject', 'occupancy', 'subject_status', 'qr_tag', 'litter', 'thermometer', 'requirement', 'breeding_rule', 'area_capacity', 'area_access'], ['subject_status', 'litter', 'thermometer', 'requirement', 'breeding_rule', 'area_capacity', 'area_access']); }).then(function (r) {
      if (!r.ok) { say(r.message || 'Could not load the lists.', 'bad'); return false; }
      T = r.tables; say(''); return true;
    });
  }
  function current(kind, refId) { return (T.qr_tag || []).filter(function (t) { return t.kind === kind && t.ref_id === refId && String(t.active).toLowerCase() !== 'false'; })[0]; }
  function card(tag, title, big, room) { return h('div', { class: 'qcard' + (big ? ' big' : '') }, [h('div', { html: BLDQr.svg(base + '#s/' + tag, 'QR code for ' + title) }), h('b', { text: title })].concat(room ? [h('span', { class: 'room', 'data-room': room, text: room })] : []).concat([h('small', { text: tag })])); }
  function make(kind, items, draw) {
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
      items.forEach(function (it) { var t = current(kind, it.id); if (t) sheet.appendChild(draw ? draw(t.tag, it) : card(t.tag, it.label, kind === 'area', it.room)); });
      say(failed ? 'Stopped: ' + failed : (sheet.children.length + ' cards ready. Use your browser’s Print.'), failed ? 'bad' : 'good');
    }());
  }
  /* Lisa's "Dog Card Print-outs" layout (v4). Every value prints from rows: size colours from size_colour.* rule rows,
     room limits from area_capacity for the room's current access. Nothing kennel-specific is fixed here. */
  var per = 1;   // cards per A4: 1, 2 or 4
  function sizeKey(b) { var m = /(small|medium|large)/i.exec(String(b || '')); return m ? m[1].toLowerCase() : ''; }
  function sizeColour(b) {
    var k = sizeKey(b), c = '';
    (T.breeding_rule || []).forEach(function (r) { if (r.rule_key === 'size_colour.' + k && /^([a-z]+|#[0-9a-f]{3,6})$/i.test(r.value || '')) c = r.value; });
    return c ? 'var(--sz-' + c.replace('#', 'x') + ', ' + c + ')' : '';
  }
  /* "10-25kg (medium)" prints as "Medium" over "10–25 kg", as on the mock-up; anything else prints as typed */
  function sizeLines(b) {
    var m = /^\s*([^()]*?)\s*\(([^)]+)\)\s*$/.exec(String(b || ''));
    if (!m) return [String(b || '')];
    var w = m[2].charAt(0).toUpperCase() + m[2].slice(1), kg = m[1].replace(/-/g, '\u2013').replace(/kg/i, ' kg').replace(/\s+/g, ' ').trim();
    return [w, h('br'), kg];
  }
  function dmy(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? m[3] + '/' + m[2] + '/' + m[1].slice(2) : ''; }
  function sexIcon(sex) {
    var f = /^f/i.test(sex || ''), m = /^m/i.test(sex || '');
    if (!f && !m) return null;
    return h('span', { class: 'sex', role: 'img', 'aria-label': f ? 'Female' : 'Male', html: '<svg viewBox="0 0 24 24" aria-hidden="true">' + (f ? '<circle cx="12" cy="9" r="6"/><path d="M12 15v7M8.5 19h7"/>' : '<circle cx="10" cy="14" r="6"/><path d="M19 5l-5 5M19 5h-5M19 5v5"/>') + '</svg>' });
  }
  function dogCard(tag, it) {
    var s = it.s, col = sizeColour(s.size_band), rows = [];
    if (s.dob) rows.push(['DOB', dmy(s.dob)]);
    if (it.room) rows.push(['Room', it.room]);
    return h('article', { class: 'dcard', 'data-dog': s.id, style: col ? '--c:' + col : '' }, [
      h('div', { class: 'band' }, [h('span', { class: 'who' }, [h('b', { text: s.name || s.id }), sexIcon(s.sex)]), s.size_band ? h('small', { 'data-size': sizeKey(s.size_band) }, sizeLines(s.size_band)) : null]),
      h('div', { class: 'dbody' }, [
        h('div', { class: 'cside' }, [h('div', { class: 'photo', text: 'Photo' }),
          h('dl', {}, rows.map(function (r) { return h('div', { 'data-k': r[0] }, [h('dt', { text: r[0] }), h('dd', { text: r[1] })]); }))]),
        h('div', { class: 'code', html: BLDQr.svg(base + '#s/' + tag, 'QR code for ' + (s.name || s.id)) }),
        h('small', { class: 'tag', text: tag })])]);
  }
  /* Litter card in the kennel-card style (Lisa's "Dog Card Print-outs" v4): band with the dam's size colour, photo, facts, one large code */
  function litterCard(tag, it) {
    var l = it.l, dam = it.dam || {}, col = sizeColour(dam.size_band), rows = [], born = l.born_on || l.dob || '';
    if (it.sire) rows.push(['Sire', it.sire]);
    if (it.pups) rows.push(['Pups', String(it.pups)]);
    if (it.room) rows.push(['Room', it.room]);
    return h('article', { class: 'dcard lcard', 'data-litter': l.id, style: col ? '--c:' + col : '' }, [
      h('div', { class: 'band' }, [h('span', { class: 'who' }, [h('b', { text: it.label })]), born ? h('small', { 'data-k': 'born' }, ['Born', h('br'), dmy(born)]) : null]),
      h('div', { class: 'dbody' }, [
        h('div', { class: 'cside' }, [h('div', { class: 'photo', text: 'Photo' }),
          h('dl', {}, rows.map(function (r) { return h('div', { 'data-k': r[0] }, [h('dt', { text: r[0] }), h('dd', { text: r[1] })]); }))]),
        h('div', { class: 'code', html: BLDQr.svg(base + '#s/' + tag, 'QR code for ' + it.label) }),
        h('small', { class: 'tag', text: tag })])]);
  }
  function limitsOf(areaId) {
    var acc = '', last = '';
    (T.area_access || []).forEach(function (r) { if (r.area_id === areaId && String(r.effective_from || '') >= last) { last = String(r.effective_from || ''); acc = r.access_type; } });
    var out = [];
    (T.area_capacity || []).forEach(function (r) {
      if (r.area_id !== areaId || r.access_type !== acc || /pups/i.test(r.size_band || '')) return;
      var n = parseInt(r.max_dogs, 10); if (n > 0) out.push({ band: r.size_band, n: n });
    });
    var order = { small: 1, medium: 2, large: 3 };
    return out.sort(function (a, b) { return (order[sizeKey(a.band)] || 9) - (order[sizeKey(b.band)] || 9); });
  }
  function roomCard(tag, it) {
    var lim = limitsOf(it.id);
    return h('article', { class: 'rcard', 'data-room': it.id }, [h('b', { text: it.label }),
      lim.length ? h('div', { class: 'limits' }, lim.map(function (l, i) { var c = sizeColour(l.band);
        return h('span', { class: 'sz', 'data-size': sizeKey(l.band), style: c ? '--c:' + c : '' }, [h('i'), (i ? 'or ' : '') + l.n + ' ' + sizeKey(l.band)]); })) : null,
      h('div', { class: 'code', html: BLDQr.svg(base + '#s/' + tag, 'QR code for ' + it.label) }), h('small', { class: 'tag', text: tag })]);
  }
  function btn(text, fn) { return h('button', { class: 'btn', type: 'button', text: text, onclick: fn }); }
  /** Draws one person's code as a QR on this screen only: nothing is saved, printed, logged or sent. */
  function privateQr() {
    var url = '', timer = 0; try { url = localStorage.getItem('bld.scriptUrl') || ''; } catch (e) { /* none */ }
    sheet.textContent = ''; sheet.className = 'sheet'; say('');
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
  /** Every thermometer whose need rows have not all ended, A to Z by name, each with its QR card. */
  function thermoCards() {
    sheet.className = 'sheet';
    if (!T.thermometer) { say('The thermometer list is not switched on yet.', 'warn'); return; }
    var today = BLDNeeds.today();   // a thermometer whose need rows all ended before today gets no card
    make('thermometer', T.thermometer.filter(function (t) { var end = BLDNeeds.endDay(T.requirement, 'reading.temperature', 'thermometer', t.id); return !end || end >= today; })
      .map(function (t) { return { id: t.id, label: t.name || t.id }; })
      .sort(function (a, b) { return String(a.label).localeCompare(String(b.label), 'en', { numeric: true }); }));
  }
  /** One thermometer per place (a room or a corridor): the owner names it and picks its place; then the list shows
      with its new QR card, ready to print (Lisa 11 Nov 2026). The hub's "+ Thermometer" opens this (?add=thermometer). */
  function addThermometer() {
    if (!T.thermometer) { say('The thermometer list is not switched on yet.', 'warn'); return; }
    sheet.textContent = ''; say('');
    var name = h('input', { class: 'inp', type: 'text', maxlength: '40', 'aria-label': 'Thermometer name', placeholder: 'Name' });
    var places = T.area.filter(function (a) { return BLDOccupancy.inUse(a, BLDNeeds.today(), T.requirement); }).sort(function (a, b) {
      var x = parseFloat(a.group_sort), y = parseFloat(b.group_sort); x = isNaN(x) ? Infinity : x; y = isNaN(y) ? Infinity : y;
      return x !== y ? (x < y ? -1 : 1) : String(a.code || a.id).localeCompare(String(b.code || b.id), 'en', { numeric: true });
    });   // every area in use: rooms and corridors alike (a corridor is its own place)
    var room = h('select', { class: 'inp', 'aria-label': 'Place' }, [h('option', { value: '', text: 'Place' })].concat(places.map(function (a) { return h('option', { value: a.id, text: a.code || a.id }); })));
    var go = h('button', { class: 'btn', type: 'button', text: 'Save', onclick: function () {
      if (!name.value.trim() || !room.value) { say('Name and place, please.', 'bad'); return; }
      go.disabled = true; say('Saving...');
      var f = { name: name.value.trim(), area_id: room.value };
      save.submit('thermometer', f).then(function (r) {
        go.disabled = false;
        if (!r.ok) { say(r.message || 'Not saved.', 'bad'); return; }
        if (r.status !== 'saved' || !r.id) { say(r.message, 'good'); return; }
        var id = r.id;
        T.thermometer.push({ id: id, name: f.name, area_id: f.area_id });
        thermoCards();
      });
    } });
    sheet.appendChild(h('div', { class: 'qcard big noprint' }, [h('b', { text: 'Add thermometer' }), name, room, go]));
  }
  load().then(function (ok) {
    if (!ok) return;
    var onSite = {}, roomOf = {}; BLDOccupancy.dailyList(T).dogs.forEach(function (d) { onSite[d.id] = true; if (d.known && !d.out && d.areaLabel) roomOf[d.id] = d.areaLabel; });   // same list as The Board: not dogs that have left
    opts.appendChild(btn('Whole-site code', function () { sheet.className = 'sheet'; make('site', [{ id: 'site', label: 'Today' }]); }));
    opts.appendChild(btn('Room signs', function () { sheet.className = 'sheet rooms'; make('area', T.area.filter(function (a) { return BLDOccupancy.inUse(a, BLDNeeds.today(), T.requirement); }).map(function (a) { return { id: a.id, label: a.code || a.id }; }), roomCard); }));
    opts.appendChild(btn('Dog kennel cards', function () { sheet.className = 'sheet dogs per' + per; make('subject', T.subject.filter(function (s) { return onSite[s.id]; }).map(function (s) { return { id: s.id, label: s.name || s.id, room: roomOf[s.id] || '', s: s }; }), dogCard); }));
    var perBox = h('span', { class: 'per', role: 'group', 'aria-label': 'Cards per A4' }, [1, 2, 4].map(function (n) {
      return h('button', { class: 'btn quiet', type: 'button', 'aria-pressed': String(n === per), text: n === 1 ? 'Full A4' : n + ' per A4', onclick: function () {
        per = n; Array.prototype.forEach.call(perBox.children, function (b, i) { b.setAttribute('aria-pressed', String([1, 2, 4][i] === per)); });
        if (/\bdogs\b/.test(sheet.className)) sheet.className = sheet.className.replace(/\bper\d\b/, 'per' + per); } });
    }));
    opts.appendChild(perBox);
    opts.appendChild(btn('Litter cards', function () {
      if (!(T.litter || []).length) { sheet.className = 'sheet'; say('The litter list is not switched on yet.', 'warn'); return; }
      var subj = {}, pups = {}, pupsHere = {};
      T.subject.forEach(function (s) { subj[s.id] = s; if (s.birth_litter_id) { pups[s.birth_litter_id] = (pups[s.birth_litter_id] || 0) + 1; if (onSite[s.id]) pupsHere[s.birth_litter_id] = true; } });
      /* litters still here: a pup on site, or the dam on site with no pups entered yet. No date cut-off. */
      var list = T.litter.filter(function (l) { return pupsHere[l.id] || (!pups[l.id] && onSite[l.dam_subject_id]); })
        .sort(function (a, b) { return String(b.born_on || b.dob || '').localeCompare(String(a.born_on || a.dob || '')); });
      if (!list.length) { sheet.className = 'sheet'; sheet.textContent = ''; say('No litters on site.', 'warn'); return; }
      sheet.className = 'sheet dogs litters per' + per;
      make('litter', list.map(function (l) { var dam = subj[l.dam_subject_id] || {}, sire = subj[l.sire_subject_id] || {};
        return { id: l.id, label: 'Litter of ' + (dam.name || l.id), l: l, dam: dam, sire: sire.name || '', pups: pups[l.id] || 0, room: roomOf[l.dam_subject_id] || '' }; }), litterCard);
    }));
    opts.appendChild(btn('Thermometer cards', thermoCards));
    opts.appendChild(btn('Add thermometer', addThermometer));
    opts.appendChild(btn('Phone set-up QR', function () { sheet.className = 'sheet';
      var url = ''; try { url = localStorage.getItem('bld.scriptUrl') || ''; } catch (e) { /* none */ }
      sheet.textContent = '';
      sheet.appendChild(h('div', { class: 'qcard big' }, [h('div', { html: BLDQr.svg(base + '#setup=' + encodeURIComponent(url), 'Phone set-up QR') }), h('b', { text: 'Set up a phone' }), h('small', { text: 'Show on screen. Do not pin up or photograph.' })]));
      say('Staff scan this once, then type their own code.', 'good');
    }));
    opts.appendChild(btn('Private set-up QR', privateQr));
    var add = ''; try { add = new URLSearchParams(location.search).get('add') || ''; } catch (e) { /* old browser */ }
    if (add === 'thermometer') addThermometer();   // from the hub's "+ Thermometer"
  });
}());
