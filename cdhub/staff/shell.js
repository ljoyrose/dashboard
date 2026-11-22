/*!
 * The Board, staff page shell. Staff: a phone is set up ONCE (the save address arrives by the owner's set-up QR, or the
 * same payload typed in, then the person types their own staff code). The code stays on that phone.
 * If the owner switches the code off, the next read or save is refused and this page wipes it and goes back to set-up.
 * Owners (Board A, Lisa 17 Nov 2026): the same Google sign-in as CD Hub, no code. The save address comes from this
 * browser (CD Hub keeps it) or BLD-save-webapp.json in the hub folder. The save script checks the account is an owner.
 *
 * Nothing about dogs, rooms or people is in these files. Everything is read through the save script with the code.
 *
 * MODULE INTERFACE (see README.md):  StaffPage.register({id, title, desc, icon, order, open(host, ctx)})
 */
(function () {
  'use strict';
  var CODE_KEY = 'bld.device.code', SCAN_PREFIX = 's/', SETUP_PREFIX = 'setup=', JOIN_PREFIX = 'join=', JOIN_URL = '&url=', TAG_RE = /^[A-Z2-9]{4,12}$/;
  var FILES = ['lib/due.js', '../checks/checks.js', 'modules/moves.js', 'modules/where.js', 'lib/thermometer.js', 'lib/area-link.js', 'lib/temp-judge.js', 'modules/temperature/module.js', 'modules/jobs/module.js'];
  var ICONS = {
    report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636-2.87L13.637 3.59a1.914 1.914 0 0 0-3.274 0z"/><path d="M12 16h.01"/></svg>',   // Tabler alert-triangle (Problem tab)
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/></svg>',
    scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M4 12h16"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>',
    temp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.8V5a2 2 0 10-4 0v9.8a4 4 0 104 0z"/></svg>',
    dogs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="10" r="2"/><circle cx="18" cy="10" r="2"/><circle cx="10" cy="5" r="2"/><circle cx="14" cy="5" r="2"/><path d="M12 11c-3 0-5 3-5 6 0 2 2 3 5 3s5-1 5-3c0-3-2-6-5-6z"/></svg>'
  };
  var screen = document.getElementById('screen'), tabs = document.getElementById('tabs');
  var save = BLDSave.create({});
  save.deviceCode = true;
  if (window.BLDOutboxLine) BLDOutboxLine.mount(save, screen);   // never lose an entry: what this phone still holds to send (20 Nov 2026)
  var modules = [], cleanup = null, dataP = null, started = false, join = null, urlTried = false, ownerNote = '';
  var CFG = window.DASH_CONFIG || {}, SCOPE = (CFG.scopes && CFG.scopes.read) || 'https://www.googleapis.com/auth/drive.readonly';
  var HUB_URL_KEYS = ['cdhub.sink.url', 'cdhub.save.url'], SAVE_URL_FILE = 'BLD-save-webapp.json';
  /* Storage tidy, stage 2 (owner 15 Nov 2026): a phone set up here also keeps CD Hub's copy (cdhub.staff.code and
     cdhub.save.url), so both pages share one code and one address. This page's own keys (bld.*) are still written and read. */
  var HUB_CODE_KEY = 'cdhub.staff.code', HUB_URL_KEEP = 'cdhub.save.url', HUB_OFF_KEYS = ['cdhub.save.off', 'cdhub.sink.off'];
  var URL_RE = /^https:\/\/script\.google\.com\/(a\/macros\/[a-z0-9.-]+|macros)\/s\/[A-Za-z0-9_-]+\/exec$/;
  /** A code the save script accepted on this page: CD Hub uses it too. Setting the phone up again here undoes "Switch off here". */
  function shareWithHub(code) {
    var u = storeGet('bld.scriptUrl');
    if (code) storeSet(HUB_CODE_KEY, code);
    if (URL_RE.test(u)) storeSet(HUB_URL_KEEP, u);
    HUB_OFF_KEYS.forEach(function (k) { if (storeGet(k)) storeSet(k, ''); });
  }
  /** An owner's address found in the hub folder is kept for CD Hub too, unless CD Hub was switched off on this phone. */
  function shareUrlWithHub() {
    var u = storeGet('bld.scriptUrl');
    if (URL_RE.test(u) && !HUB_OFF_KEYS.some(function (k) { return !!storeGet(k); })) storeSet(HUB_URL_KEEP, u);
  }
  function owner() { return BLDSave.ownerToken ? BLDSave.ownerToken() : ''; }

  /** An owner's save address: one CD Hub kept in this browser, else the hub folder's BLD-save-webapp.json. */
  function ownerUrl() {
    for (var i = 0; i < HUB_URL_KEYS.length; i++) { var u = storeGet(HUB_URL_KEYS[i]); if (u && save.setScriptUrl(u, true).ok) return Promise.resolve(true); }
    var tok = owner(), folder = CFG.cdhub && CFG.cdhub.folderId;
    if (!tok || !folder || typeof fetch === 'undefined') return Promise.resolve(false);
    var hd = { headers: { Authorization: 'Bearer ' + tok } }, base = 'https://www.googleapis.com/drive/v3/files';
    var q = "'" + folder + "' in parents and trashed = false and name = '" + SAVE_URL_FILE + "'";
    return fetch(base + '?supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id)&q=' + encodeURIComponent(q), hd)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var f = (j && j.files) || [];
        if (f.length !== 1) return false;
        return fetch(base + '/' + encodeURIComponent(f[0].id) + '?alt=media&supportsAllDrives=true', hd).then(function (r) { return r.json(); })
          .then(function (cfg) {   // set_at / set_by may be in the file too; only url is used
            var ok = save.setScriptUrl(String((cfg && cfg.url) || '').trim(), true).ok && !!(cfg && cfg.url);
            if (ok) shareUrlWithHub();
            return ok;
          });
      })
      .catch(function () { return false; });
  }

  /* Google sign-in for owners on this page (the same client and the same saved sign-in as CD Hub). Set up only when the
     owner taps the button, or to refresh a sign-in this browser already had, so a staff phone never sees Google. */
  var gClient = null, gWant = '';
  function gReady() { return !!(window.google && google.accounts && google.accounts.oauth2 && CFG.clientId && window.DashAuth); }
  function gInit() {
    if (gClient || !gReady()) return !!gClient;
    gClient = google.accounts.oauth2.initTokenClient({ client_id: CFG.clientId, scope: SCOPE,
      callback: function (resp) {
        var want = gWant; gWant = '';
        if (want === 'renew') { gRenewDone(resp && !resp.error && google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE) ? resp : null); return; }
        if (!resp || resp.error || !google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE)) { if (want === 'ask') { ownerNote = 'Google sign-in did not complete.'; route(); } return; }
        DashAuth.save(resp.access_token, DashAuth.expiryFrom(resp.expires_in), resp.scope || SCOPE);
        BLDSave.ownerSkip(false); ownerNote = ''; urlTried = false; dataP = null; route();
      },
      error_callback: function () { var want = gWant; gWant = ''; if (want === 'renew') { gRenewDone(null); return; } if (want === 'ask') { ownerNote = 'Google sign-in did not complete. Allow pop-ups for this page and try again.'; route(); } } });
    return true;
  }
  function ownerSignIn() {
    BLDSave.ownerSkip(false);
    if (!gInit()) { ownerNote = 'Google sign-in is still loading. Try again in a moment.'; route(); return; }
    gWant = 'ask'; gClient.requestAccessToken({ prompt: 'select_account' });
  }
  /* 22 Nov 2026: a renewal in the middle of a round keeps the screen as it is (no redraw, nothing typed is lost); the save
     library waits for it (BLDSave.refreshOwnerToken) and sends the request again with the new token. */
  var gRenewWait = [];
  function gRenewDone(resp) {
    if (resp) DashAuth.save(resp.access_token, DashAuth.expiryFrom(resp.expires_in), resp.scope || SCOPE);
    var w = gRenewWait; gRenewWait = []; w.forEach(function (f) { f(); });
  }
  function ownerRenew() {
    return new Promise(function (done) {
      if (storeGet(CODE_KEY) || !gInit()) { done(); return; }
      gRenewWait.push(done);
      if (gWant === 'renew') return;
      gWant = 'renew';
      try { gClient.requestAccessToken({ prompt: '' }); } catch (e) { gRenewDone(null); }
    });
  }
  if (BLDSave.setOwnerRefresher) BLDSave.setOwnerRefresher(ownerRenew);
  /* renew a little before it runs out, while the page is open, so a round never meets a run-out token */
  setInterval(function () {
    if (storeGet(CODE_KEY) || !window.DashAuth || !DashAuth.read) return;
    var s = DashAuth.read();
    if (s && s.expires_at - Date.now() < 5 * 60000 && BLDSave.refreshOwnerToken) BLDSave.refreshOwnerToken();
  }, 60000);
  /** An owner's sign-in in this browser ran out (about an hour): renew it quietly, as CD Hub does. */
  function ownerRefresh() {
    if (!window.DashAuth || !DashAuth.expired || !DashAuth.expired() || storeGet(CODE_KEY)) return;
    (function wait(n) { if (gInit()) { gWant = 'quiet'; gClient.requestAccessToken({ prompt: '' }); } else if (n < 50) setTimeout(function () { wait(n + 1); }, 200); })(0);
  }

  /** The encoded # body of a private set-up QR (#join=<code>&url=<save address>), or null. */
  function readJoin(raw) {
    if (String(raw || '').indexOf(JOIN_PREFIX) !== 0) return null;
    var at = raw.indexOf(JOIN_URL), c = '', u = '';
    if (at > 0) { try { c = decodeURIComponent(raw.slice(JOIN_PREFIX.length, at)).trim(); u = decodeURIComponent(raw.slice(at + JOIN_URL.length)); } catch (e) { c = ''; u = ''; } }
    return { code: c, url: u };
  }
  /** Take a private set-up QR out of the address bar and history before anything else runs. */
  function takeJoin() {
    var j = readJoin((location.hash || '').slice(1));
    if (!j) return;
    history.replaceState(null, '', location.pathname);
    join = j;
  }
  takeJoin();
  function setupFail() {
    clearScreen(); tabs.hidden = true;
    screen.appendChild(h('p', { class: 'msg bad', text: 'That set-up QR was not right. Ask the owner for a new one.' }));
  }
  /**
   * One set-up payload, from a scan or from typing. text is the QR contents (a full link or the # part).
   * Returns true when it was a set-up payload. The same checks as a scan; nothing else is stored.
   */
  function acceptScan(text) {
    var raw = String(text || '').trim();
    var hashAt = raw.lastIndexOf('#');
    if (hashAt >= 0) raw = raw.slice(hashAt + 1);
    if (!raw) return false;
    var j = readJoin(raw);
    if (j) {
      history.replaceState(null, '', location.pathname);
      join = null;
      runJoin(j);
      return true;
    }
    var hash;
    try { hash = decodeURIComponent(raw); } catch (e) { return false; }
    if (hash.indexOf(SETUP_PREFIX) !== 0) return false;
    var r = save.setScriptUrl(hash.slice(SETUP_PREFIX.length), true);
    history.replaceState(null, '', location.pathname);
    if (!r.ok) { setupFail(); return true; }
    save.checkStatus().then(function () { drawSetup(); });
    return true;
  }

  function storeGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function storeSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); return true; } catch (e) { return false; } }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];   // only ever our own icon strings
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function isSetUp() { return save.getScriptUrlSet() && (!!storeGet(CODE_KEY) || !!owner() || !!(BLDSave.ownerExpired && BLDSave.ownerExpired())); }
  function forget() { var c = storeGet(CODE_KEY); if (c && storeGet(HUB_CODE_KEY) === c) storeSet(HUB_CODE_KEY, ''); storeSet(CODE_KEY, ''); save.clearCode(); dataP = null; var me = document.getElementById('me'); if (me) me.hidden = true; }

  /** Any read or save answering BAD_CODE means this phone was switched off: wipe it. */
  function guard(r) {
    /* 22 Nov 2026: a run-out sign-in never switches the tab to codes. The library has already renewed it once and sent
       again; NO_CODE here means Google could not renew it quietly, so ask to sign in again, nothing else. */
    if (r && r.ok === false && r.code === 'NO_CODE' && !storeGet(CODE_KEY) && BLDSave.ownerExpired && BLDSave.ownerExpired()) {
      ownerNote = 'Your Google sign-in ran out. Sign in with Google again; nothing typed is lost.'; return r;
    }
    if (r && r.ok === false && save.usingGoogle && save.usingGoogle() && (r.code === 'GOOGLE_NOT_OWNER' || r.code === 'BAD_CODE')) {
      // The Google sign-in was not accepted (not on the owner list, or the save script is not updated yet): use a code.
      BLDSave.ownerSkip(true); dataP = null;
      ownerNote = r.code === 'GOOGLE_NOT_OWNER' ? 'This Google account is not on the owner list. Type your staff code.' : 'The save script did not accept the Google sign-in yet. Type your staff code.';
      route(); return r;
    }
    if (r && r.ok === false && r.code === 'BAD_CODE') { forget(); route(); }
    return r;
  }
  var rawRead = save.read, rawSubmit = save.submit;
  save.read = function (k, f, o) { return rawRead(k, f, o).then(guard); };   // the filter goes through (it was dropped before 22 Nov 2026)
  save.submit = function (t, f, o) { return rawSubmit(t, f, o).then(guard); };

  /** Add a table the page may save to (a spec for instant checks; the script is still the judge). */
  function addTable(key, spec) { save.TABLES[key] = spec; }

  /** Read a list that may not be switched on yet. Never fails: {ok, rows, code, message}. */
  function readOptional(key, filter) {
    return save.read(key, filter).then(function (r) { return r.ok ? r : { ok: false, rows: [], code: r.code, message: r.message }; });
  }
  /** Rooms, dogs and where they are. Loaded once; refresh() loads again after a move. */
  function data() {
    if (dataP) return dataP;
    dataP = save.readMany(['area', 'subject', 'occupancy', 'subject_status', 'requirement'], ['requirement']).then(function (r) {
      if (!r.ok) { dataP = null; guard(r); return { ok: false, code: r.code, message: r.message || 'Could not load the records.' }; }
      var t = r.tables, d = BLDOccupancy.dailyList(t), subjects = (t.subject || []).map(function (x) { return { id: x.id, label: x.name || x.id }; });
      save.setLookups({ area: t.area || d.areas, subject: subjects });   // every room, retired ones too: a late reading may name a retired room (screens still hide it)
      return (dataObj = { ok: true, areas: d.areas, dogs: d.dogs, skipped: d.skipped, subjects: subjects, raw: t, asOf: Date.now() });
    });
    return dataP;
  }
  function refresh() { dataP = null; dataObj = null; if (save.dropCache) save.dropCache(); return data(); }
  /* 22 Nov 2026: a screen that waits for the records gives up after LOAD_LIMIT_MS and says so, with Try again.
     limit(p, host, retry) resolves what p resolves, or never (null-free) once the message has replaced the screen. */
  var LOAD_LIMIT_MS = 45000;
  function limit(p, host, retry) {
    return new Promise(function (resolve) {
      var over = false;
      var t = setTimeout(function () {
        over = true;
        if (!host || !host.isConnected) return;
        host.textContent = '';
        host.appendChild(h('p', { class: 'msg bad', role: 'status', 'data-load-timeout': '1', text: 'The records did not answer in 45 seconds. Nothing is lost. Try again.' }));
        host.appendChild(h('button', { class: 'btn', type: 'button', 'data-load-retry': '1', text: 'Try again', onclick: function () { if (retry) retry(); else route(); } }));
      }, LOAD_LIMIT_MS);
      Promise.resolve(p).then(function (v) { if (over) return; clearTimeout(t); resolve(v); });
    });
  }
  /** "As of" for the kept lists a screen uses: the oldest time one of them was read, or 0. */
  function listsAt(keys) { var at = 0; (keys || []).forEach(function (k) { var x = save.keptAt ? save.keptAt(k) : 0; if (x && (!at || x < at)) at = x; }); return at; }
  /* Overseer 22 Nov 2026: a move showed the old room until a full reload. The loaded lists are changed in place instead. */
  var dataObj = null;
  function rebuild(o) { var d = BLDOccupancy.dailyList(o.raw); o.areas = d.areas; o.dogs = d.dogs; o.skipped = d.skipped; }
  /** A move as it is sent: the dog shows in its new room at once. Returns undo(), for a save that is refused. */
  function noteMove(row) {
    var o = dataObj;
    if (!o) return function () {};
    o.raw.occupancy = (o.raw.occupancy || []).concat([row]); rebuild(o); keepOccupancy();
    return function undo() { o.raw.occupancy = (o.raw.occupancy || []).filter(function (r) { return r !== row; }); rebuild(o); keepOccupancy(); };
  }
  /** Read where the dogs are again (occupancy only, never the other lists). {ok, asOf} or the read's refusal. */
  function refreshOccupancy() {
    if (save.dropCache) save.dropCache('occupancy');   // PR 749 keeps lists for the session: Refresh must read it fresh
    return save.read('occupancy').then(function (r) {
      if (!r.ok) return r;
      if (dataObj) { dataObj.raw.occupancy = r.rows || []; rebuild(dataObj); dataObj.asOf = Date.now(); }
      return { ok: true, asOf: dataObj ? dataObj.asOf : Date.now() };
    });
  }
  /* With PR 749's list cache (22 Nov 2026): the page's kept copy of where the dogs are follows the screen, so the next
     screen opened does not read it again. A saved move would otherwise forget that copy (any save to a list does). */
  function keepOccupancy() { if (dataObj && save.keepRows) save.keepRows('occupancy', dataObj.raw.occupancy || []); }
  var submitBeforeMoves = save.submit;   // not rawSubmit: that name is the sign-out guard's, above
  save.submit = function (table, fields, o) {
    return submitBeforeMoves.apply(save, arguments).then(function (r) { if (r && r.ok && table === 'occupancy') keepOccupancy(); return r; });
  };
  function go(path) { if (location.hash === '#' + path) route(); else location.hash = path; }

  var ctx = { save: save, data: data, refresh: refresh, noteMove: noteMove, refreshOccupancy: refreshOccupancy, readOptional: readOptional, limit: limit, listsAt: listsAt, addTable: addTable, go: go, h: h, icons: ICONS, today: function () { return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); } };

  /** "Welcome <name> · <Role>" from the name and role held against this phone's code (shown once a read has told us). */
  function showMe() {
    var me = document.getElementById('me');
    if (!me) return;
    var name = save.name ? save.name() : '', role = save.role ? save.role() : '';
    if (!name && !role) { me.hidden = true; return; }
    role = role ? role.charAt(0) + role.slice(1).toLowerCase() : '';
    me.textContent = 'Welcome ' + (name || '') + (name && role ? ' · ' : '') + role + ' ';
    // shared work phone: the next person swaps in with two taps; the save address stays, so no set-up QR again
    if (!storeGet(CODE_KEY) && owner()) me.appendChild(h('button', { class: 'switch', type: 'button', text: 'Use a staff code', onclick: function () { BLDSave.ownerSkip(true); forget(); go('home'); } }));
    else me.appendChild(h('button', { class: 'switch', type: 'button', text: 'Not ' + (name || 'you') + '? Switch', onclick: function () { forget(); go('home'); } }));
    me.hidden = false;
  }
  function setTabs(cur) {
    showMe();
    tabs.hidden = false; tabs.textContent = '';
    [['home', 'Home', 'home'], ['scan', 'Scan', 'scan'], ['m/report', 'Problem', 'report'], ['device', 'Phone', 'gear']].forEach(function (t) {
      tabs.appendChild(h('button', { type: 'button', 'aria-current': cur === t[0] ? 'page' : false, onclick: function () { go(t[0]); } }, [h('span', { class: 'ring', html: ICONS[t[2]] }), t[1]]));
    });
  }
  function clearScreen() { if (cleanup) { try { cleanup(); } catch (e) { /* a module's tidy-up must not stop the page */ } cleanup = null; } screen.textContent = ''; window.scrollTo(0, 0); }

  /** Owners: one button, the CD Hub Google sign-in. */
  function ownerBox() {
    var box = h('div', { class: 'owner-in' }, [
      h('button', { class: 'btn', type: 'button', 'data-owner-signin': '', text: 'Owner: sign in with Google', onclick: ownerSignIn }),
      h('p', { class: 'sub help', text: 'The same sign-in as CD Hub. No code needed.' })
    ]);
    if (ownerNote) box.appendChild(h('p', { class: 'msg bad', role: 'status', text: ownerNote }));
    return box;
  }
  function drawSetup(note) {
    clearScreen(); tabs.hidden = true;
    screen.appendChild(h('h1', { text: 'Set up this phone' }));
    screen.appendChild(ownerBox());
    if (!save.getScriptUrlSet()) {
      screen.appendChild(h('p', { class: 'sub', text: 'This phone is not set up. Ask the hub owner for the set-up QR and scan it.' }));
      var box = h('div');
      box.hidden = true;
      var field = h('input', { class: 'inp', type: 'password', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Set-up code', placeholder: 'Paste the set-up code' });
      var status = h('div', { class: 'msg', role: 'status' });
      function submitTyped() {
        var typed = field.value;
        field.value = '';
        status.className = 'msg';
        status.textContent = '';
        if (!String(typed || '').trim()) { status.className = 'msg bad'; status.textContent = 'Paste the set-up code.'; return; }
        // Lisa 17 Nov 2026: a staff code typed here said "That set-up QR was not right", which read as "your code is wrong".
        if (!/[#=\/]/.test(typed) && String(typed).trim().length <= 40) {
          status.className = 'msg bad';
          status.textContent = 'That looks like a staff code. This box needs the set-up link first: scan the Phone set-up QR (CD Hub, Admin, Tools, Print). Owners: use the Google button above.';
          return;
        }
        if (!acceptScan(typed)) setupFail();
      }
      field.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); submitTyped(); } });
      box.appendChild(field);
      box.appendChild(h('button', { class: 'btn', type: 'button', text: 'Use this code', onclick: submitTyped }));
      box.appendChild(status);
      screen.appendChild(h('button', { class: 'btn quiet', type: 'button', text: 'Type set-up code instead', onclick: function (ev) {
        box.hidden = false;
        ev.currentTarget.hidden = true;
        field.focus();
      } }));
      screen.appendChild(box);
      return;
    }
    screen.appendChild(h('p', { class: 'sub', text: note || 'Type your own staff code. You only do this once on this phone.' }));
    var code = h('input', { class: 'inp', type: 'password', autocomplete: 'off', 'aria-label': 'Your staff code', placeholder: 'Your staff code' });
    var msg = h('div', { class: 'msg', role: 'status' });
    var btn = h('button', { class: 'btn', type: 'button', text: 'Set up this phone', onclick: function () {
      var c = code.value.trim();
      if (!c) { msg.className = 'msg bad'; msg.textContent = 'Type your staff code.'; return; }
      btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Checking...';
      save.setCode(c, false);
      save.checkStatus().then(function () { return rawRead('area'); }).then(function (r) {
        btn.disabled = false;
        if (r.ok) { if (!storeSet(CODE_KEY, c)) { msg.className = 'msg bad'; msg.textContent = 'This browser will not remember the code. Turn off private browsing and try again.'; return; } shareWithHub(c); code.value = ''; go('home'); return; }
        save.clearCode(); msg.className = 'msg bad'; msg.textContent = r.message || 'That did not work.';
      });
    } });
    screen.appendChild(code); screen.appendChild(btn); screen.appendChild(msg);
  }

  /** Check the code from a private set-up QR. It is only remembered if the save script accepts it. */
  function runJoin(j) {
    clearScreen(); tabs.hidden = true;
    screen.appendChild(h('h1', { text: 'Set up this phone' }));
    var msg = h('p', { class: 'msg', role: 'status', text: 'Checking...' });
    screen.appendChild(msg);
    function fail(t) { save.clearCode(); msg.className = 'msg bad'; msg.textContent = t; }
    var r = j.code ? save.setScriptUrl(j.url, true) : { ok: false };
    if (!r.ok) { fail('That set-up QR was not right. Ask the owner for a new one.'); return; }
    save.setCode(j.code, false);
    save.checkStatus().then(function () { return rawRead('area'); }).then(function (res) {
      if (!res.ok) { fail(res.code === 'BAD_CODE' ? 'That code was not accepted. Ask the owner for a new QR.' : (res.message || 'That did not work. Ask the owner for a new QR.')); return; }
      if (!storeSet(CODE_KEY, j.code)) { fail('This browser will not remember the code. Turn off private browsing and scan again.'); return; }
      shareWithHub(j.code); dataP = null; go('home');
    });
  }

  function drawHome() {
    clearScreen(); setTabs('home'); delete ctx.reportFor;
    screen.appendChild(h('h1', { text: 'The Board' }));
    data().then(showMe);   // the first read tells us whose code this is
    screen.appendChild(h('p', { class: 'sub', text: new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' }).replace('Sept', 'Sep') }));
    var list = h('div', { class: 'cards' });
    modules.filter(function (m) { return !m.hidden; }).sort(function (a, b) { return (a.order || 50) - (b.order || 50); }).forEach(function (m) {
      list.appendChild(h('button', { class: 'card go', type: 'button', 'data-module': m.id, onclick: function () { go('m/' + m.id); } }, [
        h('div', { class: 'nm' }, [h('span', { class: 'ic', html: m.icon || ICONS.dogs }), m.title])
      ]));
    });
    /* The old Checks card is gone (22 Nov 2026): daily checks are on Jobs. ../checks/ now says "This page has moved". */
    screen.appendChild(list);
  }
  /* Show help (Lisa 18 Nov 2026): off unless this person turns it on. Kept with the Look on this phone ('dash-look', the same
     place the hub's Look menu keeps it); house.css hides every .help line while it is off. */
  function helpOn() { try { return (JSON.parse(localStorage.getItem('dash-look') || '{}') || {}).help === 'on'; } catch (e) { return false; } }
  function setHelp(on) {
    var o = {}; try { o = JSON.parse(localStorage.getItem('dash-look') || '{}') || {}; } catch (e) { o = {}; }
    o.help = on ? 'on' : 'off';
    try { localStorage.setItem('dash-look', JSON.stringify(o)); } catch (e) { /* private window: this page still changes */ }
    document.documentElement.classList.toggle('show-help', on);
  }
  function helpSwitch() {
    var b = h('button', { class: 'btn quiet', type: 'button', role: 'switch', 'data-k': 'show-help', 'aria-checked': String(helpOn()), text: 'Show help' });
    b.onclick = function () { var on = !helpOn(); setHelp(on); b.setAttribute('aria-checked', String(on)); };
    return b;
  }
  function drawDevice() {
    clearScreen(); setTabs('device');
    screen.appendChild(h('h2', { text: 'This phone' }));
    screen.appendChild(helpSwitch());
    if (!storeGet(CODE_KEY) && owner()) {
      screen.appendChild(h('p', { class: 'sub help', text: 'Signed in with your Google account, the same as CD Hub. Signing out of CD Hub signs out here too.' }));
      screen.appendChild(h('button', { class: 'btn quiet', type: 'button', text: 'Use a staff code instead', onclick: function () { BLDSave.ownerSkip(true); forget(); go('home'); } }));
      return;
    }
    screen.appendChild(h('p', { class: 'sub help', text: 'This phone is set up with your staff code. If it is lost, tell the owner, who switches the code off everywhere.' }));
    screen.appendChild(h('button', { class: 'btn quiet', type: 'button', text: 'Remove my code from this phone', onclick: function () { forget(); go('home'); } }));
  }
  function openModule(id, params) {
    var m = modules.filter(function (x) { return x.id === id; })[0];
    if (!m) { go('home'); return; }
    clearScreen(); setTabs(params && params.tab || 'home');
    screen.appendChild(h('button', { class: 'back', type: 'button', text: '← Home', onclick: function () { go('home'); } }));
    var host = h('div'); screen.appendChild(host);
    var r = m.open(host, Object.assign({}, ctx, { params: params || {} }));
    if (typeof r === 'function') cleanup = r;
  }

  /** While a room is being filled (moves.js remembers it for 30 minutes), every scan carries on moving dogs. */
  function fillingRoom() {
    try { var r = JSON.parse(storeGet('bld.move.room') || 'null'); return !!r && Date.now() - r.at < 30 * 60000; } catch (e) { return false; }
  }

  /** Called on every address change. A scan on a phone that is not set up shows nothing but the set-up screen. */
  function route() {
    takeJoin();
    if (join) { var j = join; join = null; runJoin(j); return; }
    var raw = (location.hash || '').slice(1);
    if (raw && acceptScan(raw)) return;   // the same checks as a typed set-up code; the address does not stay in the bar
    var hash;
    try { hash = decodeURIComponent(raw); } catch (e) { hash = raw; }
    if (!save.getScriptUrlSet() && owner() && !urlTried) {
      urlTried = true;
      clearScreen(); tabs.hidden = true;
      screen.appendChild(h('h1', { text: 'The Board' }));
      screen.appendChild(h('p', { class: 'msg', role: 'status', text: 'Finding the save address...' }));
      ownerUrl().then(function (ok) { if (ok) save.checkStatus().then(route); else { ownerNote = 'Signed in, but the save address was not found. Open CD Hub once on this phone, then come back.'; route(); } });
      return;
    }
    if (!isSetUp()) { drawSetup(); return; }
    save.setCode(storeGet(CODE_KEY), false);
    if (hash.indexOf(SCAN_PREFIX) === 0) {
      var tag = hash.slice(SCAN_PREFIX.length).toUpperCase();
      if (TAG_RE.test(tag)) { openModule(fillingRoom() ? 'moves' : 'jobs', { tag: tag, tab: 'scan' }); return; }
      go('home'); return;
    }
    if (hash.indexOf('mv/') === 0 && TAG_RE.test(hash.slice(3))) { openModule('moves', { tag: hash.slice(3), tab: 'scan' }); return; }
    if (hash === 'scan') { openModule('moves', { tab: 'scan' }); return; }
    if (hash === 'device') { drawDevice(); return; }
    if (hash.indexOf('m/') === 0) { openModule(hash.slice(2)); return; }
    drawHome();
  }

  window.StaffPage = {
    /** Add a screen. id must be unique; open(host, ctx) draws into host and may return a tidy-up function. */
    register: function (m) { modules = modules.filter(function (x) { return x.id !== m.id; }).concat([m]); if (started) route(); },
    ctx: ctx
  };

  function loadAll() {
    return Promise.all(FILES.map(function (f) {
      return new Promise(function (done) { var s = document.createElement('script'); s.src = f; s.onload = done; s.onerror = done; document.body.appendChild(s); });
    }));
  }
  loadAll().then(function () {
    if (!modules.some(function (m) { return m.id === 'temperature'; })) {
      window.StaffPage.register({ id: 'temperature', title: 'Temps', icon: ICONS.temp, order: 20, open: function (host, c) {
        c.data().then(function (d) { BLDScreens.temperatureEntry(host, { save: c.save, areas: d.ok ? d.areas : [] }); });
      } });
    }
    started = true;
    window.addEventListener('hashchange', route);
    if (window.DashAuth && DashAuth.onChange) DashAuth.onChange(function () { dataP = null; urlTried = false; route(); });   // signed in or out in CD Hub
    ownerRefresh();
    return save.checkStatus();
  }).then(route);
}());
