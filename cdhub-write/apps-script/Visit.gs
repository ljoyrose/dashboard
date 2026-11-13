/* ---------------------------------------------------------------------------------------------------------------
 * VISITS (external access, V9, 13 Nov 2026; API agreed with ADMIN in AA_VISIT-API_2026-11-13-2034 + STAFF reply 2055).
 * Part A: the owner's visit types and visitor cards. Both OWNER code only, behind one switch TABLE_ON_visit (OFF).
 *
 *   action 'grant_type_save'  Adds one BLD-grant_type row (a PRESET, copied into the grant's rows at give time). A type is
 *                             never changed in place: the same type_key again is a new version with a later (or same-day,
 *                             later-saved) from_date; to_date ends it. Nothing is fixed here:
 *                             the hub offers suggested rows for the owner to save or change.
 *   action 'card_add'         Adds one BLD-qr_tag row of kind visitor_card. The card's tag is random (about 128 bits) and
 *                             is returned ONCE for printing. The file keeps only 'sha256:<hex>' of it, so anyone who can
 *                             read qr_tag cannot use a card. A scan only opens a page; it never proves anyone was there.
 * --------------------------------------------------------------------------------------------------------------- */
var VISIT_ = {
  ON: 'visit',
  TYPE_FILE: 'BLD-grant_type.csv',
  TYPE_COLUMNS: ['id', 'tenant_id', 'type_key', 'name', 'role_code', 'default_hours', 'max_hours', 'rights', 'lists', 'fields',
    'data_years', 'record_jobs', 'record_counts', 'email_code', 'needs_id_check', 'terms_id', 'from_date', 'to_date',
    'set_at', 'set_by', 'source', 'grant_basis'],   // grant_basis: the visit's default basis (blank = voluntary)
  TAG_FILE: 'BLD-qr_tag.csv',
  TAG_NEED: ['id', 'tenant_id', 'tag', 'kind', 'ref_id', 'active', 'made_at', 'made_by'],
  CARD_KIND: 'visitor_card',
  FINDING_FILE: 'BLD-finding.csv',
  // the live finding columns a review fills, plus the six V9 appends; other columns are left blank, found by name
  FINDING_NEED: ['id', 'tenant_id', 'authority', 'raised_on', 'wording_as_given', 'finding_kind', 'outcome_id',
    'target_table', 'target_id', 'sign_in_id', 'raised_at', 'grant_id'],
  // the GrantRight codes this script can carry out (Regulatory-Core); which ones a visit gets is the owner's choice.
  // raise_finding is shown as "Review". BLD-grant_right holds their labels.
  RIGHTS: ['view', 'raise_finding', 'print', 'export', 'record'],
  KEY_RE: /^[a-z][a-z0-9_]{1,39}$/,
  JOB_RE: /^[a-z0-9][a-z0-9_.\-]{0,59}$/,
  FIELD_RE: /^([a-z][a-z0-9_]{0,39})\.([a-z][a-z0-9_]{0,59})(:last4)?$/,
  ROLE_RE: /^[A-Z][A-Z_]{1,29}$/
};

/** 'review' (the earlier word) is the right raise_finding. */
function visitRightCode_(s) { s = String(s == null ? '' : s).trim(); return s === 'review' ? 'raise_finding' : s; }

function visitOn_() { return prop_(BLD.PROP.TABLE_ON_PREFIX + VISIT_.ON) === 'true'; }
function visitFiles_() { return visitOn_() ? [VISIT_.TYPE_FILE, VISIT_.FINDING_FILE].concat(delegFiles_()) : []; }

/** Shared entry for OWNER visit actions: switches, owner code, repeat-tap guard, one lock. */
function sinkVisitOwner_(req, fn, holderOk) {
  if (!saveEnabled_()) throw err_('SAVE_OFF', 'Saving is switched off.');
  if (!req || typeof req !== 'object') throw err_('BAD_REQUEST', 'That request was not understood.');
  if (!visitOn_()) throw err_('TABLE_OFF', 'Visits are switched off.');
  var rid = String(req.request_id || '');
  if (!/^[A-Za-z0-9_\-]{8,64}$/.test(rid)) throw err_('BAD_REQUEST', 'The request had no valid reference.');
  var who = authStaff_(req.code), f = req.fields && typeof req.fields === 'object' ? req.fields : {}, deleg = null;
  if (who.role !== 'OWNER') {
    // Delegate.gs: a role never implies this; only a live give_visit row the owner conferred (or one passed on under it)
    if (holderOk) deleg = delegFor_(who, 'give_visit', String(f.delegation_id || '').trim(), new Date().getTime());
    if (!deleg) throw err_('NOT_ALLOWED', 'Only the kennel owner, or someone she has allowed, can do this.');
  }
  var cache = CacheService.getScriptCache(), cached = cache.get('rid:' + rid);
  if (cached) { var again = JSON.parse(cached); again.repeat = true; return again; }
  var result = withLock_(function () { return fn(f, who, new Date(), deleg); });
  cache.put('rid:' + rid, JSON.stringify(result), BLD.LIMITS.REQUEST_CACHE_SEC);
  return result;
}

/** A pipe list from an array or 'a|b' text: trimmed, no blanks, no repeats, each must pass `ok`. null = a bad item. */
function visitList_(v, ok, max) {
  var arr = Array.isArray(v) ? v : String(v == null ? '' : v).split('|'), out = [];
  for (var i = 0; i < arr.length; i++) {
    var s = String(arr[i] == null ? '' : arr[i]).trim();
    if (!s) continue;
    if (!ok(s)) return null;
    if (out.indexOf(s) < 0) out.push(s);
  }
  return out.length > (max || 100) ? null : out;
}

function visitHours_(v, name, errors) {
  v = String(v == null ? '' : v).trim();
  if (!v) return '';
  if (!/^\d{1,4}$/.test(v) || +v < 1 || +v > 8760) { errors[name] = 'Hours as a whole number, 1 or more.'; return ''; }
  return String(+v);
}

function visitRead_(file, need) {
  var read = store_read_(file, true);
  dogcardHeader_(read, need, file);
  return read;
}

/** The rows of one table for this tenant. */
function visitMine_(read) {
  var tenant = prop_(BLD.PROP.TENANT_ID);
  return read.records.filter(function (r) { return !tenant || !r.tenant_id || r.tenant_id === tenant; });
}

