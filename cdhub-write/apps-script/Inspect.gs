/**
 * INSPECTOR LINKS (Breed Better, 12 Nov 2026). A time-boxed, read-only link an inspector opens with no login.
 * Lisa decides, per link, which dogs and which fields it shows ("its for the breeder to decide what the inspector sees").
 *
 * How it holds together:
 *   - The link is an ordinary code in the staff registry with role INSPECTOR, an end date (expires_at, as a visitor code)
 *     and the id of its link row. It ends by itself; Stop is the usual revoke. An unreadable end date counts as ended.
 *   - It can never save: sinkHandle_ refuses it before anything else.
 *   - What it can READ comes ONLY from the link's own rows, never from BLD-field_visibility.csv (that file stays read-only
 *     for this script, and stays Lisa's):
 *         BLD-inspect_link_subject   the dogs, one row each, with from_date / to_date (blank to_date = no end)
 *         BLD-inspect_link_field     the columns, one row per list and column; redaction '' or 'last4'
 *     No rows = nothing. Only the lists in INSPECT.LISTS, and never a score list, whatever the rows say.
 *   - Every inspector read is logged in BLD-inspect_access (link, code id, list, how many rows, when), never the code.
 *     If the log cannot be written, the read is refused.
 *   - Only the owner (signed in on the approval page) makes, lists and stops links. The code is shown ONCE, to the owner,
 *     and is never logged or stored except as the one-way hash in the registry.
 */
var ROLE_INSPECTOR = 'INSPECTOR';

var INSPECT = {
  LINK_FILE: 'BLD-inspect_link.csv',
  // V9 (13 Nov 2026, Lisa: "now for a specific time or scheduled date time from to"): starts_at/ends_at are London
  // date-times; data_from_date/data_to_date are kept for the data period (not used yet). Old 7-column files still read.
  LINK_COLUMNS: ['id', 'tenant_id', 'code_id', 'label', 'ends', 'made_at', 'made_by', 'starts_at', 'ends_at', 'data_from_date', 'data_to_date'],
  LINK_COLUMNS_V1: ['id', 'tenant_id', 'code_id', 'label', 'ends', 'made_at', 'made_by'],
  SUBJECT_FILE: 'BLD-inspect_link_subject.csv',
  SUBJECT_COLUMNS: ['id', 'tenant_id', 'link_id', 'subject_id', 'from_date', 'to_date'],
  FIELD_FILE: 'BLD-inspect_link_field.csv',
  FIELD_COLUMNS: ['id', 'tenant_id', 'link_id', 'table_name', 'field_name', 'redaction'],
  ACCESS_FILE: 'BLD-inspect_access.csv',
  ACCESS_COLUMNS: ['id', 'tenant_id', 'link_id', 'code_id', 'table_name', 'rows', 'at'],
  // the lists a link may show, and the column on each that names the dog
  LISTS: { subject: 'id', subject_status: 'subject_id', health_screen: 'subject_id', fit_to_breed: 'subject_id', litter: 'dam_subject_id', microchip: 'subject_id' },
  REDACTIONS: ['', 'last4'],
  // how long a link lasts is NOT here: rule rows external.default_hours.<role> and external.max_hours.<role> (externalRule_)
  MAX_DOGS: 200,
  MAX_FIELDS: 200,
  MAX_LABEL: 80
};

