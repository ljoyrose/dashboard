/*!
 * BLDLazy - load a page's heavier parts the first time they are needed, not on first open (OV11 / Lisa, 15 Nov 2026).
 *   BLDLazy.load(['a.js','b.js'])  -> Promise; the scripts run in the order given, each fetched once per page.
 *   BLDLazy.loaded('a.js')         -> true once that script has run.
 * A failed script rejects the promise and may be tried again (it is forgotten, so the next call fetches it anew).
 */
(function (root) {
  'use strict';
  var seen = {};   /* src -> Promise */
  var done = {};
  function one(src) {
    if (seen[src]) return seen[src];
    seen[src] = new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () { done[src] = true; ok(src); };
      s.onerror = function () { delete seen[src]; if (s.parentNode) s.parentNode.removeChild(s); no(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
    return seen[src];
  }
  function load(srcs) {
    return (srcs || []).reduce(function (p, src) { return p.then(function () { return one(src); }); }, Promise.resolve());
  }
  function loaded(src) { return !!done[src]; }
  root.BLDLazy = { load: load, loaded: loaded };
})(typeof window !== 'undefined' ? window : this);
