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

  var VERSION = '1.2.1';

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
    if (/google_and_youtube|google-and-youtube|"appId":"?gid:\/\/shopify\/App\/1780363|"apiClientId":1780363\b/i.test(s)) loadedBy.push('Google & YouTube app');
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

  // ---- data contract: the RR_WEB-ESTATE Properties tab ----
  // The page and the engine agree on these names, in this order. The engine's PROPERTY_COLUMNS must match.
  var COLUMNS = ['key', 'kind', 'company', 'brand', 'client', 'owner_role', 'url_or_domain', 'platform', 'dns_host',
    'live_status', 'http_code', 'ssl_expires', 'domain_expires', 'spf', 'dkim', 'dmarc', 'gsc_verified', 'merchant_center',
    'ga4', 'gtm', 'meta_pixel', 'feed', 'keywords_tracked', 'access_note', 'source', 'checked_uk', 'flag'];
  var KINDS = ['site', 'funnel', 'shop', 'app', 'dns-zone', 'email-domain', 'ads-account'];

  // Fails closed: any required column missing means "do not show rows". A missing column next to an unknown one
  // is reported as a likely rename. Extra columns are harmless and only reported.
  function checkHeader(header) {
    var found = (header || []).map(function (h) { return String(h == null ? '' : h).trim().toLowerCase(); });
    var missing = COLUMNS.filter(function (c) { return found.indexOf(c) === -1; });
    var extra = found.filter(function (c) { return c && COLUMNS.indexOf(c) === -1; });
    var dupes = found.filter(function (c, i) { return c && found.indexOf(c) !== i; });
    var problems = [];
    if (missing.length && extra.length) problems.push('column renamed? missing ' + missing.join(', ') + '; found ' + extra.join(', '));
    else if (missing.length) problems.push('missing column' + (missing.length > 1 ? 's' : '') + ': ' + missing.join(', '));
    if (dupes.length) problems.push('column named twice: ' + dupes.filter(function (c, i) { return dupes.indexOf(c) === i; }).join(', '));
    return { ok: !problems.length, missing: missing, extra: extra, problems: problems };
  }

  // Sheet values (header row first) -> checked rows. A bad header gives no rows at all. A row with no key or an
  // unknown kind is left out and counted, never guessed.
  function rowsFromValues(values) {
    var v = (values || []).filter(function (r) { return r && r.some(function (c) { return String(c == null ? '' : c).trim() !== ''; }); });
    if (!v.length) return { ok: false, rows: [], skipped: 0, problems: ['the Properties tab is empty: no header row'] };
    var head = checkHeader(v[0]);
    if (!head.ok) return { ok: false, rows: [], skipped: 0, problems: head.problems };
    var rows = toObjects(v), kept = [], noKey = 0, badKind = 0;
    rows.forEach(function (r) {
      if (!r.key) noKey++;
      else if (KINDS.indexOf(r.kind) === -1) badKind++;
      else kept.push(r);
    });
    var problems = [];
    if (noKey) problems.push(noKey + ' row' + (noKey > 1 ? 's' : '') + ' with no key left out');
    if (badKind) problems.push(badKind + ' row' + (badKind > 1 ? 's' : '') + ' with an unknown kind left out');
    return { ok: true, rows: kept, skipped: noKey + badKind, problems: problems, extra: head.extra };
  }

  // ---- what the page shows ----
  // Dates arrive as 2026-10-29, 29/10/2026 or with a time after them. Anything else is "no date", never a guess.
  function parseDay(v) {
    var s = String(v == null ? '' : v).trim(), m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
    return null;
  }
  // Whole days from today (a Date or a date string) to v; negative = already passed; null = no date.
  function daysUntil(v, today) {
    var d = parseDay(v);
    if (d === null) return null;
    var t = today instanceof Date ? Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) : parseDay(today);
    return Math.round((d - t) / 864e5);
  }

  // One plain status word per row. ClickFunnels "live mode" means live payments, never a visible page, so only
  // live_status counts.
  var STATUS = ['down', 'blocked', 'parked', 'live', 'not checked'];
  function statusOf(row) {
    var s = String(row.live_status || '').trim().toLowerCase();
    if (!s || s === 'not checked') return 'not checked';
    if (/^down|tls|no answer|^5\d\d/.test(s)) return 'down';
    if (/block|challenge|^403/.test(s)) return 'blocked';
    if (/park/.test(s)) return 'parked';
    if (/^live|^2\d\d|^ok/.test(s)) return 'live';
    return 'not checked';
  }
  var STATUS_WORD = { down: 'Down', blocked: 'Blocked to scripts', parked: 'Parked', live: 'Live', 'not checked': 'Not checked' };

  // The sooner of the certificate and domain expiry, in days; null when neither is known.
  function expiresIn(row, today) {
    var a = daysUntil(row.ssl_expires, today), b = daysUntil(row.domain_expires, today);
    if (a === null) return b;
    if (b === null) return a;
    return Math.min(a, b);
  }
  function expiringSoon(row, today, within) {
    var d = expiresIn(row, today);
    return d !== null && d <= (within || 60);
  }

  // Email sending faults. "not found" for DKIM is not "missing": selectors can hide it.
  function emailProblems(row) {
    var out = [], spf = String(row.spf || '').toLowerCase(), dmarc = String(row.dmarc || '').toLowerCase(), dkim = String(row.dkim || '').toLowerCase();
    if (/two|multiple|2 records/.test(spf)) out.push('two SPF records');
    else if (/missing|fail/.test(spf)) out.push('SPF missing');
    if (/missing/.test(dmarc)) out.push('DMARC missing');
    if (/^missing/.test(dkim)) out.push('DKIM missing');
    return out;
  }

  // Counts for the top of the page.
  function summarise(rows, today) {
    var c = { total: 0, live: 0, down: 0, blocked: 0, parked: 0, notChecked: 0, expiring: 0, emailFailing: 0 };
    (rows || []).forEach(function (r) {
      c.total++;
      var s = statusOf(r);
      if (s === 'not checked') c.notChecked++; else c[s]++;
      if (expiringSoon(r, today, 60)) c.expiring++;
      if (emailProblems(r).length) c.emailFailing++;
    });
    return c;
  }

  // 0 = down, 1 = expiring within 60 days, 2 = blocked, 3 = everything else. Lower shows first.
  function rank(row, today) {
    var s = statusOf(row);
    if (s === 'down') return 0;
    if (expiringSoon(row, today, 60)) return 1;
    if (s === 'blocked') return 2;
    return 3;
  }

  // Groups by company, then brand, then client. Inside a group: down, then expiring (soonest first), then the rest by
  // address. Groups holding a down or expiring row come first; then by name.
  function groupRows(rows, today) {
    var by = {}, order = [];
    (rows || []).forEach(function (r) {
      var name = [r.company || 'No company', r.brand, r.client ? 'client: ' + r.client : ''].filter(Boolean).join(' · ');
      if (!by[name]) { by[name] = []; order.push(name); }
      by[name].push(r);
    });
    var cmp = function (a, b) {
      var ra = rank(a, today), rb = rank(b, today);
      if (ra !== rb) return ra - rb;
      if (ra === 1) return expiresIn(a, today) - expiresIn(b, today);
      return String(a.url_or_domain || a.key).localeCompare(String(b.url_or_domain || b.key));
    };
    var groups = order.map(function (name) {
      var list = by[name].slice().sort(cmp);
      return { name: name, rows: list, worst: Math.min.apply(null, list.map(function (r) { return rank(r, today); })) };
    });
    groups.sort(function (a, b) { return a.worst - b.worst || a.name.localeCompare(b.name); });
    return groups;
  }

  // Filters live in the URL hash: #/home?company=Sample%20Co&kind=site. Unknown keys are ignored.
  var FILTERS = ['company', 'brand', 'client', 'kind', 'platform', 'flag'];
  function parseFilters(hash) {
    var q = String(hash || '').split('?')[1] || '', out = {};
    q.split('&').forEach(function (p) {
      if (!p) return;
      var i = p.indexOf('='), k = decodeURIComponent(i < 0 ? p : p.slice(0, i)), v = i < 0 ? '' : decodeURIComponent(p.slice(i + 1).replace(/\+/g, ' '));
      if (FILTERS.indexOf(k) !== -1 && v) out[k] = v;
    });
    return out;
  }
  function filterHash(view, f) {
    var q = FILTERS.filter(function (k) { return f[k]; }).map(function (k) { return k + '=' + encodeURIComponent(f[k]); }).join('&');
    return '#/' + (view || 'home') + (q ? '?' + q : '');
  }
  // flag filter: "any" = any flag set, "none" = no flag, otherwise that exact flag.
  function applyFilters(rows, f) {
    return (rows || []).filter(function (r) {
      return FILTERS.every(function (k) {
        var want = f[k];
        if (!want) return true;
        var have = String(r[k] || '');
        if (k === 'flag' && want === 'any') return have !== '';
        if (k === 'flag' && want === 'none') return have === '';
        return have === want;
      });
    });
  }
  // The choices for one filter: the distinct non-empty values, sorted.
  function choices(rows, k) {
    var seen = [];
    (rows || []).forEach(function (r) { var v = String(r[k] || ''); if (v && seen.indexOf(v) === -1) seen.push(v); });
    return seen.sort(function (a, b) { return a.localeCompare(b); });
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
    tagWord: tagWord,
    COLUMNS: COLUMNS,
    KINDS: KINDS,
    checkHeader: checkHeader,
    rowsFromValues: rowsFromValues,
    parseDay: parseDay,
    daysUntil: daysUntil,
    STATUS: STATUS,
    STATUS_WORD: STATUS_WORD,
    statusOf: statusOf,
    expiresIn: expiresIn,
    expiringSoon: expiringSoon,
    emailProblems: emailProblems,
    summarise: summarise,
    rank: rank,
    groupRows: groupRows,
    FILTERS: FILTERS,
    parseFilters: parseFilters,
    filterHash: filterHash,
    applyFilters: applyFilters,
    choices: choices
  };
});
