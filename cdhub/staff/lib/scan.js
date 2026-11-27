/*!
 * BLDScan - rear camera, QR only, in-app routes s/<tag> and mv/<tag>.
 */
(function (root) {
  'use strict';
  var TAG_RE = /^[A-Z2-9]{4,12}$/;
  var QR_SRC = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, 'vendor/jsQR.js');
  var qrP = null;

  function fragment(text) {
    var raw = String(text || '').trim();
    if (!raw) return '';
    var hash = raw.lastIndexOf('#');
    var body = hash >= 0 ? raw.slice(hash + 1) : raw;
    try { body = decodeURIComponent(body); } catch (e) { return ''; }
    body = body.replace(/^\/+/, '');
    var m = /^(s|mv)\/([A-Za-z0-9]{4,12})$/i.exec(body.trim());
    if (!m) return '';
    var tag = m[2].toUpperCase();
    if (!TAG_RE.test(tag)) return '';
    return m[1].toLowerCase() + '/' + tag;
  }

  function loadQr() {
    if (root.jsQR) return Promise.resolve(root.jsQR);
    if (!QR_SRC) return Promise.reject(new Error('qr'));
    if (qrP) return qrP;
    qrP = new Promise(function (ok, no) {
      var s = document.createElement('script');
      s.src = QR_SRC;
      s.onload = function () { if (root.jsQR) ok(root.jsQR); else { qrP = null; no(new Error('qr')); } };
      s.onerror = function () { qrP = null; no(new Error('qr')); };
      document.head.appendChild(s);
    });
    return qrP;
  }

  function mount(host, c) {
    var h = c.h, stopped = false, stream = null, video = null, timer = 0, canvas = null;
    function stop() {
      stopped = true;
      if (timer) { cancelAnimationFrame(timer); timer = 0; }
      if (stream) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* already stopped */ } }
      stream = null;
      if (video) video.srcObject = null;
      if (canvas) { canvas.width = 0; canvas.height = 0; }
    }
    var box = h('div', { class: 'scan-cam' });
    video = h('video', { playsinline: true, muted: true, autoplay: true, 'aria-label': 'Camera' });
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    box.appendChild(video);
    var msg = h('p', { class: 'msg', role: 'status' });
    var field = h('input', { class: 'inp', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', 'aria-label': 'Type the code', placeholder: 'Type the code' });
    function useTyped() {
      var f = fragment(field.value);
      field.value = '';
      if (!f) { msg.className = 'msg bad'; msg.textContent = 'That code is not for this page.'; return; }
      stop();
      c.go(f);
    }
    field.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); useTyped(); } });
    var openBtn = h('button', { class: 'btn', type: 'button', text: 'Open', onclick: useTyped });
    host.appendChild(box);
    host.appendChild(msg);
    host.appendChild(field);
    host.appendChild(openBtn);

    function accept(text) {
      if (stopped) return;
      var f = fragment(text);
      if (!f) { msg.className = 'msg bad'; msg.textContent = 'That code is not for this page.'; return; }
      stop();
      c.go(f);
    }
    function watchNative() {
      var det = new root.BarcodeDetector({ formats: ['qr_code'] });
      function step() {
        if (stopped) return;
        det.detect(video).then(function (codes) {
          if (stopped) return;
          if (codes && codes.length && codes[0].rawValue) accept(codes[0].rawValue);
          if (!stopped) timer = requestAnimationFrame(step);
        }).catch(function () { if (!stopped) timer = requestAnimationFrame(step); });
      }
      step();
    }
    function watchJs() {
      canvas = document.createElement('canvas');
      var cx = canvas.getContext('2d', { willReadFrequently: true });
      function step() {
        if (stopped) return;
        var w = video.videoWidth, ht = video.videoHeight;
        if (w && ht && cx) {
          canvas.width = w; canvas.height = ht;
          cx.drawImage(video, 0, 0, w, ht);
          var img = cx.getImageData(0, 0, w, ht);
          var code = root.jsQR(img.data, w, ht);
          cx.clearRect(0, 0, w, ht);
          if (code && code.data) accept(code.data);
        }
        if (!stopped) timer = requestAnimationFrame(step);
      }
      step();
    }
    function begin() {
      try { if (root.BarcodeDetector) { watchNative(); return; } } catch (e) { /* use the vendored reader */ }
      loadQr().then(function () { if (!stopped) watchJs(); }).catch(function () {
        msg.className = 'msg bad';
        msg.textContent = 'The camera did not start. Type the code.';
      });
    }
    var secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!secure) {
      box.hidden = true;
      msg.className = 'msg bad';
      msg.textContent = 'The camera needs a secure page.';
      return stop;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      box.hidden = true;
      msg.className = 'msg bad';
      msg.textContent = 'This phone cannot use the camera here.';
      return stop;
    }
    navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' } } }).then(function (s) {
      if (stopped) { try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* gone */ } return; }
      stream = s;
      video.srcObject = s;
      var play = video.play();
      if (play && play.catch) play.catch(function () {});
      begin();
    }).catch(function (e) {
      box.hidden = true;
      var n = e && e.name;
      msg.className = 'msg bad';
      if (n === 'NotAllowedError' || n === 'PermissionDeniedError') msg.textContent = 'Camera is blocked for this page.';
      else if (n === 'NotFoundError' || n === 'DevicesNotFoundError') msg.textContent = 'No camera found on this phone.';
      else msg.textContent = 'The camera did not start. Type the code.';
    });
    return stop;
  }

  root.BLDScan = { mount: mount, fragment: fragment };
}(typeof window !== 'undefined' ? window : this));
