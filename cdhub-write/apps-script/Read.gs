/**
 * The code-gated READ action. A staff code can read a list only as far as Lisa has allowed.
 *
 * DEFAULT DENY. Nothing is readable until BOTH are true:
 *   1. READ_ENABLED is 'true' (a switch Lisa sets; off by default), and
 *   2. BLD-field_visibility.csv has rows for the code's audience (OWNER -> aud-admin, STAFF -> aud-staff)
 *      on that table. The file is only ever READ here; this script never writes to it.
 *
 * Rows used (existing columns of BLD-field_visibility.csv only: table_name, field_name, audience_id,
 * visible, condition, redaction):
 *   - a COLUMN is shown when a row says visible = yes with an empty condition and an empty redaction.
 *     A visible = no row for the same column always wins. A column with a condition or redaction we
 *     cannot apply is NOT shown (it stays hidden rather than guessed).
 *   - PER-PERSON OVERRIDES: a row whose audience_id is  person:<staff code id>  (the short id shown on the owner page,
 *     e.g. person:sc-k3f9ab) is read on top of the role rows. A person row beats the role row for the same column,
 *     and a person row-rule (*) beats the role's row-rule. No person row means the role's rows apply. Default deny stays.
 *   - the ROWS shown are set by a row whose field_name is *  (an asterisk). Its condition says how many:
 *         (empty)               every row of this kennel
 *         rows_days<=N          rows from the last N days (needs a date column on that list)
 *         own_rows_days<=N      only rows this person entered, from the last N days
 *         key_prefix=<p>        only rows whose key column starts with <p> (e.g. key_prefix=job. on breeding_rule:
 *                               staff phones read the job.* owner settings and nothing else; 15 Nov 2026, SOPJOBS S8)
 *     No * row, or one we cannot understand, means no rows at all.
 *   - DATED HIDING (Lisa 15 Nov 2026, Q3; optional columns at the end of the file, read only when they are there):
 *         from_date / to_date   the row is in force only from .. to (both days included, London); blank = no limit.
 *                               A date that is not a real date: a hide row (visible = no) still counts, a show row does not.
 *         role_code             OWNER / STAFF / GUEST: the row is for that role when audience_id is blank.
 *         row_id                hides ONE record (its id column): field_name * hides the whole record, a column name
 *                               hides that one cell (sent blank). Only visible = no rows count here: a row_id row never
 *                               shows anything Lisa has not allowed. Hides from the person's and the role's rows both apply.
 *         source                why the row is there; not read.
 *     No such columns, or blank: everything works as before.
 * Staff never get the tenant_id column, the permissions file, the approvals queue or any list that is not in READABLE.
 */

function readEnabled_() { return prop_(BLD.PROP.READ_ENABLED) === 'true'; }

/** Understand a row-rule. Returns null if it is not one of the three known forms (then it is refused). */
function parseScope_(cond, rd) {
  cond = String(cond || '').trim();
  if (cond === '') return { kind: 'all', rank: 2 };
  var kp = /^key_prefix=([a-z][a-z0-9_]{0,39}\.)$/.exec(cond);
  if (kp) return rd.keyCol ? { kind: 'prefix', prefix: kp[1], rank: 1 } : null;
  var m = /^(own_rows_days|rows_days)<=(\d{1,3})$/.exec(cond);
  if (!m) return null;
  var days = parseInt(m[2], 10);
  if (days < 1 || !rd.dateCol) return null;
  if (m[1] === 'own_rows_days') return rd.authorCol ? { kind: 'own', days: days, rank: 0 } : null;
  return { kind: 'recent', days: days, rank: 1 };
}

/**
 * What does ONE audience's rows say about one list? Nothing is decided here; the layers are combined in readAccess_.
 *   fields[col] = 'yes' | 'no'   an explicit row for that column (a yes with a condition or redaction we cannot apply counts as 'no':
 *                                it stays hidden rather than guessed; visible = no beats visible = yes for the same column)
 *   hasRows                      this audience has any row at all for the list
 *   star                         true if it has a row-rule (field *); scope = the narrowest understood rule, or null; bad = a rule we cannot understand
 */
