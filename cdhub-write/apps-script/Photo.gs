/**
 * Dog photos for the CD Hub cards.
 *
 * The page sends one picture (the signed-in person's staff code, same as The round). This script,
 * running as the account that deployed it, stores the file in the Shared Drive folder named by
 * Script Property DOG_PHOTOS_FOLDER_ID and writes that file's id into the dog's `photo` cell.
 *
 * The subject table is BLD-subject.csv, read the same way as every other table here: a Google Sheet
 * uses its first tab (the tab name is not fixed and is not looked up), a CSV uses the file text.
 * The photo column is found by the header name `photo`, never by a column letter or a fixed position.
 *
 * Nothing here makes the file public. The folder id is never returned to the page.
 */

var SUBJECT_FILE_ = 'BLD-subject.csv';
var PHOTO_HEADER_ = 'photo';
var PHOTO_MIMES_ = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function dogPhotoFolder_() {
  var id = prop_(BLD.PROP.DOG_PHOTOS_FOLDER);
  if (!id) throw err_('NOT_CONFIGURED', 'Dog photos are not set up yet. Create a folder on the Shared Drive and set its id in the script.');
  if (id === prop_(BLD.PROP.FOLDER_ID)) throw err_('NOT_CONFIGURED', 'Dog photos need their own Shared Drive folder, not the tables folder.');
  try { return DriveApp.getFolderById(id); }
  catch (e) { throw err_('FOLDER_UNREACHABLE', 'The dog photos folder could not be opened. Check the Shared Drive folder id.'); }
}

/**
 * Where the photo cell is. Returns {read, idx, col}. Refuses if the header has no `photo` column
 * or the dog id is not on this sheet. Does not write.
 */
function subjectPhotoSlot_(subjectId) {
  var read = store_read_(SUBJECT_FILE_, true);
  var col = -1, h;
  for (h = 0; h < read.header.length; h++) if (read.header[h] === PHOTO_HEADER_) col = h;
  if (col < 0) throw err_('HEADER_MISMATCH', SUBJECT_FILE_ + ' has no photo column, so the photo was not linked. Add a column named photo and try again.');
  var tenant = prop_(BLD.PROP.TENANT_ID), hasTenant = read.header.indexOf('tenant_id') >= 0, idx = -1, i;
  for (i = 0; i < read.records.length; i++) {
    if (read.records[i].id !== subjectId) continue;
    if (hasTenant && tenant && read.records[i].tenant_id && read.records[i].tenant_id !== tenant) continue;
    idx = i; break;
  }
  if (idx < 0) throw err_('NOT_FOUND', 'That dog was not found, so the photo was not linked.');
  return { read: read, idx: idx, col: col };
}

/** Replace only the photo cell of one subject row. Other cells, and every other row, stay as they were. */
function store_setSubjectPhoto_(slot, fileId) {
  var read = slot.read, idx = slot.idx, col = slot.col, title = SUBJECT_FILE_;
  var row = [], h;
  for (h = 0; h < read.header.length; h++) row.push(read.records[idx][read.header[h]] || '');
  if (row[col] === fileId) return;
  row[col] = fileId;
  if (read.kind === 'sheet') { store_replaceSheetRow_(title, idx, row, read); return; }
  var file = read.file, before = read.text, beforeHash = textHash_(before);
  if (textHash_(file.getBlob().getDataAsString('UTF-8')) !== beforeHash) {
    throw err_('CHANGED_DURING_WRITE', title + ' changed while saving. Nothing was changed. Try again.');
  }
  var spans = csvSpans_(before);
  if (spans.length !== read.records.length + 1 || idx < 0 || idx >= read.records.length) {
    throw err_('UNEXPECTED_LAYOUT', title + ' is laid out in a way the edit cannot handle safely, so nothing was changed.');
  }
  var sp = spans[idx + 1];
  var head = before.slice(0, sp.start), tail = before.slice(sp.end);
  var after = head + csvLine_(row) + tail;
  store_commit_(file, title, before, beforeHash, after, function (check) {
    return check.slice(0, head.length) === head && check.slice(check.length - tail.length) === tail;
  });
}

function sinkDogPhoto_(req) {
  if (!saveEnabled_()) throw err_('SAVE_OFF', 'Saving is switched off.');
  if (!req || typeof req !== 'object') throw err_('BAD_REQUEST', 'That request was not understood.');
  var rid = String(req.request_id || '');
  if (!/^[A-Za-z0-9_\-]{8,64}$/.test(rid)) throw err_('BAD_REQUEST', 'The request had no valid reference.');
  var who = authStaff_(req.code);
  if (who.role !== 'OWNER' && who.role !== 'STAFF') throw err_('NOT_ALLOWED', 'Your role is not allowed to add a photo.');
  var cache = CacheService.getScriptCache();
  var cached = cache.get('rid:' + rid);
  if (cached) { var again = JSON.parse(cached); again.repeat = true; return again; }
  var result = withLock_(function () { return sinkDogPhotoLocked_(req); });
  cache.put('rid:' + rid, JSON.stringify(result), BLD.LIMITS.REQUEST_CACHE_SEC);
  return result;
}

function sinkDogPhotoLocked_(req) {
  var f = req.fields && typeof req.fields === 'object' ? req.fields : {};
  var subjectId = String(f.subject_id || '').trim();
  if (!ID_RE_.test(subjectId)) throw err_('INVALID', 'Say which dog the photo is for.');
  var mime = String(f.mime || '').toLowerCase();
  if (PHOTO_MIMES_.indexOf(mime) < 0) throw err_('INVALID', 'Choose a picture.');
  var b64 = String(f.image_base64 || '').replace(/\s/g, '');
  if (!b64 || b64.length > BLD.LIMITS.MAX_PHOTO_B64) throw err_('INVALID', b64 ? 'That picture is too large.' : 'Choose a picture.');
  var bytes;
  try { bytes = Utilities.base64Decode(b64); }
  catch (e) { throw err_('INVALID', 'That picture could not be read.'); }
  if (!bytes || bytes.length < 8) throw err_('INVALID', 'That picture could not be read.');
  var slot = subjectPhotoSlot_(subjectId);   // refuse before any file is created
  var now = new Date();
  var ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : mime === 'image/gif' ? 'gif' : 'jpg';
  var name = 'dog-' + subjectId + '-' + Utilities.formatDate(now, BLD.TZ, 'yyyyMMdd-HHmmss') + '.' + ext;
  var created = dogPhotoFolder_().createFile(Utilities.newBlob(bytes, mime, name));
  var fileId = created.getId();
  try {
    store_setSubjectPhoto_(slot, fileId);
  } catch (err) {
    try { created.setTrashed(true); } catch (x) { /* cell was not changed; the new file may still be in the folder */ }
    throw err;
  }
  return { status: 'saved', subject_id: subjectId, file_id: fileId };
}
