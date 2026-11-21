/*!
 * BLDMedsRegister - the month's medicines register for an inspector: print and CSV (OVERSEER 13 for Lisa, 21 Nov 2026,
 * priority 2 "legally compliant exports"). Read only: it never writes a row.
 * One line per medicine given. Every column an inspector asks for is always printed; a detail the record does not hold
 * shows "not recorded", never a guess. Today BLD-dispense holds no time, batch, expiry, vet instruction or who gave it,
 * so those columns say "not recorded" until the record keeps them (the form change is a separate PR).
 * A column is read only by its own name (listed in FROM below); nothing is worked out from another column.
 * No licence number or staff code is in this file: the header names the kennel from the tenant row at run time.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDMedsRegister = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NR = 'not recorded';
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* The register's columns, in print order: [key, heading]. */
  var COLUMNS = [
    ['date', 'Date'], ['time', 'Time'], ['dog', 'Dog'], ['chip', 'Microchip'], ['product', 'Medicine'],
    ['batch', 'Batch'], ['expiry', 'Expiry'], ['dose', 'Dose'], ['route', 'Route'], ['reason', 'Reason'],
    ['vet', 'Vet instruction'], ['given_by', 'Given by'], ['note', 'Note']
  ];

  /* Where each detail is read from: the record's own column names, first one with a value wins. */
  var FROM = {
    batch: ['batch', 'batch_number', 'lot_batch'],
    expiry: ['expires_on', 'expiry'],
    dose: ['dose_volume', 'amount'],
    route: ['route'],
    reason: ['reason'],
    vet: ['vet_instruction', 'instructions'],
    given_by: ['given_by'],
    note: ['note']
  };

  function str(v) { return String(v == null ? '' : v).trim(); }
  function pick(r, cols) { for (var i = 0; i < cols.length; i++) { var v = str(r[cols[i]]); if (v) return v; } return ''; }

  /* A product written as "NOT STATED", "unknown" or flagged for a ruling is not a named medicine. */
  function unnamed(product, ruling) {
    var p = str(product);
    return !p || /not stated|unnamed|unknown/i.test(p) || !!str(ruling);
  }

  /* given_at (date and time) or given_on (date, sometimes with a time). Returns {date:'YYYY-MM-DD', time:'HH:MM'|''}. */
  function when(r) {
    var s = str(r.given_at) || str(r.given_on);
    var m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s);
    if (!m) return { date: '', time: '' };
    return { date: m[1], time: m[2] ? m[2] + ':' + m[3] : '' };
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
        date: w.date, time: w.time,
        dog: d && str(d.name) ? str(d.name) : '', offList: !!sid && !d,
        sid: sid,
        chip: d ? str(d.chip) : '',
        product: unnamed(r.product, r.ruling_needed) ? '' : str(r.product)
      };
      Object.keys(FROM).forEach(function (k) { line[k] = pick(r, FROM[k]); });
      line.missing = COLUMNS.map(function (c) { return c[0]; }).filter(function (k) { return k !== 'note' && k !== 'dog' && !line[k]; });
      if (!line.dog) line.missing.unshift('dog');
      out.push(line);
    });
    out.sort(function (a, b) { return a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : (a.id < b.id ? -1 : 1); });
    return out;
  }

  /** A line's value for a column as printed: "not recorded" for a missing detail. Note may be blank.
   *  iso: the date as YYYY-MM-DD (the CSV), so a spreadsheet in any country reads it the same. */
  function cell(line, key, iso) {
    if (key === 'date') return line.date ? (iso ? line.date : ymd(line.date)) : NR;
    if (key === 'dog') return line.dog || (line.sid ? line.sid + ' (not on the current list)' : NR);
    if (key === 'note') return line.note || '';
    return line[key] || NR;
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
      ['Medicines register', str(head.kennel) || NR],
      ['Month', monthWords(head.month)],
      ['Printed', str(head.printed)],
      ['Missing details', 'shown as "' + NR + '"; nothing is filled in or guessed'],
      [],
      COLUMNS.map(function (c) { return c[1]; })
    ];
    lines.forEach(function (l) { out.push(COLUMNS.map(function (c) { return cell(l, c[0], true); })); });
    return '﻿' + out.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n';
  }

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /** A whole printable page (A4 landscape). It prints itself once open. */
  function toHtml(head, lines) {
    var g = gaps(lines), gk = COLUMNS.map(function (c) { return c[0]; }).filter(function (k) { return g[k]; });
    var title = 'Medicines register · ' + monthWords(head.month);
    var body = lines.length
      ? '<table><thead><tr>' + COLUMNS.map(function (c) { return '<th scope="col">' + esc(c[1]) + '</th>'; }).join('') + '</tr></thead><tbody>'
        + lines.map(function (l) {
          return '<tr>' + COLUMNS.map(function (c) {
            var v = cell(l, c[0]);
            return '<td' + (v === NR ? ' class="nr"' : '') + '>' + esc(v) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table>'
      : '<p>No medicine recorded in ' + esc(monthWords(head.month)) + '.</p>';
    return '<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<title>' + esc(title) + '</title><meta name="robots" content="noindex,nofollow"><style>'
      + '@page{size:A4 landscape;margin:12mm}'
      + 'body{font:11px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;color:#111;background:#fff;margin:16px}'
      + 'h1{font-size:16px;margin:0 0 4px}.meta{margin:0 0 10px}.meta span{margin-right:16px}'
      + 'table{border-collapse:collapse;width:100%}th,td{border:1px solid #595959;padding:3px 5px;text-align:left;vertical-align:top}'
      + 'th{background:#ECEAE6}thead{display:table-header-group}tr{break-inside:avoid}.nr{font-style:italic;color:#555}'
      + '.gaps{margin:10px 0 0}.sign{margin-top:24px}.sign span{display:inline-block;min-width:240px;border-top:1px solid #111;margin-right:40px;padding-top:2px}'
      + '@media print{.noprint{display:none}body{margin:0}}'
      + '</style></head><body>'
      + '<h1>' + esc(title) + '</h1>'
      + '<p class="meta"><span><b>Kennel:</b> ' + esc(str(head.kennel) || NR) + '</span><span><b>Printed:</b> ' + esc(head.printed) + '</span>'
      + '<span><b>Entries:</b> ' + lines.length + '</span></p>'
      + '<p class="meta">A detail the record does not hold is shown as <i>' + NR + '</i>. Nothing is filled in or guessed.</p>'
      + body
      + (gk.length ? '<p class="gaps"><b>Not recorded:</b> ' + gk.map(function (k) { return esc(heading(k)) + ' ' + g[k] + ' of ' + lines.length; }).join(' · ') + '</p>' : '')
      + '<p class="sign"><span>Checked by</span><span>Date</span></p>'
      + '<p class="noprint"><button type="button" onclick="window.print()">Print</button></p>'
      + '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},300);});<\/script>'
      + '</body></html>';
  }

  /** A file name: medicines-register-YYYY-MM.csv (no kennel name, so nothing personal is in it). */
  function fileName(ym, ext) { return 'medicines-register-' + (str(ym) || 'month') + '.' + (ext || 'csv'); }

  return { NR: NR, COLUMNS: COLUMNS, FROM: FROM, months: months, build: build, cell: cell, gaps: gaps,
    toCsv: toCsv, toHtml: toHtml, fileName: fileName, monthWords: monthWords };
}));
