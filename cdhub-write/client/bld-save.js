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

  var URL_OK = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_\-]+\/exec$/;
  var URL_KEY = 'bld.scriptUrl';
  var CODE_KEY = 'bld.staffCode';
  var TIMEOUT_MS = 20000;

  /* ----- mirror of the server rules, for instant feedback only. The server is the judge. ----- */
  var TEMP_RE = /^-?\d{1,2}(\.\d{1,2})?$/;
  var TABLES = {
    area_reading: {
      label: 'Room temperatures', file: 'BLD-area_reading.csv',
      fields: {
        area_id: { type: 'ref', lookup: 'area', required: true, label: 'Room' },
        min_c: { type: 'temp', required: true, label: 'Lowest (min) C' },
        max_c: { type: 'temp', required: true, label: 'Highest (max) C' },
        spot_c: { type: 'temp', label: 'Spot reading C' },
        mitigation_note: { type: 'text', label: 'What was done about it' }
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
      label: 'Daily location check', file: 'BLD-occupancy_check.csv',
      fields: {
        subject_id: { type: 'ref', lookup: 'subject', required: true, label: 'Dog' },
        area_id: { type: 'ref', lookup: 'area', required: true, label: 'Room' },
        result: { type: 'enum', values: ['same', 'moved'], required: true, label: 'Same or moved' }
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

    function setCode(c, keepForTab) { c = String(c || '').trim(); if (keepForTab !== false) put(session, CODE_KEY, c); inMemoryCode = c; }
    var inMemoryCode = get(session, CODE_KEY);
    function getCode() { return inMemoryCode; }
    function clearCode() { inMemoryCode = ''; put(session, CODE_KEY, ''); }

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
      if (tb && tb.mode !== 'direct') return { kind: 'pending', canSave: true, text: 'Saving is on. What you send goes into the approvals queue until Lisa approves it; then it joins the records.' };
      return { kind: 'on', canSave: true, text: 'Saving is on. What you send is added to the records straight away. It cannot be edited afterwards, only corrected.' };
    }

    /** Check the fields on the page. */
    function validate(tableKey, fields) {
      var spec = TABLES[tableKey], errors = {};
      if (!spec) return { ok: false, errors: { _: 'Unknown table.' } };
      Object.keys(spec.fields).forEach(function (name) {
        var def = spec.fields[name], raw = fields[name], v = (raw === undefined || raw === null) ? '' : String(raw).trim();
        if (v === '') { if (def.required) errors[name] = 'This is needed.'; return; }
        if (def.type === 'temp') {
          if (!TEMP_RE.test(v)) errors[name] = 'Type degrees C with at most 2 decimals, e.g. 21.47.';
          else if (parseFloat(v) < -30 || parseFloat(v) > 60) errors[name] = 'That is outside -30 to 60 C. Check the number.';
        } else if (def.type === 'text') {
          if (v.length > 500) errors[name] = 'Too long (500 characters at most).';
          else if (/^[=+\-@\t]/.test(v)) errors[name] = 'Please do not start with = + - or @.';
        } else if (def.type === 'enum') {
          if (def.values.indexOf(v) < 0) errors[name] = 'Choose one of: ' + def.values.join(', ') + '.';
        } else if (def.type === 'date') {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) errors[name] = 'Use a date as YYYY-MM-DD.';
        } else if (def.type === 'ref') {
          if (lookupSize(def.lookup) === 0) errors[name] = 'The ' + def.lookup + ' list is not loaded, so this cannot be checked.';
          else if (!hasId(lookups[def.lookup], v)) errors[name] = 'Not found in the ' + def.lookup + ' list.';
        }
      });
      if (!errors.min_c && !errors.max_c && fields.min_c !== undefined && fields.max_c !== undefined &&
          String(fields.min_c).trim() !== '' && String(fields.max_c).trim() !== '' &&
          parseFloat(fields.min_c) > parseFloat(fields.max_c)) {
        errors.min_c = 'The lowest cannot be higher than the highest.';
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
      if (!getCode()) return Promise.resolve({ ok: false, code: 'NO_CODE', message: 'Enter your staff code.' });
      var v = validate(tableKey, fields);
      if (!v.ok) return Promise.resolve({ ok: false, code: 'INVALID', message: 'Some details need fixing before this can be sent.', fields: v.errors });
      var action = o.action === 'correct' ? 'correct' : 'add';
      var body = {
        v: 1, request_id: o.requestId || newRequestId(), code: getCode(), table: tableKey, action: action, fields: fields
      };
      if (action === 'correct') { body.corrects_id = o.correctsId || ''; body.reason = o.reason || ''; }
      if (!doFetch) return Promise.resolve({ ok: false, code: 'NETWORK', message: 'This browser cannot send the save.' });
      return withTimeout(doFetch(scriptUrl, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // keeps it a "simple" request: no pre-flight needed
        body: JSON.stringify(body)
      })).then(function (r) { return r.json(); }).then(function (j) {
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
     * Read one list through the script, as far as Lisa has allowed THIS staff code (no Google sign-in).
     * Resolves (never rejects): {ok:true, table, fields, rows, count, scope} or {ok:false, code, message}.
     * Nothing is cached or kept: the rows live only in the page.
     */
    function read(tableKey) {
      if (!scriptUrl) return Promise.resolve({ ok: false, code: 'READ_OFF', message: 'Reading is off. Lisa switches it on when it is ready.' });
      if (status.checked && status.reachable && !status.readEnabled) return Promise.resolve({ ok: false, code: 'READ_OFF', message: 'Reading from the records is switched off.' });
      if (!getCode()) return Promise.resolve({ ok: false, code: 'NO_CODE', message: 'Enter your staff code.' });
      if (!doFetch) return Promise.resolve({ ok: false, code: 'NETWORK', message: 'This browser cannot reach the records.' });
      return withTimeout(doFetch(scriptUrl, {
        method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ v: 1, action: 'read', code: getCode(), table: tableKey })
      })).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok && j.result) { var res = j.result; res.ok = true; return res; }
        return { ok: false, code: (j && j.code) || 'UNEXPECTED', message: (j && j.message) || 'Something went wrong.' };
      }).catch(function () { return { ok: false, code: 'NETWORK', message: 'Could not reach the records right now. Try again in a moment.' }; });
    }

    /**
     * Read the lists the daily location check needs. area, subject and occupancy are required;
     * subject_status is optional (the check still works without it). Resolves {ok, tables} or {ok:false, message}.
     */
    function readMany(keys, optional) {
      var out = {}, optionalSet = {};
      (optional || ['subject_status']).forEach(function (k) { optionalSet[k] = true; });
      var chain = Promise.resolve({ ok: true });
      keys.forEach(function (k) {
        chain = chain.then(function (prev) {
          if (!prev.ok) return prev;
          return read(k).then(function (r) {
            if (r.ok) { out[k] = r.rows; return { ok: true }; }
            if (optionalSet[k] && (r.code === 'NOT_ALLOWED' || r.code === 'FILE_MISSING')) { out[k] = []; return { ok: true }; }
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
      setCode: setCode, getCode: getCode, clearCode: clearCode,
      setLookups: setLookups, lookupSize: lookupSize,
      checkStatus: checkStatus, status: function () { return status; },
      banner: banner, validate: validate, submit: submit, newRequestId: newRequestId,
      loadConfigFromDrive: loadConfigFromDrive,
      read: read, readMany: readMany, canRead: function () { return !!scriptUrl && status.reachable === true && !!status.readEnabled; }
    };
  }

  return { create: create, TABLES: TABLES, URL_OK: URL_OK };
}));
