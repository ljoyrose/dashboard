// Web Estate Hub: pure logic shared by the page (estate/), the node tests and the Apps Script engine.
// No network, no Drive, no DOM. The engine embeds a copy of this file under a version header.
// Every example in the tests is invented (example.com style); no estate row ever lives in this repo.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateCore = api;
})(this, function () {
  'use strict';

  var VERSION = '1.0.0';

  // ---- CSV ----
  // RFC 4180 style: quoted fields may hold commas, quotes ("") and new lines. Drops a start-of-file marker.
  function parseCSV(text) {
    var rows = [], row = [], cell = '', q = false, i = 0, s = String(text || '');
    if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
    for (; i < s.length; i++) {
      var c = s[i];
      if (q) {
        if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && s[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); if (row.length > 1 || row[0] !== '') rows.push(row); }
    return rows;
  }

  // Rows of arrays -> objects keyed by the trimmed, lower-cased header.
  function toObjects(rows) {
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
    return rows.slice(1).map(function (r) {
      var o = {};
      head.forEach(function (h, i) { o[h] = r[i] === undefined ? '' : String(r[i]).trim(); });
      return o;
    });
  }

  // ---- targets ----
  var DOMAIN_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,62}[a-z0-9]$/;

  // Turns what Lisa pastes (a URL, a bare domain, a funnel or app link) into one canonical form.
  // Refuses anything that is not http, https or a bare domain.
  function normaliseTarget(input) {
    var raw = String(input == null ? '' : input).trim();
    if (!raw) return { ok: false, reason: 'empty' };
    var scheme = /^([a-z][a-z0-9+.-]*):/i.exec(raw);
    var url;
    if (scheme) {
      var sch = scheme[1].toLowerCase();
      if (sch !== 'http' && sch !== 'https') return { ok: false, reason: 'only http, https or a bare domain' };
      if (!/^https?:\/\//i.test(raw)) return { ok: false, reason: 'not a web address' };
      url = raw;
    } else {
      if (/[\s<>"'`]/.test(raw) || /^\/\//.test(raw)) return { ok: false, reason: 'not a web address' };
      url = 'https://' + raw;
    }
    var m = /^(https?):\/\/([^\/?#]+)([^?#]*)/i.exec(url);
    if (!m) return { ok: false, reason: 'not a web address' };
    var hostPort = m[2];
    if (hostPort.indexOf('@') !== -1) return { ok: false, reason: 'addresses with a login part are refused' };
    var host = hostPort.replace(/:\d+$/, '').replace(/\.$/, '').toLowerCase();
    if (!DOMAIN_RE.test(host)) return { ok: false, reason: 'not a domain name' };
    var path = m[3].replace(/\/+$/, '');
    var domain = host.replace(/^www\./, '');
    return {
      ok: true,
      bare: !scheme,
      scheme: m[1].toLowerCase(),
      host: host,
      domain: domain,
      path: path,
      key: domain + path,
      url: m[1].toLowerCase() + '://' + host + (path || '/')
    };
  }

  // The merge key for a row: the canonical host (no www.) plus path. Rows with no readable address (a funnel or an app
  // known only by name) keep their own key, so they never fold into each other.
  // A DNS zone, an email domain or an ads account is its own row beside the site on the same domain.
  var FACET_KINDS = ['dns-zone', 'email-domain', 'ads-account'];
  function keyOf(row) {
    var t = normaliseTarget(row.url_or_domain || row.domain || row.url || '');
    if (t.ok) return (FACET_KINDS.indexOf(row.kind) !== -1 ? row.kind + ':' : '') + t.key;
    return row.key ? String(row.key).trim() : 'raw:' + String(row.url_or_domain || row.name || '').trim().toLowerCase();
  }

  // Merges rows that point at the same place. The first non-empty value wins per column; sources are joined.
  // Returns { rows, duplicates } where duplicates counts the rows folded into an earlier one.
  function mergeRows(rows) {
    var byKey = {}, order = [], duplicates = 0;
    (rows || []).forEach(function (r) {
      var k = keyOf(r);
      if (!byKey[k]) { byKey[k] = Object.assign({}, r, { key: k }); order.push(k); return; }
      duplicates++;
      var into = byKey[k];
      Object.keys(r).forEach(function (col) {
        if (col === 'key') return;
        var v = r[col];
        if (col === 'source') {
          var have = String(into.source || '').split(' + ').filter(Boolean);
          String(v || '').split(' + ').forEach(function (s) { if (s && have.indexOf(s) === -1) have.push(s); });
          into.source = have.join(' + ');
        } else if ((into[col] === undefined || into[col] === '') && v !== undefined && v !== '') into[col] = v;
      });
    });
    return { rows: order.map(function (k) { return byKey[k]; }), duplicates: duplicates };
  }

  // ---- DNS host from name servers ----
  var NS_HOSTS = [
    [/\.ns\.cloudflare\.com$/, 'Cloudflare'],
    [/\.domaincontrol\.com$/, 'GoDaddy'],
    [/\.awsdns-\d+\./, 'AWS Route 53'],
    [/^ns-cloud-[a-z0-9]+\.googledomains\.com$/, 'Google Cloud DNS'],
    [/\.googledomains\.com$/, 'Google Domains'],
    [/\.nsone\.net$/, 'NS1'],
    [/\.123-reg\.co\.uk$/, '123 Reg'],
    [/\.(ui-dns\.(com|org|de|biz)|ionos\.(com|co\.uk))$/, 'IONOS'],
    [/\.registrar-servers\.com$/, 'Namecheap'],
    [/\.(namecheaphosting\.com)$/, 'Namecheap hosting'],
    [/\.wixdns\.net$/, 'Wix'],
    [/\.squarespacedns\.com$/, 'Squarespace'],
    [/\.hover\.com$/, 'Hover'],
    [/\.livedns\.co\.uk$/, 'Fasthosts'],
    [/\.namesco\.net$/, 'Names.co.uk'],
    [/\.krystal\.(uk|co\.uk)$/, 'Krystal'],
    [/\.(dnsimple\.com|dnsimple-edge\.(net|org))$/, 'DNSimple'],
    [/\.digitalocean\.com$/, 'DigitalOcean'],
    [/\.vercel-dns\.com$/, 'Vercel'],
    [/\.netlify\.com$/, 'Netlify'],
    [/\.(azure-dns\.(com|net|org|info))$/, 'Azure DNS'],
    [/\.hostinger\.com$/, 'Hostinger'],
    [/\.(siteground\.net)$/, 'SiteGround'],
    [/\.webwave\.(me|dev|pl)$/, 'Webwave']
  ];

  // Name server names -> a plain host name. Several hosts at once is reported, not guessed.
  function classifyDnsHost(nsNames) {
    var names = (nsNames || []).map(function (n) { return String(n).trim().toLowerCase().replace(/\.$/, ''); }).filter(Boolean);
    if (!names.length) return 'not checked';
    var found = [];
    names.forEach(function (n) {
      var hit = null;
      for (var i = 0; i < NS_HOSTS.length && !hit; i++) if (NS_HOSTS[i][0].test(n)) hit = NS_HOSTS[i][1];
      if (!hit) hit = 'other (' + n.split('.').slice(-2).join('.') + ')';
      if (found.indexOf(hit) === -1) found.push(hit);
    });
    return found.length === 1 ? found[0] : 'mixed: ' + found.join(', ');
  }

  // ---- tags in page source ----
  // Reads analytics and pixel tags from HTML as served. Tags added by script after load can be missed,
  // so an empty list means "not found in page source", never "none".
  function readTags(html) {
    var s = String(html || '');
    var uniq = function (arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); };
    var all = function (re) { var out = [], m; re.lastIndex = 0; while ((m = re.exec(s))) out.push(m[1].toUpperCase()); return uniq(out); };
    var ga4 = all(/\b(G-[A-Z0-9]{6,12})\b/gi);
    var gtm = all(/\b(GTM-[A-Z0-9]{4,9})\b/gi);
    var meta = [], m, re = /fbq\(\s*['"]init['"]\s*,\s*['"](\d{6,20})['"]/g;
    while ((m = re.exec(s))) meta.push(m[1]);
    re = /facebook\.com\/tr\?id=(\d{6,20})/g;
    while ((m = re.exec(s))) meta.push(m[1]);
    meta = uniq(meta);
    var loadedBy = [];
    if (/web-pixels-manager|webPixelsManager/i.test(s)) loadedBy.push('Shopify web pixels');
    if (/google_and_youtube|google-and-youtube|"appId":"?gid:\/\/shopify\/App\/1780363/i.test(s)) loadedBy.push('Google & YouTube app');
    if (/facebook-and-instagram|"facebook_pixel_id"/i.test(s)) loadedBy.push('Facebook & Instagram app');
    if (/clickfunnels|cf2\.com|myclickfunnels\.com/i.test(s)) loadedBy.push('ClickFunnels');
    var verify = [];
    re = /<meta[^>]+name=["']google-site-verification["'][^>]*>/gi;
    while ((m = re.exec(s))) verify.push('google');
    re = /<meta[^>]+name=["']facebook-domain-verification["'][^>]*>/gi;
    while ((m = re.exec(s))) verify.push('facebook');
    return { ga4: ga4, gtm: gtm, meta: meta, loadedBy: loadedBy, verify: uniq(verify) };
  }

  // What the page may show for a tag list: a word and a count, never the ids.
  function tagWord(ids, checked) {
    if (!checked) return 'not checked';
    return ids && ids.length ? 'found (' + ids.length + ')' : 'not found in page source';
  }

  return {
    VERSION: VERSION,
    parseCSV: parseCSV,
    toObjects: toObjects,
    normaliseTarget: normaliseTarget,
    keyOf: keyOf,
    mergeRows: mergeRows,
    classifyDnsHost: classifyDnsHost,
    readTags: readTags,
    tagWord: tagWord
  };
});