/** A dated row is in force on `day` when from_date <= day <= to_date (blank to_date = open). Blank from_date = always. */
function grantRowOn_(r, day) {
  var from = String(r.from_date || ''), to = String(r.to_date || '');
  return (!from || from <= day) && (!to || to >= day);
}

/** The grant type version in force on `day` for a type_key: from_date <= day <= to_date, latest from_date then set_at. */
function grantTypeInForce_(rows, key, day) {
  var best = null;
  rows.forEach(function (r) {
    if (r.type_key !== key || !String(r.from_date || '') || !grantRowOn_(r, day)) return;
    if (!best || r.from_date > best.from_date || (r.from_date === best.from_date && String(r.set_at) >= String(best.set_at))) best = r;
  });
  return best;
}

/** The check_type version in force on `day` for a type_key (latest effective_from <= day, then latest set_at). */
function visitTypeInForce_(rows, key, day) {
  var best = null;
  rows.forEach(function (r) {
    if (r.type_key !== key || !String(r.effective_from || '') || r.effective_from > day) return;
    if (!best || r.effective_from > best.effective_from || (r.effective_from === best.effective_from && String(r.set_at) >= String(best.set_at))) best = r;
  });
  return best;
}

function sinkVisitTypeSave_(req) {
  return sinkVisitOwner_(req, function (f, who, now) {
    var errors = {}, today = todayLondon_(now);
    var key = String(f.type_key || '').trim();
    if (!VISIT_.KEY_RE.test(key)) errors.type_key = 'A short key in small letters, e.g. inspector.';
    var name = dogcardText_(f.name, 'name', errors, 80);
    if (!name && !errors.name) errors.name = 'Give the visit type a name.';
    var role = String(f.role_code || '').trim();
    if (role && !VISIT_.ROLE_RE.test(role)) errors.role_code = 'Use a role code such as INSPECTOR.';
    var dh = visitHours_(f.default_hours, 'default_hours', errors), mh = visitHours_(f.max_hours, 'max_hours', errors);
    if (dh && mh && +dh > +mh) errors.default_hours = 'The usual length cannot be longer than the longest.';
    var rights = visitList_((Array.isArray(f.rights) ? f.rights : String(f.rights == null ? '' : f.rights).split('|')).map(visitRightCode_), function (s) { return VISIT_.RIGHTS.indexOf(s) >= 0; });
    if (!rights) errors.rights = 'Choose from view, review, print, export, record.';
    else if (rights.indexOf('view') < 0) errors.rights = 'A visit always includes view.';
    var lists = visitList_(f.lists, function (s) { return VISIT_.KEY_RE.test(s); });
    if (!lists) errors.lists = 'Choose the lists from the page.';
    var fields = visitList_(f.fields, function (s) {
      var m = VISIT_.FIELD_RE.exec(s);
      return !!m && !!lists && lists.indexOf(m[1]) >= 0;
    }, 500);
    if (!fields) errors.fields = 'Each field must be on one of the chosen lists.';
    var years = String(f.data_years == null ? '' : f.data_years).trim();
    if (years && (!/^\d{1,2}$/.test(years))) errors.data_years = 'Years as a whole number.';
    var jobs = visitList_(f.record_jobs, function (s) { return VISIT_.JOB_RE.test(s); });
    var counts = visitList_(f.record_counts, function (s) { return VISIT_.JOB_RE.test(s); });
    if (!jobs) errors.record_jobs = 'Choose the jobs from the page.';
    else if (jobs.length && rights && rights.indexOf('record') < 0) errors.record_jobs = 'Tick record to let visitors record jobs.';
    if (!counts || (jobs && counts.some(function (c) { return jobs.indexOf(c) < 0; }))) errors.record_counts = 'Only jobs the visitor may record can count.';
    var email = String(f.email_code == null ? '' : f.email_code).trim();
    if (['', 'true', 'false'].indexOf(email) < 0) errors.email_code = 'Yes or no.';
    var from = String(f.from_date || '').trim() || today, to = String(f.to_date || '').trim();
    if (!isRealDate_(from)) errors.from_date = 'Use a real date as YYYY-MM-DD.';
    if (to && !isRealDate_(to)) errors.to_date = 'Use a real date as YYYY-MM-DD.';
    else if (to && !errors.from_date && to < from) errors.to_date = 'The end cannot be before the start.';
    var source = dogcardText_(f.source, 'source', errors, 200);
    var basis = String(f.grant_basis || '').trim();
    if (basis) basis = visitLabelCode_(basis, 'grant_basis', 'voluntary', errors, 'grant_basis');
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });
    var read = visitRead_(VISIT_.TYPE_FILE, VISIT_.TYPE_COLUMNS), mine = visitMine_(read);
    var latest = '';
    mine.forEach(function (r) { if (r.type_key === key && String(r.from_date) > latest) latest = String(r.from_date); });
    if (latest && from < latest) throw err_('INVALID', 'Please check the highlighted fields.', { fields: { from_date: 'A newer version already starts ' + latest + '. Start this one on or after that.' } });
    var id = dogcardAppend_({ file: VISIT_.TYPE_FILE, idPrefix: 'vty', need: VISIT_.TYPE_COLUMNS }, {
      type_key: key, name: name, role_code: role, default_hours: dh, max_hours: mh, rights: rights.join('|'), lists: lists.join('|'),
      fields: fields.join('|'), data_years: years ? String(+years) : '', record_jobs: jobs.join('|'), record_counts: counts.join('|'),
      email_code: email === 'true' ? 'true' : '', needs_id_check: '', terms_id: '', from_date: from, to_date: to,
      set_at: londonIso_(now), set_by: who.who, source: source || ('CD Hub, ' + who.who + ', ' + today), grant_basis: basis === 'voluntary' ? '' : basis
    });
    return { status: 'saved', id: id, type_key: key, new_version: !!latest };
  });
}

/** A card tag: 26 characters from a 31-letter alphabet (about 128 bits), no look-alikes. */
function visitCardTag_() {
  var alphabet = 'abcdefghjkmnpqrstuvwxyz23456789', raw = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), tag = '';
  for (var i = 0; i < 26; i++) tag += alphabet.charAt(parseInt(raw.substr(i * 2, 2), 16) % alphabet.length);
  return 'vc' + tag;
}

/** What qr_tag keeps for a card: never the tag itself. */
function visitCardHash_(tag) { return 'sha256:' + textHash_(String(tag)); }

