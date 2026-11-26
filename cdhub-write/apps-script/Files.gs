DOGCARD_.files = { file: 'BLD-files.csv', on: 'files', idPrefix: 'fil', user: false,
  need: ['id', 'tenant_id', 'kind', 'drive_file_id', 'url', 'mime', 'name', 'size_bytes', 'taken_on', 'sha256', 'source', 'set_by', 'set_on', 'created_at', 'updated_at'] };
var FILE_KINDS_ = ['photo', 'upload', 'link'];

function filesStoreFiles_() {
  return prop_(BLD.PROP.TABLE_ON_PREFIX + DOGCARD_.files.on) === 'true' ? [DOGCARD_.files.file] : [];
}

function filesFolder_() {
  var id = prop_(BLD.PROP.FILES_FOLDER);
  if (!id) throw err_('NOT_CONFIGURED', 'The file store is not set up yet. Create the folder on the Shared Drive and set its id in the script.');
  if (id === prop_(BLD.PROP.FOLDER_ID)) throw err_('NOT_CONFIGURED', 'The file store needs its own Shared Drive folder, not the tables folder.');
  try { return DriveApp.getFolderById(id); }
  catch (e) { throw err_('FOLDER_UNREACHABLE', 'The file store folder could not be opened. Check the Shared Drive folder id.'); }
}

function fileRule_(key, day) {
  var rules, best = null, tenant = prop_(BLD.PROP.TENANT_ID);
  try { rules = store_read_('BLD-breeding_rule.csv', true); } catch (e) { return ''; }
  rules.records.forEach(function (r) {
    if (String(r.rule_key || '') !== key || (tenant && r.tenant_id && r.tenant_id !== tenant)) return;
    var from = String(r.effective_from || ''), to = String(r.to_date || '');
    if (!from || from > day || (to && to < day) || !String(r.value || '').trim()) return;
    if (!best || from >= String(best.effective_from)) best = r;
  });
  return best ? String(best.value).trim() : '';
}

function fileMayAdd_(who, day) {
  var list = fileRule_('file.who_may', day).split('|').map(function (x) { return x.trim(); }).filter(String);
  if (who.role === 'USER' || !list.length) return who.role === 'USER';
  return list.some(function (x) { return x.toUpperCase() === who.role || (who.id && x === 'person:' + who.id); });
}

function fileBytesMatch_(bytes, mime) {
  var b = function (i) { return (bytes[i] + 256) % 256; };
  var ascii = function (i, s) { for (var k = 0; k < s.length; k++) if (b(i + k) !== s.charCodeAt(k)) return false; return true; };
  if (mime === 'image/jpeg') return b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF;
  if (mime === 'image/png') return b(0) === 0x89 && ascii(1, 'PNG');
  if (mime === 'image/gif') return ascii(0, 'GIF8');
  if (mime === 'image/webp') return ascii(0, 'RIFF') && ascii(8, 'WEBP');
  if (mime === 'application/pdf') return ascii(0, '%PDF');
  return true;
}

function sinkFileAdd_(req) {
  return sinkDogcard_(req, 'files', function (spec, f, who, now) {
    var errors = {}, today = todayLondon_(now);
    if (!fileMayAdd_(who, today)) throw err_('NOT_ALLOWED', 'Your role is not allowed to add files. The user can change this.');
    var kind = String(f.kind || '').trim();
    if (FILE_KINDS_.indexOf(kind) < 0) errors.kind = 'Choose photo, file or link.';
    var takenOn = String(f.taken_on || '').trim();
    if (takenOn && !isRealDate_(takenOn)) errors.taken_on = 'Use a real date as YYYY-MM-DD.';
    else if (takenOn && takenOn > today) errors.taken_on = 'That date is in the future.';
    var name = dogcardText_(f.name, 'name', errors, 200), source = dogcardText_(f.source, 'source', errors, 200);
    var url = '', mime = '', bytes = null;
    if (kind === 'link') {
      url = String(f.url || '').trim();
      if (!/^https:\/\/[^\s"'<>]{3,2000}$/i.test(url)) errors.url = 'Paste a web address starting https://';
    } else if (kind) {
      mime = String(f.mime || '').toLowerCase().trim();
      var types = fileRule_('file.types', today).toLowerCase().split('|').map(function (t) { return t.trim(); }).filter(String);
      if (!types.length) errors.mime = 'No file types are set up yet (file.types row).';
      else if (types.indexOf(mime) < 0) errors.mime = 'That kind of file is not on the allowed list.';
      var b64 = String(f.data_base64 || '').replace(/\s/g, '');
      if (!b64) errors.data_base64 = 'Choose a file.';
      else if (b64.length > BLD.LIMITS.MAX_FILE_B64) errors.data_base64 = 'That file is too large.';
      else {
        try { bytes = Utilities.base64Decode(b64); } catch (e) { errors.data_base64 = 'That file could not be read.'; }
        var max = +fileRule_('file.max_bytes', today);
        if (bytes && max > 0 && bytes.length > max) errors.data_base64 = 'That file is too large.';
        if (bytes && bytes.length < 8) errors.data_base64 = 'That file could not be read.';
        else if (bytes && !fileBytesMatch_(bytes, mime)) errors.data_base64 = 'That file is not the kind it says it is.';
      }
    }
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });

    var read = store_read_(spec.file, true);
    dogcardHeader_(read, spec.need, spec.file);
    var tenant = prop_(BLD.PROP.TENANT_ID);
    var sha = bytes ? hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes)) : '';
    var same = read.records.filter(function (r) {
      if (tenant && r.tenant_id && r.tenant_id !== tenant) return false;
      return sha ? r.sha256 === sha : (r.kind === 'link' && r.url === url);
    })[0];
    if (same) return { status: 'saved', id: same.id, already: true };

    var driveId = '';
    if (bytes) {
      var ext = (name.match(/\.([A-Za-z0-9]{1,8})$/) || [])[1] || (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/g, '');
      var stored = 'file-' + Utilities.formatDate(now, 'UTC', 'yyyyMMdd-HHmmss') + '-' + sha.slice(0, 8) + '.' + ext;   // never a dog's name
      var created = filesFolder_().createFile(Utilities.newBlob(bytes, mime, stored));
      driveId = created.getId();
    }
    var createdAt = Utilities.formatDate(now, 'UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
    var id;
    try {
      id = dogcardAppend_(spec, { kind: kind, drive_file_id: driveId, url: url, mime: mime, name: name,
        size_bytes: bytes ? String(bytes.length) : '', taken_on: takenOn, sha256: sha,
        source: source || ('CD Hub, ' + who.who + ', ' + today), set_by: who.id || who.who, set_on: today,
        created_at: createdAt, updated_at: '' });
    } catch (err) {
      if (driveId) { try { DriveApp.getFileById(driveId).setTrashed(true); } catch (x) { /* row not written; the stored file may stay */ } }
      throw err;
    }
    return { status: 'saved', id: id, drive_file_id: driveId };
  });
}

