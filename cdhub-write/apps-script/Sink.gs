
var SAVE_TIMING_ = null;
function timing_(name, ms) {
  console.log('save timing: ' + name + ' ' + ms + ' ms');
  if (SAVE_TIMING_) SAVE_TIMING_[name] = (SAVE_TIMING_[name] || 0) + ms;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(BLD.LIMITS.LOCK_WAIT_MS); }
  catch (e) { throw err_('BUSY', 'Someone else is saving right now. Wait a moment and press save again.'); }
  try { return fn(); } finally { lock.releaseLock(); }
}

function tableOn_(spec) { return prop_(BLD.PROP.TABLE_ON_PREFIX + spec.key) === 'true'; }
function addDays_(ymd, n) {
  var p = ymd.split('-'), t = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
  return t.getUTCFullYear() + '-' + ('0' + (t.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + t.getUTCDate()).slice(-2);
}

function todayLondon_(d) { return Utilities.formatDate(d || new Date(), BLD.TZ, 'yyyy-MM-dd'); }

function modeFor_(spec, now) {
  if (spec && spec.key === 'occupancy') return 'direct';
  var m = prop_(BLD.PROP.MODE_PREFIX + spec.key);
  if (m === 'direct' || m === 'pending') return m;
  if (spec.movesQueue) {
    var until = prop_(BLD.PROP.MOVES_QUEUE_UNTIL);
    if (!isRealDate_(until)) return 'pending';
    return todayLondon_(now) > until ? 'direct' : 'pending';
  }
  return spec.defaultMode === 'direct' ? 'direct' : 'pending';
}
function saveEnabled_() { return prop_(BLD.PROP.SAVE_ENABLED) === 'true'; }

function pendingState_(records) {
  var byId = {};
  records.forEach(function (r) {
    var s = byId[r.pending_id] || (byId[r.pending_id] = { pending_id: r.pending_id, events: [] });
    s.events.push(r);
    if (r.event === 'queued') s.queued = r;
    s.last = r;
  });
  Object.keys(byId).forEach(function (id) {
    var s = byId[id];
    s.waiting = !!s.queued && ['queued', 'approved', 'apply_failed'].indexOf(s.last.event) >= 0;
  });
  return byId;
}

function loadPending_() {
  var p = store_read_(BLD.PENDING_FILE, true);
  if (!sameHeader_(p.header, BLD.PENDING_COLUMNS)) {
    throw err_('HEADER_MISMATCH', BLD.PENDING_FILE + ' does not have the columns the save system expects, so nothing was saved.');
  }
  return p;
}

function appendPendingEvent_(ev) {
  var p = loadPending_();
  var full = {};
  BLD.PENDING_COLUMNS.forEach(function (c) { full[c] = ev[c] === undefined ? '' : ev[c]; });
  store_append_(BLD.PENDING_FILE, BLD.PENDING_COLUMNS, rowValues_(BLD.PENDING_COLUMNS, full), p);
}

function logWriteFailure_(e, spec, rowId, by, now, pendingId) {
  if (!e || e.code !== 'VERIFY_FAILED') return;
  try {
    appendPendingEvent_({
      event_id: newId_('evt', now), pending_id: pendingId || ('direct-' + rowId), event: 'write_check_failed',
      at: londonIso_(now), by: by, target_file: spec.file, row_id: rowId, note: e.userMessage,
      result: e.restored ? 'old text restored' : 'RESTORE NOT CONFIRMED'
    });
  } catch (x) { Logger.log('Could not log a write-check failure for ' + spec.file + ': ' + (x && x.message)); }
}

function waitingRows_(pendState, spec) {
  var out = [];
  Object.keys(pendState).forEach(function (id) {
    var s = pendState[id];
    if (!s.waiting || s.queued.target_file !== spec.file) return;
    try { out.push(JSON.parse(s.queued.payload_json)); } catch (e) { /* ignore unreadable payload */ }
  });
  return out;
}

function dupDay_(v) {
  var t = Date.parse(String(v || ''));
  return isNaN(t) ? '' : todayLondon_(new Date(t));
}

function dupSame_(spec, k, a, b) {
  var x = a[k] || '', y = b[k] || '';
  if (x === y) return true;
  if (!(spec.sheetTypes && spec.sheetTypes[k] === 'datetime') || !x || !y) return false;
  var tx = Date.parse(x), ty = Date.parse(y);
  return !isNaN(tx) && tx === ty;
}

function findDuplicate_(spec, clean, rows, nowMs, today) {
  if (spec.dupSkip && spec.dupSkip(clean)) return null;
  if (spec.dupNewestBy) return newestDuplicate_(spec, clean, rows, nowMs);
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i], same = true;
    if (spec.dupSkip && spec.dupSkip(r)) continue;
    for (var k = 0; k < spec.dupKey.length; k++) {
      if (!dupSame_(spec, spec.dupKey[k], r, clean)) { same = false; break; }
    }
    for (k = 0; same && spec.dupDateCols && k < spec.dupDateCols.length; k++) {
      if (dupDay_(r[spec.dupDateCols[k]]) !== dupDay_(clean[spec.dupDateCols[k]])) same = false;
    }
    if (!same) continue;
    if (spec.dupDayCol) { if ((r[spec.dupDayCol] || '') === today) return r; continue; }   // same calendar day (London)
    if (!spec.dupTimeCol) return r;
    var t = Date.parse(r[spec.dupTimeCol]);
    if (!isNaN(t) && Math.abs(nowMs - t) < BLD.LIMITS.DUP_WINDOW_MIN * 60000) return r;
  }
  return null;
}

function newestDuplicate_(spec, clean, rows, nowMs) {
  var best = null, bestT = -Infinity, k;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i], same = true;
    if (spec.dupSkip && spec.dupSkip(r)) continue;
    for (k = 0; same && k < spec.dupNewestBy.length; k++) {
      if ((r[spec.dupNewestBy[k]] || '') !== (clean[spec.dupNewestBy[k]] || '')) same = false;
    }
    for (k = 0; same && spec.dupDateCols && k < spec.dupDateCols.length; k++) {
      if (dupDay_(r[spec.dupDateCols[k]]) !== dupDay_(clean[spec.dupDateCols[k]])) same = false;
    }
    if (!same) continue;
    var t = Date.parse(r[spec.dupTimeCol]);
    if (isNaN(t) || Math.abs(nowMs - t) >= BLD.LIMITS.DUP_WINDOW_MIN * 60000) continue;
    if (t >= bestT) { best = r; bestT = t; }
  }
  if (!best) return null;
  for (k = 0; k < spec.dupKey.length; k++) {
    if (!dupSame_(spec, spec.dupKey[k], best, clean)) return null;
  }
  return best;
}