function sinkCardAdd_(req) {
  return sinkVisitOwner_(req, function (f, who, now) {
    var errors = {};
    var label = dogcardText_(f.label, 'label', errors, 40);
    if (!label && !errors.label) errors.label = 'Give the card a label, e.g. Visitor 3.';
    var fixed = String(f.fixed_type_id || '').trim();
    if (fixed && !ID_RE_.test(fixed)) errors.fixed_type_id = 'Choose a visit type from the list.';
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });
    var read = visitRead_(VISIT_.TAG_FILE, VISIT_.TAG_NEED.concat(fixed ? ['fixed_type_id'] : []));
    if (fixed) {
      var types = visitMine_(visitRead_(VISIT_.TYPE_FILE, VISIT_.TYPE_COLUMNS));
      if (!types.some(function (r) { return r.id === fixed; })) throw err_('NOT_FOUND', 'That visit type was not found.');
    }
    var clash = visitMine_(read).filter(function (r) { return r.kind === VISIT_.CARD_KIND && r.active === 'true' && r.ref_id === label; })[0];
    if (clash) throw err_('DUPLICATE', 'A card with that label already exists.', { duplicate_of: clash.id });
    var tag = visitCardTag_();
    var id = dogcardAppend_({ file: VISIT_.TAG_FILE, idPrefix: 'qrt', need: VISIT_.TAG_NEED }, {
      tag: visitCardHash_(tag), kind: VISIT_.CARD_KIND, ref_id: label, active: 'true', made_at: londonIso_(now),
      made_by: who.who, fixed_type_id: fixed
    });
    return { status: 'saved', tag_id: id, tag: tag, label: label };
  });
}

/* ---------------------------------------------------------------------------------------------------------------
 * Part B: give, end and extend a visit. A visit is a Regulatory-Core DisclosureGrant: one BLD-inspect_link row (V9 header)
 * plus its dog rows, field rows, BLD-grant_scope rows (one per list: disclosure_state) and BLD-grant_right_link rows
 * (view, raise_finding, print, export, and one 'record' row per job with counts_due). Names: AA_V9-NAMES_2026-11-13-2140. Map: AA_ACCESS_2026-11-13-1535 "Map onto Regulatory-Core".
 *   - A LINK visit gets a fresh code (registry role INSPECTOR, so it can only read what its own rows allow, never save
 *     through the staff path). The code is returned ONCE with the page url; it is never logged or stored.
 *   - A CARD visit gets no code: the printed card's tag opens it while its window is live (part C).
 *   - Rows are never edited. End and extend write a NEW link row with supersedes_id; children stay on the ROOT row's id.
 *   - purpose_text is required ("a grant with no purpose is unreviewable").
 * --------------------------------------------------------------------------------------------------------------- */
function visitLinkRead_() {
  var L = store_read_(INSPECT.LINK_FILE, true);
  if (!sameHeader_(L.header, INSPECT.LINK_COLUMNS)) {
    throw err_('HEADER_MISMATCH', INSPECT.LINK_FILE + ' does not have the visit columns yet, so nothing was saved. Ask STAFF to add them.');
  }
  return L;
}

/** The type row by id (a specific version), for this tenant. */
function visitTypeById_(id) {
  var rows = visitMine_(visitRead_(VISIT_.TYPE_FILE, VISIT_.TYPE_COLUMNS));
  return rows.filter(function (r) { return r.id === id; })[0] || null;
}

/** A visit's state from its CURRENT row: 'ended' (revoked or past usable_to), 'opens' (not yet) or 'live'. */
function visitState_(r, nowMs) {
  if (String(r.ended_at || '')) return 'ended';
  var end = Date.parse(r.usable_to || '') || Date.parse(inspectEndOfDay_(String(r.ends || '')));
  if (isNaN(end) || nowMs >= end) return 'ended';
  var start = Date.parse(r.usable_from || '');
  return !isNaN(start) && nowMs < start ? 'opens' : 'live';
}

/** fields ['table.col', 'table.col:last4'] to field rows [list, col, redaction]; each list must be one a link may show. */
function visitFieldRows_(fields, bad) {
  var out = [], seen = {}, cache = {};
  (fields || []).forEach(function (s) {
    var m = VISIT_.FIELD_RE.exec(s);
    if (!m || !inspectListOk_(m[1])) throw bad('fields', 'A visit cannot show that list.');
    if (!cache[m[1]]) cache[m[1]] = store_read_(READABLE[m[1]].file, false);
    var f = cache[m[1]];
    if (!f) throw bad('fields', 'That list does not exist yet.');
    if (m[2] === 'tenant_id' || f.header.indexOf(m[2]) < 0) throw bad('fields', 'One of the ticked fields was not found. Reload the page.');
    if (seen[m[1] + '.' + m[2]]) return;
    seen[m[1] + '.' + m[2]] = true;
    out.push([m[1], m[2], m[3] ? 'last4' : '']);
  });
  if (!out.length) throw bad('fields', 'Tick at least one field.');
  if (out.length > INSPECT.MAX_FIELDS) throw bad('fields', 'Too many fields ticked.');
  return out;
}

function visitEvent_(now, who, kind, linkId, note) {
  try {
    appendPendingEvent_({ event_id: newId_('evt', now), pending_id: 'visit-' + linkId, event: kind, at: londonIso_(now), by: who.who,
      role: who.role || 'OWNER', kind: 'visit', row_id: linkId, note: String(note || '').slice(0, 200), result: kind });
    return true;
  } catch (e) { Logger.log('Visit ' + kind + ' ' + linkId + ' not logged: ' + (e && e.message)); return false; }
}

function visitReason_(f, errors, need, name) {
  name = name || 'reason';
  var r = dogcardText_(f[name], name, errors, 200);
  if (need && !r && !errors[name]) errors[name] = 'Say briefly why.';
  return r;
}

/** A value that must be a code in BLD-status_label group `group` (blank = `dflt`). No rows = only the default. */
function visitLabelCode_(v, group, dflt, errors, name) {
  v = String(v == null ? '' : v).trim() || dflt;
  if (v === dflt) return v;
  var sl = store_read_('BLD-status_label.csv', false);
  var ok = sl && sl.header.indexOf('group') >= 0 && sl.records.some(function (r) { return r.group === group && r.code === v; });
  if (!ok) errors[name] = 'Choose one from the list.';
  return v;
}

