/**
 * The save logic. Order of checks (cheapest and least revealing first):
 *   switch on? -> request shape -> who are you? -> which table? (allow-list) -> table switched on?
 *   -> may your role do this? -> repeat request? -> lock -> file + header -> lookups -> field checks
 *   -> duplicate guard -> route: appended now (direct) or queued for Lisa (pending).
 * Corrections are ALWAYS queued, never written straight in.
 */

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(BLD.LIMITS.LOCK_WAIT_MS); }
  catch (e) { throw err_('BUSY', 'Someone else is saving right now. Wait a moment and press save again.'); }
  try { return fn(); } finally { lock.releaseLock(); }
}

function tableOn_(spec) { return prop_(BLD.PROP.TABLE_ON_PREFIX + spec.key) === 'true'; }
/** A YYYY-MM-DD date plus n whole days (calendar arithmetic, so a clock change cannot shift it). */
function addDays_(ymd, n) {
  var p = ymd.split('-'), t = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
  return t.getUTCFullYear() + '-' + ('0' + (t.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + t.getUTCDate()).slice(-2);
}

function todayLondon_(d) { return Utilities.formatDate(d || new Date(), BLD.TZ, 'yyyy-MM-dd'); }

/**
 * Where does a new row go? Order: an explicit MODE_<key> wins. Otherwise, for dog moves (spec.movesQueue) the date
 * decides: up to and including MOVES_QUEUE_UNTIL (London) a move goes to the approvals queue, after it straight in.
 * A missing or unreadable date means "queue" (the safe side). Everything else uses the table's own default.
 */
function modeFor_(spec, now) {
  var m = prop_(BLD.PROP.MODE_PREFIX + spec.key);
  if (m === 'direct' || m === 'pending') return m;
  if (spec.movesQueue) {
    var until = prop_(BLD.PROP.MOVES_QUEUE_UNTIL);
    if (!isRealDate_(until)) return 'pending';
    return todayLondon_(now) > until ? 'direct' : 'pending';
  }
  return spec.defaultMode === 'direct' ? 'direct' : 'pending';   // nothing set = the table's own default
}
function saveEnabled_() { return prop_(BLD.PROP.SAVE_ENABLED) === 'true'; }

/** State of every pending item, folded from the append-only event log. */
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

/** If the read-back check failed, record it in the approvals queue (append-only) so Lisa can see it. */
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

function findDuplicate_(spec, clean, rows, nowMs, today) {
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i], same = true;
    for (var k = 0; k < spec.dupKey.length; k++) {
      if ((r[spec.dupKey[k]] || '') !== (clean[spec.dupKey[k]] || '')) { same = false; break; }
    }
    if (!same) continue;
    if (spec.dupDayCol) { if ((r[spec.dupDayCol] || '') === today) return r; continue; }   // same calendar day (London)
    if (!spec.dupTimeCol) return r;
    var t = Date.parse(r[spec.dupTimeCol]);
    if (!isNaN(t) && Math.abs(nowMs - t) < BLD.LIMITS.DUP_WINDOW_MIN * 60000) return r;
  }
  return null;
}

/**
 * Readings (Lisa 11 Nov 2026): no 7-day limit for any role. A table with ageCap takes a period_start back as far as
 * its section's records are kept. Returns { oldestMs, keepYears, field } for those tables, else null (the 7-day rule).
 */
function ageCap_(spec, tenant, nowMs) {
  var cap = spec.ageCap;
  if (!cap) return null;
  var years = retentionYears_(cap.retentionSection, tenant), oldest = new Date(nowMs);
  oldest.setUTCFullYear(oldest.getUTCFullYear() - years);   // the same date and time, that many years ago
  return { oldestMs: oldest.getTime(), keepYears: years, field: cap.field };
}

/** Years a section's records are kept: its BLD-retention_setting row (the last one), else the Config.gs default. */
function retentionYears_(section, tenant) {
  var r = store_read_(BLD.RETENTION_FILE, false), years = 0;
  if (r) r.records.forEach(function (x) {
    if ((!x.tenant_id || x.tenant_id === tenant) && String(x.section || '').trim() === section && /^\d{1,2}$/.test(String(x.keep_years || '').trim()) && parseInt(x.keep_years, 10) > 0) years = parseInt(x.keep_years, 10);
  });
  return years || BLD.LIMITS.RETENTION_DEFAULT_YEARS;
}

