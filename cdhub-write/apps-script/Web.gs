/**
 * Web entry points. Two deployments of this one project (see docs/SETUP.md):
 *   A) "Save" deployment  - runs as Lisa, open to anyone WITH THE URL; every save still needs a staff code.
 *   B) "Approve" deployment - runs as the person using it, only Lisa; shows the approvals queue.
 */

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function errorBody_(ex) {
  if (ex && ex.code) {
    var b = { ok: false, code: ex.code, message: ex.userMessage || ex.message };
    if (ex.fields) b.fields = ex.fields;
    if (ex.duplicate_of) b.duplicate_of = ex.duplicate_of;
    return b;
  }
  Logger.log('Unexpected error: ' + (ex && ex.stack ? ex.stack : ex));
  return {
    ok: false, code: 'UNEXPECTED',
    message: 'Something went wrong. It may or may not have saved, so check the list before trying again, and tell Lisa.'
  };
}

/** POST = a save request or a read request (JSON body, sent as text/plain so the browser needs no pre-flight). */
function doPost(e) {
  SAVE_TIMING_ = {};
  try {
    var body = (e && e.postData && e.postData.contents) || '';
    if (body.length > BLD.LIMITS.MAX_PHOTO_CHARS) throw err_('BAD_REQUEST', 'That request was too large.');
    // Only a dog photo or a stored file may be larger than a normal save. The bytes are base64, so the quoted action cannot appear inside them.
    var big = body.length > BLD.LIMITS.MAX_BODY_CHARS;
    if (big && body.indexOf('"dog_photo"') < 0 && body.indexOf('"file_add"') < 0) throw err_('BAD_REQUEST', 'That request was too large.');
    var req;
    try { req = JSON.parse(body); } catch (x) { throw err_('BAD_REQUEST', 'That request was not understood.'); }
    if (big && (!req || (req.action !== 'dog_photo' && req.action !== 'file_add'))) throw err_('BAD_REQUEST', 'That request was too large.');
    if (req && typeof req === 'object' && req.action === 'dog_photo') return jsonOut_({ ok: true, result: sinkDogPhoto_(req) });
    if (req && typeof req === 'object' && req.action === 'read') return jsonOut_({ ok: true, result: sinkRead_(req) });
    // dog card saves (12 Nov 2026, draft; each OFF until TABLE_ON_weighing / TABLE_ON_vaccination is true)
    if (req && typeof req === 'object' && req.action === 'weighing') return jsonOut_({ ok: true, result: sinkWeighing_(req) });
    if (req && typeof req === 'object' && req.action === 'vaccination') return jsonOut_({ ok: true, result: sinkVaccination_(req) });
    if (req && typeof req === 'object' && req.action === 'vaccination_void') return jsonOut_({ ok: true, result: sinkVaccinationVoid_(req) });
    if (req && typeof req === 'object' && req.action === 'vaccination_delete') return jsonOut_({ ok: true, result: sinkVaccinationDelete_(req) });
    if (req && typeof req === 'object' && req.action === 'dog_details') return jsonOut_({ ok: true, result: sinkDogDetails_(req) });
    if (req && typeof req === 'object' && req.action === 'subject_create') return jsonOut_({ ok: true, result: sinkSubjectCreate_(req) });
    if (req && typeof req === 'object' && req.action === 'subject_link') return jsonOut_({ ok: true, result: sinkSubjectLink_(req) });
    if (req && typeof req === 'object' && req.action === 'subject_link_end') return jsonOut_({ ok: true, result: sinkSubjectLinkEnd_(req) });
    if (req && typeof req === 'object' && req.action === 'file_add') return jsonOut_({ ok: true, result: sinkFileAdd_(req) });   // one file store (14 Nov 2026), OFF until TABLE_ON_files
    // record-to-record links (14 Nov 2026, Lisa decision C; OFF until TABLE_ON_links is true)
    if (req && typeof req === 'object' && req.action === 'link_add') return jsonOut_({ ok: true, result: sinkLinkAdd_(req) });
    if (req && typeof req === 'object' && req.action === 'link_end') return jsonOut_({ ok: true, result: sinkLinkEnd_(req) });
    // edit / archive / delete a saved row with a code, logged (Q1/Q2, 15 Nov 2026; Edit.gs). OFF until RECORD_EDIT_ON is true
    if (req && typeof req === 'object' && req.action === 'record_edit') return jsonOut_({ ok: true, result: sinkRecordEdit_(req) });
    if (req && typeof req === 'object' && req.action === 'record_archive') return jsonOut_({ ok: true, result: sinkRecordArchive_(req) });
    if (req && typeof req === 'object' && req.action === 'record_delete') return jsonOut_({ ok: true, result: sinkRecordDelete_(req) });
    // saved dated scores (15 Nov 2026, BB; OFF until TABLE_ON_score_assessment is true)
    if (req && typeof req === 'object' && req.action === 'score_save') return jsonOut_({ ok: true, result: sinkScoreSave_(req) });
    // 17 Nov 2026: the waiting-room-moves pass reads the whole approvals queue. It runs at most once a minute from saves
    // (a plain GET, the owner page and the queue itself still run it), so an ordinary save does not pay for it each time.
    var tMoves = Date.now(), movesCache = null;
    try { movesCache = CacheService.getScriptCache(); } catch (ex) { movesCache = null; }
    if (!movesCache || !movesCache.get('moves:ran')) {
      if (movesCache) { try { movesCache.put('moves:ran', '1', 60); } catch (ex) { /* only a speed-up */ } }
      try { applyWaitingOccupancyMoves_(); } catch (ex) { Logger.log('applyWaitingOccupancyMoves_: ' + (ex && ex.message)); }
      timing_('room_moves', Date.now() - tMoves);
    }
    var tSave = Date.now();
    try {
      var saved = sinkHandle_(req);
      if (saved && typeof saved === 'object') saved.timing = SAVE_TIMING_;
      return jsonOut_({ ok: true, result: saved });
    } finally { lastTiming_(tSave); }
  } catch (ex) {
    var errOut = errorBody_(ex);
    lastRefusal_(req, errOut);
    return jsonOut_(errOut);
  }
}