/** The scope and right rows of a grant (root id) in force on `day`: {lists, rights, jobs: {type_key: counts_due}}. */
function visitGrant_(rootId, day) {
  var tenant = prop_(BLD.PROP.TENANT_ID), out = { lists: [], rights: [], jobs: {} };
  var sc = store_read_(INSPECT.SCOPE_FILE, false), rt = store_read_(INSPECT.RIGHT_FILE, false);
  if (sc) sc.records.forEach(function (r) {
    if (r.tenant_id === tenant && r.grant_id === rootId && grantRowOn_(r, day) && r.disclosure_state === 'record' && out.lists.indexOf(r.scope_item_type) < 0) out.lists.push(r.scope_item_type);
  });
  if (rt) rt.records.forEach(function (r) {
    if (r.tenant_id !== tenant || r.grant_id !== rootId || !grantRowOn_(r, day)) return;
    if (out.rights.indexOf(r.right_code) < 0) out.rights.push(r.right_code);
    if (r.right_code === 'record' && r.scope_summary) out.jobs[r.scope_summary] = String(r.counts_due) === 'true' || String(r.counts_due) === 'yes';
  });
  return out;
}

function sinkVisitGive_(req) {
  return sinkVisitOwner_(req, function (f, who, now, deleg) {
    var errors = {}, bad = function (field, msg) { var e = {}; e[field] = msg; return err_('INVALID', msg, { fields: e }); };
    var tenant = prop_(BLD.PROP.TENANT_ID), salt = prop_(BLD.PROP.SALT);
    if (!tenant) throw err_('NOT_CONFIGURED', 'The tenant id has not been set up in the script (TENANT_ID).');
    var typeId = String(f.grant_type_id || '').trim();
    if (!ID_RE_.test(typeId)) throw bad('grant_type_id', 'Choose the kind of visit.');
    var type = visitTypeById_(typeId);
    if (!type) throw err_('NOT_FOUND', 'That kind of visit was not found. Reload the page.');
    if (!grantRowOn_(type, todayLondon_(now))) throw bad('grant_type_id', 'That kind of visit is not in use today.');
    var role = type.role_code || ROLE_INSPECTOR;

    var personId = String(f.person_id || '').trim(), name = dogcardText_(f.person_name || f.visitor_name, 'person_name', errors, 80);
    var org = dogcardText_(f.organisation, 'organisation', errors, 80);
    if (personId && !ID_RE_.test(personId)) errors.person_id = 'Choose the person from the list.';
    if (!name && !errors.person_name) errors.person_name = 'Type the visitor\'s name.';
    var cardId = String(f.card_tag_id || '').trim();
    if (cardId && !ID_RE_.test(cardId)) errors.card_tag_id = 'Choose a card from the list.';
    var purpose = visitReason_(f, errors, true, 'purpose_text');
    var basis = visitLabelCode_(f.grant_basis || type.grant_basis, 'grant_basis', 'voluntary', errors, 'grant_basis');
    var assurance = visitLabelCode_(f.identity_assurance, 'identity_assurance', 'none', errors, 'identity_assurance');
    var keep = String(f.retention_until || '').trim();
    if (keep && !isRealDate_(keep)) errors.retention_until = 'Use a real date as YYYY-MM-DD.';
    var arr = function (k) { return Array.isArray(f[k]) ? f[k] : String(f[k] == null ? '' : f[k]).split('|'); };
    var rights = visitList_(arr('rights').map(visitRightCode_), function (s) { return VISIT_.RIGHTS.indexOf(s) >= 0; });
    if (!rights || rights.indexOf('view') < 0) errors.rights = 'A visit always includes view.';
    var jobs = visitList_(arr('record_jobs'), function (s) { return VISIT_.JOB_RE.test(s); });
    var counts = visitList_(arr('record_counts'), function (s) { return VISIT_.JOB_RE.test(s); });
    if (!jobs) errors.record_jobs = 'Choose the jobs from the page.';
    else if (jobs.length && rights && rights.indexOf('record') < 0) errors.record_jobs = 'Tick record to let this visitor record jobs.';
    if (!counts || (jobs && counts.some(function (c) { return jobs.indexOf(c) < 0; }))) errors.record_counts = 'Only jobs the visitor may record can count.';
    var dFrom = String(f.as_of_from || '').trim(), dTo = String(f.as_of_to || '').trim();
    if (dFrom && !isRealDate_(dFrom)) errors.as_of_from = 'Use a real date as YYYY-MM-DD.';
    if (dTo && !isRealDate_(dTo)) errors.as_of_to = 'Use a real date as YYYY-MM-DD.';
    if (dFrom && dTo && !errors.as_of_from && !errors.as_of_to && dTo < dFrom) errors.as_of_to = 'The end cannot be before the start.';
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });

    var fieldRows = visitFieldRows_(visitList_(arr('fields'), function (s) { return VISIT_.FIELD_RE.test(s); }, 500) || ['?'], bad);
    var lists = [];
    fieldRows.forEach(function (r) { if (lists.indexOf(r[0]) < 0) lists.push(r[0]); });
    var lim = deleg ? deleg.limits : null;
    if (lim) visitWithin_(lim, type, rights, lists, fieldRows, jobs);
    var capH = Number(type.max_hours) > 0 ? Number(type.max_hours) : null;
    if (lim && lim.max_hours !== null && (capH === null || lim.max_hours < capH)) capH = lim.max_hours;
    var win = externalWindow_({ hours: f.hours, starts_at: f.usable_from, ends_at: f.usable_to }, role, now, bad,
      { default_hours: Number(type.default_hours), max_hours: capH });
    if (lim && lim.to_ms !== null && win.endMs > lim.to_ms) throw bad('usable_to', 'Your permission ends ' + externalShow_(londonIso_(new Date(lim.to_ms))) + '; the visit must end by then.');

    var subj = store_read_(READABLE.subject.file, true), known = {}, all = [];
    subj.records.forEach(function (r) { if (!r.tenant_id || r.tenant_id === tenant) { known[r.id] = true; all.push(r.id); } });
    var subjects = visitList_(arr('subject_ids'), function (s) { return ID_RE_.test(s) && known[s]; }, INSPECT.MAX_DOGS);
    if (!subjects) throw bad('subject_ids', 'One of the ticked dogs was not found. Reload the page.');
    if (!subjects.length) subjects = all;
    if (lim) subjects = visitDogsWithin_(lim, subjects, subjects === all, tenant, bad);
    if (!subjects.length) throw bad('subject_ids', 'There are no dogs to show.');

    if (personId) {
      var people = store_read_('BLD-person.csv', false);
      if (!people || !people.records.some(function (r) { return r.id === personId && (!r.tenant_id || r.tenant_id === tenant); })) throw err_('NOT_FOUND', 'That person was not found.');
    }

    var L = visitLinkRead_(), S = inspectRead_(INSPECT.SUBJECT_FILE), F = inspectRead_(INSPECT.FIELD_FILE);
    var SC = inspectRead_(INSPECT.SCOPE_FILE), RT = inspectRead_(INSPECT.RIGHT_FILE);
    inspectRead_(INSPECT.ACCESS_FILE);   // the visit log must exist before a visit can be opened
    if (cardId) {
      var tags = visitMine_(visitRead_(VISIT_.TAG_FILE, VISIT_.TAG_NEED));
      var card = tags.filter(function (r) { return r.id === cardId && r.kind === VISIT_.CARD_KIND; })[0];
      if (!card || card.active !== 'true') throw err_('NOT_FOUND', 'That card was not found or is switched off.');
      var fixed = String(card.fixed_type_id || '');
      if (fixed && fixed !== typeId) {
        var ft = visitTypeById_(fixed);
        if (!ft || ft.type_key !== type.type_key) throw bad('grant_type_id', 'This card is kept for another kind of visit.');
      }
      var nowMs = now.getTime(), cur = linkCurrent_(L.records, tenant), busy = null;
      Object.keys(cur).forEach(function (root) {
        var r = cur[root];
        if (busy || r.card_tag_id !== cardId || visitState_(r, nowMs) === 'ended') return;
        var s = Date.parse(r.usable_from || '') || 0, e = Date.parse(r.usable_to || '');
        if (s < win.endMs && win.startMs < e) busy = root;
      });
      if (busy) throw err_('CARD_IN_USE', 'That card already has a visit at that time. End it first or choose another card.', { duplicate_of: busy });
    } else if (!salt) throw err_('NOT_SET_UP', 'Run adminSetup first.');

    var linkId = newId_('ilk', now), codeId = cardId ? '' : newCodeId_(), fromDay = todayLondon_(now);   // rows start the day given; the window itself gates use
    store_appendMany_(INSPECT.SUBJECT_FILE, INSPECT.SUBJECT_COLUMNS, subjects.map(function (s, i) {
      return [linkId + '-s' + (i + 1), tenant, linkId, s, '', ''];
    }), S);
    store_appendMany_(INSPECT.FIELD_FILE, INSPECT.FIELD_COLUMNS, fieldRows.map(function (r, i) {
      return [linkId + '-f' + (i + 1), tenant, linkId, r[0], r[1], r[2]];
    }), F);
    store_appendMany_(INSPECT.SCOPE_FILE, INSPECT.SCOPE_COLUMNS, lists.map(function (k, i) {
      return [linkId + '-c' + (i + 1), tenant, linkId, k, 'record', '', '', fromDay, ''];
    }), SC);
    var rightRows = [];
    rights.forEach(function (r) { if (r !== 'record') rightRows.push([r, '', '']); });
    jobs.forEach(function (j) { rightRows.push(['record', j, counts.indexOf(j) >= 0 ? 'true' : 'false']); });
    store_appendMany_(INSPECT.RIGHT_FILE, INSPECT.RIGHT_COLUMNS, rightRows.map(function (r, i) {
      return [linkId + '-r' + (i + 1), tenant, linkId, r[0], r[1], r[2], fromDay, ''];
    }), RT);
    var label = name + (org ? ' - ' + org : '');
    var lv = { id: linkId, tenant_id: tenant, code_id: codeId, label: label, ends: todayLondon_(new Date(win.endMs)), made_at: londonIso_(now),
      made_by: who.who, usable_from: win.starts_at, usable_to: win.ends_at, supersedes_id: '', grant_type_id: typeId, person_id: personId,
      visitor_name: name, organisation: org, card_tag_id: cardId, as_of_from: dFrom, as_of_to: dTo, purpose_text: purpose,
      grant_basis: basis, identity_assurance: assurance, retention_until: keep, email_code: '',
      issued_by: deleg ? who.id : 'owner', delegation_id: deleg ? deleg.row.id : '' };
    store_appendMany_(INSPECT.LINK_FILE, L.header, [L.header.map(function (h) { return lv[h] == null ? '' : lv[h]; })], L);
    var out = { status: 'saved', grant_id: linkId, person_id: personId, usable_from: win.starts_at, usable_to: win.ends_at, dogs: subjects.length,
      fields: fieldRows.length, email_sent: false };
    if (!cardId) {
      var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', raw = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), code = '';
      for (var i = 0; i < 16; i++) code += alphabet.charAt(parseInt(raw.substr(i * 2, 2), 16) % alphabet.length);
      var reg = registry_();
      reg[hashCode_(code, salt)] = { id: codeId, who: 'Visitor - ' + label, role: ROLE_INSPECTOR, active: true, added: londonIso_(now),
        starts_at: win.starts_at, expires_at: win.ends_at, link_id: linkId };
      setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));   // the link works from this line on
      var page = inspectPageUrl_(), sid = inspectScriptId_();
      out.code = code;
      out.url = page && sid ? page + '#s=' + sid + '&c=' + code : '';
    }
    out.logged = visitEvent_(now, who, 'visit_given', linkId, (cardId ? 'card ' + cardId : 'link') + (deleg ? ' under ' + deleg.row.id : '') + ': ' + purpose);
    return out;
  }, true);
}

