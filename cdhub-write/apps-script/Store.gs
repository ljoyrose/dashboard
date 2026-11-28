/**
 * Drive access. The ONLY place that touches files.
 *
 * Append-only rule, in plain words: a save adds one line to the end of a file.
 * Google Drive has no real "append", so the script reads the whole file, adds one
 * line, and writes it back. To make that safe it:
 *   1. refuses unless the file header is exactly what the sink expects,
 *   2. refuses if the file changed while it was working (compared by a hash of the text, not just its size),
 *   3. checks afterwards that every old byte is still there and only one line was added,
 *   4. if that check fails, puts the exact old text back and says so.
 * It never truncates, never edits a line, never deletes. Drive keeps the previous
 * version in the file's version history as a second safety net.
 */

function store_folder_() {
  var id = prop_(BLD.PROP.FOLDER_ID);
  if (!id) throw err_('NOT_CONFIGURED', 'The BLD folder has not been set up in the script (BLD_FOLDER_ID).');
  try { return DriveApp.getFolderById(id); }
  catch (e) { throw err_('FOLDER_UNREACHABLE', 'The script cannot open the BLD folder. Check BLD_FOLDER_ID and sharing.'); }
}

/** Find exactly one file by exact title. null if none. Two with the same title = refuse (like CD Hub). */
function store_findOne_(title) {
  // 17 Nov 2026 (saves took 17-127 s): a save looks up several files by name, and each search of the folder is slow.
  // The id found is remembered for 5 minutes. A remembered id is used only if that file still has this exact name and
  // is not in the bin; otherwise the folder is searched again, with the two-files-one-name check, as before.
  var cache = null, key = 'fileid:' + title;
  try { cache = CacheService.getScriptCache(); } catch (e) { cache = null; }
  var known = cache ? cache.get(key) : null;
  if (known) {
    try {
      var f = DriveApp.getFileById(known);
      if (f.getName() === title && !f.isTrashed()) return f;
    } catch (e) { /* gone or unreadable: search again */ }
  }
  var it = store_folder_().getFilesByName(title), found = [];
  while (it.hasNext()) found.push(it.next());
  if (found.length > 1) {
    throw err_('DUPLICATE_TITLE', 'There are two files called ' + title + ' in the folder. Lisa needs to rename one before saving can use it.');
  }
  if (found.length && cache) { try { cache.put(key, found[0].getId(), 300); } catch (e) { /* remembering is only a speed-up */ } }
  return found.length ? found[0] : null;
}

/* ------------------------------------------------------------------------------------------------------------
 * Google Sheets (7 Nov 2026: every BLD table became a Google Sheet that keeps its ".csv" name).
 * A Sheet is read as text the same way a CSV is, so every check above and in Sink.gs is unchanged:
 *   - the first tab is the table; the header is row 1 with trailing empty cells dropped;
 *   - each row is read as the text shown in the cell (getDisplayValues), cut to the header's width;
 *   - `text` is those rows written out as CSV, so the same hash proves nothing changed while saving.
 * Writing adds ONE row under the last row, stored as plain text ("@") so Sheets never turns a microchip number into
 * 9.8E+14 or a code into a date. EXCEPT the columns a table lists in sheetTypes (Specs.gs; Report 15 Nov 2026: "issues with
 * text and numbers" in BLD-area_reading): those are written as real values, the same as the rows typed in by hand -
 * a number as a number shown to 1 decimal place, a date and time as a real date shown as UK time (2026-11-12 21:53).
 * Reading them back, a real date cell becomes London ISO text (2026-11-12T21:53:37+00:00), so every check that
 * compares times or period_start reads old and new rows alike. The read-back check and the exact undo work the
 * same way as for a CSV: if the check fails, the added row is removed again (or, for an edit, the old values are
 * put back) and the result is checked by hash. Sheets also keeps its own version history.
 * ---------------------------------------------------------------------------------------------------------- */
var SHEET_MIME_ = 'application/vnd.google-apps.spreadsheet';

var SHEET_DT_FORMAT_ = 'yyyy-mm-dd hh:mm';
var SHEET_NUM_FORMATS_ = { num1: '0.0', int: '0' };