function ageCap_(spec, tenant, nowMs, fields) {
  var cap = spec.ageCap;
  if (!cap) return null;
  var own = String((fields && fields[cap.field]) || '').slice(0, 10);
  var day = /^\d{4}-\d{2}-\d{2}$/.test(own) ? own : Utilities.formatDate(new Date(nowMs), BLD.TZ, 'yyyy-MM-dd');
  var years = retentionYears_(cap.retentionSection, tenant, day), oldest = new Date(nowMs);
  oldest.setUTCFullYear(oldest.getUTCFullYear() - years);
  return { oldestMs: oldest.getTime(), keepYears: years, field: cap.field };
}

function rowsInForce_(rows, ymd, fromKey) {
  var day = String(ymd || '').slice(0, 10), fk = fromKey || 'from_date';
  function d(v) { v = String(v || '').trim().slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; }
  return (rows || []).filter(function (r) {
    var f = d(r[fk]), t = d(r.to_date);
    return (!f || f <= day) && (!t || day <= t);
  });
}

function latestInForce_(rows, ymd, fromKey) {
  var fk = fromKey || 'from_date', best = null;
  rowsInForce_(rows, ymd, fk).forEach(function (r) {
    if (!best || String(r[fk] || '').slice(0, 10) >= String(best[fk] || '').slice(0, 10)) best = r;
  });
  return best;
}

function retentionYears_(section, tenant, ymd) {
  var r = store_readSmall_(BLD.RETENTION_FILE);
  if (!r) return BLD.LIMITS.RETENTION_DEFAULT_YEARS;
  var ok = r.records.filter(function (x) {
    return (!x.tenant_id || x.tenant_id === tenant) && String(x.section || '').trim() === section &&
      /^\d{1,2}$/.test(String(x.keep_years || '').trim()) && parseInt(x.keep_years, 10) > 0;
  });
  var row = latestInForce_(ok, ymd || Utilities.formatDate(new Date(), BLD.TZ, 'yyyy-MM-dd'));
  return row ? parseInt(row.keep_years, 10) : BLD.LIMITS.RETENTION_DEFAULT_YEARS;
}

function sameSlot_(late, clean, rows, nowMs) {
  if (!clean[late.field] || Date.parse(clean[late.field]) >= nowMs - BLD.LIMITS.PERIOD_MAX_AGE_HOURS * 3600000) return null;
  var want = Date.parse(clean[late.field]);
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.area_id !== clean.area_id || (r.thermometer_id || '') !== (clean.thermometer_id || '')) continue;
    if (r[late.field] === clean[late.field] || (!isNaN(want) && Date.parse(r[late.field]) === want)) return r;
  }
  return null;
}

function sinkHandle_(req) {
  var now = new Date(), nowMs = now.getTime();
  if (!saveEnabled_()) throw err_('SAVE_OFF', 'Saving is switched off.');
  if (!req || typeof req !== 'object') throw err_('BAD_REQUEST', 'That request was not understood.');
  if (req.action === 'add_many') return sinkHandleMany_(req, now, nowMs);
  if (req.action !== 'add' && req.action !== 'correct' && req.action !== 'add_site' && req.action !== 'add_session') throw err_('BAD_REQUEST', 'Unknown action.');
  var rid = String(req.request_id || '');
  if (!/^[A-Za-z0-9_\-]{8,64}$/.test(rid)) throw err_('BAD_REQUEST', 'The request had no valid reference.');

  var tAuth = Date.now();
  var who = authSaver_(req);
  timing_('sign_in', Date.now() - tAuth);
  if (who.role === ROLE_INSPECTOR) throw err_('NOT_ALLOWED', 'An inspector link can only look. It cannot save anything.');
  var spec = sinkSpecFor_(req, who);

  var cache = CacheService.getScriptCache();
  var cached = cache.get('rid:' + rid);
  if (cached) { var again = JSON.parse(cached); again.repeat = true; return again; }

  var tLock = Date.now(), tIn = 0;
  var result = withLock_(function () {
    tIn = Date.now();
    var inLock = cache.get('rid:' + rid);
    if (inLock) { var dup = JSON.parse(inLock); dup.repeat = true; return dup; }
    var r = (req.action === 'add_site' || req.action === 'add_session') ? sinkSiteProcess_(spec, req, who, now, nowMs) : sinkProcess_(spec, req, who, now, nowMs);
    cache.put('rid:' + rid, JSON.stringify(r), BLD.LIMITS.REQUEST_CACHE_SEC);
    return r;
  });
  timing_('before_lock', tLock - nowMs); timing_('lock_wait', tIn - tLock); timing_('work', Date.now() - tIn);
  if (SAVE_TIMING_) SAVE_TIMING_.table = spec.key;
  return result;
}

function sinkSpecFor_(req, who) {
  var asked = String(req.table || req.file || '');
  var spec = specFor_(asked);
  if (!spec || (req.table && req.file && specFor_(String(req.file)) !== spec)) {
    throw err_('FILE_NOT_ALLOWED', 'That file is not one the save system is allowed to change.');
  }
  if (!tableOn_(spec)) throw err_('TABLE_OFF', 'Saving to ' + spec.file + ' is switched off.');
  if (req.action === 'correct' && spec.noCorrect) {
    throw err_('CORRECT_NOT_SUPPORTED', 'This list has no way to point at an earlier row. Fix a wrong room by moving the dog again.');
  }
  if ((req.action === 'add_site' || req.action === 'add_session') && spec.key !== 'check_log') throw err_('BAD_REQUEST', 'A whole-site tap only applies to staff checks.');
  var permAction = (req.action === 'add_site' || req.action === 'add_session') ? 'add' : req.action;
  if (!spec.perms[permAction] || spec.perms[permAction].indexOf(who.role) < 0) throw err_('NOT_ALLOWED', 'Your role is not allowed to do this. Ask User.');
  return spec;
}

