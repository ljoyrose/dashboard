/*!
 * BLDLookups - READ-ONLY loader for the lists the screens need (rooms, dogs, people, bands).
 *
 * This is a small stand-in for the Drive sign-in and CSV reading that the live CD Hub already has
 * (cdhub/index.html). A shell that already has that (the Bloodline redesign, The Board) should pass
 * its own loaded tables to BLDLookups.fromTables() instead and skip the sign-in here.
 *
 * Scope is drive.readonly only. No write scope is ever requested. The Google client id and folder id
 * come from window.BLD_CONFIG (see config.example.js), never from this file.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./bands.js'));
  else root.BLDLookups = factory(root.BLDBands);
}(typeof self !== 'undefined' ? self : this, function (Bands) {
  'use strict';

  var SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
  var NEED = ['BLD-area.csv', 'BLD-subject.csv', 'BLD-occupancy.csv', 'BLD-person.csv', 'BLD-temperature_band.csv', 'BLD-temperature_action.csv'];

  function parseCsv(text) {
    var rows = [], row = [], f = '', q = false, i = 0, n = text.length;
    if (n && text.charCodeAt(0) === 0xFEFF) i = 1;
    for (; i < n; i++) {
      var c = text.charAt(i);
      if (q) { if (c === '"') { if (text.charAt(i + 1) === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"' && f === '') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\r' || c === '\n') { if (c === '\r' && text.charAt(i + 1) === '\n') i++; row.push(f); f = ''; rows.push(row); row = []; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    rows = rows.filter(function (r) { return !(r.length === 1 && r[0] === ''); });
    if (!rows.length) return [];
    var h = rows[0];
    return rows.slice(1).map(function (r) { var o = {}; h.forEach(function (k, j) { o[k] = r[j] === undefined ? '' : r[j]; }); return o; });
  }

  /**
   * Turn loaded tables ({'BLD-area.csv':[records]...}) into what the screens need.
   * Honest about gaps: most occupancy rows have a blank area_id, so most rooms will have NO dogs
   * recorded and bandForArea says "room unknown" rather than guessing.
   */
  function fromTables(T, onIso) {
    var areas = (T['BLD-area.csv'] || []).map(function (a) {
      return { id: a.id, label: a.code || a.id, group: a.grouping || '', sort: parseFloat(a.group_sort) || 0 };
    });
    var subj = {};
    (T['BLD-subject.csv'] || []).forEach(function (s) { subj[s.id] = s; });
    var dogsByArea = {};
    (T['BLD-occupancy.csv'] || []).forEach(function (o) {
      if (!o.area_id || o.moved_out) return;
      var s = subj[o.subject_id];
      (dogsByArea[o.area_id] = dogsByArea[o.area_id] || []).push({ id: o.subject_id, dob: s ? s.dob : '' });
    });
    var bands = Bands.parseBands(T['BLD-temperature_band.csv'] || []);
    var actions = Bands.parseActions(T['BLD-temperature_action.csv'] || []);
    var people = (T['BLD-person.csv'] || []).map(function (p) { return { id: p.id, label: p.known_as || p.full_name || p.id }; });
    return {
      areas: areas, people: people, bands: bands, actions: actions,
      subjects: (T['BLD-subject.csv'] || []).map(function (s) { return { id: s.id, label: s.name || s.id }; }),
      bandForArea: function (areaId) { return Bands.bandFor(dogsByArea[areaId] || [], onIso, bands); },
      actionFor: function (v) { return Bands.actionFor(v, actions); },
      roomsWithDogs: Object.keys(dogsByArea).length,
      missing: NEED.filter(function (t) { return !T[t]; })
    };
  }

  /** Sign in (readonly) and read the tables. Resolves {ok, lookups|message}. */
  function loadFromDrive(cfg, onIso) {
    return new Promise(function (resolve) {
      if (!cfg || !cfg.clientId || !cfg.folderId) { resolve({ ok: false, message: 'No Google client id or folder id is configured (config.js), so the room list cannot be read.' }); return; }
      if (typeof google === 'undefined' || !google.accounts) { resolve({ ok: false, message: 'Google sign-in did not load.' }); return; }
      var tc = google.accounts.oauth2.initTokenClient({
        client_id: cfg.clientId, scope: SCOPE,
        callback: function (resp) {
          if (resp.error || !google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE)) { resolve({ ok: false, message: 'Drive read access was not granted.' }); return; }
          readAll(resp.access_token, cfg.folderId).then(function (T) { resolve({ ok: true, lookups: fromTables(T, onIso), token: resp.access_token }); })
            .catch(function (e) { resolve({ ok: false, message: String(e && e.message || e) }); });
        }
      });
      tc.requestAccessToken({ prompt: '' });
    });
  }

  function readAll(token, folderId) {
    var h = { headers: { Authorization: 'Bearer ' + token } };
    var q = "'" + folderId + "' in parents and trashed = false";
    return fetch('https://www.googleapis.com/drive/v3/files?pageSize=200&fields=files(id,name)&q=' + encodeURIComponent(q), h)
      .then(function (r) { if (!r.ok) throw new Error('Drive said ' + r.status); return r.json(); })
      .then(function (j) {
        var by = {}; (j.files || []).forEach(function (f) { (by[f.name] = by[f.name] || []).push(f); });
        var T = {};
        return Promise.all(NEED.map(function (t) {
          var f = by[t];
          if (!f) return null;
          if (f.length > 1) throw new Error('There are two files called ' + t + ' in the folder. Fix that first (same rule as CD Hub).');
          return fetch('https://www.googleapis.com/drive/v3/files/' + f[0].id + '?alt=media', h)
            .then(function (r) { return r.text(); }).then(function (txt) { T[t] = parseCsv(txt); });
        })).then(function () { return T; });
      });
  }

  return { fromTables: fromTables, loadFromDrive: loadFromDrive, parseCsv: parseCsv, NEED: NEED, SCOPE: SCOPE };
}));