/** The inspector page's address (Script Property INSPECT_PAGE_URL), or '' if not set or not https. The code goes after a #. */
function inspectPageUrl_() {
  var u = String(prop_(BLD.PROP.INSPECT_PAGE_URL) || '').trim();
  return /^https:\/\/[^\s#?]+$/.test(u) ? u : '';
}

/** The Save deployment's id (Script Property INSPECT_SCRIPT_ID, the part between /macros/s/ and /exec). Not secret.
 *  An inspector's phone has no saved Script URL, so the link carries it: <page>#s=<id>&c=<code>. */
function inspectScriptId_() {
  var s = String(prop_(BLD.PROP.INSPECT_SCRIPT_ID) || '').trim();
  return /^[A-Za-z0-9_-]{10,}$/.test(s) ? s : '';
}

function inspectFiles_() { return [INSPECT.LINK_FILE, INSPECT.SUBJECT_FILE, INSPECT.FIELD_FILE, INSPECT.ACCESS_FILE]; }

/** The header a link file must have, or null if the title is not one of them. */
function inspectHeader_(title) {
  if (title === INSPECT.LINK_FILE) return INSPECT.LINK_COLUMNS;
  if (title === INSPECT.SUBJECT_FILE) return INSPECT.SUBJECT_COLUMNS;
  if (title === INSPECT.FIELD_FILE) return INSPECT.FIELD_COLUMNS;
  if (title === INSPECT.ACCESS_FILE) return INSPECT.ACCESS_COLUMNS;
  return null;
}

/** Read one link file; missing or the wrong columns means links are not set up, so nothing is shown. */
function inspectRead_(title) {
  var f = store_read_(title, false);
  var v1 = f && title === INSPECT.LINK_FILE && sameHeader_(f.header, INSPECT.LINK_COLUMNS_V1);
  if (!f || (!v1 && !sameHeader_(f.header, inspectHeader_(title)))) {
    throw err_('READ_NOT_CONFIGURED', 'Inspector links are not set up yet, so nothing can be shown.');
  }
  return f;
}

/** A list a link may show? Never a score list, whatever anyone ticks. */
function inspectListOk_(key) {
  if (typeof key !== 'string' || /^score_/.test(key)) return false;
  if (!Object.prototype.hasOwnProperty.call(INSPECT.LISTS, key) || !Object.prototype.hasOwnProperty.call(READABLE, key)) return false;
  return !/^score_/.test(READABLE[key].vis) && !/^BLD-score_/.test(READABLE[key].file);
}

/** Is London day `day` inside from..to (both included; blank = open)? */
function inspectCovers_(r, day) {
  var from = String(r.from_date || ''), to = String(r.to_date || '');
  if (from && !isRealDate_(from)) return false;
  if (to && !isRealDate_(to)) return false;
  return (!from || from <= day) && (!to || day <= to);
}

/**
 * An inspector's read. Called by sinkRead_ once the code is known to be a live INSPECTOR code.
 * Returns the same shape as a staff read, plus `ends` (the link's end, London time).
 */
function inspectSinkRead_(req, who, now) {
  var key = typeof req.table === 'string' ? req.table : '';
  var denied = err_('NOT_ALLOWED', 'This link does not show that list.');
  if (!inspectListOk_(key)) throw denied;
  if (req.filter !== undefined && req.filter !== null) throw err_('BAD_FILTER', 'That filter was not understood.');
  var tenant = prop_(BLD.PROP.TENANT_ID);
  if (!tenant) throw err_('NOT_CONFIGURED', 'The tenant id has not been set up in the script (TENANT_ID).');
  var rd = READABLE[key], subjCol = INSPECT.LISTS[key], today = todayLondon_(now);

  var link = inspectRead_(INSPECT.LINK_FILE).records.filter(function (r) {
    return r.tenant_id === tenant && who.id && r.code_id === who.id && (!who.link_id || r.id === who.link_id);
  })[0];
  if (!link) throw denied;

  var cols = {};
  inspectRead_(INSPECT.FIELD_FILE).records.forEach(function (r) {
    if (r.tenant_id !== tenant || r.link_id !== link.id || r.table_name !== key) return;
    var red = String(r.redaction || '').trim();
    if (INSPECT.REDACTIONS.indexOf(red) < 0) { cols[r.field_name] = null; return; }   // not understood: hidden, not guessed
    if (cols[r.field_name] !== null) cols[r.field_name] = red;
  });
  var dogs = {};
  inspectRead_(INSPECT.SUBJECT_FILE).records.forEach(function (r) {
    if (r.tenant_id === tenant && r.link_id === link.id && r.subject_id && inspectCovers_(r, today)) dogs[r.subject_id] = true;
  });
  var access = inspectRead_(INSPECT.ACCESS_FILE);

  var data = store_read_(rd.file, false);
  if (!data) throw err_('FILE_MISSING', 'That list does not exist yet.');
  var fields = data.header.filter(function (c) {
    return c !== 'tenant_id' && Object.prototype.hasOwnProperty.call(cols, c) && cols[c] !== null;
  });
  if (!fields.length || data.header.indexOf(subjCol) < 0) throw denied;
  // the column naming the dog always comes too (an internal id, never redacted), so the page can put each dog's rows together
  if (fields.indexOf(subjCol) < 0) fields.unshift(subjCol);
  cols[subjCol] = '';

  var hasTenantCol = data.header.indexOf('tenant_id') >= 0, rows = [], truncated = false, redacted = {};
  fields.forEach(function (c) { if (cols[c]) redacted[c] = cols[c]; });
  for (var i = 0; i < data.records.length; i++) {
    var r = data.records[i];
    if (hasTenantCol && r.tenant_id !== tenant) continue;
    if (!dogs[r[subjCol]]) continue;
    if (rows.length >= BLD.LIMITS.READ_MAX_ROWS) { truncated = true; break; }
    var o = {};
    fields.forEach(function (c) {
      var v = r[c] === undefined || r[c] === null ? '' : String(r[c]);
      o[c] = cols[c] === 'last4' ? v.slice(-4) : v;
    });
    rows.push(o);
  }

  try {
    withLock_(function () {
      store_appendMany_(INSPECT.ACCESS_FILE, INSPECT.ACCESS_COLUMNS,
        [[newId_('iac', now), tenant, link.id, who.id, key, String(rows.length), londonIso_(now)]], access);
    });
  } catch (e) {
    throw err_('LOG_FAILED', 'This could not be shown just now, because the visit could not be recorded. Try again.');
  }
  return {
    table: key, fields: fields, rows: rows, count: rows.length, truncated: truncated, redacted: redacted,
    scope: 'the dogs on this link', ends: who.ends || '', as_of: londonIso_(now)
  };
}

/** The end of London day `ymd` as a London time with its offset, e.g. 2026-11-19T23:59:59Z. */
function inspectEndOfDay_(ymd) {
  var noon = londonIso_(new Date(Date.parse(ymd + 'T12:00:00Z')));
  return ymd + 'T23:59:59' + noon.slice(19);
}

/**
 * OWNER: what can be ticked. Dogs (id, name, archived = their latest status row has ended or says Archived/Retired/Left)
 * and, per list, the columns that exist in its file. No values are returned apart from dog names.
 */
function sinkInspectChoices_() {
  var tenant = prop_(BLD.PROP.TENANT_ID), today = todayLondon_(new Date());
  var subj = store_read_(READABLE.subject.file, false), stat = store_read_(READABLE.subject_status.file, false);
  var state = {};
  ((stat && stat.records) || []).forEach(function (r) {
    if (r.tenant_id && r.tenant_id !== tenant) return;
    if (inspectCovers_(r, today)) state[r.subject_id] = String(r.state || '');
  });
  var dogs = ((subj && subj.records) || []).filter(function (r) { return !r.tenant_id || r.tenant_id === tenant; }).map(function (r) {
    var st = state[r.id] || '';
    return { id: r.id, name: r.name || r.id, archived: !st || /archiv|retire|left|dead|died|sold/i.test(st) };
  });
  var lists = {};
  Object.keys(INSPECT.LISTS).forEach(function (k) {
    if (!inspectListOk_(k)) return;
    var f = store_read_(READABLE[k].file, false);
    if (f) lists[k] = f.header.filter(function (c) { return c !== 'tenant_id'; });
  });
  return {
    dogs: dogs, lists: lists, keys: INSPECT.LISTS, today: today, now: londonIso_(new Date()).slice(0, 16),
    default_hours: externalRule_('default_hours', ROLE_INSPECTOR, today), max_hours: externalRule_('max_hours', ROLE_INSPECTOR, today),
    page_url: inspectPageUrl_(), script_id: inspectScriptId_()
  };
}

/**
 * OWNER: make a link. spec = {label, ends: 'YYYY-MM-DD' (blank = today + 7), subjects: [subject ids],
 * fields: {list: ['column', {field: 'chip_number', redaction: 'last4'}, ...]}}.
 * Writes the dog rows, the field rows and the link row, and only THEN the code, so a half-made link can never be opened.
 * Returns the code ONCE, for the owner page to show with a Copy button. It is not logged.
 */
function sinkInspectMake_(spec, adminEmail) {
  var bad = function (field, msg) { var e = {}; e[field] = msg; return err_('INVALID', msg, { fields: e }); };
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw err_('BAD_REQUEST', 'That request was not understood.');
  var now = new Date(), today = todayLondon_(now), tenant = prop_(BLD.PROP.TENANT_ID);
  if (!tenant) throw err_('NOT_CONFIGURED', 'The tenant id has not been set up in the script (TENANT_ID).');
  var salt = prop_(BLD.PROP.SALT);
  if (!salt) throw err_('NOT_SET_UP', 'Run adminSetup first.');

  var label = String(spec.label || '').trim();
  if (!label) throw bad('label', 'Say who or what this link is for.');
  if (label.length > INSPECT.MAX_LABEL || /[\r\n]/.test(label)) throw bad('label', 'Keep the name to one short line.');

  var win = externalWindow_(spec, ROLE_INSPECTOR, now, bad);
  var ends = todayLondon_(new Date(win.endMs));

  var subjects = Array.isArray(spec.subjects) ? spec.subjects.map(String) : [];
  var seen = {};
  subjects = subjects.filter(function (s) { if (seen[s]) return false; seen[s] = true; return true; });
  if (!subjects.length) throw bad('subjects', 'Tick at least one dog.');
  if (subjects.length > INSPECT.MAX_DOGS) throw bad('subjects', 'A link can show ' + INSPECT.MAX_DOGS + ' dogs at most.');
  var subj = store_read_(READABLE.subject.file, true), known = {};
  subj.records.forEach(function (r) { if (!r.tenant_id || r.tenant_id === tenant) known[r.id] = true; });
  subjects.forEach(function (s) { if (!ID_RE_.test(s) || !known[s]) throw bad('subjects', 'One of the ticked dogs was not found. Reload the page.'); });

  var fieldRows = [], fields = spec.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw bad('fields', 'Tick at least one field.');
  Object.keys(fields).forEach(function (list) {
    if (!inspectListOk_(list)) throw bad('fields', 'A link cannot show that list.');
    var want = fields[list];
    if (!Array.isArray(want)) throw bad('fields', 'That field choice was not understood.');
    var f = store_read_(READABLE[list].file, false);
    if (!f) throw bad('fields', 'That list does not exist yet.');
    var done = {};
    want.forEach(function (w) {
      var name = typeof w === 'string' ? w : (w && typeof w === 'object' ? String(w.field || '') : '');
      var red = w && typeof w === 'object' ? String(w.redaction || '') : '';
      if (!name || name === 'tenant_id' || f.header.indexOf(name) < 0) throw bad('fields', 'One of the ticked fields was not found. Reload the page.');
      if (INSPECT.REDACTIONS.indexOf(red) < 0) throw bad('fields', 'That way of hiding part of a value is not known.');
      if (done[name]) return;
      done[name] = true;
      fieldRows.push([list, name, red]);
    });
  });
  if (!fieldRows.length) throw bad('fields', 'Tick at least one field.');
  if (fieldRows.length > INSPECT.MAX_FIELDS) throw bad('fields', 'Too many fields ticked.');

  return withLock_(function () {
    var L = inspectRead_(INSPECT.LINK_FILE), S = inspectRead_(INSPECT.SUBJECT_FILE), F = inspectRead_(INSPECT.FIELD_FILE);
    inspectRead_(INSPECT.ACCESS_FILE);   // the visit log must exist before a link can be opened
    var linkId = newId_('ilk', now), codeId = newCodeId_(), endsAt = win.ends_at, by = adminEmail || 'owner';
    var v1 = sameHeader_(L.header, INSPECT.LINK_COLUMNS_V1);
    if (v1 && win.later) throw bad('starts_at', 'A link that opens later needs the starts_at and ends_at columns in BLD-inspect_link. Ask STAFF to add them.');
    store_appendMany_(INSPECT.SUBJECT_FILE, INSPECT.SUBJECT_COLUMNS, subjects.map(function (s, i) {
      return [linkId + '-s' + (i + 1), tenant, linkId, s, todayLondon_(new Date(win.startMs)), ends];
    }), S);
    store_appendMany_(INSPECT.FIELD_FILE, INSPECT.FIELD_COLUMNS, fieldRows.map(function (r, i) {
      return [linkId + '-f' + (i + 1), tenant, linkId, r[0], r[1], r[2]];
    }), F);
    var lv = { id: linkId, tenant_id: tenant, code_id: codeId, label: label, ends: endsAt, made_at: londonIso_(now), made_by: by,
      starts_at: win.starts_at, ends_at: win.ends_at, data_from_date: '', data_to_date: '' };
    store_appendMany_(INSPECT.LINK_FILE, L.header, [L.header.map(function (h) { return lv[h] == null ? '' : lv[h]; })], L);

    var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', raw = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), code = '';
    for (var i = 0; i < 16; i++) code += alphabet.charAt(parseInt(raw.substr(i * 2, 2), 16) % alphabet.length);
    var reg = registry_();
    reg[hashCode_(code, salt)] = { id: codeId, who: 'Inspector - ' + label, role: ROLE_INSPECTOR, active: true, added: londonIso_(now), starts_at: win.starts_at, expires_at: endsAt, link_id: linkId };
    setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));   // the link works from this line on
    return { link_id: linkId, code_id: codeId, code: code, ends: endsAt, starts_at: win.starts_at, ends_at: win.ends_at, dogs: subjects.length, fields: fieldRows.length };
  });
}

