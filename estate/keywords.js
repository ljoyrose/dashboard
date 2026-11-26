(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateKeywords = api;
})(this, function () {
  'use strict';

  var SOURCES = ['Semrush', 'Search Console', 'Google Ads'];

  function str(v) { return v === undefined || v === null ? '' : String(v).trim(); }

  function positionOf(v) {
    var s = str(v);
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    var n = +s;
    return n > 0 ? n : null;
  }

  function keywordCard(manualRows) {
    return SOURCES.map(function (src) {
      var mine = (manualRows || []).filter(function (r) {
        return r && str(r.source).toLowerCase() === src.toLowerCase() && str(r.keyword) !== '';
      }).map(function (r) {
        var p = positionOf(r.position);
        return {
          keyword: str(r.keyword),
          position: p,
          position_word: p === null ? 'no position' : String(p),
          url: str(r.url),
          ads_account: str(r.ads_account),
          updated: str(r.updated)
        };
      });
      if (!mine.length) return { source: src, connected: false, word: 'not connected', rows: [] };
      mine.sort(function (a, b) {
        if (a.position === null && b.position === null) return a.keyword.localeCompare(b.keyword);
        if (a.position === null) return 1;
        if (b.position === null) return -1;
        return a.position - b.position || a.keyword.localeCompare(b.keyword);
      });
      return { source: src, connected: true, word: mine.length + ' keyword' + (mine.length > 1 ? 's' : ''), rows: mine };
    });
  }

  function adsAccounts(rows) {
    return (rows || []).filter(function (r) { return r && r.kind === 'ads-account'; }).map(function (r) {
      return {
        client: str(r.client) || str(r.company) || 'no client',
        account_label: str(r.url_or_domain) || str(r.brand) || str(r.key),
        access_note: str(r.access_note) || 'not reported'
      };
    });
  }

  return { SOURCES: SOURCES, positionOf: positionOf, keywordCard: keywordCard, adsAccounts: adsAccounts };
});

