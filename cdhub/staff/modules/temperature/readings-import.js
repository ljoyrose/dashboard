/*!
 * BLDTempImport - bring paper or spreadsheet temperature readings into BLD-area_reading (owner only).
 *
 * the owner, 22 Nov 2026 ("yes please add now"): the round lost the readings after 14:44 (the sign-in ran out) and she has
 * them on paper. One row per room, thermometer and slot. Columns:
 *   date        2026-11-22 or 22/11/2026
 *   room        the room's code as on the round (3A.1/2)
 *   thermometer its name; may be blank when the room has one thermometer (or none)
 *   slot        overnight (morning, am) or day (afternoon, pm): the round's period_start, 00:00 or 12:00 London time
 *   min, max    degrees C, at most 1 decimal (a comma decimal is a point); both, or neither with room_empty yes
 *   room_empty  yes, or blank
 *   note        optional; saved as the reading's note (what was done)
 * Every row is checked first and shown with its reason. Nothing is saved until the owner presses "Import N rows", and
 * then one row at a time through the save script, as the round saves. A slot already filled is skipped, so the same
 * file imported twice saves nothing twice. A row a week or more old, or an unusual temperature the owner has seen in
 * the preview, is sent with confirm_unusual yes (the script's "save anyway"; never stored).
 * Pure functions only; module.js draws the screen. Loaded only when the owner opens it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDTempImport = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TEMP_MIN = -30, TEMP_MAX = 60;
  var SLOT = { overnight: '00', night: '00', morning: '00', am: '00', day: '12', afternoon: '12', pm: '12' };

  function csvRows(text) {
    var rows = [], row = [], cell = '', q = false, t = String(text || '').replace(/^﻿/, '');
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (q) { if (ch === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
      if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim(); }); });
  }
  function pad(y, mo, d) {
    var iso = y + '-' + ('0' + mo).slice(-2) + '-' + ('0' + d).slice(-2), t = new Date(iso + 'T12:00:00Z');
    return isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== iso ? '' : iso;
  }
  function isoOf(d) {
    d = String(d || '').trim(); var m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(d))) return pad(m[1], m[2], m[3]);
    if ((m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/.exec(d))) return pad(m[3].length === 2 ? '20' + m[3] : m[3], m[2], m[1]);
    return '';
  }
  function temp(v) {
    v = String(v == null ? '' : v).trim().replace(',', '.');
    if (v === '') return '';
    return /^-?\d{1,2}(\.\d)?$/.test(v) ? parseFloat(v).toFixed(1) : null;
  }
  function low(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function slotId(s) { s = String(s || ''); return /^\d{4}-\d{2}-\d{2}[T ]\d{2}/.test(s) ? s.slice(0, 10) + ' ' + s.slice(11, 13) : s; }

  function parse(o, text) {
    var rows = csvRows(text), out = [], seen = {}, filled = {};
    var areas = o.areas || [], thermos = o.thermos || [];
    var byRoom = {};
    areas.forEach(function (a) { [a.code, a.label, a.id].forEach(function (k) { if (k && !byRoom[low(k)]) byRoom[low(k)] = a; }); });
    var thermoKey = function (areaId, thermoId) { return areaId + '|' + (thermoId || ''); };
    (o.readings || []).forEach(function (r) {
      if (r.corrects_id) return;
      var mine = thermos.filter(function (t) { return t.area_id === r.area_id; });
      var tid = r.thermometer_id || (mine.length === 1 ? mine[0].id : '');
      filled[thermoKey(r.area_id, tid) + '|' + slotId(r.period_start)] = 1;
    });
    var week = new Date(Date.parse(o.today + 'T12:00:00Z') - 7 * 864e5).toISOString().slice(0, 10);
    var head = -1;
    for (var h = 0; h < Math.min(rows.length, 5); h++) {
      var cells = rows[h].map(low);
      if (cells.indexOf('date') >= 0 && cells.indexOf('room') >= 0) { head = h; break; }
    }
    var col = { date: 0, room: 1, thermometer: 2, slot: 3, min: 4, max: 5, room_empty: 6, note: 7 };
    if (head >= 0) {
      var names = rows[head].map(low);
      Object.keys(col).forEach(function (k) { var i = names.indexOf(k); if (i >= 0) col[k] = i; });
      rows = rows.slice(head + 1);
    }
    rows.forEach(function (r, i) {
      var get = function (k) { return String(r[col[k]] == null ? '' : r[col[k]]).trim(); };
      var x = { line: i + 1, date: get('date'), room: get('room'), thermometer: get('thermometer'), slot: get('slot'),
        min: get('min'), max: get('max'), note: get('note'), ok: false, why: '', warn: '' };
      x.iso = isoOf(x.date);
      var area = byRoom[low(x.room)], hh = SLOT[low(x.slot)];
      var mine = area ? thermos.filter(function (t) { return t.area_id === area.id; }) : [];
      var thermo = x.thermometer ? mine.filter(function (t) { return low(t.name) === low(x.thermometer) || low(t.id) === low(x.thermometer); })[0] : (mine.length === 1 ? mine[0] : null);
      var empty = low(get('room_empty')), mn = temp(x.min), mx = temp(x.max);
      if (!x.iso) x.why = 'date not understood (use 2026-11-22 or 22/11/2026)';
      else if (!area) x.why = 'room not found: use its code as on the round';
      else if (x.thermometer && !thermo) x.why = (thermos.some(function (t) { return low(t.name) === low(x.thermometer); }) ? 'that thermometer is in another room' : 'thermometer not found');
      else if (!x.thermometer && mine.length > 1) x.why = 'this room has ' + mine.length + ' thermometers: say which';
      else if (!hh) x.why = 'slot not understood (overnight or day)';
      else if (x.iso > o.today || (x.iso === o.today && hh === '12' && o.nowHour < 12)) x.why = 'a future slot';
      else if (empty && empty !== 'yes') x.why = 'room empty: yes or blank';
      else if (mn === null || mx === null) x.why = 'a temperature not understood (e.g. 18.5)';
      else if (empty !== 'yes' && (mn === '' || mx === '')) x.why = 'both lowest and highest are needed';
      else if ((mn === '') !== (mx === '')) x.why = 'fill in both lowest and highest, or neither';
      else if (mn !== '' && parseFloat(mn) > parseFloat(mx)) x.why = 'lowest is higher than highest';
      else {
        x.areaId = area.id; x.roomCode = area.code || area.label || area.id; x.thermoId = thermo ? thermo.id : ''; x.thermoName = thermo ? (thermo.name || thermo.id) : '';
        x.hh = hh; x.periodStart = o.londonIso(x.iso, hh); x.minC = mn; x.maxC = mx; x.empty = empty === 'yes';
        var key = thermoKey(area.id, x.thermoId) + '|' + x.iso + ' ' + hh;
        if (filled[key]) x.why = 'already recorded for that slot';
        else if (seen[key]) x.why = 'repeated in this file';
        else {
          x.ok = true; seen[key] = 1;
          x.past = x.iso < week;
          if ([mn, mx].some(function (v) { return v !== '' && (parseFloat(v) < TEMP_MIN || parseFloat(v) > TEMP_MAX); })) x.warn = 'unusual: outside ' + TEMP_MIN + ' to ' + TEMP_MAX + ' C, will be saved as typed';
        }
      }
      out.push(x);
    });
    return out;
  }

  function fields(x) {
    var f = { area_id: x.areaId, period_start: x.periodStart, read_method: 'typed' };
    if (x.thermoId) f.thermometer_id = x.thermoId;
    if (x.minC !== '') { f.min_c = x.minC; f.max_c = x.maxC; }
    if (x.empty) f.room_empty = 'yes';
    if (x.note) f.mitigation_note = x.note;
    if (x.past || x.warn) f.confirm_unusual = 'yes';
    return f;
  }
  function requestId(x) { return 'rimp-' + x.areaId + '-' + (x.thermoId || 'room') + '-' + x.iso + '-' + x.hh; }

  function template(o) {
    var y = new Date(Date.parse(o.today + 'T12:00:00Z') - 864e5).toISOString().slice(0, 10), lines = ['date,room,thermometer,slot,min,max,room_empty,note'];
    var q = function (s) { s = String(s == null ? '' : s); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    (o.areas || []).forEach(function (a) {
      var mine = (o.thermos || []).filter(function (t) { return t.area_id === a.id; });
      (mine.length ? mine : [null]).forEach(function (t) { lines.push([y, q(a.code || a.label), q(t ? t.name : ''), 'overnight', '', '', '', ''].join(',')); });
    });
    return lines.join('\r\n') + '\r\n';
  }

  return { parse: parse, fields: fields, requestId: requestId, template: template, isoOf: isoOf, temp: temp, slotId: slotId, TEMP_MIN: TEMP_MIN, TEMP_MAX: TEMP_MAX };
}));

