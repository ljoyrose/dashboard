/*!
 * Guest page (inspector): temperatures only. It reads the room list and writes guest readings, nothing else.
 * The script decides what a guest code may do and when it expires. Guest readings go to their own list,
 * so they can never satisfy or overwrite a due staff reading.
 */
(function () {
  'use strict';
  var KEY = 'bld.guest.code', TABLE = 'guest_reading';
  var screen = document.getElementById('screen'), save = BLDSave.create({});
  save.TABLES[TABLE] = { label: 'Guest temperatures', file: 'BLD-guest_reading.csv', fields: save.TABLES.area_reading.fields };
  save.deviceCode = true;
  function store(v) { try { if (v) localStorage.setItem(KEY, v); else localStorage.removeItem(KEY); return true; } catch (e) { return false; } }
  function stored() { try { return localStorage.getItem(KEY) || ''; } catch (e) { return ''; } }
  function h(t, a) { var e = document.createElement(t); Object.keys(a || {}).forEach(function (x) { if (x === 'text') e.textContent = a[x]; else if (x === 'class') e.className = a[x]; else if (x.slice(0, 2) === 'on') e.addEventListener(x.slice(2), a[x]); else e.setAttribute(x, a[x]); }); return e; }
  var guestSave = Object.create(save);
  guestSave.banner = function () { return save.banner(TABLE); };
  guestSave.submit = function (t, f, o) {
    return save.submit(TABLE, f, o).then(function (r) { if (r.code === 'BAD_CODE') { store(''); save.clearCode(); ask('That guest code has expired or was switched off.'); } return r; });
  };
  function ask(note) {
    screen.textContent = '';
    screen.appendChild(h('h1', { text: 'Guest temperatures' }));
    if (!save.getScriptUrlSet()) { screen.appendChild(h('p', { class: 'sub', text: 'Please ask the owner to set up this page for you.' })); return; }
    screen.appendChild(h('p', { class: 'sub', text: note || 'Type the guest code you were given.' }));
    var input = h('input', { class: 'inp', type: 'password', autocomplete: 'off', 'aria-label': 'Guest code', placeholder: 'Guest code' }), msg = h('p', { class: 'msg bad', role: 'status' });
    screen.appendChild(input);
    screen.appendChild(h('button', { class: 'btn', type: 'button', text: 'Continue', onclick: function () {
      var c = input.value.trim(); if (!c) return;
      save.setCode(c, false);
      show(function (m) { save.clearCode(); msg.textContent = m; }, c);
    } }));
    screen.appendChild(msg);
  }
  function show(fail, fresh) {
    var req = [];   // need rows (room.in_use): a retired room is hidden after its last day
    save.checkStatus().then(function () { return save.read('requirement'); }).then(function (q) { req = q.ok ? q.rows : []; return save.read('area'); }).then(function (r) {
      if (!r.ok) {
        if (!fresh) { store(''); save.clearCode(); ask(r.code === 'BAD_CODE' ? 'That guest code has expired or was switched off.' : r.message); return; }
        fail(r.message || 'That did not work.'); return;
      }
      if (fresh) store(fresh);
      screen.textContent = '';
      var areas = r.rows.filter(function (a) { return BLDOccupancy.inUse(a, BLDNeeds.today(), req); }).map(function (a) { return { id: a.id, label: a.code || a.id, group: a.grouping || '' }; });
      save.setLookups({ area: areas });
      var host = document.createElement('div'); screen.appendChild(host);
      withTemperature(function () {
        if (window.BLDTemperature) window.BLDTemperature.rooms(host, { save: guestSave, areas: areas, guest: true });
        else BLDScreens.temperatureEntry(host, { save: guestSave, areas: areas });
      });
    });
  }
  // The staff page's room temperature screen (camera read or typed), if it is there; else the plain typed form.
  // Either way guestSave sends every reading to guest_reading.
  function withTemperature(done) {
    if (window.BLDTemperature) { done(); return; }
    var s = document.createElement('script'), once = false;
    function go() { if (!once) { once = true; done(); } }
    s.src = '../modules/temperature/module.js'; s.onload = go; s.onerror = go;
    document.head.appendChild(s);
  }
  var hash = decodeURIComponent((location.hash || '').slice(1));
  if (hash.indexOf('setup=') === 0) { save.setScriptUrl(hash.slice(6), true); history.replaceState(null, '', location.pathname); }
  var code = stored();
  if (code && save.getScriptUrlSet()) { save.setCode(code, false); show(function () {}, ''); } else ask();
}());
