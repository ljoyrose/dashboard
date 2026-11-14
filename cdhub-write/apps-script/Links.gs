/**
 * Record-to-record links (14 Nov 2026, DRAFT; Lisa decision C, 13 Nov: one link table, shown on both sides,
 * addable from either side; free tags are links of a kind that carries no rule meaning).
 *
 *   action 'link_add'  adds one BLD-links row: from_table/from_id -> to_table/to_id with a link_kind_key.
 *   action 'link_end'  ends one row by filling its to_date (blank = today). Never deletes, never edits anything else.
 *
 * Table names are the file stems (BLD-<table>.csv), so after the plural rename they follow the files. Both records
 * must exist in their files. The kind is a BLD-link_kinds row in force today (owner rows, none fixed here):
 *   from_tables / to_tables  pipes of allowed table names; blank = any
 *   max_per_from             blank = no limit; e.g. 1 for "main" - adding a new one ends the oldest open one in the same save
 *   who_may                  pipes of roles (OWNER, STAFF, ...) or person:<code id>; blank = OWNER only (starting default)
 * A second open row with the same from, to and kind is refused as DUPLICATE.
 * Rows follow STANDARD S4: from_date/to_date, source, set_by, set_on, created_at/updated_at (UTC).
 * Switch: TABLE_ON_links, OFF until Lisa says go.
 */
var LINKS_ = {
  file: 'BLD-links.csv', kinds: 'BLD-link_kinds.csv', on: 'links', idPrefix: 'lnk',
  need: ['id', 'tenant_id', 'from_table', 'from_id', 'to_table', 'to_id', 'link_kind_key', 'sort', 'note',
    'from_date', 'to_date', 'source', 'set_by', 'set_on', 'created_at', 'updated_at']
};
var LINK_TABLE_RE_ = /^[a-z][a-z0-9_]{0,40}$/;

function linksOn_() { return prop_(BLD.PROP.TABLE_ON_PREFIX + LINKS_.on) === 'true'; }
function linksFiles_() { return linksOn_() ? [LINKS_.file] : []; }
function linksUtc_(d) { return new Date(d.getTime()).toISOString().replace(/\.\d{3}Z$/, 'Z'); }

/** The kind rows in force on `day`, by kind_key (latest from_date wins). */
function linkKindsInForce_(day) {
  var read = store_read_(LINKS_.kinds, false), out = {}, tenant = prop_(BLD.PROP.TENANT_ID);
  if (!read) return out;
  read.records.forEach(function (r) {
    var key = String(r.kind_key || '').trim(), from = String(r.from_date || ''), to = String(r.to_date || '');
    if (!key || (tenant && r.tenant_id && r.tenant_id !== tenant)) return;
    if (!from || from > day || (to && to < day)) return;
    if (!out[key] || from >= String(out[key].from_date || '')) out[key] = r;
  });
  return out;
}

function linkPipes_(v) { return String(v || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean); }

/** Who may add/end links of this kind: an owner setting on the kind row; blank = the owner only. */
function linkMay_(kind, who) {
  if (who.role === 'OWNER') return true;
  var may = linkPipes_(kind.who_may);
  return may.indexOf(who.role) >= 0 || (who.id && may.indexOf('person:' + who.id) >= 0);
}

function linkRecordExists_(table, id) {
  var read = store_read_('BLD-' + table + '.csv', false), tenant = prop_(BLD.PROP.TENANT_ID);
  if (!read) return false;
  return read.records.some(function (r) { return r.id === id && (!tenant || !r.tenant_id || r.tenant_id === tenant); });
}

function linksEntry_(req, fn) {
  if (!saveEnabled_()) throw err_('SAVE_OFF', 'Saving is switched off.');
  if (!req || typeof req !== 'object') throw err_('BAD_REQUEST', 'That request was not understood.');
  if (!linksOn_()) throw err_('TABLE_OFF', 'Saving to ' + LINKS_.file + ' is switched off.');
  var rid = String(req.request_id || '');
  if (!/^[A-Za-z0-9_\-]{8,64}$/.test(rid)) throw err_('BAD_REQUEST', 'The request had no valid reference.');
  var who = authStaff_(req.code);
  var cache = CacheService.getScriptCache(), cached = cache.get('rid:' + rid);
  if (cached) { var again = JSON.parse(cached); again.repeat = true; return again; }
  var f = req.fields && typeof req.fields === 'object' ? req.fields : {};
  var result = withLock_(function () { return fn(f, who, new Date()); });
  cache.put('rid:' + rid, JSON.stringify(result), BLD.LIMITS.REQUEST_CACHE_SEC);
  return result;
}

function linksRead_() {
  var read = store_read_(LINKS_.file, true);
  dogcardHeader_(read, LINKS_.need, LINKS_.file);
  return read;
}

function linkOpen_(r, day) { return !String(r.to_date || '') || String(r.to_date) >= day; }

