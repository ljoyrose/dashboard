/**
 * Evidence files (ITEMS, 14 Nov 2026): a photo or a PDF certificate kept as proof of a test or check.
 *
 * The page sends one file with the person's code. This script, running as the account that deployed it, stores it
 * in the Shared Drive folder named by Script Property EVIDENCE_FOLDER_ID (never the tables folder) and returns the
 * file id. The page then saves that id on the record it belongs to (check_log.photo, items.photo), in the normal save.
 * No table is written here. A file whose record is never saved stays in the folder (the owner can tidy it); nothing is
 * made public; the folder id is never returned.
 */
var EVIDENCE_MIMES_ = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function evidenceFolder_() {
  var id = prop_(BLD.PROP.EVIDENCE_FOLDER);
  if (!id) throw err_('NOT_CONFIGURED', 'Evidence files are not set up yet. Create a folder on the Shared Drive and set its id in the script (EVIDENCE_FOLDER_ID).');
  if (id === prop_(BLD.PROP.FOLDER_ID)) throw err_('NOT_CONFIGURED', 'Evidence needs its own Shared Drive folder, not the tables folder.');
  try { return DriveApp.getFolderById(id); }
  catch (e) { throw err_('FOLDER_UNREACHABLE', 'The evidence folder could not be opened. Check the Shared Drive folder id.'); }
}

function sinkEvidenceFile_(req) {
  if (!saveEnabled_()) throw err_('SAVE_OFF', 'Saving is switched off.');
  if (!req || typeof req !== 'object') throw err_('BAD_REQUEST', 'That request was not understood.');
  var rid = String(req.request_id || '');
  if (!/^[A-Za-z0-9_\-]{8,64}$/.test(rid)) throw err_('BAD_REQUEST', 'The request had no valid reference.');
  var who = authStaff_(req.code);
  if (who.role !== 'OWNER' && who.role !== 'STAFF') throw err_('NOT_ALLOWED', 'Your role is not allowed to add evidence.');
  var cache = CacheService.getScriptCache();
  var cached = cache.get('rid:' + rid);
  if (cached) { var again = JSON.parse(cached); again.repeat = true; return again; }
  var f = req.fields && typeof req.fields === 'object' ? req.fields : {};
  var mime = String(f.mime || '').toLowerCase();
  if (EVIDENCE_MIMES_.indexOf(mime) < 0) throw err_('INVALID', 'Choose a photo or a PDF.');
  var forTable = String(f.for_table || '');
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(forTable)) throw err_('INVALID', 'Say what the evidence is for.');
  var forId = String(f.for_id || '');
  if (forId && !ID_RE_.test(forId)) throw err_('INVALID', 'That is not a valid id.');
  var b64 = String(f.file_base64 || '').replace(/\s/g, '');
  if (!b64 || b64.length > BLD.LIMITS.MAX_PHOTO_B64) throw err_('INVALID', b64 ? 'That file is too large. Use a smaller photo or PDF.' : 'Choose a photo or a PDF.');
  var bytes;
  try { bytes = Utilities.base64Decode(b64); }
  catch (e) { throw err_('INVALID', 'That file could not be read.'); }
  if (!bytes || bytes.length < 8) throw err_('INVALID', 'That file could not be read.');
  if (mime === 'application/pdf' && String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== '%PDF') throw err_('INVALID', 'That is not a PDF.');
  var ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[mime];
  var name = 'evidence-' + forTable + (forId ? '-' + forId : '') + '-' + Utilities.formatDate(new Date(), BLD.TZ, 'yyyyMMdd-HHmmss') + '.' + ext;
  var result = withLock_(function () {
    var created = evidenceFolder_().createFile(Utilities.newBlob(bytes, mime, name));
    return { status: 'saved', file_id: created.getId(), mime: mime, by: who.who };
  });
  cache.put('rid:' + rid, JSON.stringify(result), BLD.LIMITS.REQUEST_CACHE_SEC);
  return result;
}