function sinkHandleMany_(req, now, nowMs) {
  var items = req.items;
  if (!Array.isArray(items) || !items.length || items.length > BLD.LIMITS.MAX_BATCH_ITEMS) {
    throw err_('BAD_REQUEST', 'A list save needs 1 to ' + BLD.LIMITS.MAX_BATCH_ITEMS + ' entries.');
  }
  var tAuth = Date.now();
  var who = authSaver_(req);
  timing_('sign_in', Date.now() - tAuth);
  if (who.role === ROLE_INSPECTOR) throw err_('NOT_ALLOWED', 'An inspector link can only look. It cannot save anything.');
  var cache = CacheService.getScriptCache(), out = [], todo = [];
  items.forEach(function (it, i) {
    var rid = String((it && it.request_id) || '');
    if (!it || typeof it !== 'object' || !/^[A-Za-z0-9_\-]{8,64}$/.test(rid)) { out[i] = { request_id: rid, ok: false, code: 'BAD_REQUEST', message: 'The entry had no valid reference.' }; return; }
    var known = cache.get('rid:' + rid);
    if (known) { var a = JSON.parse(known); a.repeat = true; out[i] = { request_id: rid, ok: true, result: a }; return; }
    todo.push(i);
  });
  var tLock = Date.now(), tIn = 0;
  if (todo.length) withLock_(function () {
    tIn = Date.now();
    var held = { read: null, defer: [], extra: [] };
    function flushStaged_() {
      if (!held.defer.length) return;
      var groups = {};
      held.defer.forEach(function (s) {
        (groups[s.spec.file] = groups[s.spec.file] || { spec: s.spec, target: s.target, items: [] }).items.push(s);
      });
      Object.keys(groups).forEach(function (file) {
        var g = groups[file];
        try {
          store_appendMany_(g.spec.file, g.spec.columns, g.items.map(function (s) { return s.written; }), g.target);
          g.items.forEach(function (s) {
            cache.put('rid:' + s.rid, JSON.stringify(s.result), BLD.LIMITS.REQUEST_CACHE_SEC);
            out[s.i] = { request_id: s.rid, ok: true, result: s.result };
          });
        } catch (e) {
          g.items.forEach(function (s) {
            logWriteFailure_(e, g.spec, s.result.id, who.who, now);
            var b = errorBody_(e); b.request_id = s.rid; out[s.i] = b;
          });
        }
      });
      held.defer = []; held.extra = []; held.read = null;
    }
    function sameRead_(spec, one) {
      if (!held.read || held.read.file !== spec.file) return false;
      var fast = !!spec.fastAppend && one.action === 'add' && !spec.checkAgainst;
      var tailWanted = fast && !!spec.dupTimeCol && !lateSlot_(spec, one.fields, nowMs);
      return held.read.fast === fast && held.read.tailWanted === tailWanted;
    }
    todo.forEach(function (i) {
      var it = items[i], rid = String(it.request_id);
      try {
        var known = cache.get('rid:' + rid);
        if (known) { var a = JSON.parse(known); a.repeat = true; out[i] = { request_id: rid, ok: true, result: a }; return; }
        var one = { v: 1, request_id: rid, action: 'add', table: it.table, fields: it.fields && typeof it.fields === 'object' ? it.fields : {} };
        if (it.values && typeof it.values === 'object') one.values = it.values;
        var spec = sinkSpecFor_(one, who);
        var stage = one.action === 'add' && !one.values && !spec.qrKind;
        if (held.defer.length && (!stage || !sameRead_(spec, one))) flushStaged_();
        var n0 = held.defer.length;
        var r = sinkProcess_(spec, one, who, now, nowMs, stage ? held : null);
        if (held.defer.length > n0) held.defer[held.defer.length - 1].i = i;
        else {
          cache.put('rid:' + rid, JSON.stringify(r), BLD.LIMITS.REQUEST_CACHE_SEC);
          out[i] = { request_id: rid, ok: true, result: r };
          if (n0) flushStaged_(); else { held.read = null; held.extra = []; }
        }
      } catch (e) {
        var b = errorBody_(e); b.request_id = rid; out[i] = b;
      }
    });
    flushStaged_();
  });
  timing_('before_lock', tLock - nowMs); timing_('lock_wait', tIn ? tIn - tLock : 0); timing_('work', tIn ? Date.now() - tIn : 0);
  if (SAVE_TIMING_) { SAVE_TIMING_.table = 'add_many'; SAVE_TIMING_.items = items.length; }
  return { status: 'many', items: out };
}

var SESSION_TYPE_ = { 'round.presence': 1, 'round_presence': 1, 'health_check_all': 1, 'exercise_all': 1 };

function checkSettingFor_(typeKey, day) {
  var read = store_read_('BLD-check_setting.csv', false);
  if (!read || !read.records) return null;
  var rows = read.records.filter(function (r) { return String(r.type_key || '') === String(typeKey || ''); });
  return latestInForce_(rows, day, 'from_date');
}

function assertCheckMayLog_(type, day) {
  if (!type) return;
  var s = checkSettingFor_(type.type_key, day);
  if (s && String(s.record_as || '') === 'print') {
    throw err_('INVALID', 'This check is print sheet only, so it is not saved in the log.', { fields: { check_type_id: 'Print sheet only. Change it in Settings if it should be logged.' } });
  }
}

function sessionWanted_(type, day, action) {
  var on = !!(type && SESSION_TYPE_[type.type_key]);
  if (on) {
    var s = checkSettingFor_(type.type_key, day);
    if (s && String(s.session_row || '').toLowerCase() === 'false') on = false;
  }
  if (action === 'add_session' && !on) {
    throw err_('INVALID', 'This check is saved one line per dog.', { fields: { check_type_id: 'One line for the round is off in Settings.' } });
  }
  return on;
}

