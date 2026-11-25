/*!
 * Print room signs, dog kennel cards (not collars) and litter cards, and show the phone set-up QR.
 * Owner page: needs an OWNER code on this device. Each QR holds only a random id, kept in BLD-qr_tag.
 */
(function () {
  'use strict';
  var CODE_KEY = 'bld.device.code', ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', LEN = 8;
  var screen = document.getElementById('screen'), save = BLDSave.create({});
  /* Printed QR codes open the staff page on this same site (the folder above this print page). An owner rule
     qr.base_url (https, ending in /) wins when one is in force. */
  function qrBase() {
    var day = typeof BLDNeeds !== 'undefined' ? BLDNeeds.today() : '', best = null;
    ((T && T.breeding_rule) || []).forEach(function (r) {
      var f = String(r.from_date || r.effective_from || ''), v = String(r.value || '').trim();
      if (r.rule_key !== 'qr.base_url' || !/^https:\/\/[^\s#?]+\/$/.test(v) || (f && f > day) || (r.to_date && String(r.to_date) < day)) return;
      if (!best || f >= best.f) best = { f: f, v: v };
    });
    return best ? best.v : new URL('../', location.href).href;
  }
  save.TABLES.qr_tag = { label: 'QR codes', file: 'BLD-qr_tag.csv', fields: { tag: { type: 'text', required: true, label: 'Tag' }, kind: { type: 'enum', values: ['area', 'subject', 'litter', 'site', 'thermometer', 'item'], required: true, label: 'Kind' }, ref_id: { type: 'text', required: true, label: 'Refers to' } } };
  save.TABLES.breeding_rule = { label: 'Owner settings', file: 'BLD-breeding_rule.csv', fields: { rule_key: { type: 'text', required: true, label: 'Setting' }, value: { type: 'text', required: true, label: 'Value' }, effective_from: { type: 'date', required: true, label: 'From' }, source: { type: 'text', label: 'Source' } } };   // item card fields choice (print.fields.item), owner only
  save.TABLES.thermometer = { label: 'Thermometers', file: 'BLD-thermometer.csv', fields: { name: { type: 'text', required: true, label: 'Name' }, area_id: { type: 'text', required: true, label: 'Room' } } };   // the save checks the room exists
  function h(t, a, k) { var e = document.createElement(t); Object.keys(a || {}).forEach(function (x) { if (x === 'text') e.textContent = a[x]; else if (x === 'class') e.className = a[x]; else if (x === 'html') e.innerHTML = a[x]; else if (x.slice(0, 2) === 'on') e.addEventListener(x.slice(2), a[x]); else e.setAttribute(x, a[x]); }); (k || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }); return e; }
  /* tags and which tag an item already has: the one shared helper (staff/lib/qr-rules.js), also used by the back-fill tool */
  function newTag() { var taken = {}; (T && T.qr_tag || []).forEach(function (t) { taken[t.tag] = 1; }); return BLDQrRules.newTag(taken, function (n) { var a = new Uint8Array(n); crypto.getRandomValues(a); return a; }); }
  function say(t, k) { msg.className = 'msg noprint ' + (k || ''); msg.textContent = t; }   // noprint kept: the status line never prints
  var msg = h('p', { class: 'msg noprint', role: 'status' });
  screen.appendChild(h('h1', { class: 'noprint', text: 'Print QR cards' }));
  var code = ''; try { code = localStorage.getItem(CODE_KEY) || ''; } catch (e) { /* no storage */ }
  // Board A (Lisa 17 Nov 2026): an owner signed in to CD Hub on this browser needs no code; the save address CD Hub keeps is used.
  var owner = BLDSave.ownerToken ? BLDSave.ownerToken() : '';
  if (!save.getScriptUrlSet() && owner) { ['cdhub.sink.url', 'cdhub.save.url'].some(function (k) { var u = ''; try { u = localStorage.getItem(k) || ''; } catch (e) { u = ''; } return u && save.setScriptUrl(u, true).ok; }); }
  if (!save.getScriptUrlSet() || (!code && !owner)) { screen.appendChild(h('p', { class: 'sub', text: owner ? 'The save address is not on this phone yet. Open CD Hub while signed in, then open this page again. An owner is not asked for a staff code.' : 'Sign in to CD Hub on this device as the owner (or set it up on the staff page with an owner code), then open this page again.' })); return; }
  if (code) save.setCode(code, false);
  screen.appendChild(h('p', { class: 'sub noprint', text: 'Each code holds only a random id. Printing again reuses the same codes.' }));
  var opts = h('div', { class: 'opts noprint' }), sheet = h('div', { class: 'sheet' }), pick = h('div', { class: 'pick noprint' }), pickBox = h('div', { class: 'noprint' });
  screen.appendChild(opts); screen.appendChild(pickBox); screen.appendChild(pick); screen.appendChild(msg); screen.appendChild(sheet);
  /* Lists, read only when a card type needs them (Lisa's demo, 22 Nov 2026: the page sat on "Loading..." for minutes while
     21 script calls ran one after another). The buttons show at once; each button reads only its lists, four at a time,
     and keeps them for this visit; "as of" says when, Refresh reads again. Lists marked optional may be off for this code. */
  var T = {}, readAt = 0;
  var REQUIRED = { area: 1, subject: 1, occupancy: 1, qr_tag: 1 };
  var BASE = ['qr_tag', 'breeding_rule'], SITE = ['area', 'subject', 'occupancy', 'subject_status', 'requirement'];
  var NEEDS = {
    site: BASE,
    rooms: BASE.concat(['area', 'requirement', 'area_capacity', 'area_access', 'check_type']),
    dogs: BASE.concat(SITE, ['area_capacity', 'area_access', 'weight', 'links', 'files', 'microchip', 'coat_colour', 'coat_pattern', 'nose_pigment', 'check_type']),
    litters: BASE.concat(SITE, ['litter', 'coat_colour', 'coat_pattern', 'nose_pigment', 'check_type']),
    thermo: BASE.concat(['thermometer', 'requirement', 'area']),
    items: BASE.concat(['items', 'item_kinds', 'links', 'files'])   /* item cards (print any item, Lisa 15 Nov 2026) */
  };
  /* a save needs the script's status (is saving on?): asked once, only when a code or thermometer is to be saved, never
     before the buttons show (the status call also runs the script's waiting room moves, which can be slow) */
  var statusP = null, rawSubmit = save.submit;
  save.submit = function (table, fields) { statusP = statusP || save.checkStatus(); return statusP.then(function () { return rawSubmit(table, fields); }); };
  var asOf = h('p', { class: 'mut noprint', 'data-print-asof': '' });
  function hhmm(t) { var d = new Date(t); return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); }
  function showAsOf() {
    asOf.textContent = '';
    if (!readAt) return;
    asOf.appendChild(document.createTextNode('Lists as of ' + hhmm(readAt) + ' '));
    asOf.appendChild(h('button', { class: 'btn quiet', type: 'button', text: 'Refresh', 'data-print-refresh': '', onclick: function () { T = {}; readAt = 0; showAsOf(); say('Lists will be read again when you choose a card.'); } }));
  }
  function need(what) {
    var keys = NEEDS[what].filter(function (k, i, a) { return a.indexOf(k) === i && !(k in T); });
    if (!keys.length) return Promise.resolve(true);
    var left = keys.slice(), done = 0, fail = null;
    say('Loading ' + keys.length + ' list' + (keys.length === 1 ? '' : 's') + '...');
    function worker() {
      if (!left.length || fail) return Promise.resolve();
      var k = left.shift();
      return save.read(k).then(function (r) {
        if (r.ok) T[k] = r.rows || [];
        else if (!REQUIRED[k] && (r.code === 'NOT_ALLOWED' || r.code === 'FILE_MISSING' || r.code === 'FILE_NOT_ALLOWED')) T[k] = [];   /* owner-only or not switched on: the card leaves those lines out */
        else fail = fail || r;
        done++; if (!fail) say('Loading lists: ' + done + ' of ' + keys.length + '...');
        return worker();
      });
    }
    return Promise.all([worker(), worker(), worker(), worker()]).then(function () {
      if (fail) {
        var said = fail.message || 'Could not load the lists.';
        if (save.usingGoogle && save.usingGoogle() && (fail.code === 'NO_CODE' || /staff code/i.test(said))) said = 'Sign in again on CD Hub, then open this page. An owner is not asked for a staff code.';
        say(said, 'bad'); return false;
      }
      readAt = Date.now(); showAsOf(); say(''); return true;
    });
  }
  function siteMaps() {
    var onSite = {}, roomOf = {};
    BLDOccupancy.dailyList(T).dogs.forEach(function (d) { onSite[d.id] = true; if (d.known && !d.out && d.areaLabel) roomOf[d.id] = d.areaLabel; });   // same list as The Board: not dogs that have left
    return { onSite: onSite, roomOf: roomOf };
  }
  /** A button that reads what its cards need, then draws them. */
  function lazy(text, what, fn) { return btn(text, function () { need(what).then(function (ok) { if (ok) fn(); }); }); }
  function current(kind, refId) { return BLDQrRules.tagFor(T.qr_tag, kind, refId); }
  function card(tag, title, big, room) { return h('div', { class: 'qcard' + (big ? ' big' : '') }, [h('div', { html: BLDQr.svg(qrBase() + '#s/' + tag, 'QR code for ' + title) }), h('b', { text: title })].concat(room ? [h('span', { class: 'room', 'data-room': room, text: room })] : []).concat([h('small', { text: tag })])); }
  var makeGen = 0, tagSave = {};
  function make(kind, items, draw, done) {
    var gen = ++makeGen, seenId = {}, list = [];
    items.forEach(function (it) { if (!it || seenId[it.id]) return; seenId[it.id] = 1; list.push(it); });
    items = list;
    sheet.textContent = '';
    if (kind !== 'item') pickBox.textContent = '';   // the item field picker shows with item cards only
    var missing = items.filter(function (it) { return !current(kind, it.id); }), i = 0, failed = '';
    // 15 Nov 2026 (Lisa): printing never shows a code that is not saved. New codes need an owner code, so say so before trying.
    var role = typeof save.role === 'function' ? save.role() : '';
    if (missing.length && role && role !== 'OWNER' && !(save.usingGoogle && save.usingGoogle())) {
      say('Not printed. ' + missing.length + ' new code' + (missing.length === 1 ? '' : 's') + ' must be saved first, and only an owner code can save them. This device has a ' + role.toLowerCase() + ' code: set it up again on the staff page with your owner code.', 'bad');
      if (done) done();
      return;
    }
    (function next() {
      if (gen !== makeGen) return;
      if (i < missing.length && !failed) {
        var it = missing[i];
        if (current(kind, it.id)) { i++; next(); return; }
        var key = kind + '\0' + it.id;
        if (tagSave[key]) { tagSave[key].then(function () { next(); }); return; }
        say('Making code ' + (i + 1) + ' of ' + missing.length + '...');
        var tag = newTag();
        tagSave[key] = save.submit('qr_tag', { tag: tag, kind: kind, ref_id: it.id }).then(function (r) {
          delete tagSave[key];
          if (r.ok) { if (!current(kind, it.id)) T.qr_tag.push({ tag: tag, kind: kind, ref_id: it.id, active: 'true' }); }
          if (gen !== makeGen) return;
          if (!r.ok) failed = r.message;
          i++;
          next();
        });
        return;
      }
      if (gen !== makeGen) return;
      sheet.textContent = '';
      var seen = {};
      // only codes already saved are drawn (a code whose save failed is never shown); the rest are named as not printed
      items.forEach(function (it) {
        if (seen[it.id]) return;
        seen[it.id] = 1;
        var t = current(kind, it.id);
        if (t) sheet.appendChild(draw ? draw(t.tag, it) : card(t.tag, it.label, kind === 'area', it.room));
      });
      var left = items.filter(function (it) { return !current(kind, it.id); }).length;
      say(failed ? ('Not printed: ' + left + ' card' + (left === 1 ? '' : 's') + ', because ' + failed.charAt(0).toLowerCase() + failed.slice(1) + ' ' + sheet.children.length + ' saved card' + (sheet.children.length === 1 ? ' is' : 's are') + ' below.')
        : (sheet.children.length + ' cards ready. Use your browser’s Print.'), failed ? 'bad' : 'good');
      if (done) done();
    }());
  }
  /* Pick which cards print (Lisa 22 Nov 2026): one tick box per card, all ticked to start (or only the ids in `only`),
     Select all / Unselect all. Only ticked cards are drawn and printed, and only they can get a new code saved; the list is
     locked while codes save. Nothing ticked: nothing is drawn and the page says so. Shared list: lib/pick-list.js. */
  function pickThen(kind, items, draw, only) {
    var list = BLDPick.create(pick, items, { only: only, onChange: show });
    function show(sel) {
      if (!sel.length) { makeGen++; sheet.textContent = ''; say('Nothing ticked, so nothing will print. Tick a card, or press Select all.', 'warn'); return; }
      list.setBusy(true);
      make(kind, sel, draw, function () { list.setBusy(false); });
    }
    show(list.selected());
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
  /* Lisa 21 Nov 2026: a pup under puppy.under_weeks old on the print day prints in the size_colour.puppy colour, not its size
     colour (the owner's dated rule rows; the newest in force wins). No date of birth, or no rows: the size colour. */
  function colourVar(c) { return /^([a-z]+|#[0-9a-f]{3,6})$/i.test(c || '') ? 'var(--sz-' + c.replace('#', 'x') + ', ' + c + ')' : ''; }
  function isPup(s) {
    var wk = parseFloat(ruleNow('puppy.under_weeks')), b = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s.dob || '')), t = /^(\d{4})-(\d{2})-(\d{2})/.exec(BLDNeeds.today());
    if (!(wk > 0) || !b || !t) return false;
    var days = (Date.UTC(+t[1], +t[2] - 1, +t[3]) - Date.UTC(+b[1], +b[2] - 1, +b[3])) / 864e5;
    return days >= 0 && days < wk * 7;
  }
  function dogColour(s, sz) { return (isPup(s) && colourVar(ruleNow('size_colour.puppy'))) || sizeColour(sz); }
  /* what a pup's Size tile says: the owner's dated puppy.size_tile row, "size" (Small/Medium/Large, the default) or "puppy" */
  function tileWord(s, sz) { return isPup(s) && /^puppy$/i.test(ruleNow('puppy.size_tile')) ? 'Puppy' : sizeWord(sz); }
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
  /* the main photo is the open main link (staff/lib/photos.js). The old photo cell is used only when there is no open main, and never when that file has ended. */
  function mainPhoto(s, table) {
    var ph = BLDPhotos.forRecord(T.links || [], T.files || [], T.breeding_rule || [], table || 'subjects', s.id, BLDNeeds.today());
    var m = ph.main && photoId(ph.main.drive_file_id);
    if (m) return m;
    var cell = photoId(s.photo);
    if (!cell) return '';
    var ended = (ph.ended || []).some(function (f) { return photoId(f.drive_file_id) === cell; });
    return ended ? '' : cell;
  }
  /* Lisa 22 Nov 2026: no photo on any card. Chrome now blocks Google's cookies on other sites, so the plain Drive thumbnail
     address (which needs them) fails. With the CD Hub Google sign-in on this browser, the page asks Drive for the photo the
     way the hub does: the file's thumbnail link with that sign-in, else the picture itself. No sign-in: the plain address. */
  var DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files/';
  function driveToken() {
    try {
      var saved = window.DashAuth && DashAuth.valid(), scope = window.DASH_CONFIG && DASH_CONFIG.scopes && DASH_CONFIG.scopes.read;
      return saved && scope && DashAuth.hasScope(saved, scope) ? saved.access_token : '';
    } catch (e) { return ''; }
  }
  function loadPhoto(img, id, fail) {
    var tok = driveToken(), auth = { headers: { Authorization: 'Bearer ' + tok } }, tried = false;
    if (!tok) { img.onerror = fail; img.src = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(id) + '&sz=w800'; return; }
    function bytes() {
      if (tried) { fail(); return; }
      tried = true;
      fetch(DRIVE_FILES + encodeURIComponent(id) + '?alt=media&supportsAllDrives=true', auth)
        .then(function (r) { if (!r.ok) throw new Error('photo'); return r.blob(); })
        .then(function (b) { if (!/^image\//.test(b.type || '')) throw new Error('photo'); img.src = URL.createObjectURL(b); })
        .catch(fail);
    }
    img.onerror = bytes;
    fetch(DRIVE_FILES + encodeURIComponent(id) + '?fields=thumbnailLink&supportsAllDrives=true', auth)
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (m) { var link = m && m.thumbnailLink; if (link && /^https:\/\//i.test(link)) img.src = link.replace(/=s\d+$/, '=s800'); else bytes(); })
      .catch(bytes);
  }
  /* the photo as saved (the hub's crop step saves a square); printing never crops it again: it is fitted whole (contain).
     No photo, or one that fails to load: the size-colour frame stays and is left blank (no placeholder word on paper) */
  function photoBox(s, table) {
    var id = mainPhoto(s, table), box = h('div', { class: 'photo' + (id ? '' : ' none'), 'data-k': 'photo' });
    if (id) {
      var img = h('img', { alt: '', referrerpolicy: 'no-referrer' });
      box.appendChild(img);
      loadPhoto(img, id, function () { box.textContent = ''; box.classList.add('none'); });
    }
    return box; }
  /* Lisa's dog card, her APPROVED v4 design (15 Nov 2026, re-confirmed 20 Nov 18:26): name large top-left with no label; Sex (with
     its sign) and Date of birth labelled top-right; the photo left in a thick frame of the size colour, fitted whole (contain);
     on the right a "Size" tile top-aligned with the photo and a 62 mm QR bottom-aligned with it; the microchip labelled across
     the bottom in groups of three. No room, access, tag text or preview labels. Two per A4 with a dashed cut line. */
  /* the QR's black squares, not its white border, are the printed size: --qz is the whole code over its squares (the white
     quiet zone is 4 squares a side), so 2 per A4 prints 62 mm of squares with the quiet zone round them on the white card */
  function qrBox(url, label) {
    var svg = BLDQr.svg(url, label), m = /viewBox="0 0 (\d+) /.exec(svg), n = m ? +m[1] : 0;
    return h('div', { class: 'code', html: svg, style: n > 8 ? '--qz:' + (n / (n - 8)).toFixed(4) : '' });
  }
  /* a long name steps down a size so it stays on two lines at most */
  function nameFit(name) { var n = String(name).length; return n > 28 ? ' n3' : n > 16 ? ' n2' : ''; }
  function cardName(s) {
    var n = s.name || s.id;
    if (typeof BLDDisplay === 'undefined' || !BLDDisplay.marblePupName) return n;
    var young = isPup(s) || !!s.birth_litter_id;
    if (s.birth_litter_id && s.dob) {
      var wk = 26, born = Date.parse(String(s.dob).slice(0, 10) + 'T12:00:00Z'), today = Date.parse(BLDNeeds.today() + 'T12:00:00Z');
      if (!isNaN(born) && !isNaN(today) && (today - born) / 864e5 >= wk * 7) young = false;
    }
    if (!young) return n;
    return BLDDisplay.marblePupName(n, '') || n;
  }
  function dogCard(tag, it) {
    var s = it.s, sz = sizeOfDog(s), col = dogColour(s, sz), chip = chipOf(s), f = /^f/i.test(s.sex || ''), m = /^m/i.test(s.sex || ''), nm = cardName(s);
    var facts = [];
    if (f || m) facts.push(h('div', { 'data-k': 'sex' }, [h('dt', { text: 'Sex' }), h('dd', {}, [sexIcon(s.sex), f ? 'Female' : 'Male'])]));
    if (s.dob) facts.push(h('div', { 'data-k': 'dob' }, [h('dt', { text: 'Date of birth' }), h('dd', { text: dmy(s.dob) })]));
    return h('article', { class: 'dcard vcard', 'data-dog': s.id, style: col ? '--c:' + col : '' }, [
      h('h2', { class: 'name' + nameFit(nm), text: nm }),
      h('dl', { class: 'facts' }, facts),
      photoBox(s),
      (function (w) { return w ? h('div', { class: 'szb', 'data-size': sz || 'puppy', 'data-k': 'size' }, [h('span', { class: 'lab', text: 'Size' }), h('b', { text: w })]) : null; })(tileWord(s, sz)),
      qrBox(qrBase() + '#s/' + tag, 'QR code for ' + (s.name || s.id)),
      chip ? h('div', { class: 'chipline', 'data-k': 'chip' }, [h('span', { text: 'Microchip' }), h('b', { text: chip })]) : null]);
  }
  /* Item cards (print any item, Lisa 15 Nov 2026): one card layout for any BLD-items row, e.g. a fire extinguisher. The fields
     that print are the owner's dated rule row print.fields.item.<kind_key> or print.fields.item (column names joined by |),
     newest in force wins; without one, ITEM_FIELDS. Every value prints under its label (the owner's print.label.<column> row,
     else ITEM_LABELS); the item name is the only value with no label. A choice made here is saved as a new dated rule row. */
  var ITEM_COLS = ['item_no', 'kind_key', 'make', 'model', 'serial_no', 'size', 'made_on', 'expires_on', 'note'];
  var ITEM_FIELDS = ['item_no', 'kind_key', 'make', 'model', 'serial_no', 'expires_on'];
  var ITEM_LABELS = { item_no: 'Item number', kind_key: 'Type', make: 'Make', model: 'Model', serial_no: 'Serial number', size: 'Size',
    made_on: 'Made on', expires_on: 'Expires on', note: 'Note' };
  function ruleNow(key) {
    var best = null, today = BLDNeeds.today();
    (T.breeding_rule || []).forEach(function (r) { var f = String(r.effective_from || '').slice(0, 10), t = String(r.to_date || '').slice(0, 10);
      if (r.rule_key !== key || !String(r.value || '').trim() || (f && f > today) || (t && t < today)) return;
      if (!best || f >= String(best.effective_from || '').slice(0, 10)) best = r; });
    return best ? String(best.value).trim() : '';
  }
  function itemFields(kindKey) {
    var v = (kindKey && ruleNow('print.fields.item.' + kindKey)) || ruleNow('print.fields.item');
    var cols = v ? v.split('|').map(function (c) { return c.trim(); }).filter(function (c) { return ITEM_COLS.indexOf(c) >= 0; }) : [];
    return cols.length ? cols : ITEM_FIELDS.slice();
  }
  function itemLabel(col) { return ruleNow('print.label.' + col).slice(0, 30) || ITEM_LABELS[col] || col; }
  function itemValue(col, r) {
    var v = String(r[col] == null ? '' : r[col]).trim();
    if (col === 'kind_key') { var k = (T.item_kinds || []).filter(function (x) { return x.kind_key === v; }).pop(); return k && k.label ? k.label : v; }
    if (/_on$/.test(col)) return dmy(v) || v;
    return v;
  }
  /* one card per item: the latest row of each item (a correction row, corrects_id, replaces the first); its QR is the first row's */
  function itemList() {
    var latest = {};
    (T.items || []).forEach(function (r) { var first = r.corrects_id || r.id; if (first) latest[first] = r; });
    return Object.keys(latest).map(function (id) { var r = latest[id]; return { id: id, label: r.name || r.item_no || id, r: r }; })
      .sort(function (a, b) { return String(a.r.item_no || a.label).localeCompare(String(b.r.item_no || b.label), 'en', { numeric: true }); });
  }
  var itemPick = null;   // columns chosen on this page for this print (null = the owner's rule rows)
  function itemCard(tag, it) {
    var r = it.r, cols = itemPick || itemFields(r.kind_key), facts = [];
    cols.forEach(function (c) { var v = itemValue(c, r); if (v) facts.push(h('div', { 'data-k': c }, [h('dt', { text: itemLabel(c) }), h('dd', { text: v })])); });
    return h('article', { class: 'dcard vcard icard', 'data-item': it.id }, [
      h('h2', { class: 'name' + nameFit(it.label), text: it.label }),
      h('dl', { class: 'facts' }, facts),
      photoBox({ id: it.id, photo: r.photo }, 'items'),
      qrBox(qrBase() + '#s/' + tag, 'QR code for ' + it.label)]);
  }
  function itemCards() {
    sheet.className = 'sheet dogs per' + per;
    make('item', itemList(), itemCard);
    pickBox.textContent = '';
    var boxes = ITEM_COLS.map(function (c) { var on = (itemPick || itemFields('')).indexOf(c) >= 0;
      return h('label', { class: 'fpick' }, [h('input', Object.assign({ type: 'checkbox', value: c }, on ? { checked: 'checked' } : {})), ' ' + itemLabel(c)]); });
    var use = btn('Use these fields', function () {
      itemPick = boxes.map(function (b) { return b.firstChild; }).filter(function (i) { return i.checked; }).map(function (i) { return i.value; });
      if (!itemPick.length) itemPick = null;
      make('item', itemList(), itemCard);
    });
    var keep = btn('Save as the usual fields', function () {
      var cols = boxes.map(function (b) { return b.firstChild; }).filter(function (i) { return i.checked; }).map(function (i) { return i.value; });
      if (!cols.length) { say('Tick at least one field.', 'bad'); return; }
      var row = { rule_key: 'print.fields.item', value: cols.join('|'), effective_from: BLDNeeds.today(), source: 'CD Hub print page' };
      save.submit('breeding_rule', row).then(function (res) {
        if (res.ok) { T.breeding_rule.push(row); itemPick = null; make('item', itemList(), itemCard); say('Saved. Item cards print these fields from today.', 'good'); }
        else say('Not saved: ' + (res.message || 'the save did not go through.') + ' These fields are used for this print only.', 'bad');
      });
    });
    pickBox.appendChild(h('fieldset', { class: 'picks' }, [h('legend', { text: 'Fields on item cards' })].concat(boxes, [use, keep])));
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
        h('div', { class: 'cside' }, [h('div', { class: 'photo none', 'data-k': 'photo' }),   // the frame, blank: no placeholder word on paper
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
  /* The room card's limits: the flap setting and capacity rows in force today, by the shared rule in capacity.js
     (accessOn / limitsOn, LD-SC audit 15 Nov 2026). Mum + pups: the "+ pups" rows in force for that setting. */
  function limitsOf(areaId) {
    var day = BLDNeeds.today(), acc = BLDCapacity.accessOn(T.area_access || [], areaId, day), out = { access: acc, any: false, dogs: { small: 0, medium: 0, large: 0 }, pups: [] };
    if (!acc) return out;
    var mine = (T.area_capacity || []).filter(function (r) { return r.area_id === areaId && String(r.access_type || '').toLowerCase() === acc && inForceOn(r, day); });
    out.any = mine.length > 0;
    BLDCapacity.limitsOn(T.area_capacity || [], areaId, acc, day).forEach(function (l) { out.dogs[l.band] = l.n; });
    var pups = {};
    mine.forEach(function (r) { var k = sizeKey(r.size_band); if (k && /pups/i.test(r.size_band || '') && (!pups[k] || fromOf(r) >= pups[k].f)) pups[k] = { f: fromOf(r), n: parseInt(r.max_dogs, 10) || 0 }; });
    ['small', 'medium', 'large'].forEach(function (k) { if (pups[k] && pups[k].n > 0) out.pups.push(k); });
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
  function beginPrint() { makeGen++; sheet.textContent = ''; }
  function btn(text, fn) { return h('button', { class: 'btn', type: 'button', text: text, onclick: function () { BLDPick.clear(pick); beginPrint(); fn(); } }); }
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
    pickThen('thermometer', T.thermometer.filter(function (t) { var end = BLDNeeds.endDay(T.requirement, 'reading.temperature', 'thermometer', t.id); return !end || end >= today; })
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
  (function () {
    screen.insertBefore(asOf, msg);
    function roomItems() { return T.area.filter(function (a) { return BLDOccupancy.inUse(a, BLDNeeds.today(), T.requirement) && !/^ZZ_/.test(a.code || ''); }).map(function (a) { return { id: a.id, label: a.code || a.id, a: a }; }); }
    opts.appendChild(lazy('Whole-site code', 'site', function () { sheet.className = 'sheet per' + per; make('site', [{ id: 'site', label: 'Whole site' }]); }));
    opts.appendChild(lazy('Room cards', 'rooms', function () { sheet.className = 'sheet rooms'; pickThen('area', roomItems(), roomCard); }));
    opts.appendChild(lazy('Dog cards', 'dogs', function () { var m = siteMaps(), onSite = m.onSite, roomOf = m.roomOf; sheet.className = 'sheet dogs per' + per; pickThen('subject', T.subject.filter(function (s) { return onSite[s.id]; }).map(function (s) { return { id: s.id, label: s.name || s.id, room: roomOf[s.id] || '', s: s }; }), dogCard); }));
    var perBox = h('span', { class: 'per', role: 'group', 'aria-label': 'Cards per A4' }, [1, 2, 4].map(function (n) {
      return h('button', { class: 'btn quiet', type: 'button', 'aria-pressed': String(n === per), text: n === 1 ? 'Full A4' : n + ' per A4', onclick: function () {
        per = n; Array.prototype.forEach.call(perBox.children, function (b, i) { b.setAttribute('aria-pressed', String([1, 2, 4][i] === per)); });
        if (/\bdogs\b/.test(sheet.className)) sheet.className = sheet.className.replace(/\bper\d\b/, 'per' + per);
        else if (/\bper\d\b/.test(sheet.className)) sheet.className = 'sheet per' + per; } });
    }));
    opts.appendChild(perBox);
    opts.appendChild(lazy('Litter cards', 'litters', function () {
      var m = siteMaps(), onSite = m.onSite, roomOf = m.roomOf;
      if (!(T.litter || []).length) { sheet.className = 'sheet'; say('The litter list is not switched on yet.', 'warn'); return; }
      var subj = {}, pups = {}, pupsHere = {};
      T.subject.forEach(function (s) { subj[s.id] = s; if (s.birth_litter_id) { pups[s.birth_litter_id] = (pups[s.birth_litter_id] || 0) + 1; if (onSite[s.id]) pupsHere[s.birth_litter_id] = true; } });
      /* litters still here: a pup on site, or the dam on site with no pups entered yet. No date cut-off. */
      var list = T.litter.filter(function (l) { return pupsHere[l.id] || (!pups[l.id] && onSite[l.dam_subject_id]); })
        .sort(function (a, b) { return String(b.born_on || b.dob || '').localeCompare(String(a.born_on || a.dob || '')); });
      if (!list.length) { sheet.className = 'sheet'; sheet.textContent = ''; say('No litters on site.', 'warn'); return; }
      sheet.className = 'sheet dogs litters per' + per;
      pickThen('litter', list.map(function (l) { var dam = subj[l.dam_subject_id] || {}, sire = subj[l.sire_subject_id] || {};
        return { id: l.id, label: 'Litter of ' + (dam.name || l.id), l: l, dam: dam, sire: sire.name || '', pups: pups[l.id] || 0, room: roomOf[l.dam_subject_id] || '' }; }), litterCard);
    }));
    opts.appendChild(lazy('Item cards', 'items', itemCards));
    opts.appendChild(lazy('Thermometer cards', 'thermo', thermoCards));
    opts.appendChild(lazy('Add thermometer', 'thermo', addThermometer));
    opts.appendChild(lazy('Phone set-up QR', 'site', function () { sheet.className = 'sheet';
      var url = ''; try { url = localStorage.getItem('bld.scriptUrl') || ''; } catch (e) { /* none */ }
      sheet.textContent = '';
      sheet.appendChild(h('div', { class: 'qcard big' }, [h('div', { html: BLDQr.svg(qrBase() + '#setup=' + encodeURIComponent(url), 'Phone set-up QR') }), h('b', { text: 'Set up a phone' }), h('small', { text: 'Show on screen. Do not pin up or photograph.' })]));
      say('Staff scan this once, then type their own code.', 'good');
    }));
    opts.appendChild(lazy('Private set-up QR', 'site', privateQr));   /* both QRs use the owner's qr.base_url row */
    var add = ''; try { add = new URLSearchParams(location.search).get('add') || ''; } catch (e) { /* old browser */ }
    if (add === 'thermometer') need('thermo').then(function (ok) { if (ok) addThermometer(); });   // from the hub's "+ Thermometer"
    /* from a room's "Print sign" in CD Hub (?sign=<area id>, 21 Nov 2026): the room list with only that room ticked, its card ready to print */
    var sign = ''; try { sign = new URLSearchParams(location.search).get('sign') || ''; } catch (e) { /* old browser */ }
    if (sign) need('rooms').then(function (ok) {
      if (!ok) return;
      var signRoom = T.area.filter(function (a) { return a.id === sign; })[0];
      if (!signRoom) { say('That room is not on the list. Press Room cards to print them all.', 'warn'); return; }
      var rooms = roomItems(); if (!rooms.some(function (r) { return r.id === signRoom.id; })) rooms.unshift({ id: signRoom.id, label: signRoom.code || signRoom.id, a: signRoom });
      sheet.className = 'sheet rooms'; pickThen('area', rooms, roomCard, [signRoom.id]);
    });
  }());
}());