/** The sheetTypes of the table kept in `title` (Specs.gs), one entry per header column ('' = plain text). null = none. */
function store_typesFor_(title, header) {
  var spec = null;
  if (typeof TABLES === 'object') Object.keys(TABLES).forEach(function (k) { if (TABLES[k].file === title && TABLES[k].sheetTypes) spec = TABLES[k]; });
  if (!spec) return null;
  return header.map(function (h) { return spec.sheetTypes[h] || ''; });
}
function store_isDate_(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()); }
/** A real date cell as London ISO text with a +HH:MM offset (never 'Z'), the form the hub and the staff page send. */
function store_isoOf_(d) {
  return Utilities.formatDate(d, BLD.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX").replace(/Z$/, '+00:00');
}
/** One cell to write: {v, f}. A typed column gets a real number or date; anything that does not read as one stays text. */
function store_typedCell_(v, t) {
  var s = v === null || v === undefined ? '' : String(v);
  if (!t || s === '') return { v: s, f: '@' };
  if (SHEET_NUM_FORMATS_[t]) return /^-?\d+(\.\d+)?$/.test(s) ? { v: Number(s), f: SHEET_NUM_FORMATS_[t] } : { v: s, f: '@' };
  if (t === 'datetime') {
    var ms = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s) ? Date.parse(s) : NaN;
    return isNaN(ms) ? { v: s, f: '@' } : { v: new Date(ms), f: SHEET_DT_FORMAT_ };
  }
  return { v: s, f: '@' };
}
/** Rows of values -> {values, formats} for setValues / setNumberFormats. types null = all plain text, as before. */
function store_typedRows_(rows, types) {
  var out = { values: [], formats: [] };
  rows.forEach(function (r) {
    var vs = [], fs = [];
    r.forEach(function (v, j) { var c = store_typedCell_(v, types ? types[j] : ''); vs.push(c.v); fs.push(c.f); });
    out.values.push(vs); out.formats.push(fs);
  });
  return out;
}
/** Did the cells read back (getValues) hold what was written? Dates to the second, numbers exactly, text exactly. */
function store_sameTyped_(got, want) {
  for (var i = 0; i < want.length; i++) for (var j = 0; j < want[i].length; j++) {
    var g = got[i][j], w = want[i][j];
    if (store_isDate_(w)) { if (!store_isDate_(g) || Math.abs(g.getTime() - w.getTime()) >= 1000) return false; }
    else if (typeof w === 'number') { if (Number(g) !== w || g === '') return false; }
    else if (String(g === null || g === undefined ? '' : g) !== w) return false;
  }
  return true;
}

function store_isSheet_(file) { return !!(file && file.getMimeType && file.getMimeType() === SHEET_MIME_); }

function store_tab_(file) { return SpreadsheetApp.openById(file.getId()).getSheets()[0]; }

/** All rows of the tab as text, cut to the header width. Returns {rows, rowNums, width}. Blank rows are skipped. */
function store_sheetRows_(sh) {
  var lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (!lr || !lc) return { rows: [], rowNums: [], width: 0 };
  var all = sh.getRange(1, 1, lr, lc).getDisplayValues();
  var head = all[0].slice();
  while (head.length && head[head.length - 1] === '') head.pop();
  var w = head.length, rows = [], nums = [];
  for (var i = 0; i < all.length; i++) {
    var r = all[i].slice(0, w);
    if (i > 0 && r.every(function (x) { return x === ''; })) continue;
    while (r.length < w) r.push('');
    rows.push(r); nums.push(i + 1);
  }
  return { rows: rows, rowNums: nums, width: w };
}

function store_rowsText_(rows) { return rows.map(csvLine_).join('\r\n') + (rows.length ? '\r\n' : ''); }

function store_readSheet_(file) {
  var sh = store_tab_(file), got = store_sheetRows_(sh);
  var header = got.rows.length ? got.rows[0] : [];
  var types = store_typesFor_(file.getName(), header), real = {};
  // a real date cell in a datetime column is read as London ISO text (shown "2026-11-12 21:53"; read 2026-11-12T21:53:37+00:00)
  if (types && got.rows.length > 1) types.forEach(function (t, j) {
    if (t !== 'datetime') return;
    var col = sh.getRange(1, j + 1, got.rowNums[got.rowNums.length - 1], 1).getValues();
    real[j] = got.rowNums.map(function (n) { var v = (col[n - 1] || [])[0]; return store_isDate_(v) ? store_isoOf_(v) : null; });
  });
  var records = got.rows.slice(1).map(function (r, k) {
    var o = {};
    for (var i = 0; i < header.length; i++) o[header[i]] = real[i] && real[i][k + 1] !== null ? real[i][k + 1] : (r[i] === undefined ? '' : r[i]);
    // a column kept unnamed ('') by the save system but named in the live header (variance_c): also read under '' so an
    // edit writes it back unchanged instead of blank
    for (i = 0; i < header.length; i++) if (HEADER_NAMED_BLANK_[header[i]] === true && header.indexOf('') < 0) o[''] = o[header[i]];
    return o;
  });
  var text = store_rowsText_(got.rows);
  return { file: file, kind: 'sheet', tab: sh, text: text, size: text.length, header: header, records: records,
           rowNums: got.rowNums, width: got.width, lastRow: sh.getLastRow(), shown: got.rows, types: types };
}

