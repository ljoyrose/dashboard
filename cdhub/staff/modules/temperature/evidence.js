/*!
 * BLDTempEvidence - keeps a photo of the thermometer with a temperature reading, ONLY while the owner switches it on.
 *
 * Lisa, 16 Nov 2026: photos are not kept by default (storage and privacy). The owner can switch keeping on, for
 * example for an inspection, with ONE dated rule row in BLD-breeding_rule:
 *
 *   rule_key  job.temps_keep_photo     (the job. prefix is what staff phones are allowed to read)
 *   value     yes                      (anything else, or no row = off)
 *   effective_from / to_date           the days it is on; blank to_date = until changed. Latest effective_from wins.
 *
 * With the setting off, this file is never loaded and nothing changes: module.js still keeps no picture.
 * With it on, after a reading is saved the person is offered "Take photo" (the live camera, one still) or
 * "Choose photo" (a picture already on the phone, e.g. for an earlier reading). Skipping is always allowed: the
 * reading is saved either way. The photo goes through the save script only:
 *   file_add  (kind photo, image/jpeg)  -> stored in the private Shared Drive folder FILES_FOLDER_ID, one BLD-files row
 *   link_add  area_reading/<reading id> -> files/<file id>, role evidence
 * Nothing is written to the phone's camera roll or the page's storage. The picture is shrunk to at most 1600 px on
 * its longest side before it is sent.
 *
 * What the owner must have in place (otherwise the save script refuses and the person is told; the reading stays saved):
 *   Script Properties: FILES_FOLDER_ID, TABLE_ON_files = true, TABLE_ON_links = true
 *   Rule rows: file.types includes image/jpeg; file.who_may includes STAFF (owner always may);
 *              link_kind.evidence (the word shown, e.g. Evidence); link_kind.evidence.who_may includes STAFF;
 *              link_kind.evidence.from_tables includes area_reading (or no row = any).
 *
 * Browser: window.BLDTempEvidence.  Node (tests): module.exports.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDTempEvidence = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY = 'job.temps_keep_photo', MAX_SIDE = 1600, QUALITY = 0.75;

  function ymd(v) { var s = String(v == null ? '' : v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }

  /** Is keeping photos on for `day` (YYYY-MM-DD)? The rule row in force that day (latest effective_from) must say yes. */
  function on(rules, day) {
    var best = null;
    (rules || []).forEach(function (r) {
      if (!r || String(r.rule_key || '').trim() !== KEY) return;
      var f = ymd(r.effective_from), t = ymd(r.to_date);
      if (!f || f > day || (t && t < day)) return;
      if (!best || f >= ymd(best.effective_from)) best = r;
    });
    return !!best && String(best.value || '').trim().toLowerCase() === 'yes';
  }

  /** Any row for the setting at all (cheap check before loading this file in the page). */
  function mentioned(rules) {
    return (rules || []).some(function (r) { return r && String(r.rule_key || '').trim() === KEY; });
  }

  /* ------------------------------------------------------------------ browser only below */
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
  function setMsg(el, text, kind) { el.className = 'msg ' + (kind || ''); el.textContent = text || ''; }

  /** Draw a video frame or image onto a canvas no bigger than MAX_SIDE, return base64 JPEG (no data: prefix). */
  function toJpeg(src, w, hgt) {
    var s = Math.min(1, MAX_SIDE / Math.max(w, hgt)), c = document.createElement('canvas');
    c.width = Math.round(w * s); c.height = Math.round(hgt * s);
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    var url = c.toDataURL('image/jpeg', QUALITY);
    c.width = 0; c.height = 0;
    return url.slice(url.indexOf(',') + 1);
  }

  /**
   * Offer to keep a photo for one saved reading.
   * o: save (BLDSave instance: act, linkAdd), readingId, day (YYYY-MM-DD), areaLabel, past (an earlier reading:
   *    no live thermometer, so only Choose photo)
   * Returns stop(): turns the camera off if it is open.
   */
  function offer(host, o) {
    var stream = null, busy = false;
    var msg = h('p', { class: 'msg', role: 'status' });
    var camBox = h('div');
    var takeBtn = h('button', { class: 'btn', type: 'button', text: 'Take photo', onclick: startCam });
    var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
    var chooseBtn = h('button', { class: 'btn quiet', type: 'button', text: 'Choose photo', onclick: function () { file.click(); } });
    var skipBtn = h('button', { class: 'btn quiet', type: 'button', text: 'Skip', onclick: function () { stop(); box.remove(); } });
    var box = h('div', { class: 'card tg-evidence' }, [
      h('div', { class: 'nm', text: 'Photo for the records' }),
      h('p', { class: 'sub', text: o.past ? 'Add the photo this reading came from.' : 'Photograph the thermometer screen before pressing CLR.' }),
      h('div', { class: 'tg-row' }, [o.past ? null : takeBtn, chooseBtn, skipBtn].filter(Boolean)),
      file, camBox, msg
    ]);
    host.appendChild(box);

    function stop() {
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null; camBox.textContent = '';
    }
    function startCam() {
      if (busy) return;
      stop();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setMsg(msg, 'This phone cannot use the camera here. Use Choose photo.', 'warn'); return; }
      var video = h('video', { playsinline: true, muted: true, autoplay: true, 'aria-label': 'Camera view for the photo' });
      video.muted = true;
      var snap = h('button', { class: 'btn', type: 'button', text: 'Keep this photo', onclick: function () {
        if (!video.videoWidth) return;
        var b64 = toJpeg(video, video.videoWidth, video.videoHeight);
        stop(); send(b64);
      } });
      camBox.appendChild(h('div', { class: 'tg-cam' }, [video])); camBox.appendChild(snap);
      navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
        .then(function (s) { stream = s; video.srcObject = s; var p = video.play(); if (p && p.catch) p.catch(function () {}); setMsg(msg, 'Fit the whole thermometer in view.'); })
        .catch(function () { stop(); setMsg(msg, 'Camera not allowed. Use Choose photo.', 'warn'); });
    }
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; file.value = '';
      if (!f || busy) return;
      var img = new Image(), rd = new FileReader();
      rd.onload = function () {
        img.onload = function () { send(toJpeg(img, img.naturalWidth, img.naturalHeight)); img.src = ''; };
        img.onerror = function () { setMsg(msg, 'That picture could not be read.', 'bad'); };
        img.src = rd.result;
      };
      rd.readAsDataURL(f);
    });

    function send(b64) {
      busy = true; setMsg(msg, 'Keeping photo...');
      [takeBtn, chooseBtn, skipBtn].forEach(function (b) { b.disabled = true; });
      var fileReq = o.save.newRequestId(), linkReq = o.save.newRequestId();
      o.save.act('file_add', { kind: 'photo', mime: 'image/jpeg', data_base64: b64, name: 'thermometer.jpg', taken_on: o.day,
        source: 'Temperature reading' + (o.areaLabel ? ', ' + o.areaLabel : '') }, fileReq).then(function (r) {
        if (!r.ok) throw r;
        return o.save.linkAdd({ from_table: 'area_reading', from_id: o.readingId, role: 'evidence', to_table: 'files', to_id: r.id, from_date: o.day }, linkReq);
      }).then(function (r) {
        if (!r.ok) throw r;
        busy = false; [takeBtn, chooseBtn, skipBtn].forEach(function (b) { b.hidden = true; });
        setMsg(msg, '✓ Photo kept with the reading.', 'good');
      }).catch(function (r) {
        busy = false; [takeBtn, chooseBtn, skipBtn].forEach(function (b) { b.disabled = false; });
        setMsg(msg, 'The reading is saved, but the photo was not kept: ' + ((r && r.message) || 'something went wrong') + ' Try again or skip.', 'bad');
      });
    }
    return stop;
  }

  return { KEY: KEY, on: on, mentioned: mentioned, offer: offer };
}));
