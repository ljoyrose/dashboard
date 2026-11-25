/* CD Hub bottom bar (Lisa 14 Nov 2026, menu option A). The hub and the temperature pages both render from this list.
   Bar: Main (slot 1: Today, Do, Decide) · up to 3 sections chosen per role or person · More.
   Sections in colour order (tokens.css LJR7 slots): Compliance 2, Money 3, Records 4 (id ops; Lisa named it 15 Nov 2026), People 5, Sales 6, Ideas 7; Settings 8.
   Which sections are on and which sit on the bar are owner settings: dated rule rows (breeding_rule), never fixed here.
     nav.on.<section>                  1 on, 0 off
     nav.tab.<ROLE>.<section>          position 1-3 on the bar for that role (e.g. OWNER)
     nav.tab.person.<person_id>.<section>   the same for one person; wins over the role. Never a code: codes are secrets
                                       and no code may sit in a rule row (OV11, 14 Nov 2026).
     nav.view.<view>                   1 on, 0 off: one view inside a section (starter: Assocs, Table map, Litters, Vet, Enquiries off)
     nav.first.<ROLE>.<section>        which view the section opens on: its place in the chip row (1 = first)
     nav.first.person.<person_id>.<section>   the same for one person; wins over the role
     nav.home.<ROLE>.<card>            Main's cards (Lisa 15 Nov 2026: each person builds their own home): place 1, 2, 3...; 0 = taken off
     nav.home.person.<person_id>.<card>   the same for one person; wins over the role. No rows = the pack's starter cards.
   Chips (Lisa 15 Nov 2026): every section shows all its views as chips at the top, with counts. They replace the
   "Next: X" buttons at the foot of the page, so any view is one tap away at any number of records.
   No nav rows: the app's starting layout (STARTER), reported as not set so Settings can say so. */
