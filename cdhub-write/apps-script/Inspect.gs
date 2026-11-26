var ROLE_INSPECTOR = 'INSPECTOR';

var INSPECT = {
  LINK_FILE: 'BLD-inspect_link.csv',
  LINK_COLUMNS: ['id', 'tenant_id', 'code_id', 'label', 'ends', 'created_at', 'set_by', 'from_at', 'to_at', 'supersedes_id',
    'grant_type_id', 'person_id', 'visitor_name', 'organisation', 'sign_in_id', 'card_tag_id', 'as_of_from', 'as_of_to', 'purpose_text',
    'grant_basis', 'identity_assurance', 'id_checked_by', 'accompanied_by', 'retention_until', 'email_code', 'ended_at', 'ended_by',
    'end_reason', 'tz', 'issued_by', 'delegation_id', 'updated_at'],
  SCOPE_FILE: 'BLD-grant_scope.csv',
  SCOPE_COLUMNS: ['id', 'tenant_id', 'grant_id', 'scope_item_type', 'disclosure_state', 'depth_limit', 'withhold_basis', 'from_date', 'to_date',
    'source', 'set_by', 'set_on', 'created_at', 'updated_at'],
  DISCLOSURE_STATES: ['withheld', 'existing_only', 'summary', 'record', 'record_and_evidence'],
  RIGHT_FILE: 'BLD-grant_right_link.csv',
  RIGHT_COLUMNS: ['id', 'tenant_id', 'grant_id', 'right_code', 'scope_summary', 'counts_due', 'from_date', 'to_date', 'source', 'set_by',
    'set_on', 'created_at', 'updated_at'],
  LINK_COLUMNS_V1: ['id', 'tenant_id', 'code_id', 'label', 'ends', 'made_at', 'made_by'],
  SUBJECT_FILE: 'BLD-inspect_link_subject.csv',
  SUBJECT_COLUMNS: ['id', 'tenant_id', 'link_id', 'subject_id', 'from_date', 'to_date'],
  FIELD_FILE: 'BLD-inspect_link_field.csv',
  FIELD_COLUMNS: ['id', 'tenant_id', 'link_id', 'table_name', 'field_name', 'redaction'],
  ACCESS_FILE: 'BLD-inspect_access.csv',
  ACCESS_COLUMNS: ['id', 'tenant_id', 'link_id', 'code_id', 'table_name', 'rows', 'at'],
  LISTS: { subject: 'id', subject_status: 'subject_id', health_screen: 'subject_id', fit_to_breed: 'subject_id', litter: 'dam_subject_id', microchip: 'subject_id',
           area_reading: '', check_log: '' },
  REDACTIONS: ['', 'last4'],
  MAX_DOGS: 200,
  MAX_FIELDS: 200,
  MAX_LABEL: 80
};

