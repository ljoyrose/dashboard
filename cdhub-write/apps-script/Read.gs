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
 *     No * row, or one we cannot understand, means no rows at all.
 * Staff never get the tenant_id column, the permissions file, the approvals queue or any list that is not in READABLE.
 */

function readEnabled_() { return prop_(BLD.PROP.READ_ENABLED) === 'true'; }

/** Understand a row-rule. Returns null if it is not one of the three known forms (then it is refused). */
function parseScope_(cond, rd) {
  cond = String(cond || '').trim();
  if (cond === '') return { kind: 'all', rank: 2 };
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
  var L = { fields: {}, hasRows: false, star: false, scope: null, bad: false };
  policy.forEach(function (r) {
    if (r.table_name !== rd.vis || r.audience_id !== audience) return;
    L.hasRows = true;
    var yes = String(r.visible || '').toLowerCase() === 'yes';
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
  var P = audiences.person ? readLayer_(policy, rd, audiences.person) : { fields: {}, hasRows: false, star: false, scope: null, bad: false };
  var R = audiences.role ? readLayer_(policy, rd, audiences.role) : { fields: {}, hasRows: false, star: false, scope: null, bad: false };
  var chosen = P.star ? P : R;                                   // the row-rule: the person's if there is one
  if (chosen.bad || !chosen.scope) return null;
  var cols = {}, name;
  [R, P].forEach(function (L) {                                  // role first, then the person's rows over it
    for (name in L.fields) if (Object.prototype.hasOwnProperty.call(L.fields, name)) cols[name] = L.fields[name];
  });
  var fields = {};
  for (name in cols) if (Object.prototype.hasOwnProperty.call(cols, name) && cols[name] === 'yes') fields[name] = true;
  if (!Object.keys(fields).length) return null;
  return { fields: fields, scope: chosen.scope };
}

function readPolicy_(tenant) {
  var f = store_read_(BLD.VISIBILITY_FILE, false);
  if (!f) throw err_('READ_NOT_CONFIGURED', 'Reading is not set up yet (the permissions file was not found), so nothing can be read.');
  ['table_name', 'field_name', 'audience_id', 'visible', 'condition', 'redaction'].forEach(function (c) {
    if (f.header.indexOf(c) < 0) throw err_('READ_NOT_CONFIGURED', 'The permissions file does not have the columns the read system expects, so nothing can be read.');
  });
  return f.records.filter(function (r) { return !r.tenant_id || r.tenant_id === tenant; });
}

/** Main entry for a read. Returns {table, fields, rows, ...} or throws err_. */
function sinkRead_(req) {
  var now = new Date(), nowMs = now.getTime();
  if (!readEnabled_()) throw err_('READ_OFF', 'Reading from the records is switched off.');
  var who = authStaff_(req.code);                       // a bad code stops here and gets nothing

  var key = typeof req.table === 'string' ? req.table : '';
  if (!Object.prototype.hasOwnProperty.call(READABLE, key)) {
    throw err_('FILE_NOT_ALLOWED', 'That is not a list the system can show you.');
  }
  var rd = READABLE[key];
  var audiences = { role: audienceFor_(who.role), person: who.id ? 'person:' + who.id : '' };
  var denied = err_('NOT_ALLOWED', 'Lisa has not allowed you to see this list.');
  if (!audiences.role && !audiences.person) throw denied;

  var tenant = prop_(BLD.PROP.TENANT_ID);
  if (!tenant) throw err_('NOT_CONFIGURED', 'The tenant id has not been set up in the script (TENANT_ID).');
  var access = readAccess_(readPolicy_(tenant), rd, audiences);
  if (!access) throw denied;

  var data = store_read_(rd.file, false);
  if (!data) throw err_('FILE_MISSING', 'That list does not exist yet.');

  var fields = data.header.filter(function (c) { return access.fields[c] === true && c !== 'tenant_id'; });
  if (!fields.length) throw denied;

  var sc = access.scope, cutoff = sc.days ? nowMs - sc.days * 86400000 : 0;
  var hasTenantCol = data.header.indexOf('tenant_id') >= 0;
  var rows = [], truncated = false;
  for (var i = 0; i < data.records.length; i++) {
    var r = data.records[i];
    if (hasTenantCol && r.tenant_id !== tenant) continue;
    if (sc.kind === 'own' && r[rd.authorCol] !== who.who) continue;
    if (sc.kind === 'own' || sc.kind === 'recent') {
      var t = Date.parse(r[rd.dateCol]);
      if (isNaN(t) || t < cutoff) continue;
    }
    if (rows.length >= BLD.LIMITS.READ_MAX_ROWS) { truncated = true; break; }
    var o = {};
    fields.forEach(function (c) { o[c] = r[c]; });
    rows.push(o);
  }
  return {
    table: key, fields: fields, rows: rows, count: rows.length, truncated: truncated,
    scope: sc.kind === 'all' ? 'all rows' : (sc.kind === 'own' ? 'your own rows from the last ' + sc.days + ' days' : 'rows from the last ' + sc.days + ' days'),
    as_of: londonIso_(now)
  };
}
