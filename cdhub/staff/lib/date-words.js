/*!
 * BLDDates - the one date formatter (Lisa 13 Nov 2026): "2 Mar 2026" everywhere, owner and staff screens, exports, PDFs.
 * Storage is unchanged: ISO date (YYYY-MM-DD), datetime in UTC.
 *   BLDDates.long(iso)   "2 Mar 2026"
 *   BLDDates.setLocale(rows)           the BLD-locale rows: month names come from the row's language_tag
 * A value that is not a date (blank, free text) is returned as it is, never guessed at.
 * With no locale row the browser's own language words are used (display only, never a rule).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDDates = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var tag = '', cache = {};
  function setLocale(rows) {
    var r = (rows || []).filter(function (x) { return x && String(x.language_tag || '').trim(); })[0];
    var t = r ? String(r.language_tag).trim() : '';
    if (t !== tag) { tag = t; cache = {}; }
    return tag;
  }
  /** month word for 1-12, from the locale row's language */
  function month(n) {
    if (cache[n]) return cache[n];
    var w;
    try { w = new Intl.DateTimeFormat(tag || undefined, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, n - 1, 15))); }
    catch (e) { w = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, n - 1, 15))); }
    return (cache[n] = w.replace(/\.$/, ''));
  }
  function parts(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(String(v == null ? '' : v).trim());
    return m ? { y: m[1], m: Number(m[2]), d: Number(m[3]) } : null;
  }
  function long(v) { var p = parts(v); return p ? p.d + ' ' + month(p.m) + ' ' + p.y : String(v == null ? '' : v); }
  return { long: long, setLocale: setLocale, month: month };
}));
