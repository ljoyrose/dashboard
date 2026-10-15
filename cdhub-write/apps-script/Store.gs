/**
 * Drive access. The ONLY place that touches files.
 *
 * Append-only rule, in plain words: a save adds one line to the end of a file.
 * Google Drive has no real "append", so the script reads the whole file, adds one
 * line, and writes it back. To make that safe it:
 *   1. refuses unless the file header is exactly what the sink expects,
 *   2. refuses if the file changed while it was working,
 *   3. checks afterwards that every old byte is still there and only one line was added.
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

/** Read a CSV file. If `must` and it is missing, say so plainly. */
function store_read_(title, must) {
  var file = store_findOne_(title);
  if (!file) {
    if (must) throw err_('FILE_MISSING', title + ' does not exist yet. Lisa needs to create it before this can be saved.');
    return null;
  }
  var text = file.getBlob().getDataAsString('UTF-8');
  var parsed = csvRecords_(text);
  return { file: file, text: text, size: file.getSize(), header: parsed.header, records: parsed.records };
}

function sameHeader_(a, b) {
  if (a.length !== b.length) return false;
  for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Append one row. `title` must be on the allow-list. `read` is the result of
 * store_read_ taken inside the same lock.
 */
function store_append_(title, expectedHeader, rowValues, read) {
  if (allowedFiles_().indexOf(title) < 0) {
    throw err_('FILE_NOT_ALLOWED', 'That file is not one the save system is allowed to change.');
  }
  if (!sameHeader_(read.header, expectedHeader)) {
    throw err_('HEADER_MISMATCH', title + ' does not have the columns the save system expects, so nothing was saved. Lisa needs to check the file header.');
  }
  var file = read.file;
  var before = read.text;
  if (file.getSize() !== read.size) {
    throw err_('CHANGED_DURING_WRITE', title + ' changed while saving. Nothing was saved. Try again.');
  }
  var eol = csvEol_(before);
  var base = before;
  if (base.length && !/(\r\n|\n)$/.test(base)) base += eol;
  var after = base + csvLine_(rowValues) + eol;
  file.setContent(after);
  // verify: every old byte still there, exactly one new line added
  var check = file.getBlob().getDataAsString('UTF-8');
  if (check !== after || check.indexOf(before) !== 0) {
    throw err_('VERIFY_FAILED', 'The file did not read back as expected after saving. Tell Lisa now; the earlier version is in the file history.');
  }
  return after;
}

/** Create a header-only file. Used ONLY by adminCreateEmptyTables (Lisa, from the editor). */
function store_createEmpty_(title, header) {
  if (allowedFiles_().indexOf(title) < 0) throw err_('FILE_NOT_ALLOWED', 'Not on the allow-list.');
  if (store_findOne_(title)) throw err_('ALREADY_EXISTS', title + ' already exists. Nothing was changed.');
  return store_folder_().createFile(title, csvLine_(header) + '\r\n', 'text/csv');
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
      if (!rec.tenant_id || rec.tenant_id === tenantId) set[rec[lk.idCol]] = true;
    });
    out[lk.name] = set;
  }
  return out;
}