function sinkSiteProcess_(spec, req, who, now, nowMs) {
  var tenant = prop_(BLD.PROP.TENANT_ID);
  if (!tenant) throw err_('NOT_CONFIGURED', 'The tenant id has not been set up in the script (TENANT_ID).');
  var f = req.fields && typeof req.fields === 'object' ? req.fields : {};
  if (req.values !== undefined && req.values !== null) throw err_('BAD_REQUEST', 'A whole-site tap has no form. Record it on its own to answer the questions.');
  var typeRead = store_read_(TABLES.check_type.file, true);
  var type = typeRead.records.filter(function (r) { return r.id === String(f.check_type_id || '') && r.tenant_id === tenant; })[0];
  if (!type) throw err_('INVALID', 'Some details need fixing before this can be saved.', { fields: { check_type_id: 'That check was not found.' } });
  var today0 = Utilities.formatDate(now, BLD.TZ, 'yyyy-MM-dd');
  assertCheckMayLog_(type, today0);
  var session = sessionWanted_(type, today0, req.action);
  var scopeSet = checkSettingFor_(type.type_key, today0);
  var scope = (scopeSet && String(scopeSet.site_scope || '').trim()) || type.site_scope;
  var room = type.target === 'area' && scope === 'per_dog';
  if (type.target !== 'none' && !room && !session) throw err_('INVALID', 'Some details need fixing before this can be saved.', { fields: { check_type_id: 'That check is not a whole-site check.' } });
  if (room && !f.area_id) throw err_('INVALID', 'Some details need fixing before this can be saved.', { fields: { area_id: 'Say which room.' } });

  var fields = { check_type_id: f.check_type_id, item: f.item, amount: f.amount, outcome: f.outcome, note: f.note, happened_at: f.happened_at, photo: f.photo, how_recorded: f.how_recorded || ((room && !session) ? '' : 'site_tap') };
  if (f.confirm_unusual) fields.confirm_unusual = f.confirm_unusual;
  if (room || (session && f.area_id)) fields.area_id = f.area_id;
  if (!session && scope !== 'per_dog') { req.fields = fields; req.action = 'add'; return sinkProcess_(spec, req, who, now, nowMs); }

  var lookups = store_lookups_(spec, tenant, req.fields);
  var v = validateInput_(spec, fields, lookups, nowMs);
  var dogs = validateInput_({ input: { dog_ids: { type: 'idlist', lookup: 'subject', required: true } } }, { dog_ids: f.dog_ids }, lookups, nowMs);
  var errors = v.errors;
  if (dogs.errors.dog_ids) errors.dog_ids = dogs.errors.dog_ids;
  if (Object.keys(errors).length) throw err_('INVALID', 'Some details need fixing before this can be saved.', { fields: errors });

  var never = {};
  String(type.not_in_areas || '').split('|').forEach(function (a) { a = a.trim(); if (a) never[a] = true; });
  var occ = store_read_(TABLES.occupancy.file, true).records.filter(function (r) { return r.tenant_id === tenant; });
  var today = Utilities.formatDate(now, BLD.TZ, 'yyyy-MM-dd');
  var ids = {}, rows = [], made = [], kept = [], left = { isolation: 0, no_room: 0, off_site: 0, repeat: 0 };
  var read = null, pool = null;
  if (!session) {
    read = appendRead_(spec, { action: 'add', fields: fields }, nowMs);
    if (!sameHeader_(read.target.header, spec.columns)) {
      throw err_('HEADER_MISMATCH', spec.file + ' does not have the columns the save system expects, so nothing was saved. User needs to check the file header.');
    }
    pool = dupRows_(read);
    fillIds_(read, ids);
  }
  dogs.clean.dog_ids.split('|').forEach(function (dog) {
    var at = occupancyLatest_(occ, dog);
    if (at && (String(at.off_site_kind || '') !== '' || permanentlyGone_(at))) { left.off_site++; return; }
    if (!at || !at.area_id) { left.no_room++; return; }
    if (room && at.area_id !== v.clean.area_id) { left.no_room++; return; }
    if (never[at.area_id]) { left.isolation++; return; }
    if (session) { kept.push(dog); return; }
    var clean = {}; for (var k in v.clean) if (Object.prototype.hasOwnProperty.call(v.clean, k)) clean[k] = v.clean[k];
    clean.subject_id = dog;
    if (findDuplicate_(spec, clean, pool, nowMs, today)) { left.repeat++; return; }
    var rowId = newId_(spec.idPrefix, now);
    while (ids[rowId]) rowId = newId_(spec.idPrefix, now);
    ids[rowId] = true;
    var row = buildRow_(spec, clean, { rowId: rowId, tenantId: tenant, nowIso: londonIso_(now), today: today, who: who.who, whoId: who.id || '', correctsId: '' });
    made.push(row); rows.push(rowValues_(spec.columns, row));
  });
  if (session) {
    var exIds = {}, exRaw = String(f.exceptions || '').trim();
    exRaw.split('|').forEach(function (p) { var id = p.split(':')[0].trim(); if (id) exIds[id] = 1; });
    var covered = kept.filter(function (id) { return !exIds[id]; });
    if (!covered.length && !exRaw) {
      throw err_('INVALID', room ? 'None of those dogs are shown in this room.' : 'None of those dogs can be covered by a whole-site tap.', { fields: { dog_ids: 'Record these dogs one at a time.' } });
    }
    fields.covered_ids = covered.join('|');
    fields.exceptions = exRaw;
    fields.outcome = fields.outcome || 'recorded';
    fields.subject_id = '';
    req.fields = fields; req.action = 'add';
    var one = sinkProcess_(spec, req, who, now, nowMs);
    one.saved = 1; one.covered = covered.length; one.covered_ids = fields.covered_ids; one.exceptions = fields.exceptions || ''; one.left_out = left; one.session = true;
    return one;
  }
  if (!rows.length) {
    if (left.repeat) throw err_('DUPLICATE', 'This looks like the same entry as one already saved. If that one is wrong, tell the user.', { duplicate_of: '' });
    throw err_('INVALID', room ? 'None of those dogs are shown in this room.' : 'None of those dogs can be covered by a whole-site tap.', { fields: { dog_ids: 'Record these dogs one at a time.' } });
  }
  try { store_appendMany_(spec.file, spec.columns, rows, read.target); }
  catch (e) { logWriteFailure_(e, spec, made[0].id, who.who, now); throw e; }
  return { status: 'saved', table: spec.key, file: spec.file, id: made[0].id, ids: made.map(function (r) { return r.id; }), saved: made.length, left_out: left, at: made[0].taken_at, who: who.who };
}

