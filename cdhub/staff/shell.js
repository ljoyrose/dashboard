/*!
 * The Board, staff page shell. No Google sign-in: a phone is set up ONCE (the save address arrives by the owner's
 * set-up QR, or the same payload typed in, then the person types their own staff code). The code stays on that phone.
 * If the owner switches the code off, the next read or save is refused and this page wipes it and goes back to set-up.
 *
 * Nothing about dogs, rooms or people is in these files. Everything is read through the save script with the code.
 *
 * MODULE INTERFACE (see README.md):  StaffPage.register({id, title, desc, icon, order, open(host, ctx)})
 */
(function () {
  'use strict';
  var CODE_KEY = 'bld.device.code', SCAN_PREFIX = 's/', SETUP_PREFIX = 'setup=', JOIN_PREFIX = 'join=', JOIN_URL = '&url=', TAG_RE = /^[A-Z2-9]{4,12}$/;
  var FILES = ['lib/due.js', '../checks/checks.js', 'modules/moves.js', 'modules/where.js', 'lib/thermometer.js', 'lib/area-link.js', 'modules/temperature/module.js', 'modules/jobs/module.js'];
  var ICONS = {
    report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636-2.87L13.637 3.59a1.914 1.914 0 0 0-3.274 0z"/><path d="M12 16h.01"/></svg>',   // Tabler alert-triangle (Problem tab)
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"/></svg>',
    scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M4 12h16"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>',
    temp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 14.8V5a2 2 0 10-4 0v9.8a4 4 0 104 0z"/></svg>',
    dogs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="10" r="2"/><circle cx="18" cy="10" r="2"/><circle cx="10" cy="5" r="2"/><circle cx="14" cy="5" r="2"/><path d="M12 11c-3 0-5 3-5 6 0 2 2 3 5 3s5-1 5-3c0-3-2-6-5-6z"/></svg>'
  };
  var screen = document.getElementById('screen'), tabs = document.getElementById('tabs');
  var save = BLDSave.create({});
  save.deviceCode = true;
  var modules = [], cleanup = null, dataP = null, started = false, join = null;

  /** The encoded # body of a private set-up QR (#join=<code>&url=<save address>), or null. */
  function readJoin(raw) {
    if (String(raw || '').indexOf(JOIN_PREFIX) !== 0) return null;
    var at = raw.indexOf(JOIN_URL), c = '', u = '';
    if (at > 0) { try { c = decodeURIComponent(raw.slice(JOIN_PREFIX.length, at)).trim(); u = decodeURIComponent(raw.slice(at + JOIN_URL.length)); } catch (e) { c = ''; u = ''; } }
    return { code: c, url: u };
  }
  /** Take a private set-up QR out of the address bar and history before anything else runs. */
  function takeJoin() {
    var j = readJoin((location.hash || '').slice(1));
    if (!j) return;
    history.replaceState(null, '', location.pathname);
    join = j;
  }
  takeJoin();
  function setupFail() {
    clearScreen(); tabs.hidden = true;
    screen.appendChild(h('p', { class: 'msg bad', text: 'That set-up QR was not right. Ask the owner for a new one.' }));
  }
  /**
   * One set-up payload, from a scan or from typing. text is the QR contents (a full link or the # part).
   * Returns true when it was a set-up payload. The same checks as a scan; nothing else is stored.
   */
  function acceptScan(text) {
    var raw = String(text || '').trim();
    var hashAt = raw.lastIndexOf('#');
    if (hashAt >= 0) raw = raw.slice(hashAt + 1);
    if (!raw) return false;
    var j = readJoin(raw);
    if (j) {
      history.replaceState(null, '', location.pathname);
      join = null;
      runJoin(j);
      return true;
    }
    var hash;
    try { hash = decodeURIComponent(raw); } catch (e) { return false; }
    if (hash.indexOf(SETUP_PREFIX) !== 0) return false;
    var r = save.setScriptUrl(hash.slice(SETUP_PREFIX.length), true);
    history.replaceState(null, '', location.pathname);
    if (!r.ok) { setupFail(); return true; }
    save.checkStatus().then(function () { drawSetup(); });
    return true;
  }

  function storeGet(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function storeSet(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); return true; } catch (e) { return false; } }
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];   // only ever our own icon strings
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) e.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function isSetUp() { return save.getScriptUrlSet() && !!storeGet(CODE_KEY); }
  function forget() { storeSet(CODE_KEY, ''); save.clearCode(); dataP = null; var me = document.getElementById('me'); if (me) me.hidden = true; }

  /** Any read or save answering BAD_CODE means this phone was switched off: wipe it. */
  function guard(r) {
    if (r && r.ok === false && r.code === 'BAD_CODE') { forget(); route(); }
    return r;
  }
  var rawRead = save.read, rawSubmit = save.submit;
  save.read = function (k) { return rawRead(k).then(guard); };
  save.submit = function (t, f, o) { return rawSubmit(t, f, o).then(guard); };

  /** Add a table the page may save to (a spec for instant checks; the script is still the judge). */
  function addTable(key, spec) { save.TABLES[key] = spec; }

  /** Read a list that may not be switched on yet. Never fails: {ok, rows, code, message}. */
  function readOptional(key) {
    return save.read(key).then(function (r) { return r.ok ? r : { ok: false, rows: [], code: r.code, message: r.message }; });
  }
  /** Rooms, dogs and where they are. Loaded once; refresh() loads again after a move. */
  function data() {
    if (dataP) return dataP;
    dataP = save.readMany(['area', 'subject', 'occupancy', 'subject_status', 'requirement'], ['requirement']).then(function (r) {
      if (!r.ok) { dataP = null; guard(r); return { ok: false, code: r.code, message: r.message || 'Could not load the records.' }; }
      var t = r.tables, d = BLDOccupancy.dailyList(t), subjects = (t.subject || []).map(function (x) { return { id: x.id, label: x.name || x.id }; });
      save.setLookups({ area: t.area || d.areas, subject: subjects });   // every room, retired ones too: a late reading may name a retired room (screens still hide it)
      return { ok: true, areas: d.areas, dogs: d.dogs, skipped: d.skipped, subjects: subjects, raw: t };
    });
    return dataP;
  }
  function refresh() { dataP = null; return data(); }
  function go(path) { if (location.hash === '#' + path) route(); else location.hash = path; }

  var ctx = { save: save, data: data, refresh: refresh, readOptional: readOptional, addTable: addTable, go: go, h: h, icons: ICONS, today: function () { return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' }); } };

  /** "Welcome <name> · <Role>" from the name and role held against this phone's code (shown once a read has told us). */
  function showMe() {
    var me = document.getElementById('me');
    if (!me) return;
    var name = save.name ? save.name() : '', role = save.role ? save.role() : '';
    if (!name && !role) { me.hidden = true; return; }
    role = role ? role.charAt(0) + role.slice(1).toLowerCase() : '';
    me.textContent = 'Welcome ' + (name || '') + (name && role ? ' · ' : '') + role + ' ';
    // shared work phone: the next person swaps in with two taps; the save address stays, so no set-up QR again
    me.appendChild(h('button', { class: 'switch', type: 'button', text: 'Not ' + (name || 'you') + '? Switch', onclick: function () { forget(); go('home'); } }));
    me.hidden = false;
  }
  function setTabs(cur) {
    showMe();
    tabs.hidden = false; tabs.textContent = '';
    [['home', 'Home', 'home'], ['scan', 'Scan', 'scan'], ['m/report', 'Problem', 'report'], ['device', 'Phone', 'gear']].forEach(function (t) {
      tabs.appendChild(h('button', { type: 'button', 'aria-current': cur === t[0] ? 'page' : false, onclick: function () { go(t[0]); } }, [h('span', { class: 'ring', html: ICONS[t[2]] }), t[1]]));
    });
  }
  function clearScreen() { if (cleanup) { try { cleanup(); } catch (e) { /* a module's tidy-up must not stop the page */ } cleanup = null; } screen.textContent = ''; window.scrollTo(0, 0); }

  function drawSetup(note) {
    clearScreen(); tabs.hidden = true;
    screen.appendChild(h('h1', { text: 'Set up this phone' }));
    if (!save.getScriptUrlSet()) {
      screen.appendChild(h('p', { class: 'sub', text: 'This phone is not set up. Ask the hub owner for the set-up QR and scan it.' }));
      var box = h('div');
      box.hidden = true;
      var field = h('input', { class: 'inp', type: 'password', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Set-up code', placeholder: 'Paste the set-up code' });
      var status = h('div', { class: 'msg', role: 'status' });
      function submitTyped() {
        var typed = field.value;
        field.value = '';
        status.className = 'msg';
        status.textContent = '';
        if (!String(typed || '').trim()) { status.className = 'msg bad'; status.textContent = 'Paste the set-up code.'; return; }
        if (!acceptScan(typed)) setupFail();
      }
      field.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); submitTyped(); } });
      box.appendChild(field);
      box.appendChild(h('button', { class: 'btn', type: 'button', text: 'Use this code', onclick: submitTyped }));
      box.appendChild(status);
      screen.appendChild(h('button', { class: 'btn quiet', type: 'button', text: 'Type set-up code instead', onclick: function (ev) {
        box.hidden = false;
        ev.currentTarget.hidden = true;
        field.focus();
      } }));
      screen.appendChild(box);
      return;
    }
    screen.appendChild(h('p', { class: 'sub', text: note || 'Type your own staff code. You only do this once on this phone.' }));
    var code = h('input', { class: 'inp', type: 'password', autocomplete: 'off', 'aria-label': 'Your staff code', placeholder: 'Your staff code' });
    var msg = h('div', { class: 'msg', role: 'status' });
    var btn = h('button', { class: 'btn', type: 'button', text: 'Set up this phone', onclick: function () {
      var c = code.value.trim();
      if (!c) { msg.className = 'msg bad'; msg.textContent = 'Type your staff code.'; return; }
      btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Checking...';
      save.setCode(c, false);
      save.checkStatus().then(function () { return rawRead('area'); }).then(function (r) {
        btn.disabled = false;
        if (r.ok) { if (!storeSet(CODE_KEY, c)) { msg.className = 'msg bad'; msg.textContent = 'This browser will not remember the code. Turn off private browsing and try again.'; return; } code.value = ''; go('home'); return; }
        save.clearCode(); msg.className = 'msg bad'; msg.textContent = r.message || 'That did not work.';
      });
    } });
    screen.appendChild(code); screen.appendChild(btn); screen.appendChild(msg);
  }

  /** Check the code from a private set-up QR. It is only remembered if the save script accepts it. */
  function runJoin(j) {
    clearScreen(); tabs.hidden = true;
    screen.appendChild(h('h1', { text: 'Set up this phone' }));
    var msg = h('p', { class: 'msg', role: 'status', text: 'Checking...' });
    screen.appendChild(msg);
    function fail(t) { save.clearCode(); msg.className = 'msg bad'; msg.textContent = t; }
    var r = j.code ? save.setScriptUrl(j.url, true) : { ok: false };
    if (!r.ok) { fail('That set-up QR was not right. Ask the owner for a new one.'); return; }
    save.setCode(j.code, false);
    save.checkStatus().then(function () { return rawRead('area'); }).then(function (res) {
      if (!res.ok) { fail(res.code === 'BAD_CODE' ? 'That code was not accepted. Ask the owner for a new QR.' : (res.message || 'That did not work. Ask the owner for a new QR.')); return; }
      if (!storeSet(CODE_KEY, j.code)) { fail('This browser will not remember the code. Turn off private browsing and scan again.'); return; }
      dataP = null; go('home');
    });
  }

  function drawHome() {
    clearScreen(); setTabs('home'); delete ctx.reportFor;
    screen.appendChild(h('h1', { text: 'The Board' }));
    data().then(showMe);   // the first read tells us whose code this is
    screen.appendChild(h('p', { class: 'sub', text: new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', year: 'numeric' }).replace('Sept', 'Sep') }));
    var list = h('div', { class: 'cards' });
    modules.filter(function (m) { return !m.hidden; }).sort(function (a, b) { return (a.order || 50) - (b.order || 50); }).forEach(function (m) {
      list.appendChild(h('button', { class: 'card go', type: 'button', 'data-module': m.id, onclick: function () { go('m/' + m.id); } }, [
        h('div', { class: 'nm' }, [h('span', { class: 'ic', html: m.icon || ICONS.dogs }), m.title])
      ]));
    });
    list.appendChild(h('a', { class: 'card go', href: '../checks/', 'data-link': 'checks' }, [
      h('div', { class: 'nm' }, [h('span', { class: 'ic', html: ICONS.dogs }), 'Checks'])
    ]));
    screen.appendChild(list);
  }
  function drawDevice() {
    clearScreen(); setTabs('device');
    screen.appendChild(h('h2', { text: 'This phone' }));
    screen.appendChild(h('p', { class: 'sub', text: 'This phone is set up with your staff code. If it is lost, tell the owner, who switches the code off everywhere.' }));
    screen.appendChild(h('button', { class: 'btn quiet', type: 'button', text: 'Remove my code from this phone', onclick: function () { forget(); go('home'); } }));
  }
  function openModule(id, params) {
    var m = modules.filter(function (x) { return x.id === id; })[0];
    if (!m) { go('home'); return; }
    clearScreen(); setTabs(params && params.tab || 'home');
    screen.appendChild(h('button', { class: 'back', type: 'button', text: '← Home', onclick: function () { go('home'); } }));
    var host = h('div'); screen.appendChild(host);
    var r = m.open(host, Object.assign({}, ctx, { params: params || {} }));
    if (typeof r === 'function') cleanup = r;
  }

  /** While a room is being filled (moves.js remembers it for 30 minutes), every scan carries on moving dogs. */
  function fillingRoom() {
    try { var r = JSON.parse(storeGet('bld.move.room') || 'null'); return !!r && Date.now() - r.at < 30 * 60000; } catch (e) { return false; }
  }

  /** Called on every address change. A scan on a phone that is not set up shows nothing but the set-up screen. */
  function route() {
    takeJoin();
    if (join) { var j = join; join = null; runJoin(j); return; }
    var raw = (location.hash || '').slice(1);
    if (raw && acceptScan(raw)) return;   // the same checks as a typed set-up code; the address does not stay in the bar
    var hash;
    try { hash = decodeURIComponent(raw); } catch (e) { hash = raw; }
    if (!isSetUp()) { drawSetup(); return; }
    save.setCode(storeGet(CODE_KEY), false);
    if (hash.indexOf(SCAN_PREFIX) === 0) {
      var tag = hash.slice(SCAN_PREFIX.length).toUpperCase();
      if (TAG_RE.test(tag)) { openModule(fillingRoom() ? 'moves' : 'jobs', { tag: tag, tab: 'scan' }); return; }
      go('home'); return;
    }
    if (hash.indexOf('mv/') === 0 && TAG_RE.test(hash.slice(3))) { openModule('moves', { tag: hash.slice(3), tab: 'scan' }); return; }
    if (hash === 'scan') { openModule('moves', { tab: 'scan' }); return; }
    if (hash === 'device') { drawDevice(); return; }
    if (hash.indexOf('m/') === 0) { openModule(hash.slice(2)); return; }
    drawHome();
  }

  window.StaffPage = {
    /** Add a screen. id must be unique; open(host, ctx) draws into host and may return a tidy-up function. */
    register: function (m) { modules = modules.filter(function (x) { return x.id !== m.id; }).concat([m]); if (started) route(); },
    ctx: ctx
  };

  function loadAll() {
    return Promise.all(FILES.map(function (f) {
      return new Promise(function (done) { var s = document.createElement('script'); s.src = f; s.onload = done; s.onerror = done; document.body.appendChild(s); });
    }));
  }
  loadAll().then(function () {
    if (!modules.some(function (m) { return m.id === 'temperature'; })) {
      window.StaffPage.register({ id: 'temperature', title: 'Temps', icon: ICONS.temp, order: 20, open: function (host, c) {
        c.data().then(function (d) { BLDScreens.temperatureEntry(host, { save: c.save, areas: d.ok ? d.areas : [] }); });
      } });
    }
    started = true;
    window.addEventListener('hashchange', route);
    return save.checkStatus();
  }).then(route);
}());
