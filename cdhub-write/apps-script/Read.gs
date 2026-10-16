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

/** What may this audience see of one list? null = nothing. */
function readAccess_(policy, rd, audience) {
  var fields = {}, hidden = {}, scope = null, scopeBad = false;
  policy.forEach(function (r) {
    if (r.table_name !== rd.vis || r.audience_id !== audience) return;
    var yes = String(r.visible || '').toLowerCase() === 'yes';
    if (r.field_name === '*') {
      if (!yes) { scopeBad = true; return; }
      var sc = parseScope_(r.condition, rd);
      if (!sc) { scopeBad = true; return; }
      if (!scope || sc.rank < scope.rank) scope = sc;   // if several, the narrowest wins
      return;
    }
    if (!yes) { hidden[r.field_name] = true; return; }
    if (String(r.condition || '').trim() !== '' || String(r.redaction || '').trim() !== '') return;
    fields[r.field_name] = true;
  });
  if (scopeBad || !scope) return null;
  Object.keys(hidden).forEach(function (k) { delete fields[k]; });
  if (!Object.keys(fields).length) return null;
  return { fields: fields, scope: scope };
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
  var audience = audienceFor_(who.role);
  var denied = err_('NOT_ALLOWED', 'Lisa has not allowed your role to see this list.');
  if (!audience) throw denied;

  var tenant = prop_(BLD.PROP.TENANT_ID);
  if (!tenant) throw err_('NOT_CONFIGURED', 'The tenant id has not been set up in the script (TENANT_ID).');
  var access = readAccess_(readPolicy_(tenant), rd, audience);
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
