/* ---------------------------------------------------------------------------------------------------------------
 * VISITS (external access, V9, 13 Nov 2026; API agreed with ADMIN in AA_VISIT-API_2026-11-13-2034 + STAFF reply 2055).
 * Part A: the owner's visit types and visitor cards. Both OWNER code only, behind one switch TABLE_ON_visit (OFF).
 *
 *   action 'visit_type_save'  Adds one BLD-visit_type row. A type is never changed in place: the same type_key again is
 *                             a new version with a later (or same-day, later-saved) effective_from. Nothing is fixed here:
 *                             the hub offers suggested rows for the owner to save or change.
 *   action 'card_add'         Adds one BLD-qr_tag row of kind visitor_card. The card's tag is random (about 128 bits) and
 *                             is returned ONCE for printing. The file keeps only 'sha256:<hex>' of it, so anyone who can
 *                             read qr_tag cannot use a card. A scan only opens a page; it never proves anyone was there.
 * --------------------------------------------------------------------------------------------------------------- */
var VISIT_ = {
  ON: 'visit',
  TYPE_FILE: 'BLD-visit_type.csv',
  TYPE_COLUMNS: ['id', 'tenant_id', 'type_key', 'name', 'role_code', 'default_hours', 'max_hours', 'rights', 'lists', 'fields',
    'data_years', 'record_jobs', 'record_counts', 'email_code', 'needs_id_check', 'terms_id', 'active', 'effective_from',
    'set_at', 'set_by', 'source'],
  TAG_FILE: 'BLD-qr_tag.csv',
  TAG_NEED: ['id', 'tenant_id', 'tag', 'kind', 'ref_id', 'active', 'made_at', 'made_by'],
  CARD_KIND: 'visitor_card',
  FINDING_FILE: 'BLD-finding.csv',
  // the live finding columns a review fills, plus the six V9 appends; other columns are left blank, found by name
  FINDING_NEED: ['id', 'tenant_id', 'authority', 'raised_on', 'wording_as_given', 'finding_kind', 'outcome_id',
    'target_table', 'target_id', 'sign_in_id', 'raised_at', 'replies_to_id', 'visit_id'],
  // the rights this script can carry out; which ones a visit gets is the owner's choice per type and per visit
  RIGHTS: ['view', 'review', 'print', 'export', 'record'],
  KEY_RE: /^[a-z][a-z0-9_]{1,39}$/,
  JOB_RE: /^[a-z0-9][a-z0-9_.\-]{0,59}$/,
  FIELD_RE: /^([a-z][a-z0-9_]{0,39})\.([a-z][a-z0-9_]{0,59})(:last4)?$/,
  ROLE_RE: /^[A-Z][A-Z_]{1,29}$/
};

function visitOn_() { return prop_(BLD.PROP.TABLE_ON_PREFIX + VISIT_.ON) === 'true'; }
function visitFiles_() { return visitOn_() ? [VISIT_.TYPE_FILE, VISIT_.FINDING_FILE] : []; }

