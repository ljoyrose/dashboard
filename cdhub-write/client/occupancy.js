(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./needs.js'));
  else root.BLDOccupancy = factory(root.BLDNeeds);
}(typeof self !== 'undefined' ? self : this, function (N) {
  'use strict';
  N = N || { coversDay: function () { return true; }, today: function () { return new Date().toLocaleDateString('en-CA', { timeZone: ((typeof self !== 'undefined' && self.BLD_TZ) || 'Europe/London') }); } };

  // Permanently not on site (the owner 16 Oct, S02-7): sold, owned_by_family, Collected, deceased. Never asked to move.
  var GONE_KIND = { sold: true, owned_by_family: true, deceased: true };
  var GONE_STATE = { sold: true, collected: true, deceased: true };
  var AWAY_STATE = 'off_site_temp';

  /**
   * Is room `a` in use on `day`? From BLD-requirement rows (need_type room.in_use, target_table area): a room with no
   * rows is in use; one with rows only on days a row covers (the owner 11 Nov 2026). Rows are never deleted; a retired
   * room is hidden after its last day and still shows in History.
   */
  function inUse(a, day, reqRows) { return !!a && N.coversDay(reqRows, 'room.in_use', 'area', a.id, day || N.today()); }
  function latestRow(rows, subjectId) {
    var best = null, bestKey = '', bestIdx = -1;
    for (var i = 0; i < (rows || []).length; i++) {
      var r = rows[i];
      if (r.subject_id !== subjectId) continue;
      var key = r.moved_in || '';
      if (best === null || key > bestKey || (key === bestKey && i >= bestIdx)) { best = r; bestKey = key; bestIdx = i; }
    }
    return best;
  }

  function offSite(row) {
    if (!row) return false;
    var cls = String(row.classification || '').toLowerCase();
    return !!GONE_KIND[String(row.off_site_kind || '').toLowerCase()] || cls === 'collected' || cls === 'deceased';
  }

  function dailyList(T, day) {
    T = T || {};
    day = day || N.today();
    var areas = (T.area || []).filter(function (a) { return inUse(a, day, T.requirement); }).map(function (a) {
      return { id: a.id, label: a.code || a.id, group: a.grouping || '', sort: parseFloat(a.group_sort) || 0 };
    });
    var areaById = {};
    areas.forEach(function (a) { areaById[a.id] = a; });
    var state = {};
    (T.subject_status || []).forEach(function (s) { state[s.subject_id] = String(s.state || ''); });
    var dogs = [], skipped = 0;
    (T.subject || []).forEach(function (s) {
      var st = state[s.id] !== undefined ? state[s.id].toLowerCase() : null;
      if (st !== null && GONE_STATE[st]) return;
      var row = latestRow(T.occupancy, s.id);
      if (offSite(row)) return;
      if (!row && st === null) { skipped++; return; }
      var a = row && row.area_id ? areaById[row.area_id] : null;
      var out = !!row && String(row.off_site_kind || '').toLowerCase() === 'temporary';   // latest row says Off-site: no room
      dogs.push({
        id: s.id, label: s.name || s.id,
        areaId: a ? a.id : '', areaLabel: a ? a.label : '', known: !!a,
        lastMovedIn: row ? (row.moved_in || '') : '',
        away: st === AWAY_STATE || out, out: out
      });
    });
    dogs.sort(function (x, y) {
      if (!!x.away !== !!y.away) return x.away ? 1 : -1;
      if (x.known !== y.known) return x.known ? 1 : -1;
      var ax = x.known ? areaById[x.areaId].sort : 0, ay = y.known ? areaById[y.areaId].sort : 0;
      if (ax !== ay) return ax - ay;
      if (x.areaLabel !== y.areaLabel) return x.areaLabel < y.areaLabel ? -1 : 1;
      return x.label < y.label ? -1 : x.label > y.label ? 1 : 0;
    });
    return { dogs: dogs, skipped: skipped, areas: areas };
  }

  /**
   * Load the daily list through the script with the staff code (no Google sign-in), as far as the owner has allowed.
   * @param {Object} save a BLDSave instance
   * @return {Promise<{ok:true, lookups:{areas,dogs,subjects,dogsSkipped}} | {ok:false, message}>}
   */
  function loadViaScript(save) {
    return save.readMany(['area', 'subject', 'occupancy', 'subject_status', 'requirement'], ['requirement']).then(function (r) {
      if (!r.ok) return { ok: false, message: r.message || 'Could not load the dogs.' };
      var t = r.tables, d = dailyList({ area: t.area, subject: t.subject, subject_status: t.subject_status, occupancy: t.occupancy, requirement: t.requirement });
      return { ok: true, lookups: {
        areas: d.areas, dogs: d.dogs, dogsSkipped: d.skipped,
        subjects: (t.subject || []).map(function (x) { return { id: x.id, label: x.name || x.id }; })
      } };
    });
  }

  return { latestRow: latestRow, offSite: offSite, inUse: inUse, dailyList: dailyList, loadViaScript: loadViaScript };
}));

