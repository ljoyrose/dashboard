// A stand-in for Google's sign-in script (https://accounts.google.com/gsi/client).
// The real one opens a Google pop-up. This one answers instantly and never contacts Google.
// The test chooses what happens by setting window.__GIS_MODE before the page loads:
//   'ok'            sign-in works and every permission is granted (default)
//   'denied-scope'  sign-in works but the Drive permission is NOT granted
//   'error'         Google reports an error in the sign-in answer
//   'popup-closed'  the person closed the sign-in window
//   'popup-blocked' the browser blocked the sign-in window
//   'silent-ok'     a silent refresh (prompt:'' with no extra scope) also succeeds.
//                   By default that silent refresh fails, so a first visit still shows
//                   the sign-in button. A write upgrade uses prompt:'' WITH a scope, and still succeeds.
module.exports = `
(function () {
  function mode() { return window.__GIS_MODE || 'ok'; }
  window.__GIS_CALLS = { init: 0, request: 0, revoke: 0 };
  window.google = { accounts: { oauth2: {
    initTokenClient: function (cfg) {
      window.__GIS_CALLS.init++;
      window.__GIS_LAST_CONFIG = { client_id: cfg.client_id, scope: cfg.scope };
      return { requestAccessToken: function (opts) {
        window.__GIS_CALLS.request++;
        window.__GIS_LAST_REQUEST = opts || {};
        var scope = (opts && opts.scope) || cfg.scope;
        setTimeout(function () {
          var m = mode();
          if (opts && opts.prompt === '' && !opts.scope && m !== 'silent-ok') {
            if (cfg.error_callback) cfg.error_callback({ type: 'silent_failed' });
            return;
          }
          if (m === 'popup-closed' || m === 'popup-blocked') {
            if (cfg.error_callback) cfg.error_callback({ type: m === 'popup-closed' ? 'popup_closed' : 'popup_failed_to_open' });
            return;
          }
          if (m === 'error') { cfg.callback({ error: 'access_denied' }); return; }
          cfg.callback({ access_token: 'FAKE-TEST-TOKEN', expires_in: 3600, scope: m === 'denied-scope' ? 'openid' : scope, token_type: 'Bearer' });
        }, 0);
      } };
    },
    hasGrantedAllScopes: function (resp, s) {
      if (mode() === 'denied-scope') return false;
      var have = String(resp && resp.scope || '').split(' ');
      return String(s).split(' ').every(function (x) { return have.indexOf(x) >= 0; });
    },
    revoke: function (token, done) { window.__GIS_CALLS.revoke++; if (done) setTimeout(done, 0); }
  } } };
})();
`;