/** Shared entry for OWNER visit actions: switches, owner code, repeat-tap guard, one lock. */
function sinkVisitOwner_(req, fn) {
  if (!saveEnabled_()) throw err_('SAVE_OFF', 'Saving is switched off.');
  if (!req || typeof req !== 'object') throw err_('BAD_REQUEST', 'That request was not understood.');
  if (!visitOn_()) throw err_('TABLE_OFF', 'Visits are switched off.');
  var rid = String(req.request_id || '');
  if (!/^[A-Za-z0-9_\-]{8,64}$/.test(rid)) throw err_('BAD_REQUEST', 'The request had no valid reference.');
  var who = authStaff_(req.code);
  if (who.role !== 'OWNER') throw err_('NOT_ALLOWED', 'Only the kennel owner can do this.');
  var cache = CacheService.getScriptCache(), cached = cache.get('rid:' + rid);
  if (cached) { var again = JSON.parse(cached); again.repeat = true; return again; }
  var f = req.fields && typeof req.fields === 'object' ? req.fields : {};
  var result = withLock_(function () { return fn(f, who, new Date()); });
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

/** The visit type version in force on `day` for a type_key (latest effective_from <= day, then latest set_at). */
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
    var rights = visitList_(f.rights, function (s) { return VISIT_.RIGHTS.indexOf(s) >= 0; });
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
    var active = String(f.active == null ? 'true' : f.active).trim() || 'true';
    if (['true', 'false'].indexOf(active) < 0) errors.active = 'Yes or no.';
    var from = String(f.effective_from || '').trim() || today;
    if (!isRealDate_(from)) errors.effective_from = 'Use a real date as YYYY-MM-DD.';
    var source = dogcardText_(f.source, 'source', errors, 200);
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });
    var read = visitRead_(VISIT_.TYPE_FILE, VISIT_.TYPE_COLUMNS), mine = visitMine_(read);
    var latest = '';
    mine.forEach(function (r) { if (r.type_key === key && String(r.effective_from) > latest) latest = String(r.effective_from); });
    if (latest && from < latest) throw err_('INVALID', 'Please check the highlighted fields.', { fields: { effective_from: 'A newer version already starts ' + latest + '. Start this one on or after that.' } });
    var id = dogcardAppend_({ file: VISIT_.TYPE_FILE, idPrefix: 'vty', need: VISIT_.TYPE_COLUMNS }, {
      type_key: key, name: name, role_code: role, default_hours: dh, max_hours: mh, rights: rights.join('|'), lists: lists.join('|'),
      fields: fields.join('|'), data_years: years ? String(+years) : '', record_jobs: jobs.join('|'), record_counts: counts.join('|'),
      email_code: email === 'true' ? 'true' : '', needs_id_check: '', terms_id: '', active: active, effective_from: from,
      set_at: londonIso_(now), set_by: who.who, source: source || ('CD Hub, ' + who.who + ', ' + today)
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
 * Part B: give, end and extend a visit. A visit is one BLD-inspect_link row (V9 header) plus its dog rows and field rows.
 *   - A LINK visit gets a fresh code (registry role INSPECTOR, so it can only read what its own rows allow, never save
 *     through the staff path). The code is returned ONCE with the page url; it is never logged or stored.
 *   - A CARD visit gets no code: the printed card's tag opens it while its window is live (part C).
 *   - What the visit got (rights, lists, jobs) is copied onto the link row, so the history keeps what was granted.
 *   - Ending fills ended_at / ended_by / end_reason; ends_at keeps the planned end. Nothing is deleted.
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

/** A visit's live state from its link row: 'ended' (ended early or past its end), 'opens' (not yet) or 'live'. */
function visitState_(r, nowMs) {
  if (String(r.ended_at || '')) return 'ended';
  var end = Date.parse(r.ends_at || '') || Date.parse(inspectEndOfDay_(String(r.ends || '')));
  if (isNaN(end) || nowMs >= end) return 'ended';
  var start = Date.parse(r.starts_at || '');
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
      role: 'OWNER', kind: 'visit', row_id: linkId, note: String(note || '').slice(0, 200), result: kind });
    return true;
  } catch (e) { Logger.log('Visit ' + kind + ' ' + linkId + ' not logged: ' + (e && e.message)); return false; }
}

function visitReason_(f, errors, need) {
  var r = dogcardText_(f.reason, 'reason', errors, 200);
  if (need && !r && !errors.reason) errors.reason = 'Say briefly why.';
  return r;
}