/** A holder's visit must sit inside their delegation: type, rights, lists, fields, jobs. Throws INVALID naming what is wider. */
function visitWithin_(lim, type, rights, lists, fieldRows, jobs) {
  var wider = {};
  if (lim.grant_type_ids !== null) {
    var keys = visitMine_(visitRead_(VISIT_.TYPE_FILE, VISIT_.TYPE_COLUMNS)).filter(function (r) { return lim.grant_type_ids.indexOf(r.id) >= 0; }).map(function (r) { return r.type_key; });
    if (keys.indexOf(type.type_key) < 0) wider.grant_type_id = 'You may not give this kind of visit.';
  }
  if (lim.rights !== null && rights.some(function (x) { return lim.rights.indexOf(x) < 0; })) wider.rights = 'You may not give some of these rights.';
  if (lim.lists !== null && lists.some(function (x) { return lim.lists.indexOf(x) < 0; })) wider.fields = 'You may not show some of these lists.';
  if (lim.fields !== null && fieldRows.some(function (r) { return !delegFieldOk_(lim.fields, r[0] + '.' + r[1] + (r[2] ? ':last4' : '')); })) wider.fields = 'You may not show some of these fields.';
  if (jobs.length && lim.rights !== null && lim.rights.indexOf('record') < 0) wider.record_jobs = 'You may not let visitors record.';
  if (Object.keys(wider).length) throw err_('INVALID', 'You cannot give more than you hold.', { fields: wider });
}

