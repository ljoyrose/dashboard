/*!
 * Print room signs, dog kennel cards (not collars) and litter cards, and show the phone set-up QR.
 * Owner page: needs an OWNER code on this device. Each QR holds only a random id, kept in BLD-qr_tag.
 */
(function () {
  'use strict';
  var CODE_KEY = 'bld.device.code', ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', LEN = 8;
  var screen = document.getElementById('screen'), save = BLDSave.create({});
  /* Where every printed QR points (Lisa 18 Nov 2026): the public staff page, never this page's own address. Lisa and Grace
     may print from the Cloudflare copy, which needs a Cloudflare sign-in; staff, guests, vets and inspectors scan without one.
     The owner's rule row qr.base_url (dated, with a source) wins; this is only the starting default. */
  var QR_BASE_START = 'https://ljoyrose.github.io/dashboard/cdhub/staff/';
  function qrBase() {
    var day = typeof BLDNeeds !== 'undefined' ? BLDNeeds.today() : '', best = null;
    ((T && T.breeding_rule) || []).forEach(function (r) {
      var f = String(r.from_date || r.effective_from || ''), v = String(r.value || '').trim();
      if (r.rule_key !== 'qr.base_url' || !/^https:\/\/[^\s#?]+\/$/.test(v) || (f && f > day) || (r.to_date && String(r.to_date) < day)) return;
      if (!best || f >= best.f) best = { f: f, v: v };
    });
    return best ? best.v : QR_BASE_START;
  }
  save.TABLES.qr_tag = { label: 'QR codes', file: 'BLD-qr_tag.csv', fields: { tag: { type: 'text', required: true, label: 'Tag' }, kind: { type: 'enum', values: ['area', 'subject', 'litter', 'site', 'thermometer'], required: true, label: 'Kind' }, ref_id: { type: 'text', required: true, label: 'Refers to' } } };
  save.TABLES.thermometer = { label: 'Thermometers', file: 'BLD-thermometer.csv', fields: { name: { type: 'text', required: true, label: 'Name' }, area_id: { type: 'text', required: true, label: 'Room' } } };   // the save checks the room exists
  function h(t, a, k) { var e = document.createElement(t); Object.keys(a || {}).forEach(function (x) { if (x === 'text') e.textContent = a[x]; else if (x === 'class') e.className = a[x]; else if (x === 'html') e.innerHTML = a[x]; else if (x.slice(0, 2) === 'on') e.addEventListener(x.slice(2), a[x]); else e.setAttribute(x, a[x]); }); (k || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return e; }
  function newTag() { var a = new Uint8Array(LEN), s = ''; crypto.getRandomValues(a); for (var i = 0; i < LEN; i++) s += ALPHABET.charAt(a[i] % ALPHABET.length); return s; }
  function say(t, k) { msg.className = 'msg noprint ' + (k || ''); msg.textContent = t; }   // noprint kept: the status line never prints
  var msg = h('p', { class: 'msg noprint', role: 'status' });
  screen.appendChild(h('h1', { class: 'noprint', text: 'Print QR cards' }));
  var code = ''; try { code = localStorage.getItem(CODE_KEY) || ''; } catch (e) { /* no storage */ }
  // Board A (Lisa 17 Nov 2026): an owner signed in to CD Hub on this browser needs no code; the save address CD Hub keeps is used.
  var owner = BLDSave.ownerToken ? BLDSave.ownerToken() : '';
  if (!save.getScriptUrlSet() && owner) { ['cdhub.sink.url', 'cdhub.save.url'].some(function (k) { var u = ''; try { u = localStorage.getItem(k) || ''; } catch (e) { u = ''; } return u && save.setScriptUrl(u, true).ok; }); }
  if (!save.getScriptUrlSet() || (!code && !owner)) { screen.appendChild(h('p', { class: 'sub', text: 'Sign in to CD Hub on this device as the owner (or set it up on the staff page with an owner code), then open this page again.' })); return; }
  if (code) save.setCode(code, false);
  screen.appendChild(h('p', { class: 'sub noprint', text: 'Each code holds only a random id. Printing again reuses the same codes.' }));
  var opts = h('div', { class: 'opts noprint' }), sheet = h('div', { class: 'sheet' });
  screen.appendChild(opts); screen.appendChild(msg); screen.appendChild(sheet);
  var T = null;
  function load() {
    say('Loading...');
    return save.checkStatus().then(function () { return save.readMany(['area', 'subject', 'occupancy', 'subject_status', 'qr_tag', 'litter', 'thermometer', 'requirement', 'breeding_rule', 'area_capacity', 'area_access', 'coat_colour', 'coat_pattern', 'nose_pigment', 'microchip', 'check_type', 'subject_link', 'links', 'files', 'weight'], ['subject_link', 'links', 'files', 'weight', 'subject_status', 'litter', 'thermometer', 'requirement', 'breeding_rule', 'area_capacity', 'area_access', 'coat_colour', 'coat_pattern', 'nose_pigment', 'microchip', 'check_type']);   /* colour, chip and job lists are owner-only: a staff code reads none and the card leaves those lines out */ }).then(function (r) {
      if (!r.ok) { say(r.message || 'Could not load the lists.', 'bad'); return false; }
      T = r.tables; say(''); return true;
    });
  }
  function current(kind, refId) { return (T.qr_tag || []).filter(function (t) { return t.kind === kind && t.ref_id === refId && String(t.active).toLowerCase() !== 'false'; })[0]; }
  function card(tag, title, big, room) { return h('div', { class: 'qcard' + (big ? ' big' : '') }, [h('div', { html: BLDQr.svg(qrBase() + '#s/' + tag, 'QR code for ' + title) }), h('b', { text: title })].concat(room ? [h('span', { class: 'room', 'data-room': room, text: room })] : []).concat([h('small', { text: tag })])); }
  function make(kind, items, draw) {
    sheet.textContent = '';
    var missing = items.filter(function (it) { return !current(kind, it.id); }), i = 0, failed = '';
    // 15 Nov 2026 (Lisa): printing never shows a code that is not saved. New codes need an owner code, so say so before trying.
    var role = typeof save.role === 'function' ? save.role() : '';
    if (missing.length && role && role !== 'OWNER') {
      say('Not printed. ' + missing.length + ' new code' + (missing.length === 1 ? '' : 's') + ' must be saved first, and only an owner code can save them. This device has a ' + role.toLowerCase() + ' code: set it up again on the staff page with your owner code.', 'bad');
      return;
    }
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
      // only codes already saved are drawn (a code whose save failed is never shown); the rest are named as not printed
      items.forEach(function (it) { var t = current(kind, it.id); if (t) sheet.appendChild(draw ? draw(t.tag, it) : card(t.tag, it.label, kind === 'area', it.room)); });
      var left = items.filter(function (it) { return !current(kind, it.id); }).length;
      say(failed ? ('Not printed: ' + left + ' card' + (left === 1 ? '' : 's') + ', because ' + failed.charAt(0).toLowerCase() + failed.slice(1) + ' ' + sheet.children.length + ' saved card' + (sheet.children.length === 1 ? ' is' : 's are') + ' below.')
        : (sheet.children.length + ' cards ready. Use your browser’s Print.'), failed ? 'bad' : 'good');
    }());
  }
  /* Lisa's "Dog Card Print-outs" layout (v4). Every value prints from rows: size colours from size_colour.* rule rows,
     room limits from area_capacity for the room's current access. Nothing kennel-specific is fixed here. */
  var per = 2;   // cards per A4: 1, 2 or 4 (Lisa's dog card, 18 Nov 2026: two per A4)
  function sizeKey(b) { var m = /(small|medium|large)/i.exec(String(b || '')); return m ? m[1].toLowerCase() : ''; }
  /* the dog's size: the one shared rule with the CD Hub dog page (staff/lib/capacity.js sizeForDog): an owner
     size_override row, else the latest weighing, else the middle of the kg range in its size cell, all against the
     owner's size_from_kg rows (Lisa 15 Nov 2026); last, a size word typed in the cell. Never any kg on the card. */
  function sizeOfDog(s) {
    if (!s) return '';
    var w = null;
    (T.weight || []).forEach(function (r) { if (r.subject_id === s.id && !isNaN(parseFloat(r.weight_kg)) && (!w || String(r.performed_on || '') >= String(w.performed_on || ''))) w = r; });
    return BLDCapacity.sizeForDog({ id: s.id, kg: w ? w.weight_kg : null, sizeText: s.size_band, rules: T.breeding_rule || [], today: BLDNeeds.today() }).size || sizeKey(s.size_band);
  }
  /* the size word only, in the owner's size_label.* words (default Small, Medium, Large, shared with the hub): never the kg range typed in the old size cell */
  function sizeWord(k) { return k ? (BLDCapacity.sizeLabels(T.breeding_rule || [], BLDNeeds.today())[k] || '') : ''; }
  function sizeColour(b) {
    var k = sizeKey(b), c = '';
    (T.breeding_rule || []).forEach(function (r) { if (r.rule_key === 'size_colour.' + k && /^([a-z]+|#[0-9a-f]{3,6})$/i.test(r.value || '')) c = r.value; });
    return c ? 'var(--sz-' + c.replace('#', 'x') + ', ' + c + ')' : '';
  }
  /* one date format everywhere: 2 Mar 2026 (Lisa 13 Nov 2026; never DD/MM/YY) */
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dmy(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m && MON[+m[2] - 1] ? (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] : ''; }
  function sexIcon(sex) {
    var f = /^f/i.test(sex || ''), m = /^m/i.test(sex || '');
    if (!f && !m) return null;
    return h('span', { class: 'sex', role: 'img', 'aria-label': f ? 'Female' : 'Male', html: '<svg viewBox="0 0 24 24" aria-hidden="true">' + (f ? '<circle cx="12" cy="9" r="6"/><path d="M12 15v7M8.5 19h7"/>' : '<circle cx="10" cy="14" r="6"/><path d="M19 5l-5 5M19 5h-5M19 5v5"/>') + '</svg>' });
  }
  function chipOf(s) { var n = ''; (T.microchip || []).forEach(function (r) { if (r.subject_id === s.id && r.chip_number) n = String(r.chip_number); });
    return n.replace(/\s+/g, '').replace(/(\d{3})(?=\d)/g, '$1 '); }
  /* the jobs in force for this kind of card (Lisa's job rows) */
  function jobsFor(kinds) { return (typeof BLDDue !== 'undefined' ? BLDDue.jobsInForce(T.check_type || [], BLDNeeds.today()) : []).filter(function (j) { return kinds.indexOf(j.target) >= 0; }); }
  function howOften(j) { var n = parseInt(j.every_days, 10); return j.frequency || (n === 1 ? 'daily' : n === 7 ? 'weekly' : n > 0 ? 'every ' + n + ' days' : 'as needed'); }
  /* Photo: the dog's photo cell holds a Drive file id (or a Drive link). The card shows Drive's own picture of it, which
     loads for whoever is signed in to Google with access to the photos folder; otherwise the empty Photo box stays. */
  function photoId(v) { v = String(v == null ? '' : v).trim(); var m = /\/file\/d\/([A-Za-z0-9_-]+)/.exec(v) || /[?&]id=([A-Za-z0-9_-]+)/.exec(v);
    return m ? m[1] : (!/^https?:/i.test(v) && /^[A-Za-z0-9_-]{8,}$/.test(v) ? v : ''); }
  /* the main photo is the 'main' link row in force (Lisa 13 Nov 2026, staff/lib/photos.js); the old photo cell until then */
  function mainPhoto(s) { var m = BLDPhotos.forRecord(T.links || [], T.files || [], T.breeding_rule || [], 'subjects', s.id, BLDNeeds.today()).main;
    return (m && photoId(m.drive_file_id)) || photoId(s.photo); }
  function photoBox(s) {
    var id = mainPhoto(s), box = h('div', { class: 'photo', text: id ? '' : 'Photo', 'data-k': 'photo' });
    if (id) box.appendChild(h('img', { src: 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w800', alt: '', referrerpolicy: 'no-referrer',
      onerror: function () { box.textContent = 'Photo'; } }));
    return box; }
  /* Lisa's dog card (18 Nov 2026): big name, Sex with its sign, Date of birth, photo framed in the size colour,
     "Size: Medium" block in the size colour, one large code, the microchip in groups of 3. Two per A4, cut line between. */
  function dogCard(tag, it) {
    var s = it.s, sz = sizeOfDog(s), col = sizeColour(sz), chip = chipOf(s), f = /^f/i.test(s.sex || ''), m = /^m/i.test(s.sex || '');
    var facts = [];
    if (f || m) facts.push(h('div', { 'data-k': 'sex' }, [h('dt', { text: 'Sex' }), h('dd', {}, [f ? 'Female' : 'Male', sexIcon(s.sex)])]));
    if (s.dob) facts.push(h('div', { 'data-k': 'dob' }, [h('dt', { text: 'Date of birth' }), h('dd', { text: dmy(s.dob) })]));
    return h('article', { class: 'dcard', 'data-dog': s.id, style: col ? '--c:' + col : '' }, [
      h('h2', { class: 'name', text: s.name || s.id }),
      h('div', { class: 'dtop' }, [h('dl', {}, facts), photoBox(s)]),
      sz ? h('div', { class: 'szb', 'data-size': sz, 'data-k': 'size' }, ['Size: ', h('b', { text: sizeWord(sz) })]) : null,
      h('div', { class: 'code', html: BLDQr.svg(qrBase() + '#s/' + tag, 'QR code for ' + (s.name || s.id)) }),
      chip ? h('div', { class: 'chipline', 'data-k': 'chip' }, ['Microchip', h('b', { text: chip })]) : null,
      h('small', { class: 'tag', text: tag })]);
  }
  /* Litter card in the kennel-card style (Lisa's "Dog Card Print-outs" v4): band with the dam's size colour, photo, facts, one large code */
  function litterCard(tag, it) {
    var l = it.l, dam = it.dam || {}, col = sizeColour(sizeOfDog(dam)), rows = [], born = l.born_on || l.dob || '';
    if (it.sire) rows.push(['Sire', it.sire]);
    if (it.pups) rows.push(['Pups', String(it.pups)]);
    if (it.room) rows.push(['Room', it.room]);
    return h('article', { class: 'dcard lcard', 'data-litter': l.id, style: col ? '--c:' + col : '' }, [
      h('div', { class: 'band' }, [h('span', { class: 'who' }, [h('b', { text: it.label })]), born ? h('small', { 'data-k': 'born' }, ['Born', h('br'), dmy(born)]) : null]),
      h('div', { class: 'dbody' }, [
        h('div', { class: 'cside' }, [h('div', { class: 'photo', text: 'Photo' }),
          h('dl', {}, rows.map(function (r) { return h('div', { 'data-k': r[0] }, [h('dt', { text: r[0] }), h('dd', { text: r[1] })]); }))]),
        h('div', { class: 'code', html: BLDQr.svg(qrBase() + '#s/' + tag, 'QR code for ' + it.label) }),
        jobList(['litter']),
        h('small', { class: 'tag', text: tag })])]);
  }
  function jobList(kinds) { var js = jobsFor(kinds); return js.length ? h('ul', { class: 'lst', 'data-k': 'jobs' }, js.sort(function (a, b) { return String(a.label).localeCompare(String(b.label)); })
    .map(function (j) { return h('li', {}, [j.label || j.type_key, h('span', { text: howOften(j) })]); })) : null; }
  /* a dated row counts from its from_date (older rows: effective_from) until its to_date */
  function fromOf(r) { return String(r.from_date || r.effective_from || ''); }
  function inForceOn(r, day) { var f = fromOf(r); return (!f || f <= day) && (!r.to_date || String(r.to_date) >= day); }
  /* the room's access today: the latest access row in force (a later row of the same day wins) */
  function accessNow(areaId) {
    var day = BLDNeeds.today(), acc = '', last = null;
    (T.area_access || []).forEach(function (r) { if (r.area_id === areaId && r.access_type && inForceOn(r, day) && (last === null || fromOf(r) >= last)) { last = fromOf(r); acc = String(r.access_type).toLowerCase(); } });
    return acc;
  }
  /* the limits for the room's access today: size -> dogs, and size -> mum with pups, from area_capacity rows in force */
  function limitsOf(areaId) {
    var day = BLDNeeds.today(), acc = accessNow(areaId), best = {}, any = false;
    (T.area_capacity || []).forEach(function (r) {
      if (r.area_id !== areaId || String(r.access_type || '').toLowerCase() !== acc || !inForceOn(r, day)) return;
      var k = sizeKey(r.size_band); if (!k) return;
      var key = (/pups/i.test(r.size_band || '') ? 'pups.' : '') + k;
      if (!best[key] || fromOf(r) >= best[key].f) best[key] = { f: fromOf(r), n: parseInt(r.max_dogs, 10) || 0 };
      any = true;
    });
    var out = { access: acc, any: any, dogs: {}, pups: [] };
    ['small', 'medium', 'large'].forEach(function (k) { out.dogs[k] = best[k] ? best[k].n : 0; if (best['pups.' + k] && best['pups.' + k].n > 0) out.pups.push(k); });
    return out;
  }
  var DOG = '<svg viewBox="0 0 32 24" aria-hidden="true"><path d="M3 9l3-5 2 4h9l3-6 3 3h4l2 3-3 2h-3l-1 3v9h-3l-1-6h-9l-2 6H7l1-8-3-3z"/></svg>';
  function roomSize(a) { var v = parseFloat(a.area_value); return v > 0 ? String(v) + (a.area_unit_id === 'u-m2' || !a.area_unit_id ? ' m²' : '') : ''; }
  /* the line at the foot of every room card: the owner's rule row room_card.footer, else the words on Lisa's design */
  function footer() { var v = ''; (T.breeding_rule || []).forEach(function (r) { if (r.rule_key === 'room_card.footer' && inForceOn(r, BLDNeeds.today())) v = String(r.value || ''); }); return v || 'Unsure? Don’t Move. Ask.'; }
  /* Lisa's room card (18 Nov 2026): name, a colour line, Access / Room size / Mum + pups, then Small, Medium, Large
     each with a dog per place and "= n" in the size colour (none: a dashed "No large dogs"), the code, the footer. */
  function roomCard(tag, it) {
    var a = it.a || {}, lim = limitsOf(it.id), acc = lim.access;
    var fact = function (k, label, val, sub) { return h('div', { 'data-k': k }, [h('dt', { text: label }), h('dd', { text: val }), sub ? h('small', { text: sub }) : null]); };
    var rows = lim.any ? ['small', 'medium', 'large'].map(function (k) {
      var n = lim.dogs[k], c = sizeColour(k), word = sizeWord(k), icons = [];
      for (var i = 0; i < n; i++) icons.push(h('i', { html: DOG }));
      return n > 0 ? h('div', { class: 'szrow', 'data-size': k, style: c ? '--c:' + c : '' }, [h('b', { text: word }), h('span', { class: 'dogs' }, icons), h('span', { class: 'n', text: '= ' + n })])
        : h('div', { class: 'szrow none', 'data-size': k, style: c ? '--c:' + c : '' }, [h('b', { text: word }), h('small', { text: 'No ' + word.toLowerCase() + ' dogs' })]);
    }) : [h('p', { class: 'nolim', 'data-k': 'no-limits', text: 'No limits set for ' + (acc ? acc + ' access' : 'this room') + '. Ask.' })];
    return h('article', { class: 'rcard', 'data-room': it.id }, [
      h('h2', { class: 'name', text: it.label }), h('div', { class: 'rainbow' }),
      h('dl', { class: 'facts' }, [
        fact('access', 'Access', acc ? acc.charAt(0).toUpperCase() + acc.slice(1) + ' access' : 'Not set'),
        fact('area', 'Room size', roomSize(a) || '–'),
        fact('pups', 'Mum + pups', lim.pups.length ? 'Yes' : 'No', lim.pups.map(function (k) { return k.charAt(0).toUpperCase(); }).join('/'))]),
      h('div', { class: 'rbody' }, [h('div', { class: 'rows' }, rows), h('div', { class: 'code', html: BLDQr.svg(qrBase() + '#s/' + tag, 'QR code for ' + it.label) })]),
      h('p', { class: 'foot', text: footer() }),
      h('small', { class: 'tag', text: tag })]);
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
      var c = input.value.trim(), link = qrBase() + '#join=' + encodeURIComponent(c) + '&url=' + url;
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
    opts.appendChild(btn('Room cards', function () { sheet.className = 'sheet rooms'; make('area', T.area.filter(function (a) { return BLDOccupancy.inUse(a, BLDNeeds.today(), T.requirement) && !/^ZZ_/.test(a.code || ''); }).map(function (a) { return { id: a.id, label: a.code || a.id, a: a }; }), roomCard); }));
    opts.appendChild(btn('Dog cards', function () { sheet.className = 'sheet dogs per' + per; make('subject', T.subject.filter(function (s) { return onSite[s.id]; }).map(function (s) { return { id: s.id, label: s.name || s.id, room: roomOf[s.id] || '', s: s }; }), dogCard); }));
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
      sheet.appendChild(h('div', { class: 'qcard big' }, [h('div', { html: BLDQr.svg(qrBase() + '#setup=' + encodeURIComponent(url), 'Phone set-up QR') }), h('b', { text: 'Set up a phone' }), h('small', { text: 'Show on screen. Do not pin up or photograph.' })]));
      say('Staff scan this once, then type their own code.', 'good');
    }));
    opts.appendChild(btn('Private set-up QR', privateQr));
    var add = ''; try { add = new URLSearchParams(location.search).get('add') || ''; } catch (e) { /* old browser */ }
    if (add === 'thermometer') addThermometer();   // from the hub's "+ Thermometer"
  });
}());
