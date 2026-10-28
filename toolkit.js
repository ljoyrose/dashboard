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
  if (root.addEventListener) root.addEventListener('storage', function (e) { if (e.key === 'dash-look') applyLook(); });

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
    ['g m', 'Map (home)', function () { go('./#/map'); }],
    ['g d', 'Drive', function () { go('./#/drive'); }],
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
  function openSearch() { var d = searchDialog(); if (!d.open) d.showModal(); var b = d.querySelector('#dashSearchBox'); b.focus(); b.select(); }
  if (root.document) root.document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-search-open]'); if (b) { e.preventDefault(); openSearch(); } });
  function matches(q) { var words = String(q).toLowerCase().split(/\s+/).filter(Boolean); return function (text) { text = String(text || '').toLowerCase(); return words.every(function (w) { return text.indexOf(w) >= 0; }); }; }

  root.DashKit = { applyLook: applyLook, filterButton: filterButton, filterOpen: function (id) { return !!openFilters[id]; }, search: { register: registerSearch, open: openSearch, run: runSearch, matches: matches }, googleFetch: googleFetch, isBusy: isBusy, BUSY_TEXT: BUSY_TEXT, TRIES: TRIES, WAITS: WAITS.slice(), KEYS: KEYS.map(function (k) { return [k[0], k[1]]; }), SITE: SITE, showKeys: help };
})(typeof window !== 'undefined' ? window : this);