/** OWNER: every link, newest first, with its state. Ended and stopped links stay listed as a record of what was shown. */
function sinkInspectLinks_() {
  var tenant = prop_(BLD.PROP.TENANT_ID), reg = registry_(), byId = {}, h;
  for (h in reg) if (Object.prototype.hasOwnProperty.call(reg, h) && reg[h].id) byId[reg[h].id] = reg[h];
  var L = inspectRead_(INSPECT.LINK_FILE), S = inspectRead_(INSPECT.SUBJECT_FILE), F = inspectRead_(INSPECT.FIELD_FILE), A = inspectRead_(INSPECT.ACCESS_FILE);
  var count = function (f, id) { return f.records.filter(function (r) { return r.tenant_id === tenant && r.link_id === id; }).length; };
  return L.records.filter(function (r) { return r.tenant_id === tenant; }).map(function (r) {
    var e = byId[r.code_id], state = 'stopped', stopped = '', reason = '';
    if (e && (e.active === false || e.revoked_at)) { stopped = e.revoked_at || ''; reason = e.revoked_reason || ''; }
    else if (e && !guestExpired_(e)) state = externalNotYet_(e) ? 'scheduled' : 'active';
    else if (e) state = 'ended';
    return {
      id: r.id, code_id: r.code_id, label: r.label, ends: r.ends, starts_at: r.starts_at || (e && e.starts_at) || r.made_at, ends_at: r.ends_at || r.ends,
      made_at: r.made_at, made_by: r.made_by, state: state, stopped_at: stopped, stop_reason: reason,
      dogs: count(S, r.id), fields: count(F, r.id), visits: count(A, r.id)
    };
  }).reverse();
}