/**
 * Fast read for an append (16 Nov 2026: BLD-area_reading has ~31,000 rows and every save read all of them, ~25 s).
 * Reads the header, the LAST `n` rows in full, and only the columns named in `fullCols` for every row (e.g. id, so a
 * new id is still checked against every row; the slot columns, so a late reading is still checked against every slot).
 * Returns the same shape as store_readSheet_ with records = the last n rows only, plus tail: true, tailFrom (sheet row
 * of the first tail row), full: {col: [values for every data row]} and complete (true when the tail is the whole table).
 * Not a Sheet (CSV): the normal full read. Only for appends: an edit in place needs store_read_.
 */
function store_readTail_(title, n, fullCols) {
  var file = store_findOne_(title);
  if (!file) throw err_('FILE_MISSING', title + ' does not exist yet. Lisa needs to create it before this can be saved.');
  if (!store_isSheet_(file)) { var all = store_read_(title, true); all.complete = true; return all; }
  var sh = store_tab_(file), lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (!lr || !lc) return store_readSheet_(file);
  var head = sh.getRange(1, 1, 1, lc).getDisplayValues()[0].slice();
  while (head.length && head[head.length - 1] === '') head.pop();
  var w = head.length, from = Math.max(2, lr - n + 1), types = store_typesFor_(file.getName(), head);
  if (!w) return store_readSheet_(file);
  var rows = [head], nums = [1];
  if (lr >= from) {
    var block = sh.getRange(from, 1, lr - from + 1, w).getDisplayValues();
    var real = {};
    if (types) types.forEach(function (t, j) {
      if (t === 'datetime') real[j] = sh.getRange(from, j + 1, lr - from + 1, 1).getValues();
    });
    var realRows = [];
    block.forEach(function (r, i) {
      if (r.every(function (x) { return x === ''; })) return;
      rows.push(r.slice()); nums.push(from + i);
      var rr = {}; for (var j in real) { var v = (real[j][i] || [])[0]; rr[j] = store_isDate_(v) ? store_isoOf_(v) : null; }
      realRows.push(rr);
    });
  }
  var records = rows.slice(1).map(function (r, k) {
    var o = {};
    for (var i = 0; i < w; i++) o[head[i]] = realRows[k][i] !== undefined && realRows[k][i] !== null ? realRows[k][i] : (r[i] === undefined ? '' : r[i]);
    for (i = 0; i < w; i++) if (HEADER_NAMED_BLANK_[head[i]] === true && head.indexOf('') < 0) o[''] = o[head[i]];
    return o;
  });
  var full = {};
  (fullCols || []).forEach(function (c) {
    var j = head.indexOf(c);
    if (j < 0 || lr < 2) { full[c] = []; return; }
    var dt = types && types[j] === 'datetime';
    var col = dt ? sh.getRange(2, j + 1, lr - 1, 1).getValues() : sh.getRange(2, j + 1, lr - 1, 1).getDisplayValues();
    // 20 Nov 2026 (saves took 49-98 s, most of it here): every old date was turned into London text on every save,
    // about 62,000 times. These columns are only ever compared as instants (Date.parse in Sink.gs), so the plain
    // UTC form, which costs almost nothing, gives the same answers.
    full[c] = col.map(function (x) { var v = x[0]; return dt ? (store_isDate_(v) ? v.toISOString() : String(v === undefined || v === null ? '' : v)) : v; });
  });
  var text = store_rowsText_(rows);
  return { file: file, kind: 'sheet', tab: sh, text: text, size: text.length, header: head, records: records,
           rowNums: nums, width: w, lastRow: lr, shown: rows, types: types,
           tail: true, tailFrom: from, full: full, complete: from === 2 };
}

/* FAST APPEND CHECKS (16 Nov 2026: saves took about 25 s each and a second person got "Someone else is saving").
 * An append used to read the WHOLE tab three times (once to read, once before writing, once after). The temperature
 * log is over 30,000 rows, so the lock was held for most of that time. Now, after the one full read, an append checks
 * only what an append can disturb: the row count, the header row and the last row before writing, then reads back
 * just the new rows and the row above them. A row ADDED by anyone between read and write still stops the save
 * (CHANGED_DURING_WRITE). In-place edits (owner edit) keep the full whole-tab checks. */
