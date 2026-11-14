/* One table look for every app (Lisa 14 Nov 2026: "no jumping about on columns"). A table with class "house-table"
   gets column widths set once from its headers, never from its rows, so columns stay put as rows load, filter or fold.
   Numbers sit right in even-width figures. On a phone each row becomes label / value lines (house.css).
   A header can set its own width in em: <th data-w="14">. Helpers only add the class: this file finds the tables itself. */
(function (root) {
  'use strict';
  var NUM = /^[−+-]?[£$€]?\d[\d,]*(\.\d+)?\s?(%|kg|g|°C|days?|d|wk|wks)?$/;
  function headCells(t) {
    var h = t.tHead && t.tHead.rows.length ? t.tHead.rows[t.tHead.rows.length - 1] : null;
    return h ? Array.prototype.slice.call(h.cells) : [];
  }
  function width(th, i) {
    if (th.dataset.w && !isNaN(+th.dataset.w)) return +th.dataset.w;
    var n = (th.textContent || '').trim().length;
    return Math.max(i === 0 ? 10 : 7, Math.min(16, Math.round(n * 0.62 + 3)));
  }
  function label(t, tr) {
    var hs = headCells(t); if (!hs.length) return;
    var at = 0;
    Array.prototype.forEach.call(tr.cells, function (c) {
      var h = hs[at]; at += c.colSpan || 1;
      if (h && !c.hasAttribute('data-label')) c.setAttribute('data-label', (h.textContent || '').trim());
      if (c.tagName === 'TD' && NUM.test((c.textContent || '').trim())) c.classList.add('num');
    });
  }
  function prep(t) {
    if (!t || t.dataset.ht === '1') return;
    t.dataset.ht = '1';
    var hs = headCells(t);
    if (hs.length && !t.querySelector('colgroup')) {
      var cg = document.createElement('colgroup'), sum = 0;
      hs.forEach(function (th, i) {
        var w = width(th, i), span = th.colSpan || 1;
        for (var k = 0; k < span; k++) { var c = document.createElement('col'); c.style.width = w + 'em'; cg.appendChild(c); sum += w; }
      });
      t.insertBefore(cg, t.firstChild);
      t.style.setProperty('--ht-min', sum + 'em');
    }
    Array.prototype.forEach.call(t.tBodies, function (b) { Array.prototype.forEach.call(b.rows, function (tr) { label(t, tr); }); });
    // a column of numbers: its header sits right too (alignment only, the width never moves)
    hs.forEach(function (th, i) {
      var cells = Array.prototype.map.call(t.querySelectorAll('tbody tr'), function (tr) { return tr.cells[i]; }).filter(function (c) { return c && c.tagName === 'TD' && (c.textContent || '').trim(); });
      if (cells.length && cells.every(function (c) { return c.classList.contains('num'); })) th.classList.add('num');
    });
  }
  function scan(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.matches('table.house-table')) prep(el);
    else if (el.matches('tr')) { var t = el.closest('table.house-table'); if (t) { if (t.dataset.ht === '1') label(t, el); else prep(t); } }
    Array.prototype.forEach.call(el.querySelectorAll('table.house-table'), prep);
  }
  function watch() {
    scan(document.body);
    if (root.MutationObserver) new root.MutationObserver(function (ms) { ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, scan); }); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);
  var api = { prep: prep, scan: scan };
  root.BLDTables = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : this);
