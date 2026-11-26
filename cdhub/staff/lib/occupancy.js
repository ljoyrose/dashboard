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
  function takesDogs(a, day, reqRows) { return !!a && !N.coversDay(reqRows, 'room.no_dogs', 'area', a.id, day || N.today(), { absentIs: false }); }
  /**
   * Is room `areaId` empty all day on `day`? A BLD-requirement row with need_type room.empty (target_table area), dated
   * like every need row (the owner 18 Nov 2026: "mark h2 (iso) as empty since 01/01/25 ... temps can stay in records just
   * hide them"). No such row = not marked empty. Not the same as room.no_dogs: a corridor takes no dogs but its
   * temperatures still show.
   */
  function emptyOn(areaId, day, reqRows) { return !!areaId && N.coversDay(reqRows, 'room.empty', 'area', areaId, day || N.today(), { absentIs: false }); }
  function hideEmpty(readings, reqRows, dayOf) {
    var has = (reqRows || []).some(function (r) { return r && r.need_type === 'room.empty'; });
    if (!has) return readings || [];
    dayOf = dayOf || function (r) { return String(r.period_start || r.taken_at || '').slice(0, 10); };
    return (readings || []).map(function (r) {
      if (!r || !emptyOn(r.area_id, dayOf(r), reqRows)) return r;
      var c = {}; Object.keys(r).forEach(function (k) { c[k] = r[k]; });
      c.min_c = ''; c.max_c = ''; c.spot_c = ''; c.mitigation_note = ''; c.room_empty = 'yes'; c.empty_by_rule = 'yes';
      return c;
    });
  }
  function takesOvernight(a, day, reqRows) {
    return takesDogs(a, day, reqRows) && !N.coversDay(reqRows, 'room.no_overnight', 'area', a.id, day || N.today(), { absentIs: false });
  }
  function recordOn(rows, subjectId, day) {
    day = String(day || '').slice(0, 10);
    var best = null, bestKey = '', bestIdx = -1;
    for (var i = 0; i < (rows || []).length; i++) {
      var r = rows[i];
      if (r.subject_id !== subjectId) continue;
      var mi = String(r.moved_in || '').slice(0, 10);
      if (mi && day && mi > day) continue;
      var key = mi || '';
      if (best === null || key > bestKey || (key === bestKey && i >= bestIdx)) { best = r; bestKey = key; bestIdx = i; }
    }
    return best;
  }
  function rowOn(rows, subjectId, day) {
    var best = recordOn(rows, subjectId, day);
    if (!best) return null;
    var mo = String(best.moved_out || '').slice(0, 10);
    if (mo && day && mo < day) return null;
    if (!best.area_id || offSite(best)) return null;
    if (String(best.off_site_kind || '').toLowerCase() === 'temporary') return null;
    return best;
  }
  function inArea(rows, areaId, day) {
    var seen = {}, ids = [];
    (rows || []).forEach(function (r) {
      if (!r.subject_id || seen[r.subject_id]) return;
      seen[r.subject_id] = 1;
      var row = rowOn(rows, r.subject_id, day);
      if (row && row.area_id === areaId) ids.push(r.subject_id);
    });
    return ids;
  }
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

  /**
   * The daily list: every dog on site, with the room it was last recorded in.
   * A dog is NOT listed when its latest occupancy row says sold / owned_by_family / collected / deceased, or when
   * its status says Sold / Collected / Deceased. A dog whose status is off_site_temp IS listed, flagged `away: true`
   * (as is one whose latest occupancy row has off_site_kind temporary, also flagged `out: true`, shown as Off-site):
   * it keeps its room and is not asked to move. A dog with no occupancy row at all is listed (room not recorded)
   * only when a status row says it is not sold or collected; otherwise it is counted in `skipped`.
   * @return {{dogs:Array<{id,label,areaId,areaLabel,known,lastMovedIn,away}>, skipped:number, areas:Array}}
   */
  /** One room name everywhere (the owner 12 Nov 2026): the code, without a retired room's ZZ_ mark, and "Isolation" after the
   *  isolation room (its use starts with "Isolation", e.g. H2). Matching is by id, never by this text. */
  function roomName(a) {
    var c = String((a && (a.code || a.id)) || '').replace(/^ZZ_/, '');
    return /^\s*isolation\b/i.test(String((a && a.use) || '')) && !/isolation|\biso\b/i.test(c) ? c + ' Isolation' : c;
  }
  /** Room order (the owner 12 Nov 2026): the area's own group_sort first, then its code in natural order (3B.4/5 before 3B.9/10).
   *  No list in code: a new group or room sorts by its row. A room with no group_sort goes last. */
  function byPlace(a, b) {
    var x = a.sort || Infinity, y = b.sort || Infinity;
    if (x !== y) return x < y ? -1 : 1;
    return String(a.label).localeCompare(String(b.label), 'en', { numeric: true, sensitivity: 'base' });
  }
  function dailyList(T, day) {
    T = T || {};
    day = day || N.today();
    var areas = (T.area || []).filter(function (a) { return inUse(a, day, T.requirement); }).map(function (a) {
      return { id: a.id, label: roomName(a), group: a.grouping || '', sort: parseFloat(a.group_sort) || 0, dogs: takesDogs(a, day, T.requirement) };
    }).sort(byPlace);
    var areaById = {};
    areas.forEach(function (a) { areaById[a.id] = a; });
    var state = {};
    (T.subject_status || []).forEach(function (s) { state[s.subject_id] = String(s.state || ''); });
    var dogs = [], skipped = 0;
    (T.subject || []).forEach(function (s) {
      var st = state[s.id] !== undefined ? state[s.id].toLowerCase() : null;
      if (st !== null && GONE_STATE[st]) return;
      var row = recordOn(T.occupancy, s.id, day);
      if (offSite(row)) return;
      var mo = row ? String(row.moved_out || '').slice(0, 10) : '';
      if (mo && day && mo < day) row = null;
      if (!row && st === null) { skipped++; return; }
      var a = row && row.area_id ? areaById[row.area_id] : null;
      var out = !!row && String(row.off_site_kind || '').toLowerCase() === 'temporary';   // in-force row says Off-site: no room
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

  return { roomName: roomName, latestRow: latestRow, recordOn: recordOn, rowOn: rowOn, inArea: inArea, offSite: offSite, inUse: inUse, takesDogs: takesDogs, emptyOn: emptyOn, hideEmpty: hideEmpty, takesOvernight: takesOvernight, dailyList: dailyList, loadViaScript: loadViaScript };
}));

