/*!
 * BLDThermometer - which thermometers are needed on a day (Lisa 11 Nov 2026).
 * Each BLD-thermometer row has from_date and to_date (the same names as area_access and subject_status).
 * A thermometer is needed from from_date up to and including to_date; a blank from_date means always,
 * a blank to_date means it has not ended; active=false retires it. Outside those dates nothing may flag it
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
    var d = day(on), from = day(t.from_date), to = day(t.to_date);
    if (!d) return false;
    return (!from || from <= d) && (!to || d <= to);
  }
  /** The thermometers needed on `on`, A-Z by name. */
  function neededList(rows, on) {
    return (rows || []).filter(function (t) { return neededOn(t, on); })
      .sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || '')); });
  }
  return { neededOn: neededOn, neededList: neededList };
}));
