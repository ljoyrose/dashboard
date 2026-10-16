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
  return { who: entry.who, role: entry.role, id: String(entry.id || '') };
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
    var e = reg[h];
    out.push({
      id: String(e.id || ''), who: e.who, role: e.role, added: e.added || '',
      active: !(e.active === false || e.revoked_at), revoked_at: e.revoked_at || '', revoked_by: e.revoked_by || ''
    });
  });
  return out;
}

/** Switch one code off, by its public id. Owner only (the caller checks). */
function sinkRevokeCode_(codeId, adminEmail) {
  return withLock_(function () {
    var now = new Date(), id = String(codeId || '');
    if (!/^sc-[a-z0-9]{6}$/.test(id)) throw err_('INVALID', 'Say which code to switch off.');
    var reg = registry_(), hash = '', h;
    for (h in reg) if (Object.prototype.hasOwnProperty.call(reg, h) && reg[h].id === id) { hash = h; break; }
    if (!hash) throw err_('NOT_FOUND', 'That code was not found.');
    if (reg[hash].active === false || reg[hash].revoked_at) throw err_('ALREADY_REVOKED', 'That code is already switched off.');
    reg[hash].active = false;
    reg[hash].revoked_at = londonIso_(now);
    reg[hash].revoked_by = adminEmail;
    setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));            // the code is dead from this line on
    var logged = true;
    try {
      appendPendingEvent_({
        event_id: newId_('evt', now), pending_id: 'rev-' + id, event: 'revoked', at: londonIso_(now), by: adminEmail, role: 'OWNER',
        kind: 'code_revoke', row_id: id, note: 'staff code switched off', result: 'revoked'
      });
    } catch (e) { logged = false; Logger.log('Revoked ' + id + ' but could not log it: ' + (e && e.message)); }
    return { status: 'revoked', id: id, who: reg[hash].who, logged: logged };
  });
}
