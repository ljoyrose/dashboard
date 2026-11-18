/* Display-only cleaning: never show source-material wording from note or description cells. */
var BLDDisplay = (function () {
  function hideSource(s) {
    s = String(s == null ? '' : s);
    s = s.replace(/\s*\((?:needs remeasure|[^)]*Cabin List[^)]*|internal capacity[^)]*|Lisa\s+\d{1,2}\s+\w+[^)]*)\)/gi, '');
    s = s.replace(/\bCabin List 2026(?:\s+internal capacity)?(?:,[^.|]*)?/gi, '');
    s = s.replace(/\bneeds remeasure\b/gi, '');
    s = s.replace(/\binternal capacity\b/gi, '');
    s = s.replace(/\bLisa\s+\d{1,2}\s+\w+(?:\s+\d{4})?\b/gi, '');
    return s.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
  }
  return { hideSource: hideSource };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { BLDDisplay: BLDDisplay };
