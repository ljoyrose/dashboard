/* Bloodline screen helpers. Tables come from drive.js (live Drive), not from a data folder. */
(function () {
  'use strict';
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function load(names) {
    return DriveTables.ensure().then(function () { return DriveTables.read(names); }).then(function (T) {
      if (T) document.body.classList.add('ready');
      return T;
    });
  }
  function by(rows, key) { var m = {}; (rows || []).forEach(function (r) { m[r[key]] = r; }); return m; }
  function group(rows, key) { var m = {}; (rows || []).forEach(function (r) { (m[r[key]] = m[r[key]] || []).push(r); }); return m; }
  function dmy(iso) { if (!iso) return ''; var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); if (!m) return iso; return m[3] + '/' + m[2] + '/' + m[1]; }
  function days(a, b) { if (!a) return null; var x = Date.parse(a), y = b ? Date.parse(b) : Date.now(); if (isNaN(x) || isNaN(y)) return null; return Math.round((y - x) / 864e5); }
  function age(dob) { var d = days(dob); if (d == null) return ''; if (d < 60) return d + ' days'; if (d < 730) return Math.floor(d / 30.4) + ' months'; return (d / 365.25).toFixed(1) + ' yrs'; }
  function qs(k) { var m = new RegExp('[?&]' + k + '=([^&]*)').exec(location.search); return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : ''; }
  function isActive(state) { return /^active$/i.test(state || ''); }
  function fileOf(key) { return 'BLD-' + key + '.csv'; }
  function whyNot(T, key, cols) {
    var file = fileOf(key);
    if (!T || (T.__missing || []).indexOf(file) >= 0 || !T[key]) return 'no data yet — ' + file + ' is not in the Drive folder';
    var rows = T[key];
    if (rows.__badHeader) return 'no data yet — ' + file + ' ' + rows.__badHeader;
    if (cols && cols.length) {
      var have = rows.__cols || [];
      var miss = cols.filter(function (c) { return have.indexOf(c) < 0; });
      if (miss.length) return 'no data yet — ' + file + ' has no column ' + miss.join(', ');
    }
    return '';
  }
  function have(T, key, cols) { return !whyNot(T, key, cols); }
  /* Record a missing column on a file that did load, so the page can still show the other columns. */
  function noteGap(T, key, cols) {
    if (!T || !cols || !cols.length) return '';
    var file = fileOf(key);
    if ((T.__missing || []).indexOf(file) >= 0 || !T[key]) return whyNot(T, key, cols);
    var rows = T[key];
    if (rows.__badHeader) return whyNot(T, key, cols);
    var haveCols = rows.__cols || [];
    var miss = cols.filter(function (c) { return haveCols.indexOf(c) < 0; });
    if (!miss.length) return '';
    var line = file + ' has no column ' + miss.join(', ');
    T.__notes = T.__notes || [];
    if (T.__notes.indexOf(line) < 0) T.__notes.push(line);
    return 'no data yet — ' + line;
  }
  function nodata(why) {
    var detail = String(why || 'no data yet').replace(/^no data yet\s*[—-]\s*/, '');
    return '<div class="nodata" role="status"><b>no data yet</b><p>' + esc(detail) + '</p></div>';
  }
  function banner(T) {
    if (!T) return '';
    var bits = [];
    (T.__missing || []).forEach(function (f) { bits.push(f + ' is not in the Drive folder'); });
    Object.keys(T).forEach(function (k) {
      if (k.indexOf('__') === 0) return;
      var rows = T[k];
      if (rows && rows.__badHeader) bits.push(fileOf(k) + ' ' + rows.__badHeader);
    });
    (T.__notes || []).forEach(function (n) { bits.push(n); });
    if (!bits.length) return '';
    return '<div class="nodata" role="status"><b>no data yet</b><ul>' + bits.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul></div>';
  }
  function table(rows, cols, opts) {
    opts = opts || {};
    var h = '<div class="scroll"><table><thead><tr>' + cols.map(function (c) { return '<th>' + esc(c[0]) + '</th>'; }).join('') + '</tr></thead><tbody>';
    if (!rows || !rows.length) h += '<tr><td colspan="' + cols.length + '">' + esc(opts.empty || 'No rows.') + '</td></tr>';
    (rows || []).forEach(function (r) {
      h += '<tr>' + cols.map(function (c) {
        var v = typeof c[1] === 'function' ? c[1](r) : esc(r[c[1]]);
        return '<td>' + (v == null ? '' : v) + '</td>';
      }).join('') + '</tr>';
    });
    return h + '</tbody></table></div>';
  }
  function pill(text, cls) { return '<span class="pill ' + (cls || '') + '">' + esc(text) + '</span>'; }
  function stamp(T) {
    var files = Object.keys(T || {}).filter(function (k) { return k.indexOf('__') !== 0; }).map(function (k) {
      return fileOf(k) + ' (' + (T[k] ? T[k].length : 0) + ')';
    });
    var when = '';
    try { when = T && T.__readAt ? new Date(T.__readAt).toLocaleString('en-GB', { timeZone: 'Europe/London' }) : new Date().toLocaleString('en-GB'); } catch (e) { when = ''; }
    return banner(T) + '<div class="src"><span>&#9432;</span><span><b>Read live from Drive</b> (' + esc(DriveTables.FOLDER_NAME) + '): '
      + esc(files.join(' · ')) + (when ? ' · read ' + esc(when) : '')
      + '. Read-only. ' + esc(DriveTables.SAVE_NOTE) + '.</span></div>';
  }
  function nav(active) { return DriveTables.nav(active); }
  function subjectName(S, id) { var s = S[id]; return s && s.name ? s.name : (id || ''); }
  function link(id, S) {
    if (!id) return '';
    var known = S && S[id];
    var label = known ? esc(known.name || id) : esc(id) + ' <span class="muted">(not on file)</span>';
    return '<a href="bld-dog.html?id=' + encodeURIComponent(id) + '">' + label + '</a>';
  }
  function col(rows, name) {
    return rows && rows.__cols && rows.__cols.indexOf(name) >= 0;
  }
  function addHubLink() {
    var hdr = document.querySelector('.hdr');
    if (!hdr || document.getElementById('hubback')) return;
    var a = document.createElement('a');
    a.id = 'hubback';
    a.className = 'quiet';
    a.href = '../cdhub/';
    a.textContent = 'CD Hub';
    hdr.appendChild(a);
  }
  if (document.body) addHubLink();
  window.BLD = {
    load: load, by: by, group: group, esc: esc, dmy: dmy, days: days, age: age, qs: qs,
    isActive: isActive, whyNot: whyNot, have: have, noteGap: noteGap, nodata: nodata, banner: banner,
    table: table, pill: pill, stamp: stamp, nav: nav, link: link, subjectName: subjectName, col: col
  };
})();
