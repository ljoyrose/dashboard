// Web Estate Hub: shop and funnel logic (Stages 7 and 8). Pure: no network, no Drive, no DOM.
// Tag words follow core.js: a word and a count, never an id. Missing shop facts say "not reported", never "ok" or 0.
// Every example in the tests is invented; no estate row ever lives in this repo.
(function (root, factory) {
  'use strict';
  var core = (typeof module === 'object' && module.exports) ? require('./core.js') : root.EstateCore;
  var api = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateShop = api;
})(this, function (core) {
  'use strict';

  var NOT_REPORTED = 'not reported';
  var MC_LINKED = 'linked (per Lisa, not machine-checked)';
  var PLATFORM_APPS = ['Google & YouTube app', 'Facebook & Instagram app', 'Shopify web pixels', 'ClickFunnels'];

  // ---- Stage 7: tags ----
  // readTags() result -> words only. loaded_by names the platform app that injects the tags, or '' when none seen.
  function tagSummary(tags, checked) {
    var t = tags || {};
    var ok = !!checked && !!tags;
    var apps = ok ? (t.loadedBy || []).filter(function (a) { return PLATFORM_APPS.indexOf(a) !== -1; }) : [];
    return {
      ga4: core.tagWord(t.ga4, ok),
      gtm: core.tagWord(t.gtm, ok),
      meta_pixel: core.tagWord(t.meta, ok),
      loaded_by: !ok ? 'not checked' : (apps.length ? 'loaded by ' + apps.join(' and ') : '')
    };
  }

  function blank(v) { return v === undefined || v === null || String(v).trim() === ''; }
  function foundCount(v) { var m = /found \((\d+)\)/i.exec(String(v || '')); return m ? +m[1] : 0; }

  // The first test shop's row must carry all of these. Returns the names of the blank or failed fields; [] = all pass.
  // Merchant Center and target country are facts Lisa gives (not machine-checked); SSL and DMARC come from scans.
  function firstTestRowCheck(row, today) {
    var r = row || {}, out = [];
    if (core.statusOf(r) !== 'live') out.push('live_status');
    if (foundCount(r.ga4) < 1) out.push('ga4');
    if (String(r.source || '').indexOf('Google & YouTube app') === -1) out.push('source');
    var gb = String(r.target_country || '').trim().toUpperCase() === 'GB' ||
      /\bGB\b/.test(String(r.access_note || '')) || /\bGB\b/.test(String(r.feed || ''));
    if (!gb) out.push('target_country');
    if (String(r.merchant_center || '').trim() !== MC_LINKED) out.push('merchant_center');
    var d = core.daysUntil(r.ssl_expires, today);
    if (d === null || d <= 0) out.push('ssl_expires');
    if (!/missing/i.test(String(r.dmarc || ''))) out.push('dmarc');
    return out;
  }

  // ---- Stage 8: shop card ----
  function word(v) {
    if (blank(v)) return NOT_REPORTED;
    if (Array.isArray(v)) return v.length ? v.join(', ') : NOT_REPORTED;
    return String(v).trim();
  }

  // row: a shop row; report: a free-listings report {feed_status, merchant_center_status, products, channels,
  // plan, currency} or nothing. Without a report, feed and Merchant Center are "not reported".
  function shopCard(row, report) {
    var r = row || {}, rep = report || null;
    var get = function (k) { return rep ? rep[k] : undefined; };
    return {
      platform: word(r.platform),
      plan: word(get('plan') !== undefined ? get('plan') : r.plan),
      currency: word(get('currency') !== undefined ? get('currency') : r.currency),
      products: word(get('products')),
      channels: word(get('channels')),
      feed: rep ? word(rep.feed_status) : NOT_REPORTED,
      merchant_center: rep ? word(rep.merchant_center_status) : NOT_REPORTED
    };
  }

  // ---- Stage 8: ClickFunnels funnels, read-only ----
  function workspaceOf(r) {
    var m = /workspace:\s*([^;|,\n]+)/i.exec(String(r.access_note || ''));
    if (m && m[1].trim()) return m[1].trim();
    return r.brand || r.company || 'no workspace';
  }

  // Groups ClickFunnels rows by workspace: [{workspace, count, live, down}], sorted by workspace name.
  function funnelsByWorkspace(rows) {
    var by = {};
    (rows || []).forEach(function (r) {
      if (String(r.platform || '').trim().toLowerCase() !== 'clickfunnels') return;
      var w = workspaceOf(r);
      var g = by[w] || (by[w] = { workspace: w, count: 0, live: 0, down: 0 });
      g.count++;
      var s = core.statusOf(r);
      if (s === 'live') g.live++;
      else if (s === 'down') g.down++;
    });
    return Object.keys(by).sort(function (a, b) { return a.localeCompare(b); }).map(function (k) { return by[k]; });
  }

  return {
    NOT_REPORTED: NOT_REPORTED,
    MC_LINKED: MC_LINKED,
    tagSummary: tagSummary,
    firstTestRowCheck: firstTestRowCheck,
    shopCard: shopCard,
    workspaceOf: workspaceOf,
    funnelsByWorkspace: funnelsByWorkspace
  };
});
