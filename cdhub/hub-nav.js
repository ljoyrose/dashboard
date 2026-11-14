/* CD Hub bottom bar (Lisa 14 Nov 2026, menu option A). The hub and the temperature pages both render from this list.
   Bar: Main (slot 1: Today, Do, Decide) · up to 3 sections chosen per role or person · More.
   Sections in colour order (tokens.css LJR7 slots): Compliance 2, Money 3, Ops 4, People 5, Sales 6, Ideas 7; Settings 8 (holds Bin).
   Which sections are on and which sit on the bar are owner settings: dated rule rows (breeding_rule), never fixed here.
     nav.on.<section>                  1 on, 0 off
     nav.tab.<ROLE>.<section>          position 1-3 on the bar for that role (e.g. OWNER)
     nav.tab.person.<person_id>.<section>   the same for one person; wins over the role. Never a code: codes are secrets
                                       and no code may sit in a rule row (OV11, 14 Nov 2026).
   No nav rows: the app's starting layout (STARTER), reported as not set so Settings can say so. */
(function (root) {
  'use strict';
  /* Every view, by route. Temps opens the temperature history page. */
  var VIEWS = {
    today: { label: 'Today', icon: 't-cal' },
    work: { label: 'Do', icon: 't-do' },
    map: { label: 'Main', icon: 't-main' },   /* the Live feed: Main's own page */
    compliance: { label: 'Compliance', icon: 's-check' },
    breed: { label: 'Breed Better', icon: 's-check' },
    dogs: { label: 'Dogs', icon: 't-paw' },
    litters: { label: 'Litters', icon: 't-paw' },
    areas: { label: 'Areas', icon: 't-room' },
    round: { label: 'The round', icon: 's-repeat' },
    sops: { label: 'SOPs', icon: 't-line' },
    temps: { label: 'Temps', icon: 't-temp', href: './history.html' },
    staff: { label: 'Staff', icon: 't-user' },
    enquiries: { label: 'Enquiries', icon: 't-world' },
    admin: { label: 'Settings', icon: 't-box' }
  };
  /* Main, then the sections in colour order, then Settings. go = the view the tab opens. */
  var SECTIONS = [
    { id: 'main', label: 'Main', slot: '1', icon: 't-main', go: 'map', views: ['map', 'today', 'work'] },
    { id: 'compliance', label: 'Compliance', slot: '2', icon: 's-check', go: 'compliance', views: ['compliance', 'breed'] },   /* Breed Better: a welfare and standards scheme, its own brick */
    { id: 'money', label: 'Money', slot: '3', icon: 't-money', go: 'money', views: [] },
    { id: 'ops', label: 'Ops', slot: '4', icon: 't-box', go: 'dogs', views: ['dogs', 'litters', 'areas', 'round', 'sops', 'temps'] },
    { id: 'people', label: 'People', slot: '5', icon: 't-user', go: 'staff', views: ['staff'] },
    { id: 'sales', label: 'Sales', slot: '6', icon: 't-bag', go: 'enquiries', views: ['enquiries'] },
    { id: 'ideas', label: 'Ideas', slot: '7', icon: 't-line', go: 'ideas', views: [] },
    { id: 'settings', label: 'Settings', slot: '8', icon: 't-box', go: 'admin', views: ['admin'] }
  ];
  /* The starting layout for a new app (Lisa 14 Nov): Main · Compliance · Ops · People · More. Proposed default, not a rule. */
  var STARTER = { on: { compliance: 1, ops: 1, people: 1, sales: 1 }, tabs: ['compliance', 'ops', 'people'] };
  var PICKABLE = ['compliance', 'money', 'ops', 'people', 'sales', 'ideas'];
  var MAX_TABS = 3;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function section(id) { for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].id === id) return SECTIONS[i]; return null; }
  function sectionOf(view) { for (var i = 0; i < SECTIONS.length; i++) if (SECTIONS[i].views.indexOf(view) >= 0) return SECTIONS[i]; return null; }
  function day(v) { var s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }

  /* The nav rows in force on `iso`: the latest effective_from per key wins; a to_date ends a row. Whole numbers only. */
  function inForce(rows, iso) {
    var on = {}, d = day(iso);
    (rows || []).forEach(function (r) {
      var k = String(r && r.rule_key || ''), f = day(r && r.effective_from), t = day(r && r.to_date);
      if (k.indexOf('nav.') !== 0 || !f || !/^\d+$/.test(String(r.value || ''))) return;
      if (d && (f > d || (t && d > t))) return;
      if (!on[k] || on[k].from <= f) on[k] = { from: f, value: parseInt(r.value, 10) };
    });
    return on;
  }

  /* layout({rows, iso, role, person, has}) -> {tabs:[section ids], on:{id:true}, set:bool}. has(view) says a view exists here. */
  function layout(o) {
    o = o || {};
    var rows = inForce(o.rows, o.iso), set = Object.keys(rows).length > 0;
    var has = o.has || function () { return true; };
    var on = {};
    PICKABLE.concat(['settings']).forEach(function (id) {
      var r = rows['nav.on.' + id];
      var want = id === 'settings' ? true : (r ? r.value === 1 : !!STARTER.on[id]);
      var s = section(id), live = s.views.some(has) || id === 'money' || id === 'ideas';
      if (want && live) on[id] = true;
    });
    function picks(prefix) {
      var p = [];
      PICKABLE.forEach(function (id) { var r = rows[prefix + id]; if (r && r.value >= 1) p.push([r.value, id]); });
      return p.sort(function (a, b) { return a[0] - b[0] || PICKABLE.indexOf(a[1]) - PICKABLE.indexOf(b[1]); }).map(function (x) { return x[1]; });
    }
    var tabs = (o.person && picks('nav.tab.person.' + o.person + '.')) || [];
    if (!tabs.length && o.role) tabs = picks('nav.tab.' + o.role + '.');
    if (!tabs.length) tabs = STARTER.tabs.slice();
    tabs = tabs.filter(function (id) { return on[id]; }).slice(0, MAX_TABS);
    return { tabs: tabs, on: on, set: set };
  }

  function viewItem(id, slot, opts, has) {
    var v = VIEWS[id];
    if (!v || !has(id)) return '';
    var icon = root.DashKit.icon(v.icon);
    var current = opts.current === id ? ' aria-current="page"' : '';
    if (opts.links === 'href' || v.href) {
      var href = v.href || ('./index.html#/' + id);
      return '<a href="' + esc(href) + '" data-slot="' + esc(slot) + '"' + current + '>' + icon + '<span class="htl">' + esc(v.label) + '</span></a>';
    }
    return '<button type="button" data-go="' + esc(id) + '" data-slot="' + esc(slot) + '"' + current + '>' + icon + '<span class="htl">' + esc(v.label) + '</span></button>';
  }

  /* html(opts): opts.layout from layout(); opts.has(view); opts.current (href pages); opts.counts / opts.late keyed by view. */
  function html(opts) {
    opts = opts || {};
    var DK = root.DashKit;
    var has = opts.has || function (id) { return id !== 'breed' && id !== 'admin'; };   /* pages without the rows (temperature history) */
    var lay = opts.layout || layout({ has: has });
    var cur = opts.current ? sectionOf(opts.current) : null;
    var bar = [section('main')].concat(lay.tabs.map(section)), onBar = {};
    function goOf(s) { return has(s.go) ? s.go : (s.views.filter(has)[0] || s.go); }
    bar.forEach(function (s) { onBar[goOf(s)] = true; });
    var tabs = bar.map(function (s) {
      var go = goOf(s);
      var o = { slot: s.slot, icon: s.icon, label: s.label, nav: s.id };
      if (opts.links === 'href') o.href = VIEWS[go] && VIEWS[go].href ? VIEWS[go].href : './index.html#/' + go;
      else o.go = go;
      if (opts.counts) {
        var n = 0, late = false;
        s.views.forEach(function (v) { n += +(opts.counts[v] || 0); late = late || !!(opts.late && opts.late[v] && opts.counts[v]); });
        o.count = n ? String(n) : '';
        o.need = late;
      }
      var h = DK.tabs.tab(o).replace(' class="ht"', ' class="ht" data-section="' + s.id + '"' + (cur && cur.id === s.id ? ' aria-current="page"' : ''));
      return h;
    }).join('');
    /* More: every other view of every switched-on section, in colour order, each in its section's colour
       (a view a bar tab already opens is not repeated). */
    var items = SECTIONS.filter(function (s) { return s.id === 'main' || lay.on[s.id]; }).map(function (s) {
      return s.views.map(function (id) { return onBar[id] ? '' : viewItem(id, s.slot, opts, has); }).join('');
    }).join('');

    return tabs + DK.tabs.more(opts.moreId || 'houseMore', items);
  }

  root.HubNav = { VIEWS: VIEWS, SECTIONS: SECTIONS, STARTER: STARTER, layout: layout, sectionOf: sectionOf, html: html };
})(typeof window !== 'undefined' ? window : this);