/**
 * GET = status check (no data) or the owner's approval page.
 * ?status=1 is the side-effect-free status (15 Nov 2026): it only reads Script Properties. It does NOT apply waiting
 * room moves, reads no file and writes nothing, and it also lists every other save switch by NAME (on/off, or set/not
 * set for a folder id). Never a property value. A plain GET keeps its old behaviour (it applies waiting room moves).
 */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.page === 'approve') return approvePage_();
  if (p.status === '1') {
    var body = statusBody_();
    body.sideEffectFree = true;
    body.switches = switchesStatus_();
    body.lastSaveTimings = lastTimings_();   // numbers only: how long the last saves' steps took (no data, no names)
    body.lastRefusals = lastRefusals_();     // why the last saves were turned down: reason, table, room, slot (no codes, no names)
    return jsonOut_(body);
  }
  try { applyWaitingOccupancyMoves_(); } catch (ex) { Logger.log('applyWaitingOccupancyMoves_: ' + (ex && ex.message)); }
  return jsonOut_(statusBody_());
}

/** Keep the timings of the last 10 saves (numbers and the table name only) in the script cache for ?status=1. */
function lastTiming_(t0) {
  try {
    if (!SAVE_TIMING_ || !SAVE_TIMING_.table) return;
    var c = CacheService.getScriptCache(), list = JSON.parse(c.get('save:timings') || '[]');
    var t = {}; for (var k in SAVE_TIMING_) if (Object.prototype.hasOwnProperty.call(SAVE_TIMING_, k)) t[k] = SAVE_TIMING_[k];
    t.total = Date.now() - t0; t.at = Utilities.formatDate(new Date(), BLD.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX").slice(11, 19);
    list.unshift(t); c.put('save:timings', JSON.stringify(list.slice(0, 10)), 21600);
  } catch (e) { /* timings are only a help */ }
}
function lastTimings_() {
  try { return JSON.parse(CacheService.getScriptCache().get('save:timings') || '[]'); } catch (e) { return []; }
}

/**
 * Lisa 17 Nov 2026: readings were turned down and nobody could see why. Keep the last 20 refusals for 24 hours in the
 * script cache for ?status=1: when, the reason code and message, which table, which room and slot, and the names of the
 * fields that need fixing. Never the staff code, the Google token, who it was, or any other field's value.
 */
function lastRefusal_(req, out) {
  try {
    if (!out || out.ok !== false) return;
    var r = (req && typeof req === 'object') ? req : {}, f = (r.fields && typeof r.fields === 'object') ? r.fields : {};
    var keep = function (v, n) { v = String(v == null ? '' : v); return /@/.test(v) ? '' : v.slice(0, n); };
    var x = {
      at: Utilities.formatDate(new Date(), BLD.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX").slice(0, 19),
      code: keep(out.code, 40), message: keep(out.message, 200),
      action: keep(r.action, 30), table: keep(r.table, 40),
      room: keep(f.area_id, 60), slot: keep(f.reading_type, 30), period: keep(f.period_start, 30)
    };
    if (out.fields && typeof out.fields === 'object') x.fix = Object.keys(out.fields).map(function (k) { return keep(k, 40) + ': ' + keep(out.fields[k], 120); });
    if (out.duplicate_of) x.duplicate_of = keep(out.duplicate_of, 60);
    var c = CacheService.getScriptCache(), list = JSON.parse(c.get('save:refusals') || '[]');
    list.unshift(x); c.put('save:refusals', JSON.stringify(list.slice(0, 20)), 86400);
  } catch (e) { /* only a help */ }
}
function lastRefusals_() {
  try { return JSON.parse(CacheService.getScriptCache().get('save:refusals') || '[]'); } catch (e) { return []; }
}

/** The status every GET has always returned: version, the two master switches, each table's switch and mode. Reads properties only. */
function statusBody_() {
  var tables = Object.keys(TABLES).map(function (k) {
    return { key: k, file: TABLES[k].file, on: tableOn_(TABLES[k]), mode: modeFor_(TABLES[k]) };
  });
  return jsonOut_({ ok: true, version: BLD.VERSION, saveEnabled: saveEnabled_(), readEnabled: readEnabled_(), tables: tables, proposed: Object.keys(PROPOSED_TABLES), timeZone: tzOn_() });   // timeZone: not secret; phones show times in it
  return { ok: true, version: BLD.VERSION, saveEnabled: saveEnabled_(), readEnabled: readEnabled_(), tables: tables, proposed: Object.keys(PROPOSED_TABLES) };
}

/**
 * Every other switch the code reads, by name. `on` for a 'true' switch; `set` (true/false) for a folder id or address,
 * whose value is never shown. Built from the specs, so a new dog card action shows up here without a change.
 */
function switchesStatus_() {
  var out = [], seen = {};
  var on = function (name) { return prop_(name) === 'true'; };
  var set = function (name) { return String(prop_(name) || '').trim() !== ''; };
  var add = function (o) { if (!seen[o.name + '|' + o.action]) { seen[o.name + '|' + o.action] = 1; out.push(o); } };
  var actions = { weighing: 'weighing', vaccination: 'vaccination, vaccination_void, vaccination_delete', dog_details: 'dog_details', subject_create: 'subject_create',
    subject_link: 'subject_link, subject_link_end', files: 'file_add' };
  Object.keys(DOGCARD_).forEach(function (k) {
    var n = BLD.PROP.TABLE_ON_PREFIX + DOGCARD_[k].on;
    add({ name: n, action: actions[k] || k, file: DOGCARD_[k].file, on: on(n) });
  });
  add({ name: BLD.PROP.TABLE_ON_PREFIX + LINKS_.on, action: 'link_add, link_end', file: LINKS_.file, on: linksOn_() });
  add({ name: BLD.PROP.TABLE_ON_PREFIX + SCORES_.on, action: 'score_save', file: SCORES_.file + ' + ' + SCORES_.lineFile, on: scoresOn_() });
  add({ name: BLD.PROP.TABLE_ON_PREFIX + CODE_REG.ON, action: 'owner page: code admin mirror', file: CODE_REG.FILE, on: codeRegisterOn_() });
  Object.keys(PROPOSED_TABLES).forEach(function (k) {
    var n = BLD.PROP.TABLE_ON_PREFIX + PROPOSED_TABLES[k].key;
    add({ name: n, action: k + ' (proposed: refused whatever this says)', file: PROPOSED_TABLES[k].file, on: on(n) });
  });
  add({ name: BLD.PROP.DOG_PHOTOS_FOLDER, action: 'dog_photo (no switch of its own: SAVE_ENABLED and this folder id)', file: SUBJECT_FILE_, set: set(BLD.PROP.DOG_PHOTOS_FOLDER) });
  add({ name: BLD.PROP.FILES_FOLDER, action: 'file_add of a photo or upload', file: '', set: set(BLD.PROP.FILES_FOLDER) });
  add({ name: BLD.PROP.OWNER_EDIT_ENABLED, action: 'owner page: edit an entry in place', file: '', on: ownerEditEnabled_() });
  add({ name: EDIT_.PROP, action: 'record_edit, record_archive, record_delete (logged)', file: EDIT_.AUDIT_FILE, on: editOn_() });
  add({ name: BLD.PROP.BACKUP_ON, action: 'nightly backup copy', file: '', on: on(BLD.PROP.BACKUP_ON) });
  add({ name: BLD.PROP.ALLOW_CREATE, action: 'adminCreateEmptyTables', file: '', on: on(BLD.PROP.ALLOW_CREATE) });
  add({ name: BLD.PROP.INSPECT_PAGE_URL, action: 'inspector links (address only)', file: '', set: set(BLD.PROP.INSPECT_PAGE_URL) });
  return out;
}

function approvePage_() {
  if (!isAdminSession_()) {
    return HtmlService.createHtmlOutput('<p style="font:16px sans-serif;padding:24px">This page is for the kennel owner. ' +
      'Open it while signed in to the owner\'s Google account.</p>');
  }
  return HtmlService.createHtmlOutputFromFile('ApprovePage').setTitle('Approvals queue');
}

function requireAdmin_() {
  if (!isAdminSession_()) throw err_('NOT_OWNER', 'Only the kennel owner can do this.');
}

/** Called from the approval page (google.script.run). */
function ui_pending() {
  try { requireAdmin_(); return { ok: true, items: sinkPendingList_() }; }
  catch (ex) { return errorBody_(ex); }
}

/** Called from the approval page. decision = 'approve' | 'reject'. */
function ui_decide(pendingId, decision, note) {
  try {
    requireAdmin_();
    return { ok: true, result: sinkDecide_(String(pendingId), String(decision), note, adminEmail_()) };
  } catch (ex) { return errorBody_(ex); }
}

/** Called from the approval page. Owner-only: who has a staff code (names, roles, ids; never a code). */
function ui_staffList() {
  try { requireAdmin_(); return { ok: true, result: { staff: sinkStaffList_() } }; }
  catch (ex) { return errorBody_(ex); }
}

/** Called from the approval page. Owner-only: switch a staff code off (kept in the list, refused from now on). */
function ui_revokeCode(codeId) {
  try { requireAdmin_(); return { ok: true, result: sinkRevokeCode_(String(codeId), adminEmail_()) }; }
  catch (ex) { return errorBody_(ex); }
}

/** Code admin (Codes.gs). Owner-only. Issue and reset return the new code ONCE, for this page to show; never logged. */
function ui_issueCode(who, role) {
  try { requireAdmin_(); return { ok: true, result: sinkIssueCode_(who, role, adminEmail_()) }; }
  catch (ex) { return errorBody_(ex); }
}
function ui_renameCode(codeId, who) {
  try { requireAdmin_(); return { ok: true, result: sinkRenameCode_(String(codeId), who, adminEmail_()) }; }
  catch (ex) { return errorBody_(ex); }
}
function ui_resetCode(codeId) {
  try { requireAdmin_(); return { ok: true, result: sinkResetCode_(String(codeId), adminEmail_()) }; }
  catch (ex) { return errorBody_(ex); }
}
function ui_codeRegisterSync() {
  try { requireAdmin_(); return { ok: true, result: sinkCodeRegisterSync_() }; }
  catch (ex) { return errorBody_(ex); }
}

/** Inspector links (Inspect.gs). Owner-only. Make returns the code ONCE for the page to show; it is never logged. */
function ui_inspectChoices() {
  try { requireAdmin_(); return { ok: true, result: sinkInspectChoices_() }; }
  catch (ex) { return errorBody_(ex); }
}
function ui_inspectMake(spec) {
  try { requireAdmin_(); return { ok: true, result: sinkInspectMake_(spec, adminEmail_()) }; }
  catch (ex) { return errorBody_(ex); }
}
function ui_inspectLinks() {
  try { requireAdmin_(); return { ok: true, result: { links: sinkInspectLinks_() } }; }
  catch (ex) { return errorBody_(ex); }
}
function ui_inspectStop(linkId, reason) {
  try { requireAdmin_(); return { ok: true, result: sinkInspectStop_(String(linkId), adminEmail_(), reason) }; }
  catch (ex) { return errorBody_(ex); }
}

/** Called from the approval page. Owner-only: lists the newest entries of one table so one can be picked. */
function ui_editList(table) {
  try { requireAdmin_(); return { ok: true, result: sinkOwnerEditList_(String(table)) }; }
  catch (ex) { return errorBody_(ex); }
}

/**
 * Called from the approval page. Owner-only (a signed-in Google account in ADMIN_EMAILS, never a staff code).
 * Overwrites the entry in place. No record of the old value is kept by this script.
 */
function ui_edit(table, rowId, fields) {
  try {
    requireAdmin_();
    return { ok: true, result: sinkOwnerEdit_(String(table), String(rowId), fields, adminEmail_()) };
  } catch (ex) { return errorBody_(ex); }
}
