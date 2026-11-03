// Web Estate Hub, Stage 10: who has access, the client view and the reseller report. Pure: no network, no Drive, no DOM.
// Reuses estate/core.js. Every example in the tests is invented; no estate row ever lives in this repo.
(function (root, factory) {
  'use strict';
  var core = (typeof module === 'object' && module.exports) ? require('./core.js') : root.EstateCore;
  var api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateViews = api;
})(this, function (E) {
  'use strict';

  // ---- access ----
  // A segment is dropped (and counted as hidden) when it holds an email address, or looks like a password or token.
  var SECRET_WORD = /pass(word)?|pwd|token|secret|api[\s_-]?key|\bkey\b|\bpin\b|otp|2fa|recovery|login code/i;
  function looksSecret(label, value) {
    if (/@/.test(label) || /@/.test(value)) return true;
    if (SECRET_WORD.test(label) || SECRET_WORD.test(value)) return true;
    // a long run of letters and digits mixed, with no spaces: treat as a token
    return /[A-Za-z0-9_\-+\/=]{16,}/.test(value) && /\d/.test(value) && /[A-Za-z]/.test(value);
  }

  // access_note 'owner: Sam; manager: agency' -> { key, roles: ['owner', 'manager'], hidden: 0 }.
  // Role names only: the holder after the colon is never returned. A segment without a colon is a role name itself.
  function accessRows(rows) {
    return (rows || []).map(function (r) {
      var roles = [], hidden = 0;
      String(r.access_note || '').split(/[;\n|]+/).forEach(function (seg) {
        seg = seg.trim();
        if (!seg) return;
        var i = seg.indexOf(':');
        var label = (i < 0 ? seg : seg.slice(0, i)).trim(), value = i < 0 ? '' : seg.slice(i + 1).trim();
        if (!label || looksSecret(label, value)) { hidden++; return; }
        label = label.toLowerCase();
        if (roles.indexOf(label) === -1) roles.push(label);
      });
      return { key: r.key, roles: roles, hidden: hidden };
    });
  }

  // ---- client view ----
  // Columns a client or reseller report must never carry.
  var INTERNAL = ['access_note', 'flag', 'source', 'keywords_tracked'];
  function isInternal(col) {
    var c = String(col).toLowerCase();
    return INTERNAL.indexOf(c) !== -1 || /^internal/.test(c) || /^note/.test(c) || /^reseller/.test(c);
  }
  function safeCopy(r) {
    var o = {};
    Object.keys(r).forEach(function (c) { if (!isInternal(c)) o[c] = r[c]; });
    return o;
  }
  // Only rows whose client is exactly that client (rows with a blank client belong to the company, not the client).
  function clientView(rows, client) {
    var want = String(client == null ? '' : client);
    if (!want.trim()) return [];
    return (rows || []).filter(function (r) { return String(r.client || '') === want; }).map(safeCopy);
  }

  // ---- reseller report (report only, no billing) ----
  function money(v) {
    var s = String(v == null ? '' : v).replace(/[£,\s]/g, '');
    if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return '';
    var n = Number(s), parts = Math.abs(n).toFixed(2).split('.');
    return (n < 0 ? '-' : '') + '£' + parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + parts[1];
  }
  function ukDate(v) {
    var d = E.parseDay(v);
    if (d === null) return '';
    var t = new Date(d), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(t.getUTCDate()) + '/' + p(t.getUTCMonth() + 1) + '/' + t.getUTCFullYear();
  }
  // Rows with a reseller -> { key, url_or_domain, reseller, fee_monthly ('£12.50' or ''), renewal ('29/11/2026' or ''),
  // days_to_go (number or null) }. Missing extra columns simply give no rows.
  function resellerReport(rows, today) {
    return (rows || []).filter(function (r) { return String(r.reseller || '').trim() !== ''; }).map(function (r) {
      return {
        key: r.key,
        url_or_domain: r.url_or_domain || '',
        reseller: String(r.reseller).trim(),
        fee_monthly: money(r.reseller_fee_monthly),
        renewal: ukDate(r.reseller_renewal),
        days_to_go: today == null ? null : E.daysUntil(r.reseller_renewal, today)
      };
    });
  }

  return {
    accessRows: accessRows,
    clientView: clientView,
    isInternal: isInternal,
    resellerReport: resellerReport,
    money: money,
    ukDate: ukDate
  };
});
