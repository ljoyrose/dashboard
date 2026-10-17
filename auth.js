// One Google sign-in for the home page, Money Hub and CD Hub.
// The access token and its expiry live in this browser tab only, under one key.
// A valid token is reused. When it is missing or expired, the page asks again
// with a silent prompt first. Nothing here is a client secret or a refresh token.
(function (global) {
  'use strict';
  var KEY = 'ljr-dash-auth';

  function read() {
    try {
      var raw = sessionStorage.getItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data.access_token !== 'string' || !data.access_token || typeof data.expires_at !== 'number' || !isFinite(data.expires_at)) {
        sessionStorage.removeItem(KEY);
        return null;
      }
      data.scope = typeof data.scope === 'string' ? data.scope : '';
      return data;
    } catch (e) {
      try { sessionStorage.removeItem(KEY); } catch (e2) {}
      return null;
    }
  }

  function valid() {
    var data = read();
    if (!data || Date.now() >= data.expires_at) return null;
    return data;
  }

  function expired() {
    var data = read();
    return !!(data && Date.now() >= data.expires_at);
  }

  // A Drive 401 means the saved token is no good, even if our clock has not reached its expiry yet.
  function markExpired() {
    var data = read();
    if (!data) return false;
    if (data.expires_at > Date.now()) save(data.access_token, Date.now() - 1000, data.scope);
    return true;
  }

  function save(token, expiresAt, scope) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({
        access_token: token,
        expires_at: expiresAt,
        scope: scope || ''
      }));
    } catch (e) {}
  }

  function clear() {
    try { sessionStorage.removeItem(KEY); } catch (e) {}
  }

  function hasScope(data, scope) {
    if (!data || !scope) return false;
    var have = String(data.scope || '').split(/\s+/);
    return String(scope).split(/\s+/).filter(Boolean).every(function (s) { return have.indexOf(s) !== -1; });
  }

  // Same one-minute early expiry the pages already used, so a token is not reused on its last second.
  function expiryFrom(expiresIn) {
    return Date.now() + (Number(expiresIn) || 3600) * 1000 - 60000;
  }

  // One token client per page. Requests are queued so a silent refresh and a button click cannot get mixed up.
  function bind(opts) {
    var client = null;
    var queue = [];
    var hadExpired = false;

    function requestSilent() {
      if (!client) return false;
      hadExpired = expired();
      queue.push('silent');
      client.requestAccessToken({ prompt: '' });
      return true;
    }

    function init() {
      if (client) return true;
      if (!(global.google && google.accounts && google.accounts.oauth2)) return false;
      client = google.accounts.oauth2.initTokenClient({
        client_id: opts.clientId,
        scope: opts.scope,
        callback: function (resp) {
          var kind = queue.shift() || 'interactive';
          if (kind === 'silent') {
            var ok = resp && !resp.error && google.accounts.oauth2.hasGrantedAllScopes(resp, opts.scope);
            if (!ok) {
              if (opts.onSilentFail) opts.onSilentFail(hadExpired);
              return;
            }
          }
          opts.onToken(resp);
        },
        error_callback: function (e) {
          var kind = queue.shift() || 'interactive';
          if (kind === 'silent') {
            if (opts.onSilentFail) opts.onSilentFail(hadExpired);
            return;
          }
          if (opts.onError) opts.onError(e || {});
        }
      });
      var saved = valid();
      if (!saved || !hasScope(saved, opts.scope)) requestSilent();
      return true;
    }

    function requestInteractive(extra) {
      if (!client) return;
      queue.push('interactive');
      var params = { prompt: 'select_account' };
      if (extra) Object.keys(extra).forEach(function (k) { params[k] = extra[k]; });
      client.requestAccessToken(params);
    }

    function requestWrite(scope) {
      if (!client) return;
      queue.push('write');
      client.requestAccessToken({ scope: scope, include_granted_scopes: true, prompt: '' });
    }

    return {
      init: init,
      ready: function () { return !!client; },
      requestInteractive: requestInteractive,
      requestSilent: requestSilent,
      requestWrite: requestWrite
    };
  }

  global.DashAuth = {
    KEY: KEY,
    read: read,
    valid: valid,
    expired: expired,
    markExpired: markExpired,
    save: save,
    clear: clear,
    hasScope: hasScope,
    expiryFrom: expiryFrom,
    bind: bind
  };
})(window);
