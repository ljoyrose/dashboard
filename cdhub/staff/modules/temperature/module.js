/*!
 * Room temperatures (staff page module). The round: scan the room's QR, read the wall min/max thermometer with
 * the LIVE camera, check the two numbers, save, press CLR. Twice a day: before 12:00 is the morning reading, after
 * is the afternoon one, saved with the same period_start as the CD Hub round, into the same BLD-area_reading list.
 *
 * NO PICTURE IS EVER KEPT. The camera is read live (getUserMedia). Each frame is copied into memory, turned into
 * grey numbers, read by reader.js on the phone, and dropped; the next frame overwrites it. Nothing is saved to the
 * phone, its camera roll, the page's storage or anywhere online; only the two numbers are sent. No AI, no outside
 * service. If the camera cannot read the screen, the person types the numbers (the fallback that always works).
 *
 * Room limits are ROWS (BLD-temperature_band: band by the youngest dog's age, optionally per room), never coded here.
 * A reading outside the limit asks what was done about it.
 *
 * Also here: the year report per room (every reading, highs and lows, each breach and what was done) and the
 * sensor (Govee) CSV import, kept as back-up rows beside the thermometer readings, never instead of them.
 *
 * Guest (inspector) page: BLDTemperature.rooms(host, {save, areas, guest:true}) uses this same entry; guest
 * readings go to their own list (guest_reading), so they never count as, or overwrite, a staff reading.
 */
