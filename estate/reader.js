// Web Estate Hub: reads the private RR_WEB-ESTATE sheet with Lisa's Google sign-in (the same token the other pages use)
// and checks it against the data contract in core.js before any row is shown. Read only: it never writes.
// The sheet id comes from config.js (DASH_CONFIG.estate.sheetId). Until it is set the reader returns "not set up".
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EstateReader = api;
})(this, function (root) {
  'use strict';

  var TAB = 'Properties';
  var Core = (root && root.EstateCore) || (typeof require === 'function' ? require('./core.js') : null);

  function rangeUrl(sheetId) {
    return 'https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(sheetId) + '/values/' +
      encodeURIComponent(TAB) + '?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE';
  }

  // Plain words for what Google said.
  function why(status, msg) {
    if (status === 401) return 'sign-in expired: sign in again';
    if (/insufficient|scope/i.test(msg)) return 'Google did not give this page read access: sign out, sign in again and tick every box';
    if (/permission|forbidden|caller does not have/i.test(msg) || status === 403) return 'this Google account cannot open the RR_WEB-ESTATE sheet';
    if (/Unable to parse range/i.test(msg)) return 'the RR_WEB-ESTATE sheet has no "' + TAB + '" tab: run setup once in the estate engine';
    if (status === 404) return 'the RR_WEB-ESTATE sheet was not found: check the id in config.js';
    return 'Google said ' + status + (msg ? ': ' + msg : '');
  }

  // opts: { sheetId, token, fetch } where fetch defaults to DashKit.googleFetch (retries on busy) or plain fetch.
  // Resolves { ok, rows, skipped, problems, state } and never rejects: state is one of
  // 'not-set-up', 'signed-out', 'error', 'bad-columns', 'ok'.
  function read(opts) {
    opts = opts || {};
    var fetchFn = opts.fetch || (root && root.DashKit && root.DashKit.googleFetch) || (root && root.fetch);
    var done = function (state, problems) { return { ok: false, rows: [], skipped: 0, problems: problems, state: state }; };
    if (!opts.sheetId) return Promise.resolve(done('not-set-up', ['not set up yet: the RR_WEB-ESTATE sheet id is not in config.js']));
    if (!opts.token) return Promise.resolve(done('signed-out', ['sign in to read the estate']));
    if (!Core || !fetchFn) return Promise.resolve(done('error', ['the estate page did not load its helpers']));
    return Promise.resolve()
      .then(function () { return fetchFn(rangeUrl(opts.sheetId), { headers: { Authorization: 'Bearer ' + opts.token } }); })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          if (!res.ok) return done('error', [why(res.status, (j.error && j.error.message) || '')]);
          var out = Core.rowsFromValues(j.values || []);
          out.state = out.ok ? 'ok' : 'bad-columns';
          return out;
        });
      })
      .catch(function (e) { return done('error', ['could not reach Google: ' + ((e && e.message) || e)]); });
  }

  return { TAB: TAB, rangeUrl: rangeUrl, read: read, why: why };
});
