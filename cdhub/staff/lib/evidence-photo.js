/*!
 * BLDEvidencePhoto - one helper for "add a photo to what was just saved", used by Temps, staff Jobs and the CD Hub.
 *
 * Used after a Done save (staff Jobs, CD Hub Done today) and by the Temps keep-photo setting.
 *
 * The record is ALWAYS saved first. The photo is optional: Take photo (the live camera, one still), Choose photo (a
 * picture already on the phone) or Skip. It goes through the save script only, in two steps:
 *   file_add  (kind photo, image/jpeg)                   -> the private Shared Drive folder, one BLD-files row
 *   link_add  <from_table>/<record id> -> files/<file id>, role evidence   (one link per record, e.g. per dog)
 * Nothing is written to the phone's camera roll or the page's storage. The picture is shrunk to at most 1600 px.
 * If the photo cannot be kept, the person is told why ("Photo not kept: <reason>") and the record still stands.
 *
 * Owner switches (dated rule rows in BLD-breeding_rule; the row in force that day with the latest effective_from wins):
 *   job.done_photo              yes / no   offer a photo after a Done (no row = offer it)
 *   job.done_photo.<type_key>   yes / no   the same for one job; beats job.done_photo
 *   job.temps_keep_photo        yes        Temps readings (no row = off)
 *
 * What the save script needs (otherwise it refuses and the reason is shown; the record stays saved):
 *   Script Properties FILES_FOLDER_ID, TABLE_ON_files = true, TABLE_ON_links = true;
 *   rule rows file.types (image/jpeg), file.who_may, link_kind.evidence, link_kind.evidence.who_may,
 *   link_kind.evidence.from_tables (must include each from_table used: area_reading, check_log), or no row = any.
 *
 * API (window.BLDEvidencePhoto; module.exports in Node):
 *   ruleOn(rules, key, day, dflt)     the switch `key` on `day`; dflt when no row is in force
 *   doneOn(rules, typeKey, day)       offer a photo after this job's Done?
 *   staffSender(save)                 a sender from a BLDSave instance (save.act)
 *   offer(host, o) -> stop()          draws the offer into host. o: send (a sender: {fileAdd(fields), linkAdd(fields)},
 *       each resolving {ok, id, message}), fromTable, fromIds (array of record ids), day (YYYY-MM-DD), past (no live
 *       camera), name (file name), source, and optional words: title, hint, kept, notKept(reason), cls.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDEvidencePhoto = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_SIDE = 1600, QUALITY = 0.75, DONE_KEY = 'job.done_photo';

  function ymd(v) { var s = String(v == null ? '' : v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }

  /** The row for `key` in force on `day` (latest effective_from), or null. */
  function inForce(rules, key, day) {
    var best = null;
    (rules || []).forEach(function (r) {
      if (!r || String(r.rule_key || '').trim() !== key) return;
      var f = ymd(r.effective_from), t = ymd(r.to_date);
      if (!f || f > day || (t && t < day)) return;
      if (!best || f >= ymd(best.effective_from)) best = r;
    });
    return best;
  }
  function ruleOn(rules, key, day, dflt) {
    var r = inForce(rules, key, day);
    return r ? String(r.value || '').trim().toLowerCase() === 'yes' : !!dflt;
  }
  function doneOn(rules, typeKey, day) {
    if (typeKey && inForce(rules, DONE_KEY + '.' + typeKey, day)) return ruleOn(rules, DONE_KEY + '.' + typeKey, day, true);
    return ruleOn(rules, DONE_KEY, day, true);
  }

  /** A sender from a BLDSave instance: act() already resolves {ok, id, message}. */
  function staffSender(save) {
    return {
      fileAdd: function (fields) { return save.act('file_add', fields, save.newRequestId()); },
      linkAdd: function (fields) { return save.linkAdd(fields, save.newRequestId()); }
    };
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

  var CSS = '.ev-row{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}' +
    '.ev-cam{position:relative;width:100%;aspect-ratio:3/4;max-height:60vh;background:var(--ljr-ink,#2C2C2A);border-radius:18px;overflow:hidden;margin:8px 0}' +
    '.ev-cam video{width:100%;height:100%;object-fit:cover;display:block}';
  function style() {
    if (document.getElementById('ev-photo-css')) return;
    var st = document.createElement('style'); st.id = 'ev-photo-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  function offer(host, o) {
    style();
    var stream = null, busy = false, fileId = '', linked = {};
    var ids = (o.fromIds || []).filter(Boolean);
    var notKept = o.notKept || function (why) { return 'Photo not kept: ' + (why || 'something went wrong.') + ' The record is saved. Try again or skip.'; };
    var msg = h('p', { class: 'msg', role: 'status' });
    var camBox = h('div');
    var takeBtn = h('button', { class: 'btn', type: 'button', text: 'Take photo', onclick: startCam });
    var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
    var chooseBtn = h('button', { class: 'btn quiet', type: 'button', text: 'Choose photo', onclick: function () { file.click(); } });
    var skipBtn = h('button', { class: 'btn quiet', type: 'button', text: 'Skip', onclick: function () { stop(); box.remove(); } });
    var box = h('div', { class: 'card ev-photo ' + (o.cls || ''), 'data-ev-photo': '1', 'data-evidence': o.fromTable || '' }, [
      h('div', { class: 'nm', text: o.title || 'Add photo' }),
      o.hint ? h('p', { class: 'sub', text: o.hint }) : null,
      h('div', { class: 'tg-row ev-row' }, [o.past ? null : takeBtn, chooseBtn, skipBtn].filter(Boolean)),
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
      camBox.appendChild(h('div', { class: 'tg-cam ev-cam' }, [video])); camBox.appendChild(snap);
      navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
        .then(function (s) { stream = s; video.srcObject = s; var p = video.play(); if (p && p.catch) p.catch(function () {}); setMsg(msg, o.camHint || ''); })
        .catch(function () { stop(); setMsg(msg, 'Camera not allowed. Use Choose photo.', 'warn'); });
    }
    file.addEventListener('change', function () {
      var f = file.files && file.files[0]; file.value = '';
      if (!f || busy) return;
      var img = new Image(), rd = new FileReader();
      rd.onload = function () {
        img.onload = function () { img.onload = img.onerror = null; send(toJpeg(img, img.naturalWidth, img.naturalHeight)); img.src = ''; };   // clearing src can fire onerror: detach first
        img.onerror = function () { setMsg(msg, 'That picture could not be read.', 'bad'); };
        img.src = rd.result;
      };
      rd.readAsDataURL(f);
    });

    /* one file, then one link per record; a retry re-uses the kept file and links only what is still missing */
    function send(b64) {
      busy = true; setMsg(msg, 'Keeping photo...');
      [takeBtn, chooseBtn, skipBtn].forEach(function (b) { b.disabled = true; });
      var first = fileId ? Promise.resolve({ ok: true, id: fileId })
        : o.send.fileAdd({ kind: 'photo', mime: 'image/jpeg', data_base64: b64, name: o.name || 'photo.jpg', taken_on: o.day, source: o.source || 'Done' });
      first.then(function (r) {
        if (!r || !r.ok) throw r;
        fileId = r.id;
        return ids.reduce(function (p, id) {
          return p.then(function () {
            if (linked[id]) return null;
            return o.send.linkAdd({ from_table: o.fromTable, from_id: id, role: 'evidence', to_table: 'files', to_id: fileId, from_date: o.day }).then(function (x) {
              if (!x || !x.ok) throw x;
              linked[id] = true;
            });
          });
        }, Promise.resolve());
      }).then(function () {
        busy = false; [takeBtn, chooseBtn, skipBtn].forEach(function (b) { b.hidden = true; });
        setMsg(msg, o.kept || '✓ Photo kept with the record.', 'good');
        if (o.onKept) o.onKept(fileId);
      }).catch(function (r) {
        busy = false; [takeBtn, chooseBtn, skipBtn].forEach(function (b) { b.disabled = false; });
        /* no answer (the save outbox keeps it): the photo is not joined to the record yet, so say so and let the person send it again */
        if (r && r.kept) { setMsg(msg, 'Photo not joined to the record yet: no answer. The record is saved. Try again when there is signal, or skip.', 'warn'); return; }
        setMsg(msg, notKept((r && r.message) || ''), 'bad');
      });
    }
    return stop;
  }

  return { DONE_KEY: DONE_KEY, ruleOn: ruleOn, doneOn: doneOn, staffSender: staffSender, offer: offer };
}));