function sinkVisitGive_(req) {
  return sinkVisitOwner_(req, function (f, who, now) {
    var errors = {}, bad = function (field, msg) { var e = {}; e[field] = msg; return err_('INVALID', msg, { fields: e }); };
    var tenant = prop_(BLD.PROP.TENANT_ID), salt = prop_(BLD.PROP.SALT);
    if (!tenant) throw err_('NOT_CONFIGURED', 'The tenant id has not been set up in the script (TENANT_ID).');
    var typeId = String(f.visit_type_id || '').trim();
    if (!ID_RE_.test(typeId)) throw bad('visit_type_id', 'Choose the kind of visit.');
    var type = visitTypeById_(typeId);
    if (!type) throw err_('NOT_FOUND', 'That visit type was not found. Reload the page.');
    if (type.active !== 'true') throw bad('visit_type_id', 'That visit type is switched off.');
    var role = type.role_code || ROLE_INSPECTOR;

    var personId = String(f.person_id || '').trim(), name = dogcardText_(f.person_name, 'person_name', errors, 80);
    var org = dogcardText_(f.organisation, 'organisation', errors, 80);
    if (personId && !ID_RE_.test(personId)) errors.person_id = 'Choose the person from the list.';
    if (!name && !errors.person_name) errors.person_name = 'Type the visitor\'s name.';
    var cardId = String(f.card_tag_id || '').trim();
    if (cardId && !ID_RE_.test(cardId)) errors.card_tag_id = 'Choose a card from the list.';
    var reason = visitReason_(f, errors, false);
    var arr = function (k) { return Array.isArray(f[k]) ? f[k] : String(f[k] == null ? '' : f[k]).split('|'); };
    var rights = visitList_(arr('rights'), function (s) { return VISIT_.RIGHTS.indexOf(s) >= 0; });
    if (!rights || rights.indexOf('view') < 0) errors.rights = 'A visit always includes view.';
    var jobs = visitList_(arr('record_jobs'), function (s) { return VISIT_.JOB_RE.test(s); });
    var counts = visitList_(arr('record_counts'), function (s) { return VISIT_.JOB_RE.test(s); });
    if (!jobs) errors.record_jobs = 'Choose the jobs from the page.';
    else if (jobs.length && rights && rights.indexOf('record') < 0) errors.record_jobs = 'Tick record to let this visitor record jobs.';
    if (!counts || (jobs && counts.some(function (c) { return jobs.indexOf(c) < 0; }))) errors.record_counts = 'Only jobs the visitor may record can count.';
    var dFrom = String(f.data_from_date || '').trim(), dTo = String(f.data_to_date || '').trim();
    if (dFrom && !isRealDate_(dFrom)) errors.data_from_date = 'Use a real date as YYYY-MM-DD.';
    if (dTo && !isRealDate_(dTo)) errors.data_to_date = 'Use a real date as YYYY-MM-DD.';
    if (dFrom && dTo && !errors.data_from_date && !errors.data_to_date && dTo < dFrom) errors.data_to_date = 'The end cannot be before the start.';
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });

    var fieldRows = visitFieldRows_(visitList_(arr('fields'), function (s) { return VISIT_.FIELD_RE.test(s); }, 500) || ['?'], bad);
    var lists = [];
    fieldRows.forEach(function (r) { if (lists.indexOf(r[0]) < 0) lists.push(r[0]); });
    var win = externalWindow_({ hours: f.hours, starts_at: f.starts_at, ends_at: f.ends_at }, role, now, bad,
      { default_hours: Number(type.default_hours), max_hours: Number(type.max_hours) });

    var subj = store_read_(READABLE.subject.file, true), known = {}, all = [];
    subj.records.forEach(function (r) { if (!r.tenant_id || r.tenant_id === tenant) { known[r.id] = true; all.push(r.id); } });
    var subjects = visitList_(arr('subject_ids'), function (s) { return ID_RE_.test(s) && known[s]; }, INSPECT.MAX_DOGS);
    if (!subjects) throw bad('subject_ids', 'One of the ticked dogs was not found. Reload the page.');
    if (!subjects.length) subjects = all;
    if (!subjects.length) throw bad('subject_ids', 'There are no dogs to show.');

    if (personId) {
      var people = store_read_('BLD-person.csv', false);
      if (!people || !people.records.some(function (r) { return r.id === personId && (!r.tenant_id || r.tenant_id === tenant); })) throw err_('NOT_FOUND', 'That person was not found.');
    }

    var L = visitLinkRead_(), S = inspectRead_(INSPECT.SUBJECT_FILE), F = inspectRead_(INSPECT.FIELD_FILE);
    inspectRead_(INSPECT.ACCESS_FILE);   // the visit log must exist before a visit can be opened
    if (cardId) {
      var tags = visitMine_(visitRead_(VISIT_.TAG_FILE, VISIT_.TAG_NEED));
      var card = tags.filter(function (r) { return r.id === cardId && r.kind === VISIT_.CARD_KIND; })[0];
      if (!card || card.active !== 'true') throw err_('NOT_FOUND', 'That card was not found or is switched off.');
      var fixed = String(card.fixed_type_id || '');
      if (fixed && fixed !== typeId) {
        var ft = visitTypeById_(fixed);
        if (!ft || ft.type_key !== type.type_key) throw bad('visit_type_id', 'This card is kept for another kind of visit.');
      }
      var nowMs = now.getTime();
      var busy = L.records.filter(function (r) {
        if (r.tenant_id !== tenant || r.card_tag_id !== cardId || visitState_(r, nowMs) === 'ended') return false;
        var s = Date.parse(r.starts_at || '') || 0, e = Date.parse(r.ends_at || '');
        return s < win.endMs && win.startMs < e;
      })[0];
      if (busy) throw err_('CARD_IN_USE', 'That card already has a visit at that time. End it first or choose another card.', { duplicate_of: busy.id });
    } else if (!salt) throw err_('NOT_SET_UP', 'Run adminSetup first.');

    var linkId = newId_('ilk', now), codeId = cardId ? '' : newCodeId_();
    store_appendMany_(INSPECT.SUBJECT_FILE, INSPECT.SUBJECT_COLUMNS, subjects.map(function (s, i) {
      return [linkId + '-s' + (i + 1), tenant, linkId, s, '', ''];
    }), S);
    store_appendMany_(INSPECT.FIELD_FILE, INSPECT.FIELD_COLUMNS, fieldRows.map(function (r, i) {
      return [linkId + '-f' + (i + 1), tenant, linkId, r[0], r[1], r[2]];
    }), F);
    var label = name + (org ? ' - ' + org : '');
    var lv = { id: linkId, tenant_id: tenant, code_id: codeId, label: label, ends: todayLondon_(new Date(win.endMs)), made_at: londonIso_(now),
      made_by: who.who, starts_at: win.starts_at, ends_at: win.ends_at, visit_type_id: typeId, person_id: personId, visitor_name: name,
      organisation: org, card_tag_id: cardId, rights: rights.join('|'), lists: lists.join('|'), record_jobs: jobs.join('|'),
      record_counts: counts.join('|'), data_from_date: dFrom, data_to_date: dTo, email_code: '' };
    store_appendMany_(INSPECT.LINK_FILE, L.header, [L.header.map(function (h) { return lv[h] == null ? '' : lv[h]; })], L);
    var out = { status: 'saved', link_id: linkId, person_id: personId, starts_at: win.starts_at, ends_at: win.ends_at, dogs: subjects.length,
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
    out.logged = visitEvent_(now, who, 'visit_given', linkId, (cardId ? 'card ' + cardId : 'link') + (reason ? ': ' + reason : ''));
    return out;
  });
}

