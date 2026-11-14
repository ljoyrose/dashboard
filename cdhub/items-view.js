/*!
 * CDItems (More -> Items), owner page. ITEMS, 14 Nov 2026 (decision 13 Nov option A).
 * The owner's numbered list of things that get tested (plug-in appliances, fire extinguishers, smoke alarms,
 * thermometers...): add, move room, archive (dead or failed), record a test with readings and evidence, and export
 * a report (CSV, or a print page saved as PDF). Nothing here names a kind, a test, a limit or an interval: kinds are
 * BLD-item_kinds rows, tests are BLD-check_type rows (target item, item_kind), readings are BLD-check_field rows (unit,
 * limits, dated), the room is a BLD-links row (role placed_in), in use / archived is a BLD-requirement row (need_type
 * item.in_use), "due soon" is the rule row items.due_soon_days. Status is worked out on read, never stored.
 * Works in a browser (window.CDItems) and in Node (module.exports) so the maths can be tested.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CDItems = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FILES = ['BLD-items.csv', 'BLD-item_kinds.csv', 'BLD-links.csv', 'BLD-check_field.csv', 'BLD-check_value.csv'];
  var NEED = 'item.in_use', PLACE = 'placed_in';
  // order best to worst (Lisa 9 Nov): filters and sorts run All, In date ... Overdue, Archived last
  var RANK = { ok: 0, none: 1, soon: 2, due: 3, fail: 4, expired: 5 };
  var WORD = { ok: 'In date', none: 'No test set', soon: 'Due soon', due: 'Overdue', fail: 'Failed', expired: 'Expired' };
  var PILL = { ok: 'ok', none: '', soon: 'w', due: 'no', fail: 'no', expired: 'no' };
  var S = { filter: 'all', q: '', open: '', form: '', msg: '', busy: false, ticks: {} };

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

  /** The room on a day: the latest placed_in row starting on or before it (a move is a new row); a to_date ends it. */
  function placeOn(T, id, on) {
    var r = rows(T, 'BLD-links.csv').filter(function (l) {
      return l.from_table === 'items' && l.from_id === id && l.role === PLACE && t(l.from_date) <= on;
    }).sort(function (a, b) { return t(b.from_date).localeCompare(t(a.from_date)); })[0];
    return r && (!t(r.to_date) || t(r.to_date) >= on) ? r : null;
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
  /** Is a number inside the field's limits? null = no limit set or not a number. */
  function inLimit(f, v) {
    var n = parseFloat(v), lo = t(f.limit_low), hi = t(f.limit_high);
    if (isNaN(n) || (lo === '' && hi === '')) return null;
    return (lo === '' || n >= parseFloat(lo)) && (hi === '' || n <= parseFloat(hi));
  }

  /** Records for one item, newest first; a corrected record gives way to its correction. */
  function records(T, id) {
    var byType = {}, replaced = {}, vals = {};
    rows(T, 'BLD-check_type.csv').forEach(function (r) { byType[r.id] = r; });
    rows(T, 'BLD-check_log.csv').forEach(function (l) { if (l.corrects_id) replaced[l.corrects_id] = true; });
    rows(T, 'BLD-check_value.csv').forEach(function (v) { (vals[v.check_log_id] = vals[v.check_log_id] || []).push(v); });
    return rows(T, 'BLD-check_log.csv').filter(function (l) { return l.item_id === id && !replaced[l.id] && byType[l.check_type_id]; })
      .map(function (l) { var ty = byType[l.check_type_id]; return { id: l.id, on: day(l.happened_at || l.taken_at), type: ty, outcome: l.outcome, note: l.note || '', by: l.taken_by || '', photo: l.photo || '', values: vals[l.id] || [] }; })
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
    var soon = dueSoonDays(T, on), recs = records(T, it.id), lines = [];
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
        var rec = l ? records(T, x.it.id).filter(function (r) { return r.type.type_key === l.key; })[0] : null;
        var rd = rec ? rec.values.map(function (v) { return v.field_key + '=' + v.value; }).join('; ') : '';
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
      + '<label>Photo (Drive link or file id)<input name="photo" value="' + e(it.photo || '') + '"></label>'
      + '<label>Note<input name="note" value="' + e(it.note || '') + '"></label>'
      + '<div class="itm-btns"><button type="submit" class="btn yes">Save</button><button type="button" class="btn" data-itm-form="">Cancel</button></div></form>';
  }

  function cardHtml(v, x) {
    var e = v.esc;
    if (!x) { S.open = ''; return page(v); }
    var it = x.it, recs = records(v.T, it.id);
    var h = '<section class="card" id="itmCard"><p><button type="button" class="btn" data-itm-open="">Items</button></p>'
      + '<h2 class="adm-h">' + ic('item', 'c2') + e(it.item_no) + ' ' + e(it.name) + ' ' + (x.archived ? '<span class="pill">Archived</span>' : pill(x.s.st)) + (S.ticks[it.id] ? ' <span class="itm-tick" aria-label="saved">' + ic('tick') + '</span>' : '') + '</h2>'
      + '<p class="mut">' + [x.kind, it.size, it.make, it.model, it.serial_no ? 'serial ' + it.serial_no : ''].filter(Boolean).map(e).join(' · ') + '</p>'
      + '<p>' + ic('place') + ' ' + e(x.place || 'No room') + (x.placeRow ? ' <span class="mut">since ' + e(v.dmy(x.placeRow.from_date)) + '</span>' : '') + '</p>'
      + (it.made_on || it.expires_on ? '<p class="mut">' + (it.made_on ? 'Made ' + e(v.dmy(it.made_on)) + ' ' : '') + (it.expires_on ? 'Expiry ' + e(v.dmy(it.expires_on)) : '') + '</p>' : '')
      + (it.photo ? '<p><a href="' + e(fileHref(it.photo)) + '" target="_blank" rel="noopener">Photo</a></p>' : '')
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
      var fs = {}; fieldsOn(v.T, r.type.type_key, r.on).forEach(function (f) { fs[f.field_key] = f; });
      return '<div class="dcs-row"><span class="mut">' + e(v.dmy(r.on)) + '</span><b>' + e(r.type.label) + '</b>' + (r.outcome === 'ok' ? '<span class="pill ok">Pass</span>' : r.outcome === 'concern' ? '<span class="pill no">Fail</span>' : '<span class="pill">' + e(r.outcome) + '</span>')
        + r.values.map(function (val) { var f = fs[val.field_key] || {}, lim = inLimit(f, val.value); return '<span class="mut">' + e(f.label || val.field_key) + ' ' + e(val.value) + (f.unit ? ' ' + e(f.unit) : '') + (lim === false ? ' <b class="itm-lim no">outside</b>' : '') + '</span>'; }).join('')
        + (r.note ? '<span class="mut">' + e(r.note) + '</span>' : '') + (r.photo ? '<a href="' + e(fileHref(r.photo)) + '" target="_blank" rel="noopener">Evidence</a>' : '') + '</div>';
    }).join('') : '<p class="mut">No records.</p>');
    return h + '</section>';
  }

  function fileHref(p) { p = t(p); if (/^https:\/\//.test(p)) return p; return /^[A-Za-z0-9_\-]{20,}$/.test(p) ? 'https://drive.google.com/file/d/' + p + '/view' : '#'; }

  function testForm(v, it, key) {
    var e = v.esc, on = S.testOn || v.today, fs = fieldsOn(v.T, key, on), ty = typeOn(v.T, key, on) || {};
    return '<form class="itm-form" data-itm-save="test" data-key="' + e(key) + '"><h3>' + e(ty.label || key) + '</h3>'
      + '<label>Date<input type="date" name="on" required value="' + e(on) + '" max="' + e(v.today) + '" data-itm-teston></label>'
      + fs.map(function (f) {
        var lim = [t(f.limit_low) ? '≥ ' + f.limit_low : '', t(f.limit_high) ? '≤ ' + f.limit_high : ''].filter(Boolean).join(' ');
        var input = f.kind === 'choice' ? '<select name="v_' + e(f.field_key) + '"' + (f.required === 'true' ? ' required' : '') + '><option value=""></option>' + String(f.choices || '').split('|').map(function (c) { return '<option>' + e(c) + '</option>'; }).join('') + '</select>'
          : f.kind === 'yesno' ? '<select name="v_' + e(f.field_key) + '"><option value=""></option><option>yes</option><option>no</option></select>'
          : '<input name="v_' + e(f.field_key) + '"' + (f.kind === 'number' ? ' inputmode="decimal" data-itm-num data-lo="' + e(f.limit_low || '') + '" data-hi="' + e(f.limit_high || '') + '"' : f.kind === 'date' ? ' type="date"' : '') + (f.required === 'true' ? ' required' : '') + '>';
        return '<label>' + e(f.label) + (f.unit ? ' (' + e(f.unit) + ')' : '') + (lim ? ' <span class="mut">' + e(lim) + '</span>' : '') + input + '<span class="itm-lim" aria-live="polite"></span></label>';
      }).join('')
      + '<label>Result<select name="outcome" required><option value="ok">Pass</option><option value="concern">Fail</option></select></label>'
      + '<label>Who tested<input name="by" placeholder="e.g. G A Fire"></label>'
      + '<label>Evidence: photo or certificate (Drive link or file id)<input name="photo"></label>'
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
  function why(r) { if (!r) return 'Not saved.'; if (r.fields) return Object.keys(r.fields).map(function (k) { return r.fields[k]; }).join(' '); return r.message || 'Not saved.'; }

  function onSave(v, form) {
    var kind = form.getAttribute('data-itm-save'), d = {};
    Array.prototype.forEach.call(form.elements, function (el) { if (el.name) d[el.name] = t(el.value); });
    var done = function (id, msg) { S.busy = false; S.form = ''; S.msg = msg; if (id) S.ticks[id] = true; v.redraw(); };
    var fail = function (r) { S.busy = false; S.msg = why(r); v.redraw(); };
    if (S.busy) return;
    S.busy = true; S.msg = 'Saving…'; v.redraw();
    var ITEM = ['item_no', 'name', 'kind_key', 'make', 'model', 'serial_no', 'size', 'made_on', 'expires_on', 'photo', 'note'];
    var pick = function () { var f = {}; ITEM.forEach(function (k) { if (d[k]) f[k] = d[k]; }); return f; };
    if (kind === 'add') {
      var f = pick();
      post(v, 'items', f).then(function (r) {
        if (!r || !r.ok) return fail(r);
        var id = r.result.id, steps = [];
        if (d.area_id) steps.push(post(v, 'links', { from_table: 'items', from_id: id, role: PLACE, to_table: 'areas', to_id: d.area_id, from_date: d.from_date || v.today, source: 'Added on the Items page' }));
        if (d.from_date) steps.push(post(v, 'requirement', { need_type: NEED, target_table: 'items', target_id: id, from_date: d.from_date, source: 'Added on the Items page' }));
        return Promise.all(steps).then(function (rs) { var bad = rs.filter(function (x) { return !x || !x.ok; })[0]; done(id, bad ? 'Item saved. ' + why(bad) : 'Saved.'); });
      }, fail);
    } else if (kind === 'edit') {
      var g = pick(); g.corrects_id = S.open;
      post(v, 'items', g).then(function (r) { if (!r || !r.ok) return fail(r); done(S.open, 'Saved.'); }, fail);
    } else if (kind === 'move') {
      post(v, 'links', { from_table: 'items', from_id: S.open, role: PLACE, to_table: 'areas', to_id: d.area_id, from_date: d.from_date, source: 'Moved on the Items page' }).then(function (r2) { if (!r2 || !r2.ok) return fail(r2); done(S.open, 'Saved.'); }, fail);
    } else if (kind === 'archive') {
      var y = list(v.T, v.today).filter(function (z) { return z.it.id === S.open; })[0];
      var from = (y && y.useRow && y.useRow.from_date) || day(y && y.it.first_at) || d.to_date;
      if (from > d.to_date) from = d.to_date;
      post(v, 'requirement', { need_type: NEED, target_table: 'items', target_id: S.open, from_date: from, to_date: d.to_date, source: d.why + (d.note ? ': ' + d.note : '') })
        .then(function (r) { if (!r || !r.ok) return fail(r); done(S.open, 'Archived.'); }, fail);
    } else if (kind === 'test') {
      var key = form.getAttribute('data-key'), ty = typeOn(v.T, key, d.on), values = {};
      if (!ty) return fail({ message: 'That test was not in force on that day.' });
      Object.keys(d).forEach(function (k) { if (k.indexOf('v_') === 0 && d[k] !== '') values[k.slice(2)] = d[k]; });
      var at = d.on === v.today ? new Date().toISOString() : d.on + 'T12:00:00Z';
      var lf = { check_type_id: ty.id, item_id: S.open, outcome: d.outcome, happened_at: at, how_recorded: 'typed' };
      if (d.note || d.by) lf.note = [d.by ? 'by ' + d.by : '', d.note].filter(Boolean).join('. ');
      if (d.photo) lf.photo = d.photo;
      if (d.on < addDays(v.today, -7)) lf.confirm_unusual = 'yes';   // an Earlier entry: the owner chose the date
      post(v, 'check_log', lf, { values: values }).then(function (r) {
        if (!r || !r.ok) return fail(r);
        Object.keys(values).forEach(function (k) { (v.T['BLD-check_value.csv'] = v.T['BLD-check_value.csv'] || []).push({ check_log_id: r.result.id, field_key: k, value: values[k] }); });
        S.testOn = ''; done(S.open, 'Saved.');
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
          var rec = l ? records(v.T, x.it.id).filter(function (r) { return r.type.type_key === l.key; })[0] : null;
          return '<tr>' + (i ? '<td></td><td></td><td></td><td></td><td></td>' : '<td>' + e(x.it.item_no) + '</td><td>' + e(x.it.name) + (x.it.size ? ' ' + e(x.it.size) : '') + '</td><td>' + e(x.kind) + '</td><td>' + e(x.place) + '</td><td>' + e(x.it.expires_on ? v.dmy(x.it.expires_on) : '') + '</td>')
            + '<td>' + e(l ? l.label : '') + '</td><td>' + e(l && l.last ? v.dmy(l.last) : '') + '</td><td>' + e(l && l.next ? v.dmy(l.next) : '') + '</td><td>' + e(x.archived ? 'Archived' : WORD[l ? l.st : x.s.st]) + '</td>'
            + '<td>' + e(rec ? rec.values.map(function (val) { return val.field_key + ' ' + val.value; }).join(', ') : '') + '</td><td>' + (rec && rec.photo ? '<a href="' + e(fileHref(rec.photo)) + '">file</a>' : '') + '</td></tr>';
        }).join('');
      }).join('') + '</tbody></table>';
    w.document.write('<!doctype html><meta charset="utf-8"><title>Items ' + e(on) + '</title><style>body{font:12px system-ui,sans-serif;margin:16px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:3px 5px;text-align:left;vertical-align:top}th{background:#eee}@media print{a{color:#000}}</style>' + body + '<script>setTimeout(function(){print()},300)<\/script>');
    w.document.close();
  }

  function bind(main, getV) {
    if (!main) return;
    var cur = typeof getV === 'function' ? getV : function () { return getV; }, v = cur();
    ['click', 'submit', 'input', 'change'].forEach(function (k) { main.addEventListener(k, function () { v = cur(); }, true); });   // fresh rows each time (the hub swaps its tables on refresh)
    main.addEventListener('click', function (ev) {
      var b = ev.target.closest && ev.target.closest('[data-itm-open],[data-itm-filter],[data-itm-form],[data-itm-report]');
      if (!b || !main.contains(b)) return;
      if (b.hasAttribute('data-itm-open')) { S.open = b.getAttribute('data-itm-open'); S.form = ''; S.msg = ''; }
      else if (b.hasAttribute('data-itm-filter')) S.filter = b.getAttribute('data-itm-filter');
      else if (b.hasAttribute('data-itm-form')) { S.form = b.getAttribute('data-itm-form'); S.msg = ''; S.testOn = ''; }
      else if (b.hasAttribute('data-itm-report')) { report(v, b.getAttribute('data-itm-report')); return; }
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
        var res = inLimit({ limit_low: el.getAttribute('data-lo'), limit_high: el.getAttribute('data-hi') }, el.value), out = el.parentNode.querySelector('.itm-lim');
        if (out) { out.className = 'itm-lim' + (res === true ? ' ok' : res === false ? ' no' : ''); out.textContent = res === true ? 'inside limit' : res === false ? 'outside limit' : ''; }
      }
    });
    main.addEventListener('change', function (ev) {
      var el = ev.target;
      if (el.hasAttribute && el.hasAttribute('data-itm-teston')) { S.testOn = el.value; v.redraw(); }   // Earlier: the questions and limits of that day
    });
  }

  return { FILES: FILES, current: current, inUse: inUse, placeOn: placeOn, testsFor: testsFor, fieldsOn: fieldsOn, inLimit: inLimit, records: records, status: status, list: list, csv: csv, page: page, bind: bind, open: function (id) { S.open = id || ''; S.form = ''; }, _state: S };
}));