/** A reading typed in more than 7 days late may never fill a slot already filled: the same room, thermometer (blank = none named) and period_start at any time is a repeat. */
function sameSlot_(late, clean, rows, nowMs) {
  if (!clean[late.field] || Date.parse(clean[late.field]) >= nowMs - BLD.LIMITS.PERIOD_MAX_AGE_HOURS * 3600000) return null;
  for (var i = 0; i < rows.length; i++) if (rows[i].area_id === clean.area_id && (rows[i].thermometer_id || '') === (clean.thermometer_id || '') && rows[i][late.field] === clean[late.field]) return rows[i];
  return null;
}

/** Main entry for a save. Returns a result object or throws err_. */
function sinkHandle_(req) {
  var now = new Date(), nowMs = now.getTime();

  if (!saveEnabled_()) throw err_('SAVE_OFF', 'Saving is switched off.');
  if (!req || typeof req !== 'object') throw err_('BAD_REQUEST', 'That request was not understood.');
  if (req.action !== 'add' && req.action !== 'correct' && req.action !== 'add_site') throw err_('BAD_REQUEST', 'Unknown action.');
  var rid = String(req.request_id || '');
  if (!/^[A-Za-z0-9_\-]{8,64}$/.test(rid)) throw err_('BAD_REQUEST', 'The request had no valid reference.');

  var who = authStaff_(req.code);

  var asked = String(req.table || req.file || '');
  var spec = specFor_(asked);
  if (!spec || (req.table && req.file && specFor_(String(req.file)) !== spec)) {
    throw err_('FILE_NOT_ALLOWED', 'That file is not one the save system is allowed to change.');
  }
  if (!tableOn_(spec)) throw err_('TABLE_OFF', 'Saving to ' + spec.file + ' is switched off.');
  if (req.action === 'correct' && spec.noCorrect) {
    throw err_('CORRECT_NOT_SUPPORTED', 'This list has no way to point at an earlier row. Fix a wrong room by moving the dog again.');
  }
  if (req.action === 'add_site' && spec.key !== 'check_log') throw err_('BAD_REQUEST', 'A whole-site tap only applies to staff checks.');
  if (spec.perms[req.action === 'add_site' ? 'add' : req.action].indexOf(who.role) < 0) throw err_('NOT_ALLOWED', 'Your role is not allowed to do this. Ask Lisa.');

  var cache = CacheService.getScriptCache();
  var cached = cache.get('rid:' + rid);
  if (cached) { var again = JSON.parse(cached); again.repeat = true; return again; }

  var result = withLock_(function () { return req.action === 'add_site' ? sinkSiteProcess_(spec, req, who, now, nowMs) : sinkProcess_(spec, req, who, now, nowMs); });
  cache.put('rid:' + rid, JSON.stringify(result), BLD.LIMITS.REQUEST_CACHE_SEC);
  return result;
}

/**
 * One whole-site tap on a staff check. A job about a place (bowls) stays one line. A job about dogs (site_scope per_dog)
 * writes one line per dog named in fields.dog_ids, in one append: all of them or none. A dog is left out, and counted in
 * the answer, if it is in a room the check's not_in_areas lists, has no known room (so it cannot be shown not to be in
 * isolation), is off site, or already has this check inside the repeat-tap window.
 * A room job about dogs (target area, site_scope per_dog) works the same way for the dogs ticked in that room; a dog
 * whose latest room is another room is left out, so a tap can only cover dogs the records place there.
 */
