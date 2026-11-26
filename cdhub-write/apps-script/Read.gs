
function readEnabled_() { return prop_(BLD.PROP.READ_ENABLED) === 'true'; }

function parseScope_(cond, rd) {
  cond = String(cond || '').trim();
  if (cond === '') return { kind: 'all', rank: 2 };
  var kp = /^key_prefix=([a-z][a-z0-9_]{0,39}\.(?:\|[a-z][a-z0-9_]{0,39}\.){0,9})$/.exec(cond);
  if (kp) { var ps = kp[1].split('|'); return rd.keyCol ? { kind: 'prefix', prefix: ps[0], prefixes: ps, rank: 1 } : null; }
  var m = /^(own_rows_days|rows_days)<=(\d{1,3})$/.exec(cond);
  if (!m) return null;
  var days = parseInt(m[2], 10);
  if (days < 1 || !rd.dateCol) return null;
  if (m[1] === 'own_rows_days') return rd.authorCol ? { kind: 'own', days: days, rank: 0 } : null;
  return { kind: 'recent', days: days, rank: 1 };
}

function readLayer_(policy, rd, audience) {
  var L = { fields: {}, hasRows: false, star: false, scope: null, bad: false, hideRows: {}, hideCells: {} };
  policy.forEach(function (r) {
    if (r.table_name !== rd.vis || r.audience_id !== audience) return;
    var yes = String(r.visible || '').toLowerCase() === 'yes';
    var rowId = String(r.row_id || '').trim();
    if (rowId) {
      if (yes) return;
      if (r.field_name === '*') L.hideRows[rowId] = true;
      else (L.hideCells[rowId] = L.hideCells[rowId] || {})[r.field_name] = true;
      return;
    }
    L.hasRows = true;
    if (r.field_name === '*') {
      L.star = true;
      if (!yes) { L.bad = true; return; }
      var sc = parseScope_(r.condition, rd);
      if (!sc) { L.bad = true; return; }
      if (!L.scope || sc.rank < L.scope.rank) L.scope = sc;   // if several, the narrowest wins
      return;
    }
    var usable = yes && String(r.condition || '').trim() === '' && String(r.redaction || '').trim() === '';
    if (!usable) { L.fields[r.field_name] = 'no'; return; }
    if (L.fields[r.field_name] !== 'no') L.fields[r.field_name] = 'yes';
  });
  return L;
}

function readAccess_(policy, rd, audiences) {
  var none = function () { return { fields: {}, hasRows: false, star: false, scope: null, bad: false, hideRows: {}, hideCells: {} }; };
  var P = audiences.person ? readLayer_(policy, rd, audiences.person) : none();
  var R = audiences.role ? readLayer_(policy, rd, audiences.role) : none();
  var chosen = P.star ? P : R;
  if (chosen.bad || !chosen.scope) return null;
  var cols = {}, name;
  [R, P].forEach(function (L) {
    for (name in L.fields) if (Object.prototype.hasOwnProperty.call(L.fields, name)) cols[name] = L.fields[name];
  });
  var fields = {};
  for (name in cols) if (Object.prototype.hasOwnProperty.call(cols, name) && cols[name] === 'yes') fields[name] = true;
  if (!Object.keys(fields).length) return null;
  var hideRows = {}, hideCells = {};
  [R, P].forEach(function (L) {
    for (var id in L.hideRows) if (Object.prototype.hasOwnProperty.call(L.hideRows, id)) hideRows[id] = true;
    for (var rid in L.hideCells) if (Object.prototype.hasOwnProperty.call(L.hideCells, rid)) {
      hideCells[rid] = hideCells[rid] || {};
      for (var c in L.hideCells[rid]) if (Object.prototype.hasOwnProperty.call(L.hideCells[rid], c)) hideCells[rid][c] = true;
    }
  });
  return { fields: fields, scope: chosen.scope, hideRows: hideRows, hideCells: hideCells };
}

function visInForce_(r, day) {
  var from = String(r.from_date || '').trim(), to = String(r.to_date || '').trim();
  var hide = String(r.visible || '').toLowerCase() !== 'yes';
  if ((from && !isRealDate_(from)) || (to && !isRealDate_(to))) return hide;
  return (!from || from <= day) && (!to || to >= day);
}

function visAudience_(r) {
  var a = String(r.audience_id || '').trim();
  if (a) return a;
  var role = String(r.role_code || '').trim().toUpperCase();
  return role ? audienceFor_(role) : '';
}

function readPolicy_(tenant, day) {
  var f = store_read_(BLD.VISIBILITY_FILE, false);
  if (!f) throw err_('READ_NOT_CONFIGURED', 'Reading is not set up yet (the permissions file was not found), so nothing can be read.');
  ['table_name', 'field_name', 'audience_id', 'visible', 'condition', 'redaction'].forEach(function (c) {
    if (f.header.indexOf(c) < 0) throw err_('READ_NOT_CONFIGURED', 'The permissions file does not have the columns the read system expects, so nothing can be read.');
  });
  return f.records.filter(function (r) { return (!r.tenant_id || r.tenant_id === tenant) && (!day || visInForce_(r, day)); })
    .map(function (r) { var o = {}; for (var k in r) if (Object.prototype.hasOwnProperty.call(r, k)) o[k] = r[k]; o.audience_id = visAudience_(r); return o; });
}

