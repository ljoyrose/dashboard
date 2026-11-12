/*!
 * BLDAreaLink - a reading in an old room also shows for the new room it became (Lisa 12 Nov 2026, "links").
 * BLD-area_link rows: from_area_id, to_area_id, from_date, to_date (need-row style; blank date = open).
 * A reading on from_area_id whose day (period_start, else taken_at) is inside the row's dates also counts for
 * to_area_id. The reading itself is never changed: expand() adds copies, marked linked_from.
 * A split room links to both new rooms; a merged room has two links in, so one slot can hold two readings:
 * callers never average them (widest() keeps the lowest MIN and highest MAX, so a breach stays visible).
 * Pure functions; works in a browser (window.BLDAreaLink) and in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDAreaLink = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function day(v) { var s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  function covers(l, d) { var f = day(l.from_date), t = day(l.to_date); return !!d && (!f || f <= d) && (!t || d <= t); }
  function ok(l) { return l && l.from_area_id && l.to_area_id && l.from_area_id !== l.to_area_id; }
  /** The from_area_ids whose readings count for toAreaId on day `on`. */
  function linksInto(links, toAreaId, on) {
    var d = day(on);
    return (links || []).filter(function (l) { return ok(l) && l.to_area_id === toAreaId && covers(l, d); })
      .map(function (l) { return l.from_area_id; });
  }
  /** Every area a reading in toAreaId may come from (any date): for reading a whole year of one room. */
  function sourcesOf(links, toAreaId) {
    var out = [];
    (links || []).forEach(function (l) { if (ok(l) && l.to_area_id === toAreaId && out.indexOf(l.from_area_id) < 0) out.push(l.from_area_id); });
    return out;
  }
  /** readings plus one copy per covering link: area_id = to_area_id, thermometer_id '', linked_from = from_area_id. */
  function expand(readings, links) {
    var ls = (links || []).filter(ok), out = (readings || []).slice();
    if (!ls.length) return out;
    (readings || []).forEach(function (r) {
      if (!r || r.linked_from) return;
      var d = day(r.period_start || r.taken_at);
      ls.forEach(function (l) {
        if (l.from_area_id !== r.area_id || !covers(l, d)) return;
        var c = {}; Object.keys(r).forEach(function (k) { c[k] = r[k]; });
        c.area_id = l.to_area_id; c.thermometer_id = ''; c.linked_from = l.from_area_id;
        out.push(c);
      });
    });
    return out;
  }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  /** Two readings for one slot (strings or numbers): the lowest MIN and the highest MAX, never an average. */
  function widest(a, b) {
    var lo = [num(a && a.min), num(b && b.min)].filter(function (x) { return x !== null; });
    var hi = [num(a && a.max), num(b && b.max)].filter(function (x) { return x !== null; });
    return { min: lo.length ? Math.min.apply(null, lo) : null, max: hi.length ? Math.max.apply(null, hi) : null };
  }
  return { linksInto: linksInto, sourcesOf: sourcesOf, expand: expand, widest: widest };
}));
