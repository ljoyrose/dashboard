(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDShowNote = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SYSTEM = /\b(back-?fills?|back-?filled|back-?filling|imports?|imported|importing|migrated|migration|migrating|seeded|seeding|seeds?|catch-?ups?)\b/i;
  var DATE = /\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?:\s+\d{2,4})?|\d{4}-\d{2}-\d{2})\b/ig;

  function systemOnly(p) {
    if (!SYSTEM.test(p)) return false;
    var rest = p.replace(SYSTEM, ' ').replace(DATE, ' ')
      .replace(/\b(?:by|on|from|the|a|an|and|of|to|for|via|user|user|staff|user|system|script|row|rows|records?)\b/ig, ' ')
      .replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g, ' ')
      .replace(/[^a-z0-9]+/ig, ' ').replace(/\s+/g, ' ').trim();
    return rest.length < 3;
  }

  function human(s) {
    var raw = String(s == null ? '' : s).trim();
    if (!raw) return '';
    var kept = [];
    raw.split(/\s*(?:\||;|\n|\u2014)\s*|\.\s+/).forEach(function (bit) {
      var p = bit.trim();
      if (!p) return;
      if (!SYSTEM.test(p)) { kept.push(p); return; }
      if (systemOnly(p)) return;
      var cleaned = p.replace(SYSTEM, ' ').replace(/\s{2,}/g, ' ').replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, '').trim();
      if (cleaned) kept.push(cleaned);
    });
    return kept.join('. ').replace(/\s{2,}/g, ' ').trim();
  }

  return { human: human };
}));

