/*!
 * BLDTempEvidence - keeps a photo of the thermometer with a temperature reading, ONLY while the owner switches it on.
 *
 * the owner, 16 Nov 2026: photos are not kept by default (storage and privacy). The owner can switch keeping on, for
 * example for an inspection, with ONE dated rule row in BLD-breeding_rule:
 *
 *   rule_key  job.temps_keep_photo     (the job. prefix is what staff phones are allowed to read)
 *   value     yes                      (anything else, or no row = off)
 *   effective_from / to_date           the days it is on; blank to_date = until changed. Latest effective_from wins.
 *
 * With the setting off, this file is never loaded and nothing changes: module.js still keeps no picture.
 * With it on, after a reading is saved the person is offered "Take photo" (the live camera, one still) or
 * "Choose photo" (a picture already on the phone, e.g. for an earlier reading). Skipping is always allowed: the
 * reading is saved either way. The photo goes through the save script only:
 *   file_add  (kind photo, image/jpeg)  -> stored in the private Shared Drive folder FILES_FOLDER_ID, one BLD-files row
 *   link_add  area_reading/<reading id> -> files/<file id>, role evidence
 * Nothing is written to the phone's camera roll or the page's storage. The picture is shrunk to at most 1600 px on
 * its longest side before it is sent.
 *
 * What the owner must have in place (otherwise the save script refuses and the person is told; the reading stays saved):
 *   Script Properties: FILES_FOLDER_ID, TABLE_ON_files = true, TABLE_ON_links = true
 *   Rule rows: file.types includes image/jpeg; file.who_may includes STAFF (owner always may);
 *              link_kind.evidence (the word shown, e.g. Evidence); link_kind.evidence.who_may includes STAFF;
 *              link_kind.evidence.from_tables includes area_reading (or no row = any).
 *
 * Browser: window.BLDTempEvidence.  Node (tests): module.exports.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDTempEvidence = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY = 'job.temps_keep_photo';

  function ymd(v) { var s = String(v == null ? '' : v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }

  /** Is keeping photos on for `day` (YYYY-MM-DD)? The rule row in force that day (latest effective_from) must say yes. */
  function on(rules, day) {
    var best = null;
    (rules || []).forEach(function (r) {
      if (!r || String(r.rule_key || '').trim() !== KEY) return;
      var f = ymd(r.effective_from), t = ymd(r.to_date);
      if (!f || f > day || (t && t < day)) return;
      if (!best || f >= ymd(best.effective_from)) best = r;
    });
    return !!best && String(best.value || '').trim().toLowerCase() === 'yes';
  }

  /** Any row for the setting at all (cheap check before loading this file in the page). */
  function mentioned(rules) {
    return (rules || []).some(function (r) { return r && String(r.rule_key || '').trim() === KEY; });
  }

  /* The camera, the picture and the two saves are the shared helper (cdhub/staff/lib/evidence-photo.js);
     this file keeps the Temps words, so what staff see is unchanged. */
  function helper() {
    if (typeof self !== 'undefined' && self.BLDEvidencePhoto) return self.BLDEvidencePhoto;
    return typeof require === 'function' ? require('../../lib/evidence-photo.js') : null;
  }

  /**
   * Offer to keep a photo for one saved reading.
   * o: save (BLDSave instance: act, linkAdd), readingId, day (YYYY-MM-DD), areaLabel, past (an earlier reading:
   *    no live thermometer, so only Choose photo)
   * Returns stop(): turns the camera off if it is open.
   */
  function offer(host, o) {
    var P = helper(), what = o.what || 'the reading';
    /* o.fromTable / fromIds / title / sub / fileName / source / what: the diary-page photo for job records (PR 755) */
    return P.offer(host, {
      send: P.staffSender(o.save), fromTable: o.fromTable || 'area_reading', fromIds: o.fromIds || [o.readingId], day: o.day, past: o.past,
      name: o.fileName || 'thermometer.jpg', source: o.source || ('Temperature reading' + (o.areaLabel ? ', ' + o.areaLabel : '')), cls: 'tg-evidence',
      title: o.title || 'Photo for the records',
      hint: o.sub || (o.past ? 'Add the photo this reading came from.' : 'Photograph the thermometer screen before pressing CLR.'),
      camHint: 'Fit the whole thermometer in view.',
      kept: '\u2713 Photo kept with ' + what + '.',
      notKept: function (why) { return (what === 'the reading' ? 'The reading is' : 'The record is') + ' saved, but the photo was not kept: ' + (why || 'something went wrong') + ' Try again or skip.'; }
    });
  }

  return { KEY: KEY, on: on, mentioned: mentioned, offer: offer };
}));
