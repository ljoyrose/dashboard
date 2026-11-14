/*!
 * Photos and files for one record (Lisa 13 Nov 2026): one MAIN image plus a GALLERY that grows over the years.
 * Files live in BLD-files (one row per stored file or link, never edited). What a file belongs to is a row in the one
 * link table BLD-links (decision C): from_table/from_id -> to_table 'files'/to_id, link_kind_key 'gallery' or 'main',
 * from_date/to_date (blank = open, inclusive). Ending fills to_date; nothing is deleted. Words come from BLD-link_kinds
 * rows (label), never fixed here. When two main links cover one day, the later set_on (then created_at) wins.
 */
var BLDPhotos = (function () {
  'use strict';
  function ymd(v) { var s = String(v == null ? '' : v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  function on(r, day) { var f = ymd(r.from_date), t = ymd(r.to_date); return (!f || f <= day) && (!t || day <= t); }
  function stamp(r) { return String(r.set_on || r.created_at || ''); }
  /** The label of a link kind in force on a day, from BLD-link_kinds rows; '' when there is none. */
  function label(kinds, key, day) {
    var best = null;
    (kinds || []).forEach(function (k) {
      if (String(k.kind_key || '') !== key || !String(k.label || '').trim() || !on(k, day)) return;
      if (!best || ymd(k.from_date) >= ymd(best.from_date)) best = k;
    });
    return best ? String(best.label).trim() : '';
  }
  /**
   * One record's photos on a day: {main, gallery, ended, galleryLabel, mainLabel}.
   * main: the file row of the main link in force (or null). gallery: file rows of open gallery links, by sort
   * (numbered first), then newest first. ended: file rows whose gallery link has ended (newest end first).
   * Each file row returned carries link_id. Links to a file id with no files row are left out.
   */
  function forRecord(links, files, kinds, fromTable, id, day) {
    var byId = {};
    (files || []).forEach(function (f) { if (f && f.id) byId[f.id] = f; });
    function withLink(f, l) { var o = {}; Object.keys(f).forEach(function (k) { o[k] = f[k]; }); o.link_id = l.id || ''; o.link_to_date = ymd(l.to_date); return o; }
    var mine = (links || []).filter(function (l) {
      return l && l.from_table === fromTable && l.from_id === id && l.to_table === 'files' && byId[l.to_id];
    });
    var main = null, gal = [], ended = [];
    mine.forEach(function (l) {
      var key = String(l.link_kind_key || '');
      if (key === 'main') { if (on(l, day) && (!main || stamp(l) > stamp(main))) main = l; return; }
      if (key !== 'gallery') return;
      if (on(l, day)) gal.push(l);
      else if (ymd(l.to_date) && ymd(l.to_date) < day) ended.push(l);
    });
    gal.sort(function (a, b) {
      var sa = String(a.sort || '').trim(), sb = String(b.sort || '').trim();
      if (sa && sb && +sa !== +sb) return +sa - +sb;
      if (sa && !sb) return -1;
      if (sb && !sa) return 1;
      return stamp(b) < stamp(a) ? -1 : stamp(b) > stamp(a) ? 1 : 0;
    });
    ended.sort(function (a, b) { return ymd(b.to_date) < ymd(a.to_date) ? -1 : ymd(b.to_date) > ymd(a.to_date) ? 1 : 0; });
    return {
      main: main ? withLink(byId[main.to_id], main) : null,
      gallery: gal.map(function (l) { return withLink(byId[l.to_id], l); }),
      ended: ended.map(function (l) { return withLink(byId[l.to_id], l); }),
      galleryLabel: label(kinds, 'gallery', day),
      mainLabel: label(kinds, 'main', day)
    };
  }
  /** A safe web address for a link file: http(s) only, else ''. */
  function safeUrl(u) { u = String(u || '').trim(); return /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; }
  return { forRecord: forRecord, label: label, safeUrl: safeUrl };
}());
if (typeof module !== 'undefined') module.exports = BLDPhotos;