function store_rowShown_(sh, rowNum, w) { return csvLine_(sh.getRange(rowNum, 1, 1, w).getDisplayValues()[0]); }
/** Is the tab still exactly as read where an append could disturb it: same last row, same header, same last row text? */
function store_tailSame_(sh, read) {
  if (sh.getLastRow() !== read.lastRow) return false;
  var w = read.width, shown = read.shown || [];
  if (!shown.length) return true;
  if (store_rowShown_(sh, 1, w) !== csvLine_(shown[0])) return false;
  var lastNum = read.rowNums[read.rowNums.length - 1];
  return shown.length < 2 || store_rowShown_(sh, lastNum, w) === csvLine_(shown[shown.length - 1]);
}

/** Same as the CSV append, for a Sheet. `read` is store_readSheet_ taken inside the same lock. */
function store_appendSheet_(title, rowValues, read) {
  var sh = read.tab;
  if (!store_tailSame_(sh, read)) {
    throw err_('CHANGED_DURING_WRITE', title + ' changed while saving. Nothing was saved. Try again.');
  }
  var w = read.width, vals = rowValues.slice(0, w).map(function (v) { return v === null || v === undefined ? '' : String(v); });
  while (vals.length < w) vals.push('');
  var at = read.lastRow + 1;
  if (sh.getMaxRows() < at) sh.insertRowsAfter(sh.getMaxRows(), 1);
  var rg = sh.getRange(at, 1, 1, w), typed = store_typedRows_([vals], read.types);
  if (read.types) rg.setNumberFormats(typed.formats); else rg.setNumberFormat('@');
  rg.setValues(read.types ? typed.values : [vals]);
  SpreadsheetApp.flush();
  // read back only the new row and the row above it (see FAST APPEND CHECKS)
  var aboveOk = read.shown.length < 2 || store_rowShown_(sh, read.rowNums[read.rowNums.length - 1], w) === csvLine_(read.shown[read.shown.length - 1]);
  var newShown = sh.getRange(at, 1, 1, w).getDisplayValues()[0];
  if (sh.getLastRow() === at && aboveOk) {
    if (!read.types) { if (csvLine_(newShown) === csvLine_(vals)) return read.text + csvLine_(vals) + '\r\n'; }
    else if (store_sameTyped_(rg.getValues(), typed.values)) return read.text + csvLine_(newShown) + '\r\n';   // exactly the numbers and dates sent
  }
  var restored = false;
  try {
    if (sh.getLastRow() === at) sh.deleteRow(at);
    else sh.getRange(at, 1, 1, w).clearContent();
    SpreadsheetApp.flush();
    restored = store_tailSame_(sh, read);
  } catch (e) { restored = false; }
  throw err_('VERIFY_FAILED',
    restored
      ? 'The table did not read back as expected after saving, so the added row was taken out again and nothing was saved. Try again; if it repeats, tell Lisa.'
      : 'The table did not read back as expected after saving AND taking the row out again could not be confirmed. Tell Lisa now; do not save again. The earlier version is in the Sheet\'s version history.',
    { restored: restored, file: title });
}

/** Same as the CSV in-place edit, for a Sheet: ONE row's values change, every other cell must be identical. */
function store_replaceSheetRow_(title, index, rowValues, read) {
  if (read.tail) throw err_('UNEXPECTED_LAYOUT', title + ' was read in part, so nothing was changed. Try again.');
  var sh = read.tab, beforeHash = textHash_(read.text);
  if (textHash_(store_rowsText_(store_sheetRows_(sh).rows)) !== beforeHash) {
    throw err_('CHANGED_DURING_WRITE', title + ' changed while saving. Nothing was changed. Try again.');
  }
  if (index < 0 || index >= read.records.length) {
    throw err_('UNEXPECTED_LAYOUT', title + ' is laid out in a way the edit cannot handle safely, so nothing was changed.');
  }
  var rowNum = read.rowNums[index + 1], w = read.width;
  var vals = rowValues.slice(0, w).map(function (v) { return v === null || v === undefined ? '' : String(v); });
  while (vals.length < w) vals.push('');
  var rg = sh.getRange(rowNum, 1, 1, w), typed = store_typedRows_([vals], read.types);
  var old = read.types ? rg.getValues() : rg.getDisplayValues(), oldFmt = read.types ? rg.getNumberFormats() : null;
  if (read.types) rg.setNumberFormats(typed.formats); else rg.setNumberFormat('@');
  rg.setValues(read.types ? typed.values : [vals]);
  SpreadsheetApp.flush();
  var rows = (read.shown || csvRecordsRows_(read)).slice();
  if (!read.types) {
    rows[index + 1] = vals;
    var want = textHash_(store_rowsText_(rows));
    if (textHash_(store_rowsText_(store_sheetRows_(sh).rows)) === want) return store_rowsText_(rows);
  } else {
    var now = store_sheetRows_(sh).rows, others = now.slice(); others.splice(index + 1, 1); rows.splice(index + 1, 1);
    if (now.length === read.shown.length && textHash_(store_rowsText_(others)) === textHash_(store_rowsText_(rows)) && store_sameTyped_(rg.getValues(), typed.values)) return store_rowsText_(now);
  }
  var restored = false;
  try {
    if (oldFmt) rg.setNumberFormats(oldFmt);
    rg.setValues(old); SpreadsheetApp.flush();
    restored = textHash_(store_rowsText_(store_sheetRows_(sh).rows)) === beforeHash;
  } catch (e) { restored = false; }
  throw err_('VERIFY_FAILED',
    restored
      ? 'The table did not read back as expected after the edit, so the old values were put back and nothing was changed. Try again; if it repeats, tell Lisa.'
      : 'The table did not read back as expected after the edit AND putting the old values back could not be confirmed. Tell Lisa now. The earlier version is in the Sheet\'s version history.',
    { restored: restored, file: title });
}

