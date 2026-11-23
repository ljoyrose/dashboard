/**
 * Owner-only tools. Run these by hand from the Apps Script editor (Run button).
 * They are NOT reachable from the web: doPost/doGet never call them.
 * Output appears in the "Execution log" at the bottom of the editor.
 */

/** 1. Run once. Makes the secret salt for staff codes. Safe to run again (does nothing if set). */
function adminSetup() {
  if (!prop_(BLD.PROP.SALT)) {
    setProp_(BLD.PROP.SALT, Utilities.getUuid() + Utilities.getUuid());
    Logger.log('Created the code salt.');
  } else {
    Logger.log('Code salt already exists. Nothing changed.');
  }
  Logger.log('Now set these Script Properties (Project Settings > Script Properties): BLD_FOLDER_ID, TENANT_ID, ADMIN_EMAILS.');
  Logger.log('Saving stays OFF until you set SAVE_ENABLED to true.');
}

/** 2. Edit NAME and ROLE, then Run. Prints a new staff code ONCE. Give it to that person; it cannot be shown again. */
function adminAddStaffCode() {
  var NAME = 'Example Name';      // <- change this
  var ROLE = 'STAFF';             // <- OWNER, STAFF, VET or TRAINER (see BLD-role.csv)
  if (ROLE_ALL.indexOf(ROLE) < 0) throw new Error('ROLE must be one of ' + ROLE_ALL.join(', '));
  var salt = prop_(BLD.PROP.SALT);
  if (!salt) throw new Error('Run adminSetup first.');
  var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', raw = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), code = '';
  for (var i = 0; i < 10; i++) code += alphabet.charAt(parseInt(raw.substr(i * 2, 2), 16) % alphabet.length);
  var reg = registry_();
  reg[hashCode_(code, salt)] = { id: newCodeId_(), who: NAME, role: ROLE, active: true, added: londonIso_(new Date()) };
  setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));
  Logger.log('Staff code for ' + NAME + ' (' + ROLE + '): ' + code + '   (public id ' + reg[hashCode_(code, salt)].id + ' - use it in person:' + reg[hashCode_(code, salt)].id + ' permission rows)');
  Logger.log('Write it down for them now. It is stored only as a one-way hash, so it cannot be shown again.');
  return code;
}

/** 3. Lists who has a code (names and roles only, never the codes). */
function adminListStaff() {
  var reg = registry_(), n = 0;
  Object.keys(reg).forEach(function (h) {
    n++;
    Logger.log(reg[h].who + ' - ' + reg[h].role + ' - id ' + (reg[h].id || '(none: run adminAssignCodeIds)') + ' - ' + ((reg[h].active === false || reg[h].revoked_at) ? 'SWITCHED OFF' : 'active'));
  });
  if (!n) Logger.log('No staff codes yet.');
}

/** 4. Edit NAME, then Run. Switches that person\'s code off (kept in the list, but refused). */
function adminRevokeStaff() {
  var NAME = 'Example Name';      // <- change this
  var reg = registry_(), hit = 0;
  Object.keys(reg).forEach(function (h) { if (reg[h].who === NAME && !reg[h].revoked_at) { reg[h].active = false; reg[h].revoked_at = londonIso_(new Date()); reg[h].revoked_by = 'script editor'; hit++; } });
  setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));
  Logger.log(hit ? ('Switched off ' + hit + ' code(s) for ' + NAME + '.') : ('No one called ' + NAME + ' found.'));
}

/** 4b. Run once on a project that had codes BEFORE ids existed: gives each code without one a public id (sc-xxxxxx). Changes nothing else. */
function adminAssignCodeIds() {
  var reg = registry_(), n = 0;
  Object.keys(reg).forEach(function (h) { if (!reg[h].id && !reg[h].was_id) { reg[h].id = newCodeId_(); n++; } });   // was_id: an old code replaced by a new one (Codes.gs) keeps no id
  setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));
  Logger.log(n ? ('Gave ' + n + ' code(s) a public id. Run adminListStaff to see them.') : 'Every code already has an id. Nothing changed.');
}

/**
 * 4c. Run on go-live day: dog moves go to the approvals queue for 14 days counting today, then straight in.
 * It only sets the Script Property MOVES_QUEUE_UNTIL (a date). Run it again on a new day to start a new 14 days.
 */
