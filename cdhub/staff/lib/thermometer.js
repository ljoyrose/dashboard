/*!
 * BLDThermometer - which thermometers are needed on a day (Lisa 11 Nov 2026).
 * Each BLD-thermometer row has valid_from and valid_to (the date naming BLD scheme rows use).
 * A thermometer is needed from valid_from up to and including valid_to; a blank valid_from means always,
 * a blank valid_to means it has not ended; active=false retires it. Outside those dates nothing may flag it
 * for a missing reading. Pure functions; works in a browser (window.BLDThermometer) and in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDThermometer = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function day(v) { var s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  /** True when this thermometer is needed on `on` (YYYY-MM-DD, London day). */
  function neededOn(t, on) {
    if (!t || String(t.active).toLowerCase() === 'false') return false;
    var d = day(on), from = day(t.valid_from), to = day(t.valid_to);
    if (!d) return false;
    return (!from || from <= d) && (!to || d <= to);
  }
  /** The thermometers needed on `on`, A-Z by name. */
  function neededList(rows, on) {
    return (rows || []).filter(function (t) { return neededOn(t, on); })
      .sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
  }
  /**
   * The thermometers to flag for no reading on `on`: needed that day, and no reading (area_reading rows, which save
   * against area_id) for its place with a taken_at on that London day. A thermometer outside its dates is never flagged.
   */
  function missingOn(rows, readings, on) {
    var seen = {};
    (readings || []).forEach(function (r) { if (day(r.taken_at) === day(on)) seen[r.area_id] = true; });
    return neededList(rows, on).filter(function (t) { return !seen[t.area_id]; });
  }
  return { neededOn: neededOn, neededList: neededList, missingOn: missingOn };
}));