function inspectPageUrl_() {
  var u = String(prop_(BLD.PROP.INSPECT_PAGE_URL) || '').trim();
  return /^https:\/\/[^\s#?]+$/.test(u) ? u : '';
}

function inspectScriptId_() {
  var s = String(prop_(BLD.PROP.INSPECT_SCRIPT_ID) || '').trim();
  return /^[A-Za-z0-9_-]{10,}$/.test(s) ? s : '';
}

function inspectFiles_() { return [INSPECT.LINK_FILE, INSPECT.SUBJECT_FILE, INSPECT.FIELD_FILE, INSPECT.ACCESS_FILE, INSPECT.SCOPE_FILE, INSPECT.RIGHT_FILE]; }

function linkCurrent_(records, tenant) {
  var next = {}, out = {};
  records.forEach(function (r) { if ((!tenant || r.tenant_id === tenant) && r.supersedes_id) next[r.supersedes_id] = r; });
  records.forEach(function (r) {
    if ((tenant && r.tenant_id !== tenant) || r.supersedes_id) return;
    var cur = r, n = 0;
    while (next[cur.id] && n++ < 1000) cur = next[cur.id];
    out[r.id] = cur;
  });
  return out;
}

function inspectHeader_(title) {
  if (title === INSPECT.LINK_FILE) return INSPECT.LINK_COLUMNS;
  if (title === INSPECT.SUBJECT_FILE) return INSPECT.SUBJECT_COLUMNS;
  if (title === INSPECT.FIELD_FILE) return INSPECT.FIELD_COLUMNS;
  if (title === INSPECT.ACCESS_FILE) return INSPECT.ACCESS_COLUMNS;
  if (title === INSPECT.SCOPE_FILE) return INSPECT.SCOPE_COLUMNS;
  if (title === INSPECT.RIGHT_FILE) return INSPECT.RIGHT_COLUMNS;
  return null;
}

function inspectRead_(title) {
  var f = store_read_(title, false);
  var v1 = f && title === INSPECT.LINK_FILE && sameHeader_(f.header, INSPECT.LINK_COLUMNS_V1);
  if (!f || (!v1 && !sameHeader_(f.header, inspectHeader_(title)))) {
    throw err_('READ_NOT_CONFIGURED', 'Inspector links are not set up yet, so nothing can be shown.');
  }
  return f;
}

function inspectListOk_(key) {
  if (typeof key !== 'string' || /^score_/.test(key)) return false;
  if (!Object.prototype.hasOwnProperty.call(INSPECT.LISTS, key) || !Object.prototype.hasOwnProperty.call(READABLE, key)) return false;
  return !/^score_/.test(READABLE[key].vis) && !/^BLD-score_/.test(READABLE[key].file);
}

function inspectCovers_(r, day) {
  var from = String(r.from_date || ''), to = String(r.to_date || '');
  if (from && !isRealDate_(from)) return false;
  if (to && !isRealDate_(to)) return false;
  return (!from || from <= day) && (!to || day <= to);
}

var INSPECT_JOB_COLUMNS = ['id', 'tenant_id', 'subject_id', 'done_on', 'outcome', 'note', 'valid_until'];

function inspectJobRows_(key, tenant) {
  var t = store_read_(READABLE.check_type.file, false), l = store_read_(READABLE.check_log.file, false);
  if (!t || !l) return null;
  var ver = {}, any = false;
  t.records.forEach(function (r) { if ((!r.tenant_id || r.tenant_id === tenant) && r.type_key === key && r.id) { ver[r.id] = r; any = true; } });
  if (!any) return null;
  var replaced = {};
  l.records.forEach(function (r) { if (r.corrects_id) replaced[r.corrects_id] = true; });
  return l.records.filter(function (r) {
    return (!r.tenant_id || r.tenant_id === tenant) && ver[r.check_type_id] && r.subject_id && !replaced[r.id];
  }).map(function (r) {
    var at = String(r.happened_at || r.taken_at || ''), d = new Date(at), day = isNaN(d.getTime()) ? at.slice(0, 10) : todayLondon_(d);
    var every = String(ver[r.check_type_id].every_days || '').trim(), until = '';
    if (/^[0-9]+$/.test(every) && +every > 0 && isRealDate_(day)) until = new Date(Date.parse(day + 'T00:00:00Z') + (+every) * 86400000).toISOString().slice(0, 10);
    return { id: r.id, tenant_id: r.tenant_id || tenant, subject_id: r.subject_id, done_on: day, outcome: r.outcome || '', note: r.note || '', valid_until: until };
  });
}

var INSPECT_SITE = {
  area_reading: { dateCols: ['taken_at', 'period_start'], extra: ['room'] },
  check_log: { dateCols: ['happened_at', 'taken_at'], extra: ['job', 'room', 'dog'] }
};

function inspectRowDay_(r, cols) {
  for (var i = 0; i < cols.length; i++) {
    var d = String(r[cols[i]] || '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  }
  return '';
}

function inspectSiteData_(key, tenant) {
  var f = store_read_(READABLE[key].file, false);
  if (!f) return null;
  var site = INSPECT_SITE[key], names = function (file, col) {
    var out = {}, t = store_read_(file, false);
    ((t && t.records) || []).forEach(function (r) { if ((!r.tenant_id || r.tenant_id === tenant) && r.id) out[r.id] = String(r[col] || r.name || r.id); });
    return out;
  };
  var room = names(READABLE.area.file, 'name'), job = key === 'check_log' ? names(READABLE.check_type.file, 'label') : {};
  var dog = key === 'check_log' ? names(READABLE.subject.file, 'name') : {};
  var dam = key === 'check_log' ? names(READABLE.litter.file, 'dam_subject_id') : {};
  var replaced = {};
  f.records.forEach(function (r) { if (r.corrects_id) replaced[r.corrects_id] = true; });
  var empty = [];
  if (key === 'area_reading') {
    var q = store_read_(READABLE.requirement.file, false);
    ((q && q.records) || []).forEach(function (e) {
      if ((!e.tenant_id || e.tenant_id === tenant) && e.need_type === 'room.empty' && e.target_table === 'area' && e.target_id) empty.push(e);
    });
  }
  var emptyOn = function (aid, day) { return !!day && empty.some(function (e) { return e.target_id === aid && inspectCovers_(e, day); }); };
  var header = f.header.slice();
  site.extra.forEach(function (c) { if (header.indexOf(c) < 0) header.push(c); });
  var recs = f.records.filter(function (r) { return (!r.tenant_id || r.tenant_id === tenant) && !replaced[r.id]; }).map(function (r) {
    var o = {};
    for (var k in r) if (Object.prototype.hasOwnProperty.call(r, k)) o[k] = r[k];
    o.room = r.area_id ? (room[r.area_id] || r.area_id) : '';
    if (key === 'check_log') { o.job = job[r.check_type_id] || ''; o.dog = r.subject_id ? (dog[r.subject_id] || '') : ''; }
    o.__dam = r.litter_id ? (dam[r.litter_id] || '') : '';
    o.__day = inspectRowDay_(r, site.dateCols);
    o.__empty = key === 'area_reading' && emptyOn(r.area_id, o.__day);
    o.__at = String(r[site.dateCols[0]] || r[site.dateCols[1]] || '');
    return o;
  });
  recs = recs.filter(function (r) { return !r.__empty; });
  recs.sort(function (a, b) { return a.__at < b.__at ? 1 : a.__at > b.__at ? -1 : 0; });
  return { header: header, records: recs };
}

function inspectListData_(key, tenant) {
  var f = store_read_(READABLE[key].file, false), jobs = inspectJobRows_(key, tenant);
  if (!jobs) return f;
  var header = f ? f.header.slice() : [];
  INSPECT_JOB_COLUMNS.forEach(function (c) { if (header.indexOf(c) < 0) header.push(c); });
  return { header: header, records: (f ? f.records : []).concat(jobs) };
}

function inspectSinkRead_(req, who, now) {
  var key = typeof req.table === 'string' ? req.table : '';
  var denied = err_('NOT_ALLOWED', 'This link does not show that list.');
  if (!inspectListOk_(key)) throw denied;
  if (req.filter !== undefined && req.filter !== null) throw err_('BAD_FILTER', 'That filter was not understood.');
  var tenant = prop_(BLD.PROP.TENANT_ID);
  if (!tenant) throw err_('NOT_CONFIGURED', 'The tenant id has not been set up in the script (TENANT_ID).');
  var rd = READABLE[key], subjCol = INSPECT.LISTS[key], today = todayLondon_(now);

  var links = inspectRead_(INSPECT.LINK_FILE).records;
  var link = links.filter(function (r) {
    if (r.tenant_id !== tenant || r.supersedes_id) return false;
    if (who.card) return r.id === who.link_id && !!r.card_tag_id;
    return who.id && r.code_id === who.id && (!who.link_id || r.id === who.link_id);
  })[0];
  if (!link) throw denied;
  var current = linkCurrent_(links, tenant)[link.id] || link;
  if (String(current.ended_at || '')) throw err_('WINDOW', 'This visit has ended.');
  var scope = store_read_(INSPECT.SCOPE_FILE, false), scoped = false, shown = false;
  if (scope && sameHeader_(scope.header, INSPECT.SCOPE_COLUMNS)) {
    scope.records.forEach(function (r) {
      if (r.tenant_id !== tenant || r.grant_id !== link.id) return;
      scoped = true;
      if (r.scope_item_type === key && grantRowOn_(r, today) && r.disclosure_state === 'record') shown = true;
    });
  }
  if (scoped && !shown) throw denied;

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

  if (!Object.keys(cols).some(function (c) { return cols[c] !== null; })) throw denied;   // nothing ticked on this list
  var site = INSPECT_SITE[key];
  var data = site ? inspectSiteData_(key, tenant) : inspectListData_(key, tenant);
  if (!data) throw err_('FILE_MISSING', 'That list does not exist yet.');
  var fields = data.header.filter(function (c) {
    return c && c !== 'tenant_id' && !/score/i.test(c) && Object.prototype.hasOwnProperty.call(cols, c) && cols[c] !== null;   // never a score column
  });
  if (!fields.length) throw denied;
  if (!site) {
    if (data.header.indexOf(subjCol) < 0) throw denied;
    if (fields.indexOf(subjCol) < 0) fields.unshift(subjCol);
    cols[subjCol] = '';
  }
  var dFromRaw = String(link.as_of_from || link.data_from_date || '');
  var dToRaw = String(link.as_of_to || link.data_to_date || '');
  var dFrom = isRealDate_(dFromRaw) ? dFromRaw : '';
  var dTo = isRealDate_(dToRaw) ? dToRaw : '';

  var hasTenantCol = data.header.indexOf('tenant_id') >= 0, rows = [], truncated = false, redacted = {};
  fields.forEach(function (c) { if (cols[c]) redacted[c] = cols[c]; });
  for (var i = 0; i < data.records.length; i++) {
    var r = data.records[i];
    if (hasTenantCol && r.tenant_id !== tenant) continue;
    if (site) {
      if (r.litter_id) { if (!(r.subject_id && dogs[r.subject_id]) && !(r.__dam && r.__dam !== r.litter_id && dogs[r.__dam])) continue; }
      else if (r.subject_id && !dogs[r.subject_id]) continue;
      if ((dFrom || dTo) && (!r.__day || (dFrom && r.__day < dFrom) || (dTo && r.__day > dTo))) continue;
    } else if (!dogs[r[subjCol]]) continue;
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

function inspectEndOfDay_(ymd) {
  var noon = londonIso_(new Date(Date.parse(ymd + 'T12:00:00Z')));
  return ymd + 'T23:59:59' + noon.slice(19);
}

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
    var f = INSPECT_SITE[k] ? inspectSiteData_(k, tenant) : inspectListData_(k, tenant);
    if (f) lists[k] = f.header.filter(function (c) { return c && c !== 'tenant_id' && !/score/i.test(c); });
  });
  return {
    dogs: dogs, lists: lists, keys: INSPECT.LISTS, today: today, now: londonIso_(new Date()).slice(0, 16),
    default_hours: externalRule_('default_hours', ROLE_INSPECTOR, today), max_hours: externalRule_('max_hours', ROLE_INSPECTOR, today),
    page_url: inspectPageUrl_(), script_id: inspectScriptId_()
  };
}

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
    var f = INSPECT_SITE[list] ? inspectSiteData_(list, tenant) : inspectListData_(list, tenant);
    if (!f) throw bad('fields', 'That list does not exist yet.');
    var done = {};
    want.forEach(function (w) {
      var name = typeof w === 'string' ? w : (w && typeof w === 'object' ? String(w.field || '') : '');
      var red = w && typeof w === 'object' ? String(w.redaction || '') : '';
      if (!name || name === 'tenant_id' || f.header.indexOf(name) < 0) throw bad('fields', 'One of the ticked fields was not found. Reload the page.');
      if (/score/i.test(name)) throw bad('fields', 'A link never shows scores.');
      if (INSPECT.REDACTIONS.indexOf(red) < 0) throw bad('fields', 'That way of hiding part of a value is not known.');
      if (done[name]) return;
      done[name] = true;
      fieldRows.push([list, name, red]);
    });
  });
  if (!fieldRows.length) throw bad('fields', 'Tick at least one field.');
  var dataFrom = String(spec.data_from_date || '').trim(), dataTo = String(spec.data_to_date || '').trim();
  if (dataFrom && !isRealDate_(dataFrom)) throw bad('data_from_date', 'That date was not understood.');
  if (dataTo && !isRealDate_(dataTo)) throw bad('data_to_date', 'That date was not understood.');
  if (dataFrom && dataTo && dataFrom > dataTo) throw bad('data_to_date', 'The last day is before the first day.');
  if (fieldRows.length > INSPECT.MAX_FIELDS) throw bad('fields', 'Too many fields ticked.');

  return withLock_(function () {
    var L = inspectRead_(INSPECT.LINK_FILE), S = inspectRead_(INSPECT.SUBJECT_FILE), F = inspectRead_(INSPECT.FIELD_FILE);
    inspectRead_(INSPECT.ACCESS_FILE);
    var linkId = newId_('ilk', now), codeId = newCodeId_(), endsAt = win.ends_at, by = adminEmail || 'user';
    var v1 = sameHeader_(L.header, INSPECT.LINK_COLUMNS_V1);
    if (v1 && win.later) throw bad('starts_at', 'A link that opens later needs the from_at and to_at columns in BLD-inspect_link. Ask STAFF to add them.');
    if (v1 && (dataFrom || dataTo)) throw bad('data_from_date', 'Limiting the days needs the as_of_from and as_of_to columns in BLD-inspect_link. Ask STAFF to add them.');
    store_appendMany_(INSPECT.SUBJECT_FILE, INSPECT.SUBJECT_COLUMNS, subjects.map(function (s, i) {
      return [linkId + '-s' + (i + 1), tenant, linkId, s, todayLondon_(new Date(win.startMs)), ends];
    }), S);
    store_appendMany_(INSPECT.FIELD_FILE, INSPECT.FIELD_COLUMNS, fieldRows.map(function (r, i) {
      return [linkId + '-f' + (i + 1), tenant, linkId, r[0], r[1], r[2]];
    }), F);
    var lv = { id: linkId, tenant_id: tenant, code_id: codeId, label: label, ends: endsAt, created_at: utcIso_(now), set_by: by,
      made_at: londonIso_(now), made_by: by, from_at: utcIso_(new Date(win.startMs)), to_at: utcIso_(new Date(win.endMs)),
      starts_at: win.starts_at, ends_at: win.ends_at, as_of_from: dataFrom, as_of_to: dataTo, data_from_date: dataFrom, data_to_date: dataTo,
      purpose_text: 'Inspector link: ' + label, grant_basis: 'voluntary', identity_assurance: 'none' };
    store_appendMany_(INSPECT.LINK_FILE, L.header, [L.header.map(function (h) { return lv[h] == null ? '' : lv[h]; })], L);

    var alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', raw = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''), code = '';
    for (var i = 0; i < 16; i++) code += alphabet.charAt(parseInt(raw.substr(i * 2, 2), 16) % alphabet.length);
    var reg = registry_();
    reg[hashCode_(code, salt)] = { id: codeId, who: 'Inspector - ' + label, role: ROLE_INSPECTOR, active: true, added: londonIso_(now), starts_at: win.starts_at, expires_at: endsAt, link_id: linkId };
    setProp_(BLD.PROP.REGISTRY, JSON.stringify(reg));
    return { link_id: linkId, code_id: codeId, code: code, ends: endsAt, starts_at: win.starts_at, ends_at: win.ends_at, dogs: subjects.length, fields: fieldRows.length };
  });
}