/** A holder's dogs: inside subject_ids and (by their room now) area_ids. "All dogs" means all the dogs they may give. */
function visitDogsWithin_(lim, subjects, all, tenant, bad) {
  var inArea = null;
  if (lim.area_ids !== null) {
    var occ = store_read_(TABLES.occupancy.file, true).records.filter(function (r) { return r.tenant_id === tenant; });
    inArea = function (s) { var at = occupancyLatest_(occ, s); return !!at && lim.area_ids.indexOf(at.area_id) >= 0; };
  }
  var ok = function (s) { return (lim.subject_ids === null || lim.subject_ids.indexOf(s) >= 0) && (!inArea || inArea(s)); };
  if (all) return subjects.filter(ok);
  if (!subjects.every(ok)) throw bad('subject_ids', 'You may not show some of these dogs.');
  return subjects;
}

/** The grant's root and current rows, or throws NOT_FOUND. */
function visitCurrentRow_(L, rootId) {
  var tenant = prop_(BLD.PROP.TENANT_ID);
  var root = L.records.filter(function (r) { return r.id === rootId && r.tenant_id === tenant && !r.supersedes_id; })[0];
  if (!root) throw err_('NOT_FOUND', 'That visit was not found.');
  return { root: root, cur: linkCurrent_(L.records, tenant)[rootId] || root };
}

function sinkVisitEnd_(req) {
  return sinkVisitOwner_(req, function (f, who, now, deleg) {
    var errors = {}, linkId = String(f.grant_id || '').trim(), reason = visitReason_(f, errors, true);
    if (!ID_RE_.test(linkId)) errors.grant_id = 'Say which visit to end.';
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });
    var L = visitLinkRead_(), g = visitCurrentRow_(L, linkId);
    if (visitState_(g.cur, now.getTime()) === 'ended') throw err_('ALREADY_ENDED', 'That visit has already ended.');
    if (deleg && g.root.issued_by !== who.id && !deleg.limits.end_others) throw err_('NOT_ALLOWED', 'You can only end visits you gave.');
    if (g.root.code_id) {
      try { revokeCodeCore_(g.root.code_id, who.who, reason); }
      catch (e) { if (!e || e.code !== 'ALREADY_REVOKED') throw e; }
    }
    var at = londonIso_(now);
    linkSupersede_(visitLinkRead_(), linkId, { ended_at: at, ended_by: who.who, end_reason: reason }, now);
    return { status: 'saved', grant_id: linkId, ended_at: at, logged: visitEvent_(now, who, 'visit_ended', linkId, reason) };
  }, true);
}

function sinkVisitExtend_(req) {
  return sinkVisitOwner_(req, function (f, who, now, deleg) {
    var errors = {}, linkId = String(f.grant_id || '').trim(), reason = visitReason_(f, errors, true);
    if (!ID_RE_.test(linkId)) errors.grant_id = 'Say which visit to change.';
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });
    var bad = function (field, msg) { var e = {}; e[field] = msg; return err_('INVALID', msg, { fields: e }); };
    var L = visitLinkRead_(), g = visitCurrentRow_(L, linkId), rec = g.cur, nowMs = now.getTime();
    if (visitState_(rec, nowMs) === 'ended') throw err_('ALREADY_ENDED', 'That visit has already ended. Give a new one.');
    if (deleg && g.root.issued_by !== who.id && !deleg.limits.extend_others) throw err_('NOT_ALLOWED', 'You can only change visits you gave.');
    var startMs = Date.parse(rec.usable_from || g.root.made_at || ''), endMs, H = 3600000;
    if (f.hours !== undefined && f.hours !== null && f.hours !== '') {
      var n = Number(f.hours);
      if (!(n > 0) || n > 100000) throw bad('hours', 'Choose how many hours.');
      endMs = Math.max(nowMs, startMs) + Math.round(n * H);
    } else {
      endMs = externalMs_(f.usable_to);
      if (isNaN(endMs)) throw bad('usable_to', 'Choose the date and time it ends.');
    }
    if (endMs <= nowMs || endMs <= startMs) throw bad('usable_to', 'The end must be later than now and the start.');
    var type = rec.grant_type_id ? visitTypeById_(rec.grant_type_id) : null;
    var role = (type && type.role_code) || ROLE_INSPECTOR;
    var tmax = type && Number(type.max_hours) > 0 ? Number(type.max_hours) : null;
    if (deleg && deleg.limits.max_hours !== null && (tmax === null || deleg.limits.max_hours < tmax)) tmax = deleg.limits.max_hours;
    if (deleg && deleg.limits.to_ms !== null && endMs > deleg.limits.to_ms) throw bad('usable_to', 'Your permission ends sooner than that.');
    var max = externalMax_(role, todayLondon_(now), tmax);
    if (max !== null && endMs - startMs > Math.round(max * H) + 60000) throw bad('usable_to', 'This can last ' + max + ' hours at most.');
    var endsAt = londonIso_(new Date(endMs));
    if (g.root.code_id) {
      var reg = registry_(), h, hit = false;
      for (h in reg) if (Object.prototype.hasOwnProperty.call(reg, h) && reg[h].id === g.root.code_id) { reg[h].expires_at = endsAt; hit = true; }
      if (!hit) throw err_('NOT_FOUND', 'That visit\'s code was not found.');
      setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));
    }
    var row = linkSupersede_(L, linkId, { usable_to: endsAt, ends: todayLondon_(new Date(endMs)) }, now);
    return { status: 'saved', grant_id: row.id, root_id: linkId, usable_to: endsAt, logged: visitEvent_(now, who, 'visit_extended', linkId, 'to ' + endsAt + ': ' + reason) };
  }, true);
}