/** OWNER: stop a link now (the usual revoke on its code; the link rows stay as the record). */
function sinkInspectStop_(linkId, adminEmail, reason) {
  var tenant = prop_(BLD.PROP.TENANT_ID);
  reason = String(reason == null ? '' : reason).trim();
  if (!reason) throw err_('INVALID', 'Say briefly why it is ending now.', { fields: { reason: 'Say briefly why it is ending now.' } });
  if (reason.length > 200 || /[\r\n]/.test(reason)) throw err_('INVALID', 'Keep the reason to one short line.', { fields: { reason: 'Keep the reason to one short line.' } });
  var link = inspectRead_(INSPECT.LINK_FILE).records.filter(function (r) { return r.tenant_id === tenant && r.id === String(linkId || ''); })[0];
  if (!link) throw err_('NOT_FOUND', 'That link was not found.');
  return sinkRevokeCode_(link.code_id, adminEmail, reason);
}

/* ---------------------------------------------------------------------------------------------------------------
 * Outside-access windows (V9, 13 Nov 2026). One shape for every outsider (inspector, guest, later vet and auditor):
 *   {hours: N}                     from now, for N hours (an unannounced visit)
 *   {until: 'HH:MM'}               from now until that time today
 *   {starts_at, ends_at}           'YYYY-MM-DDTHH:MM' London, set in advance; the code says "Opens ..." until then
 *   {ends: 'YYYY-MM-DD'}           the old shape: from now to the end of that day
 *   nothing                        the external.default_hours.<role> rule row, if there is one
 * The longest is the external.max_hours.<role> rule row in force today (BLD-breeding_rule, the shared rule list).
 * No row = no default, and no cap beyond what the owner sets. Nothing about length is fixed in this file.
 * --------------------------------------------------------------------------------------------------------------- */

