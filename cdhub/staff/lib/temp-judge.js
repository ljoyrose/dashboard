/*!
 * BLDTempJudge - one rule for judging a room temperature reading against its limit rows (Lisa 17 Nov 2026, "Temps A").
 *
 * Why: the limits sheet's own notes say
 *   - puppies under four weeks: 26-28 C is for where the puppies are (the whelping box / bed spot), not the whole room;
 *   - four weeks and over: 10-26 C is for "some part of the sleeping area"; "a reading over 26 triggers the cooling
 *     ladder, it is not automatically a breach".
 * So:
 *   - The room's MIN/MAX are judged on the open-ended (adult) row. Below its minimum = 'cold' (a breach).
 *     Above its maximum = 'warm' (cooling action, shown, never counted as outside).
 *   - When the youngest dog picked an age row that is not the open-ended row (puppies under four weeks), the BED SPOT
 *     reading (spot_c) is judged on that row: below = 'spotcold', above = 'spothot' (both breaches). No bed spot
 *     reading = 'nospot' (shown as "bed spot not recorded", never counted as outside).
 *   - With no open-ended row, the room is judged on the row it was given, the same way (below = cold, above = warm).
 * Order when several apply: cold, spotcold, spothot, warm, nospot, ok.
 * Rows are the callers' own band objects {min, max}; nothing about the limits is coded here.
 *
 * Browser: window.BLDTempJudge.  Node (tests): module.exports.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDTempJudge = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function num(v) { if (v === '' || v == null) return null; var s = String(v).trim(); return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : null; }
  var BREACH = { cold: 1, spotcold: 1, spothot: 1 };

  /**
   * r: {min, max, spot}; band: the row the room's youngest dog picked {min, max}; adult: the open-ended row {min, max}
   * or null; puppy: true when band is an age row with an upper age (the caller knows its own row shape).
   * Returns 'ok' | 'cold' | 'warm' | 'spotcold' | 'spothot' | 'nospot' | 'unknown' (no row at all).
   */
  function judge(r, band, adult, puppy) {
    var lo = num(r && r.min), hi = num(r && r.max), sp = num(r && r.spot);
    puppy = !!(puppy && band && adult && band !== adult);
    var roomRow = puppy ? adult : (band || adult);
    if (!roomRow) return 'unknown';
    var room = lo !== null && lo < roomRow.min ? 'cold' : (hi !== null && hi > roomRow.max ? 'warm' : 'ok');
    if (room === 'cold') return 'cold';
    if (puppy) {
      if (sp === null) return room === 'warm' ? 'warm' : 'nospot';
      if (sp < band.min) return 'spotcold';
      if (sp > band.max) return 'spothot';
    }
    return room;
  }
  function isBreach(k) { return !!BREACH[k]; }
  /** Plain words for a state, for screens and print. */
  function words(k, band, adult) {
    if (k === 'cold') return 'below the limit';
    if (k === 'warm') return 'over ' + (adult || band ? (adult || band).max : '') + ' °C: cooling action';
    if (k === 'spotcold') return 'bed spot below ' + (band ? band.min : '') + ' °C';
    if (k === 'spothot') return 'bed spot above ' + (band ? band.max : '') + ' °C';
    if (k === 'nospot') return '';   // Lisa 18 Nov 2026: no "bed spot not recorded" words anywhere
    return '';
  }
  return { judge: judge, isBreach: isBreach, words: words, num: num };
}));
