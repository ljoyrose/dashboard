/*!
 * Which check-log rows belong on the medicines register and the dog card.
 * Medicine given, and parasite control (flea, worm, tick). A drug used for a vet procedure does not.
 * The sheet is not changed.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDMedRows = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function str(v) { return String(v == null ? '' : v).trim(); }

  /** A check type whose rows are medicines: the medicine job, or parasite control. */
  function isMedCheck(t) {
    if (!t) return false;
    var k = str(t.type_key).toLowerCase(), lab = str(t.label).toLowerCase(), both = k + ' ' + lab;
    if (k === 'medicine' || k === 'parasites' || k === 'parasite') return true;
    return /\b(parasite|flea|wormer|worming|tick)\b/.test(both);
  }

  /** A drug given for a vet procedure (anaesthetic, sedation, euthanasia), not a medicine the kennel gives. */
  function procedureDrug(product, note) {
    var s = (str(product) + ' ' + str(note)).toLowerCase();
    if (/\b(moxiclear|panacur|drontal|frontline|milprazon|prazitel|veloxa|wormer|flea|tick|nexgard|bravecto|simparica|advantage|advocate)\b/.test(s)) return false;
    return /\b(anaesth\w*|sedation|sedative|sedated|euthanas\w*|propofol|medetomidine|dexmedetomidine|butorphanol|buprenorphine|methadone|ketamine|isoflurane|sevoflurane|atipamezole|antisedan|vet procedure)\b/.test(s);
  }

  /** Same dog, same day, same product: one dose. */
  function doseKey(dog, on, product) {
    var prod = str(product).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!prod) return '';
    return str(dog) + '|' + str(on).slice(0, 10) + '|' + prod;
  }

  return { isMedCheck: isMedCheck, procedureDrug: procedureDrug, doseKey: doseKey };
}));
