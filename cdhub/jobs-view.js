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
    var key = v.today + '|' + v.logs.length + '|' + v.types.length + '|' + v.dogs.length + '|' + v.areas.length;
    if (memo && memo.key === key) return memo.rows;
    var site = v.logs.map(function (l) { return l.how_recorded === 'site_tap' ? Object.assign({}, l, { subject_id: '' }) : l; });
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
    add(v.dogs.map(function (d) { return { subject_id: d.id, everyDog: true }; }), v.logs);
    add(v.areas.map(function (a) { return { area_id: a.id }; }), v.logs);
    add([{}], site);
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

  /** Records for one dog ({subject_id}) or one room ({area_id}), newest first. A corrected record gives way to its correction. */
  function history(v, target) {
    var byId = {}, replaced = {};
    v.types.forEach(function (t) { byId[t.id] = t; });
    v.logs.forEach(function (l) { if (l.corrects_id) replaced[l.corrects_id] = true; });
    return v.logs.filter(function (l) {
      return !replaced[l.id] && byId[l.check_type_id] && (target.subject_id ? l.subject_id === target.subject_id : l.area_id === target.area_id);
    }).map(function (l) {
      return { at: l.happened_at || l.taken_at || '', label: byId[l.check_type_id].label, outcome: l.outcome, by: l.taken_by || '', how: l.how_recorded || '', note: l.note || '', item: l.item || '', amount: l.amount || '' };
    }).sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
  }

  function complianceHtml(v, pill) {
    var e = v.esc, rows = summary(v), late = rows.reduce(function (n, r) { return n + r.late; }, 0);
    var h = '<section class="card" id="compJobs"><h3>Jobs' + pill(late) + '</h3>';
    if (!rows.length) return h + '<p class="mut">No job rows yet.</p></section>';
    function cell(n, cls) { return '<td>' + (n ? '<span class="pill ' + cls + '">' + n + '</span>' : '<span class="mut">0</span>') + '</td>'; }
    h += '<p class="mut">From saved records. Counts are dogs or rooms.</p><div class="scroll" tabindex="0" role="group" aria-label="Table, scroll sideways for more"><table><thead><tr><th>SOP</th><th>job</th><th>late</th><th>due</th><th>done</th><th>last</th></tr></thead><tbody>'
      + rows.map(function (r) {
        return '<tr data-job="' + e(r.key) + '"><td class="mut">' + e(r.sop || '—') + '</td><td><b>' + e(r.label) + '</b></td>' + cell(r.late, 'no') + cell(r.due, 'w')
          + '<td>' + (r.as_needed && !r.ok ? '<span class="mut">as needed</span>' : r.ok) + '</td><td class="mut">' + e(r.last_done ? v.dmy(r.last_done) : '—') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    h += '<h4>By licence source</h4><div class="scroll" tabindex="0" role="group" aria-label="Table, scroll sideways for more"><table><thead><tr><th>source</th><th>jobs</th><th>late</th><th>due</th></tr></thead><tbody>'
      + bySource(rows).map(function (s) {
        return '<tr data-source="' + e(s.source) + '"><td>' + e(s.source || 'No source entered') + '</td><td>' + s.jobs + '</td>' + cell(s.late, 'no') + cell(s.due, 'w') + '</tr>';
      }).join('') + '</tbody></table></div>';
    return h + '</section>';
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
    return '<details class="dcs" data-history="' + e(target.subject_id || target.area_id) + '"><summary>' + icon + '<span class="dcs-label">'
      + (rows.length ? '<b>' + rows.length + '</b> job record' + (rows.length === 1 ? '' : 's') : '<span class="mut">no job records</span>') + '</span></summary><div class="dcs-bd">'
      + (shown.length ? shown.map(function (r) {
        return '<div class="dcs-row"><span class="mut">' + e(v.dmy(String(r.at).slice(0, 10))) + '</span><b>' + e(r.label) + '</b>' + (r.outcome === 'ok' ? '' : '<span class="pill">' + e(OUTCOME[r.outcome] || r.outcome) + '</span>')
          + [r.item, r.amount, r.note, r.by, HOW[r.how] || ''].filter(Boolean).map(function (x) { return '<span class="mut">' + e(x) + '</span>'; }).join('') + '</div>';
      }).join('') : '<span class="mut">No records</span>') + '</div></details>';
  }

  return { summary: summary, bySource: bySource, history: history, complianceHtml: complianceHtml, sopHtml: sopHtml, historyHtml: historyHtml };
}));
