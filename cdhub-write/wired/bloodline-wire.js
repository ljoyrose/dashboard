/*!
 * Wiring for the Bloodline redesign page (index.html from Bloodline.zip).
 * Adds two stages, "Enter temperatures" and "Staff input", that use the write-path screens.
 *
 * Bloodline on its own is not connected to Drive, so these screens start with honest empty states
 * ("No rooms are loaded"). Once the redesign lifts the CD Hub sign-in and CSV reading, call
 *     BLDWire.provide(BLDLookups.fromTables(T, todayIso))
 * with the tables it has loaded and the screens fill in. Nothing else needs to change.
 */
(function () {
  'use strict';
  var save = BLDSave.create({});
  var L = { areas: [], people: [], subjects: [], bandForArea: null, actionFor: null };
  var started = false;

  function settingsBox() {
    var d = document.createElement('div');
    d.className = 'bs-card'; d.style.maxWidth = '560px';
    d.innerHTML = '<b>Turn saving on</b> (Lisa only). Paste the Script URL; it is kept on this device only.' +
      '<input class="bs-in" id="bw-url" placeholder="https://script.google.com/macros/s/.../exec" autocomplete="off" aria-label="Script URL">' +
      '<button class="bs-btn" id="bw-on" type="button" style="margin-top:8px">Use this address</button> ' +
      '<button class="bs-link" id="bw-off" type="button">Switch off on this device</button><div id="bw-msg" role="status"></div>';
    return d;
  }

  function mount(cur) {
    var host = document.getElementById('bs-host');
    if (!host || (cur !== 'entertemp' && cur !== 'staffin')) return;
    function draw() {
      var box = host.querySelector('.bw-screen');
      if (box) box.remove();
      var s = document.createElement('div'); s.className = 'bw-screen'; host.appendChild(s);
      if (cur === 'entertemp') BLDScreens.temperatureEntry(s, { save: save, areas: L.areas, bandForArea: L.bandForArea, actionFor: L.actionFor });
      else BLDScreens.staffInput(s, { save: save, people: L.people });
    }
    if (!host.querySelector('#bw-url')) {
      host.classList.add('bs');
      var sb = settingsBox(); host.appendChild(sb);
      sb.querySelector('#bw-on').onclick = function () {
        var r = save.setScriptUrl(sb.querySelector('#bw-url').value, true);
        sb.querySelector('#bw-msg').textContent = r.ok ? 'Address kept on this device. Checking...' : r.message;
        if (r.ok) save.checkStatus().then(function () { sb.querySelector('#bw-msg').textContent = save.banner('area_reading').text; draw(); });
      };
      sb.querySelector('#bw-off').onclick = function () { save.setScriptUrl('', true); sb.querySelector('#bw-msg').textContent = 'Saving switched off on this device.'; draw(); };
    }
    draw();
    if (!started) { started = true; save.checkStatus().then(draw); }
  }

  window.BLDWire = {
    pageTemp: function () { return '<h2>Enter temperatures</h2><div id="bs-host"></div>'; },
    pageStaff: function () { return '<h2>Staff input</h2><div id="bs-host"></div>'; },
    mount: mount,
    provide: function (lookups) { L = lookups; save.setLookups({ area: L.areas, person: L.people, subject: L.subjects || [] }); mount((location.hash || '').replace('#/', '')); }
  };
}());