function sinkSiteProcess_(spec, req, who, now, nowMs) {
  var tenant = prop_(BLD.PROP.TENANT_ID);
  if (!tenant) throw err_('NOT_CONFIGURED', 'The tenant id has not been set up in the script (TENANT_ID).');
  var f = req.fields && typeof req.fields === 'object' ? req.fields : {};
  var typeRead = store_read_(TABLES.check_type.file, true);
  var type = typeRead.records.filter(function (r) { return r.id === String(f.check_type_id || '') && r.tenant_id === tenant; })[0];
  if (!type) throw err_('INVALID', 'Some details need fixing before this can be saved.', { fields: { check_type_id: 'That check was not found.' } });
  var room = type.target === 'area' && type.site_scope === 'per_dog';
  if (type.target !== 'none' && !room) throw err_('INVALID', 'Some details need fixing before this can be saved.', { fields: { check_type_id: 'That check is not a whole-site check.' } });
  if (room && !f.area_id) throw err_('INVALID', 'Some details need fixing before this can be saved.', { fields: { area_id: 'Say which room.' } });

  var fields = { check_type_id: f.check_type_id, item: f.item, amount: f.amount, outcome: f.outcome, note: f.note, happened_at: f.happened_at, photo: f.photo, how_recorded: room ? f.how_recorded : 'site_tap' };
  if (room) fields.area_id = f.area_id;
  if (type.site_scope !== 'per_dog') { req.fields = fields; req.action = 'add'; return sinkProcess_(spec, req, who, now, nowMs); }

  var target = store_read_(spec.file, true);
  if (!sameHeader_(target.header, spec.columns)) {
    throw err_('HEADER_MISMATCH', spec.file + ' does not have the columns the save system expects, so nothing was saved. Lisa needs to check the file header.');
  }
  var lookups = store_lookups_(spec, tenant);
  var v = validateInput_(spec, fields, lookups, nowMs);
  var dogs = validateInput_({ input: { dog_ids: { type: 'idlist', lookup: 'subject', required: true } } }, { dog_ids: f.dog_ids }, lookups, nowMs);
  var errors = v.errors;
  if (dogs.errors.dog_ids) errors.dog_ids = dogs.errors.dog_ids;
  if (Object.keys(errors).length) throw err_('INVALID', 'Some details need fixing before this can be saved.', { fields: errors });

  var never = {};
  String(type.not_in_areas || '').split('|').forEach(function (a) { a = a.trim(); if (a) never[a] = true; });
  var occ = store_read_(TABLES.occupancy.file, true).records.filter(function (r) { return r.tenant_id === tenant; });
  var today = Utilities.formatDate(now, BLD.TZ, 'yyyy-MM-dd');
  var ids = {}, rows = [], made = [], left = { isolation: 0, no_room: 0, off_site: 0, repeat: 0 };
  target.records.forEach(function (r) { ids[r.id] = true; });
  dogs.clean.dog_ids.split('|').forEach(function (dog) {
    var at = occupancyLatest_(occ, dog);
    if (at && (String(at.off_site_kind || '') !== '' || permanentlyGone_(at))) { left.off_site++; return; }
    if (!at || !at.area_id) { left.no_room++; return; }
    if (room && at.area_id !== v.clean.area_id) { left.no_room++; return; }
    if (never[at.area_id]) { left.isolation++; return; }
    var clean = {}; for (var k in v.clean) if (Object.prototype.hasOwnProperty.call(v.clean, k)) clean[k] = v.clean[k];
    clean.subject_id = dog;
    if (findDuplicate_(spec, clean, target.records, nowMs, today)) { left.repeat++; return; }
    var rowId = newId_(spec.idPrefix, now);
    while (ids[rowId]) rowId = newId_(spec.idPrefix, now);
    ids[rowId] = true;
    var row = buildRow_(spec, clean, { rowId: rowId, tenantId: tenant, nowIso: londonIso_(now), today: today, who: who.who, whoId: who.id || '', correctsId: '' });
    made.push(row); rows.push(rowValues_(spec.columns, row));
  });
  if (!rows.length) {
    if (left.repeat) throw err_('DUPLICATE', 'This looks like the same entry as one already saved. If that one is wrong, tell the owner.', { duplicate_of: '' });
    throw err_('INVALID', room ? 'None of those dogs are shown in this room.' : 'None of those dogs can be covered by a whole-site tap.', { fields: { dog_ids: 'Record these dogs one at a time.' } });
  }
  try { store_appendMany_(spec.file, spec.columns, rows, target); }
  catch (e) { logWriteFailure_(e, spec, made[0].id, who.who, now); throw e; }
  return { status: 'saved', table: spec.key, file: spec.file, id: made[0].id, ids: made.map(function (r) { return r.id; }), saved: made.length, left_out: left, at: made[0].taken_at };
}

