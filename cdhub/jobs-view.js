/*!
 * BLDJobsView - what the hub shows from BLD-check_type and BLD-check_log rows: done, due and late per job, per SOP and per
 * licence source, and each dog's or room's history. Nothing here names a job. Needs BLDDue. Reads and draws only.
 * A record says someone saved it; "opened from tag" says which screen they used, not that anyone was there.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(root.BLDDue || require('../cdhub-write/records/due.js'));
  else root.BLDJobsView = factory(root.BLDDue);
}(typeof self !== 'undefined' ? self : this, function (Due) {
  'use strict';
  var Show = (typeof module === 'object' && module.exports) ? require('./staff/lib/show-note.js') : ((typeof self !== 'undefined' && self.BLDShowNote) || { human: function (s) { return String(s || ''); } });

  var HOW = { scanned: 'opened from tag', tapped: 'tapped', typed: 'typed', site_tap: 'whole-site tap', paper: 'entered earlier', bulk: 'entered earlier (several days)', import: 'imported' };
  var OUTCOME = { ok: 'done', concern: 'concern', not_done: 'not done', recorded: 'recorded', note: 'note', part_done: 'part done' };
  var memo = null;

  /** One line per job in force: how many of its dogs or rooms are late, due or fine, and when it was last done. */
  function summary(v) {
    var litters = v.litters || [];   // only the litters the caller counts as current (a row decides; none = no litter jobs counted)
    function mix(rows) { var n = 0; (rows || []).forEach(function (r, i) { n = (n + i + String(r.performed_on || r.given_on || r.fitted_on || r.moved_in || r.moved_out || r.state || r.from_date || r.value || '').length * 13) % 1000003; }); return n; }
    var recN = v.records ? Object.keys(v.records).map(function (k) { return k + ':' + ((v.records[k] || []).length) + ':' + mix(v.records[k]); }).join(',') : '';
    var key = v.today + '|' + (v.visits || []).length + '|' + (v.rules || []).length + '|' + (v.links || []).length + '|' + v.logs.length + '|' + v.types.map(function (t) { return t.id; }).join(',') + '|' + (v.dogs || []).length + '|' + (v.subjects || []).length + '|' + (v.occupancy || []).length + ':' + mix(v.occupancy) + '|' + (v.statuses || []).length + ':' + mix(v.statuses) + '|' + recN + '|' + v.areas.length + '|' + litters.map(function (l) { return l.id; }).join(',');
    if (memo && memo.key === key) return memo.rows;
    var rows = {}, perDog = {};
    v.types.forEach(function (t) { if (Due.perDogRoom(t)) perDog[t.type_key] = true; });
    function add(targets, logs) {
      targets.forEach(function (t) {
        Due.forTarget(v.types, logs, t, v.today, v.visits, dueOpts(v)).forEach(function (j) {
          if (t.area_id && perDog[j.type_key]) return;   // counted dog by dog instead
          var r = rows[j.type_key] = rows[j.type_key] || { key: j.type_key, label: j.label, late: 0, due: 0, ok: 0, as_needed: 0, last_done: '' };
          if (j.status === 'late') r.late++;
          else if (j.status === 'today' || j.status === 'never') r.due++;
          else r[j.status]++;
          if (j.last_done > r.last_done) r.last_done = j.last_done;
        });
      });
    }
    var here = dogsNow(v);
    var groups = function (d) { return Due.groupsOf(v.links, d.id, v.today); };
    add(here.map(function (d) { return { subject_id: d.id, everyDog: true, dogArea: d.area_id || d.areaId || '', groups: groups(d) }; }), v.logs);
    add(v.areas.map(function (a) { return areaTarget(a, here); }), v.logs);
    add(litters.map(function (l) { return { litter_id: l.id, born: l.dob || l.born_on || '' }; }), v.logs);   // born: for jobs due by the litter's age
    add([{ dogs: here.map(function (d) { return dogOne(v, d); }) }], v.logs);   // a whole-site job about subjects is done once every one on site that day has a line
    /* every job in force is listed (NAV live check 21 Nov 2026), also one with nothing to count today: a litter job with no
       current litter, a Problem-button job (target optional). Its last record is still shown. */
    var keyOf = Due.familyKeyOf ? Due.familyKeyOf(v.types, v.today) : {}, lastOf = {};
    v.types.forEach(function (t) { if (!keyOf[t.id]) keyOf[t.id] = t.type_key; });
    v.logs.forEach(function (l) {
      var k = keyOf[l.check_type_id], d = Due.londonDate(l.happened_at || l.taken_at);
      if (!k || !d || d > v.today || l.outcome === 'note' || l.outcome === 'not_done' || l.outcome === 'part_done') return;
      if (!lastOf[k] || d > lastOf[k]) lastOf[k] = d;
    });
    function ownLast(t) {
      if (!Due.ownKey || !v.records) return '';
      var table = Due.ownKey(t);
      if (!table) return '';
      var best = '';
      (v.records[table] || []).forEach(function (r) {
        var d = Due.ownDate(table, r);
        if (d && d <= v.today && d > best) best = d;
      });
      return best;
    }
    var inForce = Due.jobsInForce(v.types, v.today);
    inForce.forEach(function (t) {
      var own = ownLast(t), last = lastOf[t.type_key] || '';
      if (own > last) last = own;
      if (!rows[t.type_key]) rows[t.type_key] = { key: t.type_key, label: t.label, late: 0, due: 0, ok: 0, as_needed: 0, last_done: last, none_now: t.target === 'optional' ? 'problem' : t.target === 'litter' ? 'no_litter' : 'none' };
      else if (last > rows[t.type_key].last_done) rows[t.type_key].last_done = last;
    });
    var list = inForce.map(function (t) {
      return Object.assign(rows[t.type_key], { sop: t.sop || '', source: t.source || '', every_days: Due.everyDays(t.every_days), frequency: String(t.frequency || '').trim() });
    }).sort(function (a, b) { return String(a.sop).localeCompare(String(b.sop)) || String(a.label).localeCompare(String(b.label)); });
    memo = { key: key, rows: list };
    return list;
  }

  /** Totals for each licence source the owner typed on the job rows. */
  function bySource(rows) {
    var m = {};
    rows.forEach(function (r) { var s = r.source || ''; var x = m[s] = m[s] || { source: s, jobs: 0, late: 0, due: 0 }; x.jobs++; x.late += r.late; x.due += r.due; });
    return Object.keys(m).sort().map(function (k) { return m[k]; });
  }

  /** The owner's name for a part of the day (row job.day_part.<code>.label in force that day); no row = the code. */
  function partLabel(v, code, day) {
    var best = null;
    (v.rules || []).forEach(function (r) { if (r.rule_key === 'job.day_part.' + code + '.label' && r.effective_from && r.effective_from <= day && (!r.to_date || r.to_date >= day) && (!best || r.effective_from > best.effective_from)) best = r; });
    return (best && String(best.value || '').trim()) || code;
  }

  /** How a record was made, in the owner's words (Lisa 17 Nov 2026: "is that not for the app user to decide?"). Row
      job.how.<how>.label in force that day: its value is the words; "off" hides the words. No row = the starter words.
      The record always keeps how_recorded itself: only what the screen says is the owner's choice. */
  /* Lisa 22 Nov 2026: "the user pays for the app, it is up to them what is displayed". Whether a screen says a record
     was entered later (entered earlier / imported / time not given / "(entered <date>)") is the owner's row
     display.entered_later in force that day: "on" shows it; no row or "off" hides it. The records always keep
     happened_at, taken_at, how_recorded and time_given: only what the screen says changes. */
  var LATE_HOW = { paper: 1, bulk: 1, import: 1 };
  function showLate(v, day) {
    var best = null;
    (v.rules || []).forEach(function (r) { if (r.rule_key === 'display.entered_later' && r.effective_from && r.effective_from <= day && (!r.to_date || r.to_date >= day) && (!best || r.effective_from > best.effective_from)) best = r; });
    return !!best && /^on$/i.test(String(best.value || '').trim());
  }
  function howLabel(v, how, day) {
    if (!how) return '';
    var best = null;
    (v.rules || []).forEach(function (r) { if (r.rule_key === 'job.how.' + how + '.label' && r.effective_from && r.effective_from <= day && (!r.to_date || r.to_date >= day) && (!best || r.effective_from > best.effective_from)) best = r; });
    if (!best) return LATE_HOW[how] && !showLate(v, day) ? '' : (HOW[how] || '');   // an owner's own label row for it still shows
    var w = String(best.value || '').trim();
    return /^off$/i.test(w) ? '' : w;
  }

  /** The file a record's link points at, as a Drive link: the file row's url when it is https, else its Drive file id. */
  function fileUrl(f) {
    var u = String(f.url || '').trim(), id = String(f.drive_file_id || '').trim();
    if (/^https:\/\//i.test(u)) return u;
    return /^[A-Za-z0-9_-]{20,}$/.test(id) ? 'https://drive.google.com/file/d/' + id + '/view' : '';
  }

  /** Files linked to each record (v.links rows from check_log to files, any role, link not ended), keyed by record id. */
  function filesByLog(v) {
    var files = {}, out = {};
    (v.files || []).forEach(function (f) { files[f.id] = f; });
    (v.links || []).forEach(function (k) {
      if (k.from_table !== 'check_log' || k.to_table !== 'files' || (k.to_date && k.to_date <= v.today)) return;
      var f = files[k.to_id], url = f && fileUrl(f);
      if (url) (out[k.from_id] = out[k.from_id] || []).push({ role: String(k.role || 'file').replace(/_/g, ' '), name: f.name || '', url: url });
    });
    return out;
  }

  /** Records for one dog ({subject_id}), one room ({area_id}) or one litter ({litter_id}), newest first. A corrected record gives way to its correction. */
  function history(v, target) {
    var byId = {}, replaced = {}, docs = filesByLog(v);
    v.types.forEach(function (t) { byId[t.id] = t; });
    v.logs.forEach(function (l) { if (l.corrects_id) replaced[l.corrects_id] = true; });
    function sessionBit(l) {
      if (!target.subject_id) return null;
      var ids = String(l.covered_ids || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean);
      var ex = null;
      String(l.exceptions || '').split('|').forEach(function (p) {
        var bits = p.split(':'), id = (bits[0] || '').trim();
        if (id === target.subject_id) ex = { word: bits[1] === 'not_here' ? 'not here' : (bits[1] || 'note'), text: bits.slice(2).join(':').trim() };
      });
      if (ids.indexOf(target.subject_id) < 0 && !ex) return null;
      return ex;
    }
    return v.logs.filter(function (l) {
      if (replaced[l.id] || !byId[l.check_type_id]) return false;
      if (target.litter_id) return l.litter_id === target.litter_id;
      if (target.subject_id) return l.subject_id === target.subject_id || sessionBit(l) !== null || String(l.covered_ids || '').split('|').indexOf(target.subject_id) >= 0;
      return l.area_id === target.area_id;
    }).map(function (l) {
      var tg = String(l.time_given || ''), at = l.happened_at || l.taken_at || '', bit = target.subject_id && l.subject_id !== target.subject_id ? sessionBit(l) : null;
      var inRound = target.subject_id && l.subject_id !== target.subject_id && (String(l.covered_ids || '').split('|').indexOf(target.subject_id) >= 0 || bit);
      return { at: at, noTime: tg.toLowerCase() === 'false', part: /^part:/i.test(tg) ? partLabel(v, tg.slice(5), Due.londonDate(at)) : '', label: byId[l.check_type_id].label, outcome: l.outcome, by: l.taken_by || '', how: l.how_recorded || '', note: Show.human((bit && bit.text) || l.note || ''), item: inRound ? ('included in the round' + (bit ? ' · ' + bit.word : '')) : (l.item || ''), amount: l.amount || '', files: docs[l.id] || [] };
    }).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
  }

  /** Best to worst: fewest late, then fewest due, then SOP and name. */
  function bestFirst(a, b) { return a.late - b.late || a.due - b.due || String(a.sop).localeCompare(String(b.sop)) || String(a.label).localeCompare(String(b.label)); }

  /** Compliance: done, due and late per job, best to worst. Each number opens the SOP it belongs to (v.sopHref). */
  function complianceHtml(v, pill) {
    var e = v.esc, rows = summary(v).slice().sort(bestFirst), late = rows.reduce(function (n, r) { return n + r.late; }, 0);
    var open = v.fold ? v.fold('jobs') : ' open';
    var h = '<section class="card" id="compJobs"><details class="compfold" data-fold="jobs"' + open + '><summary><h3>Jobs' + pill(late) + '</h3></summary>';
    if (!rows.length) return h + '<p class="mut">No job rows yet.</p></details></section>';
    function cell(r, n, cls, k) {
      var href = r.sop && v.sopHref ? v.sopHref(r.sop) : '';
      var inner = n ? '<span class="pill ' + cls + '">' + n + '</span>' : '<span class="mut">0</span>';
      return '<td data-n="' + k + '">' + (href ? '<a href="' + e(href) + '" aria-label="' + n + ' ' + k + ', open ' + e(r.sop) + '">' + inner + '</a>' : inner) + '</td>';
    }
    // Lisa 17 Nov 2026 (checks A): an owner's note covering a past period (how_recorded owner_note) is shown as written,
    // with the day it was entered, so anyone reading sees it was recorded afterwards.
    var notes = (v.logs || []).filter(function (l) { return String(l.how_recorded || '') === 'owner_note' && l.note; });
    var seenNote = {};
    notes.forEach(function (l) { var k = l.note; if (seenNote[k]) return; seenNote[k] = 1;
      var lateOn = showLate(v, v.today || String(l.taken_at || '').slice(0, 10));
      h += '<p class="note" data-owner-note>Owner\u2019s note: ' + e(l.note) + (l.taken_at && lateOn ? ' <span class="mut">(entered ' + e(v.dmy ? v.dmy(String(l.taken_at).slice(0, 10)) : String(l.taken_at).slice(0, 10)) + (l.taken_by ? ' by ' + e(l.taken_by) : '') + ')</span>' : '') + '</p>'; });
    h += '<p class="mut">From saved records. Counts are dogs, rooms or litters.</p><div class="scroll" tabindex="0" role="group" aria-label="Table, scroll sideways for more"><table><thead><tr><th>SOP</th><th>job</th><th>done</th><th>due</th><th>late</th><th>last</th></tr></thead><tbody>'
      + rows.map(function (r) {
        var sop = r.sop ? (v.sopHref ? '<a href="' + e(v.sopHref(r.sop)) + '">' + e(r.sop) + '</a>' : e(r.sop)) : '—';
        var done = NONE_NOW[r.none_now] ? '<td data-n="done"><span class="mut">' + NONE_NOW[r.none_now] + '</span></td>'
          : r.as_needed && !r.ok ? '<td data-n="done"><span class="mut">as needed</span></td>' : cell(r, r.ok, 'ok', 'done');
        return '<tr data-job="' + e(r.key) + '"><td class="mut">' + sop + '</td><td><b>' + e(r.label) + '</b> <span class="mut" data-every>' + e(timing(r)) + '</span>' + rowDoneHtml(v, r) + '</td>' + done + cell(r, r.due, 'w', 'due') + cell(r, r.late, 'no', 'late')
          + '<td class="mut" data-n="last">' + e(r.last_done ? v.dmy(r.last_done) : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    h += '<h4>By licence source</h4><div class="scroll" tabindex="0" role="group" aria-label="Table, scroll sideways for more"><table><thead><tr><th>source</th><th>jobs</th><th>due</th><th>late</th></tr></thead><tbody>'
      + bySource(rows).sort(function (a, b) { return a.late - b.late || a.due - b.due || String(a.source).localeCompare(String(b.source)); }).map(function (s) {
        function n(x, cls) { return '<td>' + (x ? '<span class="pill ' + cls + '">' + x + '</span>' : '<span class="mut">0</span>') + '</td>'; }
        return '<tr data-source="' + e(s.source) + '"><td>' + e(s.source || 'No source entered') + '</td><td>' + s.jobs + '</td>' + n(s.due, 'w') + n(s.late, 'no') + '</tr>';
      }).join('') + '</tbody></table></div>';
    return h + '</details></section>';
  }

  /** How often, in words, from the job row's every_days: 365 = every 12 months, 14 = every 2 weeks; null = as needed. */
  function everyWords(n) {
    if (!n) return 'as needed';
    if (n === 1) return 'daily';
    if (n === 7) return 'weekly';
    if (n % 365 === 0) return 'every ' + (n / 365 * 12) + ' months';
    if (n % 7 === 0) return 'every ' + (n / 7) + ' weeks';
    return 'every ' + n + ' days';
  }

  /** The job's timing in the owner's own words (its frequency, e.g. "Daily and when dirty"), else from every_days. */
  function timing(r) { return r.frequency || everyWords(r.every_days); }
  /** Why a job has nothing to count today: no current litter, or it is recorded from the Problem button. */
  var NONE_NOW = { no_litter: 'no litter now', problem: 'Problem button' };

  /** The job row in force today for a type_key, or null. */
  function typeInForce(v, key) {
    var list = Due.jobsInForce(v.types || [], v.today);
    for (var i = 0; i < list.length; i++) if (list[i].type_key === key) return list[i];
    return null;
  }
  function yes(v) { return String(v).toLowerCase() === 'true'; }
  /** A London wall-clock date and time as a UTC ISO time. Noon is the earlier-day default. */
  function londonIso(date, time) {
    var p = String(date || '').split('-').map(Number), q = String(time || '12:00').split(':').map(Number);
    if (p.length < 3 || !(p[0] > 0)) return '';
    var guess = Date.UTC(p[0], p[1] - 1, p[2], q[0] || 0, q[1] || 0);
    var f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(guess));
    var g = {};
    f.forEach(function (x) { g[x.type] = Number(x.value); });
    return new Date(guess - (Date.UTC(g.year, g.month - 1, g.day, g.hour, g.minute) - guess)).toISOString();
  }
  /** Put the chosen day on a tap. Today keeps the real time. An earlier day is noon London, and confirm_unusual so an old day is kept. */
  function applyDay(fields, day, today, now) {
    if (day && day > today) return false;
    if (!day || day === today) { if (now) fields.happened_at = now; return true; }
    var at = londonIso(day, '12:00');
    if (!at) return false;
    fields.happened_at = at;
    fields.confirm_unusual = 'yes';
    return true;
  }
  /** Due, late, or never recorded. A job with no litter on site has nothing to record. */
  function needsRecord(r) {
    if (!r || r.none_now === 'no_litter') return false;
    if (r.due || r.late) return true;
    return !r.last_done;
  }
  function openJob(j) {
    if (!j) return false;
    if (j.status === 'late' || j.status === 'today' || j.status === 'never') return true;
    return j.status === 'as_needed' && !j.last_done;
  }
  function dueOpts(v) { return { rules: v.rules || [], settings: v.settings || [], records: v.records || null }; }
  function dogsNow(v) {
    var list = v.subjects || v.dogs || [];
    if (!v.occupancy) return v.dogs || [];
    return list.filter(function (d) { return Due.onSite(d, v.occupancy, v.statuses || [], v.today); });
  }
  function areaTarget(a, here) {
    var ids = (here || []).filter(function (d) { return (d.area_id || d.areaId) === a.id; }).map(function (d) { return d.id; });
    return { area_id: a.id, roomDogIds: ids, areaKind: a.kind || '', areaUse: a.use || '', areaGroup: a.grouping || a.group || '', areaRetired: !!a.retired, areaNoDogs: !!a.noDogs };
  }
  function dogGroups(v, d) { return d.groups || Due.groupsOf(v.links || [], d.id, v.today); }
  function dogOne(v, d) { return { id: d.id, area_id: d.area_id || d.areaId || '', groups: dogGroups(v, d), dob: d.dob || '', kind: d.kind || '' }; }
  function jobFor(v, target, key) {
    var list = Due.forTarget(v.types, v.logs, target, v.today, v.visits || [], dueOpts(v));
    for (var i = 0; i < list.length; i++) if (list[i].type_key === key) return list[i];
    return null;
  }
  /**
   * Who still needs this check recorded: dogs, rooms, litters, or one whole-site line.
   * A dog job (target dog) is listed dog by dog. Board > Jobs never shows those, and has no Select all for them.
   */
  function dueItems(v, t) {
    var dogs = dogsNow(v), areas = v.areas || [], litters = v.litters || [];
    function dogItem(d) { return { kind: 'dog', id: d.id, area_id: d.area_id || d.areaId || '', label: d.name || d.label || d.id }; }
    if (Due.perDogSite(t)) {
      return dogs.filter(function (d) { return openJob(jobFor(v, { dogs: [dogOne(v, d)] }, t.type_key)); }).map(dogItem);
    }
    if (t.target === 'dog' || Due.perDogRoom(t)) {
      return dogs.filter(function (d) {
        return openJob(jobFor(v, { subject_id: d.id, everyDog: true, dogArea: d.area_id || d.areaId || '', groups: dogGroups(v, d) }, t.type_key));
      }).map(dogItem);
    }
    if (t.target === 'area') {
      return areas.filter(function (a) {
        return openJob(jobFor(v, areaTarget(a, dogs), t.type_key));
      }).map(function (a) { return { kind: 'area', id: a.id, label: a.code || a.name || a.label || a.id }; });
    }
    if (t.target === 'either') {
      var ds = dogs.filter(function (d) {
        return openJob(jobFor(v, { subject_id: d.id, everyDog: true, dogArea: d.area_id || d.areaId || '', groups: dogGroups(v, d) }, t.type_key));
      }).map(dogItem);
      var as = areas.filter(function (a) { return openJob(jobFor(v, areaTarget(a, dogs), t.type_key)); }).map(function (a) {
        return { kind: 'area', id: a.id, label: a.code || a.name || a.label || a.id };
      });
      return ds.concat(as);
    }
    if (t.target === 'litter') {
      return litters.filter(function (l) {
        return openJob(jobFor(v, { litter_id: l.id, born: l.dob || l.born_on || l.born || '' }, t.type_key));
      }).map(function (l) { return { kind: 'litter', id: l.id, label: l.name || l.label || 'Litter' }; });
    }
    if (t.target === 'none') {
      return openJob(jobFor(v, {}, t.type_key)) ? [{ kind: 'site', id: '', label: 'Whole site' }] : [];
    }
    if (t.target === 'optional') return [{ kind: 'site', id: '', label: t.label || 'This check' }];
    return [];
  }
  /**
   * Dogs, rooms or litters this job can be recorded against, including ones already done.
   * due is true when that one is still late, due or never recorded. A whole-site line is a single site item.
   */
  function pickList(v, t) {
    if (!t) return [];
    var dogs = v.dogs || [], areas = v.areas || [], litters = v.litters || [];
    function dogItem(d) {
      var target = { subject_id: d.id, everyDog: true, dogArea: d.area_id || d.areaId || '', groups: dogGroups(v, d) };
      if (Due.perDogSite(t)) target = { dogs: [dogOne(v, d)] };
      var j = jobFor(v, target, t.type_key);
      if (!j) return null;
      return { kind: 'dog', id: d.id, area_id: d.area_id || d.areaId || '', label: d.name || d.label || d.id, due: openJob(j) };
    }
    if (Due.perDogSite(t)) {
      var covered = {}, out = [];
      Due.dogsFor(t, { dogs: dogs.map(function (d) { return dogOne(v, d); }) }).forEach(function (x) { covered[x.id] = x; });
      dogs.forEach(function (d) { if (!covered[d.id]) return; var item = dogItem(d); if (item) out.push(item); });
      return out;
    }
    if (t.target === 'dog' || Due.perDogRoom(t)) {
      return dogs.map(dogItem).filter(Boolean);
    }
    if (t.target === 'area') {
      return areas.map(function (a) {
        var ids = dogs.filter(function (d) { return (d.area_id || d.areaId) === a.id; }).map(function (d) { return d.id; });
        var j = jobFor(v, { area_id: a.id, roomDogIds: ids }, t.type_key);
        if (!j) return null;
        return { kind: 'area', id: a.id, label: a.code || a.name || a.label || a.id, due: openJob(j) };
      }).filter(Boolean);
    }
    if (t.target === 'either') {
      return dogs.map(dogItem).filter(Boolean).concat(areas.map(function (a) {
        var j = jobFor(v, { area_id: a.id }, t.type_key);
        if (!j) return null;
        return { kind: 'area', id: a.id, label: a.code || a.name || a.label || a.id, due: openJob(j) };
      }).filter(Boolean));
    }
    if (t.target === 'litter') {
      return litters.map(function (l) {
        var j = jobFor(v, { litter_id: l.id, born: l.dob || l.born_on || l.born || '' }, t.type_key);
        if (!j) return null;
        return { kind: 'litter', id: l.id, label: l.name || l.label || 'Litter', due: openJob(j) };
      }).filter(Boolean);
    }
    if (t.target === 'none') {
      var jn = jobFor(v, {}, t.type_key);
      return [{ kind: 'site', id: '', label: 'Whole site', due: openJob(jn) }];
    }
    if (t.target === 'optional') return [{ kind: 'site', id: '', label: t.label || 'This check', due: true }];
    return [];
  }
  /** A dog, room or litter job needs the same chooser the Board opens before it saves. A whole-site line does not. */
  function needsPick(t) {
    if (!t) return false;
    if (Due.perDogSite(t) || Due.perDogRoom(t)) return true;
    return t.target === 'dog' || t.target === 'area' || t.target === 'litter' || t.target === 'either';
  }
  /** What a save still needs, in the same words as the staff check form. */
  function gaps(type, entry) {
    var e = {};
    if (type.target === 'area' && !entry.area_id) e.area_id = 'Choose the room.';
    if (type.target === 'dog' && !entry.subject_id) e.subject_id = 'Choose the dog.';
    if (type.target === 'litter' && !entry.litter_id) e.litter_id = 'Choose the litter.';
    if (type.target === 'either' && !entry.area_id && !entry.subject_id) e.area_id = 'Choose a room or a dog.';
    if (yes(type.asks_item) && !entry.item) e.item = (type.item_label || 'This') + ' is needed.';
    if (yes(type.asks_amount) && !entry.amount) e.amount = 'Amount is needed.';
    if (yes(type.note_required) && !entry.note) e.note = (type.note_label || 'A note') + ' is needed.';
    return e;
  }
  /**
   * The check_log saves for the ticked rows. Dog and room jobs are one add each (subject_id or area_id).
   * A litter job sends litter_id and no subject_id. A whole-site job about dogs is one add_site.
   * how_recorded is tapped, or site_tap for a whole-site line. happened_at is the real time. Never a paper catch-up.
   */
  function savePlans(v, key, picked, extra, now) {
    var t = typeInForce(v, key);
    if (!t) return { error: 'That check is not set up.' };
    extra = extra || {};
    var base = { check_type_id: t.id, outcome: String(t.asks_outcome).toLowerCase() === 'false' ? 'recorded' : 'ok', happened_at: now || '' };
    if (extra.item) base.item = extra.item;
    if (extra.amount) base.amount = extra.amount;
    if (extra.note) base.note = extra.note;
    var list = picked || [];
    if (t.target === 'none' && Due.perDogSite(t)) {
      var ids = list.filter(function (p) { return p.kind === 'dog' && p.id; }).map(function (p) { return p.id; });
      if (!ids.length) return { error: 'Tick a dog.' };
      var site = Object.assign({}, base, { how_recorded: 'site_tap', dog_ids: ids.join('|') });
      var sg = gaps(t, site), sk = Object.keys(sg)[0];
      if (sk) return { error: sg[sk] };
      return { plans: [{ action: 'add_site', fields: site }] };
    }
    if (!list.length && (t.target === 'none' || t.target === 'optional')) list = [{ kind: 'site' }];
    if (!list.length) return { error: 'Tick one.' };
    var plans = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i], f = Object.assign({}, base, { how_recorded: p.kind === 'site' && t.target === 'none' ? 'site_tap' : 'tapped' });
      if (p.kind === 'dog') f.subject_id = p.id;
      if (p.kind === 'area') f.area_id = p.id;
      if (p.kind === 'dog' && Due.perDogRoom(t) && p.area_id) f.area_id = p.area_id;
      if (p.kind === 'litter') { f.litter_id = p.id; delete f.subject_id; }
      var g = gaps(t, f), first = Object.keys(g)[0];
      if (first) return { error: g[first] };
      plans.push({ action: 'add', fields: f });
    }
    return { plans: plans };
  }
  /**
   * The save a tap on The Board, Jobs, sends for this job. Whole-site lines are one add_site
   * (how_recorded site_tap). A dog, room or litter line is one add (how_recorded tapped), and a
   * room job about dogs is one add_site for the ticked dogs in that room. Today uses the real time.
   * An earlier day is noon Europe/London. taken_by is stamped by the save from the signed-in user.
   */
  function tapPlans(v, key, picked, extra, day, now) {
    var t = typeInForce(v, key);
    if (!t) return { error: 'That check is not set up.' };
    day = day || v.today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return { error: 'Pick today or an earlier day.' };
    if (day > v.today) return { error: 'Pick today or an earlier day.' };
    extra = extra || {};
    var outcome = String(t.asks_outcome).toLowerCase() === 'false' ? 'recorded' : 'ok';
    function withExtra(fields) {
      if (extra.item) fields.item = extra.item;
      if (extra.amount) fields.amount = extra.amount;
      if (extra.note) fields.note = extra.note;
      return fields;
    }
    function dated(fields) {
      if (!applyDay(fields, day, v.today, now)) return null;
      return fields;
    }
    if (Due.perDogSite(t)) {
      var ids = (picked || []).filter(function (p) { return p.kind === 'dog' && p.id; }).map(function (p) { return p.id; });
      if (!ids.length) return { error: 'Tick a dog.' };
      var site = dated(withExtra({ check_type_id: t.id, outcome: outcome, how_recorded: 'site_tap', dog_ids: ids.join('|') }));
      if (!site) return { error: 'Pick today or an earlier day.' };
      var sg = gaps(t, site), sk = Object.keys(sg)[0];
      if (sk) return { error: sg[sk] };
      return { plans: [{ action: 'add_site', fields: site }] };
    }
    if (Due.perDogRoom(t)) {
      var groups = {};
      (picked || []).forEach(function (p) {
        if (p.kind !== 'dog' || !p.id || !p.area_id) return;
        (groups[p.area_id] = groups[p.area_id] || []).push(p.id);
      });
      var areas = Object.keys(groups);
      if (!areas.length) return { error: 'Tick a dog.' };
      var roomPlans = [];
      for (var i = 0; i < areas.length; i++) {
        var rf = dated(withExtra({ check_type_id: t.id, outcome: outcome, how_recorded: 'site_tap', area_id: areas[i], dog_ids: groups[areas[i]].join('|') }));
        if (!rf) return { error: 'Pick today or an earlier day.' };
        var rg = gaps(t, rf), rk = Object.keys(rg)[0];
        if (rk) return { error: rg[rk] };
        roomPlans.push({ action: 'add_site', fields: rf });
      }
      return { plans: roomPlans };
    }
    var list = picked || [];
    if (!list.length && (t.target === 'none' || t.target === 'optional')) list = [{ kind: 'site' }];
    var plan = savePlans(v, key, list, extra, now || '');
    if (plan.error || !plan.plans) return plan;
    if (t.target === 'none') plan.plans.forEach(function (p) { p.action = 'add_site'; p.fields.how_recorded = 'site_tap'; });
    for (var j = 0; j < plan.plans.length; j++) {
      if (!dated(plan.plans[j].fields)) return { error: 'Pick today or an earlier day.' };
    }
    return plan;
  }
  function recordFields(e, t, prefix) {
    prefix = prefix || 'sop';
    var h = '';
    if (yes(t.asks_item)) h += '<div class="frow"><label>' + e(t.item_label || 'What') + ' <input data-' + prefix + '-item="' + e(t.type_key) + '" aria-label="' + e(t.item_label || 'What') + '"></label></div>';
    if (yes(t.asks_amount)) h += '<div class="frow"><label>' + e(t.amount_unit ? 'Amount (' + t.amount_unit + ')' : 'Amount') + ' <input data-' + prefix + '-amount="' + e(t.type_key) + '" aria-label="Amount"></label></div>';
    if (yes(t.note_required)) h += '<div class="frow"><label>' + e(t.note_label || 'Note') + ' <input data-' + prefix + '-note="' + e(t.type_key) + '" aria-label="' + e(t.note_label || 'Note') + '"></label></div>';
    return h;
  }
  function dayInput(e, attr, key, today, label) {
    return '<input type="date" ' + attr + '="' + e(key) + '" max="' + e(today || '') + '" value="' + e(today || '') + '" aria-label="Day done: ' + e(label) + '">';
  }
  /** Tick rows for a dog, room or litter chooser. Due ones start ticked, except a whole-site job about dogs (those start clear, as on the Board). */
  function choiceHtml(e, attr, allAttr, key, items, precheck) {
    var ticks = items.map(function (p) {
      var on = precheck(p) ? ' checked' : '';
      return '<label class="dcs-row"><input type="checkbox" ' + attr + '="' + e(key) + '" data-kind="' + e(p.kind) + '"' + (p.area_id ? ' data-area="' + e(p.area_id) + '"' : '') + (p.due ? '' : ' data-done="1"') + ' value="' + e(p.id) + '"' + on + '> ' + e(p.label) + '</label>';
    }).join('');
    var all = items.length > 1 ? '<button type="button" class="btn quiet" ' + allAttr + '="' + e(key) + '">Select all</button>' : '';
    return all + ticks;
  }
  /** Date plus a tick on each Jobs row. Dog, room and litter jobs keep a chooser, hidden until the tick is pressed. */
  function rowDoneHtml(v, row) {
    var e = v.esc, t = typeInForce(v, row.key);
    if (!t) return '';
    var items = needsPick(t) ? pickList(v, t).filter(function (p) { return p.kind !== 'site'; }) : [];
    var asks = yes(t.asks_item) || yes(t.asks_amount) || yes(t.note_required);
    var pick = '';
    if (items.length || asks) {
      var pre = !Due.perDogSite(t);
      pick = '<div data-job-pick="' + e(row.key) + '" hidden>' + choiceHtml(e, 'data-job-tick', 'data-job-all', row.key, items, function (p) { return pre && p.due; }) + recordFields(e, t, 'job') + '</div>';
    }
    var flash = v.doneNote && v.doneNote.key === row.key ? (v.doneNote.html || '') : '';
    return '<div class="frow" data-job-box="' + e(row.key) + '">' + dayInput(e, 'data-job-day', row.key, v.today, row.label)
      + '<button type="button" class="btn" data-job-done="' + e(row.key) + '" aria-label="Done: ' + e(row.label) + '">\u2713</button></div>'
      + pick + '<p class="mut" data-job-msg="' + e(row.key) + '" role="status">' + flash + '</p>';
  }
  /** Record / Done under a job. Due dogs or rooms start ticked. When none are due, the same control stays so an earlier day can still be recorded. */
  function recordHtml(v, row) {
    var e = v.esc, t = typeInForce(v, row.key);
    if (!t) return '';
    var open = dueItems(v, t);
    var items = open.length ? open : (needsPick(t) ? pickList(v, t).filter(function (p) { return p.kind !== 'site'; }) : (t.target === 'none' || t.target === 'optional' ? [{ kind: 'site', id: '', label: 'Whole site' }] : []));
    var pre = open.length > 0;
    var verb = (!row.last_done && !row.due && !row.late) ? 'Record' : 'Done';
    var day = dayInput(e, 'data-sop-day', row.key, v.today, row.label);
    if (!items.length) {
      return '<div data-sop-record="' + e(row.key) + '"><p class="mut" data-sop-empty="' + e(row.key) + '">Nothing here to record.</p><div class="frow">' + day
        + '<button type="button" class="btn" data-sop-save="' + e(row.key) + '">' + e(verb) + '</button></div>'
        + '<p class="mut" data-sop-msg="' + e(row.key) + '" role="status"></p></div>';
    }
    var many = items.length > 1;
    var text = pre && many ? 'Mark all due as done today' : verb;
    var ticks = many ? items.map(function (p) {
      var on = pre ? ' checked' : '';
      return '<label class="dcs-row"><input type="checkbox" data-sop-tick="' + e(row.key) + '" data-kind="' + e(p.kind) + '"' + (p.area_id ? ' data-area="' + e(p.area_id) + '"' : '') + ' value="' + e(p.id) + '"' + on + '> ' + e(p.label) + '</label>';
    }).join('') : '';
    var one = many ? '' : ' data-one-kind="' + e(items[0].kind) + '" data-one-id="' + e(items[0].id || '') + '"' + (items[0].area_id ? ' data-one-area="' + e(items[0].area_id) + '"' : '');
    var who = (!many && items[0].kind !== 'site') ? '<span class="mut">' + e(items[0].label) + '</span>' : '';
    return '<div data-sop-record="' + e(row.key) + '"' + one + '>' + ticks + who + recordFields(e, t)
      + '<div class="frow">' + day + '<button type="button" class="btn" data-sop-save="' + e(row.key) + '">' + e(text) + '</button></div>'
      + '<p class="mut" data-sop-msg="' + e(row.key) + '" role="status"></p></div>';
  }

  function sopHtml(v, name) {
    var e = v.esc, rows = summary(v).filter(function (r) { return r.sop === name; });
    if (!rows.length) return '';
    return '<div class="sopjobs" data-sopjobs="' + e(name) + '">' + rows.map(function (r) {
      var state = r.late ? '<span class="pill no">' + r.late + ' late</span>' : r.due ? '<span class="pill w">' + r.due + ' due</span>' : NONE_NOW[r.none_now] ? '<span class="mut" data-none>' + NONE_NOW[r.none_now] + '</span>' : '';
      return '<div class="dcs-row"><b>' + e(r.label) + '</b><span class="mut" data-every>' + e(timing(r)) + '</span><span class="mut">' + e(r.last_done ? 'last ' + v.dmy(r.last_done) : 'not recorded') + '</span>' + state + '</div>' + recordHtml(v, r);
    }).join('') + '</div>';
  }

  function historyHtml(v, target, icon) {
    var e = v.esc, rows = history(v, target), shown = rows.slice(0, 30);
    return '<details class="dcs" data-history="' + e(target.litter_id || target.subject_id || target.area_id) + '"><summary>' + icon + '<span class="dcs-label">'
      + (rows.length ? '<b>' + rows.length + '</b> job record' + (rows.length === 1 ? '' : 's') : '<span class="mut">no job records</span>') + '</span></summary><div class="dcs-bd">'
      + (shown.length ? shown.map(function (r) {
        return '<div class="dcs-row"><span class="mut">' + e(v.dmy(Due.londonDate(r.at) || String(r.at).slice(0, 10))) + '</span><b>' + e(r.label) + '</b>' + (r.outcome === 'ok' ? '' : '<span class="pill">' + e(OUTCOME[r.outcome] || r.outcome) + '</span>')
          + [r.item, r.amount, r.note, r.by, howLabel(v, r.how, Due.londonDate(r.at) || String(r.at).slice(0, 10)), r.part, r.noTime && showLate(v, Due.londonDate(r.at) || String(r.at).slice(0, 10)) ? 'time not given' : ''].filter(Boolean).map(function (x) { return '<span class="mut">' + e(x) + '</span>'; }).join('')
          + r.files.map(function (f) { return '<a href="' + e(f.url) + '" target="_blank" rel="noopener noreferrer" data-record-file title="' + e(f.name) + '">' + e(f.role) + '</a>'; }).join('') + '</div>';
      }).join('') : '<span class="mut">No records</span>') + '</div></details>';
  }

  return { summary: summary, everyWords: everyWords, timing: timing, bySource: bySource, history: history, howLabel: howLabel, complianceHtml: complianceHtml, sopHtml: sopHtml, historyHtml: historyHtml, needsRecord: needsRecord, dueItems: dueItems, pickList: pickList, savePlans: savePlans, tapPlans: tapPlans, londonIso: londonIso, recordHtml: recordHtml };
}));
