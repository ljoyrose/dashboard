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

  var HOW = { scanned: 'opened from tag', tapped: 'tapped', typed: 'typed', site_tap: 'whole-site tap', paper: 'entered earlier', bulk: 'entered earlier (several days)', import: 'imported' };
  var OUTCOME = { ok: 'done', concern: 'concern', not_done: 'not done', recorded: 'recorded', note: 'note', part_done: 'part done' };
  var memo = null;

  /** One line per job in force: how many of its dogs or rooms are late, due or fine, and when it was last done. */
  function summary(v) {
    var litters = v.litters || [];   // only the litters the caller counts as current (a row decides; none = no litter jobs counted)
    var key = v.today + '|' + (v.visits || []).length + '|' + (v.rules || []).length + '|' + (v.links || []).length + '|' + v.logs.length + '|' + v.types.map(function (t) { return t.id; }).join(',') + '|' + v.dogs.length + '|' + v.areas.length + '|' + litters.map(function (l) { return l.id; }).join(',');
    if (memo && memo.key === key) return memo.rows;
    var rows = {}, perDog = {};
    v.types.forEach(function (t) { if (Due.perDogRoom(t)) perDog[t.type_key] = true; });
    function add(targets, logs) {
      targets.forEach(function (t) {
        Due.forTarget(v.types, logs, t, v.today, v.visits, { rules: v.rules }).forEach(function (j) {
          if (t.area_id && perDog[j.type_key]) return;   // counted dog by dog instead
          var r = rows[j.type_key] = rows[j.type_key] || { key: j.type_key, label: j.label, late: 0, due: 0, ok: 0, as_needed: 0, last_done: '' };
          if (j.status === 'late') r.late++;
          else if (j.status === 'today' || j.status === 'never') r.due++;
          else r[j.status]++;
          if (j.last_done > r.last_done) r.last_done = j.last_done;
        });
      });
    }
    var groups = function (d) { return Due.groupsOf(v.links, d.id, v.today); };
    add(v.dogs.map(function (d) { return { subject_id: d.id, everyDog: true, dogArea: d.area_id || d.areaId || '', groups: groups(d) }; }), v.logs);
    add(v.areas.map(function (a) { return { area_id: a.id }; }), v.logs);
    add(litters.map(function (l) { return { litter_id: l.id }; }), v.logs);
    add([{ dogs: v.dogs.map(function (d) { return { id: d.id, area_id: d.area_id || d.areaId || '', groups: groups(d) }; }) }], v.logs);   // a whole-site job about dogs is done once every dog has a line
    /* every job in force is listed (NAV live check 21 Nov 2026), also one with nothing to count today: a litter job with no
       current litter, a Problem-button job (target optional). Its last record is still shown. */
    var keyOf = {}, lastOf = {};
    v.types.forEach(function (t) { keyOf[t.id] = t.type_key; });
    v.logs.forEach(function (l) {
      var k = keyOf[l.check_type_id], d = Due.londonDate(l.happened_at || l.taken_at);
      if (!k || !d || d > v.today || l.outcome === 'note' || l.outcome === 'not_done' || l.outcome === 'part_done') return;
      if (!lastOf[k] || d > lastOf[k]) lastOf[k] = d;
    });
    var inForce = Due.jobsInForce(v.types, v.today);
    inForce.forEach(function (t) {
      if (!rows[t.type_key]) rows[t.type_key] = { key: t.type_key, label: t.label, late: 0, due: 0, ok: 0, as_needed: 0, last_done: lastOf[t.type_key] || '', none_now: t.target === 'optional' ? 'problem' : t.target === 'litter' ? 'no_litter' : 'none' };
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
  function howLabel(v, how, day) {
    if (!how) return '';
    var best = null;
    (v.rules || []).forEach(function (r) { if (r.rule_key === 'job.how.' + how + '.label' && r.effective_from && r.effective_from <= day && (!r.to_date || r.to_date >= day) && (!best || r.effective_from > best.effective_from)) best = r; });
    if (!best) return HOW[how] || '';
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
    return v.logs.filter(function (l) {
      return !replaced[l.id] && byId[l.check_type_id] && (target.litter_id ? l.litter_id === target.litter_id : target.subject_id ? l.subject_id === target.subject_id : l.area_id === target.area_id);
    }).map(function (l) {
      var tg = String(l.time_given || ''), at = l.happened_at || l.taken_at || '';
      return { at: at, noTime: tg.toLowerCase() === 'false', part: /^part:/i.test(tg) ? partLabel(v, tg.slice(5), Due.londonDate(at)) : '', label: byId[l.check_type_id].label, outcome: l.outcome, by: l.taken_by || '', how: l.how_recorded || '', note: l.note || '', item: l.item || '', amount: l.amount || '', files: docs[l.id] || [] };
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
      h += '<p class="note" data-owner-note>Owner\u2019s note: ' + e(l.note) + (l.taken_at ? ' <span class="mut">(entered ' + e(v.dmy ? v.dmy(String(l.taken_at).slice(0, 10)) : String(l.taken_at).slice(0, 10)) + (l.taken_by ? ' by ' + e(l.taken_by) : '') + ')</span>' : '') + '</p>'; });
    h += '<p class="mut">From saved records. Counts are dogs, rooms or litters.</p><div class="scroll" tabindex="0" role="group" aria-label="Table, scroll sideways for more"><table><thead><tr><th>SOP</th><th>job</th><th>done</th><th>due</th><th>late</th><th>last</th></tr></thead><tbody>'
      + rows.map(function (r) {
        var sop = r.sop ? (v.sopHref ? '<a href="' + e(v.sopHref(r.sop)) + '">' + e(r.sop) + '</a>' : e(r.sop)) : '—';
        var done = NONE_NOW[r.none_now] ? '<td data-n="done"><span class="mut">' + NONE_NOW[r.none_now] + '</span></td>'
          : r.as_needed && !r.ok ? '<td data-n="done"><span class="mut">as needed</span></td>' : cell(r, r.ok, 'ok', 'done');
        return '<tr data-job="' + e(r.key) + '"><td class="mut">' + sop + '</td><td><b>' + e(r.label) + '</b> <span class="mut" data-every>' + e(timing(r)) + '</span></td>' + done + cell(r, r.due, 'w', 'due') + cell(r, r.late, 'no', 'late')
          + '<td class="mut">' + e(r.last_done ? v.dmy(r.last_done) : '—') + '</td></tr>';
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

  function sopHtml(v, name) {
    var e = v.esc, rows = summary(v).filter(function (r) { return r.sop === name; });
    if (!rows.length) return '';
    return '<div class="sopjobs" data-sopjobs="' + e(name) + '">' + rows.map(function (r) {
      var state = r.late ? '<span class="pill no">' + r.late + ' late</span>' : r.due ? '<span class="pill w">' + r.due + ' due</span>' : NONE_NOW[r.none_now] ? '<span class="mut" data-none>' + NONE_NOW[r.none_now] + '</span>' : '';
      return '<div class="dcs-row"><b>' + e(r.label) + '</b><span class="mut" data-every>' + e(timing(r)) + '</span><span class="mut">' + e(r.last_done ? 'last ' + v.dmy(r.last_done) : 'not recorded') + '</span>' + state + '</div>';
    }).join('') + '</div>';
  }

  function historyHtml(v, target, icon) {
    var e = v.esc, rows = history(v, target), shown = rows.slice(0, 30);
    return '<details class="dcs" data-history="' + e(target.litter_id || target.subject_id || target.area_id) + '"><summary>' + icon + '<span class="dcs-label">'
      + (rows.length ? '<b>' + rows.length + '</b> job record' + (rows.length === 1 ? '' : 's') : '<span class="mut">no job records</span>') + '</span></summary><div class="dcs-bd">'
      + (shown.length ? shown.map(function (r) {
        return '<div class="dcs-row"><span class="mut">' + e(v.dmy(Due.londonDate(r.at) || String(r.at).slice(0, 10))) + '</span><b>' + e(r.label) + '</b>' + (r.outcome === 'ok' ? '' : '<span class="pill">' + e(OUTCOME[r.outcome] || r.outcome) + '</span>')
          + [r.item, r.amount, r.note, r.by, howLabel(v, r.how, Due.londonDate(r.at) || String(r.at).slice(0, 10)), r.part, r.noTime ? 'time not given' : ''].filter(Boolean).map(function (x) { return '<span class="mut">' + e(x) + '</span>'; }).join('')
          + r.files.map(function (f) { return '<a href="' + e(f.url) + '" target="_blank" rel="noopener noreferrer" data-record-file title="' + e(f.name) + '">' + e(f.role) + '</a>'; }).join('') + '</div>';
      }).join('') : '<span class="mut">No records</span>') + '</div></details>';
  }

  return { summary: summary, everyWords: everyWords, timing: timing, bySource: bySource, history: history, howLabel: howLabel, complianceHtml: complianceHtml, sopHtml: sopHtml, historyHtml: historyHtml };
}));