(function () {
  'use strict';
  var BASE = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');
  var ROOM_KEY = 'bld.move.room', THERMO_KEY = 'bld.temp.thermometer', ROOM_MINUTES = 30, READ_MS = 250, GIVE_UP_MS = 20000;
  var readerP = null;

  function loadReader() {
    if (window.BLDTempReader) return Promise.resolve(window.BLDTempReader);
    if (!readerP) readerP = new Promise(function (ok) {
      var s = document.createElement('script'); s.src = BASE + 'reader.js';
      s.onload = function () { ok(window.BLDTempReader || null); }; s.onerror = function () { readerP = null; ok(null); };
      document.head.appendChild(s);
    });
    return readerP;
  }

  /* ------------------------------------------------------------------ small helpers */
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function say(text, kind) { return h('p', { class: 'msg ' + (kind || ''), role: 'status', text: text || '' }); }
  function setMsg(el, text, kind) { el.className = 'msg ' + (kind || ''); el.textContent = text || ''; }
  function num(v) { if (v === '' || v == null) return null; var n = parseFloat(v); return isNaN(n) ? null : n; }
  function oneDp(v) {
    v = String(v == null ? '' : v).trim();
    if (!/^-?\d{1,2}(\.\d)?$/.test(v)) return null;
    var n = parseFloat(v); return n < -30 || n > 60 ? null : n.toFixed(1);
  }
  function londonParts(d) {
    var p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(d || new Date()).forEach(function (x) { p[x.type] = x.value; });
    return { date: p.year + '-' + p.month + '-' + p.day, hour: parseInt(p.hour, 10) % 24 };
  }
  /** London offset at that wall time, as +00:00 / +01:00. */
  function londonIso(dateIso, hh) {
    var guess = new Date(dateIso + 'T' + hh + ':00:00Z'), lp = londonParts(guess);
    var off = (lp.hour - parseInt(hh, 10) + 24) % 24; if (off > 12) off -= 24;
    return dateIso + 'T' + hh + ':00:00' + (off < 0 ? '-' : '+') + ('0' + Math.abs(off)).slice(-2) + ':00';
  }
  /** The round slot now: morning before 12:00, afternoon after (same rule and period_start as the CD Hub round). */
  function slotNow() {
    var p = londonParts();
    var am = p.hour < 12;
    return { key: am ? 'am' : 'pm', label: am ? 'Morning' : 'Afternoon', date: p.date, periodStart: londonIso(p.date, am ? '00' : '12') };
  }
  function ddmmyy(iso) { iso = String(iso || ''); return /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(2, 4) : iso; }
  function remembered(key) {
    try { var r = JSON.parse(localStorage.getItem(key) || 'null'); if (r && Date.now() - r.at < ROOM_MINUTES * 60000) return r; } catch (e) { /* none */ }
    return null;
  }
  // A thermometer QR (set by the staff page's scan) wins over a room scan; it names the place it hangs in.
  function rememberedRoom(areas) {
    var t = remembered(THERMO_KEY);
    if (t) { var a = (areas || []).filter(function (x) { return x.thermometerId && x.thermometerId === t.thermometerId; })[0]; if (a) return { areaId: a.id, at: t.at }; }
    return remembered(ROOM_KEY);
  }
  /* The round is the thermometer rows (BLD-thermometer: name, area_id, active), never a coded list: a room with no
     thermometer (a field) is not on it, and a corridor is its own place. One thermometer per place. With no rows
     yet, every room is listed as before. */
  function roundAreas(areas, thermos) {
    var live = (thermos || []).filter(function (t) { return t.area_id && String(t.active).toLowerCase() !== 'false'; });
    if (!live.length) return areas;
    var out = [];
    areas.forEach(function (a) {
      live.filter(function (t) { return t.area_id === a.id; }).slice(0, 1).forEach(function (t) {
        var nm = String(t.name || '').trim();
        out.push({ id: a.id, label: nm && nm !== a.label ? nm + ' · ' + a.label : a.label, thermometerId: t.id });
      });
    });
    return out;
  }

  /* ------------------------------------------------------------------ limits (rows, never coded) */
  function ageDays(dob, onIso) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(dob || '')) return null;
    return Math.floor((Date.parse(onIso.slice(0, 10) + 'T00:00:00Z') - Date.parse(dob.slice(0, 10) + 'T00:00:00Z')) / 86400000);
  }
  /**
   * The limit for one room: BLD-temperature_band rows (band, age_from_days, age_to_days, min_temp, max_temp, and an
   * optional area_id for a room of its own). The youngest dog in the room picks the band; a row for this room beats
   * a row for every room. {min, max, label} or {reason}.
   */
  function limitFor(areaId, bands, dogsInRoom, onIso) {
    if (!bands || !bands.length) return { reason: 'No room limits loaded.' };
    var young = null;
    (dogsInRoom || []).forEach(function (d) { var a = ageDays(d.dob, onIso); if (a !== null && a >= 0 && (young === null || a < young)) young = a; });
    var fits = bands.filter(function (b) {
      if (b.area_id && b.area_id !== areaId) return false;
      var from = num(b.age_from_days), to = num(b.age_to_days), lo = num(b.min_temp), hi = num(b.max_temp);
      if (lo === null || hi === null) return false;
      if (from === null && to === null) return true;             // a room-wide row with no age
      if (young === null) return to === null;                   // no dogs or no dates of birth: the open-ended (adult) band
      return young >= (from || 0) && (to === null || young <= to);
    });
    if (!fits.length) return { reason: young === null ? 'No dates of birth for this room, so no limit.' : 'No limit row covers ' + young + ' days old.' };
    fits.sort(function (a, b) { return (b.area_id ? 1 : 0) - (a.area_id ? 1 : 0) || (num(b.age_from_days) || 0) - (num(a.age_from_days) || 0); });
    var f = fits[0];
    return { min: num(f.min_temp), max: num(f.max_temp), label: f.band || '', id: f.id || '' };
  }
  function breach(lim, mn, mx) {
    if (!lim || lim.min == null) return '';
    if (mn !== null && mn < lim.min) return 'low';
    if (mx !== null && mx > lim.max) return 'high';
    return '';
  }

  /* ------------------------------------------------------------------ live camera reader */
  /**
   * Opens the back camera in a <video>. Every READ_MS one frame is copied (only the part inside the guide frame)
   * into an in-memory canvas, read, and dropped. Calls done({max, min}) when 3 frames in a row agree, or fail(msg).
   * Returns stop(): turns the camera off and blanks the canvas.
   */
  function cameraRead(box, R, done, fail, status) {
    var video = h('video', { playsinline: true, muted: true, autoplay: true, 'aria-label': 'Camera view of the thermometer' });
    video.muted = true;
    var guide = h('div', { class: 'tg-guide', 'aria-hidden': 'true' }, [h('span', { class: 'tg-max', text: 'MAX' }), h('span', { class: 'tg-min', text: 'MIN' })]);
    var wrap = h('div', { class: 'tg-cam' }, [video, guide]);
    box.appendChild(wrap);
    var canvas = document.createElement('canvas'), cx = canvas.getContext('2d', { willReadFrequently: true });
    var stream = null, timer = null, started = Date.now(), steady = R.Steady(3), stopped = false;

    function stop() {
      stopped = true;
      if (timer) clearInterval(timer); timer = null;
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null;
      video.srcObject = null;
      canvas.width = 0; canvas.height = 0;                       // nothing of the last frame is left in memory
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }
    var WORDS = {
      'too dark or too flat': 'Too dark. Move closer or out of shadow.', 'no digits seen': 'Fit the screen in the frame.',
      'digits too small: move closer': 'Move closer.', 'number runs off the box: move back a little': 'Move back a little.',
      'small tenths digit not seen': 'Hold still, square on.', 'a digit could not be read': 'Hold still, square on. Avoid glare.',
      'MIN is above MAX': 'Hold still.'
    };
    function frame() {
      if (stopped || video.readyState < 2 || !video.videoWidth) return;
      // the guide frame's place in the video, allowing for the video being cropped to fill its box
      var vw = video.videoWidth, vh = video.videoHeight, bw = wrap.clientWidth, bh = wrap.clientHeight;
      var sc = Math.max(bw / vw, bh / vh), offX = (vw * sc - bw) / 2, offY = (vh * sc - bh) / 2;
      var g = guide.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      var sx = (g.left - wr.left + offX) / sc, sy = (g.top - wr.top + offY) / sc, sw = g.width / sc, sh = g.height / sc;
      var W = 480, H = Math.max(40, Math.round(W * sh / sw));
      canvas.width = W; canvas.height = H;
      cx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H);
      var px = cx.getImageData(0, 0, W, H);
      var r = R.readDisplay(R.toGray(px.data, W, H), W, H);
      px = null; cx.clearRect(0, 0, W, H);                       // the frame is gone; only numbers remain
      var got = steady.feed(r);
      if (got) { stop(); done(got); return; }
      status(r.ok ? 'Reading...' : (WORDS[r.reason] || 'Hold still, square on.'));
      if (Date.now() - started > GIVE_UP_MS) { stop(); fail('The camera could not read it. Type the numbers.'); }
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { stop(); fail('This phone cannot use the camera here. Type the numbers.'); return stop; }
    navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(function (s) {
        if (stopped) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        stream = s; video.srcObject = s;
        var p = video.play(); if (p && p.catch) p.catch(function () { /* autoplay: muted video plays on tap */ });
        status('Fit the thermometer screen in the frame.');
        timer = setInterval(frame, READ_MS);
      })
      .catch(function () { stop(); fail('Camera not allowed. Type the numbers.'); });
    return stop;
  }

  /* ------------------------------------------------------------------ one room: read, check, save */
  /**
   * o: save, table ('area_reading' | 'guest_reading'), area {id,label}, limit {min,max,label}|{reason}, guest, onDone
   */
  function entry(host, o) {
    var stopCam = null, cam = null;   // cam = {max, min} as the camera read them
    var slot = slotNow(), table = o.table || 'area_reading', lim = o.limit || {};
    host.textContent = '';
    host.appendChild(h('h2', { text: o.area.label }));
    host.appendChild(h('p', { class: 'sub', text: slot.label + ' reading' + (lim.min != null ? ' · Limit ' + lim.min.toFixed(1) + ' to ' + lim.max.toFixed(1) + ' C' + (lim.label ? ' (' + lim.label + ')' : '') : '') }));
    var banner = o.save.banner(table);
    var bannerEl = say(banner.canSave ? '' : banner.text, banner.canSave ? '' : 'warn');
    host.appendChild(bannerEl);

    var camBox = h('div'), camMsg = say('');
    var camBtn = h('button', { class: 'btn', type: 'button', text: 'Read with camera', onclick: startCam });
    var typeBtn = h('button', { class: 'btn quiet', type: 'button', text: 'Type it', onclick: function () { stopNow(); form.hidden = false; maxIn.focus(); } });
    host.appendChild(h('div', { class: 'tg-row' }, [camBtn, typeBtn]));
    host.appendChild(camBox); host.appendChild(camMsg);

    function field(label, ph) { return h('input', { class: 'inp', inputmode: 'decimal', autocomplete: 'off', placeholder: ph || '00.0', 'aria-label': label }); }
    var maxIn = field('MAX'), minIn = field('MIN'), spotIn = field('Bed spot', 'optional');
    var noteIn = h('input', { class: 'inp', type: 'text', maxlength: '500', 'aria-label': 'What was done', placeholder: 'What was done?' });
    var noteRow = h('label', { class: 'tg-f', hidden: true }, [h('span', { text: 'Outside the limit. What was done?' }), noteIn]);
    var checkMsg = say(''), msg = say('');
    var saveBtn = h('button', { class: 'btn', type: 'button', text: 'Save', onclick: send });
    var form = h('div', { hidden: true }, [
      h('div', { class: 'tg-pair' }, [h('label', { class: 'tg-f' }, [h('span', { text: 'MAX' }), maxIn]), h('label', { class: 'tg-f' }, [h('span', { text: 'MIN' }), minIn])]),
      h('details', { class: 'tg-spot' }, [h('summary', { text: 'Bed spot reading (optional)' }), spotIn]),
      checkMsg, noteRow, saveBtn, msg
    ]);
    host.appendChild(form);
    [maxIn, minIn].forEach(function (i) { i.addEventListener('input', check); });
    var requestId = null;

    function stopNow() { if (stopCam) { stopCam(); stopCam = null; } }
    function startCam() {
      stopNow(); setMsg(camMsg, 'Starting camera...');
      loadReader().then(function (R) {
        if (!R) { setMsg(camMsg, 'Camera reading is not available. Type the numbers.', 'warn'); form.hidden = false; return; }
        stopCam = cameraRead(camBox, R, function (got) {
          stopCam = null; cam = got;
          maxIn.value = got.max; minIn.value = got.min; form.hidden = false;
          setMsg(camMsg, 'Camera read MAX ' + got.max + ', MIN ' + got.min + '. Check them against the screen.', 'good');
          check();
        }, function (why) { stopCam = null; setMsg(camMsg, why, 'warn'); form.hidden = false; maxIn.focus(); },
        function (s) { setMsg(camMsg, s); });
      });
    }
    function check() {
      requestId = null;
      var mx = oneDp(maxIn.value), mn = oneDp(minIn.value), b = breach(lim, num(mn), num(mx));
      noteRow.hidden = !b;
      if ((maxIn.value && !mx) || (minIn.value && !mn)) setMsg(checkMsg, 'One decimal place, e.g. 18.5', 'bad');
      else if (mx && mn && parseFloat(mn) > parseFloat(mx)) setMsg(checkMsg, 'MIN is higher than MAX. Wrong way round?', 'bad');
      else if (b) setMsg(checkMsg, (b === 'low' ? 'Below' : 'Above') + ' the limit.', 'bad');
      else setMsg(checkMsg, '');
    }
    function send() {
      var mx = oneDp(maxIn.value), mn = oneDp(minIn.value), sp = spotIn.value.trim() ? oneDp(spotIn.value) : '';
      if (!mx || !mn) { setMsg(msg, 'Type MAX and MIN, one decimal place.', 'bad'); return; }
      if (sp === null) { setMsg(msg, 'Bed spot: one decimal place, or leave it empty.', 'bad'); return; }
      if (parseFloat(mn) > parseFloat(mx)) { setMsg(msg, 'MIN is higher than MAX. Check the screen.', 'bad'); return; }
      var b = breach(lim, num(mn), num(mx));
      if (b && !noteIn.value.trim()) { setMsg(msg, 'Say what was done.', 'bad'); noteIn.focus(); return; }
      var f = { area_id: o.area.id, max_c: mx, min_c: mn, period_start: slot.periodStart, read_method: cam ? 'camera' : 'typed' };
      if (cam) f.camera_value_changed = (cam.max !== mx || cam.min !== mn) ? 'true' : 'false';
      if (sp) f.spot_c = sp;
      if (noteIn.value.trim()) f.mitigation_note = noteIn.value.trim();
      requestId = requestId || o.save.newRequestId();
      saveBtn.disabled = true; setMsg(msg, 'Saving...');
      o.save.submit(table, f, { requestId: requestId }).then(function (r) {
        saveBtn.disabled = false;
        if (!r.ok) {
          var extra = r.fields ? ' ' + Object.keys(r.fields).map(function (k) { return r.fields[k]; }).join(' ') : '';
          setMsg(msg, (r.code === 'DUPLICATE' ? 'Already saved for this ' + slot.label.toLowerCase() + '.' : r.message) + extra, 'bad'); return;
        }
        form.hidden = true; camBox.textContent = ''; camMsg.textContent = '';
        host.appendChild(h('div', { class: 'card tg-clr', role: 'alert' }, [
          h('div', { class: 'nm', text: r.status === 'queued' ? 'Sent' : 'Saved' }),
          h('p', { text: 'Now press CLR on the thermometer.' })
        ]));
        host.appendChild(h('button', { class: 'btn', type: 'button', text: 'CLR pressed', onclick: function () { if (o.onDone) o.onDone(); } }));
      });
    }
    return stopNow;
  }

  /* ------------------------------------------------------------------ room list (staff and guest) */
  /**
   * o: save, areas [{id,label}], guest, dogs [{id, areaId, dob}], bands (limit rows), done {areaId:true} for this slot,
   *    readingsAllowed, owner tools (report/import) callbacks
   */
  function rooms(host, o) {
    var stop = null, slot = slotNow();
    function limit(areaId) {
      if (o.guest) return {};
      return limitFor(areaId, o.bands, (o.dogs || []).filter(function (d) { return d.areaId === areaId && !d.away; }), slot.date);
    }
    function open(a) {
      if (stop) stop();
      var box = h('div');
      host.textContent = '';
      host.appendChild(h('button', { class: 'back', type: 'button', text: '← Rooms', onclick: list }));
      host.appendChild(box);
      stop = entry(box, { save: o.save, table: o.guest ? 'guest_reading' : 'area_reading', area: a, limit: limit(a.id), guest: o.guest, onDone: function () { if (!o.guest) (o.done = o.done || {})[a.id] = true; list(); } });
    }
    function list() {
      if (stop) { stop(); stop = null; }
      host.textContent = '';
      host.appendChild(h('h2', { text: o.guest ? 'Guest temperatures' : 'Room temperatures' }));
      host.appendChild(h('p', { class: 'sub', text: slot.label + ' · ' + ddmmyy(slot.date) + (o.guest ? ' · Your readings are kept apart from the staff record.' : '') }));
      if (!o.areas.length) { host.appendChild(say('No rooms loaded.', 'bad')); return; }
      var here = !o.guest && rememberedRoom(o.areas), cards = h('div', { class: 'cards' });
      var sorted = o.areas.slice();
      if (here) sorted.sort(function (a, b) { return (b.id === here.areaId) - (a.id === here.areaId); });
      sorted.forEach(function (a) {
        var done = o.done && o.done[a.id], scanned = here && here.areaId === a.id;
        cards.appendChild(h('button', { class: 'card go' + (done ? ' tg-done' : ''), type: 'button', onclick: function () { open(a); } }, [
          h('div', { class: 'nm', text: (done ? '✓ ' : '') + a.label }),
          scanned ? h('div', { class: 'ds', text: 'You scanned this' }) : (done ? h('div', { class: 'ds', text: 'Done' }) : null)
        ]));
      });
      host.appendChild(cards);
      if (o.tools) host.appendChild(o.tools());
      if (here && !(o.done && o.done[here.areaId]) && o.autoOpen) { o.autoOpen = false; var a = o.areas.filter(function (x) { return x.id === here.areaId; })[0]; if (a) open(a); }
    }
    list();
    return function () { if (stop) stop(); };
  }

  /* ------------------------------------------------------------------ Govee CSV (back-up sensor) */
  /** Same room and day -> same reference, so pressing Save again never saves a day twice. */
  function hash(t) { var x = 5381; for (var i = 0; i < t.length; i++) x = ((x * 33) ^ t.charCodeAt(i)) >>> 0; return x.toString(36); }
  function splitCsvLine(line) {
    var out = [], cur = '', q = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
    }
    out.push(cur); return out.map(function (s) { return s.trim(); });
  }
  /**
   * A Govee export -> one row per London day: {day, min, max, samples}. Finds the time column and the temperature
   * column by name; Fahrenheit is turned into C. {ok, days, unit} or {ok:false, message}.
   */
  function parseGovee(text) {
    var lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) return { ok: false, message: 'That file has no readings.' };
    var head = splitCsvLine(lines[0]).map(function (s) { return s.toLowerCase(); });
    var ti = head.findIndex(function (s) { return /time|date/.test(s); }), ci = head.findIndex(function (s) { return /temp/.test(s); });
    if (ti < 0 || ci < 0) return { ok: false, message: 'Not a sensor export: no time or temperature column.' };
    var fahr = /°f|\(f\)|fahrenheit|_f\b/.test(head[ci]);
    var days = {}, bad = 0;
    for (var i = 1; i < lines.length; i++) {
      var c = splitCsvLine(lines[i]), t = c[ti], v = parseFloat(c[ci]);
      var d = Date.parse(String(t).replace(' ', 'T'));
      if (!t || isNaN(v) || isNaN(d)) { bad++; continue; }
      if (fahr) v = (v - 32) * 5 / 9;
      var day = /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : londonParts(new Date(d)).date;
      var x = days[day] || (days[day] = { day: day, min: v, max: v, samples: 0 });
      if (v < x.min) x.min = v; if (v > x.max) x.max = v; x.samples++;
    }
    var list = Object.keys(days).sort().map(function (k) { var x = days[k]; return { day: x.day, min: x.min.toFixed(1), max: x.max.toFixed(1), samples: x.samples }; });
    if (!list.length) return { ok: false, message: 'No readings could be read from that file.' };
    return { ok: true, days: list, unit: fahr ? 'F' : 'C', skipped: bad };
  }

  function importer(host, c, areas) {
    host.textContent = '';
    host.appendChild(h('h2', { text: 'Sensor back-up import' }));
    host.appendChild(h('p', { class: 'sub', text: 'Govee CSV export. Kept as back-up beside the thermometer readings, never instead of them. One row per day: lowest and highest.' }));
    var room = h('select', { class: 'inp', 'aria-label': 'Room' }, [h('option', { value: '', text: 'Choose the room' })].concat(areas.map(function (a) { return h('option', { value: a.id, text: a.label }); })));
    var label = h('input', { class: 'inp', type: 'text', maxlength: '60', placeholder: 'Sensor name (optional)', 'aria-label': 'Sensor name' });
    // CSV text only: no picture can be chosen here
    var file = h('input', { class: 'inp', type: 'file', accept: '.csv,text/csv', 'aria-label': 'Sensor CSV file' });
    var msg = say(''), out = h('div');
    host.appendChild(room); host.appendChild(label); host.appendChild(file); host.appendChild(msg); host.appendChild(out);
    var parsed = null;
    file.addEventListener('change', function () {
      out.textContent = ''; parsed = null;
      var f = file.files && file.files[0];
      if (!f) return;
      if (!/\.csv$/i.test(f.name) || (f.type && !/csv|text|excel/.test(f.type))) { setMsg(msg, 'Choose a .csv file.', 'bad'); file.value = ''; return; }
      if (f.size > 20 * 1024 * 1024) { setMsg(msg, 'That file is too big (20 MB at most).', 'bad'); return; }
      f.text().then(function (t) {
        var r = parseGovee(t);
        if (!r.ok) { setMsg(msg, r.message, 'bad'); return; }
        parsed = r;
        setMsg(msg, r.days.length + ' days' + (r.unit === 'F' ? ' (changed from F to C)' : '') + (r.skipped ? ', ' + r.skipped + ' lines skipped' : '') + '.', 'good');
        var tb = h('tbody');
        r.days.slice(0, 400).forEach(function (d) { tb.appendChild(h('tr', {}, [h('td', { text: ddmmyy(d.day) }), h('td', { text: d.min }), h('td', { text: d.max }), h('td', { text: String(d.samples) })])); });
        out.appendChild(h('table', { class: 'tg-tab' }, [h('thead', {}, [h('tr', {}, ['Day', 'Low', 'High', 'Samples'].map(function (x) { return h('th', { text: x }); }))]), tb]));
        out.appendChild(h('button', { class: 'btn', type: 'button', text: 'Save ' + r.days.length + ' days', onclick: function (e) { saveAll(e.target); } }));
      });
    });
    function saveAll(btn) {
      if (!room.value) { setMsg(msg, 'Choose the room.', 'bad'); return; }
      var b = c.save.banner('sensor_reading');
      if (!b.canSave) { setMsg(msg, b.text, 'warn'); return; }
      btn.disabled = true;
      var i = 0, okN = 0, dup = 0, fails = [];
      (function next() {
        if (i >= parsed.days.length) { setMsg(msg, okN + ' saved' + (dup ? ', ' + dup + ' already there' : '') + (fails.length ? ', ' + fails.length + ' not saved: ' + fails[0] : '') + '.', fails.length ? 'warn' : 'good'); return; }
        var d = parsed.days[i];
        setMsg(msg, 'Saving ' + (i + 1) + ' of ' + parsed.days.length + '...');
        c.save.submit('sensor_reading', { area_id: room.value, day: d.day, min_c: d.min, max_c: d.max, samples: String(Math.min(d.samples, 999999)), source: 'govee', device_label: label.value.trim() }, { requestId: 'govee-' + d.day + '-' + hash(room.value) })
          .then(function (r) { if (r.ok) okN++; else if (r.code === 'DUPLICATE') dup++; else fails.push(d.day + ' ' + r.message); i++; next(); });
      }());
    }
  }

  /* ------------------------------------------------------------------ year report (the inspector's annualised record) */
  function report(host, c, areas, bands) {
    host.textContent = '';
    host.appendChild(h('h2', { text: 'Year report' }));
    host.appendChild(h('p', { class: 'sub', text: 'Every reading for one room, the highs and lows by month, and each reading outside the limit with what was done.' }));
    var room = h('select', { class: 'inp', 'aria-label': 'Room' }, [h('option', { value: '', text: 'Choose the room' })].concat(areas.map(function (a) { return h('option', { value: a.id, text: a.label }); })));
    var y = Number(londonParts().date.slice(0, 4)), year = h('select', { class: 'inp', 'aria-label': 'Year' }, [y, y - 1, y - 2].map(function (v) { return h('option', { value: String(v), text: String(v) }); }));
    var msg = say(''), out = h('div', { class: 'tg-report' });
    host.appendChild(room); host.appendChild(year);
    host.appendChild(h('button', { class: 'btn', type: 'button', text: 'Open report', onclick: run }));
    host.appendChild(msg); host.appendChild(out);

    function run() {
      out.textContent = '';
      if (!room.value) { setMsg(msg, 'Choose the room.', 'bad'); return; }
      setMsg(msg, 'Loading...');
      // One room, one year per read (the save script's filter), so a year of readings stays under the read limit.
      // An older script that refuses the filter gets the plain read; yearRows still picks the room and year.
      var f = { area_id: room.value, from: year.value + '-01-01', to: year.value + '-12-31' };
      function readYear(key) {
        return c.save.read(key, f).then(function (r) { return r.ok || r.code !== 'BAD_FILTER' ? r : c.save.read(key); })
          .then(function (r) { return r.ok ? r : { ok: false, rows: [], code: r.code, message: r.message }; });
      }
      Promise.all([readYear('area_reading'), readYear('guest_reading'), readYear('sensor_reading')]).then(function (v) {
        if (!v[0].ok) { setMsg(msg, 'Readings cannot be read with this code: ' + (v[0].message || ''), 'bad'); return; }
        setMsg(msg, (v[0].truncated ? 'Only the first ' + v[0].rows.length + ' readings came back: the list is longer than one read allows. ' : '') + (v[1].ok ? '' : 'Guest readings not shown. ') + (v[2].ok ? '' : 'Sensor back-up not shown.'), v[0].truncated ? 'warn' : '');
        draw(yearRows(v[0].rows, v[1].ok ? v[1].rows : [], v[2].ok ? v[2].rows : [], room.value, year.value));
      });
    }
    function draw(rows) {
      var a = areas.filter(function (x) { return x.id === room.value; })[0] || { label: room.value };
      var lim = limitFor(room.value, bands, [], year.value + '-12-31');
      // a room-only row (no age) is the fixed limit; otherwise the limit is set by the youngest dog on the day, so
      // the report marks a breach where staff recorded one (a "what was done" note) or the reading broke the
      // widest band in the rows.
      var wide = (bands || []).filter(function (b) { return (!b.area_id || b.area_id === room.value) && num(b.min_temp) !== null; });
      var lo = wide.length ? Math.min.apply(null, wide.map(function (b) { return num(b.min_temp); })) : null;
      var hi = wide.length ? Math.max.apply(null, wide.map(function (b) { return num(b.max_temp); })) : null;
      out.appendChild(h('h3', { text: a.label + ' · ' + year.value }));
      out.appendChild(h('p', { class: 'sub', text: (lim.min != null && !(bands || []).some(function (b) { return num(b.age_from_days) !== null; }) ? 'Limit ' + lim.min.toFixed(1) + ' to ' + lim.max.toFixed(1) + ' C. ' : (lo !== null ? 'Limits by age, ' + lo.toFixed(1) + ' to ' + hi.toFixed(1) + ' C across the rows. ' : 'No limit rows. ')) + rows.length + ' rows.' }));
      if (!rows.length) { out.appendChild(say('No readings for this room in ' + year.value + '.')); return; }
      rows.forEach(function (r) { rowBreach(r, lo, hi); });
      // by month
      var months = {};
      rows.forEach(function (r) {
        var m = r.date.slice(0, 7), x = months[m] || (months[m] = { n: 0, lo: null, hi: null, br: 0 });
        if (r.kind !== 'staff') return;
        x.n++;
        if (r.min !== null && (x.lo === null || r.min < x.lo)) x.lo = r.min;
        if (r.max !== null && (x.hi === null || r.max > x.hi)) x.hi = r.max;
        if (r.breach) x.br++;
      });
      var mb = h('tbody');
      Object.keys(months).sort().forEach(function (m) {
        var x = months[m];
        mb.appendChild(h('tr', {}, [h('td', { text: m.slice(5, 7) + '/' + m.slice(2, 4) }), h('td', { text: String(x.n) }), h('td', { text: x.lo === null ? '' : x.lo.toFixed(1) }), h('td', { text: x.hi === null ? '' : x.hi.toFixed(1) }), h('td', { text: String(x.br) })]));
      });
      out.appendChild(h('table', { class: 'tg-tab' }, [h('thead', {}, [h('tr', {}, ['Month', 'Readings', 'Lowest', 'Highest', 'Outside limit'].map(function (t) { return h('th', { text: t }); }))]), mb]));
      // every reading
      var tb = h('tbody');
      rows.forEach(function (r) {
        tb.appendChild(h('tr', { class: r.breach ? 'tg-br' : '' }, [
          h('td', { text: ddmmyy(r.date) }), h('td', { text: r.slot }), h('td', { text: r.min === null ? '' : r.min.toFixed(1) }), h('td', { text: r.max === null ? '' : r.max.toFixed(1) }),
          h('td', { text: r.spot }), h('td', { text: r.kindLabel }), h('td', { text: r.note })
        ]));
      });
      out.appendChild(h('h3', { text: 'Every reading' }));
      out.appendChild(h('table', { class: 'tg-tab' }, [h('thead', {}, [h('tr', {}, ['Date', 'Round', 'Min', 'Max', 'Spot', 'How', 'What was done'].map(function (t) { return h('th', { text: t }); }))]), tb]));
      out.appendChild(h('button', { class: 'btn quiet', type: 'button', text: 'Print', onclick: function () { window.print(); } }));
    }
    function rowBreach(r, lo, hi) {
      if (r.kind !== 'staff') return;
      r.breach = !!r.note || (lo !== null && r.min !== null && r.min < lo) || (hi !== null && r.max !== null && r.max > hi);
    }
  }
  /** Rows of one room and year from the three lists, oldest first. Guest and sensor rows are labelled, never merged. */
  function yearRows(staff, guest, sensor, areaId, year) {
    var out = [];
    function slotOf(iso) { var hr = parseInt(String(iso).slice(11, 13), 10); return isNaN(hr) ? '' : (hr < 12 ? 'AM' : 'PM'); }
    staff.forEach(function (r) {
      var at = String(r.period_start || r.taken_at || '');
      if (r.area_id !== areaId || at.slice(0, 4) !== year || r.corrects_id) return;
      var how = r.read_method === 'camera' ? (r.camera_value_changed === 'true' ? 'Camera, corrected' : 'Camera') : (r.read_method === 'typed' ? 'Typed' : 'Recorded');
      out.push({ kind: 'staff', kindLabel: how, date: at.slice(0, 10), slot: slotOf(at), sort: at, min: num(r.min_c), max: num(r.max_c), spot: r.spot_c || '', note: r.mitigation_note || '' });
    });
    guest.forEach(function (r) {
      var at = String(r.period_start || r.taken_at || '');
      if (r.area_id !== areaId || at.slice(0, 4) !== year) return;
      out.push({ kind: 'guest', kindLabel: 'Guest', date: at.slice(0, 10), slot: slotOf(at), sort: at, min: num(r.min_c), max: num(r.max_c), spot: r.spot_c || '', note: r.mitigation_note || r.note || '' });
    });
    sensor.forEach(function (r) {
      var at = String(r.day || '');
      if (r.area_id !== areaId || at.slice(0, 4) !== year) return;
      out.push({ kind: 'sensor', kindLabel: 'Sensor back-up', date: at, slot: 'Day', sort: at + 'T23', min: num(r.min_c), max: num(r.max_c), spot: '', note: '' });
    });
    out.sort(function (a, b) { return a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0; });
    return out;
  }

  /* ------------------------------------------------------------------ styles (this module's own) */
  function css() {
    if (document.getElementById('tg-css')) return;
    var s = document.createElement('style'); s.id = 'tg-css';
    s.textContent = '.tg-row{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}' +
      '.tg-cam{position:relative;width:100%;aspect-ratio:3/4;max-height:60vh;background:var(--ljr-ink);border-radius:18px;overflow:hidden;margin:8px 0}' +
      '.tg-cam video{width:100%;height:100%;object-fit:cover;display:block}' +
      '.tg-guide{position:absolute;left:6%;right:6%;top:50%;transform:translateY(-50%);aspect-ratio:2.2/1;border:3px solid var(--accent);border-radius:10px;box-shadow:0 0 0 999px color-mix(in srgb,var(--ljr-ink) 35%,transparent)}' +
      '.tg-guide span{position:absolute;right:4px;font:700 11px var(--body);color:var(--ljr-paper);background:var(--accent);padding:0 4px;border-radius:4px}.tg-max{top:2px}.tg-min{bottom:2px}' +
      '.tg-pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tg-f{display:grid;font-size:13px;font-weight:700;color:var(--mut)}.tg-f[hidden]{display:none}' +
      '.tg-pair .inp{font-size:24px;text-align:center}.tg-spot{margin:4px 0 8px;color:var(--mut)}' +
      '.tg-clr{border-left:3px solid var(--good);margin:12px 0}.tg-done{border-left-color:var(--good)}' +
      '.tg-tab{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0 14px}.tg-tab th,.tg-tab td{border-bottom:1px solid var(--line);padding:5px 4px;text-align:left}' +
      '.tg-br td{color:var(--bad);font-weight:600}' +
      '@media print{.tabs,.back,.btn,select,.msg{display:none!important}.tg-tab{font-size:11px}}';
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ staff page: register */
  function openStaff(host, c) {
    css();
    var h0 = c.h || h, stop = null;
    host.textContent = 'Loading...';
    c.addTable('sensor_reading', { label: 'Sensor back-up', file: 'BLD-sensor_reading.csv', fields: {
      area_id: { type: 'ref', lookup: 'area', required: true, label: 'Room' }, day: { type: 'date', required: true, label: 'Day' },
      min_c: { type: 'temp', required: true, label: 'Lowest C' }, max_c: { type: 'temp', required: true, label: 'Highest C' },
      device_label: { type: 'text', label: 'Sensor' }
    } });
    Promise.all([c.data(), c.readOptional('temperature_band'), c.readOptional('area_reading'), c.readOptional('thermometer')]).then(function (v) {
      var d = v[0];
      if (!d.ok) { host.textContent = ''; host.appendChild(say(d.message, 'bad')); return; }
      var dob = {}; (d.raw.subject || []).forEach(function (s) { dob[s.id] = s.dob || ''; });
      var dogs = (d.dogs || []).map(function (x) { return { id: x.id, areaId: x.areaId, away: x.away, dob: dob[x.id] || '' }; });
      var areas = d.areas.map(function (a) { return { id: a.id, label: a.label }; });
      var bands = v[1].ok ? v[1].rows : [];
      var round = roundAreas(areas, v[3].ok ? v[3].rows : []);
      var slot = slotNow(), done = {};
      if (v[2].ok) v[2].rows.forEach(function (r) { if (String(r.period_start || '') === slot.periodStart) done[r.area_id] = true; });
      function tools() {
        return h0('div', { class: 'tg-row', style: 'margin-top:16px' }, [
          h0('button', { class: 'btn quiet', type: 'button', text: 'Year report', onclick: function () { if (stop) stop(); stop = null; back(); report(sub, c, areas, bands); } }),
          h0('button', { class: 'btn quiet', type: 'button', text: 'Sensor CSV', onclick: function () { if (stop) stop(); stop = null; back(); importer(sub, c, areas); } })
        ]);
      }
      var sub = h('div');
      function back() { host.textContent = ''; host.appendChild(h('button', { class: 'back', type: 'button', text: '← Rooms', onclick: start })); host.appendChild(sub); }
      function start() {
        host.textContent = ''; sub = h('div'); host.appendChild(sub);
        if (!v[1].ok) sub.appendChild(say('Room limits are not loaded, so no limit is checked: ' + (v[1].message || ''), 'warn'));
        var inner = h('div'); sub.appendChild(inner);
        stop = rooms(inner, { save: c.save, areas: round, dogs: dogs, bands: bands, done: done, tools: tools, autoOpen: true });
      }
      start();
    });
    return function () { if (stop) stop(); };
  }

  window.BLDTemperature = { rooms: function (host, o) { css(); return rooms(host, o); }, entry: entry, parseGovee: parseGovee, limitFor: limitFor, yearRows: yearRows, roundAreas: roundAreas, slotNow: slotNow, londonIso: londonIso };
  if (window.StaffPage) {
    window.StaffPage.register({ id: 'temperature', title: 'Room temperatures', desc: 'Camera reads the min/max', icon: window.StaffPage.ctx.icons.temp, order: 20, open: openStaff });
  }
}());