/** A whole or decimal number of hours from the rule row external.<name>.<role> in force on `day`, or null. */
function externalRule_(name, role, day) {
  var key = 'external.' + name + '.' + String(role || '').toLowerCase(), best = null, val = null, rules;
  try { rules = store_read_('BLD-breeding_rule.csv', false); } catch (e) { return null; }
  if (!rules) return null;
  var tenant = prop_(BLD.PROP.TENANT_ID);
  rules.records.forEach(function (r) {
    if (r.rule_key !== key || (tenant && r.tenant_id && r.tenant_id !== tenant)) return;
    var from = String(r.effective_from || ''), to = String(r.to_date || '');
    if (!from || from > day || (to && to < day)) return;
    var n = Number(String(r.value || '').trim());
    if (!(n > 0) || n > 100000) return;
    if (best === null || from >= best) { best = from; val = n; }
  });
  return val;
}

/** London 'YYYY-MM-DDTHH:MM' to a time in ms, or NaN. */
function londonLocalMs_(s) {
  var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m || !isRealDate_(m[1]) || +m[2] > 23 || +m[3] > 59) return NaN;
  var guess = Date.parse(m[1] + 'T' + m[2] + ':' + m[3] + ':00Z');
  var off = londonIso_(new Date(guess)).slice(19);                      // '+01:00' or 'Z'/'+00:00'
  var ms = Date.parse(m[1] + 'T' + m[2] + ':' + m[3] + ':00' + (off === 'Z' ? 'Z' : off));
  return londonIso_(new Date(ms)).slice(0, 16) === m[1] + 'T' + m[2] + ':' + m[3] ? ms : NaN;   // a time that does not exist (clocks go forward) is refused
}

