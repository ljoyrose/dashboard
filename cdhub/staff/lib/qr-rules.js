/*!
 * BLDQrRules - which items get a QR code, and the tag an item already has. Pure functions, no network. Shared by the print
 * page and the back-fill tool (cdhub-write/tools/backfill-qr-tags.js); the save script has the same rule in QrTag.gs and a
 * test checks both agree.
 *
 * Owner rule rows in BLD-breeding_rule (the owner 15 Nov 2026), dated like every rule, newest in force wins:
 *   qr.on_add.<kind>            yes / no   kind = subject, area, litter, site, thermometer or item
 *   qr.on_add.item.<kind_key>   yes / no   one item type; beats qr.on_add.item
 * No row = no code.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDQrRules = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var KINDS = ['area', 'subject', 'litter', 'site', 'thermometer', 'item'];
  var ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', LEN = 8;

  function ruleOn(rules, kind, sub, day, tenant) {
    var keys = sub ? ['qr.on_add.' + kind + '.' + sub, 'qr.on_add.' + kind] : ['qr.on_add.' + kind];
    for (var i = 0; i < keys.length; i++) {
      var hit = null, from = '';
      (rules || []).forEach(function (r) {
        if (String(r.rule_key || '').trim() !== keys[i]) return;
        if (tenant && r.tenant_id && r.tenant_id !== tenant) return;
        var f = String(r.effective_from || '').slice(0, 10), t = String(r.to_date || '').slice(0, 10);
        if ((f && day && f > day) || (t && day && t < day)) return;
        if (hit === null || f >= from) { hit = String(r.value || '').trim().toLowerCase(); from = f; }
      });
      if (hit !== null) return hit === 'yes' || hit === 'true';
    }
    return false;
  }

  function tagFor(tags, kind, refId) {
    return (tags || []).filter(function (t) { return t.kind === kind && t.ref_id === refId && String(t.active).toLowerCase() !== 'false'; })[0];
  }

  function newTag(taken, bytes) {
    taken = taken || {};
    var tag;
    do {
      var a = bytes(LEN); tag = '';
      for (var i = 0; i < LEN; i++) tag += ALPHABET.charAt(a[i] % ALPHABET.length);
    } while (taken[tag]);
    return tag;
  }

  return { KINDS: KINDS, ruleOn: ruleOn, tagFor: tagFor, newTag: newTag };
}));