function sinkProcess_(spec, req, who, now, nowMs) {
  var tenant = prop_(BLD.PROP.TENANT_ID);
  if (!tenant) throw err_('NOT_CONFIGURED', 'The tenant id has not been set up in the script (TENANT_ID).');

  var target = store_read_(spec.file, true);
  if (!sameHeader_(target.header, spec.columns)) {
    throw err_('HEADER_MISMATCH', spec.file + ' does not have the columns the save system expects, so nothing was saved. Lisa needs to check the file header.');
  }
  var lookups = store_lookups_(spec, tenant);
  var late = ageCap_(spec, tenant, nowMs);
  var v = validateInput_(spec, req.fields, lookups, nowMs, late);
  var errors = v.errors;
  var today = Utilities.formatDate(now, BLD.TZ, 'yyyy-MM-dd');

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

  if (Object.keys(errors).length) {
    throw err_('INVALID', 'Some details need fixing before this can be saved.', { fields: errors });
  }

  if (req.action === 'add') {
    var dup = findDuplicate_(spec, v.clean, target.records.concat(waiting), nowMs, today) || (late ? sameSlot_(late, v.clean, target.records.concat(waiting), nowMs) : null);
    if (dup) {
      throw err_('DUPLICATE', 'This looks like the same entry as one already saved' + (dup.id ? ' (' + dup.id + ')' : '') +
        '. If that one is wrong, tell the owner.', { duplicate_of: dup.id || '' });
    }
  }

  var ids = {};
  target.records.forEach(function (r) { ids[r.id] = true; });
  var rowId = newId_(spec.idPrefix, now);
  while (ids[rowId]) rowId = newId_(spec.idPrefix, now);

  var row = buildRow_(spec, v.clean, {
    rowId: rowId, tenantId: tenant, nowIso: londonIso_(now), today: today, who: who.who, whoId: who.id || '', correctsId: correctsId
  });

  if (!needPending) {
    try {
      store_append_(spec.file, spec.columns, rowValues_(spec.columns, row), target);
    } catch (e) { logWriteFailure_(e, spec, rowId, who.who, now); throw e; }
    return { status: 'saved', table: spec.key, file: spec.file, id: rowId, at: row.taken_at || row.confirmed_at || row.moved_in || '' };
  }

  var pid = newId_('pnd', now);
  appendPendingEvent_({
    event_id: newId_('evt', now), pending_id: pid, event: 'queued', at: londonIso_(now),
    by: who.who, role: who.role, target_file: spec.file,
    kind: req.action === 'correct' ? 'correction' : 'new',
    row_id: rowId, corrects_id: correctsId, note: reason, payload_json: JSON.stringify(row), result: ''
  });
  return { status: 'queued', table: spec.key, file: spec.file, id: rowId, pending_id: pid };
}

/** Queued items, newest last, for the approval page. */
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

/** Approve or reject one queued item. Approval writes the row to the real table. */
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
        by: adminEmail, role: 'OWNER', target_file: q.target_file, kind: q.kind, row_id: q.row_id,
        corrects_id: q.corrects_id, note: note, result: 'not written'
      });
      return { status: 'rejected', pending_id: pendingId };
    }
    if (decision !== 'approve') throw err_('BAD_REQUEST', 'Choose approve or reject.');

    var spec = specFor_(q.target_file);
    if (!spec) throw err_('FILE_NOT_ALLOWED', 'That file is not one the save system is allowed to change.');
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
      appendPendingEvent_(merge_(base, { event_id: newId_('evt', now), event: 'approved', at: londonIso_(now), by: adminEmail, role: 'OWNER', note: note }));
      try {
        store_append_(spec.file, spec.columns, rowValues_(spec.columns, row), target);
      } catch (e) {
        appendPendingEvent_(merge_(base, { event_id: newId_('evt', now), event: 'apply_failed', at: londonIso_(now), by: adminEmail, role: 'OWNER', note: e.userMessage || String(e),
          result: e.code === 'VERIFY_FAILED' ? (e.restored ? 'old text restored' : 'RESTORE NOT CONFIRMED') : 'not written' }));
        throw e;
      }
    }
    appendPendingEvent_(merge_(base, { event_id: newId_('evt', now), event: 'applied', at: londonIso_(now), by: adminEmail, role: 'OWNER', note: note, result: alreadyThere ? 'already present' : 'written' }));
    return { status: 'applied', pending_id: pendingId, id: row.id, file: spec.file };
  });
}

