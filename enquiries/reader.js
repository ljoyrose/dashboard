// Puppy Enquiries Hub: reads the private RR_ENQUIRIES sheet with Lisa's Google sign-in (JOB 13 Stage 2).
// PUBLIC repo: no data here. The sheet id comes from config.js (DASH_CONFIG.enquiries.sheetId); every row is read at run time.
// One batchGet for all tabs; each tab goes through EnquiriesCore.parseTab, which refuses a tab whose header row breaks the
// contract (fail closed: that tab gives no rows and a plain-English problem instead). Read only: this file never writes.
(function (root) {
  'use strict';
  var Core = root.EnquiriesCore || (typeof require === 'function' ? require('./core.js') : null);
  var TABS = ['Enquiries', 'People', 'Events', 'Drafts', 'FollowUps', 'Litters', 'Sale Replies', 'Deposits', 'Sources', 'Settings', 'Results'];
  var API = 'https://sheets.googleapis.com/v4/spreadsheets/';

  function rangeOf(tab) { return "'" + tab.replace(/'/g, "''") + "'!A1:AZ"; }

  function batchUrl(sheetId, tabs) {
    return API + encodeURIComponent(sheetId) + '/values:batchGet?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING&'
      + (tabs || TABS).map(function (t) { return 'ranges=' + encodeURIComponent(rangeOf(t)); }).join('&');
  }

  // Plain words for a Google error, the same style as the other hubs.
  function why(status, msg) {
    msg = String(msg || '');
    if (status === 401) return 'Sign-in expired. Sign in again.';
    if (/insufficient|scope/i.test(msg)) return 'Google did not give this page spreadsheet access. Sign out, sign in again and tick every box Google shows.';
    if (/permission|forbidden|caller does not have/i.test(msg) || status === 403) return 'this Google account cannot open the RR_ENQUIRIES sheet.';
    if (/Unable to parse range/i.test(msg)) return 'RR_ENQUIRIES is missing a tab. Run setup() once in the enquiries engine.';
    if (status === 404) return 'RR_ENQUIRIES was not found: check the sheet id in config.js.';
    return 'Google said ' + status + (msg ? ': ' + msg : '');
  }

  // load({ sheetId, token, fetch }) -> Promise<{ ok, tabs: { Enquiries: { ok, problems, rows }, ... }, problems }>
  // fetch defaults to DashKit.googleFetch (retries busy answers), then window.fetch.
  function load(o) {
    o = o || {};
    if (!o.sheetId) return Promise.resolve({ ok: false, problems: ['Not set up yet: no enquiries sheet id in config.js.'], tabs: {} });
    if (!o.token) return Promise.resolve({ ok: false, problems: ['Not signed in.'], tabs: {} });
    var f = o.fetch || (root.DashKit && root.DashKit.googleFetch) || root.fetch;
    var tabs = o.tabs || TABS;
    return f(batchUrl(o.sheetId, tabs), { headers: { Authorization: 'Bearer ' + o.token } }).then(function (r) {
      if (!r.ok) return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(why(r.status, j.error && j.error.message)); });
      return r.json();
    }).then(function (j) {
      var out = { ok: true, tabs: {}, problems: [] };
      var vr = j.valueRanges || [];
      tabs.forEach(function (t, i) {
        var p = Core.parseTab(t, (vr[i] && vr[i].values) || []);
        out.tabs[t] = p;
        if (!p.ok) { out.problems = out.problems.concat(p.problems); if (t === 'Enquiries') out.ok = false; }
      });
      return out;
    });
  }

  var api = { TABS: TABS, batchUrl: batchUrl, load: load, why: why };
  root.EnquiriesReader = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
