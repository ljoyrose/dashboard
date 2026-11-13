// Small shared helpers used by all three pages.
// Google reads retry by themselves when Google says "too many requests" or has a hiccup:
// up to 4 tries, waiting about 1s, 2s, then 4s (plus a little random extra so tabs do not retry in step).
(function (root) {
  'use strict';
  var TRIES = 4;
  var WAITS = [1000, 2000, 4000];
  var JITTER_MS = 250;
  var BUSY_TEXT = 'Google is busy. Wait a minute, then try again.';

  // ---- Count colours (Lisa, 3 Nov 2026): the ONE rule, used by every page (tokens.css index: Counts).
  //   grey ring ............ waiting, to-do, the Bin (the default)
  //   rose ring (.need) .... LATE: late, overdue (--house-late)
  //   black badge (.broken)  BROKEN: a site down, a domain expired, a project stuck, a check failed, an engine error
  //                          (--house-broken-fill / --house-broken-ink; light ink in the dark looks). The one fill a count may have.
  // A count holding both late and broken things is broken (broken wins): pass the broken word. The screen reader hears the word:
  // "2 late", "1 down", "3 stuck", "4 failed"; a grey count is "N waiting" (or the page's own calm word).
  // why: true (= 'late') | 'late' | 'overdue' | 'down' | 'expired' | 'stuck' | 'failed'; anything else, or a count of 0 or "–", is grey.
  function isWhy(w) { return typeof w === 'string' && /^(late|overdue|down|expired|stuck|failed)$/.test(w); }
  /** The word for a count ('late', 'down'...), or '' when it stays grey. */
  function countWhy(n, why) { var w = why === true ? 'late' : isWhy(why) ? why : ''; return w && n != null && n !== '' && n !== '–' && String(n) !== '0' && n !== false ? w : ''; }
  /** 'late', 'broken' or '' (grey). */
  function countKind(n, why) { var w = countWhy(n, why); return !w ? '' : /^(late|overdue)$/.test(w) ? 'late' : 'broken'; }
  /** The class to add to a count: ' need' (rose ring), ' broken' (black badge) or ''. */
  function countCls(n, why) { var k = countKind(n, why); return k === 'late' ? ' need' : k === 'broken' ? ' broken' : ''; }
  /** What a screen reader hears for a count: "2 stuck" when late or broken, otherwise "2 <calm>" ("2 waiting" by default). */
  function countSay(n, why, calm) { return n + ' ' + (countWhy(n, why) || calm || 'waiting'); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // 429, any 5xx, and a 403 whose reason is a rate limit. Other 403s (no access, API off) are final.
  function shouldRetry(res) {
    if (res.status === 429 || res.status >= 500) return Promise.resolve(true);
    if (res.status !== 403) return Promise.resolve(false);
    return res.clone().json().then(function (b) {
      var e = (b && b.error) || {};
      var reason = (e.errors && e.errors[0] && e.errors[0].reason) || '';
      return /rateLimitExceeded|userRateLimitExceeded/.test(reason + ' ' + (e.message || '')) && !/dailyLimit/i.test(reason);
    }, function () { return false; });
  }

  // fetch() for Google reads. Resolves with the last response (good or bad); never retries a write.
  function googleFetch(url, init) {
    var method = String((init && init.method) || 'GET').toUpperCase();
    var attempt = 0;
    function go() {
      attempt++;
      return root.fetch(url, init).then(function (res) {
        if (res.ok || method !== 'GET' || attempt >= TRIES) return res;
        return shouldRetry(res).then(function (again) {
          if (!again) return res;
          return sleep(WAITS[attempt - 1] + Math.floor(Math.random() * JITTER_MS)).then(go);
        });
      });
    }
    return go();
  }

  // True when an error means Google was rate-limiting (after the retries ran out).
  function isBusy(status, reason) {
    return status === 429 || (status === 403 && /rateLimit|userRateLimit/i.test(String(reason || '')));
  }

  // ---- House look: follow the Look saved in Studio (localStorage 'dash-look', read only here; Studio's Look menu writes it) ----
  // { bg: warm|cool, sel: line|soft, mode: device|light|dark } -> html.look-cool, html.sel-soft, [data-theme]. tokens.css and
  // house.css do the rest, so every hub follows one setting. Runs at once (this file loads in <head>) and when another tab changes it.
  function applyLook() {
    var doc = root.document; if (!doc) return;
    var o = {}; try { o = JSON.parse(root.localStorage.getItem('dash-look') || '{}') || {}; } catch (e) { o = {}; }
    var r = doc.documentElement;
    r.classList.toggle('look-cool', o.bg === 'cool');
    r.classList.toggle('sel-soft', o.sel === 'soft');
    if (o.mode === 'light' || o.mode === 'dark') r.setAttribute('data-theme', o.mode); else r.removeAttribute('data-theme');
  }
  applyLook();
  if (root.addEventListener) root.addEventListener('storage', function (e) { if (e.key === 'dash-look') { applyLook(); syncLookMenu(); } });

  // ---- The top bar's one icon set (Lisa's pick A, 2 Nov): 24px outline icons, stroke 2 (Tabler shapes), as one hidden sprite.
  // Pages draw <svg aria-hidden="true"><use href="#hi-NAME"/></svg>; the sprite is added once, at the top of <body>.
  var ICONS = {
    home: '<path d="M5 12H3l9-9 9 9h-2"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"/>',
    search: '<circle cx="10" cy="10" r="7"/><path d="M21 21l-6-6"/>',
    refresh: '<path d="M20 11a8.1 8.1 0 0 0-15.5-2m-.5-4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>',
    palette: '<path d="M12 21a9 9 0 0 1 0-18c4.97 0 9 3.58 9 8 0 1.06-.47 2.08-1.32 2.83-.84.75-1.99 1.17-3.18 1.17H14a2 2 0 0 0-1 3.75A1.3 1.3 0 0 1 12 21"/><circle cx="8.5" cy="10.5" r="1"/><circle cx="12.5" cy="7.5" r="1"/><circle cx="16.5" cy="10.5" r="1"/>',
    logout: '<path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2"/><path d="M9 12h12l-3-3"/><path d="M18 15l3-3"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    apps: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/><path d="M14 7h6M17 4v6"/>',
    // The bottom tabs' icons (Lisa's picks, 2 Nov): <span class="hic"><svg class="hi"><use href="#hi-t-NAME"/></svg></span>.
    't-main': '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    't-do': '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3l5-6"/>',
    't-decide': '<path d="M12 4v16M6 8h12M6 8l-3 6h6zM18 8l-3 6h6z"/>',
    't-cal': '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    't-money': '<path d="M16.7 8a3 3 0 0 0-2.7-2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1-2.7-2M12 3v3M12 18v3"/>',
    't-user': '<circle cx="12" cy="8" r="4"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    't-chat': '<path d="M4 18l2-4a8 6 0 1 1 3 2z"/>',
    't-box': '<path d="M4 8l8-4l8 4v8l-8 4l-8-4zM4 8l8 4l8-4M12 12v8"/>',
    't-bag': '<path d="M5 8h14l-1 12h-12zM9 8a3 3 0 0 1 6 0"/>',
    't-truck': '<path d="M3 7h11v9h-11zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    't-paw': '<circle cx="12" cy="15" r="4"/><circle cx="6" cy="9" r="2"/><circle cx="18" cy="9" r="2"/><circle cx="10" cy="5" r="2"/><circle cx="14" cy="5" r="2"/>',
    't-line': '<path d="M4 12h16M7 8v8M12 8v8M17 8v8"/>',
    't-room': '<path d="M4 20v-10l8-6l8 6v10z"/>',
    't-world': '<circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 0 0 0 18M12.5 3a17 17 0 0 1 0 18"/>',
    't-more': '<circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/>',
    // Status icons for badges (quality review, 12 Nov 2026: house icons, not emoji). Tabler shapes, the same stroke.
    's-check': '<circle cx="12" cy="12" r="9"/><path d="M9 12l2 2l4-4"/>',
    's-x': '<circle cx="12" cy="12" r="9"/><path d="M10 10l4 4m0-4l-4 4"/>',
    's-alert': '<path d="M12 9v4"/><path d="M10.4 3.6l-8.1 13.5a1.9 1.9 0 0 0 1.6 2.9h16.2a1.9 1.9 0 0 0 1.6-2.9l-8.1-13.5a1.9 1.9 0 0 0-3.2 0z"/><path d="M12 16h.01"/>',
    's-clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    's-repeat': '<path d="M4 12v-3a3 3 0 0 1 3-3h13m-3-3l3 3l-3 3"/><path d="M20 12v3a3 3 0 0 1-3 3h-13m3 3l-3-3l3-3"/>',
    's-send': '<path d="M10 14l11-11"/><path d="M21 3l-6.5 18a.55 .55 0 0 1-1 0l-3.5-7l-7-3.5a.55 .55 0 0 1 0-1l18-6.5"/>',
    // The fold chevron on every section heading (Lisa, 2 Nov): Tabler chevron-down, grey; it turns a quarter when the section is folded.
    chev: '<path d="M6 9l6 6l6-6"/>'
  };
  function addIcons() {
    var doc = root.document; if (!doc || !doc.body || doc.getElementById('houseIcons')) return;
    var d = doc.createElement('div');
    d.innerHTML = '<svg id="houseIcons" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">' +
      Object.keys(ICONS).map(function (k) { return '<symbol id="hi-' + k + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[k] + '</symbol>'; }).join('') + '</svg>';
    doc.body.insertBefore(d.firstChild, doc.body.firstChild);
  }
  /** The HTML of one icon from the top bar's set (hidden from screen readers: the button carries the name). */
  function icon(name) { return '<svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-' + name + '"/></svg>'; }
  /** One top-bar button that is Sign in (a word button, the one call to action) when signed out and the Sign out icon when signed in. */
  function signButton(b, signedIn) {
    if (!b) return;
    b.setAttribute('data-action', signedIn ? 'signout' : 'signin');
    b.classList.toggle('house-ib', !!signedIn);
    if (signedIn) { if (!b.querySelector('svg')) b.innerHTML = icon('logout'); b.setAttribute('aria-label', 'Sign out'); b.title = 'Sign out'; }
    else { if (b.textContent !== 'Sign in' || b.querySelector('svg')) b.textContent = 'Sign in'; b.removeAttribute('aria-label'); b.removeAttribute('title'); }
  }

  // ---- Look button + menu on every page (Lisa, 2 Nov): pages place <span class="lookwrap" data-house-look></span> in the top bar.
  // The menu offers what applyLook supports and saves it in 'dash-look', merged, so Studio's own keys (words, text, space) stay.
  // On a phone it also shows the read time and a Sign out item that presses the page's own Sign out (both leave the bar there).
  var LOOK_ROWS = [['bg', 'Background', [['warm', 'Warm clear'], ['cool', 'Cool clear']]], ['sel', 'Selected', [['line', 'Outline'], ['soft', 'Soft tint']]],
    ['mode', 'Mode', [['device', 'Device'], ['light', 'Light'], ['dark', 'Dark']]]];
  function readLook() { var o = {}; try { o = JSON.parse(root.localStorage.getItem('dash-look') || '{}') || {}; } catch (e) { o = {}; } return typeof o === 'object' ? o : {}; }
  function lookVal(o, row) { return row[2].some(function (x) { return x[0] === o[row[0]]; }) ? o[row[0]] : row[2][0][0]; }
  function setLook(key, val) {
    var o = readLook(); o[key] = val;
    try { root.localStorage.setItem('dash-look', JSON.stringify(o)); } catch (e) { /* private window: this page still changes */ }
    var r = root.document.documentElement;
    if (key === 'bg') r.classList.toggle('look-cool', val === 'cool');
    else if (key === 'sel') r.classList.toggle('sel-soft', val === 'soft');
    else if (key === 'mode') { if (val === 'light' || val === 'dark') r.setAttribute('data-theme', val); else r.removeAttribute('data-theme'); }
  }
  // The page's own Sign out in the top bar, when it is there (signed in). Hidden only by the phone rule counts as there.
  function headSignout() {
    var doc = root.document, b = doc.querySelector('header [data-action="signout"], header [data-signout]');
    return b && !b.disabled && !b.hidden && !b.closest('.hidden, [hidden]') ? b : null;
  }
  function headRead() {
    var e = root.document.querySelector('header [data-house-read]'); if (!e || e.closest('.hidden, [hidden]')) return '';
    return String(e.getAttribute('data-read') || e.textContent || '').trim();
  }
  /** The phone-only part of a Look menu: the read time and Sign out (Studio adds it to its own fuller menu). */
  function lookExtras() {
    var t = headRead(), out = headSignout();
    return (t ? '<p class="house-mread house-phone" data-house-mread>' + escHtml(t) + '</p>' : '') +
      (out ? '<button type="button" class="btn house-mitem house-phone" data-house-menu-signout>' + icon('logout') + '<span>Sign out</span></button>' : '');
  }
  function lookBody() {
    var o = readLook();
    return LOOK_ROWS.map(function (l) { return '<div class="lrow"><span class="flab" id="houseLook-' + l[0] + '">' + l[1] + '</span><div class="seg" role="group" aria-labelledby="houseLook-' + l[0] + '">' +
        l[2].map(function (x) { return '<button type="button" data-house-look-set="' + l[0] + '" data-val="' + x[0] + '" aria-pressed="' + (lookVal(o, l) === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div></div>'; }).join('') +
      lookExtras();
  }
  function lookParts() { var doc = root.document; return { b: doc.getElementById('houseLookBtn'), m: doc.getElementById('houseLook') }; }
  function showHouseLook(on, back) {
    var p = lookParts(); if (!p.b || !p.m) return;
    if (on) p.m.innerHTML = lookBody();
    p.m.hidden = !on; p.b.setAttribute('aria-expanded', String(!!on));
    if (on) { var f = p.m.querySelector('[aria-pressed="true"]') || p.m.querySelector('button'); if (f) f.focus(); }
    else if (back) p.b.focus();
  }
  function syncLookMenu() { var p = lookParts(); if (p.m && !p.m.hidden) { var a = root.document.activeElement, k = a && a.getAttribute && a.getAttribute('data-house-look-set'), v = a && a.getAttribute && a.getAttribute('data-val'); p.m.innerHTML = lookBody(); if (k) { var n = p.m.querySelector('[data-house-look-set="' + k + '"][data-val="' + v + '"]'); if (n) n.focus(); } } }
  function fillLook() {
    var doc = root.document;
    Array.prototype.forEach.call(doc.querySelectorAll('[data-house-look]'), function (w) {
      if (w.firstChild) return;
      w.innerHTML = '<button type="button" class="btn house-ib" id="houseLookBtn" aria-label="Look" title="Look" aria-expanded="false" aria-controls="houseLook">' + icon('palette') + '</button>' +
        '<div id="houseLook" class="house-menu" role="dialog" aria-label="Look" hidden></div>';
    });
  }
  if (root.document) {
    var ready = function () { addIcons(); fillLook(); };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', ready); else ready();
    root.document.addEventListener('click', function (e) {
      var t = e.target, p = lookParts();
      var o = t.closest && t.closest('[data-house-menu-signout]');
      if (o) { var b = headSignout(); if (p.m) showHouseLook(false); if (b) b.click(); return; }
      if (!p.m) return;
      if (t.closest && t.closest('#houseLookBtn')) { showHouseLook(p.m.hidden); return; }
      var s = t.closest && t.closest('[data-house-look-set]');
      if (s) { setLook(s.getAttribute('data-house-look-set'), s.getAttribute('data-val')); syncLookMenu(); return; }
      if (!p.m.hidden && !(t.closest && t.closest('#houseLook'))) showHouseLook(false);
    });
    root.document.addEventListener('keydown', function (e) { var p = lookParts(); if (e.key === 'Escape' && p.m && !p.m.hidden) { e.preventDefault(); showHouseLook(false, true); } });
  }

  // ---- Top bar: the hub's name in the middle (Lisa's pick A, 2 Nov). From 768px up, house.css gives the name all the room between
  // the left and right icons (so it never overlaps them); this pads its shorter side so the words centre on the whole bar, the same
  // spot on every page. The padding never squeezes the name below 120px (or its own width): past that it moves aside, then cuts with ...
  // On a phone the name stays left after the Home icon: house.css uses the padding only from 768px up, so a resize never overflows.
  var NAME_MIN = 120, nameFrame = 0;
  function centreName() {
    nameFrame = 0;
    var doc = root.document, wide = root.matchMedia && root.matchMedia('(min-width: 768px)').matches;
    Array.prototype.forEach.call(doc.querySelectorAll('header .house-row > h1'), function (h) {
      h.style.removeProperty('--house-name-pl'); h.style.removeProperty('--house-name-pr');
      if (!wide) return;
      var r = h.parentNode.getBoundingClientRect(), b = h.getBoundingClientRect();
      if (!b.width) return;
      var rg = doc.createRange(); rg.selectNodeContents(h);
      var words = rg.getBoundingClientRect().width, d = (r.right - b.right) - (b.left - r.left);
      var pad = Math.min(Math.abs(d), Math.max(0, b.width - Math.min(words, NAME_MIN)));
      if (pad > 0.5) h.style.setProperty(d > 0 ? '--house-name-pl' : '--house-name-pr', pad + 'px');
    });
  }
  function centreNameSoon() { if (!nameFrame) nameFrame = (root.requestAnimationFrame || root.setTimeout)(centreName); }
  function watchName() {
    var doc = root.document, rows = doc.querySelectorAll('header .house-row');
    if (!rows.length) return;
    centreName();
    if (root.ResizeObserver) {
      // The row and everything in it except the name (its own padding would start a loop): buttons that show, hide or change words.
      var ro = new root.ResizeObserver(centreNameSoon);
      Array.prototype.forEach.call(rows, function (row) { ro.observe(row); Array.prototype.forEach.call(row.children, function (c) { if (c.tagName !== 'H1') ro.observe(c); }); });
    }
    root.addEventListener('resize', centreNameSoon);
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(centreNameSoon, function () {});
  }
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', watchName); else watchName();
  }

  // ---- Bottom tabs: the More menu (Lisa's picks, 2 Nov). Pages write the bar (house.css section 6); More is a button with
  // data-house-more and aria-controls naming its menu. One click opens or shuts it; choosing a view, a click outside, Esc or a new
  // address shuts it (Esc puts the focus back on More). Delegated, so it keeps working when a page redraws its bar.
  function moreMenu(b) { return b && root.document.getElementById(b.getAttribute('aria-controls') || ''); }
  function showMore(b, on, back) {
    var m = moreMenu(b); if (!m) return;
    m.hidden = !on; b.setAttribute('aria-expanded', String(!!on));
    if (on) { var f = m.querySelector('[aria-current="page"]') || m.querySelector('a, button'); if (f) f.focus(); }
    else if (back) b.focus();
  }
  function shutMores(except, back) {
    Array.prototype.forEach.call(root.document.querySelectorAll('[data-house-more][aria-expanded="true"]'), function (b) { if (b !== except) showMore(b, false, back); });
  }
  /** The HTML of one bottom tab: { href | go, nav, slot (0-8), icon (t-NAME), label, n (count id), need (true = late, rose ring; or the word, e.g. 'down' = broken, black badge: see countWhy) }. */
  function tabHtml(t) {
    var inner = '<span class="bar" aria-hidden="true"></span><span class="hic" aria-hidden="true">' + icon(t.icon) + '</span><span class="htl">' + escHtml(t.label) + '</span>' +
      (t.count != null ? '<span class="n' + countCls(t.count, t.need) + '"' + (t.n ? ' id="' + t.n + '"' : '') + (isWhy(t.need) ? ' data-why="' + t.need + '"' : '') + '>' + escHtml(t.count || '') + '</span>' : '');
    return t.href ? '<a class="ht" data-slot="' + t.slot + '" href="' + t.href + '"' + (t.nav ? ' data-nav="' + t.nav + '"' : '') + '>' + inner + '</a>'
      : '<button type="button" class="ht" data-slot="' + t.slot + '"' + (t.go ? ' data-go="' + t.go + '"' : '') + '>' + inner + '</button>';
  }
  /** The HTML of More (always the last tab) and its menu; items is the menu's own HTML (links or buttons). */
  function moreHtml(id, items) {
    return '<div class="ht-more"><button type="button" class="ht" data-slot="0" data-house-more aria-expanded="false" aria-controls="' + id + '">' +
      '<span class="bar" aria-hidden="true"></span><span class="hic" aria-hidden="true">' + icon('t-more') + '</span><span class="htl">More</span></button>' +
      '<div class="house-more" id="' + id + '" hidden>' + items + '</div></div>';
  }
  if (root.document) {
    root.document.addEventListener('click', function (e) {
      var t = e.target, b = t.closest && t.closest('[data-house-more]');
      if (b) { var on = b.getAttribute('aria-expanded') !== 'true'; shutMores(b); showMore(b, on); return; }
      var inMenu = t.closest && t.closest('.house-more');
      if (inMenu) { if (t.closest('a, button')) shutMores(null); return; }
      shutMores(null);
    });
    root.document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var open = root.document.querySelector('[data-house-more][aria-expanded="true"]');
      if (open) { e.preventDefault(); showMore(open, false, true); }
    });
    if (root.addEventListener) root.addEventListener('hashchange', function () { shutMores(null); });
  }

  // ---- Tab names say the count ("Do, 3 waiting" / "Do, 1 late" / "Do, 1 down": the count's data-why, see DashKit.count; a phone shows only a dot), and --house-tab-fit = the longest word's room, so every phone tab is one size (house.css).
  function nameTabs(nav) {
    var fit = 0;
    Array.prototype.forEach.call(nav.querySelectorAll(':scope > .ht, :scope > .ht-more > .ht'), function (t) {
      var w = t.querySelector(':scope > .htl'), n = t.querySelector(':scope > .n, :scope > .cnt'), s; if (!w) return;
      s = root.getComputedStyle(w); fit = Math.max(fit, Math.ceil(w.scrollWidth + parseFloat(s.marginLeft) * 2));
      if (!n) return;
      var c = n.textContent.trim(), name = (w.querySelector(':scope > .htl-long') || w).textContent.trim() + (c ? ', ' + c + (n.classList.contains('need') || n.classList.contains('broken') ? ' ' + (isWhy(n.getAttribute('data-why')) ? n.getAttribute('data-why') : n.classList.contains('broken') ? 'broken' : 'late') : ' waiting') : '');
      if (t.getAttribute('aria-label') !== name) t.setAttribute('aria-label', name);
    });
    if (nav.style.getPropertyValue('--house-tab-fit') !== (fit ? fit + 'px' : '')) nav.style.setProperty('--house-tab-fit', fit ? fit + 'px' : '');
  }
  function watchTabs() {
    var navs = root.document.querySelectorAll('nav.house-tabs'), all = function () { Array.prototype.forEach.call(navs, nameTabs); };
    Array.prototype.forEach.call(navs, function (nav) {
      nameTabs(nav);
      if (root.MutationObserver) new root.MutationObserver(function () { nameTabs(nav); }).observe(nav, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'aria-label'] });
    });
    if (root.document.fonts) root.document.fonts.ready.then(all);   // words change width when the web font arrives
    root.addEventListener('resize', all);
  }
  if (root.document) { if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', watchTabs); else watchTabs(); }

  // ---- Phone filters: one calm row. Filter groups (.house-filters, each with an id) fold behind ONE Filter button
  // (.house-fbtn, data-house-filter="<id> [<id>...]") on a phone; on a desktop the button is hidden and the chips show inline (house.css).
  // The open / shut state survives the page redrawing its chips (pages redraw on every tap).
  var openFilters = {};
  function syncFilters() {
    var doc = root.document; if (!doc) return;
    Array.prototype.forEach.call(doc.querySelectorAll('[data-house-filter]'), function (b) {
      var key = b.getAttribute('data-house-filter'), on = !!openFilters[key];
      if (b.getAttribute('aria-expanded') !== String(on)) b.setAttribute('aria-expanded', String(on));
      key.split(/\s+/).forEach(function (id) { var g = doc.getElementById(id); if (g && g.classList.contains('open') !== on) g.classList.toggle('open', on); });
    });
  }
  if (root.document) {
    root.document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-house-filter]');
      if (!b) return;
      var id = b.getAttribute('data-house-filter');
      openFilters[id] = !openFilters[id];
      syncFilters();
    });
    if (root.MutationObserver) root.document.addEventListener('DOMContentLoaded', function () {
      new root.MutationObserver(syncFilters).observe(root.document.body, { childList: true, subtree: true });
    });
  }
  // The Filter button's own HTML: the word, and how many filters are on (a count pill; none when 0).
  function filterButton(id, on) {
    return '<button class="btn house-fbtn" type="button" data-house-filter="' + id + '" aria-controls="' + id + '" aria-expanded="' + !!openFilters[id] + '">Filter' + (on ? '<span class="cnt">' + on + '</span>' : '') + '</button>';
  }

  // ---- Site root (where toolkit.js lives), so the same keys and install code work on all three pages ----
  var SITE = (function () {
    var s = root.document && root.document.currentScript;
    try { return new URL('./', s && s.src ? s.src : root.location.href).href; } catch (e) { return './'; }
  })();

  // ---- Phone install (service worker keeps page files only, never Drive data or the token) ----
  if (root.navigator && 'serviceWorker' in root.navigator && root.isSecureContext) {
    root.addEventListener('load', function () { root.navigator.serviceWorker.register(SITE + 'sw.js').catch(function () { /* install is optional */ }); });
  }

  // ---- "Dashboard" button (top right of every page that is not the home page) ----
  // Hub pages open in their own tab. If this tab was opened from the dashboard (same site), bring that tab
  // to the front and close this one. Otherwise just go to the dashboard in this tab.
  function backHome(e) {
    var o = null;
    try { o = root.opener; } catch (x) { o = null; }
    try {
      if (o && !o.closed && o.location.origin === root.location.origin && o.location.pathname === new URL(SITE).pathname) {
        if (e) e.preventDefault();
        o.focus();
        root.close();
        return true;
      }
    } catch (x) { /* another site or closed: fall through to the link */ }
    return false;
  }
  if (root.document) root.document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-back-home]');
    if (b && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) backHome(e);
  });

  // ---- Icon-font fallback: a few pages draw icons with the Tabler icon font from a CDN. If that font does not arrive, a button with
  // only an icon would show nothing, so it shows its name (from aria-label or title) as a word instead. Never runs when icons draw.
  function iconFontMissing() {
    var d = root.document, p = d.createElement('i'); p.className = 'ti ti-check'; p.style.cssText = 'position:absolute;left:-99px;top:0';
    d.body.appendChild(p); var c = root.getComputedStyle(p, '::before').content, w = p.getBoundingClientRect().width; d.body.removeChild(p);
    return !c || c === 'none' || c === 'normal' || w < 1;
  }
  function wordForIcons() {
    Array.prototype.forEach.call(root.document.querySelectorAll('button, a'), function (b) {
      if (b.textContent.trim() || b.querySelector('svg, img, .house-iw')) return;
      var i = b.querySelector('i.ti'), w = b.getAttribute('aria-label') || b.getAttribute('title');
      if (!i || !w) return;
      var s = root.document.createElement('span'); s.className = 'house-iw'; s.setAttribute('aria-hidden', 'true'); s.textContent = w.replace(/:.*$/, ''); b.appendChild(s);
    });
  }
  function watchIconFont() {
    var d = root.document; if (!d || !d.querySelector('link[href*="tabler-icons"]') || !root.MutationObserver) return;
    var go = function () {
      if (!iconFontMissing()) return;
      d.documentElement.classList.add('house-noicons'); wordForIcons();
      var t = 0; new root.MutationObserver(function () { if (!t) t = root.setTimeout(function () { t = 0; wordForIcons(); }, 0); }).observe(d.body, { childList: true, subtree: true });
    };
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(go); else root.setTimeout(go, 0);
  }
  if (root.document) { if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', watchIconFont); else watchIconFont(); }

  // ---- Clickable info (Lisa, 2 Nov 2026: "anywhere you give info should be clickable to get it") ----
  // A row or card marked data-open-row opens what it shows: a click anywhere on it (its chips, pills, numbers, words) presses its one
  // .house-open link or button. Its own buttons and links still do their own thing. Keyboard: the .house-open control is the tab stop.
  if (root.document) root.document.addEventListener('click', function (e) {
    var t = e.target; if (e.defaultPrevented || e.button !== 0 || !t || !t.closest) return;
    var r = t.closest('[data-open-row]'); if (!r) return;
    if (t.closest('a, button, summary, input, select, textarea, label, [contenteditable="true"]')) return;
    if (root.getSelection && String(root.getSelection())) return;   // selecting words, not opening
    var o = r.querySelector('.house-open'); if (o) o.click();
  });

  // ---- Fold (Lisa, 2 Nov 2026): every card or section with a heading folds down to its heading row, on every page and tab.
  // One enhancer, run after every redraw (a MutationObserver on <body>), so no page writes its own: a .card or <section> whose first
  // part is an h2 / h3 (or a heading row holding one) gets ONE real button, the grey chevron, with aria-expanded and aria-controls.
  // Tapping the heading row (not a link or button in it) or the chevron folds and opens; Enter and Space work on the chevron.
  // Whatever sits in the heading row (its count ring, its link) stays in view when folded. Each fold is remembered per page, view
  // and section in localStorage 'dash-fold'. Default open; on a phone (under 768px) a list of more than 5 rows starts at its
  // first 3 rows with a "+N more" button that opens the rest (remembered too). Not here: <details> folds pages already draw,
  // header, the bottom tabs, menus, dialogs, link cards, and anything marked data-no-fold.
  var FOLD_KEY = 'dash-fold', FOLD_MAX = 400, FOLD_ROWS = 5, FOLD_SHOW = 3;
  var FOLD_SKIP = 'header, nav, dialog, details, summary, [role="dialog"], .house-menu, .house-more, a, button, [data-no-fold]';
  var FOLD_HOT = 'a, button, input, select, textarea, label, summary, [tabindex], [contenteditable="true"], [data-action], [data-go], [role="button"], [onclick]';
  var FOLD_NOTNAME = '.cnt, .n, .ct, .count, .badge, .dpill, .tag, .chip, .mtag, .state, .pill, svg, .ti, .sr, [aria-hidden="true"], .house-fold';
  var foldMem = null, foldSeq = 0;
  function foldStore() {
    if (foldMem) return foldMem;
    try { foldMem = JSON.parse(root.localStorage.getItem(FOLD_KEY) || '{}'); } catch (e) { foldMem = {}; }
    if (!foldMem || typeof foldMem !== 'object' || Array.isArray(foldMem)) foldMem = {};
    return foldMem;
  }
  function foldSave(k, v) {
    var m = foldStore(); delete m[k]; if (v != null) m[k] = v;   // the newest goes last; the oldest go first past FOLD_MAX
    var ks = Object.keys(m); while (ks.length > FOLD_MAX) delete m[ks.shift()];
    try { root.localStorage.setItem(FOLD_KEY, JSON.stringify(m)); } catch (e) { /* private window: the fold still works on this page */ }
  }
  function foldPhone() { return !!(root.matchMedia && root.matchMedia('(max-width: 767.98px)').matches); }
  function foldPage() { var h = String(root.location.hash || '').split('?')[0]; return root.location.pathname + (h || '#'); }
  // The heading's own words (not its count, pills or icons): the button's name and the remembered key.
  function foldName(h) {
    var s = '';
    (function walk(n) { for (var x = n.firstChild; x; x = x.nextSibling) { if (x.nodeType === 3) s += x.nodeValue; else if (x.nodeType === 1 && !x.matches(FOLD_NOTNAME)) walk(x); } })(h);
    return s.replace(/\s+/g, ' ').trim();
  }
  // The heading row: one of the card's first two parts (our own button aside) that is an h2 / h3 / h4 or holds one as its own child.
  // A short line before it (a label line, a mark) stays in view with it.
  function foldHead(c) {
    for (var k = c.firstElementChild, n = 0; k && n < 2; k = k.nextElementSibling) {
      if (k.classList.contains('house-fold') || k.getAttribute('aria-hidden') === 'true') continue;
      n++;
      if (k.matches('h2, h3, h4')) return { row: k, h: k };
      var h = k.matches('div, header, hgroup') && k.querySelector(':scope > h2, :scope > h3, :scope > h4');
      if (h) return { row: k, h: h };
    }
    return null;
  }
  function foldIcon() { return '<svg class="hi" aria-hidden="true" focusable="false"><use href="#hi-chev"/></svg>'; }
  function foldIdOf(e) { if (!e.id) e.id = 'hfp-' + (++foldSeq); return e.id; }
  function setAttr(e, k, v) { if (v == null) { if (e.hasAttribute(k)) e.removeAttribute(k); } else if (e.getAttribute(k) !== v) e.setAttribute(k, v); }
  function foldUndo(c) {
    var b = c.querySelector(':scope > .house-fold, :scope > * > .house-fold'); if (b) b.remove();
    c.classList.remove('house-fold-rel'); setAttr(c, 'data-house-folded', null); setAttr(c, 'data-fold-box', null);
    Array.prototype.forEach.call(c.querySelectorAll(':scope > [data-fold-part], :scope > [data-fold-row]'), function (e) { setAttr(e, 'data-fold-part', null); setAttr(e, 'data-fold-row', null); e.classList.remove('house-fold-row', 'house-fold-pad'); });
    Array.prototype.forEach.call(c.querySelectorAll('.house-fold-h'), function (h) { if (h.parentNode === c || h.parentNode.parentNode === c) h.classList.remove('house-fold-h'); });
  }
  function foldOne(c, key, phone) {
    var hd = foldHead(c), row = hd && hd.row, parts = [];
    if (row) for (var e = row.nextElementSibling; e; e = e.nextElementSibling) if (!e.classList.contains('house-fold')) parts.push(e);
    if (!parts.length) { if (c.hasAttribute('data-fold-box')) foldUndo(c); return; }
    var name = foldName(hd.h), cs = root.getComputedStyle(row), inRow = row !== hd.h && /flex/.test(cs.display) && !/column/.test(cs.flexDirection);
    var b = c.querySelector(':scope > .house-fold, :scope > * > .house-fold');
    if (!b) {
      b = root.document.createElement('button');
      b.type = 'button'; b.className = 'house-fold'; b.setAttribute('data-house', 'text'); b.innerHTML = foldIcon();
    }
    // In a heading row that is already a flex row, the chevron is its last part; otherwise it sits over the row's right end.
    if (inRow) { if (b.parentNode !== row || b !== row.lastElementChild) row.appendChild(b); }
    else if (b.parentNode !== c || b.nextElementSibling !== row) c.insertBefore(b, row);
    b.classList.toggle('house-fold-abs', !inRow);
    row.classList.toggle('house-fold-row', inRow); row.classList.toggle('house-fold-pad', !inRow);
    if (inRow) { b.style.top = ''; b.style.right = ''; c.classList.remove('house-fold-rel'); hd.h.classList.add('house-fold-h'); }
    else {
      if (!c.classList.contains('house-fold-rel') && root.getComputedStyle(c).position === 'static') c.classList.add('house-fold-rel');
      // Level with the heading's first line, at the card's inner right edge (read from the drawn page; kept while it is not drawn).
      var ccs = root.getComputedStyle(c), hcs = root.getComputedStyle(hd.h), hr = hd.h.getBoundingClientRect(), cr = c.getBoundingClientRect();
      if (hr.height && cr.height) {
        var bh = b.offsetHeight || 36, lh = parseFloat(hcs.lineHeight) || parseFloat(hcs.fontSize) * 1.3 || bh;
        if (hd.h.firstElementChild && /flex/.test(hcs.display)) lh = Math.max(lh, Math.min(hr.height - (parseFloat(hcs.paddingTop) || 0) - (parseFloat(hcs.paddingBottom) || 0), bh + 12));
        var top = Math.round(hr.top - cr.top - c.clientTop + (parseFloat(hcs.paddingTop) || 0) + Math.max(0, (lh - bh) / 2)) + 'px';
        var right = (parseFloat(ccs.paddingRight) || 0) + 'px';
        if (b.style.top !== top) b.style.top = top; if (b.style.right !== right) b.style.right = right;
      }
      hd.h.classList.remove('house-fold-h');
    }
    var folded = foldStore()[key] === 1;
    setAttr(c, 'data-fold-box', key); setAttr(row, 'data-fold-row', ''); setAttr(c, 'data-house-folded', folded ? '' : null);
    parts.forEach(function (p) { setAttr(p, 'data-fold-part', ''); foldIdOf(p); });
    setAttr(b, 'aria-expanded', String(!folded)); setAttr(b, 'aria-controls', parts.map(function (p) { return p.id; }).join(' '));
    setAttr(b, 'aria-label', 'Fold ' + (name || 'this section'));
    foldLists(c, key, phone && !folded);
  }
  // Phone: a list of more than 5 rows shows its first 3 rows and "+N more" (the rest open with one tap, remembered).
  function foldLists(c, key, phone) {
    var n = 0;
    Array.prototype.forEach.call(c.querySelectorAll('ul, ol'), function (l) {
      if (l.parentElement.closest('[data-fold-box]') !== c || l.closest('nav, details, dialog, .house-menu, .house-more, table')) return;
      var lis = Array.prototype.filter.call(l.children, function (x) { return x.tagName === 'LI'; }), lk = key + '|rows' + (n++);
      var more = l.nextElementSibling && l.nextElementSibling.classList.contains('house-fold-more') ? l.nextElementSibling : null;
      var on = phone && lis.length > FOLD_ROWS && foldStore()[lk] !== 1;
      if (on && !more) {   // only a list of rows (stacked) folds, never a line of chips; it must be drawn to tell
        var r = lis.slice(0, FOLD_SHOW).map(function (x) { return x.getBoundingClientRect(); });
        on = r[2].height > 0 && r[1].top >= r[0].bottom - 1 && r[2].top >= r[1].bottom - 1;
      }
      lis.forEach(function (x, i) { setAttr(x, 'data-fold-extra', on && i >= FOLD_SHOW ? '' : null); });
      if (!on) { if (more) more.remove(); return; }
      if (!more) {
        more = root.document.createElement('button'); more.type = 'button'; more.className = 'house-fold-more'; more.setAttribute('data-house', 'text');
        l.parentNode.insertBefore(more, l.nextSibling);
      }
      var t = '+' + (lis.length - FOLD_SHOW) + ' more';
      if (more.textContent !== t) more.textContent = t;
      setAttr(more, 'data-fold-rows', lk); setAttr(more, 'aria-controls', foldIdOf(l)); setAttr(more, 'aria-expanded', 'false');
    });
  }
  function foldAll() {
    var doc = root.document; if (!doc || !doc.body) return;
    var page = foldPage(), phone = foldPhone(), seen = {};
    Array.prototype.forEach.call(doc.querySelectorAll('.card, section'), function (c) {
      if (c.closest(FOLD_SKIP)) { if (c.hasAttribute('data-fold-box')) foldUndo(c); return; }
      var hd = foldHead(c); if (!hd) { if (c.hasAttribute('data-fold-box')) foldUndo(c); return; }
      var id = c.getAttribute('data-fold-id') || (c.id && c.id.indexOf('hfp-') !== 0 ? '#' + c.id : '') || c.getAttribute('data-card') || foldName(hd.h).replace(/\d+/g, '#').slice(0, 80);
      var key = page + '|' + id;
      seen[key] = (seen[key] || 0) + 1; if (seen[key] > 1) key += '~' + seen[key];
      foldOne(c, key, phone);
    });
  }
  function foldSet(c, folded) {
    var key = c.getAttribute('data-fold-box'); if (!key) return;
    foldSave(key, folded ? 1 : null); foldAll();
  }
  function foldToggleBtn(b) {
    var c = b.closest('[data-fold-box]'); if (!c) return;
    foldSet(c, b.getAttribute('aria-expanded') === 'true');
  }
  if (root.document) {
    // Capture, so a page's own click handlers on the card never also act on a fold.
    root.document.addEventListener('click', function (e) {
      var t = e.target; if (!t || !t.closest) return;
      var b = t.closest('.house-fold');
      if (b) { e.stopPropagation(); e.preventDefault(); shutMores(null); foldToggleBtn(b); return; }
      var m = t.closest('.house-fold-more');
      if (m) {
        e.stopPropagation(); e.preventDefault(); shutMores(null);
        var l = root.document.getElementById(m.getAttribute('aria-controls') || ''), first = l && l.querySelector(':scope > li[data-fold-extra]');
        foldSave(m.getAttribute('data-fold-rows'), 1); foldAll();
        var f = first && first.querySelector('a[href], button, [tabindex]'); if (f) f.focus(); else if (l) { l.setAttribute('tabindex', '-1'); l.focus(); }
        return;
      }
      if (e.button !== 0 || e.defaultPrevented) return;
      var row = t.closest('[data-fold-row]'); if (!row || t.closest(FOLD_HOT)) return;
      var c = row.parentNode; if (!c || !c.matches('[data-fold-box]') || c.closest('[data-open-row]')) return;   // a row that opens its item keeps doing that
      if (root.getSelection && String(root.getSelection())) return;   // selecting words, not folding
      var fb = c.querySelector(':scope > .house-fold, :scope > * > .house-fold'); if (!fb) return;
      e.stopPropagation(); shutMores(null); foldToggleBtn(fb);   // a tap outside an open More menu still shuts it
    }, true);
    var foldStart = function () {
      foldAll();
      if (root.MutationObserver) new root.MutationObserver(function (recs) {
        // Our own changes settle in one more pass (foldAll only writes what differs), so this never loops.
        for (var i = 0; i < recs.length; i++) { var t = recs[i].target; if (!(t.closest && t.closest('header, nav.house-tabs'))) { foldAll(); return; } }
      }).observe(root.document.body, { childList: true, subtree: true });
      root.addEventListener('hashchange', foldAll);
      if (root.matchMedia) { var mq = root.matchMedia('(max-width: 767.98px)'); if (mq.addEventListener) mq.addEventListener('change', foldAll); }
      root.addEventListener('storage', function (e) { if (e.key === FOLD_KEY) { foldMem = null; foldAll(); } });
    };
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', foldStart); else foldStart();
  }

  // ---- Keyboard keys: g then a letter to go somewhere, r reread, / search, ? the list ----
  var KEYS = [
    ['g m', 'Dashboard', function () { go('./#/map'); }],
    ['g d', 'Drives', function () { go('./#/drives'); }],
    ['g b', 'Bin', function () { go('./#/bin'); }],
    ['g c', 'Changes', function () { go('./#/changes'); }],
    ['g f', 'Money Hub', function () { go('money/'); }],
    ['g h', 'CD Hub', function () { go('cdhub/'); }],
    ['r', 'Read again', function () { var b = root.document.querySelector('[data-action="refresh"]:not(.hidden):not([disabled]), [data-reload]'); if (b) b.click(); }],
    ['/', 'Search', function () { openSearch(); }],
    ['?', 'Show these keys', function () { help(); }]
  ];
  function go(rel) { var u = new URL(rel, SITE); if (u.href !== root.location.href) root.location.href = u.href; }
  function typing(t) { return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }
  /** Opens the keyboard-keys dialog, building it on first use. Exported as showKeys. */
  function help() {
    var doc = root.document, d = doc.getElementById('dashKeys');
    if (!d) {
      d = doc.createElement('dialog'); d.id = 'dashKeys'; d.setAttribute('aria-labelledby', 'dashKeysTitle');
      d.innerHTML = '<h2 id="dashKeysTitle" style="margin:0 0 8px;font-size:var(--fs-head)">Keyboard keys</h2><table style="border-collapse:collapse">' +
        KEYS.map(function (k) { return '<tr><td style="padding:3px 14px 3px 0"><kbd>' + k[0].replace(' ', '</kbd> then <kbd>') + '</kbd></td><td>' + k[1] + '</td></tr>'; }).join('') +
        '</table><p style="margin:10px 0 0">Keys do nothing while you are typing in a box. Esc closes this.</p><form method="dialog" style="margin-top:10px"><button type="submit" class="house-close">Close</button></form>';
      d.style.cssText = 'max-width:420px;border:1px solid currentColor;border-radius:12px;padding:16px 18px;background:Canvas;color:CanvasText;font:inherit';
      doc.body.appendChild(d);
    }
    if (!d.open) d.showModal();
  }
  var pending = null, pendingAt = 0;
  if (root.document) root.document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    var dlg = root.document.getElementById('dashKeys'), sdl = root.document.getElementById('dashSearch'); if ((dlg && dlg.open) || (sdl && sdl.open)) return;
    var k = e.key, now = Date.now();
    var combo = pending && now - pendingAt < 1500 ? pending + ' ' + k.toLowerCase() : k;
    pending = null;
    if (k === 'g' && combo === 'g') { pending = 'g'; pendingAt = now; return; }
    var hit = KEYS.filter(function (x) { return x[0] === combo; })[0];
    if (!hit) return;
    e.preventDefault();
    hit[2]();
  });

  // ---- One search box (press /). Each page registers what it can search; results are grouped. ----
  // A provider is function (query) -> Promise of [{ group, slot (0-8), title, sub, href | act }].
  // Read-only: providers only read (Drive file names on home, tables already in memory elsewhere).
  var PROVIDERS = [], searchGen = 0, searchTimer = null;
  /** Adds a search provider: fn(query) returns result items or a Promise of them. */
  function registerSearch(fn) { PROVIDERS.push(fn); }
  function escHtml(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function searchDialog() {
    var doc = root.document, d = doc.getElementById('dashSearch');
    if (d) return d;
    d = doc.createElement('dialog'); d.id = 'dashSearch'; d.setAttribute('aria-labelledby', 'dashSearchTitle');
    d.style.cssText = 'width:min(640px,94vw);max-height:80vh;border:1px solid currentColor;border-radius:12px;padding:14px 16px;background:Canvas;color:CanvasText;font:inherit';
    d.innerHTML = '<h2 id="dashSearchTitle" style="margin:0 0 8px;font-size:var(--fs-head)">Search</h2>' +
      '<label for="dashSearchBox" style="display:block;font-size:var(--fs-small)">Drive file names, Money to-dos and dates, CD Hub dogs and litters (what this page has read)</label>' +
      '<input id="dashSearchBox" type="search" autocomplete="off" aria-describedby="dashSearchHint" style="width:100%;font-family:inherit;font-size:var(--fs-input,16px);padding:8px 10px;margin:6px 0;border:1px solid currentColor;border-radius:12px">' +
      '<p id="dashSearchHint" style="margin:4px 0;font-size:var(--fs-small)">Type at least 2 letters.</p><p id="dashSearchStatus" role="status" style="margin:4px 0;font-size:var(--fs-small)"></p>' +
      '<div id="dashSearchResults"></div><form method="dialog" style="margin-top:8px"><button type="submit" class="house-close">Close</button></form>';
    doc.body.appendChild(d);
    var box = d.querySelector('#dashSearchBox');
    // The hint follows every key at once (the search itself waits 300ms): shown under 2 letters, gone from the 2nd letter on.
    box.addEventListener('input', function () { searchHint(d, box.value); clearTimeout(searchTimer); searchTimer = setTimeout(function () { runSearch(box.value); }, 300); });
    d.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-search-act]');
      if (b && b._act) { e.preventDefault(); d.close(); b._act(); }
      else if (e.target.closest && e.target.closest('a[href]')) d.close();
    });
    return d;
  }
  /** "Type at least 2 letters." shows under 2 letters and hides from the 2nd letter on. True when q is long enough to search. */
  function searchHint(d, q) {
    var ok = String(q || '').trim().length >= 2;
    d.querySelector('#dashSearchHint').hidden = ok;
    if (!ok) d.querySelector('#dashSearchStatus').textContent = '';
    return ok;
  }
  var SLOT = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return 'var(--ljr-' + (n === 1 ? '1-edge' : n) + ')'; }); // slot colours from tokens.css
  /** Runs every registered provider for q and draws the grouped results. Returns a Promise of all results ([] under 2 letters or when a newer search started). */
  function runSearch(q) {
    var d = searchDialog(), st = d.querySelector('#dashSearchStatus'), out = d.querySelector('#dashSearchResults');
    q = String(q || '').trim();
    var gen = ++searchGen;
    if (!searchHint(d, q)) { out.innerHTML = ''; return Promise.resolve([]); }
    st.textContent = 'Searching…';
    return Promise.all(PROVIDERS.map(function (p) { return Promise.resolve().then(function () { return p(q); }).then(function (r) { return r || []; }, function () { return [{ group: 'Could not search', slot: 2, title: 'One source could not be searched. Try again.', sub: '' }]; }); }))
      .then(function (lists) {
        if (gen !== searchGen) return [];
        var all = [].concat.apply([], lists), groups = {}, order = [], acts = [];
        all.forEach(function (x) { if (!groups[x.group]) { groups[x.group] = []; order.push(x.group); } groups[x.group].push(x); });
        st.textContent = all.length ? all.length + (all.length === 1 ? ' result' : ' results') + ' for "' + q + '".' : 'Nothing found for "' + q + '".';
        out.innerHTML = order.map(function (g) {
          var items = groups[g];
          return '<section data-search-group="' + escHtml(g) + '" style="margin-top:10px;border-left:3px solid ' + SLOT[items[0].slot || 0] + ';padding-left:10px"><h3 style="margin:0 0 4px;font-size:var(--fs-body)">' + escHtml(g) + ' (' + items.length + ')</h3><ul style="margin:0;padding-left:18px">' +
            items.map(function (x) { return '<li>' + (x.href ? '<a href="' + escHtml(x.href) + '"' + (/^https?:/.test(x.href) ? ' target="_blank" rel="noopener"' : /^(money|cdhub)\//.test(x.href) ? ' target="_blank" rel="opener"' : '') + '>' + escHtml(x.title) + '</a>' : '<a href="#" data-search-act="' + (acts.push(x.act) - 1) + '">' + escHtml(x.title) + '</a>') + (x.sub ? ' <span style="font-size:var(--fs-small)">· ' + escHtml(x.sub) + '</span>' : '') + '</li>'; }).join('') + '</ul></section>';
        }).join('');
        Array.prototype.forEach.call(out.querySelectorAll('[data-search-act]'), function (a) { a._act = acts[+a.getAttribute('data-search-act')]; });
        return all;
      });
  }
  /** Opens the search dialog and focuses its box. */
  function openSearch() { var d = searchDialog(); if (!d.open) d.showModal(); var b = d.querySelector('#dashSearchBox'); b.focus(); b.select(); }
  if (root.document) root.document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-search-open]'); if (b) { e.preventDefault(); openSearch(); } });
  /** Returns a test function: true when a text contains every word of q (case-insensitive). */
  function matches(q) { var words = String(q).toLowerCase().split(/\s+/).filter(Boolean); return function (text) { text = String(text || '').toLowerCase(); return words.every(function (w) { return text.indexOf(w) >= 0; }); }; }

  // ---- Hub Main (Lisa's house style, 2 Nov 2026): EVERY hub's Main is exactly three parts, in this order:
  // 1 Next: the one most urgent thing, its action one tap away. 2 Needs you: at most 5 rows from the hub's Do and Decide,
  // late first (rose), then due today, then waiting; "+N more" opens Do. Every row carries its action.
  // 3 The hub's 3 numbers (the same ones its Dashboard tile shows), each a link to its filtered list; "–" when it cannot be read.
  // Nothing needs you: Next and Needs you fold into ONE "Nothing needs you"; the numbers stay. A failed read says so instead.
  // spec: { hub, rows: [{ kind: 'late'|'today'|'wait', text, href, act?, actHref?, sub?, pill?, ext?, sort?, why? ('down', 'stuck'...: broken) }],
  //         nums: [{ label, value (null = "–"), href, late? (true = late, or the word, e.g. 'down' = broken: see countWhy), aria? }] x3, doHref, extra? (html after the numbers), error? (text) }
  var HM_RANK = { late: 0, today: 1, wait: 2 };
  function hmSort(rows) {
    return (rows || []).map(function (r, i) { return { r: r, i: i }; }).sort(function (a, b) {
      return (HM_RANK[a.r.kind] == null ? 2 : HM_RANK[a.r.kind]) - (HM_RANK[b.r.kind] == null ? 2 : HM_RANK[b.r.kind]) ||
        (a.r.sort != null && b.r.sort != null ? a.r.sort - b.r.sort : 0) || a.i - b.i;
    }).map(function (x) { return x.r; });
  }
  function hmTarget(r, ext) { return ext ? ' target="_blank" rel="noopener"' : ''; }
  function hmPill(r) {
    var k = HM_RANK[r.kind] == null ? 'wait' : r.kind, t = r.pill || (k === 'late' ? 'Late' : k === 'today' ? 'Today' : '');
    return t ? '<span class="dpill' + (k === 'late' ? ' late' : k === 'today' ? ' soon' : '') + '">' + escHtml(t) + '</span>' : '';
  }
  function hmAct(r, cls) {
    var href = r.actHref || r.href;
    return href ? '<a class="btn ' + cls + '" data-hm-act href="' + escHtml(href) + '"' + hmTarget(r, r.actHref ? r.actExt : r.ext) +
      ' aria-label="' + escHtml((r.act || 'Open') + ': ' + r.text) + '">' + escHtml(r.act || 'Open') + '</a>' : '';
  }
  function hubMain(spec) {
    var rows = hmSort(spec.rows), max = spec.max || 5, shown = rows.slice(0, max), more = rows.length - shown.length, h = '';
    var kind = function (r) { return HM_RANK[r.kind] == null ? 'wait' : r.kind; };
    var doHref = escHtml(spec.doHref || '#/do');
    if (spec.error) {
      h += '<section class="card hm-fail" data-hm="fail" role="status"><h3>Could not read</h3><p class="note">' + escHtml(spec.error) + '</p></section>';
    } else if (!rows.length) {
      h += '<section class="card hm-empty" data-hm="empty"><span class="hm-ok" aria-hidden="true">✓</span><h3>Nothing needs you</h3></section>';
    } else {
      var x = rows[0];
      h += '<section class="card hm-next" data-open-row data-hm="next" data-kind="' + kind(x) + '" aria-labelledby="hmNextT"><div class="hm-head"><h3 id="hmNextT">Next</h3>' + hmPill(x) + '</div>' +
        '<p class="hm-what"><a class="house-open" href="' + escHtml(x.href) + '"' + hmTarget(x, x.ext) + ' aria-label="' + escHtml(x.text) + '">' + escHtml(x.text) + '</a></p>' + (x.sub ? '<p class="hm-sub">' + escHtml(x.sub) + '</p>' : '') +
        '<div class="hm-go">' + hmAct(x, 'hm-a') + '</div></section>';
      // The count: black when a row is broken (broken wins), rose when one is late, else grey (DashKit.count).
      var late = rows.some(function (r) { return kind(r) === 'late'; }), bw = rows.filter(function (r) { return countKind(1, r.why) === 'broken'; })[0];
      h += '<section class="card hm-needs" data-hm="needs" aria-labelledby="hmNeedsT"><div class="hm-head"><h3 id="hmNeedsT"><a class="house-go" href="' + doHref + '" aria-label="Needs you: ' + rows.length + '. Open Do">Needs you</a></h3>' +
        '<a class="house-go" href="' + doHref + '" aria-label="' + rows.length + ' need you' + (bw ? ', some ' + bw.why : late ? ', some late' : '') + '. Open Do"><span class="cnt' + (bw ? ' broken' : late ? ' need' : '') + (String(rows.length).length > 2 ? ' wide' : '') + '">' + rows.length + '</span></a></div>' +
        '<ol class="hm-rows">' + shown.map(function (r) {
          return '<li class="hm-row house-lbar" data-open-row data-kind="' + kind(r) + '"><span class="hm-t"><a class="house-open" href="' + escHtml(r.href) + '"' + hmTarget(r, r.ext) + ' aria-label="' + escHtml(r.text) + '">' + escHtml(r.text) + '</a>' +
            (r.sub ? '<small>' + escHtml(r.sub) + '</small>' : '') + '</span>' + hmPill(r) + hmAct(r, 'hm-a') + '</li>';
        }).join('') + '</ol>' + (more > 0 ? '<a class="hm-more" data-hm-more href="' + doHref + '">+' + more + ' more</a>' : '') + '</section>';
    }
    h += '<section class="hm-nums" data-hm="nums" aria-label="Numbers">' + (spec.nums || []).map(function (n) {
      var v = n.value == null || n.value === '' ? '–' : String(n.value), w = countWhy(v, n.late);   // late: true (late) or the broken word
      return '<a class="card hm-n house-go" data-k="' + escHtml(n.label) + '" href="' + escHtml(n.href) + '"' + (n.ext ? ' target="_blank" rel="noopener"' : '') +
        ' aria-label="' + escHtml(n.aria || (n.label + ': ' + (v === '–' ? 'could not be read' : w ? v + ' ' + w : v) + '. Open the list')) + '"><span class="hm-v' + countCls(v, n.late) + '">' + escHtml(v) + '</span><span class="hm-l">' + escHtml(n.label) + '</span></a>';
    }).join('') + (spec.extra || '') + '</section>';
    return '<div class="hm" data-hub-main="' + escHtml(spec.hub || '') + '">' + h + '</div>';
  }

  root.DashKit = { applyLook: applyLook, icon: icon, tabs: { tab: tabHtml, more: moreHtml, shut: function () { shutMores(null); } }, signButton: signButton, look: { extras: lookExtras, open: showHouseLook, set: setLook }, filterButton: filterButton, filterOpen: function (id) { return !!openFilters[id]; }, search: { register: registerSearch, open: openSearch, run: runSearch, matches: matches }, count: { why: countWhy, kind: countKind, cls: countCls, say: countSay }, googleFetch: googleFetch, isBusy: isBusy, BUSY_TEXT: BUSY_TEXT, TRIES: TRIES, WAITS: WAITS.slice(), KEYS: KEYS.map(function (k) { return [k[0], k[1]]; }), SITE: SITE, showKeys: help, hubMain: hubMain, hubMainSort: hmSort, fold: { run: foldAll, key: FOLD_KEY } };
})(typeof window !== 'undefined' ? window : this);
