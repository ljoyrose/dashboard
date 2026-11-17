/*!
 * BLDTempPair - one check for a lowest and a highest temperature.
 * The same rule and words as tempPairError_ in cdhub-write/apps-script/Specs.gs:
 * when both numbers are filled in, the lowest cannot be higher than the highest.
 * Works in a browser (window.BLDTempPair) and in Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDTempPair = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var MSG = 'The lowest reading cannot be higher than the highest reading.';
  function text(v) { return v === undefined || v === null ? '' : String(v).trim(); }
  function swapped(min, max) {
    var a = text(min), b = text(max), lo = parseFloat(a), hi = parseFloat(b);
    return a !== '' && b !== '' && !isNaN(lo) && !isNaN(hi) && lo > hi;
  }
  function error(min, max) { return swapped(min, max) ? MSG : ''; }
  return { message: MSG, swapped: swapped, error: error };
}));
