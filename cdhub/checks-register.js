/*!
 * BLDChecksRegister - the month's checks register for an inspector: print and CSV (OVERSEER 13 for Lisa, 21 Nov 2026,
 * priority 2 "legally compliant exports"; stacked on #739's daily records). Read only: it never writes a row.
 * One line per check record (BLD-check_log). Every column an inspector asks for is always printed; a detail the record
 * does not hold shows "not recorded", never a guess.
 *  - Action taken: for a concern, not done or part done, the note written at the time plus every note added later
 *    (a check_log row whose note_for_id points at it), each labelled with when and by whom.
 *  - Corrections: a record that corrects another (corrects_id) is its own line marked "Corrects ...", and the original
 *    stays, marked "Corrected by ...". Nothing is silently replaced.
 *  - A time the owner's default filled in (time_given = false) prints as "time not recorded".
 * Times are UK time (Europe/London). No staff code or licence number is in this file.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDChecksRegister = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NR = 'not recorded', NO_TIME = 'time not recorded';
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var RESULT = { ok: 'done', done: 'done', concern: 'concern', not_done: 'not done', recorded: 'recorded', note: 'note', part_done: 'part done' };
  var NEEDS_ACTION = { concern: 1, not_done: 1, part_done: 1 };
  var HOW = { scanned: 'opened from tag', tapped: 'tapped', typed: 'typed', site_tap: 'whole-site tap', paper: 'entered later from paper', bulk: 'entered later (several days)', import: 'imported' };

  var COLUMNS = [
    ['date', 'Date'], ['time', 'Time'], ['check', 'Check'], ['subject', 'Dog / area'], ['result', 'Result'],
    ['detail', 'Detail'], ['note', 'Note'], ['action', 'Action taken'], ['by', 'Done by'], ['how', 'How recorded'],
    ['correction', 'Correction']
  ];

  function str(v) { return String(v == null ? '' : v).trim(); }

  /* UK date and time of an ISO instant: {date:'YYYY-MM-DD', time:'HH:MM'|''}. A bare date has no time. */
  var FMT = null;
  function london(at) {
    var s = str(at);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { date: s, time: '' };
    var d = new Date(s);
    if (!s || isNaN(d.getTime())) return { date: '', time: '' };
    if (!FMT) FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    var p = {}; FMT.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
  }
  function whenOf(r) { return london(r.happened_at || r.taken_at); }
  function ymd(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? Number(m[3]) + ' ' + MON[Number(m[2]) - 1].slice(0, 3) + ' ' + m[1] : ''; }
  function monthWords(ym) { var m = /^(\d{4})-(\d{2})$/.exec(ym || ''); return m ? MON[Number(m[2]) - 1] + ' ' + m[1] : ''; }
  function stamp(r) { var w = whenOf(r), t = str(r.time_given).toLowerCase() === 'false' ? '' : w.time; return ymd(w.date) + (t ? ' ' + t : ''); }

  function isNoteFor(r) { return str(r.outcome) === 'note' && !!str(r.note_for_id); }

  /** The months with a record, newest first ('YYYY-MM'). Notes added to another record are not counted. */
  function months(logs) {
    var seen = {};
    (logs || []).forEach(function (r) { if (isNoteFor(r)) return; var d = whenOf(r).date; if (d) seen[d.slice(0, 7)] = 1; });
    return Object.keys(seen).sort().reverse();
  }

  /**
   * The register lines for one month, oldest first.
   * opts: { month:'YYYY-MM', types:[check_type rows], typeId: '' (all) | id, subject: function(row) -> name | '' }
   */
  function build(logs, opts) {
    opts = opts || {};
    var ym = str(opts.month), only = str(opts.typeId), name = typeof opts.subject === 'function' ? opts.subject : function () { return ''; };
    var types = {}; (opts.types || []).forEach(function (t) { types[str(t.id)] = t; });
    var byId = {}, later = {}, fixedBy = {};
    (logs || []).forEach(function (r) {
      byId[str(r.id)] = r;
      if (isNoteFor(r)) (later[str(r.note_for_id)] = later[str(r.note_for_id)] || []).push(r);
      if (str(r.corrects_id)) (fixedBy[str(r.corrects_id)] = fixedBy[str(r.corrects_id)] || []).push(r);
    });
    var out = [];
    (logs || []).forEach(function (r) {
      if (isNoteFor(r)) return;
      var w = whenOf(r);
      if (!w.date || w.date.slice(0, 7) !== ym) return;
      if (only && str(r.check_type_id) !== only) return;
      var t = types[str(r.check_type_id)], id = str(r.id), outcome = str(r.outcome);
      var notes = (later[id] || []).slice().sort(function (a, b) { return str(a.taken_at || a.happened_at) < str(b.taken_at || b.happened_at) ? -1 : 1; })
        .map(function (n) { return 'Later, ' + stamp(n) + (str(n.taken_by) ? ', by ' + str(n.taken_by) : '') + ': ' + (str(n.note) || NR); });
      var own = str(r.note), action = '';
      if (NEEDS_ACTION[outcome]) action = [own ? 'At the time: ' + own : ''].concat(notes).filter(Boolean).join(' | ');
      else if (notes.length) action = notes.join(' | ');
      var corr = [];
      if (str(r.corrects_id)) { var o = byId[str(r.corrects_id)]; corr.push('Corrects the record of ' + (o ? stamp(o) : 'an earlier date') + (o && str(o.outcome) ? ' (was ' + (RESULT[str(o.outcome)] || str(o.outcome)) + ')' : '')); }
      (fixedBy[id] || []).forEach(function (c) { corr.push('Corrected on ' + stamp(c) + (str(c.taken_by) ? ' by ' + str(c.taken_by) : '') + ' (now ' + (RESULT[str(c.outcome)] || str(c.outcome) || NR) + ')'); });
      var timeGiven = str(r.time_given).toLowerCase() !== 'false';
      out.push({
        id: id, sort: w.date + ' ' + (w.time || '99:99') + ' ' + id,
        date: w.date, time: timeGiven ? w.time : '', noTime: !timeGiven,
        check: t ? str(t.label) : '', subject: str(name(r)),
        result: outcome ? (RESULT[outcome] || outcome) : '',
        detail: [str(r.item), str(r.amount)].filter(Boolean).join(', '),
        note: own, action: action, needsAction: !!NEEDS_ACTION[outcome],
        by: str(r.taken_by), how: HOW[str(r.how_recorded)] || str(r.how_recorded),
        correction: corr.join(' | ')
      });
    });
    out.sort(function (a, b) { return a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0; });
    return out;
  }

  /** A line's value for a column. Blank only where nothing is owed (no detail asked, no note, no action needed). */
  function cell(l, key, iso) {
    if (key === 'date') return l.date ? (iso ? l.date : ymd(l.date)) : NR;
    if (key === 'time') return l.noTime ? NO_TIME : (l.time || NR);
    if (key === 'detail' || key === 'note' || key === 'correction') return l[key] || '';
    if (key === 'action') return l.action || (l.needsAction ? NR : '');
    return l[key] || NR;
  }

  /** How many lines miss each column that is owed: {key: n}, in column order. */
  function gaps(lines) {
    var g = {};
    lines.forEach(function (l) { COLUMNS.forEach(function (c) { var v = cell(l, c[0]); if (v === NR || v === NO_TIME) g[c[0]] = (g[c[0]] || 0) + 1; }); });
    return g;
  }
  function heading(k) { for (var i = 0; i < COLUMNS.length; i++) if (COLUMNS[i][0] === k) return COLUMNS[i][1]; return k; }

  function csvCell(v) {
    v = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  /** CSV (UTF-8 with a BOM): header lines, a blank line, then the table. Dates YYYY-MM-DD. */
  function toCsv(head, lines) {
    var out = [
      ['Checks register', str(head.kennel) || NR],
      ['Month', monthWords(head.month)],
      ['Checks', str(head.which) || 'All checks'],
      ['Printed', str(head.printed)],
      ['Missing details', 'shown as "' + NR + '"; nothing is filled in or guessed'],
      [],
      COLUMNS.map(function (c) { return c[1]; })
    ];
    lines.forEach(function (l) { out.push(COLUMNS.map(function (c) { return cell(l, c[0], true); })); });
    return '﻿' + out.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* Print styles, scoped to the report, for printing inside the page (as Temperatures does): everything else is hidden. */
  var CSS = '#ckrReport{display:none}'
    + '@media print{@page{size:A4 landscape;margin:10mm}body.ckr-printing>*:not(#ckrReport){display:none!important}'
    + 'body.ckr-printing{background:#FFFFFF!important}body.ckr-printing #ckrReport{display:block;color:#111111;font:10px/1.3 system-ui,sans-serif}'
    + '#ckrReport h1{font-size:15px;margin:0 0 4px}#ckrReport .meta{margin:0 0 8px}#ckrReport .meta span{margin-right:14px}'
    + '#ckrReport table{border-collapse:collapse;width:100%}#ckrReport th,#ckrReport td{border:1px solid #595959;padding:2px 4px;text-align:left;vertical-align:top}'
    + '#ckrReport th{background:#ECEAE6}#ckrReport thead{display:table-header-group}#ckrReport tr{break-inside:avoid}#ckrReport .nr{font-style:italic}'
    + '#ckrReport .sign{margin-top:20px}#ckrReport .sign span{display:inline-block;min-width:220px;border-top:1px solid #111111;margin-right:36px;padding-top:2px}}';

  /** The report's inner HTML (put inside #ckrReport). */
  function reportHtml(head, lines) {
    var g = gaps(lines), gk = COLUMNS.map(function (c) { return c[0]; }).filter(function (k) { return g[k]; });
    return '<h1>Checks register · ' + esc(monthWords(head.month)) + '</h1>'
      + '<p class="meta"><span><b>Kennel:</b> ' + esc(str(head.kennel) || NR) + '</span><span><b>Checks:</b> ' + esc(str(head.which) || 'All checks') + '</span>'
      + '<span><b>Printed:</b> ' + esc(head.printed) + '</span><span><b>Entries:</b> ' + lines.length + '</span></p>'
      + '<p class="meta">A detail the record does not hold is shown as <i>' + NR + '</i>. Nothing is filled in or guessed. A corrected record stays, with its correction on its own line.</p>'
      + (lines.length
        ? '<table><thead><tr>' + COLUMNS.map(function (c) { return '<th scope="col">' + esc(c[1]) + '</th>'; }).join('') + '</tr></thead><tbody>'
          + lines.map(function (l) {
            return '<tr data-ckr="' + esc(l.id) + '">' + COLUMNS.map(function (c) { var v = cell(l, c[0]); return '<td' + (v === NR || v === NO_TIME ? ' class="nr"' : '') + '>' + esc(v) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table>'
        : '<p>No checks recorded in ' + esc(monthWords(head.month)) + '.</p>')
      + (gk.length ? '<p><b>Not recorded:</b> ' + gk.map(function (k) { return esc(heading(k)) + ' ' + g[k] + ' of ' + lines.length; }).join(' · ') + '</p>' : '')
      + '<p class="sign"><span>Checked by</span><span>Date</span></p>';
  }

  function fileName(ym) { return 'checks-register-' + (str(ym) || 'month') + '.csv'; }

  return { NR: NR, NO_TIME: NO_TIME, COLUMNS: COLUMNS, CSS: CSS, months: months, build: build, cell: cell, gaps: gaps,
    toCsv: toCsv, reportHtml: reportHtml, fileName: fileName, monthWords: monthWords };
}));
