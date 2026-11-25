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
      x.n++; x.lines.push({ id: l.id || '', by: l.taken_by || '', at: l.happened_at || l.taken_at || '', note: l.note || '' });
    });
    return out;
  }

  /** One month for one job: {key, label, ym, first, need, cells:[{iso, day, state, got, need}]}. State: done, part,
      missed, due (today, not yet), future, before (before this job's first record: not tracked here), blank (padding). */
  function month(v, key, ym) {
    var t = typeOf(v, key); if (!t) return null;
    var perDog = Due.perDogSite(t), mine = perDog ? Due.dogsFor(t, { dogs: v.dogs || [] }) : [], need = perDog ? mine.length : 1;
    /* a dog counts on a day only once it is born: a pup born mid-month does not make the days before it "part done" */
    var needOn = function (iso) { return mine.filter(function (x) { return !x.dob || String(x.dob).slice(0, 10) <= iso; }).length; };
    var d = days(v, key), first = Object.keys(d).sort()[0] || '';
    var y = parseInt(ym.slice(0, 4), 10), m = parseInt(ym.slice(5, 7), 10);
    var len = new Date(Date.UTC(y, m, 0)).getUTCDate(), lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    var cells = [];
    for (var i = 0; i < lead; i++) cells.push({ state: 'blank' });
    for (var dd = 1; dd <= len; dd++) {
      var iso = ym + '-' + (dd < 10 ? '0' : '') + dd, x = d[iso], got = x ? (perDog ? Object.keys(x.dogs).length : x.n) : 0, want = perDog ? needOn(iso) : 1;
      var state = iso > v.today ? 'future' : (got && (!perDog || got >= want)) ? 'done' : got ? 'part' : iso === v.today ? 'due' : (!first || iso < first) ? 'before' : 'missed';
      cells.push({ iso: iso, day: dd, state: state, got: got, need: perDog ? want : 0, lines: x ? x.lines : [] });
    }
    return { key: key, label: t.label || key, ym: ym, first: first, perDog: perDog, need: need, typeId: t.id, cells: cells };
  }

  /** Photos and files linked to each record (link rows check_log -> files, any role, link not ended), keyed by record id.
      Same rule as the record history (its filesByLog). */
  function filesByLog(v) {
    var files = {}, out = {};
    (v.files || []).forEach(function (f) { files[f.id] = f; });
    (v.links || []).forEach(function (k) {
      if (k.from_table !== 'check_log' || k.to_table !== 'files' || (k.to_date && k.to_date <= v.today)) return;
      var f = files[k.to_id]; if (!f) return;
      var id = String(f.drive_file_id || '').trim(), u = String(f.url || '').trim(), ok = /^[A-Za-z0-9_-]{20,}$/.test(id);
      var url = /^https:\/\//i.test(u) ? u : ok ? 'https://drive.google.com/file/d/' + id + '/view' : '';
      if (url) (out[k.from_id] = out[k.from_id] || []).push({ role: String(k.role || 'file').replace(/_/g, ' '), name: f.name || '', url: url,
        photoId: ok && /^image\//.test(String(f.mime || 'image/')) ? id : '' });
    });
    return out;
  }

  /** What was recorded on one day for one job: who and when, notes, and the photos (diary pages, evidence) to open.
      A picture has no src here: the page fills it from Drive with the signed-in read (data-cal-photo-id), as for dog photos. */
  function dayHtml(v, key, iso, docs, vets) {
    var e = v.esc, c = month(v, key, iso.slice(0, 7)); if (!c) return '';
    var x = c.cells.filter(function (y) { return y.iso === iso; })[0]; if (!x) return '';
    docs = docs || filesByLog(v);
    var hm = function (at) { var d = new Date(at); return isNaN(d) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }); };
    var by = {}, order = [], notes = [], pics = [];
    x.lines.forEach(function (l) {
      var k = l.by || 'Not named'; if (!by[k]) { by[k] = []; order.push(k); } by[k].push(hm(l.at));
      if (l.note) notes.push(l.note);
      (docs[l.id] || []).forEach(function (f) { if (!pics.some(function (p) { return p.url === f.url; })) pics.push(f); });
    });
    var part = x.state === 'part' && x.need ? ' (' + x.got + ' of ' + x.need + ')' : '';
    var vet = c.perDog ? ((vets || vetByDay(v))[iso] || []) : [];
    return '<div class="jcal-day" data-jcal-detail="' + e(iso) + '"><b>' + e(v.dmy ? v.dmy(iso) : iso) + '</b> <span class="mut">' + e(WORD[x.state] || '') + part + '</span>'
      + (order.length ? '<ul>' + order.map(function (k) { var t = by[k].filter(Boolean).sort();
          return '<li>' + e(k) + (t.length ? ' · ' + e(t[0] + (t.length > 1 && t[t.length - 1] !== t[0] ? '–' + t[t.length - 1] : '')) : '') + (by[k].length > 1 ? ' · ' + by[k].length + ' records' : '') + '</li>'; }).join('') + '</ul>'
        : '<p class="mut">Nothing recorded.</p>')
      + (vet.length ? '<p data-jcal-vet><b>Vet</b></p><ul>' + vet.map(function (r) { return '<li>' + e(r.dog) + (r.time ? ' · ' + e(r.time) : '') + (r.kind && r.kind !== 'appointment' ? ' · ' + e(r.kind) : '') + (r.reason ? ' · ' + e(r.reason) : '') + '</li>'; }).join('') + '</ul>' : '')
      + (notes.length ? '<p class="mut">' + notes.filter(function (n, i, a) { return a.indexOf(n) === i; }).map(e).join('<br>') + '</p>' : '')
      + (pics.length ? '<div class="jcal-pics">' + pics.map(function (f) {
          return '<a href="' + e(f.url) + '" target="_blank" rel="noopener noreferrer" data-jcal-photo title="' + e(f.name) + '">'
            + (f.photoId ? '<img data-cal-photo-id="' + e(f.photoId) + '" alt="' + e(f.role + ': ' + f.name) + '">' : '') + '<span>' + e(f.role) + '</span></a>'; }).join('') + '</div>' : '')
      + '</div>';
  }

  /** Vet visits by day (BLD-visit rows, status done; booked ones are not shown as visits). Cross-referenced on the per-dog
      calendars (health checks) so a vet day is visible next to the checks; a visit never counts as a check. */
  function vetByDay(v) {
    var out = {};
    (v.vetVisits || []).forEach(function (r) {
      var d = String(r.performed_on || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || String(r.status || '').toLowerCase() === 'booked' || String(r.status || '').toLowerCase() === 'cancelled') return;
      (out[d] = out[d] || []).push({ dog: (v.dogNames || {})[r.subject_id] || r.subject_id || 'No dog on the record', time: r.start_time || '', kind: r.kind || '', reason: r.reason || '' });
    });
    return out;
  }

  var VET = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  var CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  var WORD = { done: 'done', part: 'part done', missed: 'missed', due: 'due today', future: '', before: 'not tracked yet' };
  var TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M4 12l5 5L20 6"/></svg>';

  /** The calendars for one month, with a "Done today" button on each job not yet done today (when the page can save). */
  function html(v, ym, canSave) {
    var e = v.esc, keys = chosen(v), docs = filesByLog(v), open = v.calOpen || {}, vets = vetByDay(v);
    var mm = parseInt(ym.slice(5, 7), 10), title = MON[mm - 1] + ' ' + ym.slice(0, 4);
    var prev = shift(ym, -1), next = shift(ym, 1), atNow = ym >= v.today.slice(0, 7);
    var h = '<section class="card jcal-wrap" id="jobCals"><div class="jcal-head"><h3>Daily records</h3><div class="jcal-nav">'
      + '<button class="btn quiet" type="button" data-jcal-month="' + prev + '" aria-label="Previous month">‹</button><b data-jcal-title>' + e(title) + '</b>'
      + '<button class="btn quiet" type="button" data-jcal-month="' + next + '" aria-label="Next month"' + (atNow ? ' disabled' : '') + '>›</button>'
      + (canSave ? '<button class="btn quiet" type="button" data-jcal-import aria-expanded="false">Import</button>' : '') + '</div></div>'
      + (canSave ? '<div class="jcal-imp" data-jcal-imp hidden></div>' : '')
      + '<p class="mut jcal-key"><span class="jd done" data-jcal-legend="done">' + TICK + '</span> done <span class="jd part" data-jcal-legend="part"></span> part done <span class="jd missed" data-jcal-legend="missed"></span> missed'
      + (keys.some(function (k) { var t = typeOf(v, k); return t && Due.perDogSite(t); }) && (v.vetVisits || []).length ? ' <b class="jvet jkey">' + VET + '</b> vet visit' : '') + '</p>';
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
          var ph = x.lines.some(function (l) { return (docs[l.id] || []).length; }), vn = c.perDog && vets[x.iso] ? vets[x.iso].length : 0;
          var who = x.lines.length ? ' · ' + x.lines.map(function (l) { return l.by; }).filter(Boolean).filter(function (b, i, a) { return a.indexOf(b) === i; }).join(', ') : '';
          var part = x.state === 'part' && x.need ? ' (' + x.got + ' of ' + x.need + ')' : '';
          var label = (v.dmy ? v.dmy(x.iso) : x.iso) + (WORD[x.state] ? ': ' + WORD[x.state] : '') + part + who;
          if (vn) label += ' · vet: ' + vets[x.iso].map(function (r) { return r.dog; }).join(', ');
          var cls = 'jd ' + x.state + (x.iso === v.today ? ' today' : '') + (ph ? ' ph' : '') + (vn ? ' vet' : '') + (open.key === k && open.iso === x.iso ? ' open' : '');
          var face = (x.state === 'done' ? TICK : '<i>' + x.day + '</i>') + (ph ? '<b class="jcam">' + CAM + '</b>' : '') + (vn ? '<b class="jvet">' + VET + '</b>' : '');
          if (x.lines.length || vn) return '<button type="button" class="' + cls + '" data-day="' + x.iso + '" data-jcal-day="' + x.iso + '" data-jcal-key="' + e(k) + '" title="' + e(label) + '" aria-label="' + e(label + (ph ? ' · photo' : '') + '. Open') + '"'
            + (open.key === k && open.iso === x.iso ? ' aria-expanded="true"' : '') + '>' + face + '</button>';   // a day with records opens who, when, notes and photos
          return '<span class="' + cls + '" data-day="' + x.iso + '" title="' + e(label) + '" aria-label="' + e(label) + '" role="img">' + face + '</span>';   // the date in every square but a done one (its tick); part done says how many in its label
        }).join('') + '</div>' + (open.key === k && open.iso && open.iso.slice(0, 7) === ym ? dayHtml(v, k, open.iso, docs, vets) : '') + '</div>';
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
    + '.jd.blank{background:transparent;box-shadow:none}.jd.future,.jd.before{opacity:.4}.jd.done,#jobCals button.jd.done{background:var(--ljr-5);box-shadow:none;color:#fff}'
    + '.jd.part,#jobCals button.jd.part{box-shadow:inset 0 0 0 2px var(--ljr-3);background:var(--ljr-3-tint);color:var(--ink)}.jd.missed,#jobCals button.jd.missed{background:transparent;box-shadow:inset 0 0 0 2px var(--ljr-2);position:relative;color:var(--ink)}.jd.missed::after{content:"\\2715";position:absolute;top:1px;right:2px;font-size:8px;line-height:1;font-weight:700;color:var(--ljr-2-text)}.jd.due{box-shadow:inset 0 0 0 2px var(--line)}.jd.today{outline:2px solid var(--ink);outline-offset:-2px}'
    + 'button.jd{border:0;padding:0;font:inherit;cursor:pointer;position:relative;min-width:0}.jd.open{outline:3px solid var(--ink);outline-offset:-3px}'
    + '.jcam{position:absolute;right:1px;bottom:1px;width:12px;height:12px;border-radius:50%;background:var(--card);color:var(--ink);display:flex;align-items:center;justify-content:center}.jcam svg{width:9px;height:9px}'
    + '.jvet{position:absolute;left:1px;top:1px;width:12px;height:12px;border-radius:50%;background:var(--ljr-6);color:#fff;display:flex;align-items:center;justify-content:center}.jvet svg{width:8px;height:8px}.jvet.jkey{position:static;display:inline-flex;width:16px;height:16px}'
    + '.jcal-day{margin-top:8px;border-top:1px solid var(--line);padding-top:8px}.jcal-day ul{margin:6px 0;padding-left:18px}'
    + '.jcal-pics{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.jcal-pics a{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:44px;min-height:44px;color:var(--ink)}.jcal-pics img{width:96px;height:96px;object-fit:cover;border-radius:8px;border:1px solid var(--line)}'
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

  /** A day that is already fully done (every dog, or the one line). A part-done day can still be imported. */
  function dayFullyDone(v, key, iso) {
    var c = month(v, key, String(iso || '').slice(0, 7));
    if (!c) return false;
    var cell = null;
    (c.cells || []).forEach(function (x) { if (x.iso === iso) cell = x; });
    return !!(cell && cell.state === 'done');
  }
  /** Checks every row: [{line, iso, key, label, outcome, note, ok, why}]. Nothing is saved here. */
  function parseImport(v, text) {
    var types = siteTypes(v), byName = {};
    Object.keys(types).forEach(function (k) { byName[k.toLowerCase()] = k; byName[String(types[k].label || '').toLowerCase()] = k; });
    var rows = csvRows(text), out = [], seen = {};
    // The heading row (date, job, ...) may sit under a title line: Numbers puts the table name above it ("daily-records",
    // "Csv"; Lisa 22 Nov 2026). Everything above the heading row is left out; no heading row = every row is data.
    for (var h = 0; h < Math.min(rows.length, 5); h++) {
      var cells = rows[h].map(function (c) { return String(c).trim().toLowerCase(); });
      if (cells.indexOf('date') >= 0 && cells.indexOf('job') >= 0) { rows = rows.slice(h + 1); break; }
    }
    rows.forEach(function (r, i) {
      var iso = isoOf(r[0]), key = byName[String(r[1] || '').trim().toLowerCase()] || '', oc = IMP_OUTCOME[String(r[2] || '').trim().toLowerCase()];
      var x = { line: i + 1, date: String(r[0] || ''), job: String(r[1] || ''), iso: iso, key: key, label: key ? types[key].label || key : '', outcome: oc || '', note: String(r[3] || '').trim(), ok: false, why: '' };
      if (!iso) x.why = 'date not understood (use 2026-11-17 or 17/11/2026)';
      else if (iso > v.today) x.why = 'a future date';
      else if (!key) x.why = 'job not found: use its name as on the calendar';
      else if (!oc) x.why = 'outcome not understood (done, concern or not done)';
      else if (seen[key + '|' + iso]) x.why = 'repeated in this file';
      else if (oc === 'ok' && dayFullyDone(v, key, iso)) x.why = 'already recorded';
      else { x.ok = true; seen[key + '|' + iso] = 1; }
      // Older than 7 days: the save script asks "Save anyway?" for a typed record. Here the owner has seen every date in
      // this list before pressing Import, so Import is that "save anyway" (Lisa 22 Nov 2026: 15 of 16 rows were refused).
      x.old = !!(x.ok && (Date.parse(v.today + 'T00:00:00Z') - Date.parse(iso + 'T00:00:00Z')) / 864e5 >= 7);
      out.push(x);
    });
    return out;
  }
  /** What one imported row sends: a whole-site record for that day, marked import; a per-dog job lists its dogs. */
  function importFields(v, x) {
    var t = siteTypes(v)[x.key]; if (!t) return null;
    var f = { check_type_id: t.id, outcome: x.outcome, how_recorded: 'import', happened_at: x.iso + 'T12:00:00Z' };
    if (x.note) f.note = x.note;
    if (x.old) f.confirm_unusual = 'yes';
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
          + e(word[x.outcome] || '') + '</td><td>' + (x.ok ? (x.old ? 'ready (older than 7 days)' : 'ready') : '<span class="warn">' + e(x.why) + '</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      + '<p>' + (good ? '<button class="btn" type="button" data-jcal-import-go>Import ' + good + ' row' + (good === 1 ? '' : 's') + '</button> ' : '')
      + '<button class="btn quiet" type="button" data-jcal-import-cancel>Cancel</button> <span class="msg" data-jcal-imp-msg role="status"></span></p>';
  }

  return { STARTER: STARTER, chosen: chosen, month: month, html: html, dayHtml: dayHtml, filesByLog: filesByLog, doneFields: doneFields, shift: shift, CSS: CSS, parseImport: parseImport, importFields: importFields, template: template, importPanel: importPanel, previewHtml: previewHtml };
}));
