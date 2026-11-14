/*!
 * CDItems (More -> Items), owner page. ITEMS, 14 Nov 2026 (decision 13 Nov option A).
 * The owner's numbered list of things that get tested (plug-in appliances, fire extinguishers, smoke alarms,
 * thermometers...): add, move room, archive (dead or failed), record a test with readings and evidence, and export
 * a report (CSV, or a print page saved as PDF). Nothing here names a kind, a test, a limit or an interval: kinds are
 * BLD-item_kinds rows, tests are BLD-check_type rows (target item, item_kind), measured values are BLD-readings rows
 * (kind from BLD-reading_kinds, linked to the test by a links row reading_for_job; judged by the BLD-reading_limits row in
 * force on the day: TEMPS, OV11 14 Nov), other answers are BLD-check_field / BLD-check_value rows, the room is a shared
 * BLD-links row (role placed_in, set by rule rows link_kind.<role>; STAFF owns links and its link_add / link_end saves), proof photos and
 * certificates are BLD-files rows joined by links (evidence, certificate, main; DOGCARD's file_add), in use / archived is
 * a BLD-requirement row (need_type item.in_use), "due soon" is the rule row items.due_soon_days. Status is worked out on
 * read, never stored.
 * Works in a browser (window.CDItems) and in Node (module.exports) so the maths can be tested.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CDItems = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FILES = ['BLD-items.csv', 'BLD-item_kinds.csv', 'BLD-links.csv', 'BLD-check_field.csv', 'BLD-check_value.csv',
    'BLD-readings.csv', 'BLD-reading_kinds.csv', 'BLD-reading_limits.csv', 'BLD-files.csv'];
  var NEED = 'item.in_use', PLACE = 'placed_in', LINKS = 'BLD-links.csv';
  var PLACES = [PLACE, 'item_placed_in'];   // one of the two survives when STAFF and TEMPS settle the kind row
  // order best to worst (Lisa 9 Nov): filters and sorts run All, In date ... Overdue, Archived last
  var RANK = { ok: 0, none: 1, soon: 2, due: 3, fail: 4, expired: 5 };
  var WORD = { ok: 'In date', none: 'No test set', soon: 'Due soon', due: 'Overdue', fail: 'Failed', expired: 'Expired' };
  var PILL = { ok: 'ok', none: '', soon: 'w', due: 'no', fail: 'no', expired: 'no' };
  var S = { filter: 'all', q: '', open: '', form: '', msg: '', busy: false, ticks: {}, retry: {} };

  function rows(T, f) { return (T && T[f]) || []; }
  function t(x) { return String(x == null ? '' : x).trim(); }
  function addDays(ymd, n) {
    var p = String(ymd).split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
  }
  function day(x) { return t(x).slice(0, 10); }

  /** Items as the owner sees them now: one per first row id, showing its latest change. */
  function current(T) {
    var first = {}, out = [];
    rows(T, 'BLD-items.csv').forEach(function (r) {
      var key = t(r.corrects_id) || r.id;
      var have = first[key];
      if (!have) { first[key] = { id: key, row: r, firstAt: r.created_at || '' }; out.push(first[key]); return; }
      if (t(r.corrects_id) && t(r.created_at) >= t(have.row.created_at)) have.row = r;
      if (!t(r.corrects_id)) { have.firstAt = r.created_at || have.firstAt; if (!t(have.row.corrects_id)) have.row = r; }
    });
    return out.map(function (x) { return Object.assign({}, x.row, { id: x.id, first_at: x.firstAt }); });
  }

  /** In use on a day: no item.in_use rows = always (S4.15); else a row must cover the day. */
  function inUse(T, id, on) {
    var rs = rows(T, 'BLD-requirement.csv').filter(function (r) { return r.need_type === NEED && (r.target_table === 'items' || r.target_table === 'item') && r.target_id === id; });
    if (!rs.length) return { yes: true, row: null };
    var cover = rs.filter(function (r) { return t(r.from_date) <= on && (!t(r.to_date) || t(r.to_date) >= on); })[0];
    if (cover) return { yes: true, row: cover };
    var last = rs.slice().sort(function (a, b) { return t(b.to_date).localeCompare(t(a.to_date)); })[0];
    return { yes: false, row: last };
  }

  /* Shared links (STAFF, PR 563): from_table/from_id -> to_table/to_id, role, from_date/to_date. Table words are
     compared without a plural s, so check_log and check_logs are the same table until the rename sitting. */
  function tbl(x) { return t(x).replace(/s$/, ''); }
  function lk(l) { return t(l.role); }
  function live(l, on) { return t(l.from_date) <= on && (!t(l.to_date) || t(l.to_date) >= on); }
  function linksFrom(T, fromTable, fromId, kinds, on) {
    return rows(T, LINKS).filter(function (l) {
      return tbl(l.from_table) === tbl(fromTable) && l.from_id === fromId && kinds.indexOf(lk(l)) >= 0 && (!on || live(l, on));
    }).sort(function (a, b) { return (+a.sort || 0) - (+b.sort || 0) || t(a.from_date).localeCompare(t(b.from_date)); });
  }
  /** The room on a day: the latest placed_in link starting on or before it; a to_date ends it. */
  function placeOn(T, id, on) {
    var r = linksFrom(T, 'items', id, PLACES).filter(function (l) { return t(l.from_date) <= on; })
      .sort(function (a, b) { return t(b.from_date).localeCompare(t(a.from_date)); })[0];
    return r && live(r, on) ? r : null;
  }
  /** Files joined to a record by the given link kinds (newest last), as {href, label}. */
  function filesFor(T, fromTable, fromId, kinds) {
    var byId = {};
    rows(T, 'BLD-files.csv').forEach(function (f) { byId[f.id] = f; });
    return linksFrom(T, fromTable, fromId, kinds).filter(function (l) { return tbl(l.to_table) === 'file' && byId[l.to_id] && !t(l.to_date); })
      .map(function (l) { var f = byId[l.to_id]; return { href: fileHref(f.drive_file_id || f.url), label: lk(l) === 'certificate' ? 'Certificate' : f.mime === 'application/pdf' ? 'PDF' : 'Photo' }; });
  }

  /** Test rows in force on a day for an item kind: latest effective_from per type_key, active, target item. */
  function testsFor(T, kindKey, on) {
    var latest = {};
    rows(T, 'BLD-check_type.csv').forEach(function (r) {
      if (!t(r.effective_from) || r.effective_from > on) return;
      if (!latest[r.type_key] || r.effective_from > latest[r.type_key].effective_from) latest[r.type_key] = r;
    });
    return Object.keys(latest).map(function (k) { return latest[k]; }).filter(function (r) {
      return r.target === 'item' && r.active !== 'false' && (!t(r.item_kind) || r.item_kind === kindKey);
    }).sort(function (a, b) { return t(a.label).localeCompare(t(b.label)); });
  }
  /** The version of a test (by type_key) in force on a day. */
  function typeOn(T, key, on) {
    var best = null;
    rows(T, 'BLD-check_type.csv').forEach(function (r) { if (r.type_key === key && t(r.effective_from) && r.effective_from <= on && (!best || r.effective_from > best.effective_from)) best = r; });
    return best;
  }
  /** Questions (readings) of a test in force on a day, in order. */
  function fieldsOn(T, key, on) {
    var now = {};
    rows(T, 'BLD-check_field.csv').forEach(function (r) {
      if (r.type_key !== key || !t(r.effective_from) || r.effective_from > on) return;
      if (!now[r.field_key] || r.effective_from > now[r.field_key].effective_from) now[r.field_key] = r;
    });
    return Object.keys(now).map(function (k) { return now[k]; }).filter(function (r) { return r.active !== 'false'; })
      .sort(function (a, b) { return (+a.sort || 0) - (+b.sort || 0) || t(a.label).localeCompare(t(b.label)); });
  }
  /** Reading kinds a test measures: reading_kinds rows linked to it (reading_for_job, to the type_key or any of its row ids). */
  function readingKindsFor(T, key, on) {
    var ids = {}, kinds = {};
    rows(T, 'BLD-check_type.csv').forEach(function (r) { if (r.type_key === key) ids[r.id] = 1; });
    ids[key] = 1;
    rows(T, 'BLD-reading_kinds.csv').forEach(function (k) { kinds[k.id] = k; });
    return rows(T, LINKS).filter(function (l) {
      return tbl(l.from_table) === 'reading_kind' && lk(l) === 'reading_for_job' && tbl(l.to_table) === 'check_type' && ids[l.to_id] && live(l, on) && kinds[l.from_id];
    }).sort(function (a, b) { return (+a.sort || 0) - (+b.sort || 0); }).map(function (l) { return kinds[l.from_id]; });
  }
  /** The reading_limits row in force on a day for a kind: the item's own row beats its kind's, which beats an unscoped one. */
  function limitOn(T, kindId, it, on) {
    var best = null, bestRank = -1;
    rows(T, 'BLD-reading_limits.csv').forEach(function (r) {
      if (r.kind_id !== kindId || !t(r.from_date) || r.from_date > on || (t(r.to_date) && r.to_date < on)) return;
      var st = tbl(r.scope_table), rank = !st ? 0 : st === 'item_kind' && it && (r.scope_id === it.kind_key) ? 1 : st === 'item' && it && r.scope_id === it.id ? 2 : -1;
      if (rank < 0) return;
      if (rank > bestRank || (rank === bestRank && r.from_date > best.from_date)) { best = r; bestRank = rank; }
    });
    return best;
  }
  /** Is a number inside a limit row (low / high, either blank)? null = no limit or not a number. */
  function inLimit(f, v) {
    f = f || {};
    var n = parseFloat(v), lo = t(f.low), hi = t(f.high);
    if (isNaN(n) || (lo === '' && hi === '')) return null;
    return (lo === '' || n >= parseFloat(lo)) && (hi === '' || n <= parseFloat(hi));
  }

  /** Records for one item, newest first; a corrected record gives way to its correction. Each record's values are its
      check_value answers and its readings rows, as {key, label, value, unit, inr} (inr false = outside the limit). */
  function records(T, id, kindKey) {
    var byType = {}, replaced = {}, vals = {}, rds = {}, rkind = {}, it = { id: id, kind_key: kindKey || '' };
    rows(T, 'BLD-check_type.csv').forEach(function (r) { byType[r.id] = r; });
    rows(T, 'BLD-check_log.csv').forEach(function (l) { if (l.corrects_id) replaced[l.corrects_id] = true; });
    rows(T, 'BLD-check_value.csv').forEach(function (v) { (vals[v.check_log_id] = vals[v.check_log_id] || []).push(v); });
    rows(T, 'BLD-reading_kinds.csv').forEach(function (k) { rkind[k.id] = k; });
    var rrep = {}; rows(T, 'BLD-readings.csv').forEach(function (r) { if (r.corrects_id) rrep[r.corrects_id] = true; });
    rows(T, 'BLD-readings.csv').forEach(function (r) { if (t(r.check_log_id) && !rrep[r.id]) (rds[r.check_log_id] = rds[r.check_log_id] || []).push(r); });
    return rows(T, 'BLD-check_log.csv').filter(function (l) { return l.item_id === id && !replaced[l.id] && byType[l.check_type_id]; })
      .map(function (l) {
        var ty = byType[l.check_type_id], on = day(l.happened_at || l.taken_at), fs = {};
        fieldsOn(T, ty.type_key, on).forEach(function (f) { fs[f.field_key] = f; });
        var values = (vals[l.id] || []).map(function (v) { return { key: v.field_key, label: (fs[v.field_key] || {}).label || v.field_key, value: v.value, unit: '', inr: null }; })
          .concat((rds[l.id] || []).map(function (r) {
            var k = rkind[r.kind_id] || {}, inr = r.in_range === 'false' ? false : r.in_range === 'true' ? true : inLimit(limitOn(T, r.kind_id, it, on), r.value);
            return { key: k.kind_key || r.kind_id, label: k.label || k.kind_key || 'Reading', value: r.value, unit: r.unit_id || k.unit_id || '', inr: inr };
          }));
        var files = filesFor(T, 'check_logs', l.id, ['evidence', 'certificate']);
        if (t(l.photo)) files.unshift({ href: fileHref(l.photo), label: 'Evidence' });
        return { id: l.id, on: on, type: ty, outcome: l.outcome, note: l.note || '', by: l.taken_by || '', files: files, values: values };
      })
      .sort(function (a, b) { return b.on.localeCompare(a.on); });
  }

  function dueSoonDays(T, on) {
    var best = null;
    rows(T, 'BLD-breeding_rule.csv').forEach(function (r) {
      var k = r.rule_key || r.key || r.rule || '';
      if (k !== 'items.due_soon_days') return;
      var f = t(r.effective_from || r.from_date);
      if (f && f > on) return;
      if (t(r.to_date) && t(r.to_date) < on) return;
      if (!best || f > t(best.effective_from || best.from_date)) best = r;
    });
    var n = best ? parseInt(best.value, 10) : NaN;
    return isNaN(n) ? null : n;   // no row = no amber (nothing invented)
  }

  /** Status of one item on a day: worst of each test and the expiry date. */
  function status(T, it, on) {
    var soon = dueSoonDays(T, on), recs = records(T, it.id, it.kind_key), lines = [];
    testsFor(T, it.kind_key, on).forEach(function (ty) {
      var mine = recs.filter(function (r) { return r.type.type_key === ty.type_key && r.outcome !== 'note'; });
      var last = mine[0], pass = mine.filter(function (r) { return r.outcome === 'ok'; })[0];
      var every = parseInt((pass ? typeOn(T, ty.type_key, pass.on) || ty : ty).every_days, 10);
      var next = pass && !isNaN(every) ? addDays(pass.on, every) : '';
      var st;
      if (last && last.outcome === 'concern') st = 'fail';
      else if (!pass) st = isNaN(parseInt(ty.every_days, 10)) ? 'none' : 'due';
      else if (!next) st = 'ok';
      else if (next < on) st = 'due';
      else if (soon !== null && addDays(on, soon) >= next) st = 'soon';
      else st = 'ok';
      lines.push({ key: ty.type_key, label: ty.label, sop: ty.sop || '', last: last ? last.on : '', next: next, st: st });
    });
    var exp = t(it.expires_on), est = '';
    if (exp) est = exp < on ? 'expired' : (soon !== null && addDays(on, soon) >= exp ? 'soon' : 'ok');
    var worst = lines.map(function (l) { return l.st; }).concat(est ? [est] : []).reduce(function (a, b) { return RANK[b] > RANK[a] ? b : a; }, lines.length || est ? 'ok' : 'none');
    var nexts = lines.map(function (l) { return l.next; }).concat(exp ? [exp] : []).filter(Boolean).sort();
    return { st: worst, lines: lines, next: nexts[0] || '', expiry: est };
  }

  /** Every item with its kind, room, use and status on a day, best to worst. */
  function list(T, on) {
    var kinds = {};
    rows(T, 'BLD-item_kinds.csv').forEach(function (k) { if (!kinds[k.kind_key] || t(k.set_on) >= t(kinds[k.kind_key].set_on)) kinds[k.kind_key] = k; });
    var areas = {};
    rows(T, 'BLD-area.csv').forEach(function (a) { areas[a.id] = a; });
    return current(T).map(function (it) {
      var use = inUse(T, it.id, on), pl = placeOn(T, it.id, on), a = pl ? areas[pl.to_id] : null;
      return { it: it, kind: kinds[it.kind_key] ? kinds[it.kind_key].label : it.kind_key, place: pl ? (a ? (a.code || a.name || a.id) : pl.to_id) : '', placeRow: pl,
        archived: !use.yes, useRow: use.row, s: use.yes ? status(T, it, on) : { st: 'none', lines: [], next: '' } };
    }).sort(function (a, b) {
      return (a.archived - b.archived) || (RANK[a.s.st] - RANK[b.s.st]) || t(a.kind).localeCompare(t(b.kind)) || t(a.it.item_no).localeCompare(t(b.it.item_no), undefined, { numeric: true });
    });
  }

  function filtered(all) {
    var q = S.q.toLowerCase();
    return all.filter(function (x) {
      if (S.filter === 'archived') { if (!x.archived) return false; }
      else if (x.archived) return false;
      if (S.filter === 'ok' && x.s.st !== 'ok') return false;
      if (S.filter === 'soon' && x.s.st !== 'soon') return false;
      if (S.filter === 'due' && !(x.s.st === 'due' || x.s.st === 'fail' || x.s.st === 'expired')) return false;
      if (!q) return true;
      return [x.it.item_no, x.it.name, x.kind, x.place, x.it.make, x.it.model, x.it.serial_no, x.it.size].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }

  /** CSV (owner export): one line per item and test, the same layout the import reads. */
  function csv(T, on) {
    var q = function (x) { x = String(x == null ? '' : x); return /[",\n]/.test(x) || /^[=+\-@]/.test(x) ? '"' + (/^[=+\-@]/.test(x) ? "'" : '') + x.replace(/"/g, '""') + '"' : x; };
    var out = [['item_no', 'name', 'kind', 'room', 'size', 'made_on', 'expires_on', 'status', 'archived', 'test', 'last', 'next', 'test_status', 'readings'].join(',')];
    list(T, on).forEach(function (x) {
      var base = [x.it.item_no, x.it.name, x.kind, x.place, x.it.size, x.it.made_on, x.it.expires_on, WORD[x.s.st], x.archived ? 'yes' : ''];
      var lines = x.s.lines.length ? x.s.lines : [null];
      lines.forEach(function (l) {
        var rec = l ? records(T, x.it.id, x.it.kind_key).filter(function (r) { return r.type.type_key === l.key; })[0] : null;
        var rd = rec ? rec.values.map(function (v) { return v.key + '=' + v.value + (v.unit ? ' ' + v.unit : '') + (v.inr === false ? ' (outside)' : ''); }).join('; ') : '';
        out.push(base.concat(l ? [l.label, l.last, l.next, WORD[l.st], rd] : ['', '', '', '', '']).map(q).join(','));
      });
    });
    return out.join('\r\n') + '\r\n';
  }

  /* ------------------------------------------------------------------ drawing */
  var I = {   // Tabler outline paths
    item: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
    plus: 'M12 5v14M5 12h14', archive: 'M3 4h18v4H3zM5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4',
    test: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 3h6v4H9zM9 14l2 2l4-4',
    report: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2zM9 17h6M9 13h6',
    csv: 'M14 3v4a1 1 0 0 0 1 1h4M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2zM12 11v6M9 14l3 3l3-3',
    place: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 10m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
    tick: 'M5 12l5 5L20 7'
  };
  function ic(k, cls) { return '<svg class="ti' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + I[k] + '"/></svg>'; }
  (function () {
    if (typeof document === 'undefined' || document.getElementById('itm-css')) return;
    var st = document.createElement('style'); st.id = 'itm-css';
    st.textContent = [
      '.itm-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0}.itm-bar input[type=search]{flex:1;min-width:160px;min-height:40px}',
      '.itm-f{all:unset;cursor:pointer;padding:6px 10px;border:1px solid var(--line);border-radius:999px;font-size:var(--fs-small)}#main .itm-f:hover{background:var(--hov)}.itm-f[aria-pressed=true]{border-color:var(--sel-bd);font-weight:600}',
      '.itm-row{all:unset;box-sizing:border-box;cursor:pointer;display:flex;gap:8px;align-items:center;width:100%;padding:8px 10px;border-left:3px solid var(--ljr-2-icon);border-bottom:1px solid var(--line)}#main .itm-row:hover{background:var(--hov)}',
      '.itm-row b{min-width:56px}.itm-row span.mut{flex:1}.ti{width:20px;height:20px;flex:none}.ti.c2{color:var(--ljr-2-icon)}',
      '.itm-btns{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.itm-btns .btn{display:inline-flex;gap:6px;align-items:center}',
      '.itm-form{display:grid;gap:8px;max-width:520px;margin:8px 0}.itm-form label{display:grid;gap:2px;font-size:var(--fs-small);color:var(--muted)}.itm-form input,.itm-form select{min-height:40px;color:var(--ink)}',
      '.itm-lim{font-size:var(--fs-small)}.itm-lim.ok{color:var(--ljr-5-icon)}.itm-lim.no{color:var(--ljr-2-icon);font-weight:600}',
      '.itm-tick{color:var(--ljr-5-icon);font-weight:600}'
    ].join('\n');
    document.head.appendChild(st);
  }());

  function pill(st) { return '<span class="pill ' + (PILL[st] || '') + '">' + WORD[st] + '</span>'; }

  function page(v) {
    var e = v.esc, on = v.today, all = list(v.T, on);
    if (!rows(v.T, 'BLD-item_kinds.csv').length && !rows(v.T, 'BLD-items.csv').length) {
      return '<section class="card" id="itmPage"><h2 class="adm-h">' + ic('item', 'c2') + 'Items</h2><p class="mut">No item list yet. When BLD-items and BLD-item_kinds are created, the items show here.</p></section>';
    }
    if (S.open) return cardHtml(v, all.filter(function (x) { return x.it.id === S.open; })[0]);
    var counts = { all: 0, ok: 0, soon: 0, due: 0, archived: 0 };
    all.forEach(function (x) { if (x.archived) { counts.archived++; return; } counts.all++; if (x.s.st === 'ok') counts.ok++; else if (x.s.st === 'soon') counts.soon++; else if (x.s.st === 'due' || x.s.st === 'fail' || x.s.st === 'expired') counts.due++; });
    var shown = filtered(all), byKind = {};
    shown.forEach(function (x) { (byKind[x.kind] = byKind[x.kind] || []).push(x); });
    var h = '<section class="card" id="itmPage"><h2 class="adm-h">' + ic('item', 'c2') + 'Items</h2>'
      + '<div class="itm-btns"><button type="button" class="btn" data-itm-form="add">' + ic('plus') + 'Add</button>'
      + '<button type="button" class="btn" data-itm-report="print">' + ic('report') + 'Report</button>'
      + '<button type="button" class="btn" data-itm-report="csv">' + ic('csv') + 'CSV</button></div>'
      + (S.form === 'add' ? addForm(v) : '') + (S.msg ? '<p role="status">' + e(S.msg) + '</p>' : '')
      + '<div class="itm-bar" role="group" aria-label="Show">'
      + [['all', 'All'], ['ok', 'In date'], ['soon', 'Due soon'], ['due', 'Overdue'], ['archived', 'Archived']].map(function (f) {
        return '<button type="button" class="itm-f" data-itm-filter="' + f[0] + '" aria-pressed="' + (S.filter === f[0]) + '">' + f[1] + ' ' + counts[f[0]] + '</button>';
      }).join('') + '<input type="search" data-itm-q placeholder="Search" aria-label="Search items" value="' + e(S.q) + '"></div>';
    Object.keys(byKind).forEach(function (k) {
      var xs = byKind[k], bad = xs.filter(function (x) { return RANK[x.s.st] >= RANK.due; }).length;
      h += '<details class="compfold" open><summary><h3>' + e(k) + ' <span class="mut">' + xs.length + '</span>' + (bad ? ' <span class="pill no">' + bad + '</span>' : '') + '</h3></summary>'
        + xs.map(function (x) {
          return '<button type="button" class="itm-row" data-itm-open="' + e(x.it.id) + '"><b>' + e(x.it.item_no) + '</b><span>' + e(x.it.name) + (x.it.size ? ' · ' + e(x.it.size) : '') + '</span>'
            + '<span class="mut">' + e(x.place || 'no room') + (x.s.next ? ' · next ' + e(v.dmy(x.s.next)) : '') + '</span>'
            + (x.archived ? '<span class="pill">Archived</span>' : pill(x.s.st)) + (S.ticks[x.it.id] ? '<span class="itm-tick" aria-label="saved">' + ic('tick') + '</span>' : '') + '</button>';
        }).join('') + '</details>';
    });
    if (!shown.length) h += '<p class="mut">None.</p>';
    return h + '</section>';
  }

  function kindOptions(v, sel) {
    var seen = {};
    return rows(v.T, 'BLD-item_kinds.csv').filter(function (k) { if (seen[k.kind_key]) return false; seen[k.kind_key] = 1; return true; })
      .map(function (k) { return '<option value="' + v.esc(k.kind_key) + '"' + (k.kind_key === sel ? ' selected' : '') + '>' + v.esc(k.label) + '</option>'; }).join('');
  }
  function areaOptions(v, sel) {
    return '<option value="">No room</option>' + rows(v.T, 'BLD-area.csv').map(function (a) { return '<option value="' + v.esc(a.id) + '"' + (a.id === sel ? ' selected' : '') + '>' + v.esc(a.code || a.name || a.id) + '</option>'; }).join('');
  }
  function addForm(v, it) {
    var e = v.esc; it = it || {};
    return '<form class="itm-form" data-itm-save="' + (it.id ? 'edit' : 'add') + '">'
      + '<label>Number<input name="item_no" required value="' + e(it.item_no || '') + '"></label>'
      + '<label>Name<input name="name" required value="' + e(it.name || '') + '"></label>'
      + '<label>Kind<select name="kind_key" required>' + kindOptions(v, it.kind_key) + '</select></label>'
      + (it.id ? '' : '<label>Room<select name="area_id">' + areaOptions(v, '') + '</select></label><label>In use from<input type="date" name="from_date" value="' + e(v.today) + '"></label>')
      + '<label>Size<input name="size" value="' + e(it.size || '') + '" placeholder="e.g. 2.2 kg"></label>'
      + '<label>Make<input name="make" value="' + e(it.make || '') + '"></label><label>Model<input name="model" value="' + e(it.model || '') + '"></label>'
      + '<label>Serial<input name="serial_no" value="' + e(it.serial_no || '') + '"></label>'
      + '<label>Made<input type="date" name="made_on" value="' + e(it.made_on || '') + '"></label><label>Expiry<input type="date" name="expires_on" value="' + e(it.expires_on || '') + '"></label>'
      + '<label>Photo<input type="file" name="file" accept="image/*" capture="environment"></label>'
      + '<label>or a link to it<input name="link" placeholder="https://"></label>'
      + '<label>Note<input name="note" value="' + e(it.note || '') + '"></label>'
      + '<div class="itm-btns"><button type="submit" class="btn yes">Save</button><button type="button" class="btn" data-itm-form="">Cancel</button></div></form>';
  }

  function cardHtml(v, x) {
    var e = v.esc;
    if (!x) { S.open = ''; return page(v); }
    var it = x.it, recs = records(v.T, it.id, it.kind_key), pics = filesFor(v.T, 'items', it.id, ['main']);
    var h = '<section class="card" id="itmCard"><p><button type="button" class="btn" data-itm-open="">Items</button></p>'
      + '<h2 class="adm-h">' + ic('item', 'c2') + e(it.item_no) + ' ' + e(it.name) + ' ' + (x.archived ? '<span class="pill">Archived</span>' : pill(x.s.st)) + (S.ticks[it.id] ? ' <span class="itm-tick" aria-label="saved">' + ic('tick') + '</span>' : '') + '</h2>'
      + '<p class="mut">' + [x.kind, it.size, it.make, it.model, it.serial_no ? 'serial ' + it.serial_no : ''].filter(Boolean).map(e).join(' · ') + '</p>'
      + '<p>' + ic('place') + ' ' + e(x.place || 'No room') + (x.placeRow ? ' <span class="mut">since ' + e(v.dmy(x.placeRow.from_date)) + '</span>' : '') + '</p>'
      + (it.made_on || it.expires_on ? '<p class="mut">' + (it.made_on ? 'Made ' + e(v.dmy(it.made_on)) + ' ' : '') + (it.expires_on ? 'Expiry ' + e(v.dmy(it.expires_on)) : '') + '</p>' : '')
      + (pics.length || it.photo ? '<p><a href="' + e(pics.length ? pics[pics.length - 1].href : fileHref(it.photo)) + '" target="_blank" rel="noopener">Photo</a></p>' : '')
      + (x.archived && x.useRow ? '<p class="mut">Archived ' + e(v.dmy(x.useRow.to_date)) + (x.useRow.source ? ': ' + e(x.useRow.source) : '') + '</p>' : '')
      + (S.msg ? '<p role="status">' + e(S.msg) + '</p>' : '');
    if (!x.archived) {
      h += '<div class="itm-btns">' + x.s.lines.map(function (l) { return '<button type="button" class="btn" data-itm-form="test:' + e(l.key) + '">' + ic('test') + e(l.label) + '</button>'; }).join('')
        + '<button type="button" class="btn" data-itm-form="move">' + ic('place') + 'Room</button>'
        + '<button type="button" class="btn" data-itm-form="edit">Edit</button>'
        + '<button type="button" class="btn" data-itm-form="archive">' + ic('archive') + 'Archive</button></div>';
    }
    if (S.form.indexOf('test:') === 0) h += testForm(v, it, S.form.slice(5));
    else if (S.form === 'move') h += '<form class="itm-form" data-itm-save="move"><label>Room<select name="area_id" required>' + areaOptions(v, x.placeRow ? x.placeRow.to_id : '') + '</select></label><label>From<input type="date" name="from_date" required value="' + e(v.today) + '"></label><div class="itm-btns"><button type="submit" class="btn yes">Save</button><button type="button" class="btn" data-itm-form="">Cancel</button></div></form>';
    else if (S.form === 'archive') h += '<form class="itm-form" data-itm-save="archive"><label>Last day in use<input type="date" name="to_date" required value="' + e(v.today) + '"></label><label>Why<select name="why"><option>Dead</option><option>Failed test</option><option>Replaced</option><option>Gone</option><option>Other</option></select></label><label>Note<input name="note"></label><div class="itm-btns"><button type="submit" class="btn yes">Archive</button><button type="button" class="btn" data-itm-form="">Cancel</button></div></form>';
    else if (S.form === 'edit') h += addForm(v, it);
    if (x.s.lines.length) {
      h += '<h3>Tests</h3><table><thead><tr><th>test</th><th>last</th><th>next</th><th></th></tr></thead><tbody>' + x.s.lines.map(function (l) {
        return '<tr><td>' + e(l.label) + '</td><td>' + e(l.last ? v.dmy(l.last) : '—') + '</td><td>' + e(l.next ? v.dmy(l.next) : '—') + '</td><td>' + pill(l.st) + '</td></tr>';
      }).join('') + '</tbody></table>';
    }
    h += '<h3>Records</h3>' + (recs.length ? recs.map(function (r) {
      return '<div class="dcs-row"><span class="mut">' + e(v.dmy(r.on)) + '</span><b>' + e(r.type.label) + '</b>' + (r.outcome === 'ok' ? '<span class="pill ok">Pass</span>' : r.outcome === 'concern' ? '<span class="pill no">Fail</span>' : '<span class="pill">' + e(r.outcome) + '</span>')
        + r.values.map(function (val) { return '<span class="mut">' + e(val.label) + ' ' + e(val.value) + (val.unit ? ' ' + e(val.unit) : '') + (val.inr === false ? ' <b class="itm-lim no">outside</b>' : '') + '</span>'; }).join('')
        + (S.retry[r.id] ? '<b class="itm-lim no">Values not all saved</b><button type="button" class="btn" data-itm-retry="' + e(r.id) + '">Retry</button>' : '')
        + (r.note ? '<span class="mut">' + e(r.note) + '</span>' : '') + r.files.map(function (f) { return '<a href="' + e(f.href) + '" target="_blank" rel="noopener">' + e(f.label) + '</a>'; }).join('') + '</div>';
    }).join('') : '<p class="mut">No records.</p>');
    return h + '</section>';
  }

  function fileHref(p) { p = t(p); if (/^https:\/\//.test(p)) return p; return /^[A-Za-z0-9_\-]{20,}$/.test(p) ? 'https://drive.google.com/file/d/' + p + '/view' : '#'; }

  function testForm(v, it, key) {
    var e = v.esc, on = S.testOn || v.today, fs = fieldsOn(v.T, key, on), ty = typeOn(v.T, key, on) || {}, rks = readingKindsFor(v.T, key, on);
    return '<form class="itm-form" data-itm-save="test" data-key="' + e(key) + '"><h3>' + e(ty.label || key) + '</h3>'
      + '<label>Date<input type="date" name="on" required value="' + e(on) + '" max="' + e(v.today) + '" data-itm-teston></label>'
      + rks.map(function (k) {
        var L = limitOn(v.T, k.id, it, on) || {}, lim = [t(L.low) ? '≥ ' + L.low : '', t(L.high) ? '≤ ' + L.high : ''].filter(Boolean).join(' ');
        return '<label>' + e(k.label || k.kind_key) + (k.unit_id ? ' (' + e(k.unit_id) + ')' : '') + (lim ? ' <span class="mut">' + e(lim) + '</span>' : '')
          + '<input name="r_' + e(k.id) + '" inputmode="decimal" data-itm-num data-lo="' + e(L.low || '') + '" data-hi="' + e(L.high || '') + '"><span class="itm-lim" aria-live="polite"></span></label>';
      }).join('')
      + fs.map(function (f) {
        var input = f.kind === 'choice' ? '<select name="v_' + e(f.field_key) + '"' + (f.required === 'true' ? ' required' : '') + '><option value=""></option>' + String(f.choices || '').split('|').map(function (c) { return '<option>' + e(c) + '</option>'; }).join('') + '</select>'
          : f.kind === 'yesno' ? '<select name="v_' + e(f.field_key) + '"><option value=""></option><option>yes</option><option>no</option></select>'
          : '<input name="v_' + e(f.field_key) + '"' + (f.kind === 'number' ? ' inputmode="decimal"' : f.kind === 'date' ? ' type="date"' : '') + (f.required === 'true' ? ' required' : '') + '>';
        return '<label>' + e(f.label) + input + '</label>';
      }).join('')
      + '<label>Result<select name="outcome" required><option value="ok">Pass</option><option value="concern">Fail</option></select></label>'
      + '<label>Who tested<input name="by" placeholder="e.g. G A Fire"></label>'
      + '<label>Evidence: photo or certificate (PDF)<input type="file" name="file" accept="image/*,application/pdf" capture="environment"></label>'
      + '<label>It is the certificate for this visit<select name="file_kind"><option value="evidence">No, a photo of this item</option><option value="certificate">Yes, certificate</option></select></label>'
      + '<label>or a link to it<input name="link" placeholder="https://"></label>'
      + '<label>Note (needed for a Fail)<input name="note"></label>'
      + '<div class="itm-btns"><button type="submit" class="btn yes">Save</button><button type="button" class="btn" data-itm-form="">Cancel</button></div></form>';
  }

  /* ------------------------------------------------------------------ saving */
  function remember(v, file, fields, res) {
    if (!res || !res.ok || !res.result || !res.result.id) return;
    var row = Object.assign({ id: res.result.id, created_at: new Date().toISOString(), set_on: new Date().toISOString() }, fields);
    (v.T[file] = v.T[file] || []).push(row);
  }
  function post(v, table, fields, extra) {
    var body = Object.assign({ table: table, action: 'add', fields: fields }, extra || {});
    return (v.sinkSend ? v.sinkSend(body) : v.sinkPost(table, fields)).then(function (r) {
      if (r && r.ok) remember(v, 'BLD-' + (table === 'requirement' ? 'requirement' : table) + '.csv', fields, r);
      return r;
    });
  }
  /** A photo is shrunk to 1600px JPEG on the device; a PDF goes as it is. Resolves {mime, b64} or null. */
  function readFile(file) {
    if (!file) return Promise.resolve(null);
    var asB64 = function (blob) { return new Promise(function (ok, no) { var fr = new FileReader(); fr.onload = function () { ok(String(fr.result).split(',')[1] || ''); }; fr.onerror = no; fr.readAsDataURL(blob); }); };
    if (file.type === 'application/pdf') return asB64(file).then(function (b) { return { mime: 'application/pdf', b64: b }; });
    if (!/^image\//.test(file.type)) return Promise.reject(new Error('Choose a photo or a PDF.'));
    return new Promise(function (ok, no) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        ok({ mime: 'image/jpeg', b64: c.toDataURL('image/jpeg', 0.8).split(',')[1] });
      };
      img.onerror = function () { no(new Error('That photo could not be read.')); };
      img.src = url;
    });
  }
  /* Shared saves, each behind its own switch on the save script (off until Lisa's yes):
     link_add (STAFF), file_add (DOGCARD, PR 567: stores the file and writes the files row; the link is a separate
     link_add), readings (TEMPS; STAFF builds the save). Shapes as agreed with them on 14 Nov. */
  function act(v, action, fields, file, row) {
    if (!v.sinkSend) return Promise.resolve({ ok: false, message: 'Saving is not set up on this device.' });
    return v.sinkSend({ action: action, fields: fields }).then(function (r) {
      if (r && r.ok && r.result && file && row) (v.T[file] = v.T[file] || []).push(Object.assign({ id: r.result.id || '' }, row(r.result)));
      return r;
    });
  }
  function linkAdd(v, f) { return act(v, 'link_add', f, LINKS, function () { return f; }); }
  /** Send the chosen photo or PDF (or the typed link), then join it to a record: file_add (DOGCARD, PR 567) stores the
      file and returns its files id; link_add (STAFF) joins it. Two calls: if the link fails the file waits unlinked and
      sending again re-uses it (same bytes = same id). Resolves null when there is nothing to send. */
  function fileAdd(v, form, d, fromTable, fromId, kindKey) {
    var el = form.querySelector('input[type=file][name=file]'), file = el && el.files && el.files[0];
    if (!file && !d.link) return Promise.resolve(null);
    if (!v.sinkSend) return Promise.resolve({ ok: false, message: 'Saving is not set up on this device.' });
    var join = function (r) {
      if (!r || !r.ok || !r.result || !r.result.id) return r || { ok: false };
      var res = r.result;
      if (!rows(v.T, 'BLD-files.csv').some(function (f) { return f.id === res.id; })) (v.T['BLD-files.csv'] = v.T['BLD-files.csv'] || []).push({ id: res.id, drive_file_id: res.drive_file_id || '', url: d.link || '', mime: res.mime || (file ? file.type : '') });
      return linkAdd(v, { from_table: fromTable, from_id: fromId, to_table: 'files', to_id: res.id, role: kindKey, from_date: v.today });
    };
    if (!file) return /^https:\/\//.test(d.link) ? v.sinkSend({ action: 'file_add', fields: { kind: 'link', url: d.link, source: 'link' } }).then(join) : Promise.resolve({ ok: false, message: 'A link starts with https://' });
    return readFile(file).then(function (f) {
      if (f.b64.length > 1800000) throw new Error('That file is too large. Use a smaller photo or PDF.');
      S.msg = 'Sending the file…'; v.redraw();
      return v.sinkSend({ action: 'file_add', fields: { kind: f.mime === 'application/pdf' ? 'upload' : 'photo', mime: f.mime, data_base64: f.b64, name: file.name || '', taken_on: d.on || v.today, source: el.hasAttribute('capture') ? 'camera' : 'upload' } });
    }).then(join);
  }
  function why(r) { if (!r) return 'Not saved.'; if (r instanceof Error) return r.message; if (r.fields) return Object.keys(r.fields).map(function (k) { return r.fields[k]; }).join(' '); return r.message || 'Not saved.'; }
  /** After the main row saved: run the follow-on saves; the item still gets its tick, any that failed are named. */
  function after(steps, id, done) {
    return Promise.all(steps.map(function (p) { return p.then(function (r) { return r; }, function (x) { return x; }); })).then(function (rs) {
      var bad = rs.filter(function (x) { return x && (x instanceof Error || x.ok === false); }).map(why);
      done(id, bad.length ? 'Saved. Not saved: ' + bad.join(' ') : 'Saved.');
    });
  }

  /** Send readings rows for a saved test; each has its own request id (<test>-r<n>) so a resend is safe. Rows that
      fail wait in S.retry for the Retry button, which resends only them, never the test row. Resolves the count left. */
  function sendReads(v, logId, reads) {
    return Promise.all(reads.map(function (x) {
      return post(v, 'readings', x.fields, { request_id: x.rid }).then(function (r) { return r && (r.ok || r.code === 'DUPLICATE') ? null : x; }, function () { return x; });   // DUPLICATE = already saved (STAFF readings save)
    })).then(function (rs) {
      var left = rs.filter(Boolean);
      if (left.length) S.retry[logId] = left; else delete S.retry[logId];
      return left.length;
    });
  }

  function onSave(v, form) {
    var kind = form.getAttribute('data-itm-save'), d = {};
    Array.prototype.forEach.call(form.elements, function (el) { if (el.name) d[el.name] = t(el.value); });
    var done = function (id, msg) { S.busy = false; S.form = ''; S.msg = msg; if (id) S.ticks[id] = true; v.redraw(); };
    var fail = function (r) { S.busy = false; S.msg = why(r); v.redraw(); };
    if (S.busy) return;
    S.busy = true; S.msg = 'Saving…'; v.redraw();
    var ITEM = ['item_no', 'name', 'kind_key', 'make', 'model', 'serial_no', 'size', 'made_on', 'expires_on', 'note'];
    var pick = function () { var f = {}; ITEM.forEach(function (k) { if (d[k]) f[k] = d[k]; }); return f; };
    var place = function (id, area, from, why2) { return linkAdd(v, { from_table: 'items', from_id: id, to_table: 'areas', to_id: area, role: PLACE, from_date: from, source: why2 }); };
    if (kind === 'add') {
      post(v, 'items', pick()).then(function (r) {
        if (!r || !r.ok) return fail(r);
        var id = r.result.id, steps = [];
        if (d.area_id) steps.push(place(id, d.area_id, d.from_date || v.today, 'Added on the Items page'));
        if (d.from_date) steps.push(post(v, 'requirement', { need_type: NEED, target_table: 'items', target_id: id, from_date: d.from_date, source: 'Added on the Items page' }));
        steps.push(fileAdd(v, form, d, 'items', id, 'main'));
        return after(steps, id, done);
      }, fail);
    } else if (kind === 'edit') {
      var g = pick(); g.corrects_id = S.open;
      post(v, 'items', g).then(function (r) { if (!r || !r.ok) return fail(r); return after([fileAdd(v, form, d, 'items', S.open, 'main')], S.open, done); }, fail);
    } else if (kind === 'move') {
      var old = placeOn(v.T, S.open, v.today);
      if (old && d.from_date <= t(old.from_date)) return fail({ message: 'Pick a day after ' + v.dmy(old.from_date) + ', when it went to its current room.' });
      // one link_add: placed_in allows one at a time, so the save ends the old room the day before (STAFF, PR 563)
      place(S.open, d.area_id, d.from_date, 'Moved on the Items page').then(function (r2) {
        if (!r2 || !r2.ok) return fail(r2);
        var ended = (r2.result && r2.result.ended) || (old ? [old.id] : []);
        rows(v.T, LINKS).forEach(function (l) { if (ended.indexOf(l.id) >= 0 && !t(l.to_date)) l.to_date = addDays(d.from_date, -1); });
        done(S.open, 'Saved.');
      }, fail);
    } else if (kind === 'archive') {
      var y = list(v.T, v.today).filter(function (z) { return z.it.id === S.open; })[0];
      var from = (y && y.useRow && y.useRow.from_date) || day(y && y.it.first_at) || d.to_date;
      if (from > d.to_date) from = d.to_date;
      post(v, 'requirement', { need_type: NEED, target_table: 'items', target_id: S.open, from_date: from, to_date: d.to_date, source: d.why + (d.note ? ': ' + d.note : '') })
        .then(function (r) { if (!r || !r.ok) return fail(r); done(S.open, 'Archived.'); }, fail);
    } else if (kind === 'test') {
      var key = form.getAttribute('data-key'), ty = typeOn(v.T, key, d.on), values = {}, reads = [];
      if (!ty) return fail({ message: 'That test was not in force on that day.' });
      Object.keys(d).forEach(function (k) {
        if (d[k] === '') return;
        if (k.indexOf('v_') === 0) values[k.slice(2)] = d[k];
        else if (k.indexOf('r_') === 0) {
          if (isNaN(parseFloat(d[k]))) return;
          reads.push({ kind_id: k.slice(2), value: d[k] });
        }
      });
      if (Object.keys(d).some(function (k) { return k.indexOf('r_') === 0 && d[k] !== '' && isNaN(parseFloat(d[k])); })) return fail({ message: 'Type each reading as a number, e.g. 0.09.' });
      var at = d.on === v.today ? new Date().toISOString() : d.on + 'T12:00:00Z';
      var lf = { check_type_id: ty.id, item_id: S.open, outcome: d.outcome, happened_at: at, how_recorded: 'typed' };
      if (d.note || d.by) lf.note = [d.by ? 'by ' + d.by : '', d.note].filter(Boolean).join('. ');
      if (d.on < addDays(v.today, -7)) lf.confirm_unusual = 'yes';   // an Earlier entry: the owner chose the date
      if (d.outcome === 'concern' && !d.note) return fail({ message: 'Say briefly what failed.' });
      var rid = 'itm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      post(v, 'check_log', lf, { values: values, request_id: rid }).then(function (r) {
        if (!r || !r.ok) return fail(r);
        var logId = r.result.id;
        Object.keys(values).forEach(function (k) { (v.T['BLD-check_value.csv'] = v.T['BLD-check_value.csv'] || []).push({ check_log_id: logId, field_key: k, value: values[k] }); });
        var rk = {}; rows(v.T, 'BLD-reading_kinds.csv').forEach(function (k) { rk[k.id] = k; });
        var itm = (list(v.T, v.today).filter(function (z) { return z.it.id === S.open; })[0] || {}).it || { id: S.open };
        reads.forEach(function (x, n) {
          var k = rk[x.kind_id] || {}, L = limitOn(v.T, x.kind_id, itm, d.on), inr = inLimit(L, x.value);
          x.rid = rid + '-r' + (n + 1);
          x.fields = { kind_id: x.kind_id, item_id: S.open, check_log_id: logId, value: x.value, unit_id: k.unit_id || '', precision_dp: k.precision_dp || '',
            limit_id: (L && L.id) || '', in_range: inr === null ? '' : String(inr), taken_at: at, how_entered: 'typed', source: 'staff' };
          if (v.who) x.fields.taken_by = v.who;
        });
        S.testOn = '';
        return sendReads(v, logId, reads).then(function (left) {
          return fileAdd(v, form, d, 'check_logs', logId, d.file_kind === 'certificate' ? 'certificate' : 'evidence').then(function (r3) { return r3; }, function (x) { return x; }).then(function (r3) {
            var fileBad = r3 && (r3 instanceof Error || r3.ok === false) ? ' File not saved: ' + why(r3) : '';
            done(S.open, (left ? 'Test saved. Values not all saved.' : 'Saved.') + fileBad);
          });
        });
      }, fail);
    }
  }

  function report(v, how) {
    var on = v.today;
    if (how === 'csv') {
      var blob = new Blob([csv(v.T, on)], { type: 'text/csv' }), a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'Items ' + on + '.csv'; document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    var e = v.esc, xs = filtered(list(v.T, on)), w = window.open('', '_blank');
    if (!w) { S.msg = 'Allow pop-ups to print the report.'; v.redraw(); return; }
    var body = '<h1>Items</h1><p>As at ' + e(v.dmy(on)) + '. Printed ' + e(new Date().toLocaleString('en-GB')) + '. Filter: ' + e(S.filter) + (S.q ? ', search "' + e(S.q) + '"' : '') + '.</p>'
      + '<table><thead><tr><th>No.</th><th>Item</th><th>Kind</th><th>Room</th><th>Expiry</th><th>Test</th><th>Last</th><th>Next</th><th>Status</th><th>Readings</th><th>Evidence</th></tr></thead><tbody>'
      + xs.map(function (x) {
        var ls = x.s.lines.length ? x.s.lines : [null];
        return ls.map(function (l, i) {
          var rec = l ? records(v.T, x.it.id, x.it.kind_key).filter(function (r) { return r.type.type_key === l.key; })[0] : null;
          return '<tr>' + (i ? '<td></td><td></td><td></td><td></td><td></td>' : '<td>' + e(x.it.item_no) + '</td><td>' + e(x.it.name) + (x.it.size ? ' ' + e(x.it.size) : '') + '</td><td>' + e(x.kind) + '</td><td>' + e(x.place) + '</td><td>' + e(x.it.expires_on ? v.dmy(x.it.expires_on) : '') + '</td>')
            + '<td>' + e(l ? l.label : '') + '</td><td>' + e(l && l.last ? v.dmy(l.last) : '') + '</td><td>' + e(l && l.next ? v.dmy(l.next) : '') + '</td><td>' + e(x.archived ? 'Archived' : WORD[l ? l.st : x.s.st]) + '</td>'
            + '<td>' + e(rec ? rec.values.map(function (val) { return val.label + ' ' + val.value + (val.unit ? ' ' + val.unit : '') + (val.inr === false ? ' (outside)' : ''); }).join(', ') : '') + '</td><td>' + (rec ? rec.files.map(function (f) { return '<a href="' + e(f.href) + '">' + e(f.label) + '</a>'; }).join(' ') : '') + '</td></tr>';
        }).join('');
      }).join('') + '</tbody></table>';
    w.document.write('<!doctype html><meta charset="utf-8"><title>Items ' + e(on) + '</title><style>body{font:12px system-ui,sans-serif;margin:16px}table{border-collapse:collapse;width:100%}th,td{border:1px solid silver;padding:3px 5px;text-align:left;vertical-align:top}th{background:gainsboro}@media print{a{color:black}}</style>' + body + '<script>setTimeout(function(){print()},300)<\/script>');
    w.document.close();
  }

  function bind(main, getV) {
    if (!main) return;
    var cur = typeof getV === 'function' ? getV : function () { return getV; }, v = cur();
    ['click', 'submit', 'input', 'change'].forEach(function (k) { main.addEventListener(k, function () { v = cur(); }, true); });   // fresh rows each time (the hub swaps its tables on refresh)
    main.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-itm-open],[data-itm-filter],[data-itm-form],[data-itm-report],[data-itm-retry]');
      if (!b || !main.contains(b)) return;
      if (b.hasAttribute('data-itm-open')) { S.open = b.getAttribute('data-itm-open'); S.form = ''; S.msg = ''; }
      else if (b.hasAttribute('data-itm-filter')) S.filter = b.getAttribute('data-itm-filter');
      else if (b.hasAttribute('data-itm-form')) { S.form = b.getAttribute('data-itm-form'); S.msg = ''; S.testOn = ''; }
      else if (b.hasAttribute('data-itm-report')) { report(v, b.getAttribute('data-itm-report')); return; }
      else if (b.hasAttribute('data-itm-retry')) {
        var logId = b.getAttribute('data-itm-retry');
        if (S.busy || !S.retry[logId]) return;
        S.busy = true; S.msg = 'Saving…'; v.redraw();
        sendReads(v, logId, S.retry[logId]).then(function (left) { S.busy = false; S.msg = left ? 'Values not all saved.' : 'Saved.'; if (!left) S.ticks[S.open] = true; v.redraw(); });
        return;
      }
      v.redraw();
    });
    main.addEventListener('submit', function (ev) {
      var f = ev.target.closest && ev.target.closest('[data-itm-save]');
      if (!f) return;
      ev.preventDefault(); onSave(v, f);
    });
    main.addEventListener('input', function (ev) {
      var el = ev.target;
      if (el.hasAttribute && el.hasAttribute('data-itm-q')) { S.q = el.value; var pos = el.selectionStart; v.redraw(); var n = document.querySelector('[data-itm-q]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } return; }
      if (el.hasAttribute && el.hasAttribute('data-itm-num')) {
        var res = inLimit({ low: el.getAttribute('data-lo'), high: el.getAttribute('data-hi') }, el.value), out = el.parentNode.querySelector('.itm-lim');
        if (out) { out.className = 'itm-lim' + (res === true ? ' ok' : res === false ? ' no' : ''); out.textContent = res === true ? 'inside limit' : res === false ? 'outside limit' : ''; }
      }
    });
    main.addEventListener('change', function (ev) {
      var el = ev.target;
      if (el.hasAttribute && el.hasAttribute('data-itm-teston')) { S.testOn = el.value; v.redraw(); }   // Earlier: the questions and limits of that day
    });
  }

  /** Compliance fold: per kind, how many items are in date, due soon, overdue (failed and expired count as overdue), as at a day.
   *  Each number opens the Items page on that filter; each kind names the SOP its tests follow. */
  function complianceHtml(v, fold, on) {
    var e = v.esc, all = list(v.T, on).filter(function (x) { return !x.archived; }), m = {}, bad = 0;
    if (!rows(v.T, 'BLD-items.csv').length) return '';
    all.forEach(function (x) {
      var k = m[x.kind] = m[x.kind] || { kind: x.kind, ok: 0, soon: 0, due: 0, sops: {} };
      if (x.s.st === 'ok') k.ok++; else if (x.s.st === 'soon') k.soon++; else if (x.s.st !== 'none') { k.due++; bad++; }
      x.s.lines.forEach(function (l) { if (l.sop) k.sops[l.sop] = 1; });
    });
    var ks = Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return a.due - b.due || a.soon - b.soon || a.kind.localeCompare(b.kind); });
    var n = function (x, cls, f) { return '<td>' + (x ? '<a href="#/items" data-itm-go="' + f + '"><span class="pill ' + cls + '">' + x + '</span></a>' : '<span class="mut">0</span>') + '</td>'; };
    return '<section class="card" id="compItems"><details class="compfold" data-fold="items"' + (fold ? fold('items') : ' open') + '><summary><h3>Items' + (bad ? ' <span class="pill no">' + bad + '</span>' : '') + '</h3></summary>'
      + '<p class="mut">As at ' + e(v.dmy(on)) + '. From the last pass, the test interval and expiry dates.</p><div class="scroll" tabindex="0" role="group" aria-label="Table, scroll sideways for more"><table><thead><tr><th>kind</th><th>SOP</th><th>in date</th><th>due soon</th><th>overdue</th></tr></thead><tbody>'
      + ks.map(function (k) { return '<tr data-kind="' + e(k.kind) + '"><td><b>' + e(k.kind) + '</b></td><td class="mut">' + (Object.keys(k.sops).map(function (s) { return '<a href="#/sops/' + encodeURIComponent(s) + '">' + e(s) + '</a>'; }).join(', ') || '—') + '</td>' + n(k.ok, 'ok', 'ok') + n(k.soon, 'w', 'soon') + n(k.due, 'no', 'due') + '</tr>'; }).join('')
      + '</tbody></table></div></details></section>';
  }

  if (typeof document !== 'undefined') document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('[data-itm-go]');
    if (a) { S.filter = a.getAttribute('data-itm-go'); S.open = ''; S.form = ''; }
  }, true);

  return { FILES: FILES, complianceHtml: complianceHtml, current: current, inUse: inUse, placeOn: placeOn, filesFor: filesFor, testsFor: testsFor, fieldsOn: fieldsOn, readingKindsFor: readingKindsFor, limitOn: limitOn, inLimit: inLimit, _sendReads: sendReads, _fileAdd: fileAdd, records: records, status: status, list: list, csv: csv, page: page, bind: bind, open: function (id) { S.open = id || ''; S.form = ''; }, _state: S };
}));