function adminStartMovesQueue() {
  setProp_(BLD.PROP.MOVES_QUEUE_UNTIL, addDays_(todayLondon_(), BLD.LIMITS.MOVES_QUEUE_DAYS - 1));   // 14 days counting today
  Logger.log('Occupancy moves go straight in. MOVES_QUEUE_UNTIL was set to ' + prop_(BLD.PROP.MOVES_QUEUE_UNTIL) + ' but is ignored for moves.');
}

/**
 * 5. Creates EMPTY, header-only files - ONLY the ones listed, ONLY if they do not exist, and ONLY while
 * the Script Property ALLOW_CREATE is 'true'. This is Lisa's decision (2): creating the temperature log
 * and the approvals queue on Drive. Set ALLOW_CREATE back to anything else afterwards.
 */
function adminCreateEmptyTables() {
  var TO_CREATE = [BLD.PENDING_FILE, 'BLD-area_reading.csv', 'BLD-occupancy_check.csv'];   // <- trim or extend, then Run
  if (prop_(BLD.PROP.ALLOW_CREATE) !== 'true') {
    Logger.log('Refused: set the Script Property ALLOW_CREATE to true first (and set it back afterwards).');
    return;
  }
  TO_CREATE.forEach(function (title) {
    var header = title === BLD.PENDING_FILE ? BLD.PENDING_COLUMNS : ((specFor_(title) || {}).columns || inspectHeader_(title) || codeRegisterHeader_(title));
    if (!header) { Logger.log('Skipped ' + title + ': not on the allow-list.'); return; }
    try { store_createEmpty_(title, header); Logger.log('Created ' + title + ' (header only).'); }
    catch (e) { Logger.log('Not created ' + title + ': ' + (e.userMessage || e)); }
  });
}

/** 6. Plain-English health check. Changes nothing. */
/** Columns the dog card, files and links saves need in a file (they check by name, not exact order), or null. */
function saveNeedFor_(title) {
  var out = null;
  var specs = [];
  if (typeof DOGCARD_ !== 'undefined') Object.keys(DOGCARD_).forEach(function (k) { specs.push(DOGCARD_[k]); });
  if (typeof LINKS_ !== 'undefined') specs.push(LINKS_);
  specs.forEach(function (sp) {
    if (!sp || sp.file !== title || !sp.need) return;
    out = out || [];
    sp.need.forEach(function (c) { if (out.indexOf(c) < 0) out.push(c); });
  });
  return out;
}

