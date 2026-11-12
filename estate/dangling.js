// Web Estate Hub, Stage 15 (I5): dangling-record / subdomain-takeover check. Pure: no network, no Drive, no DOM.
// The engine gathers DNS records and an HTTP probe elsewhere; this file only classifies them.
// It only REPORTS. It never suggests deleting a record: keep or retire is a human decision.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateDangling = api;
})(this, function () {
  'use strict';

  var VERSION = '1.0.0';

  // Known hosted platforms. cname: suffixes (host equals or ends with '.' + suffix) or RegExps.
  // a: exact addresses or RegExps. body: lower-cased 'no such site' fingerprints (public, well known).
  // Where no reliable body fingerprint is known the list is empty and only a 404 or a parked page counts.
  var PLATFORMS = [
    // ClickFunnels: no stable public 'no such site' text known; 404 / parked only.
    { id: 'clickfunnels', name: 'ClickFunnels', cname: ['myclickfunnels.com', 'clickfunnels.com'], a: [], body: [] },
    { id: 'shopify', name: 'Shopify', cname: ['shops.myshopify.com', 'myshopify.com'], a: [/^23\.227\.38\.\d{1,3}$/],
      body: ['sorry, this shop is currently unavailable', 'only one step left'] },
    // Brilliant Directories: no reliable public fingerprint known; 404 / parked only.
    { id: 'brilliantdirectories', name: 'Brilliant Directories', cname: ['brilliantdirectories.com'], a: [], body: [] },
    // Webwave: no reliable public fingerprint known; 404 / parked only.
    { id: 'webwave', name: 'Webwave', cname: ['webwave.me', 'webwave.pl', 'webwave.dev'], a: [], body: [] },
    { id: 'github', name: 'GitHub Pages', cname: ['github.io'], a: [/^185\.199\.(108|109|110|111)\.153$/],
      body: ["there isn't a github pages site here", 'there isn&#39;t a github pages site here'] },
    { id: 'netlify', name: 'Netlify', cname: ['netlify.app', 'netlify.com'], a: [], body: ['not found - request id'] },
    { id: 'vercel', name: 'Vercel', cname: ['vercel.app', 'vercel-dns.com', 'now.sh'], a: ['76.76.21.21'],
      body: ['deployment_not_found', 'the deployment could not be found'] },
    { id: 'heroku', name: 'Heroku', cname: ['herokuapp.com', 'herokudns.com', 'herokussl.com'], a: [], body: ['no such app'] },
    { id: 's3', name: 'AWS S3', cname: [/(^|\.)s3[.-]([a-z0-9-]+\.)*amazonaws\.com$/, /(^|\.)s3-website[.-]([a-z0-9-]+\.)*amazonaws\.com$/], a: [],
      body: ['nosuchbucket', 'the specified bucket does not exist'] }
  ];

  // Generic parked / placeholder pages that mean nothing is served.
  var PARKED = ['this domain is parked', 'domain is parked', 'parked free', 'this domain is for sale', 'domain may be for sale', 'no site configured at this address'];

  function list(v) {
    if (v == null) return [];
    if (Array.isArray(v)) return v;
    return String(v).split(/[\s,;]+/);
  }
  function clean(s) {
    if (s == null || (typeof s !== 'string' && typeof s !== 'number')) return '';
    return String(s).trim().toLowerCase().replace(/\.$/, '');
  }
  function pick(records, names) {
    var out = [];
    if (!records || typeof records !== 'object') return out;
    names.forEach(function (n) { out = out.concat(list(records[n])); });
    return out.map(clean).filter(Boolean);
  }
  function matchName(target, m) {
    if (m instanceof RegExp) return m.test(target);
    return target === m || target.slice(-(m.length + 1)) === '.' + m;
  }
  function matchAddr(addr, m) { return m instanceof RegExp ? m.test(addr) : addr === m; }

  function byId(id) {
    for (var i = 0; i < PLATFORMS.length; i++) if (PLATFORMS[i].id === id) return PLATFORMS[i];
    return null;
  }

  // records { cname, a } (string or array; CNAME/A also accepted) -> platform id or null. CNAME wins over A.
  function platformOf(records) {
    var cnames = pick(records, ['cname', 'CNAME']);
    var addrs = pick(records, ['a', 'A']);
    var i, j;
    for (i = 0; i < PLATFORMS.length; i++) {
      for (j = 0; j < cnames.length; j++) if (PLATFORMS[i].cname.some(function (m) { return matchName(cnames[j], m); })) return PLATFORMS[i].id;
    }
    for (i = 0; i < PLATFORMS.length; i++) {
      for (j = 0; j < addrs.length; j++) if (PLATFORMS[i].a.some(function (m) { return matchAddr(addrs[j], m); })) return PLATFORMS[i].id;
    }
    return null;
  }

  // host, records, probe { status, body } -> { host, platform, risk: 'dangling'|'ok'|'unknown', reason }.
  // dangling = on a known platform AND (its no-such-site text, or 404, or a generic parked page).
  function check(host, records, probe) {
    var h = clean(host);
    var id = platformOf(records);
    var res = function (risk, reason) { return { host: h, platform: id, risk: risk, reason: reason }; };
    if (!id) return res('ok', 'not on a known hosted platform');
    var p = byId(id);
    if (!probe || typeof probe !== 'object') return res('unknown', 'points at ' + p.name + '; no probe result');
    var status = Number(probe.status);
    var body = typeof probe.body === 'string' ? probe.body.toLowerCase() : '';
    var hit = p.body.filter(function (f) { return body.indexOf(f) !== -1; })[0];
    if (hit) return res('dangling', p.name + ' no-such-site page ("' + hit + '")');
    if (status === 404) return res('dangling', p.name + ' answered 404');
    var parked = PARKED.filter(function (f) { return body.indexOf(f) !== -1; })[0];
    if (parked) return res('dangling', 'parked page ("' + parked + '")');
    if (!(status > 0) && !body) return res('unknown', 'points at ' + p.name + '; probe empty');
    return res('ok', p.name + ' serves a site' + (status > 0 ? ' (' + status + ')' : ''));
  }

  // results from check -> red alerts, dangling only. Report only; no record is ever changed.
  function alerts(results) {
    return (Array.isArray(results) ? results : []).filter(function (r) {
      return r && r.risk === 'dangling' && r.host;
    }).map(function (r) {
      var p = byId(r.platform);
      return { key: r.host, kind: 'dangling', level: 'red', text: r.host + ': points at ' + (p ? p.name : 'a hosted platform') + ' but no site behind it (takeover risk)' };
    });
  }

  return { VERSION: VERSION, PLATFORMS: PLATFORMS, PARKED: PARKED, platformOf: platformOf, check: check, alerts: alerts };
});
