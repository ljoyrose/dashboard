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
  /**
   * Marble / merle pups: a long colour name is cut off on the card and sorts in the middle of the list.
   * A short z- name (z-b-merle) sorts last and fits in full. Already short names stay. Not a marble pup: ''.
   */
  function marblePupName(name, colour) {
    var n = String(name == null ? '' : name).trim();
    var blob = (n + ' ' + String(colour == null ? '' : colour)).toLowerCase();
    if (!/\b(merle|marble)\b/.test(blob)) return '';
    if (/^z-[a-z]-merle(?:-\d+)?$/i.test(n)) return n.toLowerCase();
    var hit = blob.match(/\b([a-z])[a-z]*\s+merle\b/);
    var letter = hit ? hit[1] : ((n.toLowerCase().match(/\b([a-z])/) || [])[1] || 'x');
    var num = (n.match(/\b(\d+)\b/) || [])[1];
    return 'z-' + letter + '-merle' + (num ? '-' + num : '');
  }
  return { hideSource: hideSource, marblePupName: marblePupName };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = { BLDDisplay: BLDDisplay };
