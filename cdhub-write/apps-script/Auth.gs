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
 * @return {{who:string, role:string}}
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
  if (!entry || entry.active === false) {
    authNoteFailure_();
    throw err_('BAD_CODE', 'That staff code was not recognised.');
  }
  return { who: entry.who, role: entry.role };
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
