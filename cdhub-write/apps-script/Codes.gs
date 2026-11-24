/**
 * Code admin on the owner page (13 Nov 2026, DRAFT for V8): give someone a code, rename it, give them a new code.
 * Owner only (a signed-in Google account in ADMIN_EMAILS; the ui_ wrappers in Web.gs check it). Never a staff code.
 *
 * A new code is returned ONCE to the owner's own page, to be shown on her screen and written down. It is never logged,
 * never written to a file and never sent anywhere else. Only its one-way hash is kept (Script Properties registry).
 *
 * BLD-code_register.csv is a no-secrets mirror the hub can read: one row per spell of a code.
 *   id,tenant_id,code_id,who,role,from_date,to_date,ended_by
 * Rename, new code and switch-off fill to_date and ended_by on the open row; rename and new code then add a fresh row.
 * Nothing is deleted. code_id is the public sc-xxxxxx id; a new code keeps it, so person:<id> permission rows keep working.
 * Switch: TABLE_ON_code_register. While it is off (or the file is missing) codes still work; the reply says mirrored:false.
 */
var CODE_REG = {
  FILE: 'BLD-code_register.csv',
  COLUMNS: ['id', 'tenant_id', 'code_id', 'who', 'role', 'from_date', 'to_date', 'ended_by'],
  ON: 'code_register',
  CODE_LEN: 10
};

function codeRegisterOn_() { return prop_(BLD.PROP.TABLE_ON_PREFIX + CODE_REG.ON) === 'true'; }
function codeRegisterFiles_() { return codeRegisterOn_() ? [CODE_REG.FILE] : []; }
function codeRegisterHeader_(title) { return title === CODE_REG.FILE ? CODE_REG.COLUMNS : null; }

/** A fresh code: 10 characters, no look-alikes (0/O, 1/I/L). */
function codeMake_() {
  var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', raw = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), code = '';
  for (var i = 0; i < CODE_REG.CODE_LEN; i++) code += alphabet.charAt(parseInt(raw.substr(i * 2, 2), 16) % alphabet.length);
  return code;
}

function codeName_(who) {
  var v = String(who == null ? '' : who).trim();
  if (!v) throw err_('INVALID', 'Type the person\'s name.', { fields: { who: 'Type the person\'s name.' } });
  if (v.length > 60 || CONTROL_RE_.test(v) || /^[=+\-@\t]/.test(v)) throw err_('INVALID', 'Use a plain name on one line.', { fields: { who: 'Use a plain name on one line.' } });
  return v;
}

/** The live (not switched off) registry entry with this public id, or throws. */
function codeFind_(reg, codeId) {
  var id = String(codeId || '');
  if (!/^sc-[a-z0-9]{6}$/.test(id)) throw err_('INVALID', 'Say which code.');
  for (var h in reg) {
    if (!Object.prototype.hasOwnProperty.call(reg, h) || reg[h].id !== id) continue;
    if (reg[h].active === false || reg[h].revoked_at) continue;
    return h;
  }
  throw err_('NOT_FOUND', 'That code was not found, or it is switched off.');
}

function codeNote_(event, codeId, by, note, now) {
  try {
    appendPendingEvent_({ event_id: newId_('evt', now), pending_id: 'code-' + codeId, event: event, at: londonIso_(now), by: by, role: 'OWNER',
      kind: 'code_' + event, row_id: codeId, note: note, result: event });
    return true;
  } catch (e) { Logger.log('Code ' + codeId + ' ' + event + ' but could not note it: ' + (e && e.message)); return false; }
}

/**
 * Mirror one change into BLD-code_register: end the open row of this code (if any), then add a new row (if `next`).
 * Never throws: the code change has already happened, so a mirror problem is reported, not raised.
 */
