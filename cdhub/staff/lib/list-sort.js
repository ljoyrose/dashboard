/*!
 * BLDSort - one sort for every list (Dogs, Items, Litters, Staff...). the owner 15 Nov 2026: "its cross industry - will youngest
 * appear on fire extinguishers?" A list only offers the sorts for fields it actually holds:
 *   status -> Best to worst (All, Pass ... Fail; never Fail first)   due  -> Due soonest
 *   expires -> Expires soonest                                        made -> Newest first / Oldest first (made, bought or into use)
 *   dob    -> Youngest / Oldest
 *   name   -> A to Z                                                  always: As on file
 * Default: best to worst wherever there is a status, else due soonest, else A to Z, else as on file.
 * Pure functions; works in a browser (window.BLDSort) and in Node.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDSort = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  /* [id, label, field, direction]. Ids kept from the old Dogs select ('', name, young, old). */
  var ALL = [
    ['best', 'Best to worst', 'status', 1],
    ['due', 'Due soonest', 'due', 1],
    ['expires', 'Expires soonest', 'expires', 1],
    ['newest', 'Newest first', 'made', -1],
    ['oldest', 'Oldest first', 'made', 1],
    ['young', 'Youngest', 'dob', -1],
    ['old', 'Oldest', 'dob', 1],
    ['name', 'A to Z', 'name', 1],
    ['', 'As on file', null, 0]
  ];
  function has(fields, f) { return !!(fields && fields[f]); }
  /** The sorts this list can offer, as [id, label] pairs, in the order above. */
  function options(fields) {
    return ALL.filter(function (o) { return !o[2] || has(fields, o[2]); }).map(function (o) { return [o[0], o[1]]; });
  }
  /** The sort a list opens with. */
  function byDefault(fields) {
    if (has(fields, 'status')) return 'best';
    if (has(fields, 'due')) return 'due';
    if (has(fields, 'name')) return 'name';
    return '';
  }
  function day(v) { var s = String(v == null ? '' : v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  /** A sorted copy. get: {status: row -> rank (0 = best), due/expires/made/dob: row -> ISO date, name: row -> text}.
      Blanks go last whatever the direction; ties keep their file order. An id the list cannot offer leaves the order alone. */
  function sort(rows, id, get) {
    var o = null; for (var i = 0; i < ALL.length; i++) if (ALL[i][0] === (id || '')) o = ALL[i];
    var list = (rows || []).map(function (r, n) { return { r: r, n: n }; });
    if (!o || !o[2] || !get || typeof get[o[2]] !== 'function') return list.map(function (x) { return x.r; });
    var f = get[o[2]], dir = o[3];
    function key(r) {
      var v = f(r);
      if (o[2] === 'status') return (v === null || v === undefined || v === '' || isNaN(+v)) ? null : +v;
      if (o[2] === 'name') { v = String(v == null ? '' : v).trim(); return v ? v.toLowerCase() : null; }
      return day(v) || null;
    }
    list.forEach(function (x) { x.k = key(x.r); });
    list.sort(function (a, b) {
      if (a.k === null || b.k === null) return a.k === b.k ? a.n - b.n : (a.k === null ? 1 : -1);
      var c = typeof a.k === 'number' ? a.k - b.k : (o[2] === 'name' ? a.k.localeCompare(b.k) : (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
      return c ? c * dir : a.n - b.n;
    });
    return list.map(function (x) { return x.r; });
  }
  return { options: options, byDefault: byDefault, sort: sort, ALL: ALL };
}));
