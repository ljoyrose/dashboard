/*!
 * BLDOccupancy - who is on site and which room each dog was last recorded in.
 *
 * Pure functions, no network, no Drive. Works in a browser (window.BLDOccupancy) and in Node.
 * It mirrors the rule in apps-script/Specs.gs (occupancyLatest_): occupancy rows are NEVER edited, a move
 * adds a new row, and the current room is the row with the latest moved_in (a row with no moved_in ranks
 * below any dated row; a tie goes to the later row in the file).
 *
 * Input tables use design names:  { area:[], subject:[], subject_status:[], occupancy:[] }
 * (BLDLookups.fromTables maps the BLD-*.csv names to these).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDOccupancy = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GONE_KIND = { sold: true, owned_by_family: true };
  var GONE_STATE = { sold: true, collected: true };

  /** Latest occupancy row for one dog, or null. */
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

  /** Is a dog off site according to its latest row? */
  function offSite(row) {
    if (!row) return false;
    return !!GONE_KIND[String(row.off_site_kind || '').toLowerCase()] || String(row.classification || '').toLowerCase() === 'collected';
  }

  /**
   * The daily list: every dog on site, with the room it was last recorded in.
   * A dog is NOT listed when its latest occupancy row says sold / owned_by_family / collected, or when
   * its status says Sold / Collected. A dog with no occupancy row at all is listed (room not recorded)
   * only when a status row says it is not sold or collected; otherwise it is counted in `skipped`.
   * @return {{dogs:Array<{id,label,areaId,areaLabel,known,lastMovedIn}>, skipped:number, areas:Array}}
   */
  function dailyList(T) {
    T = T || {};
    var areas = (T.area || []).map(function (a) {
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
      dogs.push({
        id: s.id, label: s.name || s.id,
        areaId: a ? a.id : '', areaLabel: a ? a.label : '', known: !!a,
        lastMovedIn: row ? (row.moved_in || '') : ''
      });
    });
    // dogs whose room is not recorded come first (they need a person to pick), then by room, then name
    dogs.sort(function (x, y) {
      if (x.known !== y.known) return x.known ? 1 : -1;
      var ax = x.known ? areaById[x.areaId].sort : 0, ay = y.known ? areaById[y.areaId].sort : 0;
      if (ax !== ay) return ax - ay;
      if (x.areaLabel !== y.areaLabel) return x.areaLabel < y.areaLabel ? -1 : 1;
      return x.label < y.label ? -1 : x.label > y.label ? 1 : 0;
    });
    return { dogs: dogs, skipped: skipped, areas: areas };
  }

  /**
   * Load the daily list through the script with the staff code (no Google sign-in), as far as Lisa has allowed.
   * @param {Object} save a BLDSave instance
   * @return {Promise<{ok:true, lookups:{areas,dogs,subjects,dogsSkipped}} | {ok:false, message}>}
   */
  function loadViaScript(save) {
    return save.readMany(['area', 'subject', 'occupancy', 'subject_status']).then(function (r) {
      if (!r.ok) return { ok: false, message: r.message || 'Could not load the dogs.' };
      var t = r.tables, d = dailyList({ area: t.area, subject: t.subject, subject_status: t.subject_status, occupancy: t.occupancy });
      return { ok: true, lookups: {
        areas: d.areas, dogs: d.dogs, dogsSkipped: d.skipped,
        subjects: (t.subject || []).map(function (x) { return { id: x.id, label: x.name || x.id }; })
      } };
    });
  }

  return { latestRow: latestRow, offSite: offSite, dailyList: dailyList, loadViaScript: loadViaScript };
}));
