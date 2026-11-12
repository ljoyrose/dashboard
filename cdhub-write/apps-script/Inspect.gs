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
  LINK_COLUMNS: ['id', 'tenant_id', 'code_id', 'label', 'ends', 'made_at', 'made_by'],
  SUBJECT_FILE: 'BLD-inspect_link_subject.csv',
  SUBJECT_COLUMNS: ['id', 'tenant_id', 'link_id', 'subject_id', 'from_date', 'to_date'],
  FIELD_FILE: 'BLD-inspect_link_field.csv',
  FIELD_COLUMNS: ['id', 'tenant_id', 'link_id', 'table_name', 'field_name', 'redaction'],
  ACCESS_FILE: 'BLD-inspect_access.csv',
  ACCESS_COLUMNS: ['id', 'tenant_id', 'link_id', 'code_id', 'table_name', 'rows', 'at'],
  // the lists a link may show, and the column on each that names the dog
  LISTS: { subject: 'id', subject_status: 'subject_id', health_screen: 'subject_id', fit_to_breed: 'subject_id', litter: 'dam_subject_id', microchip: 'subject_id' },
  REDACTIONS: ['', 'last4'],
  DEFAULT_DAYS: 7,
  MAX_DAYS: 30,
  MAX_DOGS: 200,
  MAX_FIELDS: 200,
  MAX_LABEL: 80
};

/** The inspector page's address (Script Property INSPECT_PAGE_URL), or '' if not set or not https. The code goes after a #. */
function inspectPageUrl_() {
  var u = String(prop_(BLD.PROP.INSPECT_PAGE_URL) || '').trim();
  return /^https:\/\/[^\s#?]+$/.test(u) ? u : '';
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
  if (!f || !sameHeader_(f.header, inspectHeader_(title))) {
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
    dogs: dogs, lists: lists, keys: INSPECT.LISTS, default_days: INSPECT.DEFAULT_DAYS, max_days: INSPECT.MAX_DAYS, today: today,
    page_url: inspectPageUrl_()
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

  var ends = String(spec.ends || '').trim() || addDays_(today, INSPECT.DEFAULT_DAYS);
  if (!isRealDate_(ends)) throw bad('ends', 'Choose the last day the link works.');
  if (ends < today) throw bad('ends', 'The last day cannot be in the past.');
  if (ends > addDays_(today, INSPECT.MAX_DAYS)) throw bad('ends', 'A link can last ' + INSPECT.MAX_DAYS + ' days at most.');

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
    var linkId = newId_('ilk', now), codeId = newCodeId_(), endsAt = inspectEndOfDay_(ends), by = adminEmail || 'owner';
    store_appendMany_(INSPECT.SUBJECT_FILE, INSPECT.SUBJECT_COLUMNS, subjects.map(function (s, i) {
      return [linkId + '-s' + (i + 1), tenant, linkId, s, today, ends];
    }), S);
    store_appendMany_(INSPECT.FIELD_FILE, INSPECT.FIELD_COLUMNS, fieldRows.map(function (r, i) {
      return [linkId + '-f' + (i + 1), tenant, linkId, r[0], r[1], r[2]];
    }), F);
    store_appendMany_(INSPECT.LINK_FILE, INSPECT.LINK_COLUMNS, [[linkId, tenant, codeId, label, endsAt, londonIso_(now), by]], L);

    var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', raw = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), code = '';
    for (var i = 0; i < 16; i++) code += alphabet.charAt(parseInt(raw.substr(i * 2, 2), 16) % alphabet.length);
    var reg = registry_();
    reg[hashCode_(code, salt)] = { id: codeId, who: 'Inspector - ' + label, role: ROLE_INSPECTOR, active: true, added: londonIso_(now), expires_at: endsAt, link_id: linkId };
    setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));   // the link works from this line on
    return { link_id: linkId, code_id: codeId, code: code, ends: endsAt, dogs: subjects.length, fields: fieldRows.length };
  });
}

/** OWNER: every link, newest first, with its state. Ended and stopped links stay listed as a record of what was shown. */
function sinkInspectLinks_() {
  var tenant = prop_(BLD.PROP.TENANT_ID), reg = registry_(), byId = {}, h;
  for (h in reg) if (Object.prototype.hasOwnProperty.call(reg, h) && reg[h].id) byId[reg[h].id] = reg[h];
  var L = inspectRead_(INSPECT.LINK_FILE), S = inspectRead_(INSPECT.SUBJECT_FILE), F = inspectRead_(INSPECT.FIELD_FILE), A = inspectRead_(INSPECT.ACCESS_FILE);
  var count = function (f, id) { return f.records.filter(function (r) { return r.tenant_id === tenant && r.link_id === id; }).length; };
  return L.records.filter(function (r) { return r.tenant_id === tenant; }).map(function (r) {
    var e = byId[r.code_id], state = 'stopped', stopped = '';
    if (e && (e.active === false || e.revoked_at)) stopped = e.revoked_at || '';
    else if (e && !guestExpired_(e)) state = 'active';
    else if (e) state = 'ended';
    return {
      id: r.id, code_id: r.code_id, label: r.label, ends: r.ends, made_at: r.made_at, made_by: r.made_by, state: state, stopped_at: stopped,
      dogs: count(S, r.id), fields: count(F, r.id), visits: count(A, r.id)
    };
  }).reverse();
}

/** OWNER: stop a link now (the usual revoke on its code; the link rows stay as the record). */
function sinkInspectStop_(linkId, adminEmail) {
  var tenant = prop_(BLD.PROP.TENANT_ID);
  var link = inspectRead_(INSPECT.LINK_FILE).records.filter(function (r) { return r.tenant_id === tenant && r.id === String(linkId || ''); })[0];
  if (!link) throw err_('NOT_FOUND', 'That link was not found.');
  return sinkRevokeCode_(link.code_id, adminEmail);
}