function merge_(a, b) {
  var o = {}, k;
  for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) o[k] = a[k];
  for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) o[k] = b[k];
  return o;
}

/* ------------------------------------------------------------------------------------------------
 * OWNER EDIT. Lisa only, from the owner-only approval page (her own signed-in Google account).
 * It overwrites a wrong entry IN PLACE. No copy of the old value and no log of the change is kept by
 * this script (Drive's own file history is the only trace, and the optional daily backup if it is on).
 * Staff can NEVER edit or delete: a staff code has no way to reach this, sinkHandle_ only knows add and
 * correct. Everything else about the write is as careful as an append: the lock, an exact header,
 * the whole-file hash check before writing, a read-back by hash, exact restore on failure.
 * ---------------------------------------------------------------------------------------------- */

function ownerEditEnabled_() { return prop_(BLD.PROP.OWNER_EDIT_ENABLED) === 'true'; }

function ownerEditDefs_(spec) {
  var d = {}, k;
  for (k in spec.input) if (Object.prototype.hasOwnProperty.call(spec.input, k)) d[k] = spec.input[k];
  if (spec.ownerEdit) for (k in spec.ownerEdit) if (Object.prototype.hasOwnProperty.call(spec.ownerEdit, k)) d[k] = spec.ownerEdit[k];
  return d;
}

function ownerEditSpec_(tableKey) {
  if (!ownerEditEnabled_()) throw err_('EDIT_OFF', 'Editing an entry in place is switched off.');
  var spec = specFor_(String(tableKey || ''));
  // only the lists the owner edit is built for: never the approvals queue, the daily check log or anything else
  if (!spec || spec.file === BLD.PENDING_FILE || spec.ownerEditable !== true) throw err_('FILE_NOT_ALLOWED', 'That file is not one the save system is allowed to change.');
  return spec;
}

/** The newest entries of one table, for the owner to pick from. */
function sinkOwnerEditList_(tableKey) {
  var spec = ownerEditSpec_(tableKey), tenant = prop_(BLD.PROP.TENANT_ID);
  var t = store_read_(spec.file, true);
  if (!sameHeader_(t.header, spec.columns)) throw err_('HEADER_MISMATCH', spec.file + ' does not have the columns the save system expects.');
  var defs = ownerEditDefs_(spec);
  var rows = t.records.filter(function (r) { return r.tenant_id === tenant; }).slice(-60).reverse();
  return { table: spec.key, file: spec.file, editable: Object.keys(defs), rows: rows };
}

/**
 * Replace the editable fields of ONE row. `fields` holds the values wanted; a field equal to what is already
 * there is left alone (and not re-checked), so an old row can be fixed without tripping "more than 7 days ago".
 */
function sinkOwnerEdit_(tableKey, rowId, fields, adminEmail) {
  var spec = ownerEditSpec_(tableKey);
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
    var cur = t.records[idx], defs = ownerEditDefs_(spec), errors = {}, changedDefs = {}, changedVals = {}, name;
    fields = fields || {};
    for (name in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, name)) continue;
      if (!Object.prototype.hasOwnProperty.call(defs, name)) { errors[name] = 'This is not a field the owner edit can change.'; continue; }
      var want = fields[name] === null || fields[name] === undefined ? '' : String(fields[name]).trim();
      if (want === String(cur[name] || '')) continue;
      changedDefs[name] = defs[name]; changedVals[name] = want;
    }
    var editLookups = store_lookups_({ lookups: spec.lookups }, tenant);
    var v = validateInput_({ input: changedDefs, checkRow: null }, changedVals, editLookups, nowMs, ageCap_(spec, tenant, nowMs));
    for (name in v.errors) if (Object.prototype.hasOwnProperty.call(v.errors, name)) errors[name] = v.errors[name];
    var next = {}, c;
    for (c in cur) if (Object.prototype.hasOwnProperty.call(cur, c)) next[c] = cur[c];
    var changed = [];
    for (name in v.clean) {
      if (!Object.prototype.hasOwnProperty.call(v.clean, name) || !changedDefs[name]) continue;
      if (v.clean[name] === String(cur[name] || '')) continue;       // "22" typed over "22.00" is not a change
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