function adminCheckSetup() {
  var ok = true;
  function say(good, msg) { if (!good) ok = false; Logger.log((good ? 'OK   ' : 'FIX  ') + msg); }
  say(!!prop_(BLD.PROP.SALT), 'code salt (run adminSetup if not OK)');
  say(Object.keys(registry_()).length > 0, 'at least one staff code (run adminAddStaffCode)');
  say(!!prop_(BLD.PROP.TENANT_ID), 'TENANT_ID is set');
  say(!!prop_(BLD.PROP.ADMIN_EMAILS), 'ADMIN_EMAILS is set');
  try { store_folder_(); say(true, 'BLD folder can be opened'); } catch (e) { say(false, e.userMessage || String(e)); return; }
  allowedFiles_().forEach(function (title) {
    try {
      var r = store_read_(title, false);
      if (!r) { Logger.log('--   ' + title + ' does not exist yet (fine until you switch that table on)'); return; }
      var spec = specFor_(title), need = spec ? null : saveNeedFor_(title);
      if (need) { // dog card, files and links saves only need their columns present, in any order, so check the same way
        var miss = need.filter(function (c) { return r.header.indexOf(c) < 0; });
        say(!miss.length, title + ' exists with ' + r.records.length + ' row(s); ' + (miss.length ? 'header has no ' + miss.join(', ') : 'header has every column the save needs'));
        return;
      }
      var want = spec ? spec.columns : (inspectHeader_(title) || codeRegisterHeader_(title) || BLD.PENDING_COLUMNS);
      say(sameHeader_(r.header, want), title + ' exists with ' + r.records.length + ' row(s); header ' + (sameHeader_(r.header, want) ? 'matches' : 'DOES NOT MATCH'));
    } catch (e) { say(false, title + ': ' + (e.userMessage || e)); }
  });
  Object.keys(TABLES).forEach(function (k) {
    Logger.log('--   table ' + k + ': ' + (tableOn_(TABLES[k]) ? 'ON' : 'off') + ', mode ' + modeFor_(TABLES[k]));
  });
  Logger.log('--   dog moves: straight in (MOVES_QUEUE_UNTIL is ignored for occupancy)');
  var noId = Object.keys(registry_()).filter(function (h) { return !registry_()[h].id && !registry_()[h].was_id; }).length;
  if (noId) Logger.log('FIX  ' + noId + ' staff code(s) have no public id yet (run adminAssignCodeIds)');
  Logger.log('--   SAVE_ENABLED is ' + (saveEnabled_() ? 'TRUE (saving is ON)' : 'not true (saving is OFF)'));
  Logger.log('--   dog photos: ' + (prop_(BLD.PROP.DOG_PHOTOS_FOLDER) ? 'folder id is set in Script Properties' : 'not set (create a Shared Drive folder and set DOG_PHOTOS_FOLDER_ID)'));
  Logger.log('--   OWNER_EDIT_ENABLED is ' + (ownerEditEnabled_() ? 'TRUE (the owner page can overwrite an entry in place; no record of the old value is kept)' : 'not true (owner edit is OFF)'));
  Logger.log('--   READ_ENABLED is ' + (readEnabled_() ? 'TRUE (staff codes can read what the permissions file allows)' : 'not true (staff cannot read)'));
  try {
    var pv = store_read_(BLD.VISIBILITY_FILE, false);
    Logger.log(pv ? ('OK   ' + BLD.VISIBILITY_FILE + ' found (' + pv.records.length + ' rows). The script only reads it.') : ('--   ' + BLD.VISIBILITY_FILE + ' not found: reading will refuse everything'));
  } catch (e) { say(false, BLD.VISIBILITY_FILE + ': ' + (e.userMessage || e)); }
  Logger.log(ok ? 'Everything checked is fine.' : 'Some things need fixing (lines starting FIX).');
}

/* ------------------------------------------------------------------------------------------------
 * OPTIONAL daily backup copy. Off unless Lisa turns it on. It never deletes anything.
 * Copies each existing allow-listed file into a sub-folder BLD-backups, once a day, named
 * <file>.pre-daily-<YYYY-MM-DD>.bak (the pattern in the naming protocol, N-14). The copies are .bak
 * files in a sub-folder, so CD Hub (which reads .csv files in the main folder) never loads them.
 * After each run, older <file>.pre-daily-<date>.bak copies go to Drive TRASH (setTrashed, never deleted for ever):
 * the newest copy of each file is kept. Only that exact pattern is touched; BACKUP_*, BAK_*, *.pre-cdhub-core-* and
 * anything else in BLD-backups are left alone (Lisa, 15 Nov 2026, card answer A).
 * ---------------------------------------------------------------------------------------------- */

var BACKUP_FOLDER_NAME = 'BLD-backups';

/** The daily job. Does nothing unless the Script Property BACKUP_ON is 'true'. */
function adminDailyBackup() {
  if (prop_(BLD.PROP.BACKUP_ON) !== 'true') { Logger.log('Backup is off (BACKUP_ON is not true). Nothing copied.'); return; }
  var folder = store_folder_();
  var it = folder.getFoldersByName(BACKUP_FOLDER_NAME);
  var dest = it.hasNext() ? it.next() : folder.createFolder(BACKUP_FOLDER_NAME);
  var day = Utilities.formatDate(new Date(), BLD.TZ, 'yyyy-MM-dd');
  allowedFiles_().forEach(function (title) {
    var file = store_findOne_(title);
    if (!file) return;
    var name = title + '.pre-daily-' + day + '.bak';
    if (dest.getFilesByName(name).hasNext()) { Logger.log('Already copied today: ' + name); return; }
    file.makeCopy(name, dest);
    Logger.log('Copied ' + title + ' to ' + BACKUP_FOLDER_NAME + '/' + name);
  });
  backupTrashOld_(dest);
}

var PRE_DAILY_RE = /^(.+)\.pre-daily-(\d{4}-\d{2}-\d{2})\.bak$/;

/**
 * Moves older daily copies to Drive TRASH, keeping the newest copy of each live file. Exact pattern only.
 * Returns { trashed: [names], kept: [names] }. A file whose copy could not be trashed is logged and kept.
 */