/* ---------------------------------------------------------------------------------------------------------------
 * Part C: a visitor opens a visit with a link code (c) or a printed card's tag (t). No staff code.
 *   - grant_open says whether the visit is live, opens later, has ended, or (a card) is free. A free or ended visit
 *     shows nothing else. A wrong code or tag counts toward the same lock-out as a wrong staff code.
 *   - read with t: a card visit reads exactly as a link visit does (its own rows), only while live; outside its window
 *     the answer is WINDOW. A scan opens a page; it never proves anyone was there.
 * --------------------------------------------------------------------------------------------------------------- */
var CARD_TAG_RE_ = /^vc[a-z2-9]{26}$/;

function visitBadTag_() {
  authNoteFailure_();
  return err_('BAD_CODE', 'That card or link was not recognised.');
}

/** The card's qr_tag row for a scanned tag, or throws BAD_CODE. */
function visitCard_(t) {
  if (authBlocked_()) throw err_('TOO_MANY_TRIES', 'Too many wrong codes recently. Try again in a few minutes.');
  t = String(t || '').trim();
  if (!CARD_TAG_RE_.test(t)) throw visitBadTag_();
  var tags = store_read_(VISIT_.TAG_FILE, false);
  if (!tags) throw visitBadTag_();
  var hash = visitCardHash_(t);
  var card = visitMine_(tags).filter(function (r) { return r.kind === VISIT_.CARD_KIND && r.tag === hash && r.active === 'true'; })[0];
  if (!card) throw visitBadTag_();
  return card;
}

/** The card's live grant, else the next to open, else null: {root, cur}. */
function visitForCard_(L, cardId, nowMs) {
  var tenant = prop_(BLD.PROP.TENANT_ID), cur = linkCurrent_(L.records, tenant), live = null, next = null;
  Object.keys(cur).forEach(function (root) {
    var r = cur[root];
    if (r.card_tag_id !== cardId) return;
    var st = visitState_(r, nowMs);
    if (st === 'live') live = { root: root, cur: r };
    else if (st === 'opens' && (!next || String(r.usable_from) < String(next.cur.usable_from))) next = { root: root, cur: r };
  });
  return live || next;
}

/** For a read with t: the visitor as sinkRead_ needs it, only while the card's visit is live. */
function visitCardWho_(t, now) {
  var card = visitCard_(t), L = inspectRead_(INSPECT.LINK_FILE), nowMs = now.getTime();
  var g = visitForCard_(L, card.id, nowMs);
  if (!g) throw err_('WINDOW', 'This card has no visit right now.');
  if (visitState_(g.cur, nowMs) !== 'live') throw err_('WINDOW', 'This card opens ' + externalShow_(g.cur.usable_from) + '.');
  return { who: 'Visitor - ' + g.cur.label, role: ROLE_INSPECTOR, id: 'card:' + card.id, link_id: g.root, ends: g.cur.usable_to || '', card: true };
}

/** check_type rows in force today for these type_keys, picked columns only. */
function visitJobs_(keys, today) {
  if (!keys.length) return [];
  var ct = store_read_('BLD-check_type.csv', false);
  if (!ct) return [];
  var rows = visitMine_(ct), want = ['type_key', 'label', 'target', 'asks_item', 'item_label', 'asks_amount', 'amount_unit', 'note_label',
    'note_required', 'asks_outcome', 'group', 'sop', 'evidence'];
  var out = [];
  keys.forEach(function (k) {
    var r = visitTypeInForce_(rows, k, today);
    if (!r || String(r.active) === 'false') return;
    var o = { id: r.id };
    want.forEach(function (c) { if (ct.header.indexOf(c) >= 0) o[c] = String(r[c] == null ? '' : r[c]); });
    out.push(o);
  });
  return out;
}

/** Review words: BLD-status_label rows in group 'review', each with a level green / amber / red (none fixed here). */
function visitReviewWords_() {
  var sl = store_read_('BLD-status_label.csv', false);
  if (!sl || sl.header.indexOf('group') < 0) return [];
  return sl.records.filter(function (r) { return r.group === 'review' && r.code; }).map(function (r) {
    return { id: r.code, label: r.label || r.code, level: String(r.level || '') };
  });
}

function sinkVisitOpen_(req) {
  if (!req || typeof req !== 'object') throw err_('BAD_REQUEST', 'That request was not understood.');
  if (!readEnabled_()) throw err_('READ_OFF', 'Reading from the records is switched off.');
  if (!visitOn_()) throw err_('TABLE_OFF', 'Visits are switched off.');
  var f = req.fields && typeof req.fields === 'object' ? req.fields : req;
  var now = new Date(), nowMs = now.getTime(), L = inspectRead_(INSPECT.LINK_FILE), tenant = prop_(BLD.PROP.TENANT_ID), g = null, off = false;
  if (f.t) {
    var card = visitCard_(f.t);
    g = visitForCard_(L, card.id, nowMs);
    if (!g) return { state: 'free' };
  } else {
    if (authBlocked_()) throw err_('TOO_MANY_TRIES', 'Too many wrong codes recently. Try again in a few minutes.');
    var c = String(f.c || '').trim(), salt = prop_(BLD.PROP.SALT);
    if (!c || !salt) throw visitBadTag_();
    var entry = registry_()[hashCode_(c, salt)];
    if (!entry || entry.role !== ROLE_INSPECTOR || !entry.link_id) throw visitBadTag_();
    off = entry.active === false || !!entry.revoked_at;
    var cur = linkCurrent_(L.records, tenant)[entry.link_id];
    if (!cur) throw visitBadTag_();
    g = { root: entry.link_id, cur: cur };
  }
  var r = g.cur, state = off ? 'ended' : visitState_(r, nowMs);
  if (state === 'ended') return { state: 'ended' };
  var grant = visitGrant_(g.root, todayLondon_(now));
  return {
    state: state, grant_id: g.root, usable_from: r.usable_from || r.made_at, usable_to: r.usable_to || inspectEndOfDay_(r.ends),
    who: r.visitor_name || r.label, org: r.organisation || '', rights: grant.rights, lists: grant.lists,
    record_jobs: grant.rights.indexOf('record') >= 0 ? visitJobs_(Object.keys(grant.jobs), todayLondon_(now)) : [],
    review_words: grant.rights.indexOf('raise_finding') >= 0 ? visitReviewWords_() : []
  };
}

