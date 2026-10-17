/* Bloodline Drive reader.
   Same sign-in and folder read as cdhub/index.html: one public OAuth client, Drive read-only,
   folder 10m8HauOLAdj2QStgNJ2T3b3W599VXWro, files found by exact title, trashed files skipped.
   Two files with the same title stop the read ("More than one file shares a title").
   /cdhub/ is left as it is so its behaviour does not change. Every Bloodline screen uses this file.
   Nothing here writes to Drive. */
(function () {
  'use strict';
  var FOLDER = '10m8HauOLAdj2QStgNJ2T3b3W599VXWro';
  var FOLDER_NAME = '*01 SLA Inspections / BLD-app-tables';
  var CLIENT_ID = '135419966158-qqhndd85mott7p7rqbjbrji8sjhbkt88.apps.googleusercontent.com';
  var SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
  var DRIVE = 'https://www.googleapis.com/drive/v3/files';
  var SAVE_NOTE = 'Saving switches on with the write path (PR #10)';
  var TOKEN = null, TOKEN_EXP = 0, TOKENCLIENT = null;
  var listed = null;
  var waiters = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function DriveErr(status, msg) {
    var e = new Error(msg || '');
    e.status = status;
    e.code = status === 401 ? 'Sign-in expired'
      : status === 403 ? ('Google refused access' + (msg ? ' (' + msg + ')' : ''))
      : status === 404 ? 'Folder not found, or this account cannot see it'
      : ('Drive error ' + status + (msg ? ' (' + msg + ')' : ''));
    return e;
  }
  function gget(url, asText) {
    if (!TOKEN || Date.now() > TOKEN_EXP) return Promise.reject(DriveErr(401, ''));
    return fetch(url, { headers: { Authorization: 'Bearer ' + TOKEN } }).then(function (res) {
      if (res.ok) return asText ? res.text() : res.json();
      return res.text().then(function (b) {
        var m = '';
        try { var j = JSON.parse(b); m = (j.error && j.error.message) || ''; } catch (x) {}
        throw DriveErr(res.status, m);
      });
    });
  }
  /* Same row rules as cdhub/index.html parseCSV, returned as cells so a COUNT preamble can be skipped. */
  function parseRaw(text) {
    text = String(text || '').replace(/^\uFEFF/, '').replace(/[ \t]+\n/g, '\n').replace(/\r/g, '');
    var rows = [], row = [], f = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
        else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f.replace(/\s+$/, '')); rows.push(row); row = []; f = ''; }
      else f += c;
    }
    if (f !== '' || row.length) { row.push(f.replace(/\s+$/, '')); rows.push(row); }
    return rows.filter(function (r) { return r.length > 1 || (r[0] || '').trim() !== ''; });
  }
  function toObjects(text, title) {
    var raw = String(text || '').replace(/^\uFEFF/, '');
    if (title === 'BLD-_MANIFEST.csv' && !/^"?file,/i.test(raw)) {
      var nl = raw.indexOf('\n');
      raw = nl < 0 ? '' : raw.slice(nl + 1);
    }
    var matrix = parseRaw(raw);
    while (matrix.length && /^COUNT\b/i.test(String(matrix[0][0] || '').trim())) matrix.shift();
    var rows = [];
    rows.__cols = [];
    rows.__file = title || '';
    if (!matrix.length) return rows;
    var head = matrix[0].map(function (h) { return String(h || '').trim(); });
    var named = head.filter(Boolean);
    if (!named.length || head.some(function (h) { return !h || h.length > 80 || /^COUNT\b/i.test(h); })) {
      rows.__badHeader = 'has no usable column headings (the first line is a note, not a header)';
    }
    rows.__cols = named;
    matrix.slice(1).forEach(function (r) {
      var o = {};
      head.forEach(function (h, i) {
        if (!h) return;
        o[h] = (r[i] == null ? '' : String(r[i])).trim();
      });
      rows.push(o);
    });
    return rows;
  }
  async function listFolder() {
    var files = [], pt = '';
    do {
      var q = new URLSearchParams({
        q: "'" + FOLDER + "' in parents and trashed = false",
        fields: 'nextPageToken,files(id,name,mimeType,modifiedTime)',
        pageSize: '1000',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
        corpora: 'allDrives'
      });
      if (pt) q.set('pageToken', pt);
      var r = await gget(DRIVE + '?' + q.toString());
      files = files.concat(r.files || []);
      pt = r.nextPageToken || '';
    } while (pt);
    return files;
  }
  function readDriveFile(f) {
    if (f.mimeType === 'application/vnd.google-apps.spreadsheet')
      return gget(DRIVE + '/' + encodeURIComponent(f.id) + '/export?mimeType=text%2Fcsv', true);
    return gget(DRIVE + '/' + encodeURIComponent(f.id) + '?alt=media&supportsAllDrives=true', true);
  }
  function listOnce() {
    if (listed) return listed;
    listed = listFolder().then(function (files) {
      var byTitle = {};
      files.forEach(function (f) { (byTitle[f.name] = byTitle[f.name] || []).push(f); });
      var dup = Object.keys(byTitle).filter(function (t) { return byTitle[t].length > 1; });
      if (dup.length) {
        var err = new Error('More than one file shares a title');
        err.code = 'ambiguous';
        err.titles = dup;
        throw err;
      }
      return { byTitle: byTitle, at: new Date().toISOString() };
    });
    listed.catch(function () { listed = null; });
    return listed;
  }
  function ensureStyles() {
    if (document.getElementById('dt-style')) return;
    var css = document.createElement('style');
    css.id = 'dt-style';
    css.textContent = '.dt-gate{font-family:Figtree,ui-sans-serif,system-ui,sans-serif;background:#fff;color:#1a1c1e;border:1px solid #e4e2dc;border-left:5px solid #4098BE;border-radius:14px;padding:16px;margin:16px 0;max-width:40rem}'
      + '.dt-gate h4{margin:0 0 8px;font-family:"Bricolage Grotesque",Figtree,sans-serif;font-size:1.15rem}'
      + '.dt-gate p{margin:0 0 10px;line-height:1.45}'
      + '#signinbtn,button[data-reload],button[data-signout]{font:600 1rem Figtree,system-ui,sans-serif;min-height:44px;padding:10px 16px;border-radius:999px;border:1px solid #1a1c1e;background:#1a1c1e;color:#fff;cursor:pointer}'
      + '#signinbtn:disabled{opacity:.55;cursor:default}'
      + '.dt-err{font-family:Figtree,ui-sans-serif,system-ui,sans-serif;background:#fff;color:#1a1c1e;border:1px solid #e4e2dc;border-left:5px solid #BE6A5D;border-radius:14px;padding:16px;margin:16px 0;max-width:40rem}'
      + '@media (prefers-color-scheme:dark){.dt-gate,.dt-err{background:#1f2123;color:#eceef0;border-color:#33363a}}';
    document.head.appendChild(css);
  }
  function gateHTML(err) {
    ensureStyles();
    return '<div class="card info dt-gate"><h4>Sign in to see the tables</h4>'
      + '<p>This page holds no data of its own. Once you sign in with Google it reads the tables live from '
      + esc(FOLDER_NAME) + ', with read-only access. Nothing is saved on this page or in this browser, and signing out forgets everything.</p>'
      + (err ? '<p>' + esc(err) + '</p>' : '')
      + '<p style="margin-bottom:0"><button type="button" id="signinbtn"' + (TOKENCLIENT ? '' : ' disabled') + '>'
      + (TOKENCLIENT ? 'Sign in with Google' : 'Loading Google sign-in…') + '</button></p></div>';
  }
  function showGate(err) {
    var main = document.getElementById('main') || document.getElementById('app');
    if (main) main.innerHTML = gateHTML(err);
  }
  function showFatal(e) {
    var main = document.getElementById('main') || document.getElementById('app');
    if (!main) return;
    var ambiguous = e && e.code === 'ambiguous';
    ensureStyles();
    main.innerHTML = '<div class="dt-err card risk"><h4>'
      + (ambiguous ? 'More than one file shares a title' : 'The folder could not be read') + '</h4><p>'
      + (ambiguous
        ? 'Refusing to guess which is current: ' + esc((e.titles || []).join(', '))
        : esc((e && (e.code || e.message)) || 'The tables could not be read.') + '. The tables live in ' + esc(FOLDER_NAME) + '.')
      + '</p><p style="margin-bottom:0"><button type="button" data-reload="1">Try again</button></p></div>';
  }
  var resume = false;
  function signIn() {
    resume = false;
    if (TOKENCLIENT) TOKENCLIENT.requestAccessToken({ prompt: TOKEN ? '' : 'select_account' });
  }
  /* Next screen is a new page, so the token (kept only in memory) is gone.
     Ask Google quietly for the session it already has. Nothing is written to storage. */
  function tryResume() {
    if (!TOKENCLIENT || TOKEN) return;
    resume = true;
    TOKENCLIENT.requestAccessToken({ prompt: '' });
  }
  function signOut() {
    var t = TOKEN;
    TOKEN = null;
    TOKEN_EXP = 0;
    listed = null;
    resume = false;
    if (t && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(t, function () {});
    document.body.classList.remove('ready');
    var stamp = document.getElementById('stamp');
    if (stamp) stamp.textContent = '';
    showGate('');
  }
  function flush() {
    var w = waiters;
    waiters = [];
    w.forEach(function (fn) { fn(); });
  }
  function initGoogle() {
    if (!(window.google && google.accounts && google.accounts.oauth2)) return false;
    TOKENCLIENT = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: function (resp) {
        resume = false;
        if (resp.error) { showGate('Sign-in did not complete.'); return; }
        if (!google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE)) {
          showGate('Drive read access was not granted, so the tables cannot be read.');
          return;
        }
        TOKEN = resp.access_token;
        TOKEN_EXP = Date.now() + (Number(resp.expires_in) || 3600) * 1000 - 60000;
        flush();
      },
      error_callback: function (e) {
        if (resume) { resume = false; return; }
        var kind = (e && e.type) || '';
        showGate(kind === 'popup_failed_to_open'
          ? 'The browser blocked the sign-in window. Allow pop-ups for this page and try again.'
          : kind === 'popup_closed'
            ? 'The sign-in window was closed before it finished.'
            : 'Sign-in did not complete.');
      }
    });
    var btn = document.getElementById('signinbtn');
    if (btn) { btn.disabled = false; btn.textContent = 'Sign in with Google'; }
    tryResume();
    return true;
  }
  function bootGoogle() {
    (function wait(n) {
      if (!initGoogle() && n < 100) setTimeout(function () { wait(n + 1); }, 100);
      else if (!TOKENCLIENT) showGate('Google sign-in could not load. Check the connection and reload the page.');
    })(0);
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target && ev.target.closest ? ev.target.closest('button') : null;
    if (!t) return;
    if (t.id === 'signinbtn') { ev.preventDefault(); signIn(); }
    else if (t.getAttribute('data-signout') != null) { ev.preventDefault(); signOut(); }
    else if (t.getAttribute('data-reload') != null) { ev.preventDefault(); listed = null; location.reload(); }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootGoogle);
  else bootGoogle();

  function ensure() {
    if (TOKEN && Date.now() < TOKEN_EXP) return Promise.resolve();
    showGate('');
    return new Promise(function (resolve) { waiters.push(resolve); });
  }
  function read(names) {
    var main = document.getElementById('main') || document.getElementById('app');
    if (main) main.innerHTML = '<p class="muted">Reading the tables from Drive…</p>';
    return listOnce().then(function (pack) {
      var T = { __missing: [], __notes: [], __readAt: pack.at };
      var seq = Promise.resolve();
      names.forEach(function (title) {
        seq = seq.then(function () {
          var key = title.replace(/^BLD-|\.csv$/g, '');
          if (main) main.innerHTML = '<p class="muted">Reading the tables from Drive… ' + esc(title) + '</p>';
          if (!pack.byTitle[title]) {
            var missing = [];
            missing.__cols = [];
            missing.__file = title;
            T[key] = missing;
            T.__missing.push(title);
            return;
          }
          return readDriveFile(pack.byTitle[title][0]).then(function (txt) {
            var rows = toObjects(txt, title);
            rows.__file = title;
            T[key] = rows;
          }).catch(function (e) {
            var empty = [];
            empty.__cols = [];
            empty.__file = title;
            T[key] = empty;
            T.__missing.push(title);
            T.__notes.push(title + ': ' + ((e && e.code) || 'read failed'));
          });
        });
      });
      return seq.then(function () { return T; });
    }).catch(function (e) {
      showFatal(e);
      return null;
    });
  }

  var PAGES = [
    ['bld-home.html', 'Home'],
    ['bld-dogs.html', 'Dogs'],
    ['bld-litters.html', 'Litters'],
    ['bld-matings.html', 'Matings'],
    ['bld-health.html', 'Health'],
    ['bld-areas.html', 'Areas'],
    ['bld-stock.html', 'Stock'],
    ['bld-people.html', 'People'],
    ['bld-prospects.html', 'Prospects'],
    ['bld-inspector.html', 'Inspector'],
    ['bld-rules.html', 'Rules'],
    ['bld-work.html', 'Work'],
    ['bloodline.html', 'Build brief'],
    ['bloodline-rivals.html', 'Rivals']
  ];
  function nav(active) {
    return '<nav aria-label="Bloodline screens">' + PAGES.map(function (p) {
      return '<a href="' + p[0] + '"' + (p[0] === active ? ' aria-current="true"' : '') + '>' + p[1] + '</a>';
    }).join('') + '<button type="button" data-signout="1">Sign out</button></nav>';
  }

  window.DriveTables = {
    FOLDER: FOLDER,
    FOLDER_NAME: FOLDER_NAME,
    CLIENT_ID: CLIENT_ID,
    SCOPE: SCOPE,
    SAVE_NOTE: SAVE_NOTE,
    esc: esc,
    parseRaw: parseRaw,
    toObjects: toObjects,
    ensure: ensure,
    read: read,
    nav: nav,
    signOut: signOut
  };
})();