function appendRead_(spec, req, nowMs) {
  var fast = !!spec.fastAppend && req && req.action === 'add' && !spec.checkAgainst;
  var fields = req && req.fields;
  var tailWanted = fast && !!spec.dupTimeCol && !lateSlot_(spec, fields, nowMs);
  var tailOnly = tailWanted;
  var target = fast ? store_readTail_(spec.file, BLD.LIMITS.SAVE_TAIL_ROWS, tailOnly ? ['id', spec.dupTimeCol] : fastCols_(spec)) : store_read_(spec.file, true);
  if (tailOnly && target.tail && !target.complete && windowAboveTail_(spec, target, nowMs)) {
    tailOnly = false;
    target = store_readTail_(spec.file, BLD.LIMITS.SAVE_TAIL_ROWS, fastCols_(spec));
  }
  return { target: target, tailOnly: tailOnly, fast: fast, tailWanted: tailWanted, file: spec.file };
}
function dupRows_(read) {
  return read.target.tail && !read.tailOnly ? fastRecords_(read.target) : read.target.records;
}
function fillIds_(read, ids) {
  dupRows_(read).forEach(function (r) { if (r && r.id) ids[r.id] = true; });
  if (read.tailOnly && read.target.full && read.target.full.id) read.target.full.id.forEach(function (id) { if (id) ids[id] = true; });
}

function fastCols_(spec) {
  var c = ['id'].concat(spec.dupKey || [], spec.dupNewestBy || [], spec.dupDateCols || []);
  if (spec.dupTimeCol) c.push(spec.dupTimeCol);
  if (spec.dupDayCol) c.push(spec.dupDayCol);
  if (spec.ageCap) c.push('area_id', 'thermometer_id', spec.ageCap.field);
  return c.filter(function (x, i) { return c.indexOf(x) === i; });
}

function lateSlot_(spec, fields, nowMs) {
  if (!spec.ageCap) return false;
  var v = String((fields && fields[spec.ageCap.field]) || '').trim();
  if (!v) return false;
  var t = Date.parse(v);
  return isNaN(t) || t < nowMs - BLD.LIMITS.PERIOD_MAX_AGE_HOURS * 3600000 + 3600000;
}

function windowAboveTail_(spec, read, nowMs) {
  var times = read.full[spec.dupTimeCol] || [], above = read.tailFrom - 2, win = BLD.LIMITS.DUP_WINDOW_MIN * 60000;
  for (var i = 0; i < above && i < times.length; i++) {
    var t = Date.parse(times[i]);
    if (!isNaN(t) && Math.abs(nowMs - t) < win) return true;
  }
  return false;
}

function fastRecords_(read) {
  var cols = Object.keys(read.full), n = cols.length ? read.full[cols[0]].length : 0, out = [];
  for (var i = 0; i < n; i++) {
    var o = {}, blank = true;
    for (var k = 0; k < cols.length; k++) { o[cols[k]] = read.full[cols[k]][i]; if (o[cols[k]] !== '') blank = false; }
    if (!blank) out.push(o);
  }
  return out;
}