/* ---------------------------------------------------------------------------------------------------------------
 * Part D: a visitor reviews (right raise_finding) or records (right record), only while live and only if granted.
 *   - grant_review adds one BLD-finding row (finding_kind review). outcome_id is a review word: a BLD-status_label code
 *     in group 'review'. target_table is one of the visit's lists; target_id (optional) must be a row of a dog on it.
 *     A finding is never edited; the owner's reply will be a finding_response row (later).
 *   - grant_record adds one check_log row through the ordinary staff-check path (same checks, same repeat guard), for a
 *     job the visit has a 'record' right row for. taken_by is always 'grant:<root id>'; grant_id names the grant and
 *     counts_due is copied from that right row at save time. The jobs screen counts it only when true (due.js).
 * --------------------------------------------------------------------------------------------------------------- */

/** The visitor, their grant's root id and current row, and its rights, from a link code (code) or a card tag (t). */
function visitLive_(req, now) {
  var who = req.t ? visitCardWho_(req.t, now) : authStaff_(req.code);
  if (who.role !== ROLE_INSPECTOR || !who.link_id) throw err_('NOT_ALLOWED', 'Only a visitor can do this.');
  var cur = linkCurrent_(inspectRead_(INSPECT.LINK_FILE).records, prop_(BLD.PROP.TENANT_ID))[who.link_id];
  if (!cur || visitState_(cur, now.getTime()) !== 'live') throw err_('WINDOW', 'This visit is not open now.');
  return { who: who, root: who.link_id, link: cur, grant: visitGrant_(who.link_id, todayLondon_(now)) };
}

function sinkVisitorAct_(req, right, fn) {
  if (!saveEnabled_()) throw err_('SAVE_OFF', 'Saving is switched off.');
  if (!req || typeof req !== 'object') throw err_('BAD_REQUEST', 'That request was not understood.');
  if (!visitOn_()) throw err_('TABLE_OFF', 'Visits are switched off.');
  var rid = String(req.request_id || '');
  if (!/^[A-Za-z0-9_\-]{8,64}$/.test(rid)) throw err_('BAD_REQUEST', 'The request had no valid reference.');
  var now = new Date(), v = visitLive_(req, now);
  if (v.grant.rights.indexOf(right) < 0) throw err_('NOT_ALLOWED', 'This visit does not include that.');
  var cache = CacheService.getScriptCache(), cached = cache.get('rid:' + rid);
  if (cached) { var again = JSON.parse(cached); again.repeat = true; return again; }
  var f = req.fields && typeof req.fields === 'object' ? req.fields : {};
  var result = withLock_(function () { return fn(f, v, now); });
  cache.put('rid:' + rid, JSON.stringify(result), BLD.LIMITS.REQUEST_CACHE_SEC);
  return result;
}

function sinkVisitReview_(req) {
  return sinkVisitorAct_(req, 'raise_finding', function (f, v, now) {
    var errors = {}, tenant = prop_(BLD.PROP.TENANT_ID), lists = v.grant.lists;
    var table = String(f.target_table || '').trim(), target = String(f.target_id || '').trim();
    if (lists.indexOf(table) < 0) errors.target_table = 'Choose one of the lists on this visit.';
    if (target && !ID_RE_.test(target)) errors.target_id = 'That row was not understood.';
    var word = String(f.outcome_id || '').trim(), words = visitReviewWords_();
    if (!words.some(function (w) { return w.id === word; })) errors.outcome_id = words.length ? 'Choose one of the review words.' : 'No review words are set up yet.';
    var note = dogcardText_(f.note, 'note', errors, BLD.LIMITS.MAX_TEXT_CHARS);
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });
    if (target) {
      var dogs = {};
      inspectRead_(INSPECT.SUBJECT_FILE).records.forEach(function (r) { if (r.tenant_id === tenant && r.link_id === v.root) dogs[r.subject_id] = true; });
      var data = store_read_(READABLE[table].file, false), col = INSPECT.LISTS[table];
      var row = data && data.records.filter(function (r) { return r.id === target && (!r.tenant_id || r.tenant_id === tenant); })[0];
      if (!row || !dogs[row[col]]) throw err_('NOT_FOUND', 'That row is not on this visit.');
    }
    visitRead_(VISIT_.FINDING_FILE, VISIT_.FINDING_NEED);
    var id = dogcardAppend_({ file: VISIT_.FINDING_FILE, idPrefix: 'fnd', need: VISIT_.FINDING_NEED }, {
      authority: v.link.organisation || v.link.visitor_name || v.link.label, raised_on: todayLondon_(now), wording_as_given: note,
      finding_kind: 'review', outcome_id: word, target_table: table, target_id: target, sign_in_id: '', raised_at: londonIso_(now),
      grant_id: v.root
    });
    var level = (words.filter(function (w) { return w.id === word; })[0] || {}).level;
    if (level === 'amber' || level === 'red') visitEvent_(now, { who: 'grant:' + v.root, role: ROLE_INSPECTOR }, 'review_' + level, v.root, word + (note ? ': ' + note : ''));
    return { status: 'saved', id: id };
  });
}

function sinkVisitRecord_(req) {
  return sinkVisitorAct_(req, 'record', function (f, v, now) {
    var spec = TABLES.check_log;
    if (!tableOn_(spec)) throw err_('TABLE_OFF', 'Saving to ' + spec.file + ' is switched off.');
    var tenant = prop_(BLD.PROP.TENANT_ID);
    var typeRow = store_read_(TABLES.check_type.file, true).records.filter(function (r) { return r.id === String(f.check_type_id || '') && r.tenant_id === tenant; })[0];
    if (!typeRow || !Object.prototype.hasOwnProperty.call(v.grant.jobs, typeRow.type_key)) throw err_('NOT_ALLOWED', 'This visit cannot record that job.');
    var fields = {};
    Object.keys(spec.input).forEach(function (k) { if (f[k] !== undefined) fields[k] = f[k]; });
    var who = { who: 'grant:' + v.root, role: ROLE_INSPECTOR, id: '' };
    var counts = v.grant.jobs[typeRow.type_key];
    // the same spec, stamped with the visit and whether it counts as done (as granted now; later changes do not alter it)
    var vspec = Object.create(spec);
    vspec.stamp = function (row, ctx) { spec.stamp(row, ctx); row.grant_id = v.root; row.counts_due = counts ? 'true' : 'false'; };
    var out = sinkProcess_(vspec, { action: 'add', fields: fields, values: f.values }, who, now, now.getTime());
    out.who = v.link.visitor_name || v.link.label;
    return out;
  });
}