/** The tenant's link row by id, with its index, or throws NOT_FOUND. */
function visitLinkRow_(L, linkId) {
  var tenant = prop_(BLD.PROP.TENANT_ID), idx = -1;
  L.records.forEach(function (r, i) { if (r.id === linkId && r.tenant_id === tenant) idx = i; });
  if (idx < 0) throw err_('NOT_FOUND', 'That visit was not found.');
  return idx;
}

function visitRewrite_(L, idx, changes) {
  var rec = L.records[idx];
  var row = L.header.map(function (h) { return Object.prototype.hasOwnProperty.call(changes, h) ? changes[h] : (rec[h] == null ? '' : String(rec[h])); });
  store_replaceRow_(INSPECT.LINK_FILE, L.header, idx, row, L);
}

function sinkVisitEnd_(req) {
  return sinkVisitOwner_(req, function (f, who, now) {
    var errors = {}, linkId = String(f.link_id || '').trim(), reason = visitReason_(f, errors, true);
    if (!ID_RE_.test(linkId)) errors.link_id = 'Say which visit to end.';
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });
    var L = visitLinkRead_(), idx = visitLinkRow_(L, linkId), rec = L.records[idx];
    if (visitState_(rec, now.getTime()) === 'ended') throw err_('ALREADY_ENDED', 'That visit has already ended.');
    if (rec.code_id) {
      try { revokeCodeCore_(rec.code_id, who.who, reason); }
      catch (e) { if (!e || e.code !== 'ALREADY_REVOKED') throw e; }
    }
    var at = londonIso_(now);
    visitRewrite_(L, idx, { ended_at: at, ended_by: who.who, end_reason: reason });
    return { status: 'saved', link_id: linkId, ended_at: at, logged: visitEvent_(now, who, 'visit_ended', linkId, reason) };
  });
}

