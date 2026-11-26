// Web Estate Hub: per-site traffic this month (visits, CDN or bandwidth use against the plan's quota).
// Pure: no network, no Drive, no DOM. The numbers live only in the private RR_WEB-ESTATE sheet, Traffic tab, filled by
// the estate engine from read-only analytics APIs, or typed by the owner where a host has no API. Nothing here holds a number.
// Free plans stay free (the owner, 13 Nov 2026): amber at 80%, red at 95% or more, plain words, no upgrade prompt or button.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateTraffic = api;
})(this, function () {
  'use strict';

  var VERSION = '1.0.0';
  var TAB = 'Traffic';
  var COLUMNS = ['key', 'source', 'period', 'visits', 'used_gb', 'quota_gb', 'updated_uk', 'note'];
  var AMBER = 80, RED = 95, STALE_DAYS = 2;
  var SITE_KINDS = ['site', 'shop', 'funnel', 'app'];
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function str(v) { return v === undefined || v === null ? '' : String(v).trim(); }
  function isSite(row) { return !!row && SITE_KINDS.indexOf(str(row.kind)) !== -1; }

  function count(v) {
    var s = str(v).replace(/,/g, '');
    return /^\d+(\.\d+)?$/.test(s) ? Math.round(+s) : null;
  }
  function gb(v) {
    var m = /^(\d+(?:\.\d+)?)\s*(kb|mb|gb|tb)?$/i.exec(str(v).replace(/,/g, ''));
    if (!m) return null;
    var n = +m[1], u = (m[2] || 'gb').toLowerCase();
    return u === 'tb' ? n * 1024 : u === 'mb' ? n / 1024 : u === 'kb' ? n / 1048576 : n;
  }

  function level(pct) {
    if (pct === null || pct === undefined || isNaN(pct)) return 'none';
    return pct >= RED ? 'red' : pct >= AMBER ? 'amber' : 'ok';
  }
  var LEVEL_WORD = { ok: 'Under 80% of quota', amber: '80% or more of quota', red: '95% or more of quota', none: '' };

  function gbWord(n) { return n === null ? '' : (n < 10 ? (Math.round(n * 10) / 10).toFixed(1) : String(Math.round(n))) + ' GB'; }
  function numWord(n) { return n === null ? '' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  function ukMonth(now) {
    var d = now instanceof Date ? now : new Date(now);
    var s = d.toLocaleString('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit' });
    var m = /(\d{2})\/(\d{4})/.exec(s);
    return m ? m[2] + '-' + m[1] : d.toISOString().slice(0, 7);
  }
  function periodKey(v) {
    var s = str(v), m;
    if ((m = /^(\d{4})-(\d{1,2})/.exec(s))) return m[1] + '-' + ('0' + m[2]).slice(-2);
    if ((m = /^(\d{1,2})\/(\d{4})$/.exec(s))) return m[2] + '-' + ('0' + m[1]).slice(-2);
    if ((m = /^([a-z]{3})[a-z]*\s+(\d{4})$/i.exec(s))) {
      var i = MONTHS.map(function (x) { return x.toLowerCase(); }).indexOf(m[1].toLowerCase());
      if (i !== -1) return m[2] + '-' + ('0' + (i + 1)).slice(-2);
    }
    return '';
  }
  function periodWord(key) { var m = /^(\d{4})-(\d{2})$/.exec(key || ''); return m ? MONTHS[+m[2] - 1] + ' ' + m[1] : ''; }

  function updatedAt(v) {
    var s = str(v), m;
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/.exec(s))) return Date.UTC(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
    var t = Date.parse(s);
    return isNaN(t) ? null : t;
  }

  // ---- the owner-only setup steps, by where the site is hosted ----
  // Each names where to make a READ-ONLY token (or the manual route when the host has no API) and the Script Property
  // the estate engine reads. Tokens go in Script Properties only, never in the sheet, the repo or a chat.
  var SETUPS = [
    { id: 'siteground', test: /siteground/i, source: 'SiteGround CDN', property: '',
      steps: ['SiteGround has no read-only stats API, so the engine cannot fetch this.',
        'Once a week: SiteGround Site Tools > Speed > CDN > Dashboard. Read the bandwidth used this month.',
        'Site Tools > Statistics > Traffic: read the unique visitors this month.',
        'Type both into the Traffic tab row for this site: used_gb, visits, quota_gb 10, period (yyyy-mm), updated_uk, source "SiteGround CDN (typed)".'] },
    { id: 'cloudflare', test: /cloudflare/i, source: 'Cloudflare analytics', property: 'ESTATE_CF_TOKEN',
      steps: ['Cloudflare dashboard > My Profile > API Tokens > Create Token > template "Read analytics and logs".',
        'Permissions: Zone > Analytics > Read only. Zone resources: this site\'s zone.',
        'Copy the token. Open the RR_WEB-ESTATE engine > Project Settings > Script Properties > Add property ESTATE_CF_TOKEN, paste, Save.'] },
    { id: 'shopify', test: /shopify/i, source: 'Shopify analytics', property: 'ESTATE_SHOPIFY_TOKENS',
      steps: ['Shopify admin > Settings > Apps and sales channels > Develop apps > Create an app.',
        'Admin API scopes: read_reports only. Install the app and copy the Admin API access token.',
        'RR_WEB-ESTATE engine > Project Settings > Script Properties > ESTATE_SHOPIFY_TOKENS: one line per shop, "<shop key>=<token>".',
        'Shopify has no bandwidth quota, so this shows visits only.'] },
    { id: 'ga4', test: /ga4|google analytics/i, source: 'Google Analytics 4', property: 'ESTATE_GA4_PROPERTIES',
      steps: ['No token needed: the engine reads GA4 as User. In the RR_WEB-ESTATE engine editor: Services > + > Google Analytics Data API > Add.',
        'GA4 > Admin > Property details: copy the property id (numbers only).',
        'Script Properties > ESTATE_GA4_PROPERTIES: one line per site, "<site key>=<property id>". Visits only; GA4 has no bandwidth quota.'] }
  ];
  var GENERIC = { id: 'other', source: 'not set', property: 'ESTATE_GA4_PROPERTIES',
    steps: ['This host has no stats feed wired yet.',
      'Quickest route: if the site has GA4, follow the GA4 step (Script Property ESTATE_GA4_PROPERTIES, no token) for visits.',
      'For bandwidth: type the host\'s monthly figure into the Traffic tab row (used_gb, quota_gb, period, updated_uk, source).'] };

  function setupFor(site, traf) {
    var hay = [str(traf && traf.source), str(site && site.platform), str(site && site.dns_host)].join(' ');
    for (var i = 0; i < SETUPS.length; i++) if (SETUPS[i].test.test(hay)) return SETUPS[i];
    if (/^found/i.test(str(site && site.ga4))) return SETUPS[3];
    return GENERIC;
  }

  function rowFor(site, tabRows) {
    var k = str(site && site.key).toLowerCase();
    if (!k) return null;
    var hit = (tabRows || []).filter(function (t) { return t && str(t.key).toLowerCase() === k; });
    return hit.length ? hit[hit.length - 1] : null;
  }

  function trafficFor(site, tabRows, now) {
    now = now || new Date();
    var t = rowFor(site, tabRows), setup = setupFor(site, t);
    var visits = t ? count(t.visits) : null, used = t ? gb(t.used_gb) : null, quota = t ? gb(t.quota_gb) : null;
    if (!t || (visits === null && used === null)) {
      return { connected: false, word: 'stats not connected', source: str(t && t.source) || setup.source, note: str(t && t.note), setup: setup };
    }
    var pct = used !== null && quota ? Math.round((used / quota) * 100) : null;
    var pk = periodKey(t.period), ms = updatedAt(t.updated_uk);
    return {
      connected: true,
      visits: visits, used_gb: used, quota_gb: quota, pct: pct, level: level(pct),
      visits_word: visits === null ? 'not reported' : numWord(visits),
      use_word: used === null ? 'not reported' : gbWord(used) + (quota ? ' of ' + gbWord(quota) + ' (' + pct + '%)' : ' (no quota given)'),
      period: pk, period_word: pk ? periodWord(pk) : 'period not given', current: pk === ukMonth(now),
      updated: str(t.updated_uk), updated_ms: ms, stale: ms === null || (now.getTime() - ms) > STALE_DAYS * 864e5,
      source: str(t.source) || 'not given', note: str(t.note), setup: setup
    };
  }

  function summary(rows, tabRows, now) {
    var c = { sites: 0, connected: 0, notConnected: 0, amber: 0, red: 0 };
    (rows || []).forEach(function (r) {
      if (!isSite(r)) return;
      c.sites++;
      var t = trafficFor(r, tabRows, now);
      if (!t.connected) { c.notConnected++; return; }
      c.connected++;
      if (t.level === 'amber') c.amber++;
      if (t.level === 'red') c.red++;
    });
    return c;
  }

  function checkHeader(header) {
    var h = (header || []).map(function (x) { return str(x).toLowerCase(); });
    var problems = [];
    if (h.indexOf('key') === -1) problems.push('Traffic tab has no key column');
    if (h.indexOf('visits') === -1 && h.indexOf('used_gb') === -1) problems.push('Traffic tab has neither visits nor used_gb');
    return { ok: !problems.length, problems: problems };
  }

  return {
    VERSION: VERSION, TAB: TAB, COLUMNS: COLUMNS, AMBER: AMBER, RED: RED, STALE_DAYS: STALE_DAYS, SITE_KINDS: SITE_KINDS,
    LEVEL_WORD: LEVEL_WORD, SETUPS: SETUPS, GENERIC: GENERIC,
    isSite: isSite, count: count, gb: gb, level: level, gbWord: gbWord, numWord: numWord,
    ukMonth: ukMonth, periodKey: periodKey, periodWord: periodWord, updatedAt: updatedAt,
    setupFor: setupFor, rowFor: rowFor, trafficFor: trafficFor, summary: summary, checkHeader: checkHeader
  };
});

