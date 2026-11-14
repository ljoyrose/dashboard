/* Codes vault, browser only (Lisa 14 Nov 2026, option B: a shared vault password for the admins, codes kept in Admin).
   Each code is sealed here, on this device: AES-GCM 256 with a key from PBKDF2-SHA256 (600,000 rounds or more) of the
   vault password, a fresh random salt and IV per entry, and the public code id bound in as additional data (a sealed
   code cannot be moved onto another person's row). Only the sealed text, the salt, the IV and the public id leave the
   device. The password and the plain code never do, and nothing here logs either.
   A check row (code_id "vault-check") seals a known text: a wrong password fails on it before any code is tried.
   A forgotten password cannot be recovered by anyone: every code is then reset. */
(function (root) {
  'use strict';
  var ITER = 600000, MIN_ITER = 600000, KDF = 'PBKDF2-SHA256/AES-GCM-256';
  var CHECK_ID = 'vault-check', CHECK_TEXT = 'bld-vault-check-v1';
  var IDLE_MS = 60000;

  function subtle() {
    var c = root.crypto;
    if (!c || !c.subtle) throw verr('NO_CRYPTO', 'This browser cannot open the vault.');
    return c.subtle;
  }
  function verr(code, msg) { var e = new Error(msg); e.code = code; return e; }
  function rand(n) { var b = new Uint8Array(n); root.crypto.getRandomValues(b); return b; }
  /* hex, not base64: base64 can start with + or -, which the save refuses at the start of a cell (formula guard) */
  function hex(bytes) { return Array.prototype.map.call(new Uint8Array(bytes), function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join(''); }
  function unhex(s) { s = String(s || ''); if (!/^([0-9a-f]{2})*$/.test(s)) return new Uint8Array(0); var b = new Uint8Array(s.length / 2); for (var i = 0; i < b.length; i++) b[i] = parseInt(s.substr(i * 2, 2), 16); return b; }
  function utf8(s) { return new TextEncoder().encode(String(s)); }

  function key(password, salt, iter) {
    if (!password) return Promise.reject(verr('NO_PASSWORD', 'Type the vault password.'));
    return subtle().importKey('raw', utf8(password), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }

  /* Seal one code. Returns the row fields to save: no plain text in it. */
  function seal(password, codeId, plain) {
    if (!codeId) return Promise.reject(verr('NO_ID', 'Say which code.'));
    if (plain == null || String(plain) === '') return Promise.reject(verr('NO_CODE', 'Type the code.'));
    var salt = rand(16), iv = rand(12);
    return key(password, salt, ITER).then(function (k) {
      return subtle().encrypt({ name: 'AES-GCM', iv: iv, additionalData: utf8(codeId) }, k, utf8(plain));
    }).then(function (ct) {
      return { code_id: String(codeId), cipher: hex(ct), iv: hex(iv), salt: hex(salt), kdf: KDF, kdf_iter: String(ITER) };
    });
  }

  /* Open one sealed row. A wrong password, a changed row or a row moved to another id all fail the same way. */
  function open(password, row) {
    if (!row || !row.cipher) return Promise.reject(verr('NO_ROW', 'Nothing kept for this code.'));
    var iter = parseInt(row.kdf_iter, 10);
    if (row.kdf !== KDF || !(iter >= MIN_ITER)) return Promise.reject(verr('WEAK_ROW', 'This entry was not sealed the vault’s way. Add the code again.'));
    return key(password, unhex(row.salt), iter).then(function (k) {
      return subtle().decrypt({ name: 'AES-GCM', iv: unhex(row.iv), additionalData: utf8(row.code_id) }, k, unhex(row.cipher));
    }).then(function (pt) { return new TextDecoder().decode(pt); }, function (e) {
      if (e && e.code) throw e;
      throw verr('WRONG_PASSWORD', 'Wrong password.');
    });
  }

  function makeCheck(password) { return seal(password, CHECK_ID, CHECK_TEXT); }
  function checkPassword(password, checkRow) {
    return open(password, checkRow).then(function (t) { return t === CHECK_TEXT; }, function (e) { if (e && e.code === 'WRONG_PASSWORD') return false; throw e; });
  }

  /* Does a typed code match the hash the sign-in keeps? SHA-256 of salt + ":" + code, as the save script does (Auth.gs). */
  function hashMatches(code, salt, hash) {
    return subtle().digest('SHA-256', utf8(String(salt) + ':' + String(code).trim())).then(function (d) {
      return !!hash && hex(d) === String(hash).toLowerCase();
    });
  }

  /* One unlocked spell. The password is held only inside it and dropped on lock: after idleMs with no use, on
     lock(), and when the page is hidden. show() opens one row at a time. */
  function session(opts) {
    opts = opts || {};
    var pw = null, timer = null, idle = opts.idleMs || IDLE_MS, onLock = opts.onLock || function () {};
    function lock() { var was = pw !== null; pw = null; clearTimeout(timer); timer = null; if (was) onLock(); }
    function touch() { clearTimeout(timer); if (pw !== null) timer = setTimeout(lock, idle); }
    if (root.document && opts.lockWhenHidden !== false) root.document.addEventListener('visibilitychange', function () { if (root.document.hidden) lock(); });
    return {
      unlock: function (password, checkRow) {
        return checkPassword(password, checkRow).then(function (ok) { if (!ok) throw verr('WRONG_PASSWORD', 'Wrong password.'); pw = password; touch(); return true; });
      },
      isOpen: function () { return pw !== null; },
      show: function (row) { if (pw === null) return Promise.reject(verr('LOCKED', 'The vault is locked.')); touch(); return open(pw, row); },
      seal: function (codeId, plain) { if (pw === null) return Promise.reject(verr('LOCKED', 'The vault is locked.')); touch(); return seal(pw, codeId, plain); },
      touch: touch,
      lock: lock
    };
  }

  var api = { ITER: ITER, KDF: KDF, CHECK_ID: CHECK_ID, IDLE_MS: IDLE_MS, seal: seal, open: open, makeCheck: makeCheck, checkPassword: checkPassword, hashMatches: hashMatches, session: session };
  root.BLDVault = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