function sinkVisitExtend_(req) {
  return sinkVisitOwner_(req, function (f, who, now) {
    var errors = {}, linkId = String(f.link_id || '').trim(), reason = visitReason_(f, errors, true);
    if (!ID_RE_.test(linkId)) errors.link_id = 'Say which visit to change.';
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });
    var bad = function (field, msg) { var e = {}; e[field] = msg; return err_('INVALID', msg, { fields: e }); };
    var L = visitLinkRead_(), idx = visitLinkRow_(L, linkId), rec = L.records[idx], nowMs = now.getTime();
    if (visitState_(rec, nowMs) === 'ended') throw err_('ALREADY_ENDED', 'That visit has already ended. Give a new one.');
    var startMs = Date.parse(rec.starts_at || rec.made_at || ''), endMs, H = 3600000;
    if (f.hours !== undefined && f.hours !== null && f.hours !== '') {
      var n = Number(f.hours);
      if (!(n > 0) || n > 100000) throw bad('hours', 'Choose how many hours.');
      endMs = Math.max(nowMs, startMs) + Math.round(n * H);
    } else {
      endMs = externalMs_(f.ends_at);
      if (isNaN(endMs)) throw bad('ends_at', 'Choose the date and time it ends.');
    }
    if (endMs <= nowMs || endMs <= startMs) throw bad('ends_at', 'The end must be later than now and the start.');
    var type = rec.visit_type_id ? visitTypeById_(rec.visit_type_id) : null;
    var role = (type && type.role_code) || ROLE_INSPECTOR;
    var max = externalMax_(role, todayLondon_(now), type ? Number(type.max_hours) : null);
    if (max !== null && endMs - startMs > Math.round(max * H) + 60000) throw bad('ends_at', 'This can last ' + max + ' hours at most.');
    var endsAt = londonIso_(new Date(endMs));
    if (rec.code_id) {
      var reg = registry_(), h, hit = false;
      for (h in reg) if (Object.prototype.hasOwnProperty.call(reg, h) && reg[h].id === rec.code_id) { reg[h].expires_at = endsAt; hit = true; }
      if (!hit) throw err_('NOT_FOUND', 'That visit\'s code was not found.');
      setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));
    }
    visitRewrite_(L, idx, { ends_at: endsAt, ends: todayLondon_(new Date(endMs)) });
    return { status: 'saved', link_id: linkId, ends_at: endsAt, logged: visitEvent_(now, who, 'visit_extended', linkId, 'to ' + endsAt + ': ' + reason) };
  });
}

/* ---------------------------------------------------------------------------------------------------------------
 * Part C: a visitor opens a visit with a link code (c) or a printed card's tag (t). No staff code.
 *   - visit_open says whether the visit is live, opens later, has ended, or (a card) is free. A free or ended visit
 *     shows nothing else. A wrong code or tag counts toward the same lock-out as a wrong staff code.
 *   - read with t: a card visit reads exactly as a link visit does (its own dog and field rows), only while live;
 *     outside its window the answer is WINDOW. A scan opens a page; it never proves anyone was there.
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

/** The card's live visit, else the next one to open, else null. */
function visitForCard_(L, cardId, nowMs) {
  var tenant = prop_(BLD.PROP.TENANT_ID), live = null, next = null;
  L.records.forEach(function (r) {
    if (r.tenant_id !== tenant || r.card_tag_id !== cardId) return;
    var st = visitState_(r, nowMs);
    if (st === 'live') live = r;
    else if (st === 'opens' && (!next || String(r.starts_at) < String(next.starts_at))) next = r;
  });
  return live || next;
}

/** For a read with t: the visitor as sinkRead_ needs it, only while the card's visit is live. */
function visitCardWho_(t, now) {
  var card = visitCard_(t), L = inspectRead_(INSPECT.LINK_FILE), nowMs = now.getTime();
  var r = visitForCard_(L, card.id, nowMs);
  if (!r) throw err_('WINDOW', 'This card has no visit right now.');
  if (visitState_(r, nowMs) !== 'live') throw err_('WINDOW', 'This card opens ' + externalShow_(r.starts_at) + '.');
  return { who: 'Visitor - ' + r.label, role: ROLE_INSPECTOR, id: 'card:' + card.id, link_id: r.id, ends: r.ends_at || '', card: true };
}

/** Rows of a file in force today by key (latest effective_from <= today, active), picked columns only. */
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

/** Review words: BLD-status_label rows in group 'review' (none until the owner adds them; nothing fixed here). */
function visitReviewWords_() {
  var sl = store_read_('BLD-status_label.csv', false);
  if (!sl || sl.header.indexOf('group') < 0) return [];
  return sl.records.filter(function (r) { return r.group === 'review' && r.code; }).map(function (r) {
    return { id: r.code, label: r.label || r.code, needs_action: String(r.needs_action) === 'true' };
  });
}