(function (root) {
  'use strict';
  /* Every view, by route. Temps opens the temperature history page. */
  var VIEWS = {
    today: { label: 'Today', icon: 't-cal' },
    work: { label: 'Do', icon: 't-do' },
    map: { label: 'Main', icon: 't-main' },   /* the Live feed: Main's own page */
    compliance: { label: 'Compliance', icon: 's-check' },
    yearly: { label: 'Yearly print', icon: 's-check' },
    items: { label: 'Items', icon: 't-box' },
    breed: { label: 'Breed Better', icon: 's-check' },
    dogs: { label: 'Dogs', icon: 't-paw' },
    litters: { label: 'Litters', icon: 't-paw' },
    areas: { label: 'Areas', icon: 't-room' },
    round: { label: 'The round', icon: 's-repeat' },
    sops: { label: 'SOPs', icon: 't-line' },
    temps: { label: 'Temps', icon: 't-temp', href: './history.html' },
    staff: { label: 'Staff', icon: 't-user' },
    enquiries: { label: 'Enquiries', icon: 't-world' },
    admin: { label: 'Settings', icon: 't-box' },
    qrprint: { label: 'Print QR cards', icon: 't-print', href: printCardsHref }
  };
  /* Main, then the sections in colour order, then Settings. go = the view the tab opens. */
  var SECTIONS = [
    { id: 'main', label: 'Main', slot: '1', icon: 't-main', go: 'map', views: ['map', 'today', 'work'] },
    { id: 'compliance', label: 'Compliance', slot: '2', icon: 's-check', go: 'compliance', views: ['compliance', 'items', 'breed', 'yearly'] },   /* Breed Better: a welfare and standards scheme, its own brick. Yearly print: one A4 page per month for every record */
    { id: 'money', label: 'Money', slot: '3', icon: 't-money', go: 'money', views: [] },
    { id: 'ops', label: 'Records', slot: '4', icon: 't-box', go: 'dogs', views: ['dogs', 'litters', 'areas', 'round', 'sops', 'temps'] },
    { id: 'people', label: 'People', slot: '5', icon: 't-user', go: 'staff', views: ['staff'] },
    { id: 'sales', label: 'Sales', slot: '6', icon: 't-bag', go: 'enquiries', views: ['enquiries'] },
    { id: 'ideas', label: 'Ideas', slot: '7', icon: 't-line', go: 'ideas', views: [] },
    { id: 'settings', label: 'Settings', slot: '8', icon: 't-box', go: 'admin', views: ['admin', 'qrprint'] }
  ];
  /* The starting layout for a new app (Lisa 14 Nov): Main · Compliance · Records · People · More. Proposed default, not a rule. */
  var STARTER = { on: { compliance: 1, ops: 1, people: 1, sales: 1 }, tabs: ['compliance', 'ops', 'people'] };
  /* Views a pack starts with switched off (Lisa approved 13 Nov 2026, PR 472: hide Assocs, the Table map and Litters; the vet
     link stays off). An owner switches one back on with a dated row nav.view.<id> = 1 (0 = off). Hidden views are off every
     menu, chip row, Find and Main card, and their addresses open Main. Their pages and data stay. */
  var STARTER_OFF = { buyers: 1, shape: 1, litters: 1, vet: 1, enquiries: 1 };
  function viewOn(o) {
    o = o || {};
    var r = inForce(o.rows, o.iso)['nav.view.' + o.id];
    return r ? r.value >= 1 : !STARTER_OFF[o.id];
  }
  var PICKABLE = ['compliance', 'money', 'ops', 'people', 'sales', 'ideas'];
  var MAX_TABS = 3;

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  /* Same address as staffBase() + 'print/': origin + this directory + staff/print/. */
  function printCardsHref() {
    var loc = root.location || {};
    return String(loc.origin || '') + String(loc.pathname || '').replace(/[^/]*$/, '') + 'staff/print/';
  }
  function viewHref(v) { return !v ? '' : (typeof v.href === 'function' ? v.href() : (v.href || '')); }
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
    /* The view each section opens on: the person's pick, else the role's, else the section's own. */
    var first = {};
    SECTIONS.forEach(function (s) {
      var r = (o.person && rows['nav.first.person.' + o.person + '.' + s.id]) || (o.role && rows['nav.first.' + o.role + '.' + s.id]);
      var live = s.views.filter(has), v = r && live[r.value - 1];
      if (v) first[s.id] = v;
    });
    /* The view the hub opens on with no address (Lisa 18 Nov 2026 demo: the owner lands on Records). A dated row
       nav.start.person.<id> or nav.start.<role> = the section's slot number (1 Main, 2 Compliance, 4 Records ...). No row: Main. */
    var start = '', sr = (o.person && rows['nav.start.person.' + o.person]) || (o.role && rows['nav.start.' + o.role]);
    SECTIONS.forEach(function (s) {
      if (start || !sr || s.slot !== String(sr.value) || (s.id !== 'main' && !on[s.id])) return;
      start = first[s.id] || (has(s.go) ? s.go : (s.views.filter(has)[0] || ''));
    });
    return { tabs: tabs, on: on, set: set, first: first, start: start };
  }

  function viewItem(id, slot, opts, has) {
    var v = VIEWS[id];
    if (!v || !has(id)) return '';
    var icon = root.DashKit.icon(v.icon);
    var current = opts.current === id ? ' aria-current="page"' : '';
    var href = viewHref(v);
    if (opts.links === 'href' || href) {
      return '<a href="' + esc(href || ('./index.html#/' + id)) + '" data-slot="' + esc(slot) + '"' + current + '>' + icon + '<span class="htl">' + esc(v.label) + '</span></a>';
    }
    return '<button type="button" data-go="' + esc(id) + '" data-slot="' + esc(slot) + '"' + current + '>' + icon + '<span class="htl">' + esc(v.label) + '</span></button>';
  }

  /* html(opts): opts.layout from layout(); opts.has(view); opts.current (href pages); opts.counts / opts.late keyed by view. */
  function html(opts) {
    opts = opts || {};
    var DK = root.DashKit;
    var has = opts.has || function (id) { return id !== 'breed' && id !== 'admin' && id !== 'qrprint'; };   /* pages without the rows (temperature history); Print QR cards are the owner's, like Settings */
    var lay = opts.layout || layout({ has: has });
    var cur = opts.current ? sectionOf(opts.current) : null;
    var bar = [section('main')].concat(lay.tabs.map(section)), onBar = {};
    function goOf(s) { var f = lay.first && lay.first[s.id]; return f || (has(s.go) ? s.go : (s.views.filter(has)[0] || s.go)); }
    bar.forEach(function (s) { onBar[goOf(s)] = true; });
    var tabs = bar.map(function (s) {
      var go = goOf(s);
      var o = { slot: s.slot, icon: s.icon, label: s.label, nav: s.id };
      if (opts.links === 'href') o.href = viewHref(VIEWS[go]) || ('./index.html#/' + go);
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

  /* chips(opts): the chip row for the section that holds opts.current. Every view of that section that exists here,
     in order, each with its count (opts.counts[view]; opts.late[view] = late). '' when the section has one view or none. */
  function chips(opts) {
    opts = opts || {};
    var has = opts.has || function () { return true; };
    var s = opts.current ? sectionOf(opts.current) : null;
    if (!s) return '';
    var live = s.views.filter(function (id) { return VIEWS[id] && has(id); });
    if (live.length < 2) return '';
    return live.map(function (id) {
      /* the house chip (house.css 4, 5) and house count (.cnt; 0 writes nothing). Selected (Lisa 15 Nov 2026): the 3px section-colour
         side line (.house-lbar, --sc from data-slot) and a tick; no fill. */
      var v = VIEWS[id], n = opts.counts && opts.counts[id], on = opts.current === id, href = viewHref(v);
      var cls = 'chip hchip' + (on ? ' house-lbar' : ''), cur = on ? ' aria-current="page"' : '';
      var cnt = n ? ' <span class="cnt' + (opts.late && opts.late[id] ? ' need' : '') + (String(n).length > 2 ? ' wide' : '') + '">' + esc(n) + '</span>' : '';
      var inner = (on ? '<span class="hck" aria-hidden="true">\u2713</span>' : '') + '<span class="hcl">' + esc(v.label) + '</span>' + cnt;
      return href ? '<a class="' + cls + '" href="' + esc(href) + '" data-slot="' + esc(s.slot) + '"' + cur + '>' + inner + '</a>'
        : '<button type="button" class="' + cls + '" data-go="' + esc(id) + '" data-slot="' + esc(s.slot) + '"' + cur + '>' + inner + '</button>';
    }).join('');
  }

  /* Back (Lisa 15 Nov 2026: "navigating through and back is not easy"). One helper for the whole hub and its bricks:
     every move into a record or view is a real history entry, so the phone's Back works, and the entry remembers where
     you came from (its address, its name, how far down you were). Shape: history.state.from = {hash, label, y, id}. */
  var back = {
    /* push(hash, {label, id, y}): go to hash and remember this place. Call it on any tap into a record. */
    push: function (hash, o) {
      o = o || {};
      var w = root, from = { hash: w.location.hash || '#/map', label: o.label || '', y: o.y != null ? o.y : (w.scrollY || 0), id: o.id || '' };   /* o.y: how far down, read before the page redrew */
      try { w.history.replaceState(Object.assign({}, w.history.state || {}, { y: from.y }), ''); } catch (e) { /* no history: fine */ }
      w.history.pushState(Object.assign({}, o.state || {}, { from: from }), '', hash);
    },
    /* replace(hash): change the address without a new Back step (Prev / Next, tabs inside a record). Keeps where you came from. */
    replace: function (hash) { root.history.replaceState(root.history.state || {}, '', hash); },
    /* from(): where this entry came from, or null (a link opened cold). */
    from: function () { var st = root.history && root.history.state; return st && st.from && st.from.hash ? st.from : null; },
    /* button(fallback): "← Back to X". With no from (opened cold), a link to fallback = {hash, label} instead, or ''. */
    button: function (fallback) {
      var f = back.from();
      if (f && f.label) return '<button type="button" class="cb hback" data-hub-back>\u2190 Back to ' + esc(f.label) + '</button>';
      if (fallback && fallback.hash) return '<a class="cb hback" href="' + esc(fallback.hash) + '">\u2190 ' + esc(fallback.label || 'Back') + '</a>';
      return '';
    },
    /* sync(el, fallback): the Back button in the top bar (one app-wide header: Home on the left, Back on the right, OV11 15 Nov
       2026). Shown when there is somewhere in the hub to go back to: this entry's from, or else fallback = {label} for a page
       opened from the hub (the temps page). Hidden on a link opened cold. A click goes back one real history step. */
    sync: function (el, fallback) {
      if (!el) return;
      /* read out "Back (Dogs)": a page's own "← Back to Dogs" link keeps its own name, so the two are never confused */
      var f = back.from() || fallback || null;
      el.classList.toggle('hidden', !f);
      if (f) { el.setAttribute('aria-label', f.label ? 'Back (' + f.label + ')' : 'Back'); el.setAttribute('title', f.label ? 'Back to ' + f.label : 'Back'); }
    }
  };
  if (root.document) root.document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-hub-back]');
    if (b) { e.preventDefault(); root.history.back(); }
  });

  /* home({rows, iso, role, person, cards, starter}) -> the card ids on Main, in order. cards = every card this hub has;
     starter = the pack's starting cards. The person's rows win, then the role's; a set of rows that takes every card off
     leaves Main empty (that person chose it), only no rows at all falls back to the starter. */
  function home(o) {
    o = o || {};
    var rows = inForce(o.rows, o.iso), cards = o.cards || [];
    function pick(prefix) {
      var any = false, p = [];
      cards.forEach(function (id) { var r = rows[prefix + id]; if (r) { any = true; if (r.value >= 1) p.push([r.value, id]); } });
      return any ? p.sort(function (a, b) { return a[0] - b[0] || cards.indexOf(a[1]) - cards.indexOf(b[1]); }).map(function (x) { return x[1]; }) : null;
    }
    return (o.person && pick('nav.home.person.' + o.person + '.')) || (o.role && pick('nav.home.' + o.role + '.'))
      || (o.starter || []).filter(function (id) { return cards.indexOf(id) >= 0; });
  }

  root.HubNav = { VIEWS: VIEWS, SECTIONS: SECTIONS, STARTER: STARTER, layout: layout, home: home, viewOn: viewOn, STARTER_OFF: STARTER_OFF, sectionOf: sectionOf, html: html, chips: chips, back: back, viewHref: viewHref };
})(typeof window !== 'undefined' ? window : this);
