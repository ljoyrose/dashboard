/**
 * Web entry points. Two deployments of this one project (see docs/SETUP.md):
 *   A) "Save" deployment  - runs as Lisa, open to anyone WITH THE URL; every save still needs a staff code.
 *   B) "Approve" deployment - runs as the person using it, only Lisa; shows the approvals queue.
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

/** POST = a save request or a read request (JSON body, sent as text/plain so the browser needs no pre-flight). */
function doPost(e) {
  try {
    var body = (e && e.postData && e.postData.contents) || '';
    if (body.length > BLD.LIMITS.MAX_BODY_CHARS) throw err_('BAD_REQUEST', 'That request was too large.');
    var req;
    try { req = JSON.parse(body); } catch (x) { throw err_('BAD_REQUEST', 'That request was not understood.'); }
    if (req && typeof req === 'object' && req.action === 'read') return jsonOut_({ ok: true, result: sinkRead_(req) });
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
  return jsonOut_({ ok: true, version: BLD.VERSION, saveEnabled: saveEnabled_(), readEnabled: readEnabled_(), tables: tables, proposed: Object.keys(PROPOSED_TABLES) });
}

function approvePage_() {
  if (!isAdminSession_()) {
    return HtmlService.createHtmlOutput('<p style="font:16px sans-serif;padding:24px">This page is for the kennel owner. ' +
      'Open it while signed in to the owner\'s Google account.</p>');
  }
  return HtmlService.createHtmlOutputFromFile('ApprovePage').setTitle('Approvals queue');
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

/** Called from the approval page. Owner-only: lists the newest entries of one table so one can be picked. */
function ui_editList(table) {
  try { requireAdmin_(); return { ok: true, result: sinkOwnerEditList_(String(table)) }; }
  catch (ex) { return errorBody_(ex); }
}

/**
 * Called from the approval page. Owner-only (a signed-in Google account in ADMIN_EMAILS, never a staff code).
 * Overwrites the entry in place. No record of the old value is kept by this script.
 */
function ui_edit(table, rowId, fields) {
  try {
    requireAdmin_();
    return { ok: true, result: sinkOwnerEdit_(String(table), String(rowId), fields, adminEmail_()) };
  } catch (ex) { return errorBody_(ex); }
}
