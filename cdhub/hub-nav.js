/* CD Hub bottom bar. The hub and the temperature pages both render from this list. */
(function (root) {
  'use strict';
  var TABS = [
    { id: 'map', label: 'Main', slot: '1', icon: 't-main' },
    { id: 'work', label: 'Do', slot: '4', icon: 't-do' },
    { id: 'today', label: 'Today', slot: '4', icon: 't-cal' },
    { id: 'dogs', label: 'Dogs', slot: '5', icon: 't-paw' },
    { id: 'sops', label: 'SOPs', slot: '6', icon: 't-line' }
  ];
  /* More, in the hub's order. Temps opens the temperature history page. */
  var MORE = [
    { id: 'compliance', label: 'Compliance', slot: '2', icon: 's-check' },
    { id: 'shape', label: 'Table map', slot: '0', icon: 't-main' },
    { id: 'round', label: 'The round', slot: '4', icon: 's-repeat' },
    { id: 'areas', label: 'Areas', slot: '3', icon: 't-room' },
    { id: 'litters', label: 'Litters', slot: '7', icon: 't-paw' },
    { id: 'buyers', label: 'Assocs', slot: '6', icon: 't-world' },
    { id: 'staff', label: 'Staff', slot: '5', icon: 't-user' },
    { id: 'temps', label: 'Temps', slot: '8', icon: 't-temp', href: './history.html' }
  ];

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function moreItem(item, opts) {
    var icon = root.DashKit.icon(item.icon);
    var current = opts.current === item.id ? ' aria-current="page"' : '';
    if (opts.links === 'href' || item.href) {
      var href = item.href || ('./index.html#/' + item.id);
      return '<a href="' + esc(href) + '" data-slot="' + esc(item.slot) + '"' + current + '>' + icon + '<span class="htl">' + esc(item.label) + '</span></a>';
    }
    return '<button type="button" data-go="' + esc(item.id) + '" data-slot="' + esc(item.slot) + '"' + current + '>' + icon + '<span class="htl">' + esc(item.label) + '</span></button>';
  }

  function html(opts) {
    opts = opts || {};
    var DK = root.DashKit;
    var tabs = TABS.map(function (t) {
      var o = { slot: t.slot, icon: t.icon, label: t.label, nav: t.id };
      if (opts.links === 'href') o.href = './index.html#/' + t.id;
      else o.go = t.id;
      if (opts.counts) {
        var n = opts.counts[t.id];
        o.count = n ? String(n) : '';
        o.need = !!(n && opts.late && opts.late[t.id]);
      }
      var h = DK.tabs.tab(o);
      if (opts.links === 'href' && opts.current === t.id) h = h.replace('<a class="ht"', '<a class="ht" aria-current="page"');
      return h;
    }).join('');
    var more = MORE.slice();
    if (opts.extraMore && opts.extraMore.length) more = more.concat(opts.extraMore);
    return tabs + DK.tabs.more(opts.moreId || 'houseMore', more.map(function (m) { return moreItem(m, opts); }).join(''));
  }

  root.HubNav = { TABS: TABS, MORE: MORE, html: html };
})(typeof window !== 'undefined' ? window : this);
