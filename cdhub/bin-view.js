/*!
 * CDBin (Settings -> Bin), owner page. OV11 for Lisa, 15 Nov 2026 (answer b).
 * Lists every row that has ended: a to_date (or another end date) on or before today, or an archive flag. Nothing is
 * deleted anywhere, so the Bin is a view, not a store. Grouped by kind (the table), newest first, each row saying who
 * ended it, when, and why where the row holds a reason. Searchable.
 * Restore (Lisa 18 Nov 2026, answer A): ended rules/settings rows and ended links only. Never edits history: it adds a
 * NEW row from today, saying which Bin row it came from. Behind its own owner switch, the dated rule row
 * bin.restore.on = 1 (no row = OFF). The Bin page is the owner's, so who may restore is the owner until the Bin opens to
 * others. Codes, archived dogs and litters are not restored here (codes are the owner's; dogs/litters come later).
 * The foot links to the dashboard's Drive Bin (files, not rows).
 * Works in a browser (window.CDBin) and in Node (module.exports) so the sorting can be tested.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CDBin = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ENDS = ['to_date', 'effective_to', 'end_date', 'ended_on', 'archived_on', 'archived_at'];
  var FLAGS = ['archived', 'is_archived'];
  var STATES = { archived: 1, retired: 1, deleted: 1, binned: 1 };
  var BY = ['ended_by', 'end_by', 'archived_by', 'set_by'];
  var WHY = ['end_reason', 'reason', 'archive_reason', 'to_reason'];
  var NAMES = ['name', 'call_name', 'display_name', 'title', 'label', 'short_name', 'who', 'rule_key'];
  var S = { q: '', byKey: {} };
  var RESTORE_KEY = 'bin.restore.on';

  function t(x) { return String(x == null ? '' : x).trim(); }
  function day(x) { var s = t(x).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; }
  function first(r, keys) { for (var i = 0; i < keys.length; i++) { var v = t(r[keys[i]]); if (v) return v; } return ''; }
  function yes(v) { return /^(1|true|yes|y)$/i.test(t(v)); }
  /** 'BLD-breeding_rule.csv' -> 'Breeding rule' */
  function kindOf(f) {
    var s = String(f).replace(/^BLD-/, '').replace(/\.csv$/i, '').replace(/_/g, ' ').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : String(f);
  }
  /** Ids to names, from any table row that carries both (subjects, people, areas...). */
  function nameMap(T) {
    var m = {};
    Object.keys(T || {}).forEach(function (f) {
      (T[f] || []).forEach(function (r) { if (r && t(r.id) && !m[t(r.id)]) { var n = first(r, NAMES.slice(0, 6)); if (n) m[t(r.id)] = n; } });
    });
    return m;
  }

  /** Every ended row, as {kind, file, id, label, when, by, why}. A future end date has not ended yet. */
  function items(T, today) {
    var out = [], names = nameMap(T), iso = day(today);
    function nm(id) { id = t(id); return names[id] || id; }
    Object.keys(T || {}).sort().forEach(function (f) {
      if (!/^BLD-.*\.csv$/i.test(f) || /_MANIFEST/.test(f)) return;
      (T[f] || []).forEach(function (r) {
        if (!r) return;
        var when = '', key = '';
        for (var i = 0; i < ENDS.length && !when; i++) { var d = day(r[ENDS[i]]); if (d) { when = d; key = ENDS[i]; } }
        var flagged = FLAGS.some(function (k) { return yes(r[k]); }) || !!STATES[t(r.status).toLowerCase()];
        if (when && iso && when > iso) { if (!flagged) return; when = ''; }
        if (!when && !flagged) return;
        var label = first(r, NAMES);
        if (!label && t(r.role)) label = t(r.role).replace(/_/g, ' ') + ': ' + nm(r.from_id) + ' → ' + nm(r.to_id);
        if (!label && t(r.subject_id)) label = nm(r.subject_id);
        if (!label) label = t(r.id) || '(no id)';
        if (t(r.rule_key) && t(r.value)) label += ' = ' + t(r.value);
        out.push({ kind: kindOf(f), file: f, id: t(r.id), label: label, when: when, key: key,
          by: nm(first(r, BY)), why: first(r, WHY), row: r });
      });
    });
    return out;
  }

  /** Groups by kind; rows newest first (no date last); groups by their newest row, then name. */
  function groups(list) {
    var g = {};
    (list || []).forEach(function (x) { (g[x.kind] = g[x.kind] || []).push(x); });
    var keys = Object.keys(g);
    keys.forEach(function (k) {
      g[k].sort(function (a, b) {
        if (a.when !== b.when) { if (!a.when) return 1; if (!b.when) return -1; return a.when < b.when ? 1 : -1; }
        return a.label.localeCompare(b.label);
      });
    });
    keys.sort(function (a, b) {
      var x = g[a][0].when, y = g[b][0].when;
      if (x !== y) { if (!x) return 1; if (!y) return -1; return x < y ? 1 : -1; }
      return a.localeCompare(b);
    });
    return keys.map(function (k) { return { kind: k, rows: g[k] }; });
  }

  /** The owner switch: the latest bin.restore.on row in force on `today` (effective_from on or before, not ended). */
  function restoreOn(T, today) {
    var iso = day(today), best = null;
    ((T || {})['BLD-breeding_rule.csv'] || []).forEach(function (r) {
      if (!r || t(r.rule_key) !== RESTORE_KEY) return;
      var f = day(r.effective_from), e = day(r.to_date);
      if (!f || (iso && (f > iso || (e && e <= iso)))) return;
      if (!best || best.from <= f) best = { from: f, on: parseInt(t(r.value), 10) >= 1 };
    });
    return !!(best && best.on);
  }
  /** What Restore would save for a Bin item, or null when this kind cannot be restored here. */
  function restorePlan(x, today) {
    var r = x && x.row || {}, src = 'Restored from Bin (' + (x && x.id || '') + ')', iso = day(today);
    if (!iso || !x || !x.when) return null;   /* archive-flag rows (dogs, litters) are not restored here */
    if (x.file === 'BLD-breeding_rule.csv' && t(r.rule_key) && t(r.value) !== '')
      return { kind: 'rule', table: 'breeding_rule', fields: { rule_key: t(r.rule_key), value: t(r.value), effective_from: iso, source: src } };
    if (x.file === 'BLD-links.csv' && t(r.role) && t(r.from_id) && t(r.to_id))
      return { kind: 'link', action: 'link_add', fields: { from_table: t(r.from_table), from_id: t(r.from_id), role: t(r.role),
        to_table: t(r.to_table), to_id: t(r.to_id), from_date: iso, source: src } };
    return null;
  }
  /** A rule already in force today with the same key and value needs no restore. */
  function alreadyLive(T, x, today) {
    var r = x.row || {}, iso = day(today);
    if (x.file !== 'BLD-breeding_rule.csv') return false;
    return ((T || {})['BLD-breeding_rule.csv'] || []).some(function (o) {
      if (!o || o === r || t(o.rule_key) !== t(r.rule_key) || t(o.value) !== t(r.value)) return false;
      var f = day(o.effective_from), e = day(o.to_date);
      return f && f <= iso && !(e && e <= iso);
    });
  }

  function hay(x) { return (x.label + ' ' + x.kind + ' ' + x.by + ' ' + x.why + ' ' + x.id).toLowerCase(); }

  /** v: {T, today, esc, dmy, driveBin, canWrite(), restore(plan) -> Promise of a save message} */
  function page(v) {
    var esc = v.esc, dmy = v.dmy || function (d) { return d; };
    var gs = groups(items(v.T, v.today)), n = 0;
    var canRestore = restoreOn(v.T, v.today) && typeof v.restore === 'function';
    var canWrite = canRestore && (typeof v.canWrite !== 'function' || v.canWrite());
    S.byKey = {};
    gs.forEach(function (g) { n += g.rows.length; });
    var h = '<section class="card" id="binPage" style="margin-top:24px"><h2 class="hx4">Bin</h2>'
      + '<p class="mut">Ended and archived rows. Nothing is deleted.</p>';
    if (!n) h += '<p class="mut" id="binNone">Nothing in the Bin.</p>';
    else {
      h += '<p><label for="binQ">Find</label> <input id="binQ" type="search" autocomplete="off" value="' + esc(S.q) + '"> '
        + '<span class="mut" id="binCount" role="status">' + n + '</span></p>';
      gs.forEach(function (g) {
        h += '<div data-bin-kind="' + esc(g.kind) + '"><h3>' + esc(g.kind)
          + ' <span class="cnt" data-bin-n>' + g.rows.length + '</span></h3><ul class="bin-list">';
        g.rows.forEach(function (x) {
          var bits = [x.when ? 'Ended ' + esc(dmy(x.when)) : 'Archived'];
          if (x.by) bits.push('by ' + esc(x.by));
          if (x.why) bits.push(esc(x.why));
          var act = '';
          if (canRestore && restorePlan(x, v.today)) {
            var k = x.file + '|' + x.id; S.byKey[k] = x;
            if (alreadyLive(v.T, x, v.today)) act = '<br><span class="mut" data-bin-live>Already in force</span>';
            else if (!canWrite) act = '<br><span class="mut">To restore, set up saving first.</span>';
            else act = '<br><span data-bin-act="' + esc(k) + '"><button type="button" class="btn" data-bin-restore="' + esc(k) + '">Restore</button></span>';
          }
          h += '<li data-bin-row data-hay="' + esc(hay(x)) + '"><b>' + esc(x.label) + '</b><br><span class="mut">' + bits.join(' · ') + '</span>' + act + '</li>';
        });
        h += '</ul></div>';
      });
      h += '<p class="mut" id="binNoMatch" hidden>No match.</p>';
    }
    h += '<p class="mut" style="margin-bottom:0"><a href="' + esc(v.driveBin || '../index.html#/bin') + '" id="binDrive">Drive Bin (files)</a></p></section>';
    return h;
  }

  /** Filters in place, so the search box keeps focus while typing. */
  function filter(main, q) {
    S.q = q; q = t(q).toLowerCase();
    var shown = 0;
    Array.prototype.forEach.call(main.querySelectorAll('[data-bin-kind]'), function (g) {
      var k = 0;
      Array.prototype.forEach.call(g.querySelectorAll('[data-bin-row]'), function (li) {
        var on = !q || li.getAttribute('data-hay').indexOf(q) >= 0; li.hidden = !on; if (on) k++;
      });
      g.hidden = !k; var c = g.querySelector('[data-bin-n]'); if (c) c.textContent = k; shown += k;
    });
    var c = main.querySelector('#binCount'); if (c) c.textContent = shown;
    var none = main.querySelector('#binNoMatch'); if (none) none.hidden = shown > 0;
  }

  /** Restore asks first, in place: Restore -> "Bring back from today?" Yes / Cancel -> tick line once saved. */
  function bind(main, v) {
    var q = main.querySelector('#binQ');
    if (q) {
      q.addEventListener('input', function () { filter(main, q.value); });
      if (S.q) filter(main, S.q);
    }
    if (!v || typeof v.restore !== 'function') return;
    var esc = v.esc;
    main.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-bin-restore],[data-bin-yes],[data-bin-no]');
      if (!b || !main.contains(b)) return;
      var k = b.getAttribute('data-bin-restore') || b.getAttribute('data-bin-yes') || b.getAttribute('data-bin-no');
      var box = null;
      Array.prototype.forEach.call(main.querySelectorAll('[data-bin-act]'), function (el) { if (el.getAttribute('data-bin-act') === k) box = el; });
      var x = S.byKey[k]; if (!box || !x) return;
      if (b.hasAttribute('data-bin-restore')) {
        box.innerHTML = 'Bring back from today? <button type="button" class="btn" data-bin-yes="' + esc(k) + '">Yes, restore</button> '
          + '<button type="button" class="btn" data-bin-no="' + esc(k) + '">Cancel</button>';
        var y = box.querySelector('[data-bin-yes]'); if (y) y.focus();
      } else if (b.hasAttribute('data-bin-no')) {
        box.innerHTML = '<button type="button" class="btn" data-bin-restore="' + esc(k) + '">Restore</button>';
      } else {
        var plan = restorePlan(x, v.today); if (!plan) return;
        box.innerHTML = '<span class="mut" role="status">Saving…</span>';
        Promise.resolve().then(function () { return v.restore(plan); }).then(function (msg) {
          if (typeof v.showSave === 'function') v.showSave(box, msg); else box.textContent = msg;
          box.setAttribute('role', 'status');
        }, function (err) {
          var em = String(err && err.message || 'error'), m = (/^Not saved/.test(em) ? em : 'Not saved: ' + em) + '. Nothing changed; try again.';
          if (typeof v.showSave === 'function') v.showSave(box, m); else box.textContent = m;
        });
      }
    });
  }

  return { page: page, bind: bind, items: items, groups: groups, kindOf: kindOf, restoreOn: restoreOn, restorePlan: restorePlan, RESTORE_KEY: RESTORE_KEY };
}));
