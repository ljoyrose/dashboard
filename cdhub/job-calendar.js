/*!
 * BLDJobCal - one month calendar per daily job (Lisa 17 Nov 2026: "make a calendar view which will help the user, simple
 * to use and log all done so staff or user say done then it shows as green"). The same look as the Temperatures page:
 * green with a tick = done that day, orange frame = missed, part done = orange frame with how many. Which jobs have a
 * calendar, and in what order, is the owner's: rows compliance.calendar.<type_key> (value = place 1, 2, 3...; 0 or off =
 * hidden), dated by effective_from. No rows = the starter list. Nothing here names a job beyond that starter list.
 * Needs BLDDue. Reads and draws only; the page saves.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./staff/lib/due.js'));
  else root.BLDJobCal = factory(root.BLDDue);
}(typeof self !== 'undefined' ? self : this, function (Due) {
  'use strict';

  /* the stop-gap until the owner has calendar rows (Lisa 17 Nov 2026: health checks, bowls washed, site cleaned) */
  var STARTER = ['health_check_all', 'food_bowls', 'water_bowls', 'whole_site_clean'];
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var SKIP = { not_done: 1, note: 1, part_done: 1 };

  function inForce(r, day) { return r.effective_from && r.effective_from <= day && (!r.to_date || r.to_date >= day); }

  /** The type_keys to draw, in the owner's order. */
  function chosen(v) {
    var best = {};
    (v.rules || []).forEach(function (r) {
      var m = /^compliance\.calendar\.(.+)$/.exec(String(r.rule_key || ''));
      if (m && inForce(r, v.today) && (!best[m[1]] || r.effective_from > best[m[1]].effective_from)) best[m[1]] = r;
    });
    var keys = Object.keys(best);
    if (!keys.length) return STARTER.filter(function (k) { return !!typeOf(v, k); });
    return keys.map(function (k) { return { k: k, n: parseInt(best[k].value, 10) }; })
      .filter(function (x) { return x.n > 0 && typeOf(v, x.k); })
      .sort(function (a, b) { return a.n - b.n; }).map(function (x) { return x.k; });
  }

  /** The job row in force today for a type_key (the newest effective_from on or before today, switched on). */
  function typeOf(v, key) {
    var best = null;
    (v.types || []).forEach(function (r) { if (r.type_key === key && r.effective_from && r.effective_from <= v.today && (!best || r.effective_from > best.effective_from)) best = r; });
    return best && String(best.active).toLowerCase() !== 'false' ? best : null;
  }

  /** London day -> {dogs:{id:1}, n, lines:[{by, at}]} for every done record of this job (all its versions). */
  function days(v, key) {
    var ids = {}, replaced = {}, out = {};
    (v.types || []).forEach(function (r) { if (r.type_key === key) ids[r.id] = 1; });
    (v.logs || []).forEach(function (l) { if (l.corrects_id) replaced[l.corrects_id] = 1; });
    (v.logs || []).forEach(function (l) {
      if (!ids[l.check_type_id] || replaced[l.id] || SKIP[l.outcome] || String(l.how_recorded || '') === 'owner_note') return;
      var d = Due.londonDate(l.happened_at || l.taken_at); if (!d) return;
      var x = out[d] = out[d] || { dogs: {}, n: 0, lines: [] };
      if (l.subject_id) x.dogs[l.subject_id] = 1;
      x.n++; x.lines.push({ by: l.taken_by || '', at: l.happened_at || l.taken_at || '' });
    });
    return out;
  }

  /** One month for one job: {key, label, ym, first, need, cells:[{iso, day, state, got, need}]}. State: done, part,
      missed, due (today, not yet), future, before (before this job's first record: not tracked here), blank (padding). */
  function month(v, key, ym) {
    var t = typeOf(v, key); if (!t) return null;
    var perDog = Due.perDogSite(t), need = perDog ? Due.dogsFor(t, { dogs: v.dogs || [] }).length : 1;
    var d = days(v, key), first = Object.keys(d).sort()[0] || '';
    var y = parseInt(ym.slice(0, 4), 10), m = parseInt(ym.slice(5, 7), 10);
    var len = new Date(Date.UTC(y, m, 0)).getUTCDate(), lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    var cells = [];
    for (var i = 0; i < lead; i++) cells.push({ state: 'blank' });
    for (var dd = 1; dd <= len; dd++) {
      var iso = ym + '-' + (dd < 10 ? '0' : '') + dd, x = d[iso], got = x ? (perDog ? Object.keys(x.dogs).length : x.n) : 0;
      var state = iso > v.today ? 'future' : (got && (!perDog || got >= need)) ? 'done' : got ? 'part' : iso === v.today ? 'due' : (!first || iso < first) ? 'before' : 'missed';
      cells.push({ iso: iso, day: dd, state: state, got: got, need: perDog ? need : 0, lines: x ? x.lines : [] });
    }
    return { key: key, label: t.label || key, ym: ym, first: first, perDog: perDog, need: need, typeId: t.id, cells: cells };
  }

  var WORD = { done: 'done', part: 'part done', missed: 'missed', due: 'due today', future: '', before: 'not tracked yet' };
  var TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M4 12l5 5L20 6"/></svg>';

  /** The calendars for one month, with a "Done today" button on each job not yet done today (when the page can save). */
  function html(v, ym, canSave) {
    var e = v.esc, keys = chosen(v);
    var mm = parseInt(ym.slice(5, 7), 10), title = MON[mm - 1] + ' ' + ym.slice(0, 4);
    var prev = shift(ym, -1), next = shift(ym, 1), atNow = ym >= v.today.slice(0, 7);
    var h = '<section class="card jcal-wrap" id="jobCals"><div class="jcal-head"><h3>Daily records</h3><div class="jcal-nav">'
      + '<button class="btn quiet" type="button" data-jcal-month="' + prev + '" aria-label="Previous month">‹</button><b data-jcal-title>' + e(title) + '</b>'
      + '<button class="btn quiet" type="button" data-jcal-month="' + next + '" aria-label="Next month"' + (atNow ? ' disabled' : '') + '>›</button>'
      + (canSave ? '<button class="btn quiet" type="button" data-jcal-import aria-expanded="false">Import</button>' : '') + '</div></div>'
      + (canSave ? '<div class="jcal-imp" data-jcal-imp hidden></div>' : '')
      + '<p class="mut jcal-key"><span class="jd done">' + TICK + '</span> done <span class="jd part"></span> part done <span class="jd missed"></span> missed</p>';
    if (!keys.length) return h + '<p class="mut">No calendars chosen. Add rows compliance.calendar.&lt;job&gt; in Settings.</p></section>';
    h += '<div class="jcal-grid">' + keys.map(function (k) {
      var c = month(v, k, ym); if (!c) return '';
      var today = c.cells.filter(function (x) { return x.iso === v.today; })[0];
      var doneToday = today && today.state === 'done';
      return '<div class="jcal" data-jcal="' + e(k) + '"><div class="jcal-t"><b>' + e(c.label) + '</b>'
        + (today ? (doneToday ? '<span class="jcal-ok">' + TICK + ' Done today</span>'
          : canSave ? '<button class="btn" type="button" data-jcal-done="' + e(k) + '">' + (today.state === 'part' ? 'Mark all done' : 'Done today') + '</button>' : '') : '')
        + '</div><div class="jdays">' + ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(function (w) { return '<span class="jdh">' + w + '</span>'; }).join('')
        + c.cells.map(function (x) {
          if (x.state === 'blank') return '<span class="jd blank"></span>';
          var who = x.lines.length ? ' · ' + x.lines.map(function (l) { return l.by; }).filter(Boolean).filter(function (b, i, a) { return a.indexOf(b) === i; }).join(', ') : '';
          var part = x.state === 'part' && x.need ? ' (' + x.got + ' of ' + x.need + ')' : '';
          var label = (v.dmy ? v.dmy(x.iso) : x.iso) + (WORD[x.state] ? ': ' + WORD[x.state] : '') + part + who;
          return '<span class="jd ' + x.state + (x.iso === v.today ? ' today' : '') + '" data-day="' + x.iso + '" title="' + e(label) + '" aria-label="' + e(label) + '" role="img">'
            + (x.state === 'done' ? TICK : '<i>' + x.day + '</i>') + '</span>';   // the date in every square but a done one (its tick); part done says how many in its label
        }).join('') + '</div></div>';
    }).join('') + '</div>';
    return h + '</section>';
  }
  function shift(ym, n) { var y = parseInt(ym.slice(0, 4), 10), m = parseInt(ym.slice(5, 7), 10) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + (m < 9 ? '0' : '') + (m + 1); }

  /** What the page sends for "Done today": one whole-site save; a per-dog job lists every dog it covers. */
  function doneFields(v, key) {
    var t = typeOf(v, key); if (!t) return null;
    var f = { check_type_id: t.id, outcome: String(t.asks_outcome).toLowerCase() === 'false' ? 'recorded' : 'ok', how_recorded: 'site_tap' };
    if (Due.perDogSite(t)) f.dog_ids = Due.dogsFor(t, { dogs: v.dogs || [] }).map(function (d) { return d.id; }).join('|');
    return f;
  }

  var CSS = '.jcal-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.jcal-nav{display:flex;align-items:center;gap:8px}'
    + '.jcal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}.jcal{border:1px solid var(--line);border-radius:12px;padding:10px;background:var(--card)}'
    + '.jcal-t{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;margin-bottom:6px}.jcal-ok{display:inline-flex;align-items:center;gap:4px;color:var(--ink);font-weight:700}'
    + '.jcal-ok svg,.jd svg{width:16px;height:16px}.jdays{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.jdh{font-size:10px;color:var(--muted);text-align:center}'
    + '.jd{aspect-ratio:1;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--card);box-shadow:inset 0 0 0 1px var(--line);font-size:10px;color:var(--ink)}'
    + '.jd.blank{background:transparent;box-shadow:none}.jd.future,.jd.before{opacity:.4}.jd.done{background:var(--ljr-5);box-shadow:none;color:var(--ljr-paper,#fff)}'
    + '.jd.part,.jd.missed{box-shadow:inset 0 0 0 2px var(--ljr-3)}.jd.due{box-shadow:inset 0 0 0 2px var(--line)}.jd.today{outline:2px solid var(--ink);outline-offset:-2px}'
    + '.jd i{font-style:normal;color:var(--muted)}.jd.part i,.jd.missed i,.jd.due i{color:var(--ink);font-weight:700}.jcal-key{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.jcal-key .jd{width:18px;height:18px;aspect-ratio:auto}'
    + '.jcal-imp{border:1px solid var(--line);border-radius:12px;padding:10px;margin:8px 0;display:grid;gap:8px}.jcal-imp[hidden]{display:none}.jcal-imp-row{display:flex;gap:8px;flex-wrap:wrap}.jcal-imp-t td,.jcal-imp-t th{padding:4px 6px;text-align:left}.jcal-imp-t .warn{color:var(--ljr-3-text)}';

  /* Import (Lisa 22 Nov 2026, "A"): past daily records from a spreadsheet, one row per job and day. Columns: date, job,
     outcome (optional: done / concern / not done; blank = done), note (optional). The job is its key or its name as on
     the calendar. Every row is checked first and shown; only the person's press saves, one row at a time, each marked
     "imported" (how_recorded import), so the record always says it was entered afterwards from another source. */
  function siteTypes(v) {
    var by = {};
    (v.types || []).forEach(function (r) { if (r.target === 'none' && r.effective_from <= v.today && String(r.active).toLowerCase() !== 'false' && (!by[r.type_key] || r.effective_from > by[r.type_key].effective_from)) by[r.type_key] = r; });
    return by;
  }
  function csvRows(text) {
    var rows = [], row = [], cell = '', q = false, t = String(text || '').replace(/^﻿/, '');
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (q) { if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
      if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
  }
  function pad(y, mo, d) {
    var iso = y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2), t = new Date(iso + 'T12:00:00Z');
    return isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== iso ? '' : iso;
  }
  function isoOf(d) {
    d = String(d || '').trim(); var m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(d))) return pad(m[1], m[2], m[3]);
    if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/.exec(d))) return pad(m[3].length === 2 ? '20' + m[3] : m[3], m[2], m[1]);
    return '';
  }
  var IMP_OUTCOME = { '': 'ok', done: 'ok', ok: 'ok', yes: 'ok', concern: 'concern', 'not done': 'not_done', no: 'not_done' };

  /** A record already saved for this job, day and outcome (an "ok" day also counts any done record), so a file
      imported twice never saves the same row twice (22 Nov 2026: Lisa's re-import). */
  function saved(v, key, iso, oc) {
    if (oc === 'ok' && days(v, key)[iso]) return true;
    var ids = {}, replaced = {};
    (v.types || []).forEach(function (r) { if (r.type_key === key) ids[r.id] = 1; });
    (v.logs || []).forEach(function (l) { if (l.corrects_id) replaced[l.corrects_id] = 1; });
    return (v.logs || []).some(function (l) { return ids[l.check_type_id] && !replaced[l.id] && l.outcome === oc && Due.londonDate(l.happened_at || l.taken_at) === iso; });
  }
  /** Checks every row: [{line, iso, key, label, outcome, note, ok, why, past}]. Nothing is saved here. past = a week or
      more ago: the save script asks "save anyway?" for those, and the person's Import press after this preview is that yes. */
  function parseImport(v, text) {
    var types = siteTypes(v), byName = {};
    Object.keys(types).forEach(function (k) { byName[k.toLowerCase()] = k; byName[String(types[k].label || '').toLowerCase()] = k; });
    var rows = csvRows(text), out = [], seen = {}, pastDay = new Date(Date.parse(v.today + 'T12:00:00Z') - 6 * 864e5).toISOString().slice(0, 10);
    if (rows.length && /date/i.test(rows[0][0] || '') && /job/i.test(rows[0][1] || '')) rows = rows.slice(1);
    rows.forEach(function (r, i) {
      var iso = isoOf(r[0]), key = byName[String(r[1] || '').trim().toLowerCase()] || '', oc = IMP_OUTCOME[String(r[2] || '').trim().toLowerCase()];
      var x = { line: i + 1, date: String(r[0] || ''), job: String(r[1] || ''), iso: iso, key: key, label: key ? types[key].label || key : '', outcome: oc || '', note: String(r[3] || '').trim(), ok: false, why: '' };
      if (!iso) x.why = 'date not understood (use 2026-11-17 or 17/11/2026)';
      else if (iso > v.today) x.why = 'a future date';
      else if (!key) x.why = 'job not found: use its name as on the calendar';
      else if (!oc) x.why = 'outcome not understood (done, concern or not done)';
      else if (seen[key + '|' + iso]) x.why = 'repeated in this file';
      else if (saved(v, key, iso, oc)) x.why = 'already recorded that day';
      else { x.ok = true; x.past = iso <= pastDay; seen[key + '|' + iso] = 1; }
      out.push(x);
    });
    return out;
  }
  /** What one imported row sends: a whole-site record for that day, marked import; a per-dog job lists its dogs. */
  function importFields(v, x) {
    var t = siteTypes(v)[x.key]; if (!t) return null;
    var f = { check_type_id: t.id, outcome: x.outcome, how_recorded: 'import', happened_at: x.iso + 'T12:00:00Z' };
    if (x.note) f.note = x.note;
    if (x.past) f.confirm_unusual = 'yes';   // reviewed in the preview; never stored, how_recorded stays import
    if (Due.perDogSite(t)) f.dog_ids = Due.dogsFor(t, { dogs: v.dogs || [] }).map(function (d) { return d.id; }).join('|');
    return f;
  }
  /** A starter file: the heading row and one example row per calendar job (yesterday), to fill in and import. */
  function template(v) {
    var y = new Date(Date.parse(v.today + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10), types = siteTypes(v);
    return 'date,job,outcome,note\r\n' + chosen(v).map(function (k) { return y + ',"' + String((types[k] || {}).label || k).replace(/"/g, '""') + '",done,'; }).join('\r\n') + '\r\n';
  }
  function importPanel(v) {
    return '<p>Add past daily records from a spreadsheet: one row per job and day. Columns: <b>date</b>, <b>job</b>, <b>outcome</b> (done, concern or not done; blank = done), <b>note</b>. Each record is marked <i>imported</i>.</p>'
      + '<div class="jcal-imp-row"><a class="btn quiet" download="daily-records.csv" href="data:text/csv;charset=utf-8,' + encodeURIComponent(template(v)) + '" data-jcal-template>Download a starter file</a>'
      + '<label class="btn">Choose file<input type="file" accept=".csv,text/csv" data-jcal-file hidden></label></div>'
      + '<div data-jcal-preview></div>';
  }
  function previewHtml(v, rows) {
    var e = v.esc, good = rows.filter(function (x) { return x.ok; }).length;
    if (!rows.length) return '<p class="msg warn">No rows found in that file.</p>';
    var word = { ok: 'done', concern: 'concern', not_done: 'not done' };
    return '<p data-jcal-imp-count><b>' + good + '</b> of ' + rows.length + ' rows ready to import' + (good < rows.length ? '; the others are listed with the reason and will not be saved' : '') + '.</p>'
      + '<div class="scroll"><table class="jcal-imp-t"><thead><tr><th>Row</th><th>Date</th><th>Job</th><th>Outcome</th><th></th></tr></thead><tbody>'
      + rows.map(function (x) {
        return '<tr data-ok="' + (x.ok ? 1 : 0) + '"><td>' + x.line + '</td><td>' + e(x.iso ? (v.dmy ? v.dmy(x.iso) : x.iso) : x.date) + '</td><td>' + e(x.label || x.job) + '</td><td>'
          + e(word[x.outcome] || '') + '</td><td>' + (x.ok ? (x.past ? 'past date: will be saved as imported' : 'ready') : '<span class="warn">' + e(x.why) + '</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      + (good ? '<p><button class="btn" type="button" data-jcal-import-go>Import ' + good + ' row' + (good === 1 ? '' : 's') + '</button> <span class="msg" data-jcal-imp-msg role="status"></span></p>' : '');
  }

  return { STARTER: STARTER, chosen: chosen, month: month, html: html, doneFields: doneFields, shift: shift, CSS: CSS, parseImport: parseImport, importFields: importFields, template: template, importPanel: importPanel, previewHtml: previewHtml };
}));