/** The rows a Sheet read was made from (header first), rebuilt from the read so nothing is fetched again. */
function csvRecordsRows_(read) {
  return [read.header.slice()].concat(read.records.map(function (rec) { return read.header.map(function (h) { return rec[h]; }); }));
}

/** Read a table (Google Sheet or CSV). If `must` and it is missing, say so plainly. */
function store_read_(title, must) {
  var file = store_findOne_(title);
  if (!file) {
    if (must) throw err_('FILE_MISSING', title + ' does not exist yet. Lisa needs to create it before this can be saved.');
    return null;
  }
  if (store_isSheet_(file)) return store_readSheet_(file);
  var text = file.getBlob().getDataAsString('UTF-8');
  var parsed = csvRecords_(text);
  return { file: file, text: text, size: file.getSize(), header: parsed.header, records: parsed.records };
}

/* A column the save system keeps unnamed ('') may carry one of these names in the live header (named area_reading's
   7th column variance_c on 15 Nov 2026). Either state is accepted; any other change still stops the save. */
var HEADER_NAMED_BLANK_ = { variance_c: true };
function sameHeader_(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) if (a[i] !== b[i] && !(b[i] === '' && HEADER_NAMED_BLANK_[a[i]] === true)) return false;
  return true;
}

/** SHA-256 of a piece of text, as hex. Used to prove a file is unchanged, not just the same size. */
function textHash_(text) {
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8));
}

/**
 * Append one row. `title` must be on the allow-list. `read` is the result of
 * store_read_ taken inside the same lock.
 *
 * Safety, in order:
 *  1. file header must be exactly what the sink expects
 *  2. just before writing, the file is read again and its HASH must equal the hash of what we read
 *     earlier (so a same-size edit is caught too)
 *  3. write, then read back: the hash must equal the hash of the text we meant to write, and every
 *     old byte must still be there
 *  4. if step 3 fails, the EXACT old text is written back and checked by hash. The error says whether
 *     the restore worked. The caller logs it in the approvals queue.
 */
/** Several rows in one write: all of them are saved or none are. Same guards and read-back as store_append_. */
function store_appendMany_(title, expectedHeader, rows, read) {
  if (allowedFiles_().indexOf(title) < 0) throw err_('FILE_NOT_ALLOWED', 'That file is not one the save system is allowed to change.');
  if (!sameHeader_(read.header, expectedHeader)) {
    throw err_('HEADER_MISMATCH', title + ' does not have the columns the save system expects, so nothing was saved. Lisa needs to check the file header.');
  }
  if (read.kind === 'sheet') return store_appendManySheet_(title, rows, read);
  var file = read.file, before = read.text, beforeHash = textHash_(before);
  if (textHash_(file.getBlob().getDataAsString('UTF-8')) !== beforeHash) throw err_('CHANGED_DURING_WRITE', title + ' changed while saving. Nothing was saved. Try again.');
  var eol = csvEol_(before), base = before;
  if (base.length && !/(\r\n|\n)$/.test(base)) base += eol;
  var after = base + rows.map(function (r) { return csvLine_(r) + eol; }).join('');
  return store_commit_(file, title, before, beforeHash, after, function (check) { return check.indexOf(before) === 0; });
}

