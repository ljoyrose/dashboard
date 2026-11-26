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
          var personalClient = cfg.scope === 'https://www.googleapis.com/auth/drive.metadata.readonly';
          var fullDrive = String(scope).split(' ').indexOf('https://www.googleapis.com/auth/drive') >= 0;
          var tok = personalClient ? (fullDrive ? 'FAKE-PERSONAL-BIN-TOKEN' : 'FAKE-PERSONAL-TOKEN') : 'FAKE-TEST-TOKEN';
          cfg.callback({ access_token: tok, expires_in: 3600, scope: m === 'denied-scope' ? 'openid' : scope, token_type: 'Bearer' });
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

