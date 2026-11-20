/*!
 * CDBin (Settings -> Bin), owner page. OV11 for Lisa, 15 Nov 2026 (answer b).
 * Lists every row that has ended: a to_date (or another end date) on or before today, or an archive flag. Nothing is
 * deleted anywhere, so the Bin is a view, not a store. Grouped by kind (the table), newest first, each row saying who
 * ended it, when, and why where the row holds a reason. Searchable. Read only here: Restore comes later, behind its
 * own owner switch (OFF), and adds a new dated row rather than editing history.
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
  var S = { q: '' };

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
          by: nm(first(r, BY)), why: first(r, WHY) });
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

  function hay(x) { return (x.label + ' ' + x.kind + ' ' + x.by + ' ' + x.why + ' ' + x.id).toLowerCase(); }

  /** v: {T, today, esc, dmy, driveBin} */
  function page(v) {
    var esc = v.esc, dmy = v.dmy || function (d) { return d; };
    var gs = groups(items(v.T, v.today)), n = 0;
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
          h += '<li data-bin-row data-hay="' + esc(hay(x)) + '"><b>' + esc(x.label) + '</b><br><span class="mut">' + bits.join(' · ') + '</span></li>';
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

  function bind(main) {
    var q = main.querySelector('#binQ');
    if (!q) return;
    q.addEventListener('input', function () { filter(main, q.value); });
    if (S.q) filter(main, S.q);
  }

  return { page: page, bind: bind, items: items, groups: groups, kindOf: kindOf };
}));