function codeMirror_(codeId, endedBy, next, now) {
  if (!codeRegisterOn_()) return false;
  try {
    var read = store_read_(CODE_REG.FILE, true), today = todayLondon_(now), tenant = prop_(BLD.PROP.TENANT_ID);
    var miss = CODE_REG.COLUMNS.filter(function (c) { return read.header.indexOf(c) < 0; });
    if (miss.length) throw new Error('header has no ' + miss.join(', '));
    if (endedBy) {
      read.records.forEach(function (r, i) {
        if (r.code_id !== codeId || String(r.to_date || '').trim()) return;
        var row = read.header.map(function (h) { return h === 'to_date' ? today : (h === 'ended_by' ? endedBy : (r[h] == null ? '' : String(r[h]))); });
        store_replaceRow_(CODE_REG.FILE, read.header, i, row, read);
      });
    }
    if (next) {
      var vals = { id: newId_('cr', now), tenant_id: tenant, code_id: codeId, who: next.who, role: next.role, from_date: next.from_date || today, to_date: next.to_date || '', ended_by: next.ended_by || '' };
      store_append_(CODE_REG.FILE, read.header, read.header.map(function (h) { return vals[h] == null ? '' : String(vals[h]); }), store_read_(CODE_REG.FILE, true));
    }
    return true;
  } catch (e) { Logger.log('code_register not updated for ' + codeId + ': ' + (e && e.message)); return false; }
}

/** Give someone a new code. role: one of ROLE_ALL (OWNER, STAFF, VET, TRAINER). Returns the code ONCE. */
function sinkIssueCode_(who, role, adminEmail) {
  var name = codeName_(who), r = String(role || '').trim().toUpperCase();
  if (ROLE_ALL.indexOf(r) < 0) throw err_('INVALID', 'Pick a role: ' + ROLE_ALL.join(', ') + '.', { fields: { role: 'Pick a role.' } });
  var salt = prop_(BLD.PROP.SALT);
  if (!salt) throw err_('NOT_SET_UP', 'Run adminSetup first.');
  return withLock_(function () {
    var now = new Date(), reg = registry_(), code = codeMake_(), hash = hashCode_(code, salt), ids = {};
    while (reg[hash]) { code = codeMake_(); hash = hashCode_(code, salt); }
    Object.keys(reg).forEach(function (h) { ids[reg[h].id] = 1; });
    var id = newCodeId_();
    while (ids[id]) id = newCodeId_();
    reg[hash] = { id: id, who: name, role: r, active: true, added: londonIso_(now) };
    setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));
    var logged = codeNote_('issued', id, adminEmail, 'new code for ' + name + ' (' + r + ')', now);
    var mirrored = codeMirror_(id, '', { who: name, role: r }, now);
    return { status: 'issued', id: id, who: name, role: r, code: code, logged: logged, mirrored: mirrored };
  });
}

/** Change the name held against a code. The code itself does not change. */
function sinkRenameCode_(codeId, who, adminEmail) {
  var name = codeName_(who);
  return withLock_(function () {
    var now = new Date(), reg = registry_(), h = codeFind_(reg, codeId), e = reg[h];
    if (e.role === ROLE_GUEST || e.role === ROLE_INSPECTOR) throw err_('NOT_ALLOWED', 'Visitor codes and inspector links keep their label.');
    if (e.who === name) throw err_('NOTHING_CHANGED', 'That is already the name.');
    var old = e.who;
    e.who = name;
    setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));
    var logged = codeNote_('renamed', e.id, adminEmail, 'name changed', now);
    var mirrored = codeMirror_(e.id, 'renamed by owner', { who: name, role: e.role }, now);
    return { status: 'renamed', id: e.id, who: name, was: old, logged: logged, mirrored: mirrored };
  });
}

/**
 * Give the same person a new code (lost phone, code seen by someone else). The old code stops at once.
 * The public id moves to the new code, so permission rows keep working; the old entry stays, switched off, without an id.
 */