function sinkVisitOpen_(req) {
  if (!req || typeof req !== 'object') throw err_('BAD_REQUEST', 'That request was not understood.');
  if (!readEnabled_()) throw err_('READ_OFF', 'Reading from the records is switched off.');
  if (!visitOn_()) throw err_('TABLE_OFF', 'Visits are switched off.');
  var f = req.fields && typeof req.fields === 'object' ? req.fields : req;
  var now = new Date(), nowMs = now.getTime(), L = inspectRead_(INSPECT.LINK_FILE), tenant = prop_(BLD.PROP.TENANT_ID), r = null, off = false;
  if (f.t) {
    var card = visitCard_(f.t);
    r = visitForCard_(L, card.id, nowMs);
    if (!r) return { state: 'free' };
  } else {
    if (authBlocked_()) throw err_('TOO_MANY_TRIES', 'Too many wrong codes recently. Try again in a few minutes.');
    var c = String(f.c || '').trim(), salt = prop_(BLD.PROP.SALT);
    if (!c || !salt) throw visitBadTag_();
    var entry = registry_()[hashCode_(c, salt)];
    if (!entry || entry.role !== ROLE_INSPECTOR || !entry.link_id) throw visitBadTag_();
    off = entry.active === false || !!entry.revoked_at;
    r = L.records.filter(function (x) { return x.tenant_id === tenant && x.id === entry.link_id; })[0];
    if (!r) throw visitBadTag_();
  }
  var state = off ? 'ended' : visitState_(r, nowMs);
  if (state === 'ended') return { state: 'ended' };
  var split = function (v) { return String(v || '').split('|').filter(String); };
  var rights = r.rights ? split(r.rights) : ['view'];
  return {
    state: state, starts_at: r.starts_at || r.made_at, ends_at: r.ends_at || inspectEndOfDay_(r.ends), who: r.visitor_name || r.label,
    org: r.organisation || '', rights: rights, lists: split(r.lists),
    record_jobs: rights.indexOf('record') >= 0 ? visitJobs_(split(r.record_jobs), todayLondon_(now)) : [],
    review_words: rights.indexOf('review') >= 0 ? visitReviewWords_() : []
  };
}

/* ---------------------------------------------------------------------------------------------------------------
 * Part D: a visitor reviews or records, only while the visit is live and only if its rights allow.
 *   - visit_review adds one BLD-finding row (finding_kind review). outcome_id is a review word: a BLD-status_label code
 *     in group 'review'. target_table is one of the visit's lists; target_id (optional) must be a row of a dog on it.
 *   - visit_record adds one check_log row through the ordinary staff-check path (same checks, same repeat guard), for a
 *     job on the visit's record_jobs. taken_by is 'visit:<link id>', so a visitor's record is told apart without a new
 *     column; the jobs screen counts it only if the visit's record_counts lists that job (due.js, SOPJOBS).
 * --------------------------------------------------------------------------------------------------------------- */

/** The visitor and their live link row, from a link code (code) or a card tag (t). */
function visitLive_(req, now) {
  var who = req.t ? visitCardWho_(req.t, now) : authStaff_(req.code);
  if (who.role !== ROLE_INSPECTOR || !who.link_id) throw err_('NOT_ALLOWED', 'Only a visitor can do this.');
  var tenant = prop_(BLD.PROP.TENANT_ID);
  var link = inspectRead_(INSPECT.LINK_FILE).records.filter(function (r) { return r.tenant_id === tenant && r.id === who.link_id; })[0];
  if (!link || visitState_(link, now.getTime()) !== 'live') throw err_('WINDOW', 'This visit is not open now.');
  return { who: who, link: link, rights: String(link.rights || 'view').split('|') };
}

