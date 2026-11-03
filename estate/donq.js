// Lives in estate/ only because that folder is already copied by pages.yml (a workflow file Lisa alone changes); it is the Do page, not the Web hub.
// Do page, "Standing approvals" card (Lisa, 2 Nov 2026). Loaded only when the Do page opens, so no other page pays for it.
// Reads CHANGES/AA_CJ-DO-QUEUE-drive.csv (date, session, action, target, why blocked, status). Agents only append rows.
// "Approve ticked" never edits that file: it saves ONE request file next to it, so an agent appending at the same moment
// is never overwritten. The Master re-runs the ticked rows and marks them done. A tick approves only that row.
// The queue is found by its NAME at run time (and the request file goes into the same folder), so no Drive id lives in this public repo.
// The page (index.html) passes in what this needs.
(function (root) {
  'use strict';
  var NAME = 'AA_CJ-DO-QUEUE-drive.csv';
  var X = null, st = 'idle', rows = [], sent = {}, qFile = null;
  var Q = root.DoQ = { afterWrite: false };

  function load() {
    st = 'loading';
    return X.list({ q: "name = '" + NAME + "' and trashed = false", corpora: 'allDrives', orderBy: 'modifiedTime desc', pageSize: '2', fields: 'files(id,parents)' }).then(function (r) {
      qFile = (r.files || [])[0];
      if (!qFile || !(qFile.parents || [])[0]) throw new Error('The approvals queue file was not found.');
      return X.text(X.api + '/' + encodeURIComponent(qFile.id) + '?alt=media&supportsAllDrives=true');
    }).then(function (txt) {
      var t = X.csv(txt), head = (t[0] || []).map(function (h) { return String(h).trim().toLowerCase(); });
      if (head[0] !== 'date' || head.indexOf('status') < 0) throw new Error('The approvals queue has no header row.');
      rows = t.slice(1).map(function (c, i) {
        return { n: i + 1, date: c[0] || '', session: c[1] || '', action: c[2] || '', target: c[3] || '', why: c[4] || '', status: String(c[head.indexOf('status')] || '').trim().toLowerCase() };
      }).filter(function (r) { return r.action || r.target; });
      st = 'ok';
    }).catch(function () { st = 'failed'; }).then(X.render);
  }
  // Open = no status yet, or "open". Anything else (approved, done, rejected) is not asked again.
  function open() { return st === 'ok' ? rows.filter(function (r) { return r.status === '' || r.status === 'open'; }) : []; }
  function picked() { var bag = X.pick().dq || {}; return open().filter(function (r) { return bag[r.n] && !sent[r.n]; }); }

  Q.init = function (ctx) { X = ctx; };
  Q.open = function () { return open().length; };
  Q.reset = function () { st = 'idle'; rows = []; sent = {}; qFile = null; };
  Q.card = function () {
    if (!X) return '';
    if (st === 'idle') load();
    var o = open(), n = picked().length, esc = X.esc;
    var h = '<section class="card hublist" id="dqCard" aria-labelledby="dqTitle"><div class="cardhead"><h3 id="dqTitle">Standing approvals</h3>' +
      '<span class="cnt' + (String(o.length).length > 2 ? ' wide' : '') + '">' + (o.length || '') + '</span></div>';
    if (st === 'failed') return h + '<p class="note" data-dq-failed>The approvals queue could not be read. Refresh to try again.</p></section>';
    if (!o.length) return h + '<p class="note">' + (st === 'ok' ? 'Nothing blocked. Your standing approvals are holding.' : 'Reading the queue…') + '</p></section>';
    h += '<ol class="hrows">' + o.map(function (r) {
      var label = '<strong>' + esc(r.action) + '</strong> · ' + esc(r.target) + (r.why ? ' <span class="note">Blocked: ' + esc(r.why) + '</span>' : '') +
        ' <span class="note">' + esc(r.session) + (r.date ? ' · ' + esc(r.date) : '') + '</span>';
      return '<li class="hrow" data-dq-row="' + r.n + '">' + (sent[r.n] ? '<span class="dpill soon">Approved, sent</span> <span>' + label + '</span>' : X.tick('dq', r.n, X.busy(), label)) + '</li>';
    }).join('') + '</ol>' +
      '<p class="note">Ticking approves only that row. It never widens your standing rules.</p>' +
      '<div class="actions" data-pick-bar="dq"><button class="btn vision" type="button" data-action="dqapprove"' + (n && !X.busy() ? '' : ' disabled') + '><span>Approve ticked (' + n + ')</span></button></div>';
    return h + '</section>';
  };
  Q.approve = function () {
    var p = picked();
    if (!p.length) return;
    if (!X.write()) { Q.afterWrite = true; X.askWrite(); return; } // Google asks once; the approval then goes on by itself
    X.setBusy(true); X.render();
    var meta = { name: 'AA_CJ-DO-APPROVE-' + Date.now() + '.json', parents: [qFile.parents[0]], mimeType: 'application/json' };
    var body = { approved_by: 'Lisa (dashboard Approve ticked)', at: new Date().toISOString(), queue_file_id: qFile.id,
      rows: p.map(function (r) { return { row: r.n, date: r.date, session: r.session, action: r.action, target: r.target }; }) };
    var b = 'dq' + Date.now();
    var payload = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b + '\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(body) + '\r\n--' + b + '--';
    return X.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', { method: 'POST', headers: { Authorization: 'Bearer ' + X.token(), 'Content-Type': 'multipart/related; boundary=' + b }, body: payload })
      .then(function (res) {
        if (!res.ok) throw new Error('Google said ' + res.status);
        p.forEach(function (r) { sent[r.n] = true; delete (X.pick().dq || {})[r.n]; });
      }).catch(function (e) { X.banner('Approval not sent: ' + (e && e.message ? e.message : 'try again') + '. Nothing changed.', false, false); })
      .then(function () { X.setBusy(false); X.render(); });
  };
})(window);
