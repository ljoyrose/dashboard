/**
 * Who is saving? Two kinds of person:
 *  - staff: a personal code (checked against hashed codes in Script Properties)
 *  - owner/admin: a signed-in Google account listed in ADMIN_EMAILS (approval page only)
 * No code, name, email or URL is ever stored in the repository.
 */

function prop_(name) {
  var v = PropertiesService.getScriptProperties().getProperty(name);
  return v === null || v === undefined ? '' : String(v);
}

function setProp_(name, value) {
  PropertiesService.getScriptProperties().setProperty(name, value);
}

function hex_(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    s += (b < 16 ? '0' : '') + b.toString(16);
  }
  return s;
}

function hashCode_(code, salt) {
  return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + code, Utilities.Charset.UTF_8));
}

function registry_() {
  var raw = prop_(BLD.PROP.REGISTRY);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

/** Too many wrong codes in the window? Then refuse everyone until it passes. */
function authBlocked_() {
  var n = parseInt(CacheService.getScriptCache().get('bld_fails') || '0', 10);
  return n >= BLD.LIMITS.FAIL_MAX;
}

function authNoteFailure_() {
  var cache = CacheService.getScriptCache();
  var n = parseInt(cache.get('bld_fails') || '0', 10) + 1;
  cache.put('bld_fails', String(n), BLD.LIMITS.FAIL_WINDOW_SEC);
}

/**
 * Check a staff code.
 * @return {{who:string, role:string, id:string}}  id = the code's short public id (sc-xxxxxx), never the code or its hash
 * @throws err_ NO_CODE | TOO_MANY_TRIES | BAD_CODE | NOT_SET_UP
 */
function authStaff_(code) {
  if (authBlocked_()) {
    throw err_('TOO_MANY_TRIES', 'Too many wrong codes recently. Saving is paused for a few minutes. Ask Lisa if this keeps happening.');
  }
  if (!code || typeof code !== 'string') {
    throw err_('NO_CODE', 'Enter your staff code.');
  }
  var salt = prop_(BLD.PROP.SALT), reg = registry_();
  if (!salt || !Object.keys(reg).length) {
    throw err_('NOT_SET_UP', 'No staff codes have been set up yet. Ask Lisa.');
  }
  var entry = reg[hashCode_(code.trim(), salt)];
  if (!entry || entry.active === false || entry.revoked_at) {
    authNoteFailure_();
    throw err_('BAD_CODE', 'That staff code was not recognised.');
  }
  if (entry.role === ROLE_INSPECTOR) {
    // an inspector link (Inspect.gs): read-only, ends by itself; reads only what its own link rows allow
    if (guestExpired_(entry)) throw err_('BAD_CODE', 'This link has ended.');
    if (externalNotYet_(entry)) throw err_('NOT_YET', 'This link opens ' + externalShow_(entry.starts_at) + '.');
    return { who: entry.who, role: entry.role, id: String(entry.id || ''), ends: entry.expires_at || '', link_id: String(entry.link_id || '') };
  }
  if (entry.role === ROLE_GUEST) {
    if (guestExpired_(entry)) throw err_('BAD_CODE', 'This visitor code has ended. Ask Lisa for a new one.');
    if (externalNotYet_(entry)) throw err_('NOT_YET', 'This visitor code opens ' + externalShow_(entry.starts_at) + '.');
    // id stays empty so no person:<id> permission row can ever open a list to a guest; the label carries the id instead
    return { who: entry.who + ' (' + entry.id + ')', role: entry.role, id: '' };
  }
  return { who: entry.who, role: entry.role, id: String(entry.id || '') };
}

/** A guest code with no readable end date counts as ended (the safe side). */
function guestExpired_(entry) {
  var end = Date.parse(entry.expires_at || '');
  return isNaN(end) || new Date().getTime() >= end;
}

/** Is the signed-in Google account (approval deployment) one of the owners? */
function isAdminSession_() {
  var email = '';
  try { email = Session.getActiveUser().getEmail() || ''; } catch (e) { email = ''; }
  if (!email) return false;
  var list = prop_(BLD.PROP.ADMIN_EMAILS).split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(String);
  return list.indexOf(email.toLowerCase()) >= 0;
}

function adminEmail_() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}

/**
 * Which BLD audience (BLD-audience.csv) does a staff code belong to? Used only by the read action.
 * Anything not listed here gets NO audience, so reads are refused (default deny).
 */
function audienceFor_(role) {
  if (role === 'OWNER') return 'aud-admin';
  if (role === 'STAFF') return 'aud-staff';
  if (role === ROLE_GUEST) return 'aud-guest';   // Read.gs also holds a guest to the room list, whatever the rows say
  return '';
}

/* ------------------------------------------------------------------------------------------------
 * OWNER: see and switch off staff codes. Owner-only (a signed-in Google account in ADMIN_EMAILS), never a staff code.
 * A code is never deleted: switching it off keeps its entry in the registry and adds revoked_at / revoked_by to it,
 * and one line is APPENDED to the approvals queue file (kind = code_revoke) so there is a record. Neither the code nor
 * its hash is ever shown or logged. A switched-off code is refused on the very next read or save.
 * ---------------------------------------------------------------------------------------------- */

