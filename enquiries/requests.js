// Puppy Enquiries Hub: the page's request files (JOB 13 Stage 5). The Studio pattern: a tap drops ONE small JSON file
// into the private enquiries requests folder (id in config.js); the engine picks it up and writes the row. Until the ids
// exist the page is in example mode and sends nothing. PUBLIC repo: no ids or data in this file.
(function (root) {
  'use strict';
  var Core = root.EnquiriesCore || (typeof require === 'function' ? require('./core.js') : null);
  var UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name';

  // send({ folderId, token, fetch, live }, built) -> Promise<{ queued, example, id }>. built = Core.addRequest(...).
  function send(o, built) {
    o = o || {};
    if (!built || !built.ok) return Promise.reject(new Error((built && built.error) || 'Nothing to send.'));
    if (!o.folderId || !o.token) return Promise.resolve({ queued: false, example: true });
    var f = o.fetch || (root.DashKit && root.DashKit.googleFetch) || root.fetch;
    var meta = { name: built.name, parents: [o.folderId], mimeType: 'application/json' };
    var b = 'enq' + Date.now();
    var payload = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b
      + '\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(built.body) + '\r\n--' + b + '--';
    return f(UPLOAD, { method: 'POST', headers: { Authorization: 'Bearer ' + o.token, 'Content-Type': 'multipart/related; boundary=' + b }, body: payload })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status === 403 ? 'this Google account cannot write to the enquiries requests folder.' : 'Google said ' + r.status);
        return r.json();
      }).then(function (j) { return { queued: true, example: false, id: j.id }; });
  }

  // The "Add by hand" box: check, build and send one request. Returns the same promise as send().
  function addByHand(o, form) { return send(o, Core.addRequest(form)); }

  // The one-tap "call held" after a WhatsApp call (Stage 9). The engine moves the stage and makes the after-call draft.
  function callHeld(o, enquiryKey, note) { return send(o, Core.callHeldRequest(enquiryKey, null, note)); }

  // Lisa's "deposit paid" tap (Stage 11). Never carries an amount; depositKey confirms a suggested Xero row.
  function depositPaid(o, enquiryKey, depositKey) { return send(o, Core.depositPaidRequest(enquiryKey, depositKey)); }

  // Follow-up taps (Stage 12): Lisa replied herself; snooze to a UK time; done (sent), or done and lost.
  function replied(o, enquiryKey) { return send(o, Core.repliedRequest(enquiryKey)); }
  function snooze(o, followupKey, untilUk) { return send(o, Core.snoozeRequest(followupKey, untilUk)); }
  function done(o, followupKey, lost) { return send(o, Core.doneRequest(followupKey, lost)); }

  var api = { send: send, addByHand: addByHand, callHeld: callHeld, depositPaid: depositPaid, replied: replied, snooze: snooze, done: done, UPLOAD: UPLOAD };
  root.EnquiriesRequests = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
