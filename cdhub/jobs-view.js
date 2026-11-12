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

  var HOW = { scanned: 'opened from tag', tapped: 'tapped', typed: 'typed', site_tap: 'whole-site tap' };
  var OUTCOME = { ok: 'done', concern: 'concern', not_done: 'not done', recorded: 'recorded' };
  var memo = null;

  /** One line per job in force: how many of its dogs or rooms are late, due or fine, and when it was last done. */
  function summary(v) {
    var litters = v.litters || [];   // only the litters the caller counts as current (a row decides; none = no litter jobs counted)
    var key = v.today + '|' + v.logs.length + '|' + v.types.length + '|' + v.dogs.length + '|' + v.areas.length + '|' + litters.map(function (l) { return l.id; }).join(',');
    if (memo && memo.key === key) return memo.rows;
    var rows = {}, perDog = {};
    v.types.forEach(function (t) { if (Due.perDogRoom(t)) perDog[t.type_key] = true; });
    function add(targets, logs) {
      targets.forEach(function (t) {
        Due.forTarget(v.types, logs, t, v.today).forEach(function (j) {
          if (t.area_id && perDog[j.type_key]) return;   // counted dog by dog instead
          var r = rows[j.type_key] = rows[j.type_key] || { key: j.type_key, label: j.label, late: 0, due: 0, ok: 0, as_needed: 0, last_done: '' };
          if (j.status === 'late') r.late++;
          else if (j.status === 'today' || j.status === 'never') r.due++;
          else r[j.status]++;
          if (j.last_done > r.last_done) r.last_done = j.last_done;
        });
      });
    }
    add(v.dogs.map(function (d) { return { subject_id: d.id, everyDog: true, dogArea: d.area_id || d.areaId || '' }; }), v.logs);
    add(v.areas.map(function (a) { return { area_id: a.id }; }), v.logs);
    add(litters.map(function (l) { return { litter_id: l.id }; }), v.logs);
    add([{ dogs: v.dogs.map(function (d) { return { id: d.id, area_id: d.area_id || d.areaId || '' }; }) }], v.logs);   // a whole-site job about dogs is done once every dog has a line
    var list = Due.jobsInForce(v.types, v.today).filter(function (t) { return rows[t.type_key]; }).map(function (t) {
      return Object.assign(rows[t.type_key], { sop: t.sop || '', source: t.source || '' });
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

  /** Records for one dog ({subject_id}), one room ({area_id}) or one litter ({litter_id}), newest first. A corrected record gives way to its correction. */
  function history(v, target) {
    var byId = {}, replaced = {};
    v.types.forEach(function (t) { byId[t.id] = t; });
    v.logs.forEach(function (l) { if (l.corrects_id) replaced[l.corrects_id] = true; });
    return v.logs.filter(function (l) {
      return !replaced[l.id] && byId[l.check_type_id] && (target.litter_id ? l.litter_id === target.litter_id : target.subject_id ? l.subject_id === target.subject_id : l.area_id === target.area_id);
    }).map(function (l) {
      return { at: l.happened_at || l.taken_at || '', label: byId[l.check_type_id].label, outcome: l.outcome, by: l.taken_by || '', how: l.how_recorded || '', note: l.note || '', item: l.item || '', amount: l.amount || '' };
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
    h += '<p class="mut">From saved records. Counts are dogs, rooms or litters.</p><div class="scroll" tabindex="0" role="group" aria-label="Table, scroll sideways for more"><table><thead><tr><th>SOP</th><th>job</th><th>done</th><th>due</th><th>late</th><th>last</th></tr></thead><tbody>'
      + rows.map(function (r) {
        var sop = r.sop ? (v.sopHref ? '<a href="' + e(v.sopHref(r.sop)) + '">' + e(r.sop) + '</a>' : e(r.sop)) : '—';
        var done = r.as_needed && !r.ok ? '<td data-n="done"><span class="mut">as needed</span></td>' : cell(r, r.ok, 'ok', 'done');
        return '<tr data-job="' + e(r.key) + '"><td class="mut">' + sop + '</td><td><b>' + e(r.label) + '</b></td>' + done + cell(r, r.due, 'w', 'due') + cell(r, r.late, 'no', 'late')
          + '<td class="mut">' + e(r.last_done ? v.dmy(r.last_done) : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    h += '<h4>By licence source</h4><div class="scroll" tabindex="0" role="group" aria-label="Table, scroll sideways for more"><table><thead><tr><th>source</th><th>jobs</th><th>due</th><th>late</th></tr></thead><tbody>'
      + bySource(rows).sort(function (a, b) { return a.late - b.late || a.due - b.due || String(a.source).localeCompare(String(b.source)); }).map(function (s) {
        function n(x, cls) { return '<td>' + (x ? '<span class="pill ' + cls + '">' + x + '</span>' : '<span class="mut">0</span>') + '</td>'; }
        return '<tr data-source="' + e(s.source) + '"><td>' + e(s.source || 'No source entered') + '</td><td>' + s.jobs + '</td>' + n(s.due, 'w') + n(s.late, 'no') + '</tr>';
      }).join('') + '</tbody></table></div>';
    return h + '</details></section>';
  }

  function sopHtml(v, name) {
    var e = v.esc, rows = summary(v).filter(function (r) { return r.sop === name; });
    if (!rows.length) return '';
    return '<div class="sopjobs" data-sopjobs="' + e(name) + '">' + rows.map(function (r) {
      var state = r.late ? '<span class="pill no">' + r.late + ' late</span>' : r.due ? '<span class="pill w">' + r.due + ' due</span>' : '';
      return '<div class="dcs-row"><b>' + e(r.label) + '</b><span class="mut">' + e(r.last_done ? 'last ' + v.dmy(r.last_done) : 'not recorded') + '</span>' + state + '</div>';
    }).join('') + '</div>';
  }

  function historyHtml(v, target, icon) {
    var e = v.esc, rows = history(v, target), shown = rows.slice(0, 30);
    return '<details class="dcs" data-history="' + e(target.litter_id || target.subject_id || target.area_id) + '"><summary>' + icon + '<span class="dcs-label">'
      + (rows.length ? '<b>' + rows.length + '</b> job record' + (rows.length === 1 ? '' : 's') : '<span class="mut">no job records</span>') + '</span></summary><div class="dcs-bd">'
      + (shown.length ? shown.map(function (r) {
        return '<div class="dcs-row"><span class="mut">' + e(v.dmy(String(r.at).slice(0, 10))) + '</span><b>' + e(r.label) + '</b>' + (r.outcome === 'ok' ? '' : '<span class="pill">' + e(OUTCOME[r.outcome] || r.outcome) + '</span>')
          + [r.item, r.amount, r.note, r.by, HOW[r.how] || ''].filter(Boolean).map(function (x) { return '<span class="mut">' + e(x) + '</span>'; }).join('') + '</div>';
      }).join('') : '<span class="mut">No records</span>') + '</div></details>';
  }

  return { summary: summary, bySource: bySource, history: history, complianceHtml: complianceHtml, sopHtml: sopHtml, historyHtml: historyHtml };
}));
