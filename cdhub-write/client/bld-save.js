/*!
 * BLDSave - the browser side of the BLD write path.
 *
 * What it does: validates a form entry for the person, then sends ONE request to the Apps Script
 * web app, which does the real checking and writes. This file never touches Drive and never needs
 * more than drive.readonly on the page.
 *
 * Ships OFF: with no Script URL, or while the script reports saving off, every save is refused
 * on the page and the banner says so in plain words.
 *
 * No data, codes, emails or Script URLs are stored in this file. The URL arrives at run time
 * (pasted by the owner on a device, or read from a small Drive config file she owns).
 *
 * Works in a browser (window.BLDSave) and in Node (module.exports) so it can be tested.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDSave = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var URL_OK = /^https:\/\/script\.google\.com\/(a\/macros\/[A-Za-z0-9.\-]+|macros)\/s\/[A-Za-z0-9_\-]+\/exec$/;
  var URL_KEY = 'bld.scriptUrl';
  var CODE_KEY = 'bld.staffCode';
  var OWNER_SKIP_KEY = 'bld.owner.skip';   // this tab chose "Use a staff code instead" (sessionStorage)
  var READ_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
  var TIMEOUT_MS = 150000;  // live saves took 17-127 s (17 Nov 2026); a shorter wait said "could not reach" for saves that landed
  var READ_MS = 20000;
  var CACHE_MS = 60000;
  var STABLE = { area: 1, thermometer: 1, qr_tag: 1, temperature_band: 1, area_link: 1 };

  /* ----- mirror of the server rules, for instant feedback only. The server is the judge. ----- */
  var TEMP_RE = /^-?\d{1,2}(\.\d)?$/;   // 1 decimal place (the owner, 7 Nov 2026)
  var TABLES = {
    area_reading: {
      label: 'Room temperatures', file: 'BLD-area_reading.csv',
      fields: {
        area_id: { type: 'ref', lookup: 'area', required: true, label: 'Room' },
        min_c: { type: 'temp', label: 'Lowest (min) C' },    // needed unless room_empty = yes (as the save, Specs.gs)
        max_c: { type: 'temp', label: 'Highest (max) C' },
        spot_c: { type: 'temp', label: 'Spot reading C' },
        mitigation_note: { type: 'text', label: 'What was done about it' },
        room_empty: { type: 'enum', values: ['yes'], label: 'Room empty' },   // the owner 11 Nov 2026: no dog; a reading is optional
        thermometer_id: { type: 'ref', lookup: 'thermometer', ifLoaded: true, label: 'Thermometer' }   // checked only when the thermometer list is loaded
      }
    },
    occupancy: {
      label: 'Where the dogs are', file: 'BLD-occupancy.csv',
      fields: {
        subject_id: { type: 'ref', lookup: 'subject', required: true, label: 'Dog' },
        area_id: { type: 'ref', lookup: 'area', required: true, label: 'Room' }
      }
    },
    occupancy_check: {
      label: 'All the rest unmoved', file: 'BLD-occupancy_check.csv',
      fields: {
        dog_ids: { type: 'idlist', lookup: 'subject', required: true, max: 500, label: 'Dogs confirmed where they were' },
        moved_count: { type: 'count', label: 'Dogs moved today' },
        note: { type: 'text', label: 'Note' }
      }
    },
    code_vaults: {
      // Codes vault (the owner 14 Nov 2026): sealed in the browser (lib/code-vault.js). Hex and public ids only: never a code or the password.
      label: 'Codes vault', file: 'BLD-code_vaults.csv',
      fields: {
        code_id: { type: 'text', required: true, label: 'Code' },
        cipher: { type: 'text', required: true, label: 'Sealed code' },
        iv: { type: 'text', required: true, label: 'IV' },
        salt: { type: 'text', required: true, label: 'Salt' },
        kdf: { type: 'text', required: true, label: 'Sealed with' },
        kdf_iter: { type: 'text', required: true, label: 'Rounds' }
      }
    },
    staff: {
      label: 'Staff roster', file: 'BLD-staff.csv',
      fields: {
        person_id: { type: 'ref', lookup: 'person', required: true, label: 'Person' },
        role: { type: 'text', required: true, label: 'Role' },
        employment: { type: 'enum', values: ['full_time', 'part_time'], required: true, label: 'Full or part time' },
        started_on: { type: 'date', required: true, label: 'Started' },
        ended_on: { type: 'date', label: 'Ended' }
      }
    }
  };

  function safeStorage(kind) {
    try { var s = root_()[kind]; var k = '__bs_t'; s.setItem(k, '1'); s.removeItem(k); return s; } catch (e) { return null; }
  }
  function root_() { return (typeof window !== 'undefined') ? window : {}; }

  /**
   * Board A (the owner 17 Nov 2026): an owner uses the SAME Google sign-in as CD Hub (auth.js keeps it in this browser),
   * so no code is needed. Returns the live access token, or '' when there is none, it has expired, or this tab chose to
   * use a staff code. The save script decides who is an owner (ADMIN_EMAILS); a token alone never grants anything.
   */
  function ownerToken() {
    var g = root_(), A = g.DashAuth;
    if (!A || typeof A.valid !== 'function') return '';
    try { if (g.sessionStorage && g.sessionStorage.getItem(OWNER_SKIP_KEY)) return ''; } catch (e) { /* no storage: carry on */ }
    var s = A.valid();
    if (!s || (A.hasScope && !A.hasScope(s, READ_SCOPE))) return '';
    return s.access_token || '';
  }
  /** Stop (true) or allow again (false) the owner sign-in on this tab. */
  function ownerSkip(on) {
    try { var ss = root_().sessionStorage; if (ss) { if (on) ss.setItem(OWNER_SKIP_KEY, '1'); else ss.removeItem(OWNER_SKIP_KEY); } } catch (e) { /* ignore */ }
  }

  function create(opts) {
    opts = opts || {};
    var doFetch = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(root_()) : null);
    var local = opts.localStorage !== undefined ? opts.localStorage : safeStorage('localStorage');
    var session = opts.sessionStorage !== undefined ? opts.sessionStorage : safeStorage('sessionStorage');
    var lookups = {};
    var status = { checked: false, reachable: null, saveEnabled: false, readEnabled: false, tables: {}, proposed: [], version: '' };
    var scriptUrl = '';

    function get(store, k) { try { return store ? (store.getItem(k) || '') : ''; } catch (e) { return ''; } }
    function put(store, k, v) { try { if (store) { if (v) store.setItem(k, v); else store.removeItem(k); } } catch (e) { /* ignore */ } }

    function setScriptUrl(u, remember) {
      u = String(u || '').trim();
      if (!u) { scriptUrl = ''; if (remember) put(local, URL_KEY, ''); status = { checked: false, reachable: null, saveEnabled: false, tables: {}, version: '' }; return { ok: true }; }
      if (!URL_OK.test(u)) {
        return { ok: false, message: 'That does not look like a Script URL. It should start https://script.google.com/macros/s/ and end /exec.' };
      }
      scriptUrl = u;
      if (remember) put(local, URL_KEY, u);
      return { ok: true };
    }
    if (opts.scriptUrl) setScriptUrl(opts.scriptUrl, false);
    else { var saved = get(local, URL_KEY); if (saved) setScriptUrl(saved, false); }

    function setCode(c, keepForTab) { c = String(c || '').trim(); if (c !== inMemoryCode) pageCache = {}; lastRole = ''; lastName = ''; if (keepForTab !== false) put(session, CODE_KEY, c); inMemoryCode = c; if (c && typeof scheduleRetry === 'function') scheduleRetry(1000); }
    var inMemoryCode = get(session, CODE_KEY);
    var pageCache = {};
    function getCode() { return inMemoryCode; }
    var googleFn = typeof opts.google === 'function' ? opts.google : (opts.google === false ? function () { return ''; } : ownerToken);
    /** A staff code, or an owner's Google sign-in. */
    function hasAuth() { return !!getCode() || !!googleFn(); }
    /** Adds the owner's Google token to a request body when there is one (the code still goes too, as the fallback). */
    function withGoogle(body) { var g = googleFn(); if (g) body.google_token = g; return body; }
    var lastName = '';   // the name held against this code, from the last read (Welcome line only)
    var lastRole = '';   // the role the script reported for this code on the last read: OWNER, STAFF, GUEST... ('' until a read). For showing buttons only; the script still decides.
    function clearCode() { inMemoryCode = ''; lastRole = ''; lastName = ''; pageCache = {}; put(session, CODE_KEY, ''); }

    function setLookups(l) { lookups = l || {}; }
    function lookupSize(name) { var l = lookups[name]; return !l ? 0 : (Array.isArray(l) ? l.length : Object.keys(l).length); }

    /** Ask the script whether saving is on. Reads only switches, no data. */
    function checkStatus() {
      if (!scriptUrl) { status = { checked: true, reachable: null, saveEnabled: false, tables: {}, version: '' }; return Promise.resolve(status); }
      if (!doFetch) return Promise.resolve(status);
      return withTimeout(doFetch(scriptUrl, { method: 'GET', redirect: 'follow' }))
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var t = {};
          (j.tables || []).forEach(function (x) { t[x.key] = { on: !!x.on, mode: x.mode, file: x.file }; });
          status = { checked: true, reachable: true, saveEnabled: !!j.saveEnabled, readEnabled: !!j.readEnabled, tables: t, proposed: j.proposed || [], version: j.version || '' };
          // the tenant's time zone from its locale row (14 Nov 2026): screens show days and times in it.
          // Until the first status check the pages use London, the only tenant's zone today.
          if (typeof j.timeZone === 'string' && /^[A-Za-z]+(\/[A-Za-z0-9_+\-]+){1,2}$|^UTC$/.test(j.timeZone)) {
            status.timeZone = j.timeZone;
            if (typeof self !== 'undefined') self.BLD_TZ = j.timeZone;
          }
          return status;
        })
        .catch(function () {
          status = { checked: true, reachable: false, saveEnabled: false, tables: {}, version: '' };
          return status;
        });
    }

    // Saves from this device go one at a time (the owner 16 Nov 2026: the round sent every room at once, the script lets one
    // save write at a time, and the rest gave up after its wait with "Someone else is saving right now"). The time limit
    // starts when a save is actually sent, not while it waits its turn. Reads are not queued: they never wait for a save.
    // 20 Nov 2026 (OV12: a round of saves all said "Saving..." for minutes): each save can be told its place in the
    // line. onTurn(n) is called with n = how many saves are ahead of it on this device, again whenever that changes,
    // and with 0 when it is actually being sent. Screens show "Waiting, n ahead" until 0, then "Saving...".
    var saveTurn = Promise.resolve(), sending = 0, line = [];
    function tellLine() {
      line.forEach(function (e, i) {
        if (e.onTurn && e.told !== i) { e.told = i; try { e.onTurn(i); } catch (x) { /* a screen's own error never stops a save */ } }
      });
    }
    function oneAtATime(send, onTurn) {
      sending++;
      var me = { onTurn: typeof onTurn === 'function' ? onTurn : null, told: -1 };
      line.push(me);
      tellLine();
      var p = saveTurn.then(send, send);
      saveTurn = p.then(function () {}, function () {});
      var done = function () { sending--; var i = line.indexOf(me); if (i >= 0) line.splice(i, 1); tellLine(); };
      p.then(done, done);
      return p;
    }
    // Leaving the page while saves are still waiting their turn would drop them (OV12 16 Nov 2026): the browser asks
    // "Leave site?" first. Nothing is kept on the device: the staff code never goes into storage for this.
    var win = root_();
    if (win.addEventListener) win.addEventListener('beforeunload', function (e) {
      if (sending > 0) { e.preventDefault(); e.returnValue = ''; return ''; }
    });

    // Two people saving at once (the owner 16 Nov 2026): the script lets one save write at a time and answers BUSY to a save
    // that waited too long. Nothing was written, so the same save (same request id) is sent again after a short,
    // random pause, up to BUSY_TRIES times, before the person is told.
    var BUSY_TRIES = 3;
    var BUSY_PAUSE_MS = opts && typeof opts.busyPauseMs === 'number' ? opts.busyPauseMs : null;   // tests only
    function busyRetry(sendOnce, tries) {
      return sendOnce().then(function (j) {
        if (j && j.ok === false && j.code === 'BUSY' && (tries || 0) < BUSY_TRIES) {
          return new Promise(function (r) { setTimeout(r, BUSY_PAUSE_MS != null ? BUSY_PAUSE_MS : 1500 + Math.floor(Math.random() * 2500)); })
            .then(function () { return busyRetry(sendOnce, (tries || 0) + 1); });
        }
        return j;
      });
    }

    function withTimeout(p, ms) {
      return new Promise(function (resolve, reject) {
        var t = setTimeout(function () { reject(new Error('timeout')); }, ms == null ? TIMEOUT_MS : ms);
        p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
      });
    }

    /* NEVER LOSE AN ENTRY (the owner 17 Nov 2026; OV12 20 Nov 2026: most of a temperature round was still waiting its turn
       when the app closed, and nothing was kept). Every save is kept on this device the moment it is pressed, before
       it waits its turn, and leaves only when the save script answers. With no answer (no signal, timeout, script busy,
       saving switched off for a moment) it stays kept and is sent again by itself with the SAME request id: soon after
       the page opens, every minute while anything waits, when the signal returns, and on "Send now".
       - The script remembers each request id for 6 hours and answers a repeat with the first answer, so a resend never
         saves twice. After 5 hours a kept entry is no longer sent by itself (the script may have forgotten it): it is
         shown as "not confirmed" and the person checks the records, then sends it or removes it.
       - A save the script refuses (a check failed) leaves the box and is listed as "Not saved" with the reason.
       - The staff code and any Google token are never kept with an entry: they are added again when it is sent. */
    var OUTBOX_KEY = 'bld.outbox', REFUSED_KEY = 'bld.outbox.refused';
    var OUTBOX_AUTO_MS = 23 * 3600000;   // inside the script's 6-hour memory of request ids
    // Answers that mean "not this time" (no signal, script busy or switched off, not set up yet): the entry stays kept
    // and is tried again. No answer at all, or one with no code, counts the same. Every other answer from the script is
    // a refusal (the entry or the code is wrong): it leaves the box and is listed as "Not saved" with the reason.
    var RETRY_ON = { NETWORK: 1, UNREACHABLE: 1, BAD_ANSWER: 1, TIMEOUT: 1, BUSY: 1, CHANGED_DURING_WRITE: 1, LOG_FAILED: 1, SAVE_OFF: 1, TABLE_OFF: 1, NOT_CONFIGURED: 1, NOT_SET_UP: 1, GOOGLE_UNREACHABLE: 1, FOLDER_UNREACHABLE: 1, NO_CODE: 1 };
    /* SIGN IN AGAIN (the owner 22 Nov 2026, owner sign-in): a Google sign-in lasts about an hour. When it has ended, or the
       script says this sign-in may not save (or no one is signed in), nothing was wrong with the entry, so it is never refused for
       that: it stays kept and waits until someone signs in again or enters a code, then goes by itself. It is not sent
       again with the same sign-in. A wrong staff code is still refused and said plainly ("not recognised"). */
    var SIGN_IN = { GOOGLE_NOT_OWNER: 1, NO_CODE: 1 };
    var SIGNIN_MSG = 'Not sent yet: sign in again (or enter your code). It is kept on this phone and goes by itself once you do, so do not type it again.';
    var authWait = null;   // the sign-in that was turned down; nothing is sent with it again
    function authNow() { return getCode() + '|' + googleFn(); }
    function refused(j) { return !!(j && !j.ok && j.code && !RETRY_ON[j.code] && !SIGN_IN[j.code]); }
    var outboxFns = [], inFlight = {};
    function jsonList(k) { try { var a = JSON.parse(get(local, k) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function outboxRead() { return jsonList(OUTBOX_KEY); }
    function outboxNotify() { outboxFns.forEach(function (f) { try { f(outboxRead().length, jsonList(REFUSED_KEY)); } catch (e) { /* a screen's listener must not stop saving */ } }); }
    function outboxWrite(a) { put(local, OUTBOX_KEY, a.length ? JSON.stringify(a) : ''); outboxNotify(); }
    function keepEntry(body) {
      var b = JSON.parse(JSON.stringify(body)); delete b.code; delete b.google_token;
      var all = outboxRead(), was = all.filter(function (x) { return x.id === b.request_id; })[0];
      var a = all.filter(function (x) { return x.id !== b.request_id; });
      var item = { id: b.request_id, body: b, at: new Date().toISOString() };
      if (was && was.unsure) item.unsure = true;
      a.push(item);
      outboxWrite(a);
    }
    /* SAVED, NOT "NOT SAVED" (OV13 22 Nov 2026: live saves took 19-60 s; the first try saved, its answer never came,
       the resend was answered DUPLICATE and the page said Not saved). A try that got no answer may have saved. When
       an entry sent again after such a try is answered DUPLICATE, its first try saved it: it counts as saved, with a
       tick. A DUPLICATE for an entry whose every try was answered is still shown as before (a different entry). */
    function markUnsure(id) {
      var a = outboxRead(), hit = false;
      a.forEach(function (x) { if (x.id === id && !x.unsure) { x.unsure = true; hit = true; } });
      if (hit) put(local, OUTBOX_KEY, JSON.stringify(a));
    }
    function answerFor(id, j) {
      if (!(j && j.ok === false && j.code === 'DUPLICATE')) return j;
      var item = outboxRead().filter(function (x) { return x.id === id; })[0];
      return item && item.unsure ? { ok: true, result: { status: 'saved', repeat: true, earlier_try: true } } : j;
    }
    function dropEntry(id) { var a = outboxRead(), b = a.filter(function (x) { return x.id !== id; }); if (b.length !== a.length) outboxWrite(b); }
    function refuseEntry(id, j) {
      var item = outboxRead().filter(function (x) { return x.id === id; })[0];
      if (!item) return;
      var rf = jsonList(REFUSED_KEY).filter(function (x) { return x.id !== id; });
      rf.push({ id: id, at: item.at, table: item.body.table || '', action: item.body.action || '', fields: item.body.fields || {}, code: (j && j.code) || '', message: (j && j.message) || '' });
      put(local, REFUSED_KEY, JSON.stringify(rf.slice(-50)));
    }
    /** After an answer: saved (or already saved) and refused leave the box; anything else keeps it for another try. */
    function alreadyEnded(j) { return !!(j && !j.ok && j.code === 'NOT_ALLOWED' && /already ended/i.test(j.message || '')); }
    function settle(id, j, auth) {
      if (j && (j.ok || j.code === 'DUPLICATE' || alreadyEnded(j))) { authWait = null; dropEntry(id); return true; }
      if (refused(j)) { refuseEntry(id, j); dropEntry(id); return true; }
      if (j && !j.ok && SIGN_IN[j.code] && auth != null) { authWait = auth; outboxNotify(); }
      scheduleRetry(60000);
      return false;
    }
    /* While entries wait for the owner to sign in again: if the page has the shared quiet renewal
       (BLDSave.refreshOwnerToken, CLOUD SPEED 22 Nov 2026), try it at most every 5 minutes and send once it gives a new
       sign-in. Without it, or when Google cannot renew quietly, they stay kept and the line asks to sign in again. */
    var renewAt = 0;
    function quietRenew() {
      var B = root_().BLDSave;
      if (googleFn !== ownerToken || !B || typeof B.refreshOwnerToken !== 'function' || Date.now() - renewAt < 300000 || !outboxRead().length) return;
      renewAt = Date.now();
      try { Promise.resolve(B.refreshOwnerToken()).then(function (t) { if (t && hasAuth() && authNow() !== authWait) flush(); }, function () { /* stays kept */ }); }
      catch (e) { /* stays kept */ }
    }
    /** true while kept entries wait for someone to sign in again (or enter a code). */
    function needsSignIn() { return outboxRead().length > 0 && (!hasAuth() || authWait === authNow()); }
    /** An entry pressed while no one is signed in: kept, not sent, and goes once someone signs in. */
    function keptForSignIn(body) {
      keepEntry(body); scheduleRetry(60000);
      return Promise.resolve({ ok: false, code: 'NO_CODE', kept: true, signIn: true, requestId: body.request_id, message: SIGNIN_MSG });
    }
    function keptAnswer(j) { return SIGN_IN[j.code] ? { ok: false, code: j.code, kept: true, signIn: true, message: SIGNIN_MSG } : { ok: false, code: j.code, kept: true, message: KEPT_MSG }; }
    function postOnce(body) {
      return busyRetry(function () { return withTimeout(doFetch(scriptUrl, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // keeps it a "simple" request: no pre-flight needed
        body: JSON.stringify(body)
      })).then(function (r) { return r.json(); }); });
    }
    /** One kept entry, sent with its own request id and the code held now. Never sent twice at once from this page. */
    function sendKept(item) {
      if (inFlight[item.id]) return inFlight[item.id];
      var auth = authNow(), body = withGoogle(Object.assign({}, item.body, { code: getCode() }));
      var p = oneAtATime(function () { return postOnce(body); })
        .then(function (j) { settle(item.id, answerFor(item.id, j), auth); }, function () { markUnsure(item.id); scheduleRetry(60000); });
      inFlight[item.id] = p;
      var off = function () { delete inFlight[item.id]; };
      p.then(off, off);
      return p;
    }
    var flushing = null;
    /** Send every kept entry younger than 5 hours again, oldest first. Resolves to how many are still kept. */
    function flush(o) {
      if (flushing) return flushing;
      var now = Date.now(), all = outboxRead();
      var due = all.filter(function (x) { return (o && o.old) || now - Date.parse(x.at) < OUTBOX_AUTO_MS; });
      if (!due.length || !scriptUrl || !doFetch) return Promise.resolve(all.length);
      if (!hasAuth() || authWait === authNow()) { quietRenew(); return Promise.resolve(all.length); }
      flushing = due.reduce(function (p, item) { return p.then(function () { return sendKept(item); }); }, Promise.resolve())
        .then(function () { flushing = null; outboxNotify(); return outboxRead().length; }, function () { flushing = null; return outboxRead().length; });
      return flushing;
    }
    function isOld(x) { return Date.now() - Date.parse(x.at) >= OUTBOX_AUTO_MS; }
    var outbox = {
      count: function () { return outboxRead().length; },
      items: function () { return outboxRead().map(function (x) { return { id: x.id, at: x.at, table: x.body.table || '', action: x.body.action || '', fields: x.body.fields || {}, old: isOld(x) }; }); },
      refused: function () { return jsonList(REFUSED_KEY); },
      /** true while kept entries wait for someone to sign in again (or enter a code). */
      needsSignIn: needsSignIn,
      dismissRefused: function (id) { put(local, REFUSED_KEY, JSON.stringify(jsonList(REFUSED_KEY).filter(function (x) { return x.id !== id; }))); outboxNotify(); },
      /** Send now. {old: true} also sends entries past 5 hours, after the person has checked the records. */
      flush: flush,
      /** The person checked the records and the entry is there (or not wanted): take it out of the box. */
      remove: function (id) { dropEntry(id); },
      onChange: function (fn) { if (typeof fn === 'function') outboxFns.push(fn); }
    };
    // On a real page: try the box soon after opening, then every minute while something waits, and when the signal
    // comes back. An empty box sets no timer. Tests pass their own fetch and get no timers.
    var autoOn = opts.autoFlush !== false && !opts.fetch && typeof document !== 'undefined', retryTimer = null;
    function scheduleRetry(ms) {
      if (!autoOn || retryTimer || !outboxRead().length) return;
      retryTimer = setTimeout(function () { retryTimer = null; flush().then(function (n) { if (n > 0) scheduleRetry(60000); }); }, ms);
    }
    if (autoOn) {
      scheduleRetry(4000);
      if (win.addEventListener) win.addEventListener('online', function () { flush(); });
    }
    var KEPT_MSG = 'No answer yet. It is kept on this phone and sent again by itself, so do not type it again.';

    /** Plain-English state for the banner and for disabling buttons. */
    function banner(tableKey) {
      var tb = status.tables[tableKey];
      if (!scriptUrl) return { kind: 'off', canSave: false, text: 'Saving is off. Nothing you type here is kept. User switches it on when it is ready.' };
      if (status.checked && status.reachable === false) return { kind: 'off', canSave: false, text: 'Cannot reach the save service right now, so nothing can be saved. Try again in a moment.' };
      if (!status.checked) return { kind: 'checking', canSave: false, text: 'Checking whether saving is on...' };
      if (!status.saveEnabled) return { kind: 'off', canSave: false, text: 'Saving is off. Nothing you type here is kept. User switches it on when it is ready.' };
      if (tableKey && !tb && status.proposed && status.proposed.indexOf(tableKey) >= 0) {
        return { kind: 'off', canSave: false, text: '"' + ((TABLES[tableKey] || {}).label || tableKey) + '" is only a proposal so far. Nothing can be saved to it until User agrees it.' };
      }
      if (tableKey && (!tb || !tb.on)) {
        return { kind: 'off', canSave: false, text: 'Saving to "' + ((TABLES[tableKey] || {}).label || tableKey) + '" is not switched on yet.' };
      }
      if (tb && tb.mode !== 'direct') return { kind: 'pending', canSave: true, text: 'Saving on. User approves each entry.' };
      return { kind: 'on', canSave: true, text: 'Saving on. If one is wrong, tell the owner.' };
    }

    /** Same rule and words as tempPairError_ in Specs.gs. The shared file is loaded when this page has it. */
    function pairLib() {
      if (typeof module === 'object' && module.exports) {
        var tries = ['./temp-pair.js', '../../cdhub/staff/lib/temp-pair.js'];
        for (var i = 0; i < tries.length; i++) { try { return require(tries[i]); } catch (e0) { /* the other copy of this file */ } }
      }
      var g = typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this);
      return (g && g.BLDTempPair) || null;
    }
    function pairError(min, max) {
      var lib = pairLib();
      if (lib && lib.error) return lib.error(min, max);
      var a = min === undefined || min === null ? '' : String(min).trim();
      var b = max === undefined || max === null ? '' : String(max).trim();
      var lo = parseFloat(a), hi = parseFloat(b);
      if (a !== '' && b !== '' && !isNaN(lo) && !isNaN(hi) && lo > hi) return 'The lowest reading cannot be higher than the highest reading.';
      return '';
    }

    /** Check the fields on the page. */
    function validate(tableKey, fields) {
      var spec = TABLES[tableKey], errors = {};
      if (!spec) return { ok: false, errors: { _: 'Unknown table.' } };
      Object.keys(spec.fields).forEach(function (name) {
        var def = spec.fields[name], raw = fields[name], v = (raw === undefined || raw === null) ? '' : (Array.isArray(raw) ? raw.join('|') : String(raw)).trim();
        if (v === '') { if (def.required) errors[name] = 'This is needed.'; return; }
        if (def.type === 'temp') {
          if (!TEMP_RE.test(v)) errors[name] = 'Type degrees C with at most 1 decimal, e.g. 21.4.';
          // an unusual temperature is a warning the script gives (confirm_unusual "Save anyway?"), not a stop here
        } else if (def.type === 'text') {
          if (v.length > 500) errors[name] = 'Too long (500 characters at most).';
          else if (/^[=+\-@\t]/.test(v)) errors[name] = 'Please do not start with = + - or @.';
        } else if (def.type === 'enum') {
          if (def.values.indexOf(v) < 0) errors[name] = 'Choose one of: ' + def.values.join(', ') + '.';
        } else if (def.type === 'date') {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) errors[name] = 'Use a date as YYYY-MM-DD.';
        } else if (def.type === 'count') {
          if (!/^\d{1,3}$/.test(v)) errors[name] = 'Use a whole number from 0 to 999.';
        } else if (def.type === 'idlist') {
          var ids = (Array.isArray(raw) ? raw : String(raw).split('|')).map(function (x) { return String(x).trim(); }).filter(String);
          if (!ids.length) errors[name] = 'This is needed.';
          else if (ids.length > (def.max || 500)) errors[name] = 'Too many dogs in one list (the limit is ' + (def.max || 500) + ').';
          else if (lookupSize(def.lookup) === 0) errors[name] = 'The ' + def.lookup + ' list is not loaded, so this cannot be checked.';
          else {
            var bad = ids.filter(function (id) { return !hasId(lookups[def.lookup], id); });
            if (bad.length) errors[name] = 'Not found in the ' + def.lookup + ' list: ' + bad.slice(0, 3).join(', ') + (bad.length > 3 ? ' and ' + (bad.length - 3) + ' more' : '') + '.';
          }
        } else if (def.type === 'ref') {
          if (lookupSize(def.lookup) === 0) { if (!def.ifLoaded) errors[name] = 'The ' + def.lookup + ' list is not loaded, so this cannot be checked.'; }
          else if (!hasId(lookups[def.lookup], v)) errors[name] = 'Not found in the ' + def.lookup + ' list.';
        }
      });
      if (spec.fields.room_empty && !errors.min_c && !errors.max_c && !errors.room_empty) {
        var blank = function (k) { var x = fields[k]; return x === undefined || x === null || String(x).trim() === ''; };
        if (String(fields.room_empty || '').trim() !== 'yes') {
          if (blank('min_c')) errors.min_c = 'This is needed.';
          if (blank('max_c')) errors.max_c = 'This is needed.';
        } else if (blank('min_c') !== blank('max_c')) {
          errors[blank('min_c') ? 'min_c' : 'max_c'] = 'Fill in both lowest and highest, or neither.';
        }
      }
      if (!errors.min_c && !errors.max_c) {
        var pairMsg = pairError(fields.min_c, fields.max_c);
        if (pairMsg) errors.min_c = pairMsg;
      }
      return { ok: Object.keys(errors).length === 0, errors: errors };
    }
    function hasId(l, id) {
      if (Array.isArray(l)) return l.some(function (x) { return (x && x.id !== undefined ? x.id : x) === id; });
      return !!l[id];
    }

    function newRequestId() {
      try { if (root_().crypto && root_().crypto.randomUUID) return 'r-' + root_().crypto.randomUUID(); } catch (e) { /* fall through */ }
      var s = 'r-'; for (var i = 0; i < 24; i++) s += 'abcdefghjkmnpqrstuvwxyz23456789'.charAt(Math.floor(Math.random() * 31));
      return s;
    }

    /**
     * Send one entry. Resolves (never rejects) with:
     *   {ok:true, status:'saved'|'queued', id, pending_id?, message}
     *   {ok:false, code, message, fields?}
     * Pass the SAME requestId when retrying after a network failure: the server will not save twice.
     */
    function submit(tableKey, fields, o) {
      o = o || {};
      var spec = TABLES[tableKey];
      if (!spec) return Promise.resolve({ ok: false, code: 'BAD_REQUEST', message: 'Unknown table.' });
      var b = banner(tableKey);
      if (!b.canSave) return Promise.resolve({ ok: false, code: 'SAVE_OFF', message: b.text });
      var signedIn = hasAuth();
      var v = validate(tableKey, fields);
      if (!v.ok) return Promise.resolve({ ok: false, code: 'INVALID', message: 'Some details need fixing before this can be sent.', fields: v.errors });
      var action = o.action === 'correct' || o.action === 'add_site' || o.action === 'add_session' ? o.action : 'add';
      var body = {
        v: 1, request_id: o.requestId || newRequestId(), code: getCode(), table: tableKey, action: action, fields: fields
      };
      withGoogle(body);
      if (action === 'correct') { body.corrects_id = o.correctsId || ''; body.reason = o.reason || ''; }
      if (o.values && action === 'add') body.values = o.values;   // a check's form answers {field_key: value}, saved with the record
      if (!doFetch) return Promise.resolve({ ok: false, code: 'NETWORK', message: 'This browser cannot send the save.' });
      if (!signedIn) return keptForSignIn(body);
      var auth = authNow();
      keepEntry(body);
      var sent = oneAtATime(function () { return postOnce(body); }, o.onTurn);
      inFlight[body.request_id] = sent;
      var off = function () { delete inFlight[body.request_id]; };
      sent.then(off, off);
      return sent.then(function (j) {
        j = answerFor(body.request_id, j);
        if (!settle(body.request_id, j, auth) && j && j.ok === false) j = keptAnswer(j);
        if (j && j.ok) {
          dropReads(tableKey);
          var res = j.result || {};
          res.ok = true;
          res.requestId = body.request_id;
          res.message = res.status === 'queued'
            ? 'Sent. It is in the approvals queue until User approves it; then it joins the records.'
            : 'Saved.';
          return res;
        }
        return { ok: false, code: (j && j.code) || 'UNEXPECTED', kept: !!(j && j.kept), signIn: !!(j && j.signIn), message: (j && j.message) || 'Something went wrong.', fields: j && j.fields, requestId: body.request_id };
      }).catch(function () {
        markUnsure(body.request_id);
        scheduleRetry(60000);
        return { ok: false, code: 'NETWORK', kept: true, requestId: body.request_id, message: KEPT_MSG };
      });
    }

    /**
     * Send one named save that is not a table row (e.g. link_add, link_end). Same code, same no-double-save reference.
     * Resolves (never rejects): {ok:true, ...result, message:'Saved.'} or {ok:false, code, message, fields}.
     */
    function act(action, fields, requestId, onTurn) {
      if (!scriptUrl) return Promise.resolve({ ok: false, code: 'SAVE_OFF', message: 'Saving is off.' });
      if (!doFetch) return Promise.resolve({ ok: false, code: 'NETWORK', message: 'This browser cannot send the save.' });
      var body = withGoogle({ v: 1, request_id: requestId || newRequestId(), code: getCode(), action: action, fields: fields || {} });
      if (!hasAuth()) return keptForSignIn(body);
      var auth = authNow();
      keepEntry(body);
      var sent = oneAtATime(function () { return postOnce(body); }, onTurn);
      inFlight[body.request_id] = sent;
      var off = function () { delete inFlight[body.request_id]; };
      sent.then(off, off);
      return sent.then(function (j) {
        j = answerFor(body.request_id, j);
        if (!settle(body.request_id, j, auth) && j && j.ok === false) j = keptAnswer(j);
        if (j && j.ok) { var res = j.result || {}; res.ok = true; res.requestId = body.request_id; res.message = 'Saved.'; return res; }
        return { ok: false, code: (j && j.code) || 'UNEXPECTED', kept: !!(j && j.kept), signIn: !!(j && j.signIn), message: (j && j.message) || 'Something went wrong.', fields: j && j.fields, requestId: body.request_id };
      }).catch(function () {
        markUnsure(body.request_id);
        scheduleRetry(60000);
        return { ok: false, code: 'NETWORK', kept: true, requestId: body.request_id, message: KEPT_MSG };
      });
    }
    /** Record-to-record links (14 Nov 2026): {from_table, from_id, role, to_table, to_id, sort?, note?, from_date?}. */
    function linkAdd(fields, requestId) { return act('link_add', fields, requestId); }
    /** End one link: {id, to_date?} (blank = today). */
    function linkEnd(fields, requestId) { return act('link_end', fields, requestId); }

    /**
     * Read one list through the script, as far as the owner has allowed THIS staff code (no Google sign-in).
     * Optional filter {area_id, from, to} (London days YYYY-MM-DD) narrows the rows; it never widens them.
     * Resolves (never rejects): {ok:true, table, fields, rows, count, scope} or {ok:false, code, message}.
     * The same list and filter shares one request for a minute. area, thermometer, qr_tag, temperature_band and area_link draw from this phone, then refresh.
     */
    function hashKey(s) {
      var h = 0;
      for (var i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
      return h.toString(36);
    }
    function authTag() { return getCode() || (googleFn() ? 'g' : ''); }
    function cacheKey(table, filter) {
      var keys = filter && typeof filter === 'object' ? Object.keys(filter).sort() : [];
      var f = keys.map(function (k) { return k + '=' + filter[k]; }).join('&');
      return table + '\n' + f + '\n' + authTag();
    }
    function remember(res) {
      if (res && typeof res.role === 'string') lastRole = res.role;
      if (res && typeof res.name === 'string') lastName = res.name;
    }
    function lsKey(table, filter) { return 'bld.rd.' + table + '.' + hashKey(cacheKey(table, filter)); }
    function lsRead(k) {
      if (!local) return null;
      try { var o = JSON.parse(get(local, k) || ''); return o && o.res && o.res.ok ? o.res : null; } catch (e) { return null; }
    }
    function lsWrite(k, res) {
      if (!local || !res || !res.ok) return;
      var o = { ok: true, rows: res.rows || [] };
      ['table', 'fields', 'count', 'scope', 'role', 'name', 'truncated'].forEach(function (n) { if (res[n] !== undefined) o[n] = res[n]; });
      try { put(local, k, JSON.stringify({ res: o })); } catch (e) { /* storage full: the page still reads from the network */ }
    }
    function fetchRead(tableKey, filter) {
      return withTimeout(doFetch(scriptUrl, {
        method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(withGoogle(filter ? { v: 1, action: 'read', code: getCode(), table: tableKey, filter: filter } : { v: 1, action: 'read', code: getCode(), table: tableKey }))
      }), READ_MS).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok && j.result) { var res = j.result; res.ok = true; remember(res); return res; }
        return { ok: false, code: (j && j.code) || 'UNEXPECTED', message: (j && j.message) || 'Something went wrong.' };
      }).catch(function () { return { ok: false, code: 'NETWORK', message: 'Could not reach the records right now. Try again in a moment.' }; });
    }
    function dropReads(table) {
      var prefix = table + '\n';
      Object.keys(pageCache).forEach(function (k) { if (k.slice(0, prefix.length) === prefix) delete pageCache[k]; });
      if (!local || typeof local.key !== 'function') return;
      try {
        var p = 'bld.rd.' + table + '.', gone = [], i, k;
        for (i = 0; i < local.length; i++) { k = local.key(i); if (k && k.indexOf(p) === 0) gone.push(k); }
        gone.forEach(function (key) { local.removeItem(key); });
      } catch (e) { /* the next read still asks the network if this fails */ }
    }
    function read(tableKey, filter) {
      if (!scriptUrl) return Promise.resolve({ ok: false, code: 'READ_OFF', message: 'Reading is off. User switches it on when it is ready.' });
      if (status.checked && status.reachable && !status.readEnabled) return Promise.resolve({ ok: false, code: 'READ_OFF', message: 'Reading from the records is switched off.' });
      if (!hasAuth()) return Promise.resolve({ ok: false, code: 'NO_CODE', message: 'Enter your staff code.' });
      if (!doFetch) return Promise.resolve({ ok: false, code: 'NETWORK', message: 'This browser cannot reach the records.' });
      var key = cacheKey(tableKey, filter), now = Date.now(), hit = pageCache[key];
      if (hit && (hit.pending || now - hit.at < CACHE_MS)) { if (hit.res) remember(hit.res); return hit.p; }
      var stable = !!STABLE[tableKey] && !(filter && typeof filter === 'object' && Object.keys(filter).length);
      var stored = stable ? lsRead(lsKey(tableKey, filter)) : null;
      var net = fetchRead(tableKey, filter);
      if (stored) {
        remember(stored);
        var cached = Promise.resolve(stored);
        pageCache[key] = { at: now, p: cached, pending: false, res: stored };
        net.then(function (res) {
          if (res && res.ok) { lsWrite(lsKey(tableKey, filter), res); pageCache[key] = { at: Date.now(), p: Promise.resolve(res), pending: false, res: res }; }
          else if (pageCache[key] && pageCache[key].p === cached) delete pageCache[key];
        });
        return cached;
      }
      var p = net.then(function (res) {
        var cur = pageCache[key];
        if (!(res && res.ok)) { if (cur && cur.p === p) delete pageCache[key]; return res; }
        if (stable) { lsWrite(lsKey(tableKey, filter), res); pageCache[key] = { at: Date.now(), p: Promise.resolve(res), pending: false, res: res }; }
        else if (cur && cur.p === p) delete pageCache[key];
        return res;
      });
      pageCache[key] = { at: now, p: p, pending: true };
      return p;
    }

    /**
     * Read the lists the daily location check needs. area, subject and occupancy are required;
     * subject_status is optional (the check still works without it). Resolves {ok, tables} or {ok:false, message}.
     */
    /* Codes vault: is this typed code the one held for this public id? Sent once, like a sign-in; the reply is
       { ok, match } only. The script never logs or echoes it; misses count towards the sign-in limit. */
    function codeCheck(codeId, typed) {
      if (!scriptUrl || !doFetch) return Promise.resolve({ ok: false, code: 'SAVE_OFF', message: 'The save script is not set up on this device.' });
      if (!getCode()) return Promise.resolve({ ok: false, code: 'NO_CODE', message: 'Enter your staff code.' });
      return withTimeout(doFetch(scriptUrl, {
        method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ v: 1, action: 'code_check', code: getCode(), code_id: codeId, typed: typed })
      })).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok && j.result) return { ok: true, match: j.result.match === true };
        return { ok: false, code: (j && j.code) || 'UNEXPECTED', message: (j && j.message) || 'Something went wrong.' };
      }).catch(function () { return { ok: false, code: 'NETWORK', message: 'Could not reach the records right now. Try again in a moment.' }; });
    }

    function readMany(keys, optional) {
      var out = {}, optionalSet = {};
      (optional || ['subject_status']).forEach(function (k) { optionalSet[k] = true; });
      var take = function (k, r) {
        if (r.ok) { out[k] = r.rows; return { ok: true }; }
        if (optionalSet[k] && (r.code === 'NOT_ALLOWED' || r.code === 'FILE_MISSING' || r.code === 'FILE_NOT_ALLOWED'))   /* FILE_NOT_ALLOWED: the script does not know this list yet */ { out[k] = []; return { ok: true }; }
        return r;
      };
      if (!keys.length) return Promise.resolve({ ok: true, tables: out });
      // Speed (the owner 13/11): the first list goes alone, so a wrong or ended code costs one try, not one per list
      // (each wrong try counts toward the lock-out). The rest go together; the first refusal in list order is
      // reported, exactly as when they went one after another.
      return read(keys[0]).then(function (first) {
        var r0 = take(keys[0], first);
        if (!r0.ok) return r0;
        var rest = keys.slice(1);
        return Promise.all(rest.map(function (k) { return read(k); })).then(function (rs) {
          for (var i = 0; i < rest.length; i++) { var r = take(rest[i], rs[i]); if (!r.ok) return r; }
          return { ok: true, tables: out };
        });
      });
    }

    /**
     * Optional: read the Script URL from a small Drive file the owner owns, so every signed-in device
     * picks it up. Uses the readonly token the page already has. The URL is checked against the
     * Google Apps Script address pattern, so a wrong or tampered file cannot send staff codes elsewhere.
     */
    function loadConfigFromDrive(accessToken, folderId, fileName) {
      fileName = fileName || 'BLD-_save-config.json';
      var q = "'" + folderId + "' in parents and trashed = false and name = '" + fileName + "'";
      var h = { headers: { Authorization: 'Bearer ' + accessToken } };
      return doFetch('https://www.googleapis.com/drive/v3/files?fields=files(id)&q=' + encodeURIComponent(q), h)
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var f = (j.files || []);
          if (f.length === 0) return { ok: false, message: 'No save config file in the folder, so saving stays off.' };
          if (f.length > 1) return { ok: false, message: 'Two save config files were found, so saving stays off.' };
          return doFetch('https://www.googleapis.com/drive/v3/files/' + f[0].id + '?alt=media', h)
            .then(function (r) { return r.json(); })
            .then(function (cfg) {
              if (!cfg || cfg.saving !== 'on') return { ok: false, message: 'The save config says saving is off.' };
              var res = setScriptUrl(cfg.scriptUrl, false);
              return res.ok ? { ok: true } : res;
            });
        })
        .catch(function () { return { ok: false, message: 'Could not read the save config, so saving stays off.' }; });
    }

    return {
      TABLES: TABLES,
      setScriptUrl: setScriptUrl, getScriptUrlSet: function () { return !!scriptUrl; },
      setCode: setCode, getCode: getCode, clearCode: clearCode, hasAuth: hasAuth, usingGoogle: function () { return !getCode() && !!googleFn(); },
      role: function () { return lastRole; },
      name: function () { return lastName; },
      setLookups: setLookups, lookupSize: lookupSize,
      checkStatus: checkStatus, status: function () { return status; },
      timeZone: function () { return status.timeZone || ''; },
      banner: banner, validate: validate, submit: submit, newRequestId: newRequestId,
      outbox: outbox,
      sending: function () { return sending; },
      loadConfigFromDrive: loadConfigFromDrive,
      act: act, linkAdd: linkAdd, linkEnd: linkEnd,
      read: read, readMany: readMany, codeCheck: codeCheck, canRead: function () { return !!scriptUrl && status.reachable === true && !!status.readEnabled; }
    };
  }

  return { create: create, TABLES: TABLES, URL_OK: URL_OK, ownerToken: ownerToken, ownerSkip: ownerSkip };
}));