/** list links */
function sinkInspectLinks_() {
  var tenant = prop_(BLD.PROP.TENANT_ID), reg = registry_(), byId = {}, h;
  for (h in reg) if (Object.prototype.hasOwnProperty.call(reg, h) && reg[h].id) byId[reg[h].id] = reg[h];
  var L = inspectRead_(INSPECT.LINK_FILE), S = inspectRead_(INSPECT.SUBJECT_FILE), F = inspectRead_(INSPECT.FIELD_FILE), A = inspectRead_(INSPECT.ACCESS_FILE);
  var count = function (f, id) { return f.records.filter(function (r) { return r.tenant_id === tenant && r.link_id === id; }).length; };
  var cur = linkCurrent_(L.records, tenant);
  return L.records.filter(function (r) { return r.tenant_id === tenant && !r.supersedes_id; }).map(function (root) {
    var r = cur[root.id] || root;
    var e = byId[root.code_id], state = 'stopped', stopped = '', reason = '';
    if (e && (e.active === false || e.revoked_at)) { stopped = e.revoked_at || ''; reason = e.revoked_reason || ''; }
    else if (e && !guestExpired_(e)) state = externalNotYet_(e) ? 'scheduled' : 'active';
    else if (e) state = 'ended';
    return {
      id: root.id, code_id: root.code_id, label: r.label, ends: r.ends, starts_at: r.from_at || (e && e.starts_at) || root.created_at || root.made_at, ends_at: r.to_at || r.ends,
      made_at: root.created_at || root.made_at, made_by: root.set_by || root.made_by, state: state, stopped_at: stopped || r.ended_at || '', stop_reason: reason || r.end_reason || '',
      dogs: count(S, root.id), fields: count(F, root.id), visits: count(A, root.id)
    };
  }).reverse();
}