function sinkProcess_(spec, req, who, now, nowMs, held) {
  var tenant = prop_(BLD.PROP.TENANT_ID);
  if (!tenant) throw err_('NOT_CONFIGURED', 'The tenant id has not been set up in the script (TENANT_ID).');

  var tRead = Date.now();
  var fast = !!spec.fastAppend && req.action === 'add' && !spec.checkAgainst;
  var tailWanted = fast && !!spec.dupTimeCol && !lateSlot_(spec, req.fields, nowMs);
  var read, tailOnly, target;
  if (held && held.read && held.read.file === spec.file && held.read.fast === fast && held.read.tailWanted === tailWanted) {
    read = held.read; tailOnly = read.tailOnly; target = read.target;
  } else {
    read = appendRead_(spec, req, nowMs);
    tailOnly = read.tailOnly; target = read.target; fast = read.fast;
    if (held) held.read = read;
  }
  timing_(fast ? (tailOnly ? 'read_tail' : 'read_fast') : 'read', Date.now() - tRead);
  if (!sameHeader_(target.header, spec.columns)) {
    throw err_('HEADER_MISMATCH', spec.file + ' does not have the columns the save system expects, so nothing was saved. User needs to check the file header.');
  }
  var all = target.tail && !tailOnly ? fastRecords_(target) : target.records;
  var tLook = Date.now();
  var lookups = store_lookups_(spec, tenant, req.fields);
  var late = ageCap_(spec, tenant, nowMs, req.fields);
  timing_('lookups_rules', Date.now() - tLook);
  var v = validateInput_(spec, req.fields, lookups, nowMs, late);
  var errors = v.errors;
  var today = Utilities.formatDate(now, BLD.TZ, 'yyyy-MM-dd');
  if (spec.key === 'check_log' && req.action === 'add') {
    var logTypeId = String((req.fields && req.fields.check_type_id) || '');
    var logKey = lookups.check_type_key && lookups.check_type_key[logTypeId];
    if (typeof logKey === 'string') assertCheckMayLog_({ type_key: logKey }, today);
  }

  var pendingRead = null, pendState = {};
  var needPending = req.action === 'correct' || spec.alwaysPending || modeFor_(spec) !== 'direct';
  if (needPending) { pendingRead = loadPending_(); pendState = pendingState_(pendingRead.records); }
  var waiting = waitingRows_(pendState, spec);
  if (spec.checkAgainst && req.action === 'add') spec.checkAgainst(v.clean, target.records.concat(waiting), errors);

  var correctsId = '', reason = '';
  if (req.action === 'correct') {
    correctsId = String(req.corrects_id || '').trim();
    reason = String(req.reason || '').trim();
    if (!ID_RE_.test(correctsId)) {
      errors.corrects_id = 'Say which saved row this corrects.';
    } else {
      var orig = target.records.filter(function (r) { return r.id === correctsId && r.tenant_id === tenant; })[0];
      if (!orig) errors.corrects_id = 'That row was not found in ' + spec.file + '.';
      else if (target.records.some(function (r) { return r.corrects_id === correctsId; }) ||
               waiting.some(function (r) { return r.corrects_id === correctsId; })) {
        errors.corrects_id = 'That row already has a correction saved or waiting. Correct the newer one instead.';
      }
    }
    if (reason.length < 3 || reason.length > BLD.LIMITS.MAX_TEXT_CHARS || CONTROL_RE_.test(reason)) {
      errors.reason = 'Say briefly why it needs correcting (3 to 500 characters, one line).';
    }
  }

  var form = spec.key === 'check_log' ? formAnswers_(req, v.clean, tenant, today, needPending, errors) : null;

  if (Object.keys(errors).length) {
    throw err_('INVALID', 'Some details need fixing before this can be saved.', { fields: errors });
  }

  var extra = (held && held.extra) || [];
  if (req.action === 'add') {
    var dup = findDuplicate_(spec, v.clean, all.concat(waiting, extra), nowMs, today) || (late ? sameSlot_(late, v.clean, all.concat(waiting, extra), nowMs) : null);
    if (dup) {
      throw err_('DUPLICATE', 'This looks like the same entry as one already saved' + (dup.id ? ' (' + dup.id + ')' : '') +
        '. If that one is wrong, tell the user.', { duplicate_of: dup.id || '' });
    }
  }

  var ids = {};
  fillIds_(read, ids);
  extra.forEach(function (r) { if (r && r.id) ids[r.id] = true; });
  var rowId = newId_(spec.idPrefix, now);
  while (ids[rowId]) rowId = newId_(spec.idPrefix, now);

  var row = buildRow_(spec, v.clean, {
    rowId: rowId, tenantId: tenant, nowIso: londonIso_(now), today: today, who: who.who, whoId: who.id || '', correctsId: correctsId
  });

  if (!needPending) {
    if (form && form.answers.length) {
      var vSpec = TABLES.check_value, vIds = {};
      form.read.records.forEach(function (r) { vIds[r.id] = true; });
      var vRows = form.answers.map(function (a) {
        var vid = newId_(vSpec.idPrefix, now);
        while (vIds[vid]) vid = newId_(vSpec.idPrefix, now);
        vIds[vid] = true;
        return rowValues_(vSpec.columns, { id: vid, tenant_id: tenant, check_log_id: rowId, check_field_id: a.field.id, field_key: a.field.field_key, value: a.value });
      });
      try { store_appendMany_(vSpec.file, vSpec.columns, vRows, form.read); }
      catch (e) { logWriteFailure_(e, vSpec, rowId, who.who, now); throw e; }
    }
    var written = rowValues_(spec.columns, row);
    if (held && held.defer && !(form && form.answers.length) && !spec.qrKind) {
      held.extra.push(row);
      var staged = { status: 'saved', table: spec.key, file: spec.file, id: rowId, at: row.taken_at || row.confirmed_at || row.moved_in || '', who: who.who };
      held.defer.push({ spec: spec, written: written, target: target, result: staged, rid: String(req.request_id || '') });
      return staged;
    }
    var tWrite = Date.now();
    try {
      store_append_(spec.file, spec.columns, written, target);
    } catch (e) { logWriteFailure_(e, spec, rowId, who.who, now); throw e; }
    timing_('write', Date.now() - tWrite);
    var qr = spec.qrKind && req.action === 'add' && !row.corrects_id ? qrOnAdd_(spec.qrKind, rowId, spec.qrSub ? String(row[spec.qrSub] || '') : '', who, now) : null;
    var out = { status: 'saved', table: spec.key, file: spec.file, id: rowId, at: row.taken_at || row.confirmed_at || row.moved_in || '', who: who.who };
    if (form) out.answers = form.answers.length;
    if (qr) out.qr = qr.qr;
    return out;
  }

  var pid = newId_('pnd', now);
  appendPendingEvent_({
    event_id: newId_('evt', now), pending_id: pid, event: 'queued', at: londonIso_(now),
    by: who.who, role: who.role, target_file: spec.file,
    kind: req.action === 'correct' ? 'correction' : 'new',
    row_id: rowId, corrects_id: correctsId, note: reason, payload_json: JSON.stringify(row), result: ''
  });
  return { status: 'queued', table: spec.key, file: spec.file, id: rowId, pending_id: pid, who: who.who };
}

function formAnswers_(req, clean, tenant, today, needPending, errors) {
  var given = req.values !== undefined && req.values !== null;
  if (given && (typeof req.values !== 'object' || Array.isArray(req.values))) { errors.values = 'The answers were not understood.'; return null; }
  if (!tableOn_(TABLES.check_value)) {
    if (given && Object.keys(req.values).length) throw err_('TABLE_OFF', 'Saving form answers is switched off.');
    return null;
  }
  if (errors.check_type_id) return null;
  var type = store_read_(TABLES.check_type.file, true).records.filter(function (r) { return r.id === clean.check_type_id && r.tenant_id === tenant; })[0];
  var fRead = store_read_(TABLES.check_field.file, false);
  var happened = String(clean.happened_at || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(happened) && happened < today) today = happened;
  var now = {};
  if (type && fRead) fRead.records.forEach(function (r) {
    if (r.tenant_id !== tenant || r.type_key !== type.type_key || !r.effective_from || r.effective_from > today) return;
    if (!now[r.field_key] || r.effective_from > now[r.field_key].effective_from) now[r.field_key] = r;
  });
  var fields = Object.keys(now).map(function (k) { return now[k]; }).filter(function (r) { return r.active !== 'false'; });
  var vals = given ? req.values : {};
  if (!fields.length && !Object.keys(vals).length) return null;
  if (Object.keys(vals).length > 60) { errors.values = 'Too many answers.'; return null; }
  var known = {}, answers = [], ferr = {};
  fields.forEach(function (f) { known[f.field_key] = f; });
  Object.keys(vals).forEach(function (k) { if (!known[k]) ferr['values.' + k] = 'This question is not on the form.'; });
  fields.forEach(function (f) {
    var raw = vals[f.field_key], v = raw === undefined || raw === null ? '' : String(raw).trim(), bad = '';
    if (v === '') { if (f.required === 'true') ferr['values.' + f.field_key] = 'This is needed.'; return; }
    if (f.kind === 'number') { if (!/^-?\d{1,7}(\.\d{1,3})?$/.test(v)) bad = 'Type a number, e.g. 12.5.'; }
    else if (f.kind === 'date') { if (!isRealDate_(v)) bad = 'Use a real date as YYYY-MM-DD.'; }
    else if (f.kind === 'yesno') { if (v !== 'yes' && v !== 'no') bad = 'Choose yes or no.'; }
    else if (f.kind === 'choice') { if (String(f.choices || '').split('|').indexOf(v) < 0) bad = 'Not one of: ' + String(f.choices || '').split('|').join(', ') + '.'; }
    else if (v.length > BLD.LIMITS.MAX_TEXT_CHARS) bad = 'Too long (keep it under ' + BLD.LIMITS.MAX_TEXT_CHARS + ' characters).';
    else if (CONTROL_RE_.test(v)) bad = 'Please use plain text on one line.';
    else if (/^[=+\-@\t]/.test(v)) bad = 'Please do not start with = + - or @ (spreadsheets would treat it as a formula).';
    if (bad) ferr['values.' + f.field_key] = bad; else answers.push({ field: f, value: v });
  });
  if (!answers.length && !Object.keys(ferr).length) return null;
  if (req.action !== 'add' || needPending) { errors.values = 'Form answers can only be saved straight in, with a new record.'; return null; }
  for (var k in ferr) if (Object.prototype.hasOwnProperty.call(ferr, k)) errors[k] = ferr[k];
  if (!answers.length) return null;
  var read = store_read_(TABLES.check_value.file, true);
  if (!sameHeader_(read.header, TABLES.check_value.columns)) {
    throw err_('HEADER_MISMATCH', TABLES.check_value.file + ' does not have the columns the save system expects, so nothing was saved. User needs to check the file header.');
  }
  return { read: read, answers: answers };
}

