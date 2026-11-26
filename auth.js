(function (global) {
  'use strict';
  var KEY = 'ljr-dash-auth';
  var store = (function () { try { return global.localStorage; } catch (e) { return null; } })();

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

  function markExpired() {
    var data = read();
    if (!data) return false;
    if (data.expires_at > Date.now()) save(data.access_token, Date.now() - 1000, data.scope);
    return true;
  }

  var KEEP = 'a.skip,#backHome,[data-action="signin"],[data-signin],#signin,#signInBtn,#signinbtn,#banner,.banner,.card:has([data-action="signin"],[data-signin])';
  (function () {
    try {
      var css = global.document.createElement('style');
      css.id = 'dash-gate-css';
      css.textContent = 'html.dash-locked body *{visibility:hidden}' +
        'html.dash-locked main{visibility:visible}' +
        'html.dash-locked :is(h1,h2):not(:is(' + KEEP + ') *),html.dash-locked :is(h1,h2):not(:is(' + KEEP + ') *) *{visibility:visible}' +
        'html.dash-locked :is(h1,h2):not(:is(' + KEEP + ') *){position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;margin:0;padding:0}' +
        'html.dash-locked :is(' + KEEP + '),html.dash-locked :is(' + KEEP + ') *{visibility:visible}' +
        'html.dash-locked :is(.gate-hide,.info),html.dash-locked :is(.gate-hide,.info) *{visibility:hidden!important}';
      global.document.head.appendChild(css);
    } catch (e) {}
  })();
  function gate() {
    try {
      var html = global.document.documentElement;
      if (html.getAttribute('data-dash-gate') === 'off') { html.classList.remove('dash-locked'); return; }
      html.classList.toggle('dash-locked', !valid());
    } catch (e) {}
  }

  function notify() {
    try { global.dispatchEvent(new Event('dash-auth-change')); } catch (e) {}
  }

  function save(token, expiresAt, scope) {
    try {
      store.setItem(KEY, JSON.stringify({
        access_token: token,
        expires_at: expiresAt,
        scope: scope || ''
      }));
    } catch (e) {}
    gate();
    notify();
  }

  function clear() {
    try { store.removeItem(KEY); } catch (e) {}
    gate();
    notify();
  }

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

  function expiryFrom(expiresIn) {
    return Date.now() + (Number(expiresIn) || 3600) * 1000 - 60000;
  }

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

  function personal(opts) {
    var client = null, token = null, expiresAt = 0, binOk = false, wantBin = false, binScope = opts.binScope || '';
    function init() {
      if (client) return true;
      if (!(global.google && google.accounts && google.accounts.oauth2)) return false;
      client = google.accounts.oauth2.initTokenClient({
        client_id: opts.clientId,
        scope: opts.scope,
        callback: function (resp) {
          var forBin = wantBin;
          wantBin = false;
          var need = forBin ? opts.scope + ' ' + binScope : opts.scope;
          if (!resp || resp.error || !google.accounts.oauth2.hasGrantedAllScopes(resp, need)) {
            if (forBin) { if (opts.onBinError) opts.onBinError(resp || {}); } else if (opts.onError) opts.onError(resp || {});
            return;
          }
          token = resp.access_token;
          expiresAt = expiryFrom(resp.expires_in);
          binOk = forBin;
          if (forBin) { if (opts.onBin) opts.onBin(); } else if (opts.onToken) opts.onToken();
        },
        error_callback: function (e) {
          var forBin = wantBin;
          wantBin = false;
          if (forBin) { if (opts.onBinError) opts.onBinError(e || {}); } else if (opts.onError) opts.onError(e || {});
        }
      });
      return true;
    }
    return {
      request: function () { if (init()) { wantBin = false; client.requestAccessToken({ prompt: 'select_account' }); } },
      requestBin: function () {
        if (!binScope || !(token && Date.now() < expiresAt) || !init()) return;
        wantBin = true;
        client.requestAccessToken({ scope: opts.scope + ' ' + binScope, include_granted_scopes: true, prompt: 'select_account' });
      },
      token: function () { return token && Date.now() < expiresAt ? token : null; },
      binToken: function () { return binOk && token && Date.now() < expiresAt ? token : null; },
      clear: function () {
        var t = token;
        token = null; expiresAt = 0; binOk = false; wantBin = false;
        if (t && global.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(t, function () {});
      }
    };
  }

  gate();
  global.addEventListener('storage', function (e) { if (e.key === KEY || e.key === null) gate(); });

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
    bind: bind,
    personal: personal
  };
})(window);

