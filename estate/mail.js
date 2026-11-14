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

  var VERSION = '1.2.0';
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
  // Not found is not a fault on its own. When the MX is Google Workspace and none of the list answers, it is
  // 'missing (google)': the google selector Workspace publishes is absent (2.1). A custom selector that answers still counts.
  function dkimWord(resultsBySelector, mx) {
    var by = resultsBySelector || {}, found = [];
    Object.keys(by).forEach(function (sel) {
      var hit = asTxts(by[sel]).some(function (t) { return /(^|;)\s*v=DKIM1\b/i.test(t) || /(^|;)\s*p=/i.test(t); });
      if (hit) found.push(sel);
    });
    if (found.length) return { word: 'found (' + found.join(', ') + ')', selectors: found };
    if (wordOf(mx) === 'google workspace') return { word: 'missing (google)', selectors: [] };
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
    { re: /(^|\.)mailspamprotection\.com$/, name: 'SiteGround' },
    { re: /(^|\.)webwavecms\.com$/, name: 'WebWave' }
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
    // 2.5: no MX is a fault unless the Mail map is read and holds no address on this domain (then it is a note).
    if (mx === 'none') {
      if (r.mail_addresses === 0 || r.mail_addresses === '0') notes.push('no MX (no addresses on the Mail map)');
      else faults.push('no MX');
    }
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

  // ---- private tabs: header contracts (fail closed) ----
  // The Mail map and Mail switch tabs live only in the private RR_WEB-ESTATE sheet. Their header rows are fixed here.
  // A missing or renamed column means no rows at all and a plain problem line, never a guess.
  var MAIL_MAP_COLUMNS = ['address', 'kind', 'delivers_to', 'next_hop', 'checked_by'];
  var MAIL_SWITCH_STEPS = ['Export the forwards from the registrar', 'Add the domain as a Workspace alias domain and verify it',
    'Recreate every forward as an alias', 'Test delivery to each alias', 'Switch MX to Google', 'One SPF record with Google in it',
    'Publish DKIM and start authentication', 'DMARC p=none with reports', 'Re-run the checks: all green', 'Rollback, only if needed'];
  var MAIL_SWITCH_COLUMNS = ['domain', 'class'].concat(MAIL_SWITCH_STEPS.map(function (x, i) { return 'step_' + (i + 1); }), ['done_date', 'old_mx', 'card_ref']);

  function headerOf(row) { return (row || []).map(function (h) { return String(h == null ? '' : h).trim().toLowerCase(); }); }

  // values (rows of arrays, header first) -> { ok, rows, problems }. tabName is only for the words.
  function tabFromValues(values, columns, tabName) {
    var v = (values || []).filter(function (r) { return r && r.some(function (c) { return String(c == null ? '' : c).trim() !== ''; }); });
    if (!v.length) return { ok: false, rows: [], problems: ['the ' + tabName + ' tab is empty'] };
    var head = headerOf(v[0]);
    var missing = columns.filter(function (c) { return head.indexOf(c) === -1; });
    var extra = head.filter(function (h) { return h && columns.indexOf(h) === -1; });
    if (missing.length) {
      return { ok: false, rows: [], problems: ['the ' + tabName + ' tab header changed: missing ' + missing.join(', ') +
        (extra.length ? ' (found ' + extra.join(', ') + ' instead)' : '') + '. Nothing from this tab is shown'] };
    }
    var rows = v.slice(1).map(function (r) {
      var o = {};
      columns.forEach(function (c) { var i = head.indexOf(c); o[c] = r[i] === undefined || r[i] === null ? '' : String(r[i]).trim(); });
      return o;
    });
    return { ok: true, rows: rows, problems: [] };
  }
  function mailMapFromValues(values) { return tabFromValues(values, MAIL_MAP_COLUMNS, 'Mail map'); }
  function mailSwitchFromValues(values) { return tabFromValues(values, MAIL_SWITCH_COLUMNS, 'Mail switch'); }

  // ---- 2.6 forward hops over Mail map rows ----
  function addrKey(a) { return String(a == null ? '' : a).trim().toLowerCase(); }
  function domainOfAddress(a) { var s = addrKey(a), i = s.lastIndexOf('@'); return i < 0 ? '' : s.slice(i + 1); }

  // address -> { chain, hops, loop, unknown, flag, text }. Follows next_hop from row to row.
  // hops = forward steps (stops minus one). Flag: a loop, an unknown target, or 3 or more stops (2 or more steps).
  // null when the address is not on the map.
  var MAX_STOPS = 20;
  function hops(address, mapRows) {
    var by = {};
    (mapRows || []).forEach(function (r) { var k = addrKey(r && r.address); if (k && !by[k]) by[k] = r; });
    var start = addrKey(address);
    if (!by[start]) return null;
    var chain = [start], seen = {}, cur = start, loop = false, unknown = false;
    seen[start] = true;
    while (by[cur] && chain.length <= MAX_STOPS) {
      var row = by[cur], kind = String(row.kind || '').trim().toLowerCase(), next = addrKey(row.next_hop);
      if (kind === 'mailbox' && !next) break;
      if (!next) { unknown = kind !== 'mailbox'; break; }
      chain.push(next);
      if (seen[next]) { loop = true; break; }
      seen[next] = true;
      cur = next;
    }
    if (chain.length > MAX_STOPS) loop = true;
    var n = chain.length - 1;
    var text = loop ? 'forward loop: ' + chain.join(' → ')
      : unknown ? (n ? chain.join(' → ') + ', then ' : '') + 'target unknown: needs Namecheap export'
      : n === 0 ? 'mailbox (no forward)'
      : chain.join(' → ') + ' (' + n + ' hop' + (n === 1 ? '' : 's') + ')';
    return { address: start, chain: chain, hops: n, loop: loop, unknown: unknown, flag: loop || unknown || n >= 2, text: text };
  }

  // Every Mail map address on one domain -> its hops() result.
  function domainHops(domain, mapRows) {
    var d = addrKey(domain);
    var seen = {};
    return (mapRows || []).filter(function (r) {
      var a = addrKey(r && r.address);
      if (!a || seen[a] || domainOfAddress(a) !== d) return false;
      seen[a] = true;
      return true;
    }).map(function (r) { return hops(r.address, mapRows); });
  }

  // ---- 4.x Mail switch progress (read only) ----
  function stepWord(v) {
    var s = String(v == null ? '' : v).trim().toLowerCase();
    if (s === 'done' || s === 'yes' || s === 'y') return 'done';
    if (s === 'n/a' || s === 'na' || s === 'not needed') return 'n/a';
    return 'todo';
  }
  function classWord(c) {
    var s = String(c == null ? '' : c).trim().toLowerCase();
    if (/primary/.test(s)) return 'primary';
    if (/keep/.test(s)) return 'keep';
    if (/alias|brand/.test(s)) return 'alias';
    return 'unknown';
  }
  // checksGreen: true when 2.1 to 2.5 pass for the domain, false when they do not, null when not yet read.
  // Step 9 comes only from checksGreen: a hand tick in the sheet is ignored. Step 10 (rollback) never holds progress.
  function switchProgress(switchRow, checksGreen) {
    if (!switchRow) return { cls: 'unknown', text: 'not on the Mail switch tab', step: null, of: 10 };
    var cls = classWord(switchRow['class']);
    if (cls === 'unknown') return { cls: cls, text: 'class: Lisa to say', step: null, of: 10 };
    if (cls === 'keep') return { cls: cls, text: 'keeps its own mail: checks only', step: null, of: 10 };
    if (cls === 'primary') return { cls: cls, text: 'primary Workspace domain', step: null, of: 10 };
    var steps = MAIL_SWITCH_STEPS.map(function (name, i) {
      var w = i === 8 ? (checksGreen === true ? 'done' : checksGreen === false ? 'todo' : 'not yet read') : stepWord(switchRow['step_' + (i + 1)]);
      return { n: i + 1, name: name, word: w };
    });
    var open = steps.slice(0, 9).filter(function (s) { return s.word !== 'done' && s.word !== 'n/a'; })[0];
    if (!open) return { cls: cls, text: 'all steps done', step: 10, of: 10, steps: steps, done: true };
    return { cls: cls, step: open.n, of: 10, steps: steps, next: open.name,
      text: 'step ' + open.n + ' of 10: ' + open.name + (open.word === 'not yet read' ? ' (not yet read)' : '') };
  }

  // ---- one card per domain for #/mail ----
  function dayCount(v, today) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '').trim());
    if (!m) return null;
    var t = today instanceof Date ? today : new Date(String(today || '') + (String(today || '').length === 10 ? 'T00:00:00Z' : ''));
    if (isNaN(t)) return null;
    var a = Date.UTC(+m[1], +m[2] - 1, +m[3]), b = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
    return Math.round((a - b) / 864e5);
  }
  function bareDomain(r) {
    var s = String((r && (r.url_or_domain || r.key)) || '').trim().toLowerCase().replace(/^https?:\/\//, '').split(/[\/?#]/)[0].replace(/\.$/, '');
    return s.replace(/^www\./, '');
  }
  function hasMail(r) { return r && (r.kind === 'email-domain' || r.spf || r.dmarc || r.dkim || r.mx); }

  // rows (estate rows), mapRows / switchRows (already passed through the header contracts, or null when not read),
  // today -> cards, faults first. Every check reads 'not yet read' when the engine has not filled it.
  function domainCards(rows, mapRows, switchRows, today) {
    var by = {}, order = [];
    (rows || []).forEach(function (r) {
      var d = bareDomain(r);
      if (!d) return;
      if (!by[d]) { by[d] = { domain: d, mail: null, certs: [] }; order.push(d); }
      if (hasMail(r) && (!by[d].mail || r.kind === 'email-domain')) by[d].mail = r;
      if (r.ssl_expires) by[d].certs.push(r.ssl_expires);
    });
    var sw = {};
    (switchRows || []).forEach(function (s) { var d = addrKey(s.domain); if (d) sw[d] = s; });
    var cards = order.filter(function (d) { return by[d].mail || sw[d]; }).map(function (d) {
      var g = by[d], r = g.mail || {};
      var chains = mapRows ? domainHops(d, mapRows) : [];
      var row = {};
      Object.keys(r).forEach(function (k) { row[k] = r[k]; });
      if (mapRows) row.mail_addresses = chains.length;
      var s = summarise(row), faults = s.faults.slice(), notes = s.notes.slice();
      chains.forEach(function (c) {
        if (c.loop) faults.push('forward loop: ' + c.address);
        else if (c.unknown) faults.push('target unknown: needs Namecheap export (' + c.address + ')');
        else if (c.hops >= 2) faults.push('3 or more stops: ' + c.address);
      });
      var certDays = g.certs.map(function (v) { return dayCount(v, today); }).filter(function (x) { return x !== null; }).sort(function (a, b) { return a - b; });
      var cd = certDays.length ? certDays[0] : null;
      if (cd !== null && cd <= 30) faults.push('certificate ' + (cd < 0 ? 'expired' : 'expires in ' + cd + ' day' + (cd === 1 ? '' : 's')));
      var nr = 'not yet read';
      var level = function (bad) { return bad ? 'bad' : 'ok'; };
      var dk = wordOf(r.dkim), dm = wordOf(r.dmarc), sp = wordOf(r.spf), mx = wordOf(r.mx);
      var fwdText = !mapRows ? 'Mail map not read' : chains.length ? (chains.filter(function (c) { return c.flag; }).length + ' of ' + chains.length + ' flagged') : 'no addresses on the Mail map';
      var checks = [
        { id: 'dkim', name: 'DKIM', value: dk ? String(r.dkim) : nr, level: !dk ? 'unread' : level(faults.indexOf('DKIM missing') !== -1) },
        { id: 'dmarc', name: 'DMARC', value: dm ? String(r.dmarc) : nr, level: !dm ? 'unread' : level(/missing|two|weak/.test(dm)) },
        { id: 'spf', name: 'SPF', value: sp ? String(r.spf) : nr, level: !sp ? 'unread' : level(/two|broken|missing|fail/.test(sp)) },
        { id: 'mx', name: 'MX', value: mx ? mxLabel(r.mx) : nr, level: !mx ? 'unread' : level(faults.indexOf('no MX') !== -1) },
        { id: 'forward', name: 'Forwards', value: fwdText, level: !mapRows ? 'unread' : level(chains.some(function (c) { return c.flag; })) },
        { id: 'cert', name: 'Certificate', value: cd === null ? nr : cd < 0 ? 'expired' : cd + ' days left', level: cd === null ? 'unread' : cd <= 7 ? 'bad' : cd <= 30 ? 'soon' : 'ok' }
      ];
      var green = (!dk || !dm || !sp || !mx) ? null : !checks.slice(0, 4).some(function (c) { return c.level === 'bad'; });
      var fixRow = {};
      Object.keys(row).forEach(function (k) { fixRow[k] = row[k]; });
      return {
        domain: d, faults: faults, notes: notes, checks: checks, chains: chains,
        fix: s.faults.length ? fixSuggestion(d, fixRow) : '',
        progress: switchRows ? switchProgress(sw[d], green) : { cls: 'unread', text: 'Mail switch not read', step: null, of: 10 },
        checksGreen: green
      };
    });
    return cards.sort(function (a, b) { return (b.faults.length ? 1 : 0) - (a.faults.length ? 1 : 0) || a.domain.localeCompare(b.domain); });
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
    fixSuggestion: fixSuggestion,
    MAIL_MAP_COLUMNS: MAIL_MAP_COLUMNS,
    MAIL_SWITCH_COLUMNS: MAIL_SWITCH_COLUMNS,
    MAIL_SWITCH_STEPS: MAIL_SWITCH_STEPS,
    mailMapFromValues: mailMapFromValues,
    mailSwitchFromValues: mailSwitchFromValues,
    hops: hops,
    domainHops: domainHops,
    switchProgress: switchProgress,
    domainCards: domainCards
  };
});