function store_appendManySheet_(title, rows, read) {
  var sh = read.tab;
  if (!store_tailSame_(sh, read)) throw err_('CHANGED_DURING_WRITE', title + ' changed while saving. Nothing was saved. Try again.');
  var w = read.width, n = rows.length, at = read.lastRow + 1;
  var vals = rows.map(function (r) { var v = r.slice(0, w).map(function (x) { return x === null || x === undefined ? '' : String(x); }); while (v.length < w) v.push(''); return v; });
  if (sh.getMaxRows() < at + n - 1) sh.insertRowsAfter(sh.getMaxRows(), at + n - 1 - sh.getMaxRows());
  var rg = sh.getRange(at, 1, n, w), typed = store_typedRows_(vals, read.types);
  if (read.types) rg.setNumberFormats(typed.formats); else rg.setNumberFormat('@');
  rg.setValues(read.types ? typed.values : vals);
  SpreadsheetApp.flush();
  // read back only the new rows and the row above them (see FAST APPEND CHECKS)
  var aboveOk = read.shown.length < 2 || store_rowShown_(sh, read.rowNums[read.rowNums.length - 1], w) === csvLine_(read.shown[read.shown.length - 1]);
  var back = sh.getRange(at, 1, n, w).getDisplayValues();
  if (sh.getLastRow() === at + n - 1 && aboveOk) {
    if (!read.types) {
      if (back.map(csvLine_).join('\n') === vals.map(csvLine_).join('\n')) return read.text + vals.map(function (v) { return csvLine_(v) + '\r\n'; }).join('');
    } else if (store_sameTyped_(rg.getValues(), typed.values)) return read.text + back.map(function (v) { return csvLine_(v) + '\r\n'; }).join('');
  }
  var restored = false;
  try {
    for (var i = n - 1; i >= 0; i--) { if (sh.getLastRow() === at + i) sh.deleteRow(at + i); else sh.getRange(at + i, 1, 1, w).clearContent(); }
    SpreadsheetApp.flush();
    restored = store_tailSame_(sh, read);
  } catch (e) { restored = false; }
  throw err_('VERIFY_FAILED', restored
    ? 'The table did not read back as expected after saving, so the added rows were taken out again and nothing was saved. Try again; if it repeats, tell Lisa.'
    : 'The table did not read back as expected after saving and could not be put back. Do not save again. Tell Lisa.');
}

function store_append_(title, expectedHeader, rowValues, read) {
  if (allowedFiles_().indexOf(title) < 0) {
    throw err_('FILE_NOT_ALLOWED', 'That file is not one the save system is allowed to change.');
  }
  if (!sameHeader_(read.header, expectedHeader)) {
    throw err_('HEADER_MISMATCH', title + ' does not have the columns the save system expects, so nothing was saved. Lisa needs to check the file header.');
  }
  if (read.kind === 'sheet') return store_appendSheet_(title, rowValues, read);   // a tail read (store_readTail_) has the same shape
  var file = read.file;
  var before = read.text;
  var beforeHash = textHash_(before);
  if (textHash_(file.getBlob().getDataAsString('UTF-8')) !== beforeHash) {
    throw err_('CHANGED_DURING_WRITE', title + ' changed while saving. Nothing was saved. Try again.');
  }
  var eol = csvEol_(before);
  var base = before;
  if (base.length && !/(\r\n|\n)$/.test(base)) base += eol;
  var after = base + csvLine_(rowValues) + eol;
  return store_commit_(file, title, before, beforeHash, after, function (check) { return check.indexOf(before) === 0; });
}

/**
 * Write `after`, read it back, prove it is exactly what was meant (hash) and that `unchangedOk(check)` holds
 * (every byte that must not change did not). If not, put the EXACT old text back and say whether that worked.
 */
function store_commit_(file, title, before, beforeHash, after, unchangedOk) {
  var afterHash = textHash_(after);
  file.setContent(after);
  var check = file.getBlob().getDataAsString('UTF-8');
  if (textHash_(check) !== afterHash || !unchangedOk(check)) {
    var restored = false;
    try {
      file.setContent(before);
      restored = textHash_(file.getBlob().getDataAsString('UTF-8')) === beforeHash;
    } catch (e) { restored = false; }
    throw err_('VERIFY_FAILED',
      restored
        ? 'The file did not read back as expected after saving, so the earlier text was put back exactly and nothing was saved. Try again; if it repeats, tell Lisa.'
        : 'The file did not read back as expected after saving AND putting the earlier text back could not be confirmed. Tell Lisa now; do not save again. The earlier version is in the file history.',
      { restored: restored, file: title });
  }
  return after;
}

