/*!
 * BLDBands - which temperature band applies to a room, and whether a reading is inside it.
 * Pure functions (no page, no network). Logic follows the "round" code in the live CD Hub:
 * the band is set by the YOUNGEST dog in the room, by age in days on the reading date.
 *
 * Data shapes come from the live tables, read-only:
 *   BLD-temperature_band.csv  -> id, band, age_from_days, age_to_days (blank = open ended), min_temp, max_temp
 *   BLD-temperature_action.csv -> direction (below|above), threshold_c, action
 * On Drive these two tables do the job of the design table "environment_limit" (see MAP note).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDBands = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function num(v) { if (v === '' || v === null || v === undefined) return null; var n = parseFloat(v); return isNaN(n) ? null : n; }

  /** CSV records -> band objects. */
  function parseBands(records) {
    return (records || []).map(function (r) {
      return { id: r.id, band: r.band, from: num(r.age_from_days), to: num(r.age_to_days), min: num(r.min_temp), max: num(r.max_temp) };
    }).filter(function (b) { return b.from !== null; });
  }

  /** CSV records -> action objects. */
  function parseActions(records) {
    return (records || []).map(function (r) {
      return { dir: r.direction, at: num(r.threshold_c), action: r.action };
    }).filter(function (a) { return a.at !== null && (a.dir === 'below' || a.dir === 'above'); });
  }

  /** Whole days between two YYYY-MM-DD dates, or null if either is missing/odd. */
  function ageDays(dobIso, onIso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dobIso || '') || !/^\d{4}-\d{2}-\d{2}$/.test(onIso || '')) return null;
    var a = dobIso.split('-'), b = onIso.split('-');
    return Math.floor((Date.UTC(+b[0], +b[1] - 1, +b[2]) - Date.UTC(+a[0], +a[1] - 1, +a[2])) / 86400000);
  }

  /**
   * The band for a room.
   * @param {Array<{id:string,dob:string}>} dogs the dogs recorded in the room
   * @param {string} onIso reading date
   * @param {Array} bands from parseBands
   * @return {{band:Object, days:number, dogId:string}|{reason:string}}
   */
  function bandFor(dogs, onIso, bands) {
    if (!dogs || !dogs.length) return { reason: 'room unknown: nobody is recorded in this room' };
    var young = null, who = null;
    dogs.forEach(function (d) {
      var a = ageDays(d.dob, onIso);
      if (a !== null && (young === null || a < young)) { young = a; who = d; }
    });
    if (young === null) return { reason: 'no date of birth for anyone in this room, so no band can be set' };
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i];
      if (young >= b.from && (b.to === null || young <= b.to)) return { band: b, days: young, dogId: who.id };
    }
    return { reason: 'no band covers ' + young + ' days old' };
  }

  /** 'low' | 'high' | 'ok' | '' (cannot tell) for one reading. */
  function verdict(value, band) {
    var n = num(value);
    if (n === null || !band || band.min === null || band.max === null) return '';
    if (n < band.min) return 'low';
    if (n > band.max) return 'high';
    return 'ok';
  }

  /** The first action from the SOP ladder that a reading triggers, or ''. */
  function actionFor(value, actions) {
    var n = num(value);
    if (n === null) return '';
    var cold = actions.filter(function (a) { return a.dir === 'below' && n < a.at; });
    if (cold.length) return cold[0].action;
    var hot = actions.filter(function (a) { return a.dir === 'above' && n > a.at; }).sort(function (a, b) { return b.at - a.at; });
    return hot.length ? hot[0].action : '';
  }

  return { parseBands: parseBands, parseActions: parseActions, ageDays: ageDays, bandFor: bandFor, verdict: verdict, actionFor: actionFor };
}));
