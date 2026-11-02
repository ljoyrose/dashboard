// Web Estate Hub, Stage 4: live, down and SSL. Pure logic; the engine (Apps Script) does the fetching.
// No network, no Drive, no DOM. Turns one HTTP/TLS result into a status word, picks a certificate expiry
// from Certificate Transparency rows, and reads a domain's renewal date from a registrar CSV.
// Rule: ClickFunnels "live mode" means live payments, not a visible page. It is never a status here;
// the status comes only from the HTTP/TLS result.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateStatus = api;
})(this, function () {
  'use strict';

  var VERSION = '1.0.0';

  // ---- page bodies ----
  var CHALLENGE = [
    /<title>\s*just a moment/i,
    /cf-challenge|cf_chl_|challenge-platform/i,
    /attention required!?\s*\|?\s*cloudflare/i,
    /<title>\s*attention required/i
  ];
  // Captcha markers also sit inside normal pages (a shop's login form script), so they count only on a
  // short page or a non-2xx answer: a real challenge page is small and carries little else.
  var CAPTCHA = /g-recaptcha|h-captcha|hcaptcha\.com|captcha-delivery|px-captcha/i;
  var CHALLENGE_MAX = 20000;
  var PARKED_BODY = [
    /sedoparking|sedo\.com\/search\/details|sedo domain parking/i,
    /parkingcrew/i,
    /bodis\.com|bodiscdn/i,
    /this domain (name )?(is|has been) parked/i,
    /domain(\s+[a-z0-9.-]+)?\s+(is|may be)\s+for sale|domain for sale|buy this domain/i,
    /parked free,? courtesy of godaddy|godaddy\.com\/park|img1\.wsimg\.com\/parking-lander/i,
    /namecheap.{0,40}parking|parkingpage\.namecheap\.com|this domain is registered at namecheap/i,
    /123-reg.{0,60}(parked|holding page|coming soon)|this domain has been registered with 123-reg/i,
    /parking-lander|domain parking|parked domain/i
  ];
  var PARKED_HOST = /(^|\.)(sedoparking\.com|sedo\.com|parkingcrew\.net|bodis\.com|parkingpage\.namecheap\.com|dan\.com|afternic\.com|hugedomains\.com|undeveloped\.com)$/i;

  function hostOf(url) {
    var m = /^[a-z][a-z0-9+.-]*:\/\/([^\/?#:]+)/i.exec(String(url || ''));
    return m ? m[1].toLowerCase().replace(/\.$/, '') : '';
  }

  function matchAny(list, s) {
    for (var i = 0; i < list.length; i++) if (list[i].test(s)) return true;
    return false;
  }

  // One fetch result -> { live_status, http_code, note }.
  // In: code (final HTTP status), finalUrl, body, tlsError, timeout, error (other failure text), redirects (count).
  function classifyResponse(r) {
    r = r || {};
    var code = Number(r.code) || 0;
    var body = String(r.body || '').slice(0, 200000);
    var hops = Number(r.redirects) || 0;
    var via = hops ? ' after ' + hops + ' redirect' + (hops === 1 ? '' : 's') : '';
    var out = function (s, note) { return { live_status: s, http_code: code ? String(code) : '', note: note }; };

    if (r.tlsError) return out('down', 'certificate or TLS failure' + (typeof r.tlsError === 'string' ? ': ' + r.tlsError : ''));
    if (r.timeout) return out('down', 'no answer (timed out)');
    if (r.error && !code) {
      var e = String(r.error);
      if (/ENOTFOUND|EAI_AGAIN|NXDOMAIN|dns|not resolve|name or service not known|address unavailable/i.test(e)) return out('down', 'domain does not resolve (no DNS)');
      if (/cert|ssl|tls|handshake|self.signed|altname/i.test(e)) return out('down', 'certificate or TLS failure: ' + e);
      if (/ECONNREFUSED|refused/i.test(e)) return out('down', 'connection refused');
      return out('down', 'no answer: ' + e);
    }
    if (!code) return out('down', 'no answer');

    var finalHost = hostOf(r.finalUrl);
    if ((finalHost && PARKED_HOST.test(finalHost)) || matchAny(PARKED_BODY, body)) {
      return out('parked', 'registrar parking page' + via);
    }
    var ok = code >= 200 && code < 300;
    var captcha = CAPTCHA.test(body) && (!ok || body.length < CHALLENGE_MAX);
    if (code === 403 || matchAny(CHALLENGE, body) || captcha) {
      return out('blocked to scripts', code === 403 ? 'refuses scripted checks (403)' : 'bot challenge page' + via);
    }
    if (ok) return out('live', 'page answers (' + code + ')' + via);
    if (code >= 500) return out('down', 'server error (' + code + ')');
    if (code === 404) return out('down', 'page not found (404)');
    if (code === 410) return out('down', 'page gone (410)');
    if (code === 429) return out('blocked to scripts', 'rate limited (429)');
    if (code >= 400) return out('down', 'client error (' + code + ')');
    if (code >= 300) return out('down', 'redirect not followed (' + code + ')');
    return out('down', 'unexpected answer (' + code + ')');
  }

  // ---- dates ----
  function isoOf(v) {
    var s = String(v == null ? '' : v).trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return '';
  }
  function todayIso(today) {
    if (today instanceof Date) return today.toISOString().slice(0, 10);
    return isoOf(today) || new Date().toISOString().slice(0, 10);
  }

  // ---- certificates (crt.sh JSON) ----
  function nameMatches(pattern, host) {
    var p = String(pattern || '').trim().toLowerCase().replace(/\.$/, '');
    if (!p) return false;
    if (p === host) return true;
    if (p.indexOf('*.') === 0) {
      var base = p.slice(2);
      if (host.length <= base.length + 1) return false;
      if (host.slice(-(base.length + 1)) !== '.' + base) return false;
      return host.slice(0, -(base.length + 1)).indexOf('.') === -1;
    }
    return false;
  }

  // Latest not_after (YYYY-MM-DD) among certificates valid today that cover host; '' when none.
  function certExpiryFromCt(entries, host, today) {
    var h = String(host || '').trim().toLowerCase().replace(/\.$/, '');
    var t = todayIso(today);
    var best = '';
    (Array.isArray(entries) ? entries : []).forEach(function (e) {
      if (!e) return;
      var names = String(e.name_value || '').split(/\s*\n\s*/);
      if (e.common_name) names.push(String(e.common_name));
      var covers = names.some(function (n) { return nameMatches(n, h); });
      if (!covers) return;
      var from = isoOf(e.not_before), to = isoOf(e.not_after);
      if (!from || !to || from > t || to < t) return;
      if (to > best) best = to;
    });
    return best;
  }

  // ---- domains ----
  var THREE_LABEL = /\.(co|org|me|ltd|plc|net)\.uk$|\.com\.au$/;
  function registrable(host) {
    var h = String(host || '').trim().toLowerCase();
    h = h.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[\/?#:].*$/, '').replace(/\.$/, '');
    var labels = h.split('.').filter(Boolean);
    var keep = THREE_LABEL.test(h) ? 3 : 2;
    return labels.slice(-keep).join('.');
  }

  var DOMAIN_COLS = ['domain', 'domain_name', 'domain name', 'name', 'host', 'url', 'url_or_domain'];
  var EXPIRY_COLS = ['expiry', 'expires', 'expiry_date', 'expiry date', 'expiration', 'expiration_date', 'expiration date', 'expires_on', 'renewal_date', 'renewal date', 'renewal', 'renews', 'domain_expires'];

  function pick(row, cols) {
    var keys = Object.keys(row || {});
    for (var i = 0; i < cols.length; i++) {
      for (var j = 0; j < keys.length; j++) {
        if (keys[j].trim().toLowerCase() === cols[i] && String(row[keys[j]]).trim() !== '') return String(row[keys[j]]).trim();
      }
    }
    return '';
  }

  // Renewal date (YYYY-MM-DD) for the registrable domain of `domain`; '' when no row or no readable date.
  function domainExpiry(domainRows, domain) {
    var want = registrable(domain);
    if (!want) return '';
    var rows = Array.isArray(domainRows) ? domainRows : [];
    for (var i = 0; i < rows.length; i++) {
      var d = pick(rows[i], DOMAIN_COLS);
      if (d && registrable(d) === want) {
        var exp = isoOf(pick(rows[i], EXPIRY_COLS));
        if (exp) return exp;
      }
    }
    return '';
  }

  return {
    VERSION: VERSION,
    classifyResponse: classifyResponse,
    certExpiryFromCt: certExpiryFromCt,
    domainExpiry: domainExpiry,
    registrable: registrable
  };
});