/**
 * OWNER EDIT: replace ONE existing record in place. Called only from the owner-only approval page.
 * Same safeguards as an append: allow-list, exact header, hash of the file unchanged since it was read,
 * read-back by hash, exact restore on failure. In addition every byte OUTSIDE the replaced record must be
 * identical afterwards. No copy of the old record is kept by this script (Drive's own file history still is).
 * `index` is the position in read.records (0 = first data row).
 */
function store_replaceRow_(title, expectedHeader, index, rowValues, read) {
  if (allowedFiles_().indexOf(title) < 0 || title === BLD.PENDING_FILE) {
    throw err_('FILE_NOT_ALLOWED', 'That file is not one the save system is allowed to change.');
  }
  if (!sameHeader_(read.header, expectedHeader)) {
    throw err_('HEADER_MISMATCH', title + ' does not have the columns the save system expects, so nothing was changed. Lisa needs to check the file header.');
  }
  if (read.kind === 'sheet') return store_replaceSheetRow_(title, index, rowValues, read);
  var file = read.file, before = read.text, beforeHash = textHash_(before);
  if (textHash_(file.getBlob().getDataAsString('UTF-8')) !== beforeHash) {
    throw err_('CHANGED_DURING_WRITE', title + ' changed while saving. Nothing was changed. Try again.');
  }
  var spans = csvSpans_(before);
  if (spans.length !== read.records.length + 1 || index < 0 || index >= read.records.length) {
    throw err_('UNEXPECTED_LAYOUT', title + ' is laid out in a way the edit cannot handle safely, so nothing was changed.');
  }
  var sp = spans[index + 1];
  var head = before.slice(0, sp.start), tail = before.slice(sp.end);
  var after = head + csvLine_(rowValues) + tail;
  return store_commit_(file, title, before, beforeHash, after, function (check) {
    return check.slice(0, head.length) === head && check.slice(check.length - tail.length) === tail;
  });
}

/**
 * OWNER DELETE (17 Nov 2026): take ONE existing record out of a table for good. Same safeguards as the in-place
 * edit: allow-list, exact header, unchanged since read, read-back by hash, exact restore on failure; every other record
 * must be byte-identical afterwards. `index` is the position in read.records (0 = first data row).
 */
function store_deleteRow_(title, expectedHeader, index, read) {
  if (allowedFiles_().indexOf(title) < 0 || title === BLD.PENDING_FILE) {
    throw err_('FILE_NOT_ALLOWED', 'That file is not one the save system is allowed to change.');
  }
  if (!sameHeader_(read.header, expectedHeader)) {
    throw err_('HEADER_MISMATCH', title + ' does not have the columns the save system expects, so nothing was changed. Lisa needs to check the file header.');
  }
  if (index < 0 || index >= read.records.length) {
    throw err_('UNEXPECTED_LAYOUT', title + ' is laid out in a way the delete cannot handle safely, so nothing was changed.');
  }
  if (read.kind === 'sheet') {
    if (read.tail) throw err_('UNEXPECTED_LAYOUT', title + ' was read in part, so nothing was changed. Try again.');
    var sh = read.tab, beforeHash = textHash_(read.text);
    if (textHash_(store_rowsText_(store_sheetRows_(sh).rows)) !== beforeHash) {
      throw err_('CHANGED_DURING_WRITE', title + ' changed while saving. Nothing was changed. Try again.');
    }
    var rows = (read.shown || csvRecordsRows_(read)).slice(), rowNum = read.rowNums[index + 1], w = read.width;
    var old = sh.getRange(rowNum, 1, 1, w).getValues();
    rows.splice(index + 1, 1);
    sh.deleteRow(rowNum); SpreadsheetApp.flush();
    var want = textHash_(store_rowsText_(rows));
    if (textHash_(store_rowsText_(store_sheetRows_(sh).rows)) === want) return store_rowsText_(rows);
    var restored = false;
    try { sh.insertRowBefore(rowNum); sh.getRange(rowNum, 1, 1, w).setValues(old); SpreadsheetApp.flush();
      restored = textHash_(store_rowsText_(store_sheetRows_(sh).rows)) === beforeHash; } catch (e) { restored = false; }
    throw err_('VERIFY_FAILED', restored
      ? 'The table did not read back as expected after the delete, so the row was put back and nothing was changed. Try again; if it repeats, tell Lisa.'
      : 'The table did not read back as expected after the delete AND putting the row back could not be confirmed. Tell Lisa now. The earlier version is in the Sheet\'s version history.',
      { restored: restored, file: title });
  }
  var file = read.file, before = read.text, bh = textHash_(before);
  if (textHash_(file.getBlob().getDataAsString('UTF-8')) !== bh) {
    throw err_('CHANGED_DURING_WRITE', title + ' changed while saving. Nothing was changed. Try again.');
  }
  var spans = csvSpans_(before);
  if (spans.length !== read.records.length + 1) {
    throw err_('UNEXPECTED_LAYOUT', title + ' is laid out in a way the delete cannot handle safely, so nothing was changed.');
  }
  var sp = spans[index + 1], head = before.slice(0, sp.start), tail = before.slice(sp.next === undefined ? sp.end : sp.next);
  var after = head + tail;
  return store_commit_(file, title, before, bh, after, function (check) {
    return check.slice(0, head.length) === head && check.slice(check.length - tail.length) === tail && check.length === head.length + tail.length;
  });
}

