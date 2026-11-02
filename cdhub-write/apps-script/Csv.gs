/** CSV helpers (RFC 4180). Pure functions: no Apps Script services used. */

/** Parse CSV text into an array of rows (arrays of strings). Handles quotes, CRLF/LF, BOM. */
function csvParse_(text) {
  var rows = [], row = [], field = '', inQ = false, i = 0, n = text.length;
  if (n && text.charCodeAt(0) === 0xFEFF) i = 1;
  for (; i < n; i++) {
    var c = text.charAt(i);
    if (inQ) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') { field += '"'; i++; } else { inQ = false; }
      } else { field += c; }
    } else if (c === '"' && field === '') {
      inQ = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text.charAt(i + 1) === '\n') i++;
      row.push(field); field = ''; rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Parse into {header:[...], records:[{col:value}]}. Blank lines are skipped. */
function csvRecords_(text) {
  var rows = csvParse_(text).filter(function (r) { return !(r.length === 1 && r[0] === ''); });
  if (!rows.length) return { header: [], records: [] };
  var header = rows[0];
  var records = rows.slice(1).map(function (r) {
    var o = {};
    for (var i = 0; i < header.length; i++) o[header[i]] = r[i] === undefined ? '' : r[i];
    return o;
  });
  return { header: header, records: records };
}

/** Escape one value for CSV. */
function csvEscape_(v) {
  var s = (v === null || v === undefined) ? '' : String(v);
  if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Build one CSV line (no line ending) from values in column order. */
function csvLine_(values) {
  return values.map(csvEscape_).join(',');
}

/** Detect the line ending a file already uses (default CRLF, which the BLD files use). */
function csvEol_(text) {
  var m = /\r\n|\n/.exec(text);
  return m ? m[0] : '\r\n';
}

/**
 * Where each record sits in the raw text, so one record can be replaced without touching a byte of the others.
 * Returns [{start, end, next}] for the header (index 0) and then each non-blank record in order, matching
 * csvRecords_: start..end is the record without its line ending, next is where the following record begins.
 */
function csvSpans_(text) {
  var spans = [], n = text.length, i = 0, inQ = false, start = 0, fields = 0, field = '';
  if (n && text.charCodeAt(0) === 0xFEFF) { i = 1; start = 1; }
  function closeRow(end, next) {
    fields++; // the field in progress
    var blank = fields === 1 && field === '';
    if (!blank) spans.push({ start: start, end: end, next: next });
    fields = 0; field = '';
  }
  for (; i < n; i++) {
    var c = text.charAt(i);
    if (inQ) {
      if (c === '"') { if (text.charAt(i + 1) === '"') { field += '"'; i++; } else { inQ = false; } } else { field += c; }
    } else if (c === '"' && field === '') {
      inQ = true;
    } else if (c === ',') {
      fields++; field = '';
    } else if (c === '\r' || c === '\n') {
      var end = i, next = i + 1;
      if (c === '\r' && text.charAt(i + 1) === '\n') { next = i + 2; i++; }
      closeRow(end, next);
      start = next;
    } else {
      field += c;
    }
  }
  if (field !== '' || fields > 0) closeRow(n, n);
  return spans;
}
