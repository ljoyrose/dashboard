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
 * (pasted by Lisa on a device, or read from a small Drive config file she owns).
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

  /* ----- mirror of the server rules, for instant feedback only. The server is the judge. ----- */
  var TEMP_RE = /^-?\d{1,2}(\.\d)?$/;   // 1 decimal place (Lisa, 7 Nov 2026)
  var TABLES = {
    area_reading: {
      label: 'Room temperatures', file: 'BLD-area_reading.csv',
      fields: {
        area_id: { type: 'ref', lookup: 'area', required: true, label: 'Room' },
        min_c: { type: 'temp', label: 'Lowest (min) C' },    // needed unless room_empty = yes (as the save, Specs.gs)
        max_c: { type: 'temp', label: 'Highest (max) C' },
        spot_c: { type: 'temp', label: 'Spot reading C' },
        mitigation_note: { type: 'text', label: 'What was done about it' },
        room_empty: { type: 'enum', values: ['yes'], label: 'Room empty' },   // Lisa 11 Nov 2026: no dog; a reading is optional
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
      // Codes vault (Lisa 14 Nov 2026): sealed in the browser (lib/code-vault.js). Hex and public ids only: never a code or the password.
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
   * Board A (Lisa 17 Nov 2026): an owner uses the SAME Google sign-in as CD Hub (auth.js keeps it in this browser),
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

    function setCode(c, keepForTab) { c = String(c || '').trim(); lastRole = ''; lastName = ''; if (keepForTab !== false) put(session, CODE_KEY, c); inMemoryCode = c; }
    var inMemoryCode = get(session, CODE_KEY);
    function getCode() { return inMemoryCode; }
    var googleFn = typeof opts.google === 'function' ? opts.google : (opts.google === false ? function () { return ''; } : ownerToken);
    /** A staff code, or an owner's Google sign-in. */
    function hasAuth() { return !!getCode() || !!googleFn(); }
    /** Adds the owner's Google token to a request body when there is one (the code still goes too, as the fallback). */
    function withGoogle(body) { var g = googleFn(); if (g) body.google_token = g; return body; }
    var lastName = '';   // the name held against this code, from the last read (Welcome line only)
    var lastRole = '';   // the role the script reported for this code on the last read: OWNER, STAFF, GUEST... ('' until a read). For showing buttons only; the script still decides.
    function clearCode() { inMemoryCode = ''; lastRole = ''; lastName = ''; put(session, CODE_KEY, ''); }

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
          return status;
        })
        .catch(function () {
          status = { checked: true, reachable: false, saveEnabled: false, tables: {}, version: '' };
          return status;
        });
    }

    // Saves from this device go one at a time (Lisa 16 Nov 2026: the round sent every room at once, the script lets one
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

    // Two people saving at once (Lisa 16 Nov 2026): the script lets one save write at a time and answers BUSY to a save
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

    function withTimeout(p) {
      return new Promise(function (resolve, reject) {
        var t = setTimeout(function () { reject(new Error('timeout')); }, TIMEOUT_MS);
        p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
      });
    }

    /** Plain-English state for the banner and for disabling buttons. */
    function banner(tableKey) {
      var tb = status.tables[tableKey];
      if (!scriptUrl) return { kind: 'off', canSave: false, text: 'Saving is off. Nothing you type here is kept. Lisa switches it on when it is ready.' };
      if (status.checked && status.reachable === false) return { kind: 'off', canSave: false, text: 'Cannot reach the save service right now, so nothing can be saved. Try again in a moment.' };
      if (!status.checked) return { kind: 'checking', canSave: false, text: 'Checking whether saving is on...' };
      if (!status.saveEnabled) return { kind: 'off', canSave: false, text: 'Saving is off. Nothing you type here is kept. Lisa switches it on when it is ready.' };
      if (tableKey && !tb && status.proposed && status.proposed.indexOf(tableKey) >= 0) {
        return { kind: 'off', canSave: false, text: '"' + ((TABLES[tableKey] || {}).label || tableKey) + '" is only a proposal so far. Nothing can be saved to it until Lisa agrees it.' };
      }
      if (tableKey && (!tb || !tb.on)) {
        return { kind: 'off', canSave: false, text: 'Saving to "' + ((TABLES[tableKey] || {}).label || tableKey) + '" is not switched on yet.' };
      }
      if (tb && tb.mode !== 'direct') return { kind: 'pending', canSave: true, text: 'Saving on. Lisa approves each entry.' };
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
      if (!hasAuth()) return Promise.resolve({ ok: false, code: 'NO_CODE', message: 'Enter your staff code.' });
      var v = validate(tableKey, fields);
      if (!v.ok) return Promise.resolve({ ok: false, code: 'INVALID', message: 'Some details need fixing before this can be sent.', fields: v.errors });
      var action = o.action === 'correct' || o.action === 'add_site' ? o.action : 'add';
      var body = {
        v: 1, request_id: o.requestId || newRequestId(), code: getCode(), table: tableKey, action: action, fields: fields
      };
      withGoogle(body);
      if (action === 'correct') { body.corrects_id = o.correctsId || ''; body.reason = o.reason || ''; }
      if (o.values && action === 'add') body.values = o.values;   // a check's form answers {field_key: value}, saved with the record
      if (!doFetch) return Promise.resolve({ ok: false, code: 'NETWORK', message: 'This browser cannot send the save.' });
      return oneAtATime(function () { return busyRetry(function () { return withTimeout(doFetch(scriptUrl, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // keeps it a "simple" request: no pre-flight needed
        body: JSON.stringify(body)
      })).then(function (r) { return r.json(); }); }); }, o.onTurn).then(function (j) {
        if (j && j.ok) {
          var res = j.result || {};
          res.ok = true;
          res.requestId = body.request_id;
          res.message = res.status === 'queued'
            ? 'Sent. It is in the approvals queue until Lisa approves it; then it joins the records.'
            : 'Saved.';
          return res;
        }
        return { ok: false, code: (j && j.code) || 'UNEXPECTED', message: (j && j.message) || 'Something went wrong.', fields: j && j.fields, requestId: body.request_id };
      }).catch(function () {
        return {
          ok: false, code: 'NETWORK', requestId: body.request_id,
          message: 'Could not reach the save service, so it is not confirmed as saved. Press save again: it will not save twice.'
        };
      });
    }

    /**
     * Send one named save that is not a table row (e.g. link_add, link_end). Same code, same no-double-save reference.
     * Resolves (never rejects): {ok:true, ...result, message:'Saved.'} or {ok:false, code, message, fields}.
     */
    function act(action, fields, requestId, onTurn) {
      if (!scriptUrl) return Promise.resolve({ ok: false, code: 'SAVE_OFF', message: 'Saving is off.' });
      if (!hasAuth()) return Promise.resolve({ ok: false, code: 'NO_CODE', message: 'Enter your staff code.' });
      if (!doFetch) return Promise.resolve({ ok: false, code: 'NETWORK', message: 'This browser cannot send the save.' });
      var body = withGoogle({ v: 1, request_id: requestId || newRequestId(), code: getCode(), action: action, fields: fields || {} });
      return oneAtATime(function () { return busyRetry(function () { return withTimeout(doFetch(scriptUrl, {
        method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body)
      })).then(function (r) { return r.json(); }); }); }, onTurn).then(function (j) {
        if (j && j.ok) { var res = j.result || {}; res.ok = true; res.requestId = body.request_id; res.message = 'Saved.'; return res; }
        return { ok: false, code: (j && j.code) || 'UNEXPECTED', message: (j && j.message) || 'Something went wrong.', fields: j && j.fields, requestId: body.request_id };
      }).catch(function () {
        return { ok: false, code: 'NETWORK', requestId: body.request_id, message: 'Could not reach the save service, so it is not confirmed as saved. Press save again: it will not save twice.' };
      });
    }
    /** Record-to-record links (14 Nov 2026): {from_table, from_id, role, to_table, to_id, sort?, note?, from_date?}. */
    function linkAdd(fields, requestId) { return act('link_add', fields, requestId); }
    /** End one link: {id, to_date?} (blank = today). */
    function linkEnd(fields, requestId) { return act('link_end', fields, requestId); }

    /**
     * Read one list through the script, as far as Lisa has allowed THIS staff code (no Google sign-in).
     * Optional filter {area_id, from, to} (London days YYYY-MM-DD) narrows the rows; it never widens them.
     * Resolves (never rejects): {ok:true, table, fields, rows, count, scope} or {ok:false, code, message}.
     * Nothing is cached or kept: the rows live only in the page.
     */
    function read(tableKey, filter) {
      if (!scriptUrl) return Promise.resolve({ ok: false, code: 'READ_OFF', message: 'Reading is off. Lisa switches it on when it is ready.' });
      if (status.checked && status.reachable && !status.readEnabled) return Promise.resolve({ ok: false, code: 'READ_OFF', message: 'Reading from the records is switched off.' });
      if (!hasAuth()) return Promise.resolve({ ok: false, code: 'NO_CODE', message: 'Enter your staff code.' });
      if (!doFetch) return Promise.resolve({ ok: false, code: 'NETWORK', message: 'This browser cannot reach the records.' });
      return withTimeout(doFetch(scriptUrl, {
        method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(withGoogle(filter ? { v: 1, action: 'read', code: getCode(), table: tableKey, filter: filter } : { v: 1, action: 'read', code: getCode(), table: tableKey }))
      })).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok && j.result) { var res = j.result; res.ok = true; if (typeof res.role === 'string') lastRole = res.role; if (typeof res.name === 'string') lastName = res.name; return res; }
        return { ok: false, code: (j && j.code) || 'UNEXPECTED', message: (j && j.message) || 'Something went wrong.' };
      }).catch(function () { return { ok: false, code: 'NETWORK', message: 'Could not reach the records right now. Try again in a moment.' }; });
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
      var chain = Promise.resolve({ ok: true });
      keys.forEach(function (k) {
        chain = chain.then(function (prev) {
          if (!prev.ok) return prev;
          return read(k).then(function (r) {
            if (r.ok) { out[k] = r.rows; return { ok: true }; }
            if (optionalSet[k] && (r.code === 'NOT_ALLOWED' || r.code === 'FILE_MISSING' || r.code === 'FILE_NOT_ALLOWED'))   /* FILE_NOT_ALLOWED: the script does not know this list yet */ { out[k] = []; return { ok: true }; }
            return r;
          });
        });
      });
      return chain.then(function (r) { return r.ok ? { ok: true, tables: out } : r; });
    }

    /**
     * Optional: read the Script URL from a small Drive file Lisa owns, so every signed-in device
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
      banner: banner, validate: validate, submit: submit, newRequestId: newRequestId,
      sending: function () { return sending; },
      loadConfigFromDrive: loadConfigFromDrive,
      act: act, linkAdd: linkAdd, linkEnd: linkEnd,
      read: read, readMany: readMany, codeCheck: codeCheck, canRead: function () { return !!scriptUrl && status.reachable === true && !!status.readEnabled; }
    };
  }

  return { create: create, TABLES: TABLES, URL_OK: URL_OK, ownerToken: ownerToken, ownerSkip: ownerSkip };
}));