function sinkPendingList_() {
  var p = loadPending_(), st = pendingState_(p.records), out = [];
  Object.keys(st).forEach(function (id) {
    var s = st[id];
    if (!s.waiting) return;
    var row = {};
    try { row = JSON.parse(s.queued.payload_json); } catch (e) { row = {}; }
    out.push({
      pending_id: id, kind: s.queued.kind, target_file: s.queued.target_file, by: s.queued.by,
      at: s.queued.at, row_id: s.queued.row_id, corrects_id: s.queued.corrects_id,
      reason: s.queued.note, row: row, state: s.last.event, last_note: s.last.note
    });
  });
  return out;
}


function applyWaitingOccupancyMoves_() {
  if (!saveEnabled_()) return { applied: 0 };
  var spec = TABLES.occupancy;
  if (!spec || !tableOn_(spec)) return { applied: 0 };
  var p;
  try { p = loadPending_(); } catch (e) { return { applied: 0 }; }
  if (!p || !p.records) return { applied: 0 };
  var st = pendingState_(p.records), n = 0, ids = [], k;
  for (k in st) if (Object.prototype.hasOwnProperty.call(st, k)) {
    var s = st[k];
    if (!s.waiting || !s.queued) continue;
    if (s.queued.kind === 'correction' || s.queued.corrects_id) continue;
    if (s.queued.target_file !== spec.file) continue;
    var row = null;
    try { row = JSON.parse(s.queued.payload_json || '{}'); } catch (e) { row = null; }
    if (!row || String(row.off_site_kind || '') || !String(row.area_id || '')) continue;
    ids.push(k);
  }
  ids.forEach(function (id) {
    try { sinkDecide_(id, 'approve', '', 'script:apply-direct-occupancy'); n++; }
    catch (e) { Logger.log('applyWaitingOccupancyMoves_ skipped ' + id + ': ' + (e.userMessage || e.message || e)); }
  });
  return { applied: n };
}

function sinkDecide_(pendingId, decision, note, adminEmail) {
  return withLock_(function () {
    var now = new Date();
    var p = loadPending_(), st = pendingState_(p.records)[pendingId];
    if (!st || !st.queued) throw err_('NOT_FOUND', 'That queued item was not found.');
    if (!st.waiting) throw err_('ALREADY_DECIDED', 'That item has already been decided (' + st.last.event + ').');
    var q = st.queued;
    note = String(note || '').trim().slice(0, BLD.LIMITS.MAX_TEXT_CHARS);

    if (decision === 'reject') {
      appendPendingEvent_({
        event_id: newId_('evt', now), pending_id: pendingId, event: 'rejected', at: londonIso_(now),
        by: adminEmail, role: 'USER', target_file: q.target_file, kind: q.kind, row_id: q.row_id,
        corrects_id: q.corrects_id, note: note, result: 'not written'
      });
      return { status: 'rejected', pending_id: pendingId };
    }
    if (decision !== 'approve') throw err_('BAD_REQUEST', 'Choose approve or reject.');

    var spec = specFor_(q.target_file);
    if (!spec) throw err_('FILE_NOT_ALLOWED', 'That file is not one the save system is allowed to change.');
    if (!saveEnabled_()) throw err_('SAVE_OFF', 'Saving is switched off, so nothing was written.');
    var fileOn = Object.keys(TABLES).some(function (key) { return TABLES[key].file === q.target_file && tableOn_(TABLES[key]); });
    if (!fileOn) throw err_('TABLE_OFF', 'Saving to ' + q.target_file + ' is switched off, so nothing was written.');
    var tenant = prop_(BLD.PROP.TENANT_ID);
    var row;
    try { row = JSON.parse(q.payload_json); } catch (e) { throw err_('BAD_PAYLOAD', 'The queued item could not be read.'); }
    if (row.tenant_id !== tenant || row.id !== q.row_id) throw err_('BAD_PAYLOAD', 'The queued item does not match this kennel.');

    var target = store_read_(spec.file, true);
    if (!sameHeader_(target.header, spec.columns)) {
      throw err_('HEADER_MISMATCH', spec.file + ' does not have the columns the save system expects, so nothing was written.');
    }
    var lookups = store_lookups_(spec, tenant), name;
    for (name in spec.input) {
      var def = spec.input[name];
      if (def.type === 'ref' && row[name]) {
        if (!lookups[def.lookup] || !lookups[def.lookup][row[name]]) {
          throw err_('INVALID', 'The ' + name + ' (' + row[name] + ') is no longer in the ' + def.lookup + ' list, so this cannot be approved. Reject it.');
        }
      }
    }
    if (q.kind === 'correction' && !target.records.some(function (r) { return r.id === q.corrects_id; })) {
      throw err_('INVALID', 'The row this corrects (' + q.corrects_id + ') is no longer in ' + spec.file + '.');
    }

    var base = { pending_id: pendingId, target_file: q.target_file, kind: q.kind, row_id: q.row_id, corrects_id: q.corrects_id };
    var alreadyThere = target.records.some(function (r) { return r.id === row.id; });
    if (!alreadyThere) {
      appendPendingEvent_(merge_(base, { event_id: newId_('evt', now), event: 'approved', at: londonIso_(now), by: adminEmail, role: 'USER', note: note }));
      try {
        store_append_(spec.file, spec.columns, rowValues_(spec.columns, row), target);
      } catch (e) {
        appendPendingEvent_(merge_(base, { event_id: newId_('evt', now), event: 'apply_failed', at: londonIso_(now), by: adminEmail, role: 'USER', note: e.userMessage || String(e),
          result: e.code === 'VERIFY_FAILED' ? (e.restored ? 'old text restored' : 'RESTORE NOT CONFIRMED') : 'not written' }));
        throw e;
      }
    }
    appendPendingEvent_(merge_(base, { event_id: newId_('evt', now), event: 'applied', at: londonIso_(now), by: adminEmail, role: 'USER', note: note, result: alreadyThere ? 'already present' : 'written' }));
    return { status: 'applied', pending_id: pendingId, id: row.id, file: spec.file };
  });
}