function backupTrashOld_(dest) {
  var newest = {}, all = [], it = dest.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.isTrashed && f.isTrashed()) continue;
    var m = PRE_DAILY_RE.exec(f.getName());
    if (!m) continue;
    all.push({ file: f, name: f.getName(), base: m[1], day: m[2] });
    if (!newest[m[1]] || m[2] > newest[m[1]]) newest[m[1]] = m[2];
  }
  var out = { trashed: [], kept: [] };
  all.forEach(function (c) {
    if (c.day === newest[c.base]) { out.kept.push(c.name); return; }
    try { c.file.setTrashed(true); out.trashed.push(c.name); }
    catch (e) { out.kept.push(c.name); Logger.log('Could not move to trash (kept): ' + c.name); }
  });
  out.trashed.sort(); out.kept.sort();
  Logger.log('Older daily copies moved to trash: ' + out.trashed.length + '. Kept: ' + out.kept.length + ' (' + out.kept.join(', ') + ').');
  return out;
}

/** Run once by hand: the same tidy as after each nightly run, without copying anything. */
function adminTrashOldDailyBackups() {
  var it = store_folder_().getFoldersByName(BACKUP_FOLDER_NAME);
  if (!it.hasNext()) { Logger.log('No ' + BACKUP_FOLDER_NAME + ' folder. Nothing to tidy.'); return { trashed: [], kept: [] }; }
  return backupTrashOld_(it.next());
}

/** Run once to have the backup run every night about 03:00. Also set BACKUP_ON to true. */
function adminInstallDailyBackup() {
  var existing = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'adminDailyBackup'; });
  if (existing.length) { Logger.log('The daily backup is already scheduled. Nothing changed.'); return; }
  ScriptApp.newTrigger('adminDailyBackup').timeBased().everyDays(1).atHour(3).create();
  Logger.log('Daily backup scheduled for about 03:00. It only copies while BACKUP_ON is true.');
}

/** Run to stop the nightly backup. Leaves every copy already made exactly where it is. */
function adminRemoveDailyBackup() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'adminDailyBackup') { ScriptApp.deleteTrigger(t); n++; } });
  Logger.log(n ? 'Stopped the nightly backup. Existing copies were not touched.' : 'No nightly backup was scheduled.');
}

/**
 * 7. Dry run (15 Nov 2026): how many rows are waiting in the approvals queue (BLD-_pending.csv), per file and per state.
 * Changes nothing: it reads the queue file only. It does not apply waiting room moves (doPost and a plain GET do that).
 * Rows waiting on a phone (not yet sent) are not in this file and cannot be counted from here.
 */
function adminCountQueued() {
  var p;
  try { p = loadPending_(); }
  catch (e) { Logger.log('Could not read ' + BLD.PENDING_FILE + ': ' + (e.userMessage || e)); return { total: 0, byFile: {}, byState: {} }; }
  var st = pendingState_(p.records), out = { total: 0, byFile: {}, byState: {}, moves: 0 };
  Object.keys(st).forEach(function (id) {
    var s = st[id];
    if (!s.waiting) return;
    var file = s.queued.target_file || '(none)', state = s.last.event;
    out.total++;
    out.byFile[file] = (out.byFile[file] || 0) + 1;
    out.byState[state] = (out.byState[state] || 0) + 1;
    if (file === TABLES.occupancy.file && s.queued.kind !== 'correction' && !s.queued.corrects_id && isRoomMove_(s.queued)) out.moves++;
  });
  Logger.log('Waiting in ' + BLD.PENDING_FILE + ': ' + out.total + ' (nothing was changed).');
  Object.keys(out.byFile).sort().forEach(function (f) { Logger.log('--   ' + f + ': ' + out.byFile[f]); });
  Object.keys(out.byState).sort().forEach(function (s) { Logger.log('--   state ' + s + ': ' + out.byState[s]); });
  Logger.log('--   room moves a plain GET or a save would apply now (while TABLE_ON_occupancy is true): ' + out.moves);
  return out;
}

// A room move (area set, not off site): the only queued occupancy rows applyWaitingOccupancyMoves_ applies.
function isRoomMove_(queued) {
  var row = null;
  try { row = JSON.parse(queued.payload_json || '{}'); } catch (e) { row = null; }
  return !!row && !String(row.off_site_kind || '') && !!String(row.area_id || '');
}
