/** Checking what the browser sends. Every message is plain English: staff read them. */

/** Build an Error that carries a machine code and a plain-English message. */
function err_(code, message, extra) {
  var e = new Error(message);
  e.code = code;
  e.userMessage = message;
  if (extra) for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) e[k] = extra[k];
  return e;
}

var TEMP_RE_ = /^-?\d{1,2}(\.\d{1,2})?$/;
var ID_RE_ = /^[A-Za-z0-9][A-Za-z0-9_.\-]{0,80}$/;
var DATE_RE_ = /^\d{4}-\d{2}-\d{2}$/;
var ISO_DT_RE_ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+\-]\d{2}:\d{2})$/;
// eslint-disable-next-line no-control-regex
var CONTROL_RE_ = /[\u0000-\u0008\u000a-\u001f\u007f]/;

function isRealDate_(s) {
  if (!DATE_RE_.test(s)) return false;
  var p = s.split('-'), y = +p[0], m = +p[1], d = +p[2];
  var dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Check browser input against a table spec.
 * @return {{clean:Object, errors:Object}} errors maps field name -> message.
 */
function validateInput_(spec, fields, lookups, nowMs) {
  var errors = {}, clean = {};
  fields = fields || {};
  var name;

  for (name in fields) {
    if (Object.prototype.hasOwnProperty.call(fields, name) &&
        !Object.prototype.hasOwnProperty.call(spec.input, name)) {
      errors[name] = 'This is not a field you can set. The system fills it in.';
    }
  }

  for (name in spec.input) {
    if (!Object.prototype.hasOwnProperty.call(spec.input, name)) continue;
    var def = spec.input[name];
    var raw = fields[name];
    if (Array.isArray(raw) && def.type === 'idlist') raw = raw.join('|');
    var v = (raw === undefined || raw === null) ? '' : String(raw).trim();
    if (v === '' && def.dflt !== undefined) v = def.dflt;
    if (v === '') {
      if (def.required) errors[name] = 'This is needed.';
      clean[name] = '';
      continue;
    }
    switch (def.type) {
      case 'text':
        if (v.length > BLD.LIMITS.MAX_TEXT_CHARS) errors[name] = 'Too long (keep it under ' + BLD.LIMITS.MAX_TEXT_CHARS + ' characters).';
        else if (CONTROL_RE_.test(v)) errors[name] = 'Please use plain text on one line.';
        else if (/^[=+\-@\t]/.test(v)) errors[name] = 'Please do not start with = + - or @ (spreadsheets would treat it as a formula).';
        else clean[name] = v;
        break;
      case 'temp':
        if (!TEMP_RE_.test(v)) {
          errors[name] = 'Type a temperature in degrees C with at most 2 decimals, e.g. 21.47.';
        } else {
          var n = parseFloat(v);
          if (n < BLD.LIMITS.TEMP_MIN || n > BLD.LIMITS.TEMP_MAX) errors[name] = 'That is outside ' + BLD.LIMITS.TEMP_MIN + ' to ' + BLD.LIMITS.TEMP_MAX + ' C. Check the number.';
          else clean[name] = n.toFixed(2);
        }
        break;
      case 'bool':
        if (/^(true|yes|1)$/i.test(v)) clean[name] = 'true';
        else if (/^(false|no|0)$/i.test(v)) clean[name] = 'false';
        else errors[name] = 'Choose yes or no.';
        break;
      case 'enum':
        if (def.values.indexOf(v) < 0) errors[name] = 'Not one of: ' + def.values.join(', ') + '.';
        else clean[name] = v;
        break;
      case 'date':
        if (!isRealDate_(v)) errors[name] = 'Use a real date as YYYY-MM-DD.';
        else clean[name] = v;
        break;
      case 'datetime':
        if (!ISO_DT_RE_.test(v) || isNaN(Date.parse(v))) {
          errors[name] = 'Use a date and time with its time zone, e.g. 2026-10-15T07:40:00+01:00.';
        } else {
          var t = Date.parse(v);
          if (t > nowMs + 5 * 60000) errors[name] = 'That time is in the future.';
          else if (t < nowMs - BLD.LIMITS.PERIOD_MAX_AGE_HOURS * 3600000) errors[name] = 'That is more than 7 days ago. Ask Lisa to add it.';
          else clean[name] = v;
        }
        break;
      case 'count':
        if (!/^\d{1,3}$/.test(v)) errors[name] = 'Use a whole number from 0 to 999.';
        else clean[name] = String(parseInt(v, 10));
        break;
      case 'idlist': {
        // a pipe-separated list of ids, each of which must exist in the lookup. Sorted and de-duplicated so the
        // same set of dogs always gives the same text (the repeat-tap guard relies on it).
        var parts = v.split('|').map(function (x) { return x.trim(); }).filter(String), seenIds = {}, uniq = [], badIds = [], j;
        for (j = 0; j < parts.length; j++) {
          if (seenIds[parts[j]]) continue;
          seenIds[parts[j]] = true; uniq.push(parts[j]);
        }
        if (!uniq.length) errors[name] = 'This is needed.';
        else if (uniq.length > (def.max || BLD.LIMITS.CHECK_MAX_DOGS)) errors[name] = 'Too many dogs in one list (the limit is ' + (def.max || BLD.LIMITS.CHECK_MAX_DOGS) + ').';
        else if (!lookups[def.lookup]) errors[name] = 'Cannot check this against ' + def.lookup + ' right now.';
        else {
          for (j = 0; j < uniq.length; j++) if (!ID_RE_.test(uniq[j]) || !lookups[def.lookup][uniq[j]]) badIds.push(uniq[j]);
          if (badIds.length) errors[name] = 'Not found in the ' + def.lookup + ' list: ' + badIds.slice(0, 3).join(', ') + (badIds.length > 3 ? ' and ' + (badIds.length - 3) + ' more' : '') + '.';
          else clean[name] = uniq.sort().join('|');
        }
        break;
      }
      case 'ref':
        if (!ID_RE_.test(v)) {
          errors[name] = 'That is not a valid id.';
        } else if (!lookups[def.lookup]) {
          errors[name] = 'Cannot check this against ' + def.lookup + ' right now.';
        } else if (!lookups[def.lookup][v]) {
          errors[name] = 'Not found in the ' + def.lookup + ' list: ' + v + '.';
        } else {
          clean[name] = v;
        }
        break;
      default:
        errors[name] = 'Unknown field type.';
    }
  }
  if (spec.checkRow) spec.checkRow(clean, errors);
  return { clean: clean, errors: errors };
}

/** Build a complete row object in table-column order from validated input. */
function buildRow_(spec, clean, ctx) {
  var row = {}, i;
  for (i = 0; i < spec.columns.length; i++) row[spec.columns[i]] = '';
  for (var k in clean) if (Object.prototype.hasOwnProperty.call(clean, k)) row[k] = clean[k];
  row.id = ctx.rowId;
  row.tenant_id = ctx.tenantId;
  if (ctx.correctsId) row.corrects_id = ctx.correctsId;
  spec.stamp(row, ctx);
  return row;
}

function rowValues_(columns, row) {
  return columns.map(function (c) { return row[c] === undefined ? '' : row[c]; });
}

/** Readable id: rdg-20261015-223107-k3f9 (London time) */
function newId_(prefix, d) {
  var stamp = Utilities.formatDate(d, BLD.TZ, 'yyyyMMdd-HHmmss');
  var rnd = '', chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  for (var i = 0; i < 4; i++) rnd += chars.charAt(Math.floor(Math.random() * chars.length));
  return prefix + '-' + stamp + '-' + rnd;
}

function londonIso_(d) {
  return Utilities.formatDate(d, BLD.TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}
