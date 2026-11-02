// Web Estate Hub: email sending and verification words, read from DNS-over-HTTPS answers.
// Pure: no network. The caller (the Apps Script engine or a node script) fetches the JSON and passes it in.
// Input format: dns.google/resolve JSON {Status, Answer:[{name, type, data}]}. TXT data arrives quoted and may be
// split into several quoted chunks, which are joined. Every example in the tests is invented (example.com style).
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateMail = api;
})(this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var TYPE = { A: 1, CNAME: 5, MX: 15, TXT: 16 };
  var DKIM_SELECTORS = ['google', 'selector1', 'selector2', 'k1', 's1', 'default'];

  function answers(doh, type) {
    var list = (doh && Array.isArray(doh.Answer)) ? doh.Answer : [];
    return list.filter(function (a) { return a && (type === undefined || a.type === type); });
  }

  // One TXT answer's data -> the joined string. '"v=spf1 a" " -all"' -> 'v=spf1 a -all'. Unquoted data is kept as is.
  function joinTxt(data) {
    var s = String(data == null ? '' : data).trim();
    if (s.charAt(0) !== '"') return s;
    var out = '', m, re = /"((?:[^"\\]|\\.)*)"/g;
    while ((m = re.exec(s))) out += m[1].replace(/\\(.)/g, '$1');
    return out;
  }

  // DoH answer -> joined TXT strings (TXT type only; CNAME hops in the answer are skipped).
  function txtRecords(doh) {
    return answers(doh, TYPE.TXT).map(function (a) { return joinTxt(a.data); });
  }

  function asTxts(x) { return Array.isArray(x) ? x.map(String) : txtRecords(x); }

  // SPF: exactly one v=spf1 record passes ('pass', shown as present). More than one is a fault that breaks SPF for
  // every receiver, so it reads 'two records' and never as passing.
  function spfWord(txts) {
    var spf = asTxts(txts).filter(function (t) { return /^v=spf1(\s|$)/i.test(t.trim()); });
    if (!spf.length) return { word: 'missing', count: 0, record: '' };
    if (spf.length > 1) return { word: 'two records', count: spf.length, record: '', records: spf };
    return { word: 'pass', count: 1, record: spf[0] };
  }

  // DKIM at the common selectors. Not found at known selectors is not missing: a sender can use any selector name.
  function dkimWord(resultsBySelector) {
    var by = resultsBySelector || {}, found = [];
    Object.keys(by).forEach(function (sel) {
      var hit = asTxts(by[sel]).some(function (t) { return /(^|;)\s*v=DKIM1\b/i.test(t) || /(^|;)\s*p=/i.test(t); });
      if (hit) found.push(sel);
    });
    return found.length ? { word: 'found (' + found.join(', ') + ')', selectors: found } : { word: 'not found', selectors: [] };
  }

  // DMARC at _dmarc.<domain>: the p= policy, 'missing', or 'two records' (receivers then ignore DMARC).
  function dmarcWord(txts) {
    var recs = asTxts(txts).filter(function (t) { return /^v=DMARC1\s*(;|$)/i.test(t.trim()); });
    if (!recs.length) return { word: 'missing', count: 0 };
    if (recs.length > 1) return { word: 'two records', count: recs.length };
    var m = /(?:^|;)\s*p\s*=\s*([a-z]+)/i.exec(recs[0]);
    var p = m ? m[1].toLowerCase() : '';
    var rua = /(?:^|;)\s*rua\s*=/i.test(recs[0]);
    if (['none', 'quarantine', 'reject'].indexOf(p) === -1) return { word: 'none', count: 1, policy: p || '(no p=)', rua: rua };
    return { word: p, count: 1, policy: p, rua: rua };
  }

  var MX_PROVIDERS = [
    [/(^|\.)(google\.com|googlemail\.com)$/, 'Google Workspace'],
    [/\.protection\.outlook\.com$/, 'Microsoft 365'],
    [/(^|\.)zoho\.(com|eu|in|com\.au)$/, 'Zoho'],
    [/(^|\.)(messagingengine\.com|fastmail\.com)$/, 'Fastmail'],
    [/(^|\.)protonmail\.ch$/, 'ProtonMail'],
    [/(^|\.)mimecast\.(com|co\.za)$/, 'Mimecast'],
    [/(^|\.)(ionos\.(com|co\.uk|de|fr|es)|1and1\.(com|co\.uk))$/, 'IONOS'],
    [/(^|\.)privateemail\.com$/, 'Namecheap Private Email'],
    [/(^|\.)registrar-servers\.com$/, 'Namecheap email forwarding'],
    [/(^|\.)mailspamprotection\.com$/, 'SiteGround']
  ];

  // Lowest-preference MX host as a plain provider word. 'none' when there is no MX.
  function mxHost(doh) {
    var mx = answers(doh, TYPE.MX).map(function (a) {
      var parts = String(a.data || '').trim().split(/\s+/);
      return { pref: parseInt(parts[0], 10), host: String(parts[1] || '').toLowerCase().replace(/\.$/, '') };
    }).filter(function (r) { return r.host && !isNaN(r.pref); });
    if (!mx.length) return { word: 'none', host: '' };
    mx.sort(function (a, b) { return a.pref - b.pref || a.host.localeCompare(b.host); });
    var host = mx[0].host;
    if (host === '' || host === '.') return { word: 'none', host: '' };
    for (var i = 0; i < MX_PROVIDERS.length; i++) if (MX_PROVIDERS[i][0].test(host)) return { word: MX_PROVIDERS[i][1], host: host };
    return { word: host.split('.').slice(-2).join('.'), host: host };
  }

  function googleVerified(txts) {
    return asTxts(txts).some(function (t) { return /^google-site-verification=/i.test(t.trim()); });
  }

  // Verification meta tags in page HTML. Names only; token values are never read out.
  function htmlVerifications(html) {
    var s = String(html || ''), out = [], m, re = /<meta\b[^>]*>/gi;
    var names = { 'google-site-verification': 'google', 'facebook-domain-verification': 'facebook', 'p:domain_verify': 'pinterest', 'msvalidate.01': 'bing' };
    while ((m = re.exec(s))) {
      var n = /\bname\s*=\s*["']?([^"'\s>]+)/i.exec(m[0]);
      var key = n ? n[1].toLowerCase() : '';
      var hit = names[key] || (/^pinterest.*verif/.test(key) ? 'pinterest' : '') || (/^bing.*verif/.test(key) ? 'bing' : '');
      if (hit && out.indexOf(hit) === -1) out.push(hit);
    }
    return ['google', 'facebook', 'pinterest', 'bing'].filter(function (k) { return out.indexOf(k) !== -1; });
  }

  function wordOf(x) { return String(x && typeof x === 'object' ? x.word : (x == null ? '' : x)).toLowerCase(); }

  // Faults (send failures likely) and notes (softer). DKIM 'not found' is never a fault.
  function summarise(r) {
    var spf = wordOf(r && r.spf), dmarc = wordOf(r && r.dmarc), faults = [], notes = [];
    if (/two/.test(spf)) faults.push('two SPF records');
    else if (/missing/.test(spf)) faults.push('SPF missing');
    if (/missing/.test(dmarc)) faults.push('DMARC missing');
    else if (/two/.test(dmarc)) faults.push('two DMARC records');
    else if (dmarc === 'none') notes.push('DMARC p=none');
    return { faults: faults, notes: notes };
  }

  // Two or more SPF records -> one merged record text. Terms are kept once, in order; an include: or a: with no
  // valid domain (e.g. "include:..") is dropped and reported; one ~all (or -all if every record had -all) ends it.
  function mergeSpf(records) {
    var terms = [], dropped = [], alls = [];
    (records || []).forEach(function (rec) {
      String(rec).trim().split(/\s+/).slice(1).forEach(function (t) {
        if (/^[+?~-]?all$/i.test(t)) { alls.push(t.replace(/^\+/, '').toLowerCase()); return; }
        var m = /^[+?~-]?(include|a|mx|exists|redirect)[:=](.*)$/i.exec(t);
        if (m && m[2] && !/^[a-z0-9_%{}-]+(\.[a-z0-9_%{}-]+)+\.?(\/\d+)?$/i.test(m[2])) { if (dropped.indexOf(t) === -1) dropped.push(t); return; }
        if (terms.indexOf(t) === -1) terms.push(t);
      });
    });
    var all = alls.length && alls.every(function (a) { return a === '-all'; }) ? '-all' : '~all';
    return { record: ['v=spf1'].concat(terms, [all]).join(' '), dropped: dropped };
  }

  // Plain-English DNS changes for Lisa to make by hand. Suggestion text only; nothing here is ever applied.
  function fixSuggestion(domain, result) {
    var d = String(domain || 'the domain'), r = result || {}, s = summarise(r), out = [];
    var mx = wordOf(r.mx);
    var include = mx === 'google workspace' ? 'include:_spf.google.com' : mx === 'microsoft 365' ? 'include:spf.protection.outlook.com' : 'include:<your mail provider>';
    if (s.faults.indexOf('two SPF records') !== -1) {
      var merged = r.spf && r.spf.records ? mergeSpf(r.spf.records) : null;
      out.push('Merge the ' + (r.spf && r.spf.count || 'two') + ' SPF TXT records on ' + d + ' into ONE' +
        (merged ? ': "' + merged.record + '"' + (merged.dropped.length ? ' (drops the broken ' + merged.dropped.join(', ') + ')' : '') : ': keep a single "v=spf1 ... ~all" that lists every include: from both') +
        ', then delete the others. Two SPF records make SPF fail everywhere.');
    }
    if (s.faults.indexOf('SPF missing') !== -1) out.push('Add a TXT record on ' + d + ': "v=spf1 ' + include + ' ~all" (only if this domain sends email; if it never sends, use "v=spf1 -all").');
    if (s.faults.indexOf('DMARC missing') !== -1) out.push('Add a TXT record at _dmarc.' + d + ': "v=DMARC1; p=none; rua=mailto:dmarc-reports@<your-domain>" (replace the address with a mailbox you read). Start at p=none, then tighten.');
    if (s.faults.indexOf('two DMARC records') !== -1) out.push('Delete all but one TXT record at _dmarc.' + d + ' that starts v=DMARC1.');
    if (s.notes.indexOf('DMARC p=none') !== -1) out.push('DMARC on ' + d + ' is p=none (monitor only). After reading two to four weeks of reports with SPF and DKIM passing, change it to p=quarantine' + (r.dmarc && r.dmarc.rua === false ? ' and add rua=mailto:<a mailbox you read> so reports arrive' : '') + '.');
    if (!out.length) return 'No DNS change needed for ' + d + '.';
    return out.join('\n');
  }

  return {
    VERSION: VERSION,
    TYPE: TYPE,
    DKIM_SELECTORS: DKIM_SELECTORS,
    joinTxt: joinTxt,
    txtRecords: txtRecords,
    spfWord: spfWord,
    dkimWord: dkimWord,
    dmarcWord: dmarcWord,
    mxHost: mxHost,
    googleVerified: googleVerified,
    htmlVerifications: htmlVerifications,
    summarise: summarise,
    mergeSpf: mergeSpf,
    fixSuggestion: fixSuggestion
  };
});
