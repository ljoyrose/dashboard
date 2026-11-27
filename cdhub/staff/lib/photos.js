/*!
 * Photos and files for one record (the owner 13 Nov 2026): one MAIN image plus a GALLERY that grows over the years.
 * Files live in BLD-files (one row per stored file or link, never edited). What a file belongs to is a row in the one
 * link table BLD-links (decision C): from_table/from_id -> to_table 'files'/to_id, role 'gallery' or 'main',
 * from_date/to_date (blank = open, inclusive). Ending fills to_date; nothing is deleted. Words come from owner rule rows
 * link_kind.<role> in BLD-breeding_rule (value = the word), never fixed here. When two main links cover one day, the later set_on (then created_at) wins.
 */
var BLDPhotos = (function () {
  'use strict';
  function ymd(v) { var s = String(v == null ? '' : v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  /** Dog photo links are stored as subject or subjects. Either name is the same dog list. */
  function sameTable(a, b) {
    a = String(a || ''); b = String(b || '');
    if (a === b) return true;
    return (a === 'subject' || a === 'subjects') && (b === 'subject' || b === 'subjects');
  }
  function on(r, day) { var f = ymd(r.from_date), t = ymd(r.to_date); return (!f || f <= day) && (!t || day <= t); }
  function stamp(r) { return String(r.set_on || r.created_at || ''); }
  /** The word for a link role in force on a day, from rule rows link_kind.<role> (latest effective_from wins); '' when none. */
  function label(rules, role, day) {
    var best = null;
    (rules || []).forEach(function (r) {
      var f = ymd(r.effective_from), t = ymd(r.to_date);
      if (String(r.rule_key || '') !== 'link_kind.' + role || !String(r.value || '').trim() || (f && f > day) || (t && t < day)) return;
      if (!best || f >= ymd(best.effective_from)) best = r;
    });
    return best ? String(best.value).trim() : '';
  }
  /**
   * One record's photos on a day: {main, gallery, ended, galleryLabel, mainLabel}.
   * main: the file row of the main link in force (or null). gallery: file rows of open gallery links, by sort
   * (numbered first), then newest first. ended: file rows whose gallery link has ended (newest end first).
   * Each file row returned carries link_id. Links to a file id with no files row are left out.
   */
  function forRecord(links, files, rules, fromTable, id, day) {
    var byId = {};
    (files || []).forEach(function (f) { if (f && f.id) byId[f.id] = f; });
    function withLink(f, l) {
      var o = {}; Object.keys(f).forEach(function (k) { o[k] = f[k]; });
      o.link_id = l.id || ''; o.link_to_date = ymd(l.to_date); o.link_end_reason = String(l.end_reason || '').trim();
      return o;
    }
    function closedNow(l, day) {
      var t = ymd(l.to_date), why = String(l.end_reason || '').trim();
      if (t && t < day) return true;
      return !!(why && t && t <= day);
    }
    var mine = (links || []).filter(function (l) {
      return l && sameTable(l.from_table, fromTable) && l.from_id === id && l.to_table === 'files' && byId[l.to_id];
    });
    var main = null, gal = [], ended = [];
    mine.forEach(function (l) {
      var key = String(l.role || '');
      if (key === 'main') { if (on(l, day) && !closedNow(l, day) && (!main || stamp(l) > stamp(main))) main = l; return; }
      if (key !== 'gallery') return;
      // Removed from the gallery today (the owner 16 Nov 2026): a link added today can only end today, so an end reason marks it
      // ended at once instead of at midnight.
      var removedToday = ymd(l.to_date) === day && String(l.end_reason || '').trim() !== '';
      if (on(l, day) && !closedNow(l, day)) gal.push(l);
      else if (ymd(l.to_date) && (ymd(l.to_date) < day || removedToday)) ended.push(l);
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
      gallery: gal.map(function (l) { return withLink(byId[l.to_id], l); }).filter(function (f) {
        return f.kind !== 'photo' || !!fileDrive(f);
      }),
      ended: ended.map(function (l) { return withLink(byId[l.to_id], l); }),
      galleryLabel: label(rules, 'gallery', day),
      mainLabel: label(rules, 'main', day)
    };
  }
  function fileDrive(f) {
    var v = String(f && typeof f === 'object' ? (f.drive_file_id || '') : (f || '')).trim();
    var m = /\/file\/d\/([A-Za-z0-9_-]+)/.exec(v) || /[?&]id=([A-Za-z0-9_-]+)/.exec(v);
    if (m) return m[1];
    if (/^https?:/i.test(v)) return '';
    return /^[A-Za-z0-9_-]{8,}$/.test(v) ? v : '';
  }
  function sameFile(a, b) {
    if (!a || !b) return false;
    if (a.id && b.id && a.id === b.id) return true;
    var da = fileDrive(a), db = fileDrive(b);
    return !!(da && da === db);
  }
  function removedFromGallery(rec, f) {
    var ended = (rec.ended || []).some(function (x) { return sameFile(x, f); });
    var open = (rec.gallery || []).some(function (x) { return sameFile(x, f); });
    return ended && !open;
  }
  function shownPhoto(rec, cell) {
    rec = rec || {};
    var m = rec.main;
    if (m && fileDrive(m) && !removedFromGallery(rec, m)) return fileDrive(m);
    if (m && removedFromGallery(rec, m)) {
      var g = (rec.gallery || []).filter(function (f) { return fileDrive(f) && !removedFromGallery(rec, f); })[0];
      return g ? fileDrive(g) : '';
    }
    var c = fileDrive(cell);
    if (!c) return '';
    if (removedFromGallery(rec, { drive_file_id: c })) return '';
    return c;
  }
  /** A safe web address for a link file: http(s) only, else ''. */
  function safeUrl(u) { u = String(u || '').trim(); return /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u : ''; }
  /* Photo turn (15 Nov 2026): the stored picture is never changed. Turning a photo is an owner setting row in the one
     rule list, photo.rotate.<files row id> = 0, 90, 180 or 270 (degrees clockwise), dated like every other rule; the row in
     force on the day wins. Every place that draws the photo (cards, lists, Breed Better, print) reads the same turn. */
  var TURNS = { '0': 0, '90': 90, '180': 180, '270': 270 };
  function driveId(v) {
    v = String(v == null ? '' : v).trim();
    var m = /\/file\/d\/([A-Za-z0-9_-]+)/.exec(v) || /[?&]id=([A-Za-z0-9_-]+)/.exec(v);
    return m ? m[1] : (!/^https?:/i.test(v) && /^[A-Za-z0-9_-]{8,}$/.test(v) ? v : '');
  }
  function rotateKey(fileId) { return 'photo.rotate.' + String(fileId == null ? '' : fileId).trim().toLowerCase(); }
  /** The turn in force on a day for a photo, given its files row id or its Drive file id: 0, 90, 180 or 270. */
  function rotation(files, rules, photo, day) {
    var p = String(photo == null ? '' : photo).trim(), keys = {};
    if (!p) return 0;
    var did = driveId(p);
    (files || []).forEach(function (f) {
      if (f && f.id && (f.id === p || (did && driveId(f.drive_file_id) === did))) keys[rotateKey(f.id)] = 1;
    });
    var best = null;
    (rules || []).forEach(function (r) {
      var f = ymd(r.effective_from), t = ymd(r.to_date);
      if (!keys[String(r.rule_key || '')] || !(String(r.value).trim() in TURNS) || (f && f > day) || (t && t < day)) return;
      if (!best || f > ymd(best.effective_from) || (f === ymd(best.effective_from) && String(r.set_at || '') >= String(best.set_at || ''))) best = r;
    });
    return best ? TURNS[String(best.value).trim()] : 0;
  }
  /** The next turn after one step left (-1) or right (+1). */
  function turned(deg, step) { return (((Number(deg) || 0) + (step < 0 ? 270 : 90)) % 360); }
  /** Inline style that shows a picture turned and still filling a w x h box (the box must be position:relative). */
  function turnStyle(deg, w, h) {
    deg = TURNS[String(deg)] || 0;
    if (!deg) return '';
    if (deg === 180) return 'transform:rotate(180deg)';
    return 'position:absolute;top:50%;left:50%;width:' + h + 'px;height:' + w + 'px;max-width:none;transform:translate(-50%,-50%) rotate(' + deg + 'deg)';
  }
  return { forRecord: forRecord, label: label, safeUrl: safeUrl, shownPhoto: shownPhoto, fileDrive: fileDrive, rotation: rotation, rotateKey: rotateKey, turned: turned, turnStyle: turnStyle };
}());
if (typeof module !== 'undefined') module.exports = BLDPhotos;