function readFilter_(f, rd, header) {
  var out = { area_id: '', from: '', to: '' };
  if (f === undefined || f === null) return out;
  var bad = err_('BAD_FILTER', 'That filter was not understood.');
  if (typeof f !== 'object' || Array.isArray(f)) throw bad;
  for (var k in f) {
    if (!Object.prototype.hasOwnProperty.call(f, k)) continue;
    if (!Object.prototype.hasOwnProperty.call(out, k)) throw bad;
    var v = f[k] === undefined || f[k] === null ? '' : String(f[k]).trim();
    if (v === '') continue;
    if (k === 'area_id') { if (!ID_RE_.test(v) || header.indexOf('area_id') < 0) throw bad; }
    else if (!isRealDate_(v) || !rd.dateCol) throw bad;
    out[k] = v;
  }
  if (out.from && out.to && out.from > out.to) throw bad;
  return out;
}

var RECENT_EDGE_ = 20;
function readRecent_(rd, f) {
  var from = f && typeof f === 'object' && !Array.isArray(f) && f.from ? String(f.from).trim() : '';
  if (!from || !rd.dateCol || !isRealDate_(from)) return null;
  var file = store_findOne_(rd.file);
  if (!file || !store_isSheet_(file)) return null;
  var t = store_readTail_(rd.file, BLD.LIMITS.READ_TAIL_ROWS, []);
  if (t.complete) return t;
  var edge = t.records.slice(0, RECENT_EDGE_);
  if (edge.length < RECENT_EDGE_) return null;
  var older = edge.every(function (r) { var d = String(r[rd.dateCol] || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(d) && d < from; });
  return older ? t : null;
}

function sinkRead_(req) {
  var now = new Date(), nowMs = now.getTime();
  if (!readEnabled_()) throw err_('READ_OFF', 'Reading from the records is switched off.');
  var who = req.t ? visitCardWho_(req.t, now) : authSaver_(req);
  if (who.role === ROLE_INSPECTOR) return inspectSinkRead_(req, who, now);

  var key = typeof req.table === 'string' ? req.table : '';
  if (!Object.prototype.hasOwnProperty.call(READABLE, key)) {
    throw err_('FILE_NOT_ALLOWED', 'That is not a list the system can show you.');
  }
  if (who.role === ROLE_GUEST && key !== 'area' && key !== 'requirement') throw err_('NOT_ALLOWED', 'User has not allowed you to see this list.');
  var rd = READABLE[key];
  var audiences = { role: audienceFor_(who.role), person: who.id ? 'person:' + who.id : '' };
  var denied = err_('NOT_ALLOWED', 'User has not allowed you to see this list.');
  if (!audiences.role && !audiences.person) throw denied;

  var tenant = prop_(BLD.PROP.TENANT_ID);
  if (!tenant) throw err_('NOT_CONFIGURED', 'The tenant id has not been set up in the script (TENANT_ID).');
  var access = readAccess_(readPolicy_(tenant, todayLondon_(now)), rd, audiences);
  if (!access) throw denied;

  var data = readRecent_(rd, req.filter) || store_read_(rd.file, false);
  if (!data) throw err_('FILE_MISSING', 'That list does not exist yet.');

  var fields = data.header.filter(function (c) { return access.fields[c] === true && c !== 'tenant_id'; });
  if (!fields.length) throw denied;

  var flt = readFilter_(req.filter, rd, data.header);
  var sc = access.scope, cutoff = sc.days ? nowMs - sc.days * 86400000 : 0;
  var hasTenantCol = data.header.indexOf('tenant_id') >= 0;
  var hits = [], rows = [], truncated = false;
  for (var i = 0; i < data.records.length; i++) {
    var r = data.records[i];
    if (hasTenantCol && r.tenant_id !== tenant) continue;
    if (sc.kind === 'own' && r[rd.authorCol] !== who.who) continue;
    if (sc.kind === 'prefix' && !sc.prefixes.some(function (p) { return String(r[rd.keyCol] || '').indexOf(p) === 0; })) continue;
    if (sc.kind === 'own' || sc.kind === 'recent') {
      var t = Date.parse(r[rd.dateCol]);
      if (isNaN(t) || t < cutoff) continue;
    }
    if (access.hideRows[r.id]) continue;
    if (flt.area_id && r.area_id !== flt.area_id) continue;
    if (flt.from || flt.to) {
      var day = String(r[rd.dateCol] || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || (flt.from && day < flt.from) || (flt.to && day > flt.to)) continue;
    }
    hits.push(r);
  }
  if (hits.length > BLD.LIMITS.READ_MAX_ROWS) { truncated = true; hits = hits.slice(hits.length - BLD.LIMITS.READ_MAX_ROWS); }
  hits.forEach(function (r) {
    var o = {};
    var cellsOff = access.hideCells[r.id] || {};
    fields.forEach(function (c) { o[c] = cellsOff[c] ? '' : r[c]; });
    rows.push(o);
  });
  return {
    table: key, fields: fields, rows: rows, count: rows.length, truncated: truncated, role: who.role, name: who.who,
    scope: sc.kind === 'all' ? 'all rows' : sc.kind === 'prefix' ? 'the ' + sc.prefixes.join('*, ') + '* rows' : (sc.kind === 'own' ? 'your own rows from the last ' + sc.days + ' days' : 'rows from the last ' + sc.days + ' days'),
    as_of: londonIso_(now)
  };
}

