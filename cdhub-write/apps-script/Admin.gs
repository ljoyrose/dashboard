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
  reg[hashCode_(code, salt)] = { who: NAME, role: ROLE, active: true, added: londonIso_(new Date()) };
  setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));
  Logger.log('Staff code for ' + NAME + ' (' + ROLE + '): ' + code);
  Logger.log('Write it down for them now. It is stored only as a one-way hash, so it cannot be shown again.');
  return code;
}

/** 3. Lists who has a code (names and roles only, never the codes). */
function adminListStaff() {
  var reg = registry_(), n = 0;
  Object.keys(reg).forEach(function (h) {
    n++;
    Logger.log(reg[h].who + ' - ' + reg[h].role + ' - ' + (reg[h].active === false ? 'SWITCHED OFF' : 'active'));
  });
  if (!n) Logger.log('No staff codes yet.');
}

/** 4. Edit NAME, then Run. Switches that person\'s code off (kept in the list, but refused). */
function adminRevokeStaff() {
  var NAME = 'Example Name';      // <- change this
  var reg = registry_(), hit = 0;
  Object.keys(reg).forEach(function (h) { if (reg[h].who === NAME) { reg[h].active = false; hit++; } });
  setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));
  Logger.log(hit ? ('Switched off ' + hit + ' code(s) for ' + NAME + '.') : ('No one called ' + NAME + ' found.'));
}

/**
 * 5. Creates EMPTY, header-only files - ONLY the ones listed, ONLY if they do not exist, and ONLY while
 * the Script Property ALLOW_CREATE is 'true'. This is Lisa's decision (2): creating the temperature log
 * and the approvals queue on Drive. Set ALLOW_CREATE back to anything else afterwards.
 */
function adminCreateEmptyTables() {
  var TO_CREATE = [BLD.PENDING_FILE, 'BLD-area_reading.csv'];   // <- trim or extend, then Run
  if (prop_(BLD.PROP.ALLOW_CREATE) !== 'true') {
    Logger.log('Refused: set the Script Property ALLOW_CREATE to true first (and set it back afterwards).');
    return;
  }
  TO_CREATE.forEach(function (title) {
    var header = title === BLD.PENDING_FILE ? BLD.PENDING_COLUMNS : (specFor_(title) || {}).columns;
    if (!header) { Logger.log('Skipped ' + title + ': not on the allow-list.'); return; }
    try { store_createEmpty_(title, header); Logger.log('Created ' + title + ' (header only).'); }
    catch (e) { Logger.log('Not created ' + title + ': ' + (e.userMessage || e)); }
  });
}

/** 6. Plain-English health check. Changes nothing. */
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
      var spec = specFor_(title), want = spec ? spec.columns : BLD.PENDING_COLUMNS;
      say(sameHeader_(r.header, want), title + ' exists with ' + r.records.length + ' row(s); header ' + (sameHeader_(r.header, want) ? 'matches' : 'DOES NOT MATCH'));
    } catch (e) { say(false, title + ': ' + (e.userMessage || e)); }
  });
  Object.keys(TABLES).forEach(function (k) {
    Logger.log('--   table ' + k + ': ' + (tableOn_(TABLES[k]) ? 'ON' : 'off') + ', mode ' + modeFor_(TABLES[k]));
  });
  Logger.log('--   SAVE_ENABLED is ' + (saveEnabled_() ? 'TRUE (saving is ON)' : 'not true (saving is OFF)'));
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
 * Old copies pile up: tidying them is Lisa's call (the script will not delete or rename them).
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