/**
 * Create a header-only table. Used ONLY by adminCreateEmptyTables (from the editor).
 * A new table is a Google Sheet with the ".csv" name, every cell plain text, like the rest of BLD-app-tables.
 */
function store_createEmpty_(title, header) {
  if (allowedFiles_().indexOf(title) < 0) throw err_('FILE_NOT_ALLOWED', 'Not on the allow-list.');
  if (store_findOne_(title)) throw err_('ALREADY_EXISTS', title + ' already exists. Nothing was changed.');
  var ss = SpreadsheetApp.create(title, 100, header.length), sh = ss.getSheets()[0];
  sh.setName(title.replace(/\.csv$/, ''));
  sh.getRange(1, 1, sh.getMaxRows(), header.length).setNumberFormat('@');
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  SpreadsheetApp.flush();
  var file = DriveApp.getFileById(ss.getId());
  file.moveTo(store_folder_());
  return file;
}

/** Load id sets for the lookup tables a spec needs. Missing lookup file => null (honest "cannot check"). */
/**
 * SMALL LISTS READ ON EVERY SAVE (20 Nov 2026: the lookups and the kept-years row took 6-12 s of every save).
 * The rooms, thermometers, jobs and kept-years lists are remembered for up to 2 minutes, and only while the file's
 * Drive "last changed" time is the one they were read at, so an owner's edit is picked up on the next save once
 * Drive shows it, and never more than 2 minutes late. Returns { records } or null when the file does not exist.
 * A list too big to remember (over about 90 KB) is read every time, as before.
 */
function store_readSmall_(title) {
  var file = store_findOne_(title);
  if (!file) return null;
  var cache = null, at = '';
  try { cache = CacheService.getScriptCache(); at = String(file.getLastUpdated().getTime()); } catch (e) { cache = null; }
  var key = 'small:' + file.getId();
  if (cache) {
    try {
      var hit = cache.get(key);
      if (hit) { var o = JSON.parse(hit); if (o.at === at) return { records: o.records, cached: true }; }
    } catch (e) { /* unreadable: read the file */ }
  }
  var r = store_read_(title, false);
  if (!r) return null;
  if (cache && at) {
    try { var text = JSON.stringify({ at: at, records: r.records }); if (text.length < 90000) cache.put(key, text, 120); }
    catch (e) { /* remembering is only a speed-up */ }
  }
  return { records: r.records };
}

function store_lookups_(spec, tenantId, fields) {
  // 22 Nov 2026 (a job save spent 7.7-12.8 s here): each list is read once per save, not once per lookup on it (the
  // job types were read 4 times), and a lookup only one field needs (onlyIfField) is skipped when the save does not
  // send that field (the whole job log was read for every job save, but only a note uses it). Callers that pass no
  // fields (edits) get every lookup, as before.
  var out = {}, got = {};
  for (var i = 0; i < spec.lookups.length; i++) {
    var lk = spec.lookups[i];
    if (lk.onlyIfField && fields && !String(fields[lk.onlyIfField] || '').trim()) continue;
    if (!Object.prototype.hasOwnProperty.call(got, lk.file)) got[lk.file] = store_readSmall_(lk.file);
    var r = got[lk.file];
    if (!r) { out[lk.name] = null; continue; }
    var set = {};
    r.records.forEach(function (rec) {
      if (!rec.tenant_id || rec.tenant_id === tenantId) set[rec[lk.idCol]] = lk.valCol ? (rec[lk.valCol] || true) : true;   // valCol: keep one column (e.g. a thermometer's area_id)
    });
    out[lk.name] = set;
  }
  return out;
}
