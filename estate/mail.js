// Web Estate Hub: email sending and verification words, read from DNS-over-HTTPS answers.
// Pure: no network, and nothing here writes DNS, a registrar or a mailbox.
// The caller (the Apps Script engine or a node script) fetches the JSON and passes it in.
// Input format: dns.google/resolve JSON {Status, Answer:[{name, type, data}]}. TXT data arrives quoted and may be
// split into several quoted chunks, which are joined. Every example in the tests is invented (example.com style).
// Optional row.forward_chain (an array, or "a → b → c") comes from the private estate sheet at runtime. Absence is normal.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateMail = api;
})(this, function () {
  'use strict';

  var VERSION = '1.1.0';
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

  // One SPF record's syntax. Unknown mechanisms, and a missing all (unless redirect=), are broken.
  // include, a, mx, ptr, exists and redirect each count as one lookup. More than 10 is broken.
  // Nested includes are not walked: only the terms in this one TXT answer are visible.
  function spfProblems(record) {
    var terms = String(record || '').trim().split(/\s+/).slice(1);
    var problems = [], lookups = 0, hasAll = false, hasRedirect = false;
    terms.forEach(function (t) {
      if (!t) return;
      var mod = /^([A-Za-z][A-Za-z0-9_.-]*)=(.*)$/.exec(t);
      if (mod) {
        var name = mod[1].toLowerCase();
        if (name === 'redirect') {
          hasRedirect = true;
          lookups++;
          if (!mod[2]) problems.push('redirect has no target');
        } else if (name === 'exp' && !mod[2]) problems.push('exp has no target');
        return;
      }
      var mech = /^([+\-~?]?)(all|include|a|mx|ptr|ip4|ip6|exists)(?:([:/])(.*))?$/i.exec(t);
      if (!mech) {
        problems.push('unknown mechanism ' + t.replace(/^[+\-~?]/, '').split(/[:=/]/)[0]);
        return;
      }
      var kind = mech[2].toLowerCase(), sep = mech[3], val = mech[4] || '';
      if (kind === 'all') {
        hasAll = true;
        if (sep) problems.push('all takes no value');
        return;
      }
      if (kind === 'include' || kind === 'a' || kind === 'mx' || kind === 'ptr' || kind === 'exists') lookups++;
      if ((kind === 'include' || kind === 'exists' || kind === 'ip4' || kind === 'ip6') && !val) problems.push(kind + ' has no value');
      else if ((kind === 'include' || kind === 'exists') && !/[a-z0-9]/i.test(val)) problems.push(kind + ' has no domain');
      else if ((kind === 'a' || kind === 'mx' || kind === 'ptr') && sep === ':' && !val) problems.push(kind + ' has no value');
    });
    if (!hasAll && !hasRedirect) problems.push('missing all');
    if (lookups > 10) problems.push('more than 10 lookups');
    return { problems: problems, lookups: lookups };
  }

  // SPF: exactly one v=spf1 record with sound syntax passes ('pass', shown as present). More than one is a fault
  // that breaks SPF for every receiver, so it reads 'two records' and never as passing. Broken syntax reads 'broken'.
  function spfWord(txts) {
    var spf = asTxts(txts).filter(function (t) { return /^v=spf1(\s|$)/i.test(t.trim()); });
    if (!spf.length) return { word: 'missing', count: 0, record: '' };
    if (spf.length > 1) return { word: 'two records', count: spf.length, record: '', records: spf };
    var check = spfProblems(spf[0]);
    if (check.problems.length) return { word: 'broken', count: 1, record: spf[0], problems: check.problems, lookups: check.lookups };
    return { word: 'pass', count: 1, record: spf[0] };
  }

  // DKIM at the small allow-list (DKIM_SELECTORS). A hit on any of them, not only google, is found.
  // Not found is not a fault on its own. When the MX is Google Workspace and none of the list answers, it is missing.
  function dkimWord(resultsBySelector, mx) {
    var by = resultsBySelector || {}, found = [];
    Object.keys(by).forEach(function (sel) {
      var hit = asTxts(by[sel]).some(function (t) { return /(^|;)\s*v=DKIM1\b/i.test(t) || /(^|;)\s*p=/i.test(t); });
      if (hit) found.push(sel);
    });
    if (found.length) return { word: 'found (' + found.join(', ') + ')', selectors: found };
    if (wordOf(mx) === 'google workspace') return { word: 'missing', selectors: [] };
    return { word: 'not found', selectors: [] };
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
    // p=none with nowhere to send reports is weak. p=none that has an rua stays 'none' (monitor only).
    if (p === 'none' && !rua) return { word: 'weak', count: 1, policy: 'none', rua: false };
    return { word: p, count: 1, policy: p, rua: rua };
  }

  var MX_PROVIDERS = [
    { re: /(^|\.)(google\.com|googlemail\.com)$/, name: 'Google Workspace' },
    { re: /\.protection\.outlook\.com$/, name: 'Microsoft 365' },
    { re: /(^|\.)zoho\.(com|eu|in|com\.au)$/, name: 'Zoho' },
    { re: /(^|\.)(messagingengine\.com|fastmail\.com)$/, name: 'Fastmail' },
    { re: /(^|\.)protonmail\.ch$/, name: 'ProtonMail' },
    { re: /(^|\.)mimecast\.(com|co\.za)$/, name: 'Mimecast' },
    { re: /(^|\.)(ionos\.(com|co\.uk|de|fr|es)|1and1\.(com|co\.uk))$/, name: 'IONOS' },
    { re: /(^|\.)privateemail\.com$/, name: 'Namecheap Private Email' },
    { re: /(^|\.)registrar-servers\.com$/, name: 'Namecheap email forwarding', forwarding: true },
    { re: /(^|\.)improvmx\.com$/, name: 'ImprovMX', forwarding: true },
    { re: /(^|\.)forwardemail\.net$/, name: 'ForwardEmail', forwarding: true },
    { re: /\.mx\.cloudflare\.net$/, name: 'Cloudflare Email Routing', forwarding: true },
    { re: /(^|\.)mailspamprotection\.com$/, name: 'SiteGround' }
  ];

  function mxResult(word, host, forwarding) {
    var none = word === 'none';
    return { word: word, provider: none ? '' : word, host: host || '', present: !none, forwarding: !!forwarding };
  }

  // Lowest-preference MX host as a plain provider word. 'none' when there is no MX (present is false).
  function mxHost(doh) {
    var mx = answers(doh, TYPE.MX).map(function (a) {
      var parts = String(a.data || '').trim().split(/\s+/);
      return { pref: parseInt(parts[0], 10), host: String(parts[1] || '').toLowerCase().replace(/\.$/, '') };
    }).filter(function (r) { return r.host && !isNaN(r.pref); });
    if (!mx.length) return mxResult('none', '');
    mx.sort(function (a, b) { return a.pref - b.pref || a.host.localeCompare(b.host); });
    var host = mx[0].host;
    if (host === '' || host === '.') return mxResult('none', '');
    for (var i = 0; i < MX_PROVIDERS.length; i++) if (MX_PROVIDERS[i].re.test(host)) return mxResult(MX_PROVIDERS[i].name, host, MX_PROVIDERS[i].forwarding);
    return mxResult(host.split('.').slice(-2).join('.'), host, false);
  }

  // 'none', or 'present · Google Workspace'. Blank when mail was not checked.
  function mxLabel(mx) {
    var w = wordOf(mx);
    if (!w) return '';
    if (w === 'none') return 'none';
    var name = (mx && typeof mx === 'object' && mx.word) ? mx.word : String(mx).trim();
    return 'present · ' + name;
  }

  function forwardingMx(mx) {
    if (mx && typeof mx === 'object' && mx.forwarding) return true;
    var w = wordOf(mx);
    if (!w || w === 'none') return false;
    for (var i = 0; i < MX_PROVIDERS.length; i++) {
      if (MX_PROVIDERS[i].forwarding && MX_PROVIDERS[i].name.toLowerCase() === w) return true;
    }
    return false;
  }

  // Optional forward_chain: an array of stops, or one string split on arrows or the word "to".
  function chainParts(v) {
    if (Array.isArray(v)) return v.map(function (s) { return String(s).trim(); }).filter(Boolean);
    var s = String(v == null ? '' : v).trim();
    if (!s) return [];
    return s.split(/\s*(?:→|->|⇒|>|\|)\s*|\s+to\s+/i).map(function (x) { return x.trim(); }).filter(Boolean);
  }

  // null when there is no chain and the MX is not a forwarder. Otherwise the chain, the hop count
  // (stops minus one) and flag when that count is more than one. A forwarder with no recorded target
  // reads 'target unknown, needs registrar export'.
  function forwardChain(row) {
    row = row || {};
    var parts = chainParts(row.forward_chain);
    if (!parts.length) {
      if (!forwardingMx(row.mx)) return null;
      return { hops: null, chain: [], text: 'target unknown, needs registrar export', unknown: true, flag: true };
    }
    var hops = parts.length - 1;
    var text = parts.join(' → ') + ' (' + hops + ' hop' + (hops === 1 ? '' : 's') + ')';
    return { hops: hops, chain: parts, text: text, unknown: false, flag: hops > 1 };
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

  // Faults (send failures likely) and notes (softer). DKIM 'not found' is a fault only when the MX is Google Workspace.
  function summarise(r) {
    r = r || {};
    var spf = wordOf(r.spf), dmarc = wordOf(r.dmarc), dkim = wordOf(r.dkim), mx = wordOf(r.mx);
    var faults = [], notes = [];
    if (/two/.test(spf)) faults.push('two SPF records');
    else if (/broken/.test(spf)) faults.push('SPF broken');
    else if (/missing|fail/.test(spf)) faults.push('SPF missing');
    if (/missing/.test(dmarc)) faults.push('DMARC missing');
    else if (/two/.test(dmarc)) faults.push('two DMARC records');
    else if (dmarc === 'weak') faults.push('DMARC weak');
    else if (dmarc === 'none') notes.push('DMARC p=none');
    if (/^missing/.test(dkim) || (/^not found/.test(dkim) && mx === 'google workspace')) faults.push('DKIM missing');
    if (mx === 'none') faults.push('no MX');
    var fwd = forwardChain(r);
    if (fwd && fwd.unknown) faults.push('target unknown, needs registrar export');
    else if (fwd && fwd.flag) faults.push('more than one forward hop');
    return { faults: faults, notes: notes };
  }

  function rowFaults(row) { return summarise(row).faults; }

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
    if (s.faults.indexOf('SPF broken') !== -1) {
      var why = (r.spf && r.spf.problems && r.spf.problems.length) ? r.spf.problems.join(', ') : '';
      out.push('The SPF TXT record on ' + d + ' is broken' + (why ? ' (' + why + ')' : '') + '. Keep a single "v=spf1 ... ~all" that uses known mechanisms and at most 10 DNS lookups.');
    }
    if (s.faults.indexOf('SPF missing') !== -1) out.push('Add a TXT record on ' + d + ': "v=spf1 ' + include + ' ~all" (only if this domain sends email; if it never sends, use "v=spf1 -all").');
    if (s.faults.indexOf('DMARC missing') !== -1) out.push('Add a TXT record at _dmarc.' + d + ': "v=DMARC1; p=none; rua=mailto:dmarc-reports@<your-domain>" (replace the address with a mailbox you read). Start at p=none, then tighten.');
    if (s.faults.indexOf('two DMARC records') !== -1) out.push('Delete all but one TXT record at _dmarc.' + d + ' that starts v=DMARC1.');
    if (s.faults.indexOf('DMARC weak') !== -1) out.push('DMARC on ' + d + ' is p=none and has no rua, so reports go nowhere. Add rua=mailto:<a mailbox you read>, then change it to p=quarantine after two to four weeks of reports.');
    if (s.notes.indexOf('DMARC p=none') !== -1) out.push('DMARC on ' + d + ' is p=none (monitor only). After reading two to four weeks of reports with SPF and DKIM passing, change it to p=quarantine' + (r.dmarc && r.dmarc.rua === false ? ' and add rua=mailto:<a mailbox you read> so reports arrive' : '') + '.');
    if (s.faults.indexOf('DKIM missing') !== -1) out.push('Google Workspace is the MX for ' + d + ' but none of the checked DKIM selectors answered (' + DKIM_SELECTORS.join(', ') + '). Publish the Workspace TXT at google._domainkey.' + d + '.');
    if (s.faults.indexOf('no MX') !== -1) out.push(d + ' has no MX record, so it cannot receive mail. Add MX records only if this domain should receive mail.');
    if (s.faults.indexOf('more than one forward hop') !== -1) {
      var chain = forwardChain(r);
      out.push('Mail for ' + d + ' forwards more than once' + (chain && chain.text ? ' (' + chain.text + ')' : '') + '. Shorten it to one hop.');
    }
    if (s.faults.indexOf('target unknown, needs registrar export') !== -1) out.push('Mail for ' + d + ' sits at a forwarding service but the target is not recorded. Export the forwards from the registrar and add them on the estate sheet.');
    if (!out.length) return 'No DNS change needed for ' + d + '.';
    return out.join('\n');
  }

  return {
    VERSION: VERSION,
    TYPE: TYPE,
    DKIM_SELECTORS: DKIM_SELECTORS,
    joinTxt: joinTxt,
    txtRecords: txtRecords,
    spfProblems: spfProblems,
    spfWord: spfWord,
    dkimWord: dkimWord,
    dmarcWord: dmarcWord,
    mxHost: mxHost,
    mxLabel: mxLabel,
    forwardChain: forwardChain,
    rowFaults: rowFaults,
    googleVerified: googleVerified,
    htmlVerifications: htmlVerifications,
    summarise: summarise,
    mergeSpf: mergeSpf,
    fixSuggestion: fixSuggestion
  };
});
