// One Google sign-in for the home page, Money Hub and CD Hub.
// The access token and its expiry are kept in this browser (localStorage) under one key, so every tab,
// window and the installed app window share one sign-in. It is only ever the short-lived access token
// (about an hour): never a client secret, never a refresh token. An expired token is not reused.
// Signing out in one tab clears it for every tab, and a new sign-in in one tab is seen by the others.
(function (global) {
  'use strict';
  var KEY = 'ljr-dash-auth';
  var store = (function () { try { return global.localStorage; } catch (e) { return null; } })();

  // One-time move: older versions kept the token in this tab's sessionStorage.
  try {
    var old = global.sessionStorage && global.sessionStorage.getItem(KEY);
    if (old) {
      if (store && !store.getItem(KEY)) store.setItem(KEY, old);
      global.sessionStorage.removeItem(KEY);
    }
  } catch (e) {}

  function read() {
    try {
      if (!store) return null;
      var raw = store.getItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || typeof data.access_token !== 'string' || !data.access_token || typeof data.expires_at !== 'number' || !isFinite(data.expires_at)) {
        store.removeItem(KEY);
        return null;
      }
      data.scope = typeof data.scope === 'string' ? data.scope : '';
      return data;
    } catch (e) {
      try { store.removeItem(KEY); } catch (e2) {}
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
      store.setItem(KEY, JSON.stringify({
        access_token: token,
        expires_at: expiresAt,
        scope: scope || ''
      }));
    } catch (e) {}
  }

  function clear() {
    try { store.removeItem(KEY); } catch (e) {}
  }

  // Another tab signed in, refreshed or signed out. fn(data) gets the new saved sign-in, or null when it was cleared.
  // The browser only fires 'storage' in the OTHER tabs, never in the tab that made the change.
  function onChange(fn) {
    global.addEventListener('storage', function (e) {
      if (e.key !== KEY && e.key !== null) return;
      fn(valid());
    });
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
    onChange: onChange,
    expiryFrom: expiryFrom,
    bind: bind
  };
})(window);
