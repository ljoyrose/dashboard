// Web Estate Hub, Stage 17 (I1): address-level mail map. ONE ROW PER ADDRESS, not per domain.
// Pure: no network, no Drive, no DOM. Real addresses live only in the private sheet; this module only processes
// the rows it is given. Nothing here changes DNS, a registrar, a forward or a mailbox.
// Inputs: A) forwarding rows from a registrar export (alias -> forward to), B) per-domain estate rows (MX),
// C) login rows { address, service }. Reuses estate/mail.js for MX host words.
(function (root, factory) {
  'use strict';
  var mail = (typeof module === 'object' && module.exports) ? require('./mail.js') : root.EstateMail;
  var api = factory(mail);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateMailmap = api;
})(this, function (M) {
  'use strict';

  var VERSION = '1.0.0';
  var MAX_HOPS = 8; // a chain longer than this is cut and read as unknown
  var EMPTY_TEXT = 'Registrar export needed';

  // Header aliases, compared after lower-casing and folding spaces, _ and - to one space.
  var FROM = ['alias', 'mailbox', 'from', 'source', 'address', 'email', 'forward from', 'forwarding address', 'alias email'];
  var TO = ['forward to', 'forwards to', 'forwarded to', 'destination', 'to', 'target', 'forward', 'forward address', 'recipient'];
  var DOMAIN = ['domain', 'domain name', 'url or domain', 'host', 'key'];
  var MXCOL = ['mx', 'mx host', 'mail host', 'mail', 'mx provider'];
  var LOGIN_ADDR = ['address', 'email', 'login', 'username', 'login email', 'account email'];
  var SERVICE = ['service', 'services', 'app', 'site', 'name', 'used by'];

  var FORWARD_WORDS = /forward|improvmx|email routing|registrar-servers/i;

  var RISKS = {
    loop: { level: 'red', text: 'forward loop' },
    'too deep': { level: 'red', text: 'forward chain too long' },
    'target unknown': { level: 'amber', text: 'target unknown, needs registrar export' },
    'forward-only login': { level: 'amber', text: 'forward-only login (a broken forward means no password resets)' },
    'more than one hop': { level: 'amber', text: 'more than one forward hop' }
  };
  var ORDER = ['loop', 'too deep', 'target unknown', 'forward-only login', 'more than one hop'];

  function fold(k) { return String(k == null ? '' : k).trim().toLowerCase().replace(/[\s_-]+/g, ' '); }
  function str(v) { return (v == null || typeof v === 'object') ? '' : String(v).trim(); }

  // Rows may be objects (any header case) or arrays of arrays with a header row first. Anything else is dropped.
  function objects(rows) {
    if (!Array.isArray(rows)) return [];
    var list = rows.filter(function (r) { return r && typeof r === 'object'; });
    if (list.length && Array.isArray(list[0])) {
      var head = list[0].map(fold);
      return list.slice(1).filter(Array.isArray).map(function (r) {
        var o = {};
        head.forEach(function (h, i) { if (h) o[h] = r[i]; });
        return o;
      });
    }
    return list.filter(function (r) { return !Array.isArray(r); }).map(function (r) {
      var o = {};
      Object.keys(r).forEach(function (k) { o[fold(k)] = r[k]; });
      return o;
    });
  }

  function pick(o, names) {
    for (var i = 0; i < names.length; i++) { var v = str(o[names[i]]); if (v) return v; }
    return '';
  }
  function pickRaw(o, names) {
    for (var i = 0; i < names.length; i++) if (o[names[i]] != null && o[names[i]] !== '') return o[names[i]];
    return '';
  }

  function cleanAddr(a) { return String(a || '').trim().toLowerCase().replace(/^mailto:/, '').replace(/^<|>$/g, ''); }
  function domainOf(a) { var i = a.lastIndexOf('@'); return i === -1 ? '' : a.slice(i + 1); }
  function cleanDomain(d) {
    var s = String(d || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').split('/')[0].replace(/^www\./, '').replace(/\.$/, '');
    return s.indexOf('@') !== -1 ? domainOf(s) : s;
  }
  function isAddr(a) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a); }

  // One MX value (mail.js object, provider word, 'present · word' label or a host name) -> its kind.
  // 'forwarder' | 'mailbox' | 'none' | '' (not known).
  function mxKind(mx) {
    if (mx && typeof mx === 'object') {
      if (mx.forwarding) return 'forwarder';
      var w = String(mx.word || '').toLowerCase();
      if (!w) return '';
      if (w === 'none' || mx.present === false) return 'none';
      return FORWARD_WORDS.test(w) ? 'forwarder' : 'mailbox';
    }
    var s = str(mx).replace(/^present\s*·\s*/i, '');
    if (!s) return '';
    if (/^none$/i.test(s)) return 'none';
    var info = mxInfo(s);
    return info.forwarding ? 'forwarder' : 'mailbox';
  }

  // Provider word for a mailbox host (Google Workspace, SiteGround, ...) via mail.js when the value is a host name.
  function mxInfo(s) {
    if (/^[a-z0-9.-]+\.[a-z]{2,}\.?$/i.test(s) && M && M.mxHost) {
      var r = M.mxHost({ Answer: [{ type: 15, data: '10 ' + s }] });
      return { word: r.word, forwarding: !!r.forwarding || FORWARD_WORDS.test(s) };
    }
    return { word: s, forwarding: FORWARD_WORDS.test(s) };
  }
  function mxWord(mx) {
    if (mx && typeof mx === 'object') return str(mx.word);
    return mxInfo(str(mx).replace(/^present\s*·\s*/i, '')).word;
  }

  // Registrar export rows -> { address: [targets] }. An alias with no @ takes the row's domain column.
  // '*' or '@domain' is a catch-all for that domain. A cell may list several targets (comma or semicolon).
  function forwardMap(forwardRows) {
    var map = {};
    objects(forwardRows).forEach(function (o) {
      var from = cleanAddr(pick(o, FROM)), dom = cleanDomain(pick(o, DOMAIN));
      if (!from) return;
      if (from.indexOf('@') === -1) { if (!dom) return; from = from + '@' + dom; }
      if (from.charAt(0) === '@') from = '*' + from;
      var targets = pick(o, TO).split(/[,;\s]+/).map(cleanAddr).filter(isAddr);
      if (!targets.length) return;
      map[from] = (map[from] || []).concat(targets.filter(function (t) { return (map[from] || []).indexOf(t) === -1; }));
    });
    return map;
  }

  function domainMap(domainRows) {
    var map = {};
    objects(domainRows).forEach(function (o) {
      var d = cleanDomain(pick(o, DOMAIN) || pick(o, ['url']));
      if (!d) return;
      var mx = pickRaw(o, MXCOL);
      map[d] = { kind: mxKind(mx), word: mxWord(mx) };
    });
    return map;
  }

  function loginMap(loginRows) {
    var map = {};
    objects(loginRows).forEach(function (o) {
      var a = cleanAddr(pick(o, LOGIN_ADDR));
      if (!isAddr(a)) return;
      var services = pick(o, SERVICE).split(/\s*[;|]\s*/).filter(Boolean);
      map[a] = map[a] || [];
      services.forEach(function (s) { if (map[a].indexOf(s) === -1) map[a].push(s); });
    });
    return map;
  }

  function nextOf(fmap, a) {
    if (fmap[a]) return fmap[a];
    var d = domainOf(a);
    return d && fmap['*@' + d] ? fmap['*@' + d] : null;
  }

  function emptyState(forwardRows) {
    var n = Object.keys(forwardMap(forwardRows)).length;
    return n ? { empty: false, text: '' } : { empty: true, text: EMPTY_TEXT };
  }

  // One address -> its map row.
  function resolve(addr, fmap, dmap, logins, exportGiven) {
    var path = [addr], cur = addr, risks = [], reason = '', kind, landsAt, also = [];
    var stop = '';
    for (;;) {
      var next = nextOf(fmap, cur);
      if (!next) break;
      if (cur === addr) also = next.slice(1);
      var t = next[0];
      if (path.indexOf(t) !== -1) { path.push(t); stop = 'loop'; break; }
      path.push(t);
      cur = t;
      if (path.length - 1 > MAX_HOPS) { stop = 'too deep'; break; }
    }
    var hops = path.length - 1;
    var fin = dmap[domainOf(cur)] || { kind: '', word: '' };
    if (stop) {
      kind = 'unknown';
      landsAt = '';
      risks.push(stop);
      reason = stop === 'loop' ? 'forward loop' : 'more than ' + MAX_HOPS + ' hops';
    } else if (hops === 0) {
      landsAt = '';
      if (fin.kind === 'mailbox') { kind = 'mailbox'; landsAt = fin.word || domainOf(cur); path.push(landsAt); }
      else if (!exportGiven) { kind = 'unknown'; reason = 'export needed'; }
      else if (fin.kind === 'forwarder') { kind = 'unknown'; risks.push('target unknown'); reason = 'no export row for this address'; }
      else if (fin.kind === 'none') { kind = 'unknown'; reason = 'domain has no MX'; }
      else { kind = 'unknown'; reason = 'domain not in estate'; }
    } else {
      kind = 'forward-only';
      landsAt = cur;
      if (fin.kind === 'mailbox' && fin.word) path.push(fin.word);
      else if (fin.kind === 'forwarder') { risks.push('target unknown'); reason = 'final address sits at a forwarder with no export row'; }
    }
    var services = logins[addr] || [];
    if (kind === 'forward-only' && services.length) risks.push('forward-only login');
    if (!stop && hops > 1) risks.push('more than one hop');
    risks = ORDER.filter(function (r) { return risks.indexOf(r) !== -1; });
    var row = {
      address: addr, lands_at: landsAt, hops: hops, path: path, kind: kind, logins: services.slice(),
      risk: risks[0] || '', risks: risks, level: risks.length ? RISKS[risks[0]].level : '', reason: reason
    };
    if (also.length) row.also = also;
    return row;
  }

  // forwardRows, domainRows, loginRows -> one row per address (forward sources first, in export order, then logins).
  function build(forwardRows, domainRows, loginRows) {
    var fmap = forwardMap(forwardRows), dmap = domainMap(domainRows), logins = loginMap(loginRows);
    var exportGiven = Object.keys(fmap).length > 0;
    var seen = {}, order = [];
    Object.keys(fmap).concat(Object.keys(logins)).forEach(function (a) {
      if (a.charAt(0) === '*' || seen[a]) return;
      seen[a] = true;
      order.push(a);
    });
    return order.map(function (a) { return resolve(a, fmap, dmap, logins, exportGiven); });
  }

  // rows -> [{ key, kind: 'mailmap', level, text }] (alerts.js shape). One per risk; red first, row order kept.
  function alerts(rows) {
    var out = [];
    (Array.isArray(rows) ? rows : []).forEach(function (r) {
      if (!r || typeof r !== 'object' || !r.address) return;
      var list = Array.isArray(r.risks) ? r.risks : (r.risk ? [r.risk] : []);
      list.forEach(function (k) {
        var def = RISKS[k];
        if (!def) return;
        var text = def.text;
        if ((k === 'loop' || k === 'more than one hop' || k === 'too deep') && Array.isArray(r.path)) text += ' (' + r.path.join(' → ') + ')';
        if (k === 'forward-only login' && Array.isArray(r.logins) && r.logins.length) text += ': ' + r.logins.join(', ');
        out.push({ key: r.address, kind: 'mailmap', level: def.level, text: r.address + ': ' + text });
      });
    });
    return out.filter(function (a) { return a.level === 'red'; }).concat(out.filter(function (a) { return a.level !== 'red'; }));
  }

  return {
    VERSION: VERSION,
    MAX_HOPS: MAX_HOPS,
    EMPTY_TEXT: EMPTY_TEXT,
    mxKind: mxKind,
    forwardMap: forwardMap,
    emptyState: emptyState,
    build: build,
    alerts: alerts
  };
});
