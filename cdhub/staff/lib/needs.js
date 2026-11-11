/*!
 * BLDNeeds - when something is needed or in use, from BLD-requirement rows (Lisa 11 Nov 2026, "A standard").
 * Things (room, dog, thermometer, person) never carry dates. A need row does: need_type (e.g. reading.temperature,
 * room.in_use), target_table, target_id, from_date, to_date (both inclusive, YYYY-MM-DD; a blank to_date = no end).
 * A target with NO rows of that need_type is open (always needed or in use). A target with rows is needed or in use
 * only on days a row covers. To end something, fill in to_date; rows are never deleted. Pure functions; works in a
 * browser (window.BLDNeeds) and in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDNeeds = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function day(v) { var s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  function rowsFor(reqRows, needType, targetTable, targetId) {
    return (reqRows || []).filter(function (r) {
      return r && r.need_type === needType && r.target_table === targetTable && String(r.target_id) === String(targetId);
    });
  }
  /** True when the target is needed / in use on `on` (YYYY-MM-DD London day). */
  function coversDay(reqRows, needType, targetTable, targetId, on) {
    var rows = rowsFor(reqRows, needType, targetTable, targetId);
    if (!rows.length) return true;
    var d = day(on);
    if (!d) return false;
    return rows.some(function (r) { var f = day(r.from_date), t = day(r.to_date); return (!f || f <= d) && (!t || d <= t); });
  }
  /** The last day the target is covered, or '' when it has no rows or a row with no end. For "(retired 11/11/26)". */
  function endDay(reqRows, needType, targetTable, targetId) {
    var rows = rowsFor(reqRows, needType, targetTable, targetId), last = '';
    if (!rows.length) return '';
    for (var i = 0; i < rows.length; i++) { var t = day(rows[i].to_date); if (!t) return ''; if (t > last) last = t; }
    return last;
  }
  /** Today in London as YYYY-MM-DD. */
  function today(now) { return new Date(now || Date.now()).toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); }
  return { coversDay: coversDay, endDay: endDay, today: today };
}));
