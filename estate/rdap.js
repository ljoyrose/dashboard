// Web Estate Hub, Stage 13: registration expiry via RDAP (I3), no registrar login. Pure: no network, no Drive, no DOM.
// The engine fetches rdapUrl(domain); this file only routes a domain to its registry, reads the JSON reply
// and fills an empty renewal date on a RR_DOMAINS-AND-HOSTING row. It never overwrites a value already there.
// The server map is a small static copy of IANA bootstrap knowledge; the bootstrap file is never fetched.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateRdap = api;
})(this, function () {
  'use strict';

  var VERSION = '1.0.0';

  // ---- servers ----
  var UK = 'https://rdap.nominet.uk/uk/';
  var GOOGLE = 'https://pubapi.registry.google/rdap/';
  var SERVERS = {
    uk: UK,
    com: 'https://rdap.verisign.com/com/v1/',
    net: 'https://rdap.verisign.com/net/v1/',
    org: 'https://rdap.publicinterestregistry.org/rdap/',
    app: GOOGLE,
    dev: GOOGLE,
    page: GOOGLE
  };

  // ---- domains ----
  // Second-level suffixes where the registrable name keeps three labels (example.co.uk).
  var TWO_LEVEL = /\.(co|org|me|ltd|plc|net|sch|ac|gov|nhs|police)\.uk$/;

  function clean(v) {
    var h = String(v == null ? '' : v).trim().toLowerCase();
    h = h.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^[^@\/]*@/, '').replace(/[\/?#:].*$/, '').replace(/\.+$/, '');
    return h;
  }

  // 'https://www.shop.example.co.uk/x' -> 'example.co.uk'; '' when nothing usable.
  function registrable(domain) {
    var h = clean(domain);
    if (!h || !/^[a-z0-9.-]+$/.test(h)) return '';
    var labels = h.split('.').filter(Boolean);
    if (labels.length < 2) return '';
    var keep = TWO_LEVEL.test(h) ? 3 : 2;
    if (labels.length < keep) return '';
    return labels.slice(-keep).join('.');
  }

  function tldOf(domain) {
    var d = registrable(domain);
    return d ? d.slice(d.lastIndexOf('.') + 1) : '';
  }

  // RDAP base URL (ends with '/') for the domain's TLD; null when the TLD is not in the map.
  function serverFor(domain) {
    var t = tldOf(domain);
    return (t && Object.prototype.hasOwnProperty.call(SERVERS, t)) ? SERVERS[t] : null;
  }

  // Full lookup URL for the registrable domain; null when no server is known.
  function rdapUrl(domain) {
    var base = serverFor(domain);
    return base ? base + 'domain/' + registrable(domain) : null;
  }

  // ---- reply ----
  function isoDate(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v == null ? '' : v).trim());
    return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
  }

  function vcardFn(entity) {
    var v = entity && entity.vcardArray;
    var rows = (Array.isArray(v) && Array.isArray(v[1])) ? v[1] : [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (Array.isArray(r) && String(r[0]).toLowerCase() === 'fn' && typeof r[3] === 'string' && r[3].trim()) return r[3].trim();
    }
    return '';
  }

  function registrarName(entity) {
    var name = vcardFn(entity);
    if (name) return name;
    var ids = Array.isArray(entity.publicIds) ? entity.publicIds : [];
    for (var i = 0; i < ids.length; i++) {
      if (ids[i] && ids[i].identifier != null && String(ids[i].identifier).trim()) return String(ids[i].identifier).trim();
    }
    if (entity.handle != null && String(entity.handle).trim()) return String(entity.handle).trim();
    return '';
  }

  function findRegistrar(ents, depth) {
    if (!Array.isArray(ents) || depth > 4) return '';
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (!e || typeof e !== 'object') continue;
      var roles = Array.isArray(e.roles) ? e.roles.map(function (r) { return String(r).toLowerCase(); }) : [];
      if (roles.indexOf('registrar') !== -1) {
        var n = registrarName(e);
        if (n) return n;
      }
    }
    for (var j = 0; j < ents.length; j++) {
      var found = ents[j] && typeof ents[j] === 'object' ? findRegistrar(ents[j].entities, depth + 1) : '';
      if (found) return found;
    }
    return '';
  }

  // RDAP domain JSON (object or JSON text) -> { expires, registered, registrar, status }. Never throws.
  function parse(json) {
    var out = { expires: null, registered: null, registrar: null, status: [] };
    var doc = json;
    try {
      if (typeof doc === 'string') doc = JSON.parse(doc);
    } catch (e) { return out; }
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return out;
    try {
      (Array.isArray(doc.events) ? doc.events : []).forEach(function (ev) {
        if (!ev || typeof ev !== 'object') return;
        var action = String(ev.eventAction || '').toLowerCase();
        var d = isoDate(ev.eventDate);
        if (!d) return;
        if (action === 'expiration' && !out.expires) out.expires = d;
        if (action === 'registration' && !out.registered) out.registered = d;
      });
      out.registrar = findRegistrar(doc.entities, 0) || null;
      (Array.isArray(doc.status) ? doc.status : []).forEach(function (s) {
        if (typeof s === 'string' && s.trim() && out.status.indexOf(s.trim()) === -1) out.status.push(s.trim());
      });
    } catch (e) { /* keep what was read */ }
    return out;
  }

  // ---- filling rows ----
  // Same names as estate/status.js EXPIRY_COLS / DOMAIN_COLS (matched trimmed, lower case).
  var EXPIRY_COLS = ['expiry', 'expires', 'expiry_date', 'expiry date', 'expiration', 'expiration_date', 'expiration date', 'expires_on', 'renewal_date', 'renewal date', 'renewal', 'renews', 'domain_expires'];
  var DOMAIN_COLS = ['domain', 'domain_name', 'domain name', 'name', 'host', 'url', 'url_or_domain'];

  function pick(row, cols) {
    var keys = Object.keys(row || {});
    for (var i = 0; i < cols.length; i++) {
      for (var j = 0; j < keys.length; j++) {
        var v = row[keys[j]];
        if (keys[j].trim().toLowerCase() === cols[i] && v != null && String(v).trim() !== '') return String(v).trim();
      }
    }
    return '';
  }

  function hasExpiry(row) { return pick(row, EXPIRY_COLS) !== ''; }

  // New row; domain_expires (+ domain_expires_source 'rdap') only when the row has no expiry anywhere.
  function fill(row, parsed) {
    var out = {};
    Object.keys(row || {}).forEach(function (k) { out[k] = row[k]; });
    var exp = parsed && isoDate(parsed.expires);
    if (!exp || hasExpiry(row)) return out;
    out.domain_expires = exp;
    out.domain_expires_source = 'rdap';
    return out;
  }

  // resultsByDomain: { 'example.com': parsed result or raw RDAP JSON }. Keys are matched by registrable domain.
  function fillRows(domainRows, resultsByDomain) {
    var byDomain = {};
    var src = (resultsByDomain && typeof resultsByDomain === 'object') ? resultsByDomain : {};
    Object.keys(src).forEach(function (k) {
      var d = registrable(k);
      if (!d) return;
      var v = src[k];
      var isParsed = v && typeof v === 'object' && !Array.isArray(v) && 'expires' in v && !('events' in v);
      byDomain[d] = isParsed ? v : parse(v);
    });
    return (Array.isArray(domainRows) ? domainRows : []).map(function (row) {
      var d = registrable(pick(row, DOMAIN_COLS));
      return fill(row, d ? byDomain[d] : null);
    });
  }

  return {
    VERSION: VERSION,
    SERVERS: SERVERS,
    EXPIRY_COLS: EXPIRY_COLS,
    registrable: registrable,
    serverFor: serverFor,
    rdapUrl: rdapUrl,
    parse: parse,
    hasExpiry: hasExpiry,
    fill: fill,
    fillRows: fillRows
  };
});