/** A short public id for a code, e.g. sc-k3f9ab. It is NOT secret and cannot be used to sign in. */
function newCodeId_() {
  var alphabet = 'abcdefghjkmnpqrstuvwxyz23456789', raw = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), id = '';
  for (var i = 0; i < 6; i++) id += alphabet.charAt(parseInt(raw.substr(i * 2, 2), 16) % alphabet.length);
  return 'sc-' + id;
}

/** Who has a code. Names, roles, ids and state only: never a code or a hash. */
function sinkStaffList_() {
  var reg = registry_(), out = [];
  Object.keys(reg).forEach(function (h) {
    var e = reg[h], guest = e.role === ROLE_GUEST || e.role === ROLE_INSPECTOR, ended = guest && guestExpired_(e), off = e.active === false || !!e.revoked_at;
    out.push({
      id: String(e.id || ''), who: guest ? e.who + ' (ends ' + (e.expires_at || 'unknown') + ')' : e.who, role: e.role, added: e.added || '',
      active: !off && !ended, revoked_at: e.revoked_at || (ended ? 'ended ' + (e.expires_at || '') : ''), revoked_by: e.revoked_by || '',
      replaced: e.ended === 'new code'   // an old code whose person was given a new one (Codes.gs); its id moved to the new code
    });
  });
  return out;
}

/** Switch one code off, by its public id. Owner only (the caller checks). */
function sinkRevokeCode_(codeId, adminEmail, reason) {
  return withLock_(function () { return revokeCodeCore_(codeId, adminEmail, reason); });
}

/** The revoke itself, for callers that already hold the lock (Visit.gs grant_end). */
function revokeCodeCore_(codeId, adminEmail, reason) {
  var now = new Date(), id = String(codeId || '');
  if (!/^sc-[a-z0-9]{6}$/.test(id)) throw err_('INVALID', 'Say which code to switch off.');
  var reg = registry_(), hash = '', h;
  for (h in reg) if (Object.prototype.hasOwnProperty.call(reg, h) && reg[h].id === id) { hash = h; break; }
  if (!hash) throw err_('NOT_FOUND', 'That code was not found.');
  if (reg[hash].active === false || reg[hash].revoked_at) throw err_('ALREADY_REVOKED', 'That code is already switched off.');
  reg[hash].active = false;
  reg[hash].revoked_at = londonIso_(now);
  reg[hash].revoked_by = adminEmail;
  if (reason) reg[hash].revoked_reason = String(reason).slice(0, 200);
  setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));            // the code is dead from this line on
  var logged = true;
  try {
    appendPendingEvent_({
      event_id: newId_('evt', now), pending_id: 'rev-' + id, event: 'revoked', at: londonIso_(now), by: adminEmail, role: 'OWNER',
      kind: 'code_revoke', row_id: id, note: reason ? 'ended now: ' + String(reason).slice(0, 200) : 'staff code switched off', result: 'revoked'
    });
  } catch (e) { logged = false; Logger.log('Revoked ' + id + ' but could not log it: ' + (e && e.message)); }
  var mirrored = codeMirror_(id, reason ? 'ended now: ' + String(reason).slice(0, 100) : 'switched off by owner', null, now);   // Codes.gs: the hub's no-secrets list
  return { status: 'revoked', id: id, who: reg[hash].who, logged: logged, mirrored: mirrored };
}

/**
 * OWNER: edit LABEL and HOURS, then press Run in the Apps Script editor. Prints a visitor code ONCE, in the Execution log.
 * It saves temperatures to the guest list only, can see the room list and nothing else, ends by itself after HOURS hours, and can be switched off sooner on the
 * approvals page like any code. LABEL is a description such as 'Council visit Nov 2026': it is written on every reading.
 * The longest allowed is the rule row external.max_hours.guest, if there is one (no number is fixed here).
 */
function adminAddGuestCode() {
  var LABEL = 'Example visit';    // <- change this
  var HOURS = 8;                  // <- how many hours from now
  if (!(HOURS > 0)) throw new Error('HOURS must be more than 0.');
  var maxH = externalRule_('max_hours', ROLE_GUEST, todayLondon_(new Date()));
  if (maxH !== null && HOURS > maxH) throw new Error('HOURS can be ' + maxH + ' at most (rule external.max_hours.guest).');
  var salt = prop_(BLD.PROP.SALT);
  if (!salt) throw new Error('Run adminSetup first.');
  var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', raw = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), code = '';
  for (var i = 0; i < 12; i++) code += alphabet.charAt(parseInt(raw.substr(i * 2, 2), 16) % alphabet.length);
  var now = new Date(), reg = registry_(), id = newCodeId_(), ends = londonIso_(new Date(now.getTime() + Math.round(HOURS * 3600000)));
  reg[hashCode_(code, salt)] = { id: id, who: 'Guest - ' + LABEL, role: ROLE_GUEST, active: true, added: londonIso_(now), expires_at: ends };
  setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));
  Logger.log('Visitor code for ' + LABEL + ': ' + code + '   (public id ' + id + ', ends ' + ends + ')');
  Logger.log('Give it to the visitor now. It is stored only as a one-way hash, so it cannot be shown again.');
  return code;
}
