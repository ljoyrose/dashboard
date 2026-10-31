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

  /** Reads the saved sign-in from localStorage. Returns { access_token, expires_at, scope }, or null (a malformed entry is removed). */
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

  /** Returns the saved sign-in if it has not expired yet, otherwise null. */
  function valid() {
    var data = read();
    if (!data || Date.now() >= data.expires_at) return null;
    return data;
  }

  /** True when a saved sign-in exists but its expiry time has passed. */
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

  // Signed-out gate: until there is a sign-in, the page shows only its sign-in buttons, sign-in cards and the
  // message banner. Everything else (title, menus, search, names, footer) stays invisible and unclickable.
  // auth.js loads in <head>, so the page is locked before anything is drawn. Looks only: the data itself is
  // protected by Google sign-in, and the page code is public.
  var KEEP = 'a.skip,#backHome,[data-action="signin"],[data-signin],#signin,#signInBtn,#signinbtn,#banner,.banner,.card:has([data-action="signin"],[data-signin])';
  (function () {
    try {
      var css = global.document.createElement('style');
      css.id = 'dash-gate-css';
      css.textContent = 'html.dash-locked body *{visibility:hidden}' +
        // Screen readers keep the main area and the page headings; on screen the headings take no space and show nothing.
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
      global.document.documentElement.classList.toggle('dash-locked', !valid());
    } catch (e) {}
  }

  /** Saves the access token, its expiry (ms since epoch) and granted scope for every tab, then updates the signed-out gate. */
  function save(token, expiresAt, scope) {
    try {
      store.setItem(KEY, JSON.stringify({
        access_token: token,
        expires_at: expiresAt,
        scope: scope || ''
      }));
    } catch (e) {}
    gate();
  }

  /** Removes the saved sign-in (signs out every tab), then updates the signed-out gate. */
  function clear() {
    try { store.removeItem(KEY); } catch (e) {}
    gate();
  }

  // Another tab signed in, refreshed or signed out. fn(data) gets the new saved sign-in, or null when it was cleared.
  // The browser only fires 'storage' in the OTHER tabs, never in the tab that made the change.
  function onChange(fn) {
    global.addEventListener('storage', function (e) {
      if (e.key !== KEY && e.key !== null) return;
      fn(valid());
    });
  }

  /** True when data was granted every space-separated scope in `scope`. */
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

    /** Asks Google for a token without a prompt. Returns false if the token client is not set up yet. */
    function requestSilent() {
      if (!client) return false;
      hadExpired = expired();
      queue.push('silent');
      client.requestAccessToken({ prompt: '' });
      return true;
    }

    /** Sets up the Google token client once, and asks silently when no saved token has the scope. Returns false if the Google script has not loaded. */
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

    /** Opens Google's account chooser to sign in; `extra` adds or overrides request parameters. */
    function requestInteractive(extra) {
      if (!client) return;
      queue.push('interactive');
      var params = { prompt: 'select_account' };
      if (extra) Object.keys(extra).forEach(function (k) { params[k] = extra[k]; });
      client.requestAccessToken(params);
    }

    /** Asks Google to add `scope` to the sign-in, keeping the scopes already granted. */
    function requestWrite(scope) {
      if (!client) return;
      queue.push('write');
      client.requestAccessToken({ scope: scope, include_granted_scopes: true, prompt: '' });
    }

    return {
      init: init,
      /** True once the token client has been set up. */
      ready: function () { return !!client; },
      requestInteractive: requestInteractive,
      requestSilent: requestSilent,
      requestWrite: requestWrite
    };
  }

  // Second, look-only sign-in for the Personal Drive page. Its token is held only in this object (never saved to
  // the browser, never shared with other tabs or pages) and is cleared on sign-out. It never replaces the work token.
  function personal(opts) {
    var client = null, token = null, expiresAt = 0;
    function init() {
      if (client) return true;
      if (!(global.google && google.accounts && google.accounts.oauth2)) return false;
      client = google.accounts.oauth2.initTokenClient({
        client_id: opts.clientId,
        scope: opts.scope,
        callback: function (resp) {
          if (!resp || resp.error || !google.accounts.oauth2.hasGrantedAllScopes(resp, opts.scope)) { if (opts.onError) opts.onError(resp || {}); return; }
          token = resp.access_token;
          expiresAt = expiryFrom(resp.expires_in);
          if (opts.onToken) opts.onToken();
        },
        error_callback: function (e) { if (opts.onError) opts.onError(e || {}); }
      });
      return true;
    }
    return {
      // Only ever called from a button press on the Personal Drive page.
      request: function () { if (init()) client.requestAccessToken({ prompt: 'select_account' }); },
      /** Returns the Personal Drive token while it has not expired, otherwise null. */
      token: function () { return token && Date.now() < expiresAt ? token : null; },
      /** Forgets the Personal Drive token and asks Google to revoke it. */
      clear: function () {
        var t = token;
        token = null; expiresAt = 0;
        if (t && global.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(t, function () {});
      }
    };
  }

  gate();
  // Another tab signed in or out: lock or unlock this one too.
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
