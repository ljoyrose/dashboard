// Lives in estate/ only because that folder is already copied by pages.yml (a workflow file Lisa alone changes); it is the
// Personal Drive page (Drives > Personal Drive), not the Web hub. Fetched only when that page opens with bin actions allowed,
// so no other page pays for it (Lisa, 3 Nov 2026: lazy-load before #273 merges; same pattern as estate/donq.js).
// The page (index.html) passes in what this needs through PBin.init(ctx). The personal scan state (Q), busy, the tick
// lists and the sign-in state are read through ctx getters, because the page replaces them.
(function (root) {
  'use strict';
  var X = null;
  var personalAuth, pcpFresh, keepPersonalCandidate, isMoneyRollback, pcpAllPages, loadLedgerSet, classifyPcp, friendlyError, render, pickedItems, apiGet, apiCall, isZeroByte, nameHasRr, isZzFamilyName, mapLimit, spellingOf, recheckForBin, trashOnly, num, esc, visibleRows, pickCount, rowAllowed, tickBox, showBar, listShown, icon, CFG, API, LIVE_FIELDS, FOLDER_MIME, PCP_PREFIX, LEDGER_FAIL;
  var P = root.PBin = {};
  P.init = function (ctx) {
    X = ctx;
    personalAuth = ctx.personalAuth;
    pcpFresh = ctx.pcpFresh;
    keepPersonalCandidate = ctx.keepPersonalCandidate;
    isMoneyRollback = ctx.isMoneyRollback;
    pcpAllPages = ctx.pcpAllPages;
    loadLedgerSet = ctx.loadLedgerSet;
    classifyPcp = ctx.classifyPcp;
    friendlyError = ctx.friendlyError;
    render = ctx.render;
    pickedItems = ctx.pickedItems;
    apiGet = ctx.apiGet;
    apiCall = ctx.apiCall;
    isZeroByte = ctx.isZeroByte;
    nameHasRr = ctx.nameHasRr;
    isZzFamilyName = ctx.isZzFamilyName;
    mapLimit = ctx.mapLimit;
    spellingOf = ctx.spellingOf;
    recheckForBin = ctx.recheckForBin;
    trashOnly = ctx.trashOnly;
    num = ctx.num;
    esc = ctx.esc;
    visibleRows = ctx.visibleRows;
    pickCount = ctx.pickCount;
    rowAllowed = ctx.rowAllowed;
    tickBox = ctx.tickBox;
    showBar = ctx.showBar;
    listShown = ctx.listShown;
    icon = ctx.icon;
    CFG = ctx.CFG;
    API = ctx.API;
    LIVE_FIELDS = ctx.LIVE_FIELDS;
    FOLDER_MIME = ctx.FOLDER_MIME;
    PCP_PREFIX = ctx.PCP_PREFIX;
    LEDGER_FAIL = ctx.LEDGER_FAIL;
    PB = CFG.personalBin || {};
    PB_DRY = PB.dryRun !== false;
    PB_SURFACE = String(PB.surface || 'drive-personal').toLowerCase();
  };
  // ---- Personal Drive bin (TidyUp Apps 3): the same Rename and Bin steps as Work My Drive, for the personal account. ----
  // Look-only until Lisa presses "Allow personal bin actions" (full Drive scope for the personal account, token in memory
  // only, cleared on sign-out). DRY_RUN (config personalBin.dryRun, default true) lists and changes nothing. A file can be
  // binned only if it starts ZZ_DELETE_DRIVE_, is a file (not a folder) in that personal My Drive, and has a ledger row
  // with surface personalBin.surface. Before each move: recheckForBin (md5 + size + not trashed), then trashOnly().
  var PB = {}, PB_DRY = true, PB_SURFACE = 'drive-personal';
  var qLoadGen = 0;
  function qLive() { return !PB_DRY && !!personalAuth.binToken(); }
  function qExpired() {
    personalAuth.clear();
    X.setQ(pcpFresh('idle', ''));
    X.Q().error = 'Personal sign-in expired. Sign in again.';
  }
  function loadQCandidates() {
    var tok = personalAuth.token();
    if (!tok || !personalAuth.binToken() || !X.signedIn()) return;
    if (X.Q().binStatus === 'loading' || X.Q().binStatus === 'ok') return;
    var gen = ++qLoadGen, found = [], seen = {};
    X.Q().binStatus = 'loading'; render();
    function take(files) {
      files.forEach(function (f) {
        if (!keepPersonalCandidate(f) || seen[f.id]) return;
        seen[f.id] = 1;
        f._moneyHold = isMoneyRollback(f, []);
        found.push(f);
      });
    }
    var fields = 'nextPageToken,files(id,name,parents,mimeType,size,md5Checksum,modifiedTime,ownedByMe,driveId)';
    var q = " and 'me' in owners and trashed = false";
    pcpAllPages({ corpora: 'user', q: "name contains '" + PCP_PREFIX + "'" + q, pageSize: '1000', fields: fields }, take, tok)
      .then(function () { return pcpAllPages({ corpora: 'user', q: "name contains 'ZZ-DELETE'" + q, pageSize: '200', fields: fields }, take, tok); })
      .then(function () { return pcpAllPages({ corpora: 'user', q: "name contains 'ZZ DELETE'" + q, pageSize: '200', fields: fields }, take, tok); })
      .then(function () { return loadLedgerSet(); })
      .then(function (led) {
        if (gen !== qLoadGen) return;
        var mine = {}, srf = X.surf();
        found.forEach(function (f) { if (srf[PB_SURFACE + ' ' + f.id]) mine[f.id] = true; });
        X.Q().ledgerOk = !!led.ok;
        X.Q().ledgerNote = led.ok ? '' : (led.note || LEDGER_FAIL);
        X.Q().candidates = found.map(function (f) {
          var c = classifyPcp(f, { ok: led.ok, ids: mine });
          if (!c.blocked && f.mimeType === FOLDER_MIME) { c.blocked = true; c.reason = 'Folder, left alone.'; }
          if (!c.blocked && f.driveId) { c.blocked = true; c.reason = 'Not in your personal Drive.'; }
          return c;
        });
        X.Q().binStatus = 'ok';
      }, function (err) {
        if (gen !== qLoadGen) return;
        var fr = friendlyError(err);
        if (fr.expired) { qExpired(); return; }
        X.Q().ledgerOk = false; X.Q().ledgerNote = 'Could not read the personal bin list: ' + fr.text; X.Q().candidates = []; X.Q().binStatus = 'ok';
      }).then(function () { if (gen === qLoadGen) render(); });
  }
  function qRefresh() { X.Q().binStatus = 'idle'; qLoadGen++; render(); loadQCandidates(); }
  function qNewName(f) { return PCP_PREFIX + f.name; }
  function qMark() {
    if (X.busy() || !qLive()) return;
    var items = pickedItems('qmark');
    if (!items.length) return;
    var ok = window.confirm('Rename ' + items.length + ' selected personal file' + (items.length === 1 ? '' : 's') + ' to start ' + PCP_PREFIX + '?\n\nEach one already exists identically in a shared drive. Nothing is deleted yet. Names containing RR_ are not included. Zero-byte files are not included.');
    if (!ok) return;
    var tok = personalAuth.binToken();
    if (!tok) return;
    X.setBusy(true); X.Q().marked = { done: 0, failed: 0, skipped: 0 }; render();
    var doneIds = {}, halted = false;
    mapLimit(items, 4, function (f) {
      if (halted) { X.Q().marked.skipped++; return; }
      return apiGet(API + '/' + encodeURIComponent(f.id) + '?supportsAllDrives=true&fields=' + LIVE_FIELDS, tok).then(function (live) {
        if (!live || live.trashed || live.ownedByMe === false || live.driveId || isZeroByte(live) || nameHasRr(live.name) || isZzFamilyName(live.name) || live.name !== f.name) { X.Q().marked.skipped++; return; }
        if (String(live.size) !== String(f.size) || (live.md5Checksum || '') !== (f.md5Checksum || '')) { X.Q().marked.skipped++; return; }
        return apiCall('PATCH', API + '/' + encodeURIComponent(f.id) + '?supportsAllDrives=true&fields=id', { name: qNewName(f) }, tok).then(function () { X.Q().marked.done++; doneIds[f.id] = true; }, function () { X.Q().marked.failed++; });
      }, function (err) {
        if (friendlyError(err).expired) halted = true;
        X.Q().marked.failed++;
      });
    }).then(function () {
      X.setBusy(false); X.pick().qmark = {};
      if (halted) { var m = X.Q().marked; qExpired(); X.Q().marked = m; render(); return; }
      X.Q().matches = X.Q().matches.filter(function (f) { return !doneIds[f.id]; });
      X.Q().matchBytes = X.Q().matches.reduce(function (t, f) { return t + (f.size || 0); }, 0);
      qRefresh();
    });
  }
  function qBin() {
    if (X.busy() || !qLive() || !X.Q().ledgerOk) return;
    var items = pickedItems('qbin');
    if (!items.length) return;
    var ok = window.confirm('Bin ' + items.length + ' personal file' + (items.length === 1 ? '? It goes to' : 's? They go to') + ' your personal Drive bin and can be restored for 30 days. Nothing is deleted for good.');
    if (!ok) { X.Q().binned = { done: 0, failed: 0, skipped: 0, unsure: 0, found: items.length, cancelled: true, notes: [] }; render(); return; }
    var tok = personalAuth.binToken();
    if (!tok) return;
    X.setBusy(true); X.Q().binned = { done: 0, failed: 0, skipped: 0, unsure: 0, found: items.length, notes: [] }; render();
    var halted = false;
    mapLimit(items, 3, function (f) {
      if (halted) { X.Q().binned.skipped++; return; }
      if (f._moneyHold || isMoneyRollback(f, f._chain || []) || isZeroByte(f) || spellingOf(f.name, PCP_PREFIX) !== 'exact' || nameHasRr(f.name)) { X.Q().binned.failed++; X.Q().binned.notes.push({ name: f.name, text: 'Not moved' }); return; }
      return recheckForBin(f, { prefix: PCP_PREFIX, requireOwned: true, personal: true, tok: tok }).then(function (chk) {
        if (chk.expired) { halted = true; X.Q().binned.skipped++; return; }
        if (chk.ok && chk.live.driveId) chk = { ok: false, text: 'Skipped: not in your personal Drive.' };
        else if (chk.ok && chk.live.mimeType === FOLDER_MIME) chk = { ok: false, text: 'Not moved: folders are left alone here.' };
        if (!chk.ok) {
          X.Q().binned.notes.push({ name: f.name, text: chk.text });
          if (/^UNSURE/.test(chk.text || '')) X.Q().binned.unsure++;
          else if (/^Skipped/.test(chk.text || '')) X.Q().binned.skipped++;
          else X.Q().binned.failed++;
          return;
        }
        return trashOnly(f, tok).then(function (res) {
          if (res.expired) { halted = true; X.Q().binned.skipped++; return; }
          if (res.ok) X.Q().binned.done++; else { X.Q().binned.failed++; X.Q().binned.notes.push({ name: f.name, text: res.text }); }
        });
      });
    }).then(function () {
      X.setBusy(false); X.pick().qbin = {};
      if (halted) { var b = X.Q().binned; qExpired(); X.Q().binned = b; render(); return; }
      qRefresh();
    });
  }
  // The opted-in part of the Personal Drive page: Rename (exact copies from the last scan) and Ready to bin.
  function qBinBlock() {
    var html = '<div data-qbin-block>';
    html += '<ul class="notes"><li>Bin actions allowed for your personal account until you sign out or close this tab.</li><li>Only renames, and moves to the bin after a fresh check. Nothing is deleted for good.</li></ul>';
    if (PB_DRY) html += '<p class="note" data-qbin-dry>Dry run: nothing is renamed or binned. Switching it on is your call.</p>';
    if (X.Q().marked) html += '<p class="res ' + (X.Q().marked.failed ? 'bad' : 'ok') + '" data-q-marked>Renamed ' + num(X.Q().marked.done) + (X.Q().marked.failed ? ', ' + X.Q().marked.failed + ' failed' : '') + (X.Q().marked.skipped ? ', ' + X.Q().marked.skipped + ' skipped' : '') + '.</p>';
    if (X.Q().binned) {
      var b = X.Q().binned;
      html += b.cancelled ? '<p class="res" data-q-binned>Cancelled. Nothing binned.</p>'
        : '<p class="res ' + (b.failed ? 'bad' : 'ok') + '" data-q-binned>Found ' + num(b.found) + ', moved ' + num(b.done) + ' to the bin' + (b.skipped ? ', ' + b.skipped + ' skipped' : '') + (b.unsure ? ', ' + b.unsure + ' left for a person' : '') + (b.failed ? ', ' + b.failed + ' not moved' : '') + '.</p>' +
          (b.notes.length ? '<ul class="files">' + b.notes.slice(0, 30).map(function (n) { return '<li><div class="fname">' + esc(n.name) + '</div><p class="note">' + esc(n.text) + '</p></li>'; }).join('') + '</ul>' : '');
    }
    // Rename
    if (X.Q().status === 'done' && X.Q().matches.length) {
      var mrows = visibleRows('qmark'), nm = pickCount('qmark');
      html += '<div data-q-list="rename"><h4>Rename to get them ready (' + num(X.Q().matches.length) + ')</h4><ul class="files">' + mrows.map(function (f) {
        return '<li data-id="' + esc(f.id) + '">' + (rowAllowed('qmark', f) ? tickBox('qmark', f.id, false, esc(f.name)) : '<div class="fname">' + esc(f.name) + '</div>') + '</li>';
      }).join('') + '</ul>' + showBar('qmark', X.Q().matches.length, 30);
      if (!PB_DRY) html += '<div class="actions" data-pick-bar="qmark">' +
        '<button class="btn" type="button" data-action="selectall" data-group="qmark"' + (X.busy() ? ' disabled' : '') + '><span>Select all</span></button>' +
        '<button class="btn" type="button" data-action="clearpick" data-group="qmark"' + (X.busy() ? ' disabled' : '') + '><span>Clear</span></button>' +
        '<button class="btn" type="button" data-action="qmark"' + (nm && !X.busy() ? '' : ' disabled') + '><span>' + (nm ? 'Rename these (' + nm + ')' : 'Rename these: tick a file first') + '</span></button></div>';
      html += '</div>';
    }
    // Ready to bin
    html += '<div data-q-list="ready"><h4>Ready to bin</h4>';
    if (X.Q().binStatus !== 'ok') html += '<p class="note">Reading your personal bin list…</p>';
    else {
      if (X.Q().ledgerNote) html += '<p class="note fail">' + esc(X.Q().ledgerNote) + '</p>';
      var ready = X.Q().candidates.filter(function (f) { return !f.blocked; }), held = X.Q().candidates.filter(function (f) { return f.blocked; });
      var brows = visibleRows('qbin'), nb = pickCount('qbin');
      if (!ready.length) html += '<p class="note">Nothing is ready to bin.</p>';
      else {
        if (PB_DRY) html += '<p class="note" data-qbin-would>Dry run: ' + num(ready.length) + ' would go to the bin.</p>';
        html += '<ul class="files">' + brows.map(function (f) {
          return '<li data-id="' + esc(f.id) + '">' + (rowAllowed('qbin', f) ? tickBox('qbin', f.id, false, esc(f.name)) : '<div class="fname">' + esc(f.name) + '</div>') + '</li>';
        }).join('') + '</ul>' + showBar('qbin', ready.length, 30);
      }
      if (!PB_DRY && ready.length) html += '<div class="actions" data-pick-bar="qbin">' +
        '<button class="btn" type="button" data-action="selectall" data-group="qbin"' + (X.busy() ? ' disabled' : '') + '><span>Select all</span></button>' +
        '<button class="btn" type="button" data-action="clearpick" data-group="qbin"' + (X.busy() ? ' disabled' : '') + '><span>Clear</span></button>' +
        '<button class="btn danger solid" type="button" data-action="qbin"' + (nb && !X.busy() ? '' : ' disabled') + '>' + icon('bin') + '<span>' + (nb ? 'Bin these (' + nb + ')' : 'Bin these: tick a file first') + '</span></button></div>' +
        '<p class="note">Goes to your personal Drive bin. You can get it back for 30 days.</p>';
      if (held.length) html += '<div data-q-list="held"><h4>Not ready (' + num(held.length) + ')</h4><ul class="files">' + held.slice(0, listShown('q-held', held.length, 30)).map(function (f) {
        return '<li data-id="' + esc(f.id) + '" title="' + esc(f.reason) + '"><div class="fname">' + esc(f.name) + '</div><p class="note">' + esc(qWhy(f.reason)) + '</p></li>';
      }).join('') + '</ul>' + showBar('q-held', held.length, 30) + '</div>';
    }
    return html + '</div></div>';
  }
  // Plain words for why a personal file is not ready.
  function qWhy(reason) {
    if (/ledger row/i.test(reason)) return 'Waiting for the tidy bot to log it';
    if (/Ledger could not/i.test(reason)) return 'The log could not be read';
    if (/UNSURE|zero-byte/i.test(reason)) return 'Empty file, left for a person to check';
    if (/Rename needed|does not start/i.test(reason)) return 'Name needs fixing';
    if (/RR_|E02|money|protected/i.test(reason)) return 'Protected, never binned';
    return reason;
  }
  // Tick rules for the two Personal Drive lists (index.html rowAllowed asks here).
  P.allowed = function (group, it) {
    if (group === 'qmark') return qLive() && !nameHasRr(it.name) && !isZeroByte(it) && !isZzFamilyName(it.name);
    if (group === 'qbin') return qLive() && X.Q().ledgerOk && !it.blocked && spellingOf(it.name, PCP_PREFIX) === 'exact' && !nameHasRr(it.name) && !isZeroByte(it) && it.mimeType !== FOLDER_MIME;
    return false;
  };
  P.block = qBinBlock;
  P.load = loadQCandidates;
  P.qmark = qMark;
  P.qbin = qBin;
  P.list = function (group) {
    var q = X.Q();
    if (group === 'qmark') return q.matches || [];
    return (q.candidates || []).filter(function (f) { return !f.blocked; });
  };
})(window);