function sinkVisitorAct_(req, right, fn) {
  if (!saveEnabled_()) throw err_('SAVE_OFF', 'Saving is switched off.');
  if (!req || typeof req !== 'object') throw err_('BAD_REQUEST', 'That request was not understood.');
  if (!visitOn_()) throw err_('TABLE_OFF', 'Visits are switched off.');
  var rid = String(req.request_id || '');
  if (!/^[A-Za-z0-9_\-]{8,64}$/.test(rid)) throw err_('BAD_REQUEST', 'The request had no valid reference.');
  var now = new Date(), v = visitLive_(req, now);
  if (v.rights.indexOf(right) < 0) throw err_('NOT_ALLOWED', 'This visit does not include ' + right + '.');
  var cache = CacheService.getScriptCache(), cached = cache.get('rid:' + rid);
  if (cached) { var again = JSON.parse(cached); again.repeat = true; return again; }
  var f = req.fields && typeof req.fields === 'object' ? req.fields : {};
  var result = withLock_(function () { return fn(f, v, now); });
  cache.put('rid:' + rid, JSON.stringify(result), BLD.LIMITS.REQUEST_CACHE_SEC);
  return result;
}

function sinkVisitReview_(req) {
  return sinkVisitorAct_(req, 'review', function (f, v, now) {
    var errors = {}, tenant = prop_(BLD.PROP.TENANT_ID), lists = String(v.link.lists || '').split('|').filter(String);
    var table = String(f.target_table || '').trim(), target = String(f.target_id || '').trim();
    if (lists.indexOf(table) < 0) errors.target_table = 'Choose one of the lists on this visit.';
    if (target && !ID_RE_.test(target)) errors.target_id = 'That row was not understood.';
    var word = String(f.outcome_id || '').trim(), words = visitReviewWords_();
    if (!words.some(function (w) { return w.id === word; })) errors.outcome_id = words.length ? 'Choose one of the review words.' : 'No review words are set up yet.';
    var note = dogcardText_(f.note, 'note', errors, BLD.LIMITS.MAX_TEXT_CHARS);
    var reply = String(f.replies_to_id || '').trim();
    if (reply && !ID_RE_.test(reply)) errors.replies_to_id = 'That review was not found.';
    if (Object.keys(errors).length) throw err_('INVALID', 'Please check the highlighted fields.', { fields: errors });
    if (target) {
      var dogs = {};
      inspectRead_(INSPECT.SUBJECT_FILE).records.forEach(function (r) { if (r.tenant_id === tenant && r.link_id === v.link.id) dogs[r.subject_id] = true; });
      var data = store_read_(READABLE[table].file, false), col = INSPECT.LISTS[table];
      var row = data && data.records.filter(function (r) { return r.id === target && (!r.tenant_id || r.tenant_id === tenant); })[0];
      if (!row || !dogs[row[col]]) throw err_('NOT_FOUND', 'That row is not on this visit.');
    }
    var read = visitRead_(VISIT_.FINDING_FILE, VISIT_.FINDING_NEED);
    if (reply && !visitMine_(read).some(function (r) { return r.id === reply && r.visit_id === v.link.id; })) throw err_('NOT_FOUND', 'That review was not found on this visit.');
    var id = dogcardAppend_({ file: VISIT_.FINDING_FILE, idPrefix: 'fnd', need: VISIT_.FINDING_NEED }, {
      authority: v.link.organisation || v.link.visitor_name || v.link.label, raised_on: todayLondon_(now), wording_as_given: note,
      finding_kind: 'review', outcome_id: word, target_table: table, target_id: target, sign_in_id: '', raised_at: londonIso_(now),
      replies_to_id: reply, visit_id: v.link.id
    });
    return { status: 'saved', id: id };
  });
}

function sinkVisitRecord_(req) {
  return sinkVisitorAct_(req, 'record', function (f, v, now) {
    var spec = TABLES.check_log;
    if (!tableOn_(spec)) throw err_('TABLE_OFF', 'Saving to ' + spec.file + ' is switched off.');
    var jobs = String(v.link.record_jobs || '').split('|').filter(String), tenant = prop_(BLD.PROP.TENANT_ID);
    var typeRow = store_read_(TABLES.check_type.file, true).records.filter(function (r) { return r.id === String(f.check_type_id || '') && r.tenant_id === tenant; })[0];
    if (!typeRow || jobs.indexOf(typeRow.type_key) < 0) throw err_('NOT_ALLOWED', 'This visit cannot record that job.');
    var fields = {};
    Object.keys(spec.input).forEach(function (k) { if (f[k] !== undefined) fields[k] = f[k]; });
    var who = { who: 'visit:' + v.link.id, role: ROLE_INSPECTOR, id: '' };
    var out = sinkProcess_(spec, { action: 'add', fields: fields, values: f.values }, who, now, now.getTime());
    out.who = v.link.visitor_name || v.link.label;
    return out;
  });
}
