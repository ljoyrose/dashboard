/*!
 * BLDPick - the "which cards to print" list on the print page (the owner 22 Nov 2026: "can I print one specific area, item,
 * thermometer, dog etc, or select all (with unselect) for them all?").
 * One tick box per card, all ticked to start (or only the ids asked for), with Select all and Unselect all. It never
 * prints (class noprint) and it saves nothing: the page decides what to draw from selected(). Shared so any card kind
 * (rooms, dogs, litters, thermometers, items) uses the same list. Plain DOM; works in a browser (window.BLDPick).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDPick = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text != null) e.textContent = text;
    return e;
  }
  function create(host, items, opts) {
    opts = opts || {};
    var only = opts.only && opts.only.length ? opts.only.map(String) : null, what = opts.what || 'cards';
    host.textContent = '';
    host.className = 'pick noprint';
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', 'Cards to print');
    var bar = el('div', { class: 'pick-bar' }), count = el('span', { class: 'pick-n', 'aria-live': 'polite' });
    var all = el('button', { class: 'btn quiet', type: 'button' }, 'Select all');
    var none = el('button', { class: 'btn quiet', type: 'button' }, 'Unselect all');
    bar.appendChild(el('b', {}, 'Cards to print'));
    bar.appendChild(count); bar.appendChild(all); bar.appendChild(none);
    var list = el('div', { class: 'pick-list' }), boxes = [];
    items.forEach(function (it) {
      var lab = el('label', { class: 'pick-item' }), box = el('input', { type: 'checkbox', 'data-pick': String(it.id) });
      box.checked = !only || only.indexOf(String(it.id)) >= 0;
      lab.appendChild(box); lab.appendChild(document.createTextNode(' ' + (it.label || it.id)));
      list.appendChild(lab); boxes.push({ box: box, it: it });
    });
    host.appendChild(bar); host.appendChild(list);
    function selected() { return boxes.filter(function (b) { return b.box.checked; }).map(function (b) { return b.it; }); }
    function changed() {
      var n = selected().length;
      count.textContent = n + ' of ' + boxes.length + ' ' + what + ' ticked';
      if (opts.onChange) opts.onChange(selected());
    }
    function setAll(v) { boxes.forEach(function (b) { b.box.checked = v; }); changed(); }
    all.addEventListener('click', function () { setAll(true); });
    none.addEventListener('click', function () { setAll(false); });
    boxes.forEach(function (b) { b.box.addEventListener('change', changed); });
    function setBusy(v) { [all, none].concat(boxes.map(function (b) { return b.box; })).forEach(function (x) { x.disabled = !!v; }); }
    count.textContent = selected().length + ' of ' + boxes.length + ' ' + what + ' ticked';
    return { selected: selected, setBusy: setBusy, refresh: changed };
  }
  function clear(host) { host.textContent = ''; host.className = 'pick noprint'; }
  return { create: create, clear: clear };
}));