function merge_(a, b) {
  var o = {}, k;
  for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = a[k];
  for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) o[k] = b[k];
  return o;
}


function userEditEnabled_() { return prop_(BLD.PROP.USER_EDIT_ENABLED) === 'true'; }

function userEditDefs_(spec) {
  var d = {}, k;
  for (k in spec.input) if (Object.prototype.hasOwnProperty.call(spec.input, k)) d[k] = spec.input[k];
  if (spec.userEdit) for (k in spec.userEdit) if (Object.prototype.hasOwnProperty.call(spec.userEdit, k)) d[k] = spec.userEdit[k];
  return d;
}

function userEditSpec_(tableKey) {
  if (!userEditEnabled_()) throw err_('EDIT_OFF', 'Editing an entry in place is switched off.');
  var spec = specFor_(String(tableKey || ''));
  if (!spec || spec.file === BLD.PENDING_FILE || spec.userEditable !== true) throw err_('FILE_NOT_ALLOWED', 'That file is not one the save system is allowed to change.');
  return spec;
}

function sinkUserEditList_(tableKey) {
  var spec = userEditSpec_(tableKey), tenant = prop_(BLD.PROP.TENANT_ID);
  var t = store_read_(spec.file, true);
  if (!sameHeader_(t.header, spec.columns)) throw err_('HEADER_MISMATCH', spec.file + ' does not have the columns the save system expects.');
  var defs = userEditDefs_(spec);
  var rows = t.records.filter(function (r) { return r.tenant_id === tenant; }).slice(-60).reverse();
  return { table: spec.key, file: spec.file, editable: Object.keys(defs), rows: rows };
}

function sinkUserEdit_(tableKey, rowId, fields, adminEmail) {
  var spec = userEditSpec_(tableKey);
  return withLock_(function () {
    var now = new Date(), nowMs = now.getTime(), tenant = prop_(BLD.PROP.TENANT_ID);
    if (!tenant) throw err_('NOT_CONFIGURED', 'The tenant id has not been set up in the script (TENANT_ID).');
    if (!ID_RE_.test(String(rowId || ''))) throw err_('INVALID', 'Say which entry to edit.');
    var t = store_read_(spec.file, true);
    if (!sameHeader_(t.header, spec.columns)) {
      throw err_('HEADER_MISMATCH', spec.file + ' does not have the columns the save system expects, so nothing was changed.');
    }
    var idx = -1;
    for (var i = 0; i < t.records.length; i++) if (t.records[i].id === rowId && t.records[i].tenant_id === tenant) { idx = i; break; }
    if (idx < 0) throw err_('NOT_FOUND', 'That entry was not found in ' + spec.file + '.');
    var cur = t.records[idx], defs = userEditDefs_(spec), errors = {}, changedDefs = {}, changedVals = {}, name;
    fields = fields || {};
    for (name in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, name)) continue;
      if (!Object.prototype.hasOwnProperty.call(defs, name)) { errors[name] = 'This is not a field the user edit can change.'; continue; }
      var want = fields[name] === null || fields[name] === undefined ? '' : String(fields[name]).trim();
      if (want === String(cur[name] || '')) continue;
      changedDefs[name] = defs[name]; changedVals[name] = want;
    }
    var editLookups = store_lookups_({ lookups: spec.lookups }, tenant);
    var v = validateInput_({ input: changedDefs, checkRow: null }, changedVals, editLookups, nowMs, ageCap_(spec, tenant, nowMs, Object.prototype.hasOwnProperty.call(changedVals, (spec.ageCap || {}).field) ? changedVals : cur));
    for (name in v.errors) if (Object.prototype.hasOwnProperty.call(v.errors, name)) errors[name] = v.errors[name];
    var next = {}, c;
    for (c in cur) if (Object.prototype.hasOwnProperty.call(cur, c)) next[c] = cur[c];
    var changed = [];
    for (name in v.clean) {
      if (!Object.prototype.hasOwnProperty.call(v.clean, name) || !changedDefs[name]) continue;
      if (v.clean[name] === String(cur[name] || '')) continue;
      next[name] = v.clean[name]; changed.push(name);
    }
    if (spec.checkRow) spec.checkRow(next, errors, editLookups);
    if (Object.keys(errors).length) throw err_('INVALID', 'Some details need fixing before this can be saved.', { fields: errors });
    if (!changed.length) throw err_('NOTHING_CHANGED', 'Nothing was different from what is already there, so nothing was changed.');
    try {
      store_replaceRow_(spec.file, spec.columns, idx, rowValues_(spec.columns, next), t);
    } catch (e) { logWriteFailure_(e, spec, rowId, adminEmail, now); throw e; }
    return { status: 'edited', table: spec.key, file: spec.file, id: rowId, changed: changed };
  });
}

