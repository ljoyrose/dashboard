
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

function authBlocked_() {
  var n = parseInt(CacheService.getScriptCache().get('bld_fails') || '0', 10);
  return n >= BLD.LIMITS.FAIL_MAX;
}

function authNoteFailure_() {
  var cache = CacheService.getScriptCache();
  var n = parseInt(cache.get('bld_fails') || '0', 10) + 1;
  cache.put('bld_fails', String(n), BLD.LIMITS.FAIL_WINDOW_SEC);
}

function authStaff_(code) {
  if (authBlocked_()) {
    throw err_('TOO_MANY_TRIES', 'Too many wrong codes recently. Saving is paused for a few minutes. Ask User if this keeps happening.');
  }
  if (!code || typeof code !== 'string') {
    throw err_('NO_CODE', 'Enter your staff code.');
  }
  var salt = prop_(BLD.PROP.SALT), reg = registry_();
  if (!salt || !Object.keys(reg).length) {
    throw err_('NOT_SET_UP', 'No staff codes have been set up yet. Ask User.');
  }
  var entry = reg[hashCode_(code.trim(), salt)];
  if (!entry) {
    var plain = code.replace(/[\s-]+/g, '').toUpperCase();
    if (plain && plain !== code.trim()) entry = reg[hashCode_(plain, salt)];
  }
  if (!entry || entry.active === false || entry.revoked_at) {
    authNoteFailure_();
    throw err_('BAD_CODE', 'That staff code was not recognised.');
  }
  if (entry.role === ROLE_INSPECTOR) {
    if (guestExpired_(entry)) throw err_('BAD_CODE', 'This link has ended.');
    if (externalNotYet_(entry)) throw err_('NOT_YET', 'This link opens ' + externalShow_(entry.starts_at) + '.');
    return { who: entry.who, role: entry.role, id: String(entry.id || ''), ends: entry.expires_at || '', link_id: String(entry.link_id || '') };
  }
  if (entry.role === ROLE_GUEST) {
    if (guestExpired_(entry)) throw err_('BAD_CODE', 'This visitor code has ended. Ask User for a new one.');
    if (externalNotYet_(entry)) throw err_('NOT_YET', 'This visitor code opens ' + externalShow_(entry.starts_at) + '.');
    return { who: entry.who + ' (' + entry.id + ')', role: entry.role, id: '' };
  }
  return { who: entry.who, role: entry.role, id: String(entry.id || '') };
}

var GOOGLE_TOKEN_RE_ = /^[A-Za-z0-9._\-~+\/=]{20,4096}$/;

function authUserList_() {
  return prop_(BLD.PROP.ADMIN_EMAILS).split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(String);
}

function authUserGoogle_(token) {
  var clientId = prop_(BLD.PROP.HUB_CLIENT_ID);
  if (!clientId || typeof token !== 'string' || !GOOGLE_TOKEN_RE_.test(token)) return null;
  var cache = CacheService.getScriptCache();
  var key = 'gtok:' + hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8)).slice(0, 40);
  var hit = cache.get(key);
  if (hit) { var c = JSON.parse(hit); return c.ok ? c.who : null; }
  var who = null, ttl = 300;
  var info = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (info.getResponseCode() === 200) {
    var t = JSON.parse(info.getContentText() || '{}'), left = parseInt(t.expires_in, 10);
    if ((t.aud === clientId || t.azp === clientId) && left > 0) {
      ttl = Math.max(1, Math.min(300, left));
      var about = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress%2CdisplayName)',
        { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
      if (about.getResponseCode() === 200) {
        var u = (JSON.parse(about.getContentText() || '{}').user) || {};
        var email = String(u.emailAddress || '').trim().toLowerCase();
        if (email && authUserList_().indexOf(email) >= 0) {
          var hid = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'user:' + email, Utilities.Charset.UTF_8)).slice(0, 6);
          who = { who: String(u.displayName || '').trim() || 'User', role: 'USER', id: 'go-' + hid, via: 'google' };
        }
      }
    }
  }
  cache.put(key, JSON.stringify({ ok: !!who, who: who }), ttl);
  return who;
}

function authSaver_(req) {
  req = req || {};
  var tok = typeof req.google_token === 'string' ? req.google_token : '';
  if (tok && prop_(BLD.PROP.HUB_CLIENT_ID)) {
    var user = null;
    try { user = authUserGoogle_(tok); }
    catch (e) { if (!req.code) throw err_('GOOGLE_UNREACHABLE', 'Your Google sign-in could not be checked just now. Nothing was saved. Try again, or use your code.'); }
    if (user) return user;
    if (!req.code) throw err_('GOOGLE_NOT_USER', 'This Google account is not on the user list. Enter your staff code. Nothing was saved.');
  }
  return authStaff_(req.code);
}

function guestExpired_(entry) {
  var end = Date.parse(entry.expires_at || '');
  return isNaN(end) || new Date().getTime() >= end;
}

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

function audienceFor_(role) {
  if (role === 'USER') return 'aud-admin';
  if (role === 'STAFF') return 'aud-staff';
  if (role === ROLE_GUEST) return 'aud-guest';
  return '';
}


function newCodeId_() {
  var alphabet = 'abcdefghjkmnpqrstuvwxyz23456789', raw = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), id = '';
  for (var i = 0; i < 6; i++) id += alphabet.charAt(parseInt(raw.substr(i * 2, 2), 16) % alphabet.length);
  return 'sc-' + id;
}

function sinkStaffList_() {
  var reg = registry_(), out = [];
  Object.keys(reg).forEach(function (h) {
    var e = reg[h], guest = e.role === ROLE_GUEST || e.role === ROLE_INSPECTOR, ended = guest && guestExpired_(e), off = e.active === false || !!e.revoked_at;
    out.push({
      id: String(e.id || ''), who: guest ? e.who + ' (ends ' + (e.expires_at || 'unknown') + ')' : e.who, role: e.role, added: e.added || '',
      active: !off && !ended, revoked_at: e.revoked_at || (ended ? 'ended ' + (e.expires_at || '') : ''), revoked_by: e.revoked_by || '',
      replaced: e.ended === 'new code'
    });
  });
  return out;
}

function sinkRevokeCode_(codeId, adminEmail, reason) {
  return withLock_(function () { return revokeCodeCore_(codeId, adminEmail, reason); });
}

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
  setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));
  var logged = true;
  try {
    appendPendingEvent_({
      event_id: newId_('evt', now), pending_id: 'rev-' + id, event: 'revoked', at: londonIso_(now), by: adminEmail, role: 'USER',
      kind: 'code_revoke', row_id: id, note: reason ? 'ended now: ' + String(reason).slice(0, 200) : 'staff code switched off', result: 'revoked'
    });
  } catch (e) { logged = false; Logger.log('Revoked ' + id + ' but could not log it: ' + (e && e.message)); }
  var mirrored = codeMirror_(id, reason ? 'ended now: ' + String(reason).slice(0, 100) : 'switched off by user', null, now);
  return { status: 'revoked', id: id, who: reg[hash].who, logged: logged, mirrored: mirrored };
}

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