/** Work out a window from the owner's request. Returns {startMs, endMs, starts_at, ends_at, later}. */
function externalWindow_(spec, role, now, bad) {
  var nowMs = now.getTime(), today = todayLondon_(now), startMs = nowMs, endMs, H = 3600000;
  var hours = spec.hours, until = String(spec.until || '').trim(), sa = String(spec.starts_at || '').trim(), ea = String(spec.ends_at || '').trim();
  var endsDay = String(spec.ends || '').trim();
  if (hours !== undefined && hours !== null && hours !== '') {
    var n = Number(hours);
    if (!(n > 0) || n > 100000) throw bad('hours', 'Choose how many hours.');
    endMs = nowMs + Math.round(n * H);
  } else if (until) {
    if (!/^\d{2}:\d{2}$/.test(until)) throw bad('until', 'Choose a time as HH:MM.');
    endMs = londonLocalMs_(today + 'T' + until);
    if (isNaN(endMs)) throw bad('until', 'Choose a time as HH:MM.');
    if (endMs <= nowMs) throw bad('until', 'That time has already passed today.');
  } else if (sa || ea) {
    startMs = sa ? londonLocalMs_(sa) : nowMs;
    endMs = londonLocalMs_(ea);
    if (isNaN(startMs)) throw bad('starts_at', 'Choose the date and time it opens.');
    if (isNaN(endMs)) throw bad('ends_at', 'Choose the date and time it ends.');
    if (startMs < nowMs) startMs = nowMs;                                  // a start already passed means from now
    if (endMs <= startMs) throw bad('ends_at', 'The end must be after the start.');
  } else if (endsDay) {
    if (!isRealDate_(endsDay)) throw bad('ends', 'Choose the last day the link works.');
    if (endsDay < today) throw bad('ends', 'The last day cannot be in the past.');
    endMs = Date.parse(inspectEndOfDay_(endsDay));
  } else {
    var def = externalRule_('default_hours', role, today);
    if (def === null) throw bad('ends_at', 'Choose when it ends.');
    endMs = nowMs + Math.round(def * H);
  }
  var max = externalRule_('max_hours', role, today);
  if (max !== null && endMs - startMs > Math.round(max * H) + 60000) {
    throw bad(hours !== undefined && hours !== null && hours !== '' ? 'hours' : (until ? 'until' : (sa || ea ? 'ends_at' : (endsDay ? 'ends' : 'ends_at'))), 'This can last ' + max + ' hours at most (your rule for ' + String(role).toLowerCase() + ' visits).');
  }
  return { startMs: startMs, endMs: endMs, starts_at: londonIso_(new Date(startMs)), ends_at: londonIso_(new Date(endMs)), later: startMs > nowMs + 60000 };
}

/** A code whose window has not opened yet? (starts_at in the future) */
function externalNotYet_(entry) {
  var s = Date.parse(entry.starts_at || '');
  return !isNaN(s) && new Date().getTime() < s;
}

/** 'DD/MM/YY HH:MM' London, for messages. */
function externalShow_(iso) {
  var ms = Date.parse(iso || ''); if (isNaN(ms)) return '';
  var t = londonIso_(new Date(ms));
  return t.slice(8, 10) + '/' + t.slice(5, 7) + '/' + t.slice(2, 4) + ' ' + t.slice(11, 16);
}