function sinkResetCode_(codeId, adminEmail) {
  var salt = prop_(BLD.PROP.SALT);
  if (!salt) throw err_('NOT_SET_UP', 'Run adminSetup first.');
  return withLock_(function () {
    var now = new Date(), reg = registry_(), h = codeFind_(reg, codeId), e = reg[h];
    if (e.role === ROLE_GUEST || e.role === ROLE_INSPECTOR) throw err_('NOT_ALLOWED', 'Make a new visitor code or inspector link instead.');
    var code = codeMake_(), hash = hashCode_(code, salt);
    while (reg[hash]) { code = codeMake_(); hash = hashCode_(code, salt); }
    reg[hash] = { id: e.id, who: e.who, role: e.role, active: true, added: londonIso_(now) };
    e.active = false; e.revoked_at = londonIso_(now); e.revoked_by = adminEmail; e.was_id = e.id; e.id = ''; e.ended = 'new code';
    setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));            // the old code is dead from this line on
    var logged = codeNote_('reset', reg[hash].id, adminEmail, 'new code, old one switched off', now);
    var mirrored = codeMirror_(reg[hash].id, 'new code by owner', { who: reg[hash].who, role: reg[hash].role }, now);
    return { status: 'reset', id: reg[hash].id, who: reg[hash].who, role: reg[hash].role, code: code, logged: logged, mirrored: mirrored };
  });
}

/** Fill BLD-code_register with every code that has no row yet (names, roles, dates: never a code or a hash). */
function sinkCodeRegisterSync_() {
  if (!codeRegisterOn_()) throw err_('TABLE_OFF', 'The code register is switched off.');
  return withLock_(function () {
    var now = new Date(), reg = registry_(), read = store_read_(CODE_REG.FILE, true), have = {}, added = 0;
    read.records.forEach(function (r) { have[r.code_id] = 1; });
    Object.keys(reg).forEach(function (h) {
      var e = reg[h], id = String(e.id || '');
      if (!id || have[id]) return;
      var off = e.active === false || !!e.revoked_at, visitor = e.role === ROLE_GUEST || e.role === ROLE_INSPECTOR;
      var to = off ? String(e.revoked_at).slice(0, 10) : (visitor ? String(e.expires_at || '').slice(0, 10) : '');
      if (codeMirror_(id, '', { who: e.who, role: e.role, from_date: String(e.added || '').slice(0, 10), to_date: to, ended_by: off ? 'switched off' : '' }, now)) added++;
    });
    return { status: 'synced', added: added };
  });
}

/**
 * Codes vault: is this typed code the one held for this public id? (Lisa 14 Nov 2026, option B; OV11: the hash and its
 * salt never go to a browser, because short codes could be guessed offline.) Sent once, like a sign-in; the reply is
 * match true or false only. The typed code is never logged, stored or sent back. A miss counts towards the same
 * wrong-code limit as sign-in, so it cannot be used to guess.
 * Who may: the vault gate (OWNER codes today; BLD-permission code_vault / open when served).
 */
function sinkCodeCheck_(req) {
  var who = authStaff_(req && req.code);
  if (!vaultMay_(who)) throw err_('NOT_ALLOWED', 'Only people the owner allows can use the vault.');
  var id = String((req && req.code_id) || '');
  if (!/^sc-[a-z0-9]{6}$/.test(id)) throw err_('INVALID', 'Say which code.');
  var typed = req && req.typed;
  if (!typed || typeof typed !== 'string' || typed.length > 64) throw err_('INVALID', 'Type the code.');
  if (authBlocked_()) throw err_('TOO_MANY_TRIES', 'Too many wrong codes recently. Try again in a few minutes.');
  var salt = prop_(BLD.PROP.SALT), entry = registry_()[hashCode_(typed.trim(), salt)];
  var match = !!entry && String(entry.id) === id && entry.active !== false && !entry.revoked_at;
  if (!match) authNoteFailure_();
  return { match: match };
}

/** The vault gate on the server. Today OWNER codes; BLD-permission rows take over when the script serves them. */
function vaultMay_(who) { return !!who && who.role === 'OWNER'; }
