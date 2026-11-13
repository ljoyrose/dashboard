// Web Estate Hub, Stage 14: two-source certificate check (I4). Pure: no network, no Drive, no DOM.
// Source (a) is the engine's live TLS read (row.ssl_expires); source (b) is the certificate transparency log
// (crt.sh JSON, fetched elsewhere and handed in). A TLS read taken from a cloud session is never trusted:
// its egress gateway re-signs every certificate, so that read is treated as absent, with the reason given.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateCertcheck = api;
})(this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var TOLERANCE = 1; // days; live and log dates this close still agree (time zones, renewal at midnight)
  var GATEWAY_MAX_LIFE = 31; // days; a re-signed gateway certificate lives about 30 days
  var GATEWAY_FRESH = 2; // days; and it is issued at (or just before) the moment of the request
  var DAY = 864e5;
  var MONTHS = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;

  // ---- dates ----
  // 2027-01-15, 2027-01-15T10:00:00, 15/01/2027, a Date, or the TLS form "Jan 15 10:00:00 2027 GMT".
  // Anything else is "no date", never a guess.
  function toMs(v) {
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v.getTime();
    var s = String(v == null ? '' : v).trim(), m;
    if (!s) return null;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s))) {
      return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    }
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
    if (MONTHS.test(s) && /\d{4}/.test(s)) {
      var t = Date.parse(/gmt|utc|z$|[+-]\d{4}$/i.test(s) ? s : s + ' GMT');
      return isNaN(t) ? null : t;
    }
    return null;
  }
  function ymd(ms) {
    if (ms === null || ms === undefined || isNaN(ms)) return null;
    return new Date(ms).toISOString().slice(0, 10);
  }
  function day(v) { return ymd(toMs(v)); }
  function nowMs(now) { var t = toMs(now === undefined ? new Date() : now); return t === null ? Date.now() : t; }

  // ---- hosts ----
  function cleanHost(h) {
    return String(h == null ? '' : h).trim().toLowerCase()
      .replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[\/?#].*$/, '').replace(/:\d+$/, '').replace(/\.$/, '');
  }
  // One certificate name (exact, or a *.example.com wildcard covering exactly one label) against a host.
  function nameCovers(name, host) {
    var n = cleanHost(name), h = cleanHost(host);
    if (!n || !h) return false;
    if (n === h) return true;
    if (n.slice(0, 2) !== '*.') return false;
    var rest = n.slice(2), dot = h.indexOf('.');
    return dot > 0 && h.slice(dot + 1) === rest;
  }
  // crt.sh name_value holds one name per line.
  function namesCover(nameValue, host) {
    return String(nameValue == null ? '' : nameValue).split(/[\r\n]+/).some(function (n) { return nameCovers(n, host); });
  }

  // ---- source (b): the certificate transparency log ----
  function parseLog(input) {
    if (Array.isArray(input)) return input;
    if (input && typeof input === 'object') return [input];
    if (typeof input !== 'string') return [];
    try {
      var v = JSON.parse(input);
      return Array.isArray(v) ? v : (v && typeof v === 'object' ? [v] : []);
    } catch (e) { return []; }
  }
  // Certificates in the log that cover host and are valid at now; a precertificate and its final certificate
  // (same issuer, same validity) count once.
  function logCerts(input, host, now) {
    var t = nowMs(now), seen = {}, out = [];
    parseLog(input).forEach(function (c) {
      if (!c || typeof c !== 'object') return;
      if (!namesCover(c.name_value, host) && !nameCovers(c.common_name, host)) return;
      var from = toMs(c.not_before), to = toMs(c.not_after);
      if (to === null || to <= t) return; // expired, or no end date
      if (from !== null && from > t) return; // not valid yet
      var k = String(c.issuer_name || '') + '|' + from + '|' + to;
      if (seen[k]) return;
      seen[k] = true;
      out.push({ id: c.id, issuer: String(c.issuer_name || ''), not_before: ymd(from), not_after: ymd(to), ms: to });
    });
    return out.sort(function (a, b) { return b.ms - a.ms; });
  }
  // crt.sh JSON (array or text) -> latest currently-valid not_after as YYYY-MM-DD, or null. Never throws.
  function fromCrtSh(input, host, now) {
    try {
      var list = logCerts(input, host, now);
      return list.length ? list[0].not_after : null;
    } catch (e) { return null; }
  }

  // ---- source (a): the live TLS read ----
  // The egress gateway of a cloud session re-signs certificates: an issuer naming an egress gateway, or a
  // certificate issued at the moment of the request with a life of about 30 days.
  function isGatewayCert(cert, now) {
    if (!cert || typeof cert !== 'object') return false;
    var issuer = String(cert.issuer || cert.issuer_name || cert.ssl_issuer || '');
    if (/egress|gateway/i.test(issuer)) return true;
    var from = toMs(cert.notBefore || cert.not_before || cert.ssl_not_before);
    var to = toMs(cert.notAfter || cert.not_after || cert.ssl_expires);
    var seen = toMs(cert.read_at || cert.ssl_read_at || now);
    if (from === null || to === null || seen === null) return false;
    var life = (to - from) / DAY;
    return life > 0 && life <= GATEWAY_MAX_LIFE && Math.abs(seen - from) <= GATEWAY_FRESH * DAY;
  }
  // A row -> { date, reason }. date null means no live read to trust; reason says why.
  function liveFromRow(row, now) {
    var r = row || {};
    var date = day(r.ssl_expires);
    if (!date) return { date: null, reason: 'no live read' };
    if (/cloud|session|sandbox/i.test(String(r.ssl_source || r.ssl_read_from || ''))) {
      return { date: null, reason: 'live read from a cloud session rejected' };
    }
    var cert = { issuer: r.ssl_issuer, notBefore: r.ssl_not_before, notAfter: r.ssl_expires, read_at: r.ssl_read_at };
    if (isGatewayCert(cert, r.ssl_read_at ? undefined : now)) {
      return { date: null, reason: 'live read rejected: egress gateway certificate' };
    }
    return { date: date, reason: '' };
  }

  // ---- compare ----
  // liveDate, logDate (any date form, or empty) -> { result, live, log, text }.
  function compare(liveDate, logDate, opts) {
    var o = opts || {};
    var tol = typeof o.toleranceDays === 'number' && o.toleranceDays >= 0 ? o.toleranceDays : TOLERANCE;
    var live = day(liveDate), log = day(logDate);
    var why = o.liveReason ? ' (' + o.liveReason + ')' : '';
    if (live && log) {
      var gap = Math.round(Math.abs(toMs(live) - toMs(log)) / DAY);
      if (gap <= tol) return { result: 'agree', live: live, log: log, text: 'Cert sources agree: ' + log + (gap ? ' (' + gap + ' day apart)' : '') };
      return { result: 'disagree', live: live, log: log, text: 'Cert sources disagree: live ' + live + ', log ' + log + ' (' + gap + ' days apart)' };
    }
    if (live) return { result: 'live only', live: live, log: null, text: 'Live read only: ' + live + ' (not in certificate log)' };
    if (log) return { result: 'log only', live: null, log: log, text: 'Certificate log only: ' + log + why };
    return { result: 'none', live: null, log: null, text: 'No certificate date from either source' + why };
  }

  var CHIPS = {
    'agree': { label: 'Cert sources agree', level: 'ok' },
    'disagree': { label: 'Cert sources disagree', level: 'amber' },
    'live only': { label: 'Live read only', level: 'info' },
    'log only': { label: 'Certificate log only', level: 'info' },
    'none': { label: 'No certificate date', level: 'grey' }
  };
  // A result word, or a compare() result -> { label, level }.
  function chip(result) {
    var k = result && typeof result === 'object' ? result.result : result;
    var c = CHIPS[k] || CHIPS.none;
    return { label: c.label, level: c.level };
  }

  // rows, crtByHost ({ host: crt.sh JSON or text }), now -> { [row.key]: compare result + chip + liveReason }.
  function checkRows(rows, crtByHost, now) {
    var out = {}, crt = crtByHost || {};
    (rows || []).forEach(function (r) {
      if (!r || !r.key) return;
      var host = cleanHost(r.url_or_domain || r.key);
      var raw = Object.prototype.hasOwnProperty.call(crt, host) ? crt[host] : crt[r.key];
      var live = liveFromRow(r, now);
      var res = compare(live.date, fromCrtSh(raw, host, now), { liveReason: live.reason && live.reason !== 'no live read' ? live.reason : '' });
      res.host = host;
      res.liveReason = live.reason;
      res.chip = chip(res.result);
      out[r.key] = res;
    });
    return out;
  }

  return {
    VERSION: VERSION,
    TOLERANCE: TOLERANCE,
    toDay: day,
    nameCovers: nameCovers,
    namesCover: namesCover,
    logCerts: logCerts,
    fromCrtSh: fromCrtSh,
    isGatewayCert: isGatewayCert,
    liveFromRow: liveFromRow,
    compare: compare,
    chip: chip,
    checkRows: checkRows
  };
});
