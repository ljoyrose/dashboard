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
    { key: 'litter', title: 'Litters', dog: 'dam_subject_id', date: 'dob' },
    { key: 'check_log', title: 'Daily checks', dog: 'subject_id', date: 'done_on', time: 'time' }   // demo 3b, 18 Nov 2026
  ];
  /* Rooms and the whole site (demo 3b): rows with no dog, grouped by room, a litter, or "Whole site". */
  var SITE = [
    { key: 'area_reading', title: 'Temperatures' },
    { key: 'check_log', title: 'Daily jobs' }
  ];
  var HIDE = { id: 1, subject_id: 1, dam_subject_id: 1, tenant_id: 1, room: 1, litter: 1 };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function day(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
    return m ? (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] : String(v || '');
  }
  function words(col) {
    var s = String(col).replace(/_/g, ' ');
    if (s === 'dob') return 'DOB';
    var named = { 'done on': 'Date', 'min c': 'Min °C', 'max c': 'Max °C', 'spot c': 'Spot °C' };
    if (named[s]) return named[s];
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  /* the first date column a row has, of those named by | */
  function dateOf(r, cols) { var c = String(cols || '').split('|').filter(function (k) { return r[k]; })[0]; return c ? r[c] : ''; }
  function isDateCol(c) { return /(^dob$|_on$|_date$|_until$|_at$)/.test(c); }
  function show(c, v) { return isDateCol(c) ? day(v) : String(v === undefined || v === null ? '' : v); }

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
            .sort(function (a, b) { return String(dateOf(b, L.date) + (L.time ? ' ' + (b[L.time] || '') : '')).localeCompare(String(dateOf(a, L.date) + (L.time ? ' ' + (a[L.time] || '') : ''))); });
          return { title: L.title, rows: rows.map(function (r) { return fields.map(function (c) { return { label: words(c), value: show(c, r[c]) }; }); }) };
        }).filter(function (l) { return l.rows.length; })
      };
    });
  }

  /** Rows with no dog, grouped: [{place, lists:[{title, rows}]}], rooms A to Z, then litters, then Whole site. Rows keep the order sent (newest first). Pure, for tests. */
  function buildSite(res) {
    var groups = {}, order = [];
    SITE.forEach(function (L) {
      var got = res[L.key];
      if (!got || !got.rows) return;
      var fields = got.fields.filter(function (c) { return !HIDE[c]; });
      got.rows.forEach(function (r) {
        if (r.subject_id) return;
        var place = r.room ? 'Room ' + r.room : (r.litter || 'Whole site');
        if (!groups[place]) { groups[place] = {}; order.push(place); }
        (groups[place][L.title] = groups[place][L.title] || []).push(fields.map(function (c) { return { label: words(c), value: show(c, r[c]) }; }));
      });
    });
    var rank = function (p) { return p === 'Whole site' ? 2 : /^Litter /.test(p) ? 1 : 0; };
    return order.sort(function (a, b) { return rank(a) - rank(b) || a.localeCompare(b); }).map(function (p) {
      return { place: p, lists: SITE.filter(function (L) { return groups[p][L.title]; }).map(function (L) { return { title: L.title, rows: groups[p][L.title] }; }) };
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
    var dogs = build(res), places = buildSite(res);
    if (notShared && notShared.length) screen.appendChild(el('p', 'ins-ends ins-not', 'Not shared on this link: ' + notShared.join(', ') + '.'));
    if (!dogs.length && !places.length) { screen.appendChild(el('p', 'sub', 'No dogs have been shared on this link.')); return; }
    dogs.map(function (d) { return { name: d.name, facts: d.facts, lists: d.lists }; })
      .concat(places.map(function (p) { return { name: p.place, facts: [], lists: p.lists }; })).forEach(function (d) {
      var card = el('section', 'ins-dog');
      card.appendChild(el('h2', '', d.name));
      if (d.facts.length) card.appendChild(el('p', 'ins-facts', d.facts.join(' · ')));
      d.lists.forEach(function (l) {
        var box = el('div', 'ins-list');
        box.appendChild(el('h3', '', l.title));
        l.rows.forEach(function (cells) {
          var row = el('div', 'ins-row');
          cells.forEach(function (c) { if (c.value === '') return; var s = el('span'); s.appendChild(el('b', '', c.label + ' ')); s.appendChild(document.createTextNode(c.value)); row.appendChild(s); });
          box.appendChild(row);
        });
        card.appendChild(box);
      });
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
    var keys = ['subject'].concat(LISTS.map(function (L) { return L.key; }), ['area_reading']);
    var chain = Promise.resolve(true);
    keys.forEach(function (k) {
      chain = chain.then(function (go) {
        if (!go) return false;
        return save.read(k).then(function (r) {
          if (r.ok) { res[k] = r; if (r.ends) ends = r.ends; return true; }
          if (r.code === 'NOT_ALLOWED') {
            if (k === 'subject') { message(screen, 'No dogs have been shared on this link.'); return false; }
            notShared.push(title(k)); return true;   // that list was not ticked for this link
          }
          message(screen, SAY[r.code] || 'These records cannot be shown right now.');
          return false;
        });
      });
    });
    chain.then(function (ok) { if (ok) render(screen, res, ends, notShared); save.clearCode(); });
  }
  function title(k) { var L = LISTS.concat(SITE).filter(function (x) { return x.key === k; })[0]; return L ? L.title : k; }
  function root_BLDSave() { return (typeof self !== 'undefined' ? self : this).BLDSave; }

  if (typeof document !== 'undefined' && document.getElementById('screen')) start();
  return { parseHash: parseHash, build: build, buildSite: buildSite, day: day };
}));
