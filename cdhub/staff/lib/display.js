var BLDDisplay = (function () {
  function hideSource(s) {
    s = String(s == null ? '' : s);
    s = s.replace(/\s*\((?:needs remeasure|[^)]*Cabin List[^)]*|internal capacity[^)]*|User\s+\d{1,2}\s+\w+[^)]*)\)/gi, '');
    s = s.replace(/\bCabin List 2026(?:\s+internal capacity)?(?:,[^.|]*)?/gi, '');
    s = s.replace(/\bneeds remeasure\b/gi, '');
    s = s.replace(/\binternal capacity\b/gi, '');
    s = s.replace(/\bUser\s+\d{1,2}\s+\w+(?:\s+\d{4})?\b/gi, '');
    return s.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
  }
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