/** stop a link */
function sinkInspectStop_(linkId, adminEmail, reason) {
  var tenant = prop_(BLD.PROP.TENANT_ID);
  reason = String(reason == null ? '' : reason).trim();
  if (!reason) throw err_('INVALID', 'Say briefly why it is ending now.', { fields: { reason: 'Say briefly why it is ending now.' } });
  if (reason.length > 200 || /[\r\n]/.test(reason)) throw err_('INVALID', 'Keep the reason to one short line.', { fields: { reason: 'Keep the reason to one short line.' } });
  var L = inspectRead_(INSPECT.LINK_FILE);
  var link = L.records.filter(function (r) { return r.tenant_id === tenant && r.id === String(linkId || '') && !r.supersedes_id; })[0];
  if (!link) throw err_('NOT_FOUND', 'That link was not found.');
  return withLock_(function () {
    var out = revokeCodeCore_(link.code_id, adminEmail, reason), now = new Date();
    var L2 = inspectRead_(INSPECT.LINK_FILE);
    if (sameHeader_(L2.header, INSPECT.LINK_COLUMNS)) linkSupersede_(L2, link.id, { ended_at: utcIso_(now), ended_by: adminEmail || 'user', end_reason: reason }, now);
    return out;
  });
}

function linkSupersede_(L, rootId, changes, now) {
  var tenant = prop_(BLD.PROP.TENANT_ID), cur = linkCurrent_(L.records, tenant)[rootId];
  if (!cur) throw err_('NOT_FOUND', 'That visit was not found.');
  var ids = {}, id = newId_('ilk', now);
  L.records.forEach(function (r) { ids[r.id] = true; });
  while (ids[id]) id = newId_('ilk', now);
  var v = {};
  L.header.forEach(function (h) { v[h] = cur[h] == null ? '' : String(cur[h]); });
  for (var k in changes) if (Object.prototype.hasOwnProperty.call(changes, k)) v[k] = changes[k];
  v.id = id; v.supersedes_id = cur.id; v.created_at = utcIso_(now);
  store_appendMany_(INSPECT.LINK_FILE, L.header, [L.header.map(function (h) { return v[h] == null ? '' : v[h]; })], L);
  return v;
}


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

