/*!
 * Inspector page (Breed Better, spec S10). Read-only, time-boxed, no sign-in.
 *
 * The link Lisa copies from her owner screen is  .../cdhub/staff/inspect/#s=<script id>&c=<code>.
 * Both sit after the #, so they are never sent to any server or kept in its logs. This page takes them,
 * clears them from the address bar at once, and keeps them in memory only: nothing goes in localStorage,
 * sessionStorage or cookies. Closing the tab forgets the link.
 *
 * The script decides everything: which dogs (the link's ticked dogs), which columns (the link's ticked fields),
 * and when the link ends. This page only shows what comes back. It never asks for scores; the script refuses
 * score lists to inspector codes anyway. Dates read like 2 Mar 2026.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDInspect = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* The lists, in the order they show under each dog, and the column that names the dog in each. */
  var LISTS = [
    { key: 'microchip', title: 'Microchip', dog: 'subject_id', date: '' },
    { key: 'subject_status', title: 'Status', dog: 'subject_id', date: 'from_date' },
    { key: 'health_screen', title: 'Health tests', dog: 'subject_id', date: 'tested_on' },
    { key: 'fit_to_breed', title: 'Fit to Breed', dog: 'subject_id', date: 'assessed_on|done_on' },   // done_on: a job record (15 Nov 2026)
    { key: 'litter', title: 'Litters', dog: 'dam_subject_id', date: 'dob' }
  ];
  /* Lists about rooms, not dogs (demo 3b, 18 Nov 2026): every room's temperature log, a card per room, newest first. */
  var ROOMS = [
    { key: 'area_reading', title: 'Temperatures', room: 'room', date: 'period_start|taken_at' }
  ];
  var HIDE = { id: 1, subject_id: 1, dam_subject_id: 1, tenant_id: 1, area_id: 1, room: 1 };
  /* plain names for the temperature columns; any other column shows its own name */
  var SAYCOL = { period_start: 'For', taken_at: 'Taken', taken_by: 'By', min_c: 'Min °C', max_c: 'Max °C', spot_c: 'Now °C', mitigation_note: 'Action' };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function day(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
    return m ? (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] : String(v || '');
  }
  function words(col) {
    if (SAYCOL[col]) return SAYCOL[col];
    var s = String(col).replace(/_/g, ' ');
    if (s === 'dob') return 'DOB';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  /* the first date column a row has, of those named by | */
  function dateOf(r, cols) { var c = String(cols || '').split('|').filter(function (k) { return r[k]; })[0]; return c ? r[c] : ''; }
  function isDateCol(c) { return /(^dob$|_on$|_date$|_until$)/.test(c); }
  /* a moment (taken_at, period_start): its London day and time, e.g. 2 Mar 2026 07:00 */
  function isTimeCol(c) { return /(_at$|^period_start$)/.test(c); }
  function when(v) {
    var d = new Date(String(v || ''));
    if (!/T\d\d:\d\d/.test(String(v || '')) || isNaN(d.getTime())) return day(v);   // a date with no time stays a date
    var p = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    return day(p.year + '-' + p.month + '-' + p.day) + ' ' + p.hour + ':' + p.minute;
  }
  function show(c, v) {
    if (v === undefined || v === null || v === '') return '';
    return isTimeCol(c) ? when(v) : isDateCol(c) ? day(v) : String(v);
  }

  /** Read the link from the address. Returns {script, code} or null. */
  function parseHash(hash) {
    var p = {};
    String(hash || '').replace(/^#/, '').split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) { try { p[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); } catch (e) { /* ignore */ } }
    });
    if (!/^[A-Za-z0-9_\-]{10,}$/.test(p.s || '') || !/^[A-Z2-9]{16}$/.test(p.c || '')) return null;
    return { script: 'https://script.google.com/macros/s/' + p.s + '/exec', code: p.c };
  }

  /** Group what came back by dog: [{dog, lists:[{title, fields, rows}]}], dogs A to Z. Pure, for tests. */
  function build(res) {
    var dogs = (res.subject && res.subject.rows) || [];
    var subFields = ((res.subject && res.subject.fields) || []).filter(function (c) { return !HIDE[c] && c !== 'name'; });
    return dogs.slice().sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); }).map(function (d) {
      return {
        name: d.name || 'Dog',
        facts: subFields.filter(function (c) { return d[c] !== undefined && d[c] !== ''; }).map(function (c) { return words(c) + ' ' + show(c, d[c]); }),
        lists: LISTS.filter(function (L) { return res[L.key] && res[L.key].rows; }).map(function (L) {
          var fields = res[L.key].fields.filter(function (c) { return !HIDE[c]; });
          var rows = res[L.key].rows.filter(function (r) { return r[L.dog] === d.id; })
            .sort(function (a, b) { return String(dateOf(b, L.date)).localeCompare(String(dateOf(a, L.date))); });
          return { title: L.title, rows: rows.map(function (r) { return fields.map(function (c) { return { label: words(c), value: show(c, r[c]) }; }); }) };
        }).filter(function (l) { return l.rows.length; })
      };
    });
  }

  /** Group the room lists by room: [{name, lists:[{title, rows}]}], rooms A to Z, readings newest first. Pure, for tests. */
  function buildRooms(res) {
    var by = {};
    ROOMS.forEach(function (L) {
      if (!res[L.key] || !res[L.key].rows) return;
      var fields = res[L.key].fields.filter(function (c) { return !HIDE[c]; });
      res[L.key].rows.forEach(function (r) {
        var name = r[L.room] || 'Room';
        var room = by[name] || (by[name] = { name: name, lists: {} });
        (room.lists[L.title] || (room.lists[L.title] = { title: L.title, date: L.date, fields: fields, rows: [] })).rows.push(r);
      });
    });
    return Object.keys(by).sort(function (a, b) { return a.localeCompare(b, 'en', { numeric: true }); }).map(function (n) {
      return {
        name: n,
        lists: Object.keys(by[n].lists).map(function (t) {
          var l = by[n].lists[t];
          return { title: t, rows: l.rows.slice().sort(function (a, b) { return String(dateOf(b, l.date)).localeCompare(String(dateOf(a, l.date))); })
            .map(function (r) { return l.fields.map(function (c) { return { label: words(c), value: show(c, r[c]) }; }); }) };
        })
      };
    });
  }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  /* the save app's own words for the codes an inspector can meet (PR 442) */
  var SAY = {
    BAD_CODE: 'This link has ended. Ask the breeder for a new one if you still need it.',
    READ_NOT_CONFIGURED: 'These records are not set up for sharing yet. Ask the breeder.',
    LOG_FAILED: 'These records cannot be shown right now. Try again in a moment.',
    READ_OFF: 'Sharing is switched off at the moment. Ask the breeder.',
    NETWORK: 'Could not reach the records. Check the connection and try again.'
  };

  function render(screen, res, ends, notShared) {
    screen.textContent = '';
    screen.appendChild(el('h1', '', 'Breeding records'));
    if (ends) screen.appendChild(el('p', 'ins-ends', 'Read only. This link ends ' + day(ends) + '.'));
    var dogs = build(res), rooms = buildRooms(res);
    if (notShared && notShared.length) screen.appendChild(el('p', 'ins-ends ins-not', 'Not shared on this link: ' + notShared.join(', ') + '.'));
    if (!dogs.length && !rooms.length) { screen.appendChild(el('p', 'sub', 'No records have been shared on this link.')); return; }
    function listBox(l) {
      var box = el('div', 'ins-list');
      box.appendChild(el('h3', '', l.title));
      l.rows.forEach(function (cells) {
        var row = el('div', 'ins-row');
        cells.forEach(function (c) { if (c.value === '') return; var s = el('span'); s.appendChild(el('b', '', c.label + ' ')); s.appendChild(document.createTextNode(c.value)); row.appendChild(s); });
        box.appendChild(row);
      });
      return box;
    }
    rooms.forEach(function (r) {
      var card = el('section', 'ins-dog ins-room');
      card.appendChild(el('h2', '', r.name));
      r.lists.forEach(function (l) { card.appendChild(listBox(l)); });
      screen.appendChild(card);
    });
    dogs.forEach(function (d) {
      var card = el('section', 'ins-dog');
      card.appendChild(el('h2', '', d.name));
      if (d.facts.length) card.appendChild(el('p', 'ins-facts', d.facts.join(' · ')));
      d.lists.forEach(function (l) { card.appendChild(listBox(l)); });
      screen.appendChild(card);
    });
  }

  function message(screen, text) {
    screen.textContent = '';
    screen.appendChild(el('h1', '', 'Breeding records'));
    screen.appendChild(el('p', 'sub', text));
  }

  function start() {
    var screen = document.getElementById('screen');
    var link = parseHash(location.hash);
    /* clear the link from the address bar and history at once */
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* ignore */ }
    if (!link) { message(screen, 'This link is not complete. Ask the breeder to send it again.'); return; }
    var save = root_BLDSave().create({ scriptUrl: link.script, localStorage: null, sessionStorage: null });
    save.setCode(link.code, false);
    link = null;
    message(screen, 'Loading…');
    var res = {}, ends = '', notShared = [];
    var keys = ['subject'].concat(LISTS.map(function (L) { return L.key; }), ROOMS.map(function (L) { return L.key; }));
    var chain = Promise.resolve(true);
    keys.forEach(function (k) {
      chain = chain.then(function (go) {
        if (!go) return false;
        return save.read(k).then(function (r) {
          if (r.ok) { res[k] = r; if (r.ends) ends = r.ends; return true; }
          if (r.code === 'NOT_ALLOWED') {
            if (k !== 'subject') notShared.push(title(k));   // that list was not ticked (a temperatures-only link has no dogs)
            return true;
          }
          message(screen, SAY[r.code] || 'These records cannot be shown right now.');
          return false;
        });
      });
    });
    chain.then(function (ok) { if (ok) render(screen, res, ends, notShared); save.clearCode(); });
  }
  function title(k) { var L = LISTS.concat(ROOMS).filter(function (x) { return x.key === k; })[0]; return L ? L.title : k; }
  function root_BLDSave() { return (typeof self !== 'undefined' ? self : this).BLDSave; }

  if (typeof document !== 'undefined' && document.getElementById('screen')) start();
  return { parseHash: parseHash, build: build, buildRooms: buildRooms, day: day, when: when };
}));
