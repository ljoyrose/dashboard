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
  var it = store_folder_().getFilesByName(title), found = [];
  while (it.hasNext()) found.push(it.next());
  if (found.length > 1) {
    throw err_('DUPLICATE_TITLE', 'There are two files called ' + title + ' in the folder. Lisa needs to rename one before saving can use it.');
  }
  return found.length ? found[0] : null;
}

/* ------------------------------------------------------------------------------------------------------------
 * Google Sheets (7 Nov 2026: every BLD table became a Google Sheet that keeps its ".csv" name).
 * A Sheet is read as text the same way a CSV is, so every check above and in Sink.gs is unchanged:
 *   - the first tab is the table; the header is row 1 with trailing empty cells dropped;
 *   - each row is read as the text shown in the cell (getDisplayValues), cut to the header's width;
 *   - `text` is those rows written out as CSV, so the same hash proves nothing changed while saving.
 * Writing adds ONE row under the last row, stored as plain text ("@") so Sheets never turns 18.5 into a number,
 * a date into its own format or a microchip number into 9.8E+14. The read-back check and the exact undo work the
 * same way as for a CSV: if the check fails, the added row is removed again (or, for an edit, the old values are
 * put back) and the result is checked by hash. Sheets also keeps its own version history.
 * ---------------------------------------------------------------------------------------------------------- */
var SHEET_MIME_ = 'application/vnd.google-apps.spreadsheet';

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
  var records = got.rows.slice(1).map(function (r) {
    var o = {};
    for (var i = 0; i < header.length; i++) o[header[i]] = r[i] === undefined ? '' : r[i];
    return o;
  });
  var text = store_rowsText_(got.rows);
  return { file: file, kind: 'sheet', tab: sh, text: text, size: text.length, header: header, records: records,
           rowNums: got.rowNums, width: got.width, lastRow: sh.getLastRow() };
}

/** Same as the CSV append, for a Sheet. `read` is store_readSheet_ taken inside the same lock. */
function store_appendSheet_(title, rowValues, read) {
  var sh = read.tab, beforeHash = textHash_(read.text);
  var now = store_sheetRows_(sh);
  if (textHash_(store_rowsText_(now.rows)) !== beforeHash || sh.getLastRow() !== read.lastRow) {
    throw err_('CHANGED_DURING_WRITE', title + ' changed while saving. Nothing was saved. Try again.');
  }
  var w = read.width, vals = rowValues.slice(0, w).map(function (v) { return v === null || v === undefined ? '' : String(v); });
  while (vals.length < w) vals.push('');
  var at = read.lastRow + 1;
  if (sh.getMaxRows() < at) sh.insertRowsAfter(sh.getMaxRows(), 1);
  var rg = sh.getRange(at, 1, 1, w);
  rg.setNumberFormat('@');
  rg.setValues([vals]);
  SpreadsheetApp.flush();
  var want = textHash_(read.text + csvLine_(vals) + '\r\n');
  var check = store_sheetRows_(sh);
  if (textHash_(store_rowsText_(check.rows)) === want) return read.text + csvLine_(vals) + '\r\n';
  var restored = false;
  try {
    if (sh.getLastRow() === at) sh.deleteRow(at);
    else sh.getRange(at, 1, 1, w).clearContent();
    SpreadsheetApp.flush();
    restored = textHash_(store_rowsText_(store_sheetRows_(sh).rows)) === beforeHash;
  } catch (e) { restored = false; }
  throw err_('VERIFY_FAILED',
    restored
      ? 'The table did not read back as expected after saving, so the added row was taken out again and nothing was saved. Try again; if it repeats, tell Lisa.'
      : 'The table did not read back as expected after saving AND taking the row out again could not be confirmed. Tell Lisa now; do not save again. The earlier version is in the Sheet\'s version history.',
    { restored: restored, file: title });
}

/** Same as the CSV in-place edit, for a Sheet: ONE row's values change, every other cell must be identical. */
function store_replaceSheetRow_(title, index, rowValues, read) {
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
  var rg = sh.getRange(rowNum, 1, 1, w), old = rg.getDisplayValues();
  rg.setNumberFormat('@');
  rg.setValues([vals]);
  SpreadsheetApp.flush();
  var rows = csvRecordsRows_(read);
  rows[index + 1] = vals;
  var want = textHash_(store_rowsText_(rows));
  if (textHash_(store_rowsText_(store_sheetRows_(sh).rows)) === want) return store_rowsText_(rows);
  var restored = false;
  try {
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

function sameHeader_(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
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
  var sh = read.tab, beforeHash = textHash_(read.text), now = store_sheetRows_(sh);
  if (textHash_(store_rowsText_(now.rows)) !== beforeHash || sh.getLastRow() !== read.lastRow) throw err_('CHANGED_DURING_WRITE', title + ' changed while saving. Nothing was saved. Try again.');
  var w = read.width, n = rows.length, at = read.lastRow + 1;
  var vals = rows.map(function (r) { var v = r.slice(0, w).map(function (x) { return x === null || x === undefined ? '' : String(x); }); while (v.length < w) v.push(''); return v; });
  if (sh.getMaxRows() < at + n - 1) sh.insertRowsAfter(sh.getMaxRows(), at + n - 1 - sh.getMaxRows());
  var rg = sh.getRange(at, 1, n, w);
  rg.setNumberFormat('@');
  rg.setValues(vals);
  SpreadsheetApp.flush();
  var text = read.text + vals.map(function (v) { return csvLine_(v) + '\r\n'; }).join('');
  if (textHash_(store_rowsText_(store_sheetRows_(sh).rows)) === textHash_(text)) return text;
  var restored = false;
  try {
    for (var i = n - 1; i >= 0; i--) { if (sh.getLastRow() === at + i) sh.deleteRow(at + i); else sh.getRange(at + i, 1, 1, w).clearContent(); }
    SpreadsheetApp.flush();
    restored = textHash_(store_rowsText_(store_sheetRows_(sh).rows)) === beforeHash;
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
  if (read.kind === 'sheet') return store_appendSheet_(title, rowValues, read);
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
 * Create a header-only table. Used ONLY by adminCreateEmptyTables (Lisa, from the editor).
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
function store_lookups_(spec, tenantId) {
  var out = {};
  for (var i = 0; i < spec.lookups.length; i++) {
    var lk = spec.lookups[i];
    var r = store_read_(lk.file, false);
    if (!r) { out[lk.name] = null; continue; }
    var set = {};
    r.records.forEach(function (rec) {
      if (!rec.tenant_id || rec.tenant_id === tenantId) set[rec[lk.idCol]] = lk.valCol ? (rec[lk.valCol] || true) : true;   // valCol: keep one column (e.g. a thermometer's area_id)
    });
    out[lk.name] = set;
  }
  return out;
}