function londonLocalMs_(s) {
  var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m || !isRealDate_(m[1]) || +m[2] > 23 || +m[3] > 59) return NaN;
  var guess = Date.parse(m[1] + 'T' + m[2] + ':' + m[3] + ':00Z');
  var off = londonIso_(new Date(guess)).slice(19);                      // '+01:00' or 'Z'/'+00:00'
  var ms = Date.parse(m[1] + 'T' + m[2] + ':' + m[3] + ':00' + (off === 'Z' ? 'Z' : off));
  return londonIso_(new Date(ms)).slice(0, 16) === m[1] + 'T' + m[2] + ':' + m[3] ? ms : NaN;
}

function externalWindow_(spec, role, now, bad, typeHours) {
  typeHours = typeHours || {};
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
    startMs = sa ? externalMs_(sa) : nowMs;
    endMs = externalMs_(ea);
    if (isNaN(startMs)) throw bad('starts_at', 'Choose the date and time it opens.');
    if (isNaN(endMs)) throw bad('ends_at', 'Choose the date and time it ends.');
    if (startMs < nowMs) startMs = nowMs;
    if (endMs <= startMs) throw bad('ends_at', 'The end must be after the start.');
  } else if (endsDay) {
    if (!isRealDate_(endsDay)) throw bad('ends', 'Choose the last day the link works.');
    if (endsDay < today) throw bad('ends', 'The last day cannot be in the past.');
    endMs = Date.parse(inspectEndOfDay_(endsDay));
  } else {
    var def = typeHours.default_hours > 0 ? typeHours.default_hours : externalRule_('default_hours', role, today);
    if (def === null) throw bad('ends_at', 'Choose when it ends.');
    endMs = nowMs + Math.round(def * H);
  }
  var max = externalMax_(role, today, typeHours.max_hours);
  if (max !== null && endMs - startMs > Math.round(max * H) + 60000) {
    throw bad(hours !== undefined && hours !== null && hours !== '' ? 'hours' : (until ? 'until' : (sa || ea ? 'ends_at' : (endsDay ? 'ends' : 'ends_at'))), 'This can last ' + max + ' hours at most (your rule for ' + String(role).toLowerCase() + ' visits).');
  }
  return { startMs: startMs, endMs: endMs, starts_at: londonIso_(new Date(startMs)), ends_at: londonIso_(new Date(endMs)), later: startMs > nowMs + 60000 };
}

function externalMax_(role, day, typeMax) {
  var rule = externalRule_('max_hours', role, day), t = Number(typeMax);
  if (t > 0 && (rule === null || t < rule)) return t;
  return rule;
}

function externalMs_(s) {
  s = String(s || '').trim();
  if (ISO_DT_RE_.test(s)) return Date.parse(s);
  return londonLocalMs_(s);
}

function externalNotYet_(entry) {
  var s = Date.parse(entry.starts_at || '');
  return !isNaN(s) && new Date().getTime() < s;
}

function externalShow_(iso) {
  var ms = Date.parse(iso || ''); if (isNaN(ms)) return '';
  var t = londonIso_(new Date(ms)), mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return (+t.slice(8, 10)) + ' ' + mon[+t.slice(5, 7) - 1] + ' ' + t.slice(0, 4) + ' ' + t.slice(11, 16);
}

