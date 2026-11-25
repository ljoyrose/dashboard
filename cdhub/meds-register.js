/*!
 * BLDMedsRegister - the month's medicines register for an inspector: print and CSV (OVERSEER 13 for Lisa, 21 Nov 2026,
 * priority 2 "legally compliant exports"). Read only: it never writes a row.
 * One line per medicine given. Every column an inspector asks for is always printed; a detail the record does not hold
 * says "not recorded" only for a legally required detail: the date, the dog, the medicine, the dose and who gave it.
 * Time, batch, expiry, route, reason and the vet instruction are left blank when the record does not hold them.
 * A column is read only by its own name (listed in FROM below); nothing is worked out from another column.
 * No licence number or staff code is in this file: the header names the kennel from the tenant row at run time.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDMedsRegister = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NR = 'not recorded';
  /* Only these say "not recorded" when empty. The rest stay blank. */
  var REQUIRED = { date: 1, dog: 1, product: 1, dose: 1, given_by: 1 };
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* The register's columns, in print order: [key, heading]. */
  var COLUMNS = [
    ['date', 'Date'], ['time', 'Time'], ['dog', 'Dog'], ['chip', 'Microchip'], ['product', 'Medicine'],
    ['batch', 'Batch'], ['expiry', 'Expiry'], ['dose', 'Dose'], ['route', 'Route'], ['reason', 'Reason'],
    ['vet', 'Vet instruction'], ['given_by', 'Given by'], ['note', 'Note'], ['source', 'Recorded in']
  ];
  var SOURCE = { dispense: 'dog card', job: 'staff job' };
  var RESULT = { ok: 'done', done: 'done', concern: 'concern', not_done: 'not done', recorded: 'recorded', part_done: 'part done' };

  /* Where each detail is read from: the record's own column names, first one with a value wins. */
  var FROM = {
    batch: ['batch', 'batch_number', 'lot_batch'],
    expiry: ['expires_on', 'expiry'],
    dose: ['dose_volume', 'amount'],
    route: ['route'],
    reason: ['reason'],
    vet: ['vet_instruction', 'instructions'],
    given_by: ['given_by', 'taken_by'],
    note: ['note']
  };

  function str(v) { return String(v == null ? '' : v).trim(); }

  /* No internal codes on paper (Lisa, 23 Nov 2026). A record id looks like clg-20261118-042020-vf20 or sub-7k2q9x: 2 to 5
     letters, a hyphen, then letters and digits with at least one digit. "from <id>" is dropped whole; a bare id too. */
  var ID_SRC = '\\b[a-z]{2,5}-(?=[a-z0-9-]*\\d)[a-z0-9]+(?:-[a-z0-9]+)*\\b';
  function ids(s) { return String(s == null ? '' : s).match(new RegExp(ID_SRC, 'gi')) || []; }
  function clean(s) {
    return String(s == null ? '' : s)
      .replace(new RegExp('\\(?\\s*\\bfrom\\s+' + ID_SRC + '\\s*\\)?', 'gi'), ' ')
      .replace(new RegExp(ID_SRC, 'gi'), ' ')
      .replace(/\s+([.,;:])/g, '$1').replace(/([.,;:·|])(\s*[.,;:·|])+/g, '$1')
      .replace(/\s{2,}/g, ' ').replace(/^[\s.,;:·|]+|[\s,;:·|]+$/g, '').trim();
  }
  /* Who did it: a name. A visitor's record says visit:<link id>; that prints as "Visitor (shared link)". */
  function who(s) { s = str(s); return /^visit:/i.test(s) ? 'Visitor (shared link)' : clean(s); }

  function pick(r, cols) { for (var i = 0; i < cols.length; i++) { var v = str(r[cols[i]]); if (v) return v; } return ''; }

  /* A product written as "NOT STATED", "unknown" or flagged for a ruling is not a named medicine. */
  function unnamed(product, ruling) {
    var p = str(product);
    return !p || /not stated|unnamed|unknown/i.test(p) || !!str(ruling);
  }

  /* given_at (date and time) or given_on (date, sometimes with a time). Returns {date:'YYYY-MM-DD', time:'HH:MM'|''}. */
  /* An instant with Z or an offset is shown in UK time (Europe/London); a plain date or local time is kept as written. */
  var FMT = null;
  function when(r) {
    var s = str(r.given_at) || str(r.given_on);
    var m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s);
    if (!m) return { date: '', time: '' };
    if (m[2] && /(Z|[+-]\d{2}:?\d{2})$/.test(s) && !isNaN(new Date(s).getTime())) {
      if (!FMT) FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      var p = {}; FMT.formatToParts(new Date(s)).forEach(function (x) { p[x.type] = x.value; });
      return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
    }
    return { date: m[1], time: m[2] ? m[2] + ':' + m[3] : '' };
  }

  /**
   * The staff "Medicine given" job (check_type with type_key "medicine") saves to BLD-check_log, not BLD-dispense.
   * Its records join the register here, in the dispense shape: item = the medicine, amount = the dose, taken_by = who.
   * A note added later (note_for_id) joins its record's note; a job not done or part done says so; a correction says
   * which record it corrects, and the original stays. Nothing is filled in that the record does not hold.
   */
  function fromChecks(logs, types) {
    var med = {}, unit = {};
    (types || []).forEach(function (t) { if (str(t.type_key).toLowerCase() === 'medicine') { med[str(t.id)] = 1; unit[str(t.id)] = str(t.amount_unit); } });
    var mine = (logs || []).filter(function (r) { return med[str(r.check_type_id)]; }), byId = {}, later = {};
    mine.forEach(function (r) { byId[str(r.id)] = r; if (str(r.outcome) === 'note' && str(r.note_for_id)) (later[str(r.note_for_id)] = later[str(r.note_for_id)] || []).push(r); });
    return mine.filter(function (r) { return !(str(r.outcome) === 'note' && str(r.note_for_id)); }).map(function (r) {
      var out = str(r.outcome), amt = str(r.amount), u = unit[str(r.check_type_id)], o = byId[str(r.corrects_id)];
      var notes = [];
      if (out && out !== 'ok' && out !== 'done') notes.push('Job marked ' + (RESULT[out] || out) + '.');
      if (clean(r.note)) notes.push(clean(r.note));
      (later[str(r.id)] || []).forEach(function (n) { notes.push('Later, by ' + (who(n.taken_by) || NR) + ': ' + (clean(n.note) || NR)); });
      if (str(r.corrects_id)) notes.push('Corrects the record of ' + (o ? (when({ given_at: o.happened_at || o.taken_at }).date || 'an earlier date') : 'an earlier date') + '.');
      if (mine.some(function (c) { return str(c.corrects_id) === str(r.id); })) notes.push('Corrected by a later record.');
      return { id: str(r.id), subject_id: str(r.subject_id), given_at: str(r.happened_at) || str(r.taken_at), product: str(r.item),
        dose_volume: amt && u && amt.indexOf(u) < 0 ? amt + ' ' + u : amt, taken_by: str(r.taken_by), note: notes.join(' '),
        time_given: str(r.time_given), _from: 'job' };
    });
  }

  function ymd(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? Number(m[3]) + ' ' + MON[Number(m[2]) - 1].slice(0, 3) + ' ' + m[1] : ''; }
  function monthWords(ym) { var m = /^(\d{4})-(\d{2})$/.exec(ym || ''); return m ? MON[Number(m[2]) - 1] + ' ' + m[1] : ''; }

  /** The months that have a record, newest first, as 'YYYY-MM'. */
  function months(rows) {
    var seen = {};
    (rows || []).forEach(function (r) { var d = when(r).date; if (d) seen[d.slice(0, 7)] = 1; });
    return Object.keys(seen).sort().reverse();
  }

  /**
   * The register lines for one month, oldest first.
   * opts: { month: 'YYYY-MM', dog: function(subject_id) -> {name, chip} | null }
   * Each line: { id, date, time, dog, chip, product, ..., missing: [keys], offList: bool }
   */
  function build(rows, opts) {
    opts = opts || {};
    var ym = str(opts.month), dogOf = typeof opts.dog === 'function' ? opts.dog : function () { return null; };
    var out = [];
    (rows || []).forEach(function (r) {
      var w = when(r);
      if (!w.date || w.date.slice(0, 7) !== ym) return;
      var sid = str(r.subject_id), d = sid ? dogOf(sid) : null;
      var line = {
        id: str(r.id), sort: w.date + ' ' + (w.time || '99:99'),
        date: w.date, time: str(r.time_given).toLowerCase() === 'false' ? '' : w.time, noTime: str(r.time_given).toLowerCase() === 'false',
        source: SOURCE[str(r._from)] || SOURCE.dispense,   // _from, not the sheet's own source column (where a row came from)
        dog: d && str(d.name) ? str(d.name) : '', offList: !!sid && !d,
        sid: sid,
        chip: d ? str(d.chip) : '',
        product: unnamed(r.product, r.ruling_needed) ? '' : str(r.product)
      };
      Object.keys(FROM).forEach(function (k) { line[k] = pick(r, FROM[k]); });
      line.note = clean(line.note); line.reason = clean(line.reason); line.vet = clean(line.vet); line.given_by = who(line.given_by);
      line.missing = ['date', 'dog', 'product', 'dose', 'given_by'].filter(function (k) { return !line[k]; });
      out.push(line);
    });
    out.sort(function (a, b) { return a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : (a.id < b.id ? -1 : 1); });
    return out;
  }

  /** A line's value for a column as printed: "not recorded" for a missing detail. Note may be blank.
   *  iso: the date as YYYY-MM-DD (the CSV), so a spreadsheet in any country reads it the same. */
  function cell(line, key, iso) {
    if (key === 'date') return line.date ? (iso ? line.date : ymd(line.date)) : NR;
    if (key === 'dog') return line.dog || (line.sid ? 'Dog not on the current list' : NR);
    if (key === 'note') return line.note || '';
    if (key === 'time' && line.noTime) return '';
    var v = line[key] || '';
    if (v) return v;
    return REQUIRED[key] ? NR : '';
  }

  /** How many lines miss each column: {key: n}. Only columns with a gap are listed. */
  function gaps(lines) {
    var g = {};
    lines.forEach(function (l) { l.missing.forEach(function (k) { g[k] = (g[k] || 0) + 1; }); });
    return g;
  }

  function heading(key) { for (var i = 0; i < COLUMNS.length; i++) if (COLUMNS[i][0] === key) return COLUMNS[i][1]; return key; }

  /* CSV: quoted when needed; a cell starting = + - @ is prefixed with ' so a spreadsheet does not run it. */
  function csvCell(v) {
    v = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  /**
   * CSV text (UTF-8 with a BOM, so Excel shows accents and \u00a3 right): four header lines (kennel, month, printed, the "not recorded" rule), a blank line, then the table.
   * head: { kennel, month: 'YYYY-MM', printed: 'D Mon YYYY HH:MM' }
   */
  function toCsv(head, lines) {
    var out = [
      ['Medicines register', str(head.kennel)],
      head.year ? ['Year', str(head.year)] : ['Month', monthWords(head.month)],
      ['Printed', str(head.printed)],
      ['Missing details', 'shown as "' + NR + '"; nothing is filled in or guessed'],
      [],
      COLUMNS.map(function (c) { return c[1]; })
    ];
    lines.forEach(function (l) { out.push(COLUMNS.map(function (c) { return cell(l, c[0], true); })); });
    return '﻿' + out.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* One month is one A4 landscape sheet, shrunk to fit (the temperature history rule). A year is one sheet per month. */
  function sheetHtml(head, lines, ym) {
    var g = gaps(lines), gk = COLUMNS.map(function (c) { return c[0]; }).filter(function (k) { return g[k]; });
    var title = 'Medicines register · ' + monthWords(ym || head.month);
    var body = lines.length
      ? '<table><thead><tr>' + COLUMNS.map(function (c) { return '<th scope="col">' + esc(c[1]) + '</th>'; }).join('') + '</tr></thead><tbody>'
        + lines.map(function (l) {
          return '<tr>' + COLUMNS.map(function (c) {
            var v = cell(l, c[0]);
            return '<td' + (v === NR ? ' class="nr"' : '') + '>' + esc(v) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table>'
      : '<p>No records this month.</p>';
    var kennel = str(head.kennel);
    return '<section class="meds-sheet" data-meds-month="' + esc(ym || head.month) + '">'
      + '<h1>' + esc(title) + '</h1>'
      + '<p class="meta">' + (kennel ? '<span><b>Kennel:</b> ' + esc(kennel) + '</span>' : '<span>Set the kennel name in Settings.</span>') + '<span><b>Printed:</b> ' + esc(head.printed) + '</span>'
      + '<span><b>Entries:</b> ' + lines.length + '</span></p>'
      + '<p class="meta">Date, dog, medicine, dose and who gave it say <i>' + NR + '</i> when the record does not hold them. Other details are left blank.</p>'
      + body
      + (gk.length ? '<p class="gaps"><b>Not recorded:</b> ' + gk.map(function (k) { return esc(heading(k)) + ' ' + g[k] + ' of ' + lines.length; }).join(' · ') + '</p>' : '')
      + '<p class="sign"><span>Checked by</span><span>Date</span></p></section>';
  }
  var SHEET_CSS = '@page{size:A4 landscape;margin:8mm}'
    + 'body{font:11px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;background:#fff;margin:16px}'
    + 'h1{font-size:16px;margin:0 0 4px}.meta{margin:0 0 10px}.meta span{margin-right:16px}'
    + 'table{border-collapse:collapse;width:100%}th,td{border:1px solid #595959;padding:3px 5px;text-align:left;vertical-align:top}'
    + 'th{background:#ECEAE6}thead{display:table-header-group}tr{break-inside:avoid}.nr{font-style:italic;color:#555}'
    + '.gaps{margin:10px 0 0}.sign{margin-top:8px}.sign span{display:inline-block;min-width:240px;border-top:1px solid #111;margin-right:40px;padding-top:2px}'
    + '.meds-sheet{width:281mm;box-sizing:border-box}'
    + '@media print{.noprint{display:none}body{margin:0}.meds-sheet{height:194mm;overflow:hidden;page-break-after:always;break-after:page}.meds-sheet:last-child{page-break-after:auto;break-after:auto}}';
  var SHEET_FIT = '<script>(function(){var done=0;function fit(){var max=194*96/25.4,nodes=document.querySelectorAll(".meds-sheet"),i,h;for(i=0;i<nodes.length;i++){nodes[i].style.zoom="";h=nodes[i].scrollHeight;if(h>max)nodes[i].style.zoom=String(Math.floor(max/h*1000)/1000);}}'
    + 'function go(){if(done)return;done=1;fit();setTimeout(function(){window.print();},300);}'
    + 'if(document.readyState==="complete")go();else window.addEventListener("load",go);}());<\/script>';

  /** A whole printable page (A4 landscape, one month, shrunk to fit). It prints itself once open. */
  function toHtml(head, lines) {
    var title = 'Medicines register · ' + monthWords(head.month);
    return '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + esc(title) + '</title><meta name="robots" content="noindex,nofollow"><style>' + SHEET_CSS + '</style></head><body>'
      + sheetHtml(head, lines, head.month)
      + '<p class="noprint"><button type="button" onclick="window.print()">Print</button></p>'
      + SHEET_FIT + '</body></html>';
  }

  /** A whole year: one A4 sheet per month that has a record. A year with none is one line. */
  function toYearHtml(head, sheets) {
    var title = 'Medicines register · ' + str(head.year);
    var kept = (sheets || []).filter(function (s) { return s && s.lines && s.lines.length; });
    var body = kept.length ? kept.map(function (s) { return sheetHtml(head, s.lines, s.month); }).join('')
      : sheetHtml(head, [], str(head.year));
    return '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + esc(title) + '</title><meta name="robots" content="noindex,nofollow"><style>' + SHEET_CSS + '</style></head><body>'
      + body
      + '<p class="noprint"><button type="button" onclick="window.print()">Print</button></p>'
      + SHEET_FIT + '</body></html>';
  }

  /** A file name: medicines-register-YYYY-MM.csv (no kennel name, so nothing personal is in it). */
  function fileName(ym, ext) { return 'medicines-register-' + (str(ym) || 'month') + '.' + (ext || 'csv'); }

  /**
   * Every medicine record once: the dog card's rows, then the staff job's rows that no dog-card row came from. A dog-card
   * row whose note names a job record (e.g. "from clg-...", written when it was copied) is that same dose, so the job row
   * is left out rather than printed twice.
   */
  function combine(dispense, logs, types) {
    var copied = {};
    (dispense || []).forEach(function (r) { ids(r.note).forEach(function (i) { copied[i.toLowerCase()] = 1; }); });
    return (dispense || []).concat(fromChecks(logs, types).filter(function (j) { return !copied[String(j.id).toLowerCase()]; }));
  }

  return { NR: NR, COLUMNS: COLUMNS, FROM: FROM, months: months, fromChecks: fromChecks, combine: combine, clean: clean, build: build, cell: cell, gaps: gaps,
    toCsv: toCsv, toHtml: toHtml, toYearHtml: toYearHtml, fileName: fileName, monthWords: monthWords };
}));
