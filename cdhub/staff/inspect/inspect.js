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
    { key: 'subject_status', title: 'Status', dog: 'subject_id', date: 'from_date' },
    { key: 'health_screen', title: 'Health tests', dog: 'subject_id', date: 'tested_on' },
    { key: 'fit_to_breed', title: 'Fit to Breed', dog: 'subject_id', date: 'assessed_on' },
    { key: 'litter', title: 'Litters', dog: 'dam_subject_id', date: 'dob' }
  ];
  var HIDE = { id: 1, subject_id: 1, dam_subject_id: 1, tenant_id: 1 };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function day(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
    return m ? (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] : String(v || '');
  }
  function words(col) {
    var s = String(col).replace(/_/g, ' ');
    if (s === 'dob') return 'DOB';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function isDateCol(c) { return /(^dob$|_on$|_date$|_until$|_at$)/.test(c); }
  function show(c, v) { return isDateCol(c) ? day(v) : String(v === undefined || v === null ? '' : v); }

  /** Read the link from the address. Returns {script, code} or null. */
  function parseHash(hash) {
    var p = {};
    String(hash || '').replace(/^#/, '').split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) { try { p[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); } catch (e) { /* ignore */ } }
    });
    if (!/^[A-Za-z0-9_\-]{10,}$/.test(p.s || '') || !p.c) return null;
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
            .sort(function (a, b) { return String(b[L.date] || '').localeCompare(String(a[L.date] || '')); });
          return { title: L.title, rows: rows.map(function (r) { return fields.map(function (c) { return { label: words(c), value: show(c, r[c]) }; }); }) };
        }).filter(function (l) { return l.rows.length; })
      };
    });
  }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  function render(screen, res, ends) {
    screen.textContent = '';
    screen.appendChild(el('h1', '', 'Breeding records'));
    if (ends) screen.appendChild(el('p', 'ins-ends', 'Read only. This link ends ' + day(ends) + '.'));
    var dogs = build(res);
    if (!dogs.length) { screen.appendChild(el('p', 'sub', 'No dogs have been shared on this link.')); return; }
    dogs.forEach(function (d) {
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
    var res = {}, ends = '';
    var keys = ['subject'].concat(LISTS.map(function (L) { return L.key; }));
    var chain = Promise.resolve(true);
    keys.forEach(function (k) {
      chain = chain.then(function (go) {
        if (!go) return false;
        return save.read(k).then(function (r) {
          if (r.ok) { res[k] = r; if (r.ends) ends = r.ends; return true; }
          if (r.code === 'BAD_CODE') { message(screen, 'This link has ended. Ask the breeder for a new one if you still need it.'); return false; }
          if (k === 'subject') { message(screen, r.message || 'These records cannot be shown right now.'); return false; }
          return true;   // a list not shared on this link is simply left out
        });
      });
    });
    chain.then(function (ok) { if (ok) render(screen, res, ends); save.clearCode(); });
  }
  function root_BLDSave() { return (typeof self !== 'undefined' ? self : this).BLDSave; }

  if (typeof document !== 'undefined' && document.getElementById('screen')) start();
  return { parseHash: parseHash, build: build, day: day };
}));
