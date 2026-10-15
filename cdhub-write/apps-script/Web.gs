/**
 * Web entry points. Two deployments of this one project (see docs/SETUP.md):
 *   A) "Save" deployment  - runs as Lisa, open to anyone WITH THE URL; every save still needs a staff code.
 *   B) "Approve" deployment - runs as the person using it, only Lisa; shows the waiting list.
 */

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function errorBody_(ex) {
  if (ex && ex.code) {
    var b = { ok: false, code: ex.code, message: ex.userMessage || ex.message };
    if (ex.fields) b.fields = ex.fields;
    if (ex.duplicate_of) b.duplicate_of = ex.duplicate_of;
    return b;
  }
  Logger.log('Unexpected error: ' + (ex && ex.stack ? ex.stack : ex));
  return {
    ok: false, code: 'UNEXPECTED',
    message: 'Something went wrong. It may or may not have saved, so check the list before trying again, and tell Lisa.'
  };
}

/** POST = a save request (JSON body, sent as text/plain so the browser needs no pre-flight). */
function doPost(e) {
  try {
    var body = (e && e.postData && e.postData.contents) || '';
    if (body.length > BLD.LIMITS.MAX_BODY_CHARS) throw err_('BAD_REQUEST', 'That request was too large.');
    var req;
    try { req = JSON.parse(body); } catch (x) { throw err_('BAD_REQUEST', 'That request was not understood.'); }
    return jsonOut_({ ok: true, result: sinkHandle_(req) });
  } catch (ex) {
    return jsonOut_(errorBody_(ex));
  }
}

/** GET = status check (no data) or the owner's approval page. */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.page === 'approve') return approvePage_();
  var tables = Object.keys(TABLES).map(function (k) {
    return { key: k, file: TABLES[k].file, on: tableOn_(TABLES[k]), mode: modeFor_(TABLES[k]) };
  });
  return jsonOut_({ ok: true, version: BLD.VERSION, saveEnabled: saveEnabled_(), tables: tables });
}

function approvePage_() {
  if (!isAdminSession_()) {
    return HtmlService.createHtmlOutput('<p style="font:16px sans-serif;padding:24px">This page is for the kennel owner. ' +
      'Open it while signed in to the owner\'s Google account.</p>');
  }
  return HtmlService.createHtmlOutputFromFile('ApprovePage').setTitle('Waiting to approve');
}

function requireAdmin_() {
  if (!isAdminSession_()) throw err_('NOT_OWNER', 'Only the kennel owner can do this.');
}

/** Called from the approval page (google.script.run). */
function ui_pending() {
  try { requireAdmin_(); return { ok: true, items: sinkPendingList_() }; }
  catch (ex) { return errorBody_(ex); }
}

/** Called from the approval page. decision = 'approve' | 'reject'. */
function ui_decide(pendingId, decision, note) {
  try {
    requireAdmin_();
    return { ok: true, result: sinkDecide_(String(pendingId), String(decision), note, adminEmail_()) };
  } catch (ex) { return errorBody_(ex); }
}
