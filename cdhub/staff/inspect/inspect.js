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
 *
 * Layout (the owner's inspector design, 13 Nov 2026): dogs A to Z; each with sex, date of birth and the chip's last 4 (the
 * script sends only those 4); then the must-pass checks, each with its grade or result, date and an Open fold holding the
 * full shared record; Fit to Breed with when it is next due; litters as "x of <limit>" with the last date and how many in the
 * last 12 months. The limit is the breeder's own rule row, sent by the script when shared; never a number in this page.
 * Pass / Unverified / Fail show on the must-pass checks only when the script sends a must-pass summary for the link AND the
 * link's viewer level shows them (BLDViewerLevels). Never points, the target, Below target, ranking, notes, programme or looks.
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
    { key: 'fit_to_breed', title: 'Fit to Breed', dog: 'subject_id', date: 'assessed_on' },
    { key: 'litter', title: 'Litters', dog: 'dam_subject_id', date: 'dob' }
  ];
  var HIDE = { id: 1, subject_id: 1, dam_subject_id: 1, tenant_id: 1 };
  /* lists this page asks for quietly: when a link does not share them, nothing is said (the script does not send them yet) */
  var QUIET = [{ key: 'must_pass', dog: 'subject_id' }, { key: 'breeding_rule', dog: '' }];
  /* never shown to an outside viewer, whatever comes back */
  var NEVER_FIELDS = /^(points|points_earned|points_available|points_unverified|target|target_points|rank|ranking|verdict|note|notes|programme|judged_by)$/;
  var WORD = { pass: 'Pass', unverified: 'Unverified', fail: 'Fail' };
  var RANK = { fail: 0, unverified: 1, pass: 2 };
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
    if (!/^[A-Za-z0-9_\-]{10,}$/.test(p.s || '') || !/^[A-Z2-9]{16}$/.test(p.c || '')) return null;
    return { script: 'https://script.google.com/macros/s/' + p.s + '/exec', code: p.c };
  }

  function txt(v) { return v === undefined || v === null ? '' : String(v).trim(); }
  function addMonths(iso, n) { var d = new Date(iso + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10); }
  function newest(rows, col) { return rows.slice().sort(function (a, b) { return txt(b[col]).localeCompare(txt(a[col])); }); }
  function clean(fields) { return (fields || []).filter(function (c) { return !HIDE[c] && !NEVER_FIELDS.test(c); }); }

  /** Group what came back by dog, dogs A to Z: [{name, facts, word, checks:[{label, word, sub, open:[cells]}], litters, lists}].
   *  Pure, for tests. today = YYYY-MM-DD (for "in the last 12 months"); shows = what the link's viewer level shows. */
  function build(res, today, shows) {
    shows = shows || { records: true, grades: true, due_dates: true, must_pass: true };
    today = today || new Date().toISOString().slice(0, 10);
    var dogs = (res.subject && res.subject.rows) || [];
    var subFields = clean((res.subject && res.subject.fields) || []).filter(function (c) { return c !== 'name' && c !== 'sex' && c !== 'dob'; });
    var limitRow = res.breeding_rule && (res.breeding_rule.rows || []).filter(function (r) {
      return txt(r.rule_key) === 'max_litters_per_dam' && /^\d+$/.test(txt(r.value)) && (!txt(r.effective_from) || txt(r.effective_from) <= today);
    }).sort(function (a, b) { return txt(b.effective_from).localeCompare(txt(a.effective_from)); })[0];
    return dogs.slice().sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); }).map(function (d) {
      var chip = res.microchip && (res.microchip.rows || []).filter(function (r) { return r.subject_id === d.id; })[0];
      var chipVal = chip ? txt(chip.chip_number || chip.number || chip.chip || '') : '';
      var facts = [txt(d.sex), txt(d.dob) ? 'DOB ' + day(d.dob) : '', chipVal ? 'Chip \u2022\u2022\u2022\u2022' + chipVal.slice(-4) : '']
        .concat(subFields.filter(function (c) { return d[c] !== undefined && d[c] !== ''; }).map(function (c) { return words(c) + ' ' + show(c, d[c]); })).filter(Boolean);
      var checks = [];
      var mp = res.must_pass && (res.must_pass.rows || []).filter(function (r) { return r.subject_id === d.id; });
      if (mp && mp.length) {
        mp.forEach(function (r) {
          var o = txt(r.outcome).toLowerCase(), sub = [];
          if (shows.grades && txt(r.answer)) sub.push(txt(r.answer));
          if (shows.grades && txt(r.date)) sub.push(day(r.date));
          if (shows.due_dates && txt(r.due_date)) sub.push('due ' + day(r.due_date));
          /* Open: the shared record this result was read from, when the link shares that list */
          var list = res[txt(r.evidence_table).replace(/^BLD-/, '')], rec = list && txt(r.evidence_id) ? (list.rows || []).filter(function (x) { return txt(x.id) === txt(r.evidence_id); })[0] : null;
          checks.push({ label: txt(r.label), word: shows.must_pass && WORD[o] ? o : '', sub: sub.join(' \u00b7 ') || (o === 'unverified' ? 'No record yet' : ''), open: rec ? [cells(list.fields, rec)] : [] });
        });
      } else {
        /* no summary: the must-pass records as they are, grade and date, newest per test. No words. */
        var hs = res.health_screen && (res.health_screen.rows || []).filter(function (r) { return r.subject_id === d.id; });
        var tests = {};
        (hs || []).forEach(function (r) { var k = txt(r.test) || 'Health test'; (tests[k] = tests[k] || []).push(r); });
        Object.keys(tests).sort().forEach(function (k) {
          var rows = newest(tests[k], 'tested_on'), r = rows[0];
          checks.push({ label: k.charAt(0).toUpperCase() + k.slice(1), word: '', sub: [txt(r.grade), txt(r.tested_on) ? day(r.tested_on) : ''].filter(Boolean).join(' \u00b7 '),
            open: rows.map(function (x) { return cells(res.health_screen.fields, x); }) });
        });
      }
      var ftb = res.fit_to_breed && (res.fit_to_breed.rows || []).filter(function (r) { return r.subject_id === d.id; });
      if (ftb && ftb.length && !(mp && mp.length)) {
        var fr = newest(ftb, 'assessed_on'), f = fr[0];
        checks.push({ label: 'Fit to Breed', word: '', sub: [txt(f.outcome), txt(f.assessed_on) ? day(f.assessed_on) : '', txt(f.valid_until) ? 'due ' + day(f.valid_until) : ''].filter(Boolean).join(' \u00b7 '),
          open: fr.map(function (x) { return cells(res.fit_to_breed.fields, x); }) });
      } else if (ftb && ftb.length) {
        var fit = checks.filter(function (c) { return /fit to breed/i.test(c.label); })[0];
        if (fit) fit.open = newest(ftb, 'assessed_on').map(function (x) { return cells(res.fit_to_breed.fields, x); });
      }
      var lit = res.litter && (res.litter.rows || []).filter(function (r) { return r.dam_subject_id === d.id; });
      var litters = null;
      if (lit && lit.length) {
        var dated = newest(lit, 'dob').filter(function (r) { return /^\d{4}-\d{2}-\d{2}/.test(txt(r.dob)); });
        var yearAgo = addMonths(today, -12);
        litters = { n: lit.length, limit: limitRow ? Number(limitRow.value) : null, last: dated[0] ? day(dated[0].dob) : '',
          recent: dated.filter(function (r) { return txt(r.dob).slice(0, 10) > yearAgo && txt(r.dob).slice(0, 10) <= today; }).length };
      }
      var ws = checks.map(function (c) { return c.word; }).filter(Boolean);
      var word = ws.length && ws.length === checks.length ? ws.reduce(function (w, x) { return RANK[x] < RANK[w] ? x : w; }, 'pass') : (ws.indexOf('fail') >= 0 ? 'fail' : '');
      return {
        name: d.name || 'Dog', facts: facts, word: word, checks: checks, litters: litters,
        lists: LISTS.filter(function (L) { return L.key === 'subject_status' && res[L.key] && res[L.key].rows; }).map(function (L) {
          var rows = res[L.key].rows.filter(function (r) { return r[L.dog] === d.id; }).sort(function (a, b) { return String(b[L.date] || '').localeCompare(String(a[L.date] || '')); });
          return { title: L.title, rows: rows.map(function (r) { return cells(res[L.key].fields, r); }) };
        }).filter(function (l) { return l.rows.length; })
      };
    });
  }
  function cells(fields, r) { return clean(fields).map(function (c) { return { label: words(c), value: show(c, r[c]) }; }); }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  /* the save app's own words for the codes an inspector can meet (PR 442) */
  var SAY = {
    BAD_CODE: 'This link has ended. Ask the breeder for a new one if you still need it.',
    READ_NOT_CONFIGURED: 'These records are not set up for sharing yet. Ask the breeder.',
    LOG_FAILED: 'These records cannot be shown right now. Try again in a moment.',
    READ_OFF: 'Sharing is switched off at the moment. Ask the breeder.',
    NETWORK: 'Could not reach the records. Check the connection and try again.'
  };

  function row(cellsList) {
    var r = el('div', 'ins-row');
    cellsList.forEach(function (c) { if (c.value === '') return; var s = el('span'); s.appendChild(el('b', '', c.label + ' ')); s.appendChild(document.createTextNode(c.value)); r.appendChild(s); });
    return r;
  }
  function pill(word) { return el('span', 'ins-v ins-' + word, WORD[word]); }

  function render(screen, res, ends, notShared, shows) {
    screen.textContent = '';
    screen.appendChild(el('h1', '', 'Breeding records'));
    if (ends) screen.appendChild(el('p', 'ins-ends', 'Read only. This link ends ' + day(ends) + '.'));
    var dogs = build(res, null, shows);
    if (notShared && notShared.length) screen.appendChild(el('p', 'ins-ends ins-not', 'Not shared on this link: ' + notShared.join(', ') + '.'));
    if (!dogs.length) { screen.appendChild(el('p', 'sub', 'No dogs have been shared on this link.')); return; }
    dogs.forEach(function (d) {
      var card = el('section', 'ins-dog' + (d.word ? ' ins-l-' + d.word : ''));
      var head = el('div', 'ins-head');
      head.appendChild(el('h2', '', d.name));
      if (d.word) head.appendChild(pill(d.word));
      card.appendChild(head);
      if (d.facts.length) card.appendChild(el('p', 'ins-facts', d.facts.join(' · ')));
      d.checks.forEach(function (c) {
        var line = el('div', 'ins-check');
        var top = el('div', 'ins-top');
        top.appendChild(el('span', 'ins-lab', c.label));
        if (c.word) top.appendChild(pill(c.word));
        line.appendChild(top);
        if (c.sub || c.open.length) {
          var sub = el('div', 'ins-sub');
          if (c.sub) sub.appendChild(el('span', '', c.sub));
          if (c.open.length) {
            var det = el('details', 'ins-open');
            det.appendChild(el('summary', '', 'Open'));
            c.open.forEach(function (cl) { det.appendChild(row(cl)); });
            sub.appendChild(det);
          }
          line.appendChild(sub);
        }
        card.appendChild(line);
      });
      if (d.litters) {
        var li = el('div', 'ins-check');
        var lt = el('div', 'ins-top');
        lt.appendChild(el('span', 'ins-lab', 'Litters'));
        lt.appendChild(el('span', 'ins-n', d.litters.limit !== null ? d.litters.n + ' of ' + d.litters.limit : d.litters.n + (d.litters.n === 1 ? ' litter' : ' litters')));
        li.appendChild(lt);
        li.appendChild(el('div', 'ins-sub', [d.litters.last ? 'Last ' + d.litters.last : '', d.litters.recent + ' in last 12 months'].filter(Boolean).join(' · ')));
        card.appendChild(li);
      }
      d.lists.forEach(function (l) {
        var box = el('div', 'ins-list');
        box.appendChild(el('h3', '', l.title));
        l.rows.forEach(function (cl) { box.appendChild(row(cl)); });
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
    var keys = ['subject'].concat(LISTS.map(function (L) { return L.key; })).concat(QUIET.map(function (q) { return q.key; }));
    var quiet = {}; QUIET.forEach(function (q) { quiet[q.key] = 1; });
    var chain = Promise.resolve(true);
    keys.forEach(function (k) {
      chain = chain.then(function (go) {
        if (!go) return false;
        return save.read(k).then(function (r) {
          if (r.ok) { res[k] = r; if (r.ends) ends = r.ends; return true; }
          if (quiet[k]) return true;   // not sent for this link: the page shows records only
          if (r.code === 'NOT_ALLOWED') {
            if (k === 'subject') { message(screen, 'No dogs have been shared on this link.'); return false; }
            notShared.push(title(k)); return true;   // that list was not ticked for this link
          }
          message(screen, SAY[r.code] || 'These records cannot be shown right now.');
          return false;
        });
      });
    });
    chain.then(function (ok) {
      /* the link's viewer level (sent by the script when set); the inspector default otherwise */
      var L = root_Levels(), lv = (res.must_pass && res.must_pass.viewer_level) || '';
      var shows = L ? L.showsFor(null, 'inspector', '', lv) : { records: true, grades: true, due_dates: true };
      shows.grades = true; shows.records = true;
      if (ok) render(screen, res, ends, notShared, shows);
      save.clearCode();
    });
  }
  function title(k) { var L = LISTS.filter(function (x) { return x.key === k; })[0]; return L ? L.title : k; }
  function root_BLDSave() { return (typeof self !== 'undefined' ? self : this).BLDSave; }
  function root_Levels() { return (typeof self !== 'undefined' ? self : this).BLDViewerLevels; }

  if (typeof document !== 'undefined' && document.getElementById('screen')) start();
  return { parseHash: parseHash, build: build, day: day };
}));
