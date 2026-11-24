/*!
 * Codes vault page (Lisa 14 Nov 2026, option B). Owner-set access: can('codes.vault'), starting default role OWNER.
 * The vault password is typed here and kept only in memory while the vault is open (lib/code-vault.js). Codes are
 * sealed and opened on this device; only sealed hex and public ids go to the save script. One code shows at a time,
 * for 30 seconds; the vault locks after 1 minute without use and when the page is hidden.
 * Reads and saves use this device's code (the staff app's set-up), like every staff page.
 */
(function (root) {
  'use strict';
  var DEVICE_KEY = 'bld.device.code', SHOW_MS = 30000, PERM = { table: 'code_vault', action: 'open' };
  var save = root.BLDSave.create({}), V = root.BLDVault;
  var S = { state: 'start', msg: '', role: '', me: '', reg: [], vault: [], perm: [], sess: null, shown: '', shownTimer: null, busy: false };
  var screen = document.getElementById('screen');

  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function day(v) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || '')); return m ? (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] : ''; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function inForce(r, t) { var f = String(r.from_date || '').slice(0, 10), e = String(r.to_date || '').slice(0, 10); return (!f || f <= t) && (!e || e >= t); }

  /* can(key): BLD-permission rows when the save script serves them (person row beats role row; at one level no beats
     yes; judged on today's date). No row for this permission at all: the starting default, role OWNER. */
  function can() {
    var t = today(), rows = S.perm.filter(function (r) { return r.table_name === PERM.table && r.action === PERM.action && inForce(r, t); });
    if (!rows.length) return S.role === 'OWNER';
    var yes = function (r) { return String(r.allowed).toLowerCase() === 'yes'; };
    var mine = rows.filter(function (r) { return S.me && r.person_id === S.me; });
    if (mine.length) return mine.every(yes);
    var role = rows.filter(function (r) { return !r.person_id && r.role_code === S.role; });
    return role.length ? role.every(yes) : false;
  }

  function checkRow() {
    var c = S.vault.filter(function (r) { return r.code_id === V.CHECK_ID && !String(r.to_date || '').trim(); });
    return c.length ? c[c.length - 1] : null;
  }
  function sealedFor(codeId) {
    var c = S.vault.filter(function (r) { return r.code_id === codeId && !String(r.to_date || '').trim(); });
    return c.length ? c[c.length - 1] : null;
  }
  function codes() {
    var t = today(), open = {};
    S.reg.forEach(function (r) { if (r.code_id && inForce(r, t)) open[r.code_id] = r; });
    return Object.keys(open).map(function (k) { return open[k]; }).sort(function (a, b) { return String(a.who) < String(b.who) ? -1 : 1; });
  }

  function load() {
    var c = ''; try { c = localStorage.getItem(DEVICE_KEY) || ''; } catch (e) { c = ''; }
    if (!save.getScriptUrlSet() || !c) { S.state = 'nodevice'; return draw(); }
    save.setCode(c, false);
    S.state = 'reading'; draw();
    return Promise.resolve(save.checkStatus()).then(function () { return save.read('code_register'); }).then(function (r) {
      if (!r.ok) { S.state = 'error'; S.msg = r.message; return; }
      S.reg = r.rows || []; S.role = save.role(); S.me = r.id || '';
      return save.read('permission').then(function (p) { S.perm = p.ok ? (p.rows || []) : []; })
        .then(function () {
          if (!can()) { S.state = 'refused'; return; }
          return save.read('code_vaults').then(function (v) {
            if (!v.ok) { S.state = /FILE_(MISSING|NOT_ALLOWED)|NOT_ALLOWED/.test(v.code) ? 'notyet' : 'error'; S.msg = v.message; return; }
            S.vault = v.rows || [];
            S.state = checkRow() ? 'locked' : 'first';
          });
        });
    }).then(draw);
  }

  function hideShown() { clearTimeout(S.shownTimer); S.shown = ''; var el = document.getElementById('vShown'); if (el) el.textContent = ''; }
  function onLock() { hideShown(); S.sess = null; S.state = 'locked'; S.msg = 'Locked after a minute unused.'; draw(); }

  function draw() {
    var h = '<h1>' + 'Codes vault' + '</h1>';
    if (S.state === 'start' || S.state === 'reading') h += '<p>Reading…</p>';
    else if (S.state === 'nodevice') h += '<p>Open this on a phone or computer set up with your code.</p><p><a href="../#device">Set up this device</a></p>';
    else if (S.state === 'refused') h += '<p>Only people the owner allows can open the vault.</p>';
    else if (S.state === 'notyet') h += '<p>The vault starts after the save-script update.</p>';
    else if (S.state === 'error') h += '<p role="alert">' + esc(S.msg || 'Something went wrong.') + '</p><p><button type="button" class="btn" data-v="retry">Try again</button></p>';
    else if (S.state === 'first') {
      h += '<table class="house-table"><thead><tr><th>Step</th><th>What</th></tr></thead><tbody>'
        + '<tr><td>1</td><td>Pick a vault password. Share it only with the people you allow.</td></tr>'
        + '<tr><td>2</td><td><b>Forgotten password = every code is reset.</b> Nobody can get it back, not even us.</td></tr></tbody></table>'
        + '<form id="vFirst" autocomplete="off"><p><label>Vault password <input type="password" id="vP1" autocomplete="new-password" minlength="12" required></label></p>'
        + '<p><label>Again <input type="password" id="vP2" autocomplete="new-password" minlength="12" required></label></p>'
        + '<p><button type="submit" class="btn"' + (S.busy ? ' disabled' : '') + '>Set the password</button></p></form>'
        + (S.msg ? '<p role="alert">' + esc(S.msg) + '</p>' : '');
    } else if (S.state === 'locked') {
      h += '<form id="vOpen" autocomplete="off"><p><label>Vault password <input type="password" id="vPw" autocomplete="current-password" required></label></p>'
        + '<p><button type="submit" class="btn"' + (S.busy ? ' disabled' : '') + '>Open</button></p></form>'
        + (S.msg ? '<p role="status">' + esc(S.msg) + '</p>' : '');
    } else if (S.state === 'open') {
      var list = codes();
      h += '<p><button type="button" class="btn" data-v="lock">Lock now</button></p>'
        + '<p id="vShown" class="v-shown" aria-live="polite"></p>'
        + (list.length ? '<table class="house-table"><thead><tr><th>Who</th><th>Role</th><th>Id</th><th>From</th><th>Code</th></tr></thead><tbody>'
          + list.map(function (r) {
            var kept = !!sealedFor(r.code_id);
            return '<tr><td>' + esc(r.who) + '</td><td>' + esc(r.role) + '</td><td>' + esc(r.code_id) + '</td><td>' + esc(day(r.from_date)) + '</td><td>'
              + (kept ? '<button type="button" class="cb" data-v="show" data-id="' + esc(r.code_id) + '">Show</button>' : 'Not kept yet') + '</td></tr>';
          }).join('') + '</tbody></table>' : '<p>No codes in the register yet.</p>')
        + addHtml(list)
        + (S.msg ? '<p role="status">' + esc(S.msg) + '</p>' : '');
    }
    screen.innerHTML = h;
  }

  /* Add existing code: Lisa or Grace types or pastes a code from her current list. The save script checks it against
     that person's sign-in (ok or no only) before it is sealed, so a typo is never kept. */
  function addHtml(list) {
    var todo = list.filter(function (r) { return !sealedFor(r.code_id); });
    if (!todo.length) return '';
    return '<form id="vAdd" autocomplete="off"><h2>Add an existing code</h2>'
      + '<p><label>Whose <select id="vWho" required><option value="">Pick</option>' + todo.map(function (r) { return '<option value="' + esc(r.code_id) + '">' + esc(r.who) + ' (' + esc(r.code_id) + ')</option>'; }).join('') + '</select></label></p>'
      + '<p><label>Their code <input type="password" id="vCode" autocomplete="off" spellcheck="false" required></label></p>'
      + '<p><button type="submit" class="btn"' + (S.busy ? ' disabled' : '') + '>Check and keep</button></p></form>';
  }
  function addExisting() {
    var id = document.getElementById('vWho').value, inp = document.getElementById('vCode'), typed = inp.value;
    inp.value = '';
    var who = (codes().filter(function (r) { return r.code_id === id; })[0] || {}).who || id;
    if (!id || !typed) { S.msg = 'Pick the person and type their code.'; return draw(); }
    S.busy = true; S.msg = 'Checking\u2026'; draw();
    save.codeCheck(id, typed).then(function (c) {
      if (!c.ok) { S.busy = false; S.msg = 'Not checked: ' + (c.message || 'try again.'); return draw(); }
      if (!c.match) { S.busy = false; S.msg = 'That is not ' + who + '\u2019s code. Nothing kept.'; return draw(); }
      return S.sess.seal(id, typed).then(function (row) {
        typed = '';
        return save.submit('code_vaults', row).then(function (r) {
          S.busy = false;
          if (!r.ok) { S.msg = 'Not saved: ' + (r.message || 'try again.'); return draw(); }
          S.vault.push(row); S.msg = '\u2713 Kept: ' + who; draw();
        });
      });
    }).catch(function () { S.busy = false; S.msg = 'Not saved: try again.'; draw(); });
  }

  screen.addEventListener('submit', function (e) {
    e.preventDefault();
    if (S.busy) return;
    if (e.target.id === 'vAdd') return addExisting();
    if (e.target.id === 'vFirst') {
      var a = document.getElementById('vP1').value, b = document.getElementById('vP2').value;
      document.getElementById('vP1').value = ''; document.getElementById('vP2').value = '';
      if (a.length < 12) { S.msg = 'Use 12 characters or more.'; return draw(); }
      if (a !== b) { S.msg = 'The two passwords are not the same.'; return draw(); }
      S.busy = true; S.msg = 'Setting…'; draw();
      V.makeCheck(a).then(function (row) {
        return save.submit('code_vaults', row).then(function (r) {
          S.busy = false;
          if (!r.ok) { S.msg = 'Not saved: ' + (r.message || 'try again.'); return draw(); }
          S.vault.push(row); S.state = 'locked'; S.msg = 'Saved. Now open the vault with it.'; draw();
        });
      });
    } else if (e.target.id === 'vOpen') {
      var pw = document.getElementById('vPw').value; document.getElementById('vPw').value = '';
      S.busy = true; S.msg = 'Opening…'; draw();
      var sess = V.session({ onLock: onLock });
      sess.unlock(pw, checkRow()).then(function () { S.sess = sess; S.busy = false; S.state = 'open'; S.msg = ''; draw(); },
        function (er) { S.busy = false; S.msg = er && er.code === 'WRONG_PASSWORD' ? 'Wrong password.' : 'Could not open the vault.'; draw(); });
    }
  });

  screen.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-v]'); if (!t) return;
    var v = t.getAttribute('data-v');
    if (v === 'retry') load();
    if (v === 'lock' && S.sess) S.sess.lock();
    if (v === 'show' && S.sess) {
      var id = t.getAttribute('data-id'), row = sealedFor(id);
      hideShown();
      S.sess.show(row).then(function (code) {
        var el = document.getElementById('vShown'); if (!el) return;
        el.textContent = id + ': ' + code;   // one code at a time, never logged, gone after 30 s
        S.shownTimer = setTimeout(hideShown, SHOW_MS);
      }, function () { S.msg = 'That entry could not be opened.'; draw(); });
    }
  });

  root.BLDVaultPage = { can: can, state: function () { return S.state; } };
  load();
})(typeof window !== 'undefined' ? window : this);