function sinkLinkAdd_(req) {
  return linksEntry_(req, function (f, who, now) {
    var errors = {}, today = todayLondon_(now), tenant = prop_(BLD.PROP.TENANT_ID);
    var ft = String(f.from_table || '').trim(), fid = String(f.from_id || '').trim();
    var tt = String(f.to_table || '').trim(), tid = String(f.to_id || '').trim();
    var key = String(f.link_kind_key || '').trim(), from = String(f.from_date || '').trim() || today;
    var sort = String(f.sort == null ? '' : f.sort).trim();
    if (!LINK_TABLE_RE_.test(ft)) errors.from_table = 'Say which list this is from.';
    if (!LINK_TABLE_RE_.test(tt)) errors.to_table = 'Say which list this links to.';
    if (!ID_RE_.test(fid)) errors.from_id = 'Say which record this is from.';
    if (!ID_RE_.test(tid)) errors.to_id = 'Say which record this links to.';
    if (ft === tt && fid === tid) errors.to_id = 'Choose a different record.';
    if (!isRealDate_(from)) errors.from_date = 'Use a real date as YYYY-MM-DD.';
    if (sort && !/^\d{1,6}$/.test(sort)) errors.sort = 'Use a whole number.';
    var kinds = linkKindsInForce_(today), kind = kinds[key];
    if (!kind) errors.link_kind_key = Object.keys(kinds).length ? 'Choose a kind of link on the list.' : 'No kinds of link are set up yet (BLD-link_kinds).';
    var note = dogcardText_(f.note, 'note', errors, 500), source = dogcardText_(f.source, 'source', errors, 200);
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });
    if (!linkMay_(kind, who)) throw err_('NOT_ALLOWED', 'Your role is not allowed to do this. Ask the owner.');
    var fts = linkPipes_(kind.from_tables), tts = linkPipes_(kind.to_tables);
    if (fts.length && fts.indexOf(ft) < 0) throw err_('INVALID', 'Please check the highlighted fields.', { fields: { from_table: 'This kind of link cannot start from ' + ft + '.' } });
    if (tts.length && tts.indexOf(tt) < 0) throw err_('INVALID', 'Please check the highlighted fields.', { fields: { to_table: 'This kind of link cannot go to ' + tt + '.' } });
    if (!linkRecordExists_(ft, fid) || !linkRecordExists_(tt, tid)) throw err_('NOT_FOUND', 'That record was not found, so nothing was saved.');

    var read = linksRead_(), mine = function (r) { return !tenant || !r.tenant_id || r.tenant_id === tenant; };
    var open = read.records.map(function (r, i) { return { r: r, i: i }; }).filter(function (x) {
      return mine(x.r) && x.r.from_table === ft && x.r.from_id === fid && x.r.link_kind_key === key && linkOpen_(x.r, from);
    });
    var clash = open.filter(function (x) { return x.r.to_table === tt && x.r.to_id === tid; })[0];
    if (clash) throw err_('DUPLICATE', 'That link is already there.', { duplicate_of: clash.r.id });

    var stamp = linksUtc_(now), ended = [];
    var max = parseInt(String(kind.max_per_from || ''), 10);
    if (max > 0 && open.length >= max) {
      // e.g. a new main photo: end the oldest open ones so the limit holds after this save
      open.sort(function (a, b) { return String(a.r.from_date).localeCompare(String(b.r.from_date)) || String(a.r.created_at).localeCompare(String(b.r.created_at)); });
      var endOn = addDays_(from, -1) < String(open[0].r.from_date || '') ? from : addDays_(from, -1);
      open.slice(0, open.length - max + 1).forEach(function (x) {
        var row = read.header.map(function (h) {
          if (h === 'to_date') return String(x.r.from_date || '') > endOn ? String(x.r.from_date) : endOn;
          if (h === 'updated_at') return stamp;
          return x.r[h] == null ? '' : String(x.r[h]);
        });
        store_replaceRow_(LINKS_.file, read.header, x.i, row, read);
        ended.push(x.r.id);
      });
      read = linksRead_();
    }
    var ids = {}; read.records.forEach(function (r) { ids[r.id] = 1; });
    var id = newId_(LINKS_.idPrefix, now);
    while (ids[id]) id = newId_(LINKS_.idPrefix, now);
    var v = { id: id, tenant_id: tenant, from_table: ft, from_id: fid, to_table: tt, to_id: tid, link_kind_key: key,
      sort: sort, note: note, from_date: from, to_date: '', source: source || ('CD Hub, ' + who.who),
      set_by: who.id || who.who, set_on: today, created_at: stamp, updated_at: '' };
    store_append_(LINKS_.file, read.header, read.header.map(function (h) { return v[h] == null ? '' : String(v[h]); }), read);
    return { status: 'saved', id: id, link_kind_key: key, ended: ended };
  });
}

function sinkLinkEnd_(req) {
  return linksEntry_(req, function (f, who, now) {
    var rowId = String(f.id || '').trim(), today = todayLondon_(now), to = String(f.to_date || '').trim() || today;
    if (!ID_RE_.test(rowId)) throw err_('INVALID', 'Say which link to end.');
    if (!isRealDate_(to)) throw err_('INVALID', 'Please check the highlighted fields.', { fields: { to_date: 'Use a real date as YYYY-MM-DD.' } });
    var read = linksRead_(), tenant = prop_(BLD.PROP.TENANT_ID), idx = -1;
    read.records.forEach(function (r, i) { if (r.id === rowId && (!tenant || !r.tenant_id || r.tenant_id === tenant)) idx = i; });
    if (idx < 0) throw err_('NOT_FOUND', 'That link was not found.');
    var rec = read.records[idx], kind = linkKindsInForce_(today)[rec.link_kind_key] || {};
    if (!linkMay_(kind, who)) throw err_('NOT_ALLOWED', 'Your role is not allowed to do this. Ask the owner.');
    if (String(rec.to_date || '')) throw err_('NOT_ALLOWED', 'That link has already ended.');
    if (to < String(rec.from_date || '')) throw err_('INVALID', 'Please check the highlighted fields.', { fields: { to_date: 'The end date cannot be before the start date.' } });
    var stamp = linksUtc_(now);
    var row = read.header.map(function (h) { return h === 'to_date' ? to : h === 'updated_at' ? stamp : (rec[h] == null ? '' : String(rec[h])); });
    store_replaceRow_(LINKS_.file, read.header, idx, row, read);
    return { status: 'saved', id: rowId, ended: to };
  });
}
