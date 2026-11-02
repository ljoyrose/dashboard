// Small shared helpers used by all three pages.
// Google reads retry by themselves when Google says "too many requests" or has a hiccup:
// up to 4 tries, waiting about 1s, 2s, then 4s (plus a little random extra so tabs do not retry in step).
(function (root) {
  'use strict';
  var TRIES = 4;
  var WAITS = [1000, 2000, 4000];
  var JITTER_MS = 250;
  var BUSY_TEXT = 'Google is busy right now (too many requests). The dashboard tried 4 times. Wait a minute, then try again.';

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
    apps: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/><path d="M14 7h6M17 4v6"/>'
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

  // ---- Keyboard keys: g then a letter to go somewhere, r reread, / search, ? the list ----
  var KEYS = [
    ['g m', 'Dashboard', function () { go('./#/map'); }],
    ['g d', 'Drives', function () { go('./#/drives'); }],
    ['g b', 'Bin', function () { go('./#/bin'); }],
    ['g c', 'Changes', function () { go('./#/changes'); }],
    ['g f', 'Money Hub', function () { go('money/'); }],
    ['g h', 'CD Hub', function () { go('cdhub/'); }],
    ['r', 'Read again from Drive', function () { var b = root.document.querySelector('[data-action="refresh"]:not(.hidden):not([disabled]), [data-reload]'); if (b) b.click(); }],
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
      d.innerHTML = '<h2 id="dashKeysTitle" style="margin:0 0 8px;font-size:18px">Keyboard keys</h2><table style="border-collapse:collapse">' +
        KEYS.map(function (k) { return '<tr><td style="padding:3px 14px 3px 0"><kbd>' + k[0].replace(' ', '</kbd> then <kbd>') + '</kbd></td><td>' + k[1] + '</td></tr>'; }).join('') +
        '</table><p style="margin:10px 0 0">Keys do nothing while you are typing in a box. Esc closes this.</p><form method="dialog" style="margin-top:10px"><button type="submit">Close</button></form>';
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
    d.innerHTML = '<h2 id="dashSearchTitle" style="margin:0 0 8px;font-size:18px">Search</h2>' +
      '<label for="dashSearchBox" style="display:block;font-size:14px">Drive file names, Money to-dos and dates, CD Hub dogs and litters (what this page has read)</label>' +
      '<input id="dashSearchBox" type="search" autocomplete="off" style="width:100%;font:inherit;padding:8px 10px;margin:6px 0;border:1px solid currentColor;border-radius:12px">' +
      '<p id="dashSearchStatus" role="status" style="margin:4px 0;font-size:14px">Type at least 2 letters.</p>' +
      '<div id="dashSearchResults"></div><form method="dialog" style="margin-top:8px"><button type="submit">Close</button></form>';
    doc.body.appendChild(d);
    var box = d.querySelector('#dashSearchBox');
    box.addEventListener('input', function () { clearTimeout(searchTimer); searchTimer = setTimeout(function () { runSearch(box.value); }, 300); });
    d.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-search-act]');
      if (b && b._act) { e.preventDefault(); d.close(); b._act(); }
      else if (e.target.closest && e.target.closest('a[href]')) d.close();
    });
    return d;
  }
  var SLOT = [0, 1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return 'var(--ljr-' + (n === 1 ? '1-edge' : n) + ')'; }); // slot colours from tokens.css
  /** Runs every registered provider for q and draws the grouped results. Returns a Promise of all results ([] under 2 letters or when a newer search started). */
  function runSearch(q) {
    var d = searchDialog(), st = d.querySelector('#dashSearchStatus'), out = d.querySelector('#dashSearchResults');
    q = String(q || '').trim();
    var gen = ++searchGen;
    if (q.length < 2) { st.textContent = 'Type at least 2 letters.'; out.innerHTML = ''; return Promise.resolve([]); }
    st.textContent = 'Searching…';
    return Promise.all(PROVIDERS.map(function (p) { return Promise.resolve().then(function () { return p(q); }).then(function (r) { return r || []; }, function () { return [{ group: 'Could not search', slot: 2, title: 'One source could not be searched. Try again.', sub: '' }]; }); }))
      .then(function (lists) {
        if (gen !== searchGen) return [];
        var all = [].concat.apply([], lists), groups = {}, order = [], acts = [];
        all.forEach(function (x) { if (!groups[x.group]) { groups[x.group] = []; order.push(x.group); } groups[x.group].push(x); });
        st.textContent = all.length ? all.length + (all.length === 1 ? ' result' : ' results') + ' for "' + q + '".' : 'Nothing found for "' + q + '".';
        out.innerHTML = order.map(function (g) {
          var items = groups[g];
          return '<section data-search-group="' + escHtml(g) + '" style="margin-top:10px;border-left:3px solid ' + SLOT[items[0].slot || 0] + ';padding-left:10px"><h3 style="margin:0 0 4px;font-size:15px">' + escHtml(g) + ' (' + items.length + ')</h3><ul style="margin:0;padding-left:18px">' +
            items.map(function (x) { return '<li>' + (x.href ? '<a href="' + escHtml(x.href) + '"' + (/^https?:/.test(x.href) ? ' target="_blank" rel="noopener"' : /^(money|cdhub)\//.test(x.href) ? ' target="_blank" rel="opener"' : '') + '>' + escHtml(x.title) + '</a>' : '<a href="#" data-search-act="' + (acts.push(x.act) - 1) + '">' + escHtml(x.title) + '</a>') + (x.sub ? ' <span style="font-size:14px">· ' + escHtml(x.sub) + '</span>' : '') + '</li>'; }).join('') + '</ul></section>';
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

  root.DashKit = { applyLook: applyLook, icon: icon, signButton: signButton, look: { extras: lookExtras, open: showHouseLook, set: setLook }, filterButton: filterButton, filterOpen: function (id) { return !!openFilters[id]; }, search: { register: registerSearch, open: openSearch, run: runSearch, matches: matches }, googleFetch: googleFetch, isBusy: isBusy, BUSY_TEXT: BUSY_TEXT, TRIES: TRIES, WAITS: WAITS.slice(), KEYS: KEYS.map(function (k) { return [k[0], k[1]]; }), SITE: SITE, showKeys: help };
})(typeof window !== 'undefined' ? window : this);
