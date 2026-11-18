/*!
 * BLDThermometer - which thermometers are needed on a day (Lisa 11 Nov 2026).
 * A thermometer row has no dates (id, name, area_id). When it is needed comes from BLD-requirement rows with
 * need_type reading.temperature, target_table thermometer (BLDNeeds.coversDay): no rows = always needed.
 * After its last day it drops out of today's round and the print list, but its records stay, and a late reading
 * for a day it was needed is still entered: ask neededOn(t, readingDay, req), never today.
 * Pure functions; works in a browser (window.BLDThermometer, after needs.js) and in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./needs.js'));
  else root.BLDThermometer = factory(root.BLDNeeds);
}(typeof self !== 'undefined' ? self : this, function (N) {
  'use strict';
  var NEED = 'reading.temperature', TABLE = 'thermometer';
  function day(v) { var s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  /** True when thermometer `t` is needed on `on` (YYYY-MM-DD). reqRows = BLD-requirement rows. */
  function neededOn(t, on, reqRows) { return !!t && !!day(on) && N.coversDay(reqRows, NEED, TABLE, t.id, on); }
  /** The thermometers needed on `on`, A-Z by name. */
  function neededList(rows, on, reqRows) {
    return (rows || []).filter(function (t) { return neededOn(t, on, reqRows); })
      .sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
  }
  /**
   * The thermometers to flag for no reading on `on`: needed that day, and no area_reading row for its place on that
   * day (the day of period_start, else of taken_at). Any row counts, a room_empty row with no temperatures too.
   * A thermometer outside its need rows is never flagged.
   */
  // A reading covers thermometer t when it names t (thermometer_id), or names none and t is the only thermometer in its
  // room (older rows, the CD Hub round). Any row counts, a Room empty one too (Lisa 11 Nov 2026).
  function missingOn(rows, readings, on, reqRows) {
    var perRoom = {}, byId = {}, byRoom = {};
    (rows || []).forEach(function (t) { if (t) perRoom[t.area_id] = (perRoom[t.area_id] || 0) + 1; });
    (readings || []).forEach(function (r) {
      if (day(r.period_start || r.taken_at) !== day(on)) return;
      if (r.thermometer_id) byId[r.thermometer_id] = true; else byRoom[r.area_id] = true;
    });
    return neededList(rows, on, reqRows).filter(function (t) { return !byId[t.id] && !(byRoom[t.area_id] && perRoom[t.area_id] === 1); });
  }
  return { neededOn: neededOn, neededList: neededList, missingOn: missingOn };
}));