function readLayer_(policy, rd, audience) {
  var L = { fields: {}, hasRows: false, star: false, scope: null, bad: false, hideRows: {}, hideCells: {} };
  policy.forEach(function (r) {
    if (r.table_name !== rd.vis || r.audience_id !== audience) return;
    var yes = String(r.visible || '').toLowerCase() === 'yes';
    var rowId = String(r.row_id || '').trim();
    if (rowId) {                                                  // Q3: one record or one cell, hide only
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

/**
 * What may this person see of one list? null = nothing. DEFAULT DENY.
 * `audiences` = {person: 'person:<staff code id>' or '', role: 'aud-staff' / 'aud-admin' or ''}.
 * A row for the PERSON beats a row for the ROLE, column by column and for the row-rule; where the person has no
 * row, the role's row applies; where neither has one, nothing is shown.
 */
function readAccess_(policy, rd, audiences) {
  var none = function () { return { fields: {}, hasRows: false, star: false, scope: null, bad: false, hideRows: {}, hideCells: {} }; };
  var P = audiences.person ? readLayer_(policy, rd, audiences.person) : none();
  var R = audiences.role ? readLayer_(policy, rd, audiences.role) : none();
  var chosen = P.star ? P : R;                                   // the row-rule: the person's if there is one
  if (chosen.bad || !chosen.scope) return null;
  var cols = {}, name;
  [R, P].forEach(function (L) {                                  // role first, then the person's rows over it
    for (name in L.fields) if (Object.prototype.hasOwnProperty.call(L.fields, name)) cols[name] = L.fields[name];
  });
  var fields = {};
  for (name in cols) if (Object.prototype.hasOwnProperty.call(cols, name) && cols[name] === 'yes') fields[name] = true;
  if (!Object.keys(fields).length) return null;
  var hideRows = {}, hideCells = {};                             // Q3: hides from both layers apply (the narrower view wins)
  [R, P].forEach(function (L) {
    for (var id in L.hideRows) if (Object.prototype.hasOwnProperty.call(L.hideRows, id)) hideRows[id] = true;
    for (var rid in L.hideCells) if (Object.prototype.hasOwnProperty.call(L.hideCells, rid)) {
      hideCells[rid] = hideCells[rid] || {};
      for (var c in L.hideCells[rid]) if (Object.prototype.hasOwnProperty.call(L.hideCells[rid], c)) hideCells[rid][c] = true;
    }
  });
  return { fields: fields, scope: chosen.scope, hideRows: hideRows, hideCells: hideCells };
}

/**
 * Q3 (15 Nov 2026): is a visibility row in force on this London day? Blank dates = no limit; both days included.
 * A date we cannot read: a hide row counts (the safe side), a show row does not.
 */
function visInForce_(r, day) {
  var from = String(r.from_date || '').trim(), to = String(r.to_date || '').trim();
  var hide = String(r.visible || '').toLowerCase() !== 'yes';
  if ((from && !isRealDate_(from)) || (to && !isRealDate_(to))) return hide;
  return (!from || from <= day) && (!to || to >= day);
}

/** Q3: role_code names the role a row is for when audience_id is blank (OWNER -> aud-admin and so on). */
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

/**
 * An optional narrowing of a read: {area_id, from, to}. It can only ever show FEWER rows than the permissions allow.
 * from/to are London days (YYYY-MM-DD, both included) on the list's date column. Anything not understood is refused.
 */
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

/**
 * A read that asks only for rows from a date on (filter.from) reads just the newest rows when they reach back past it
 * (22 Nov 2026: the staff Temperatures screen read all ~31,000 readings on every open and sat on "Loading..." for
 * minutes). Rows are added in time order, so when the first RECENT_EDGE rows of the newest block are all older than
 * `from`, nothing newer can sit above it. Otherwise (a short table, a CSV, rows out of order, no date column) it returns
 * null and the caller reads the whole table as before. Same shape as store_read_.
 */
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

/** Main entry for a read. Returns {table, fields, rows, ...} or throws err_. */
function sinkRead_(req) {
  var now = new Date(), nowMs = now.getTime();
  if (!readEnabled_()) throw err_('READ_OFF', 'Reading from the records is switched off.');
  var who = authSaver_(req);                       // a bad code stops here and gets nothing
  if (who.role === ROLE_INSPECTOR) return inspectSinkRead_(req, who, now);   // Inspect.gs: only its own link rows, never this file's rules

  var key = typeof req.table === 'string' ? req.table : '';
  if (!Object.prototype.hasOwnProperty.call(READABLE, key)) {
    throw err_('FILE_NOT_ALLOWED', 'That is not a list the system can show you.');
  }
  if (who.role === ROLE_GUEST && key !== 'area' && key !== 'requirement') throw err_('NOT_ALLOWED', 'Lisa has not allowed you to see this list.');
  var rd = READABLE[key];
  var audiences = { role: audienceFor_(who.role), person: who.id ? 'person:' + who.id : '' };
  var denied = err_('NOT_ALLOWED', 'Lisa has not allowed you to see this list.');
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
  // 22 Nov 2026: past READ_MAX_ROWS the NEWEST matching rows are kept (the last in the table), not the oldest. The
  // filters above still run first, on every row. Before, the reading table (~31,000 rows) returned only its first
  // 3,000, so a screen never saw today's readings.
  var hits = [], rows = [], truncated = false;
  for (var i = 0; i < data.records.length; i++) {
    var r = data.records[i];
    if (hasTenantCol && r.tenant_id !== tenant) continue;
    if (sc.kind === 'own' && r[rd.authorCol] !== who.who) continue;
    if (sc.kind === 'prefix' && String(r[rd.keyCol] || '').indexOf(sc.prefix) !== 0) continue;
    if (sc.kind === 'own' || sc.kind === 'recent') {
      var t = Date.parse(r[rd.dateCol]);
      if (isNaN(t) || t < cutoff) continue;
    }
    if (access.hideRows[r.id]) continue;                       // Q3: a record hidden by a dated row
    if (flt.area_id && r.area_id !== flt.area_id) continue;
    if (flt.from || flt.to) {
      var day = String(r[rd.dateCol] || '').slice(0, 10);     // dates are saved in London time, so this is the London day
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
    table: key, fields: fields, rows: rows, count: rows.length, truncated: truncated, role: who.role, name: who.who,   // the caller's own role and name (Welcome line, buttons); never anyone else's
    scope: sc.kind === 'all' ? 'all rows' : sc.kind === 'prefix' ? 'the ' + sc.prefix + '* rows' : (sc.kind === 'own' ? 'your own rows from the last ' + sc.days + ' days' : 'rows from the last ' + sc.days + ' days'),
    as_of: londonIso_(now)
  };
}
