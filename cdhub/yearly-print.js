/*!
 * BLDYearlyPrint - one yearly (or one-month) A4 print and a CSV for every record the hub keeps.
 * Read only: it never writes a row. Check types come from BLD-check_type, so a future type prints
 * with no change here. Other industries pass their own check_type rows and the same fixed tables.
 *
 * Layout, same idea as the temperature history Print / PDF (temps-report.js):
 *   one A4 landscape page per month per record, shrunk to fit, signature line,
 *   header = business name, record, month.
 *   Daily jobs (every_days 1, or a per-dog / per-area job with no gap set) are a grid:
 *   dogs, areas or items down the side, days across, tick / part / concern / missed.
 *   The mark is a character, so it still reads in greyscale.
 *   Anything else is a list: date, what, who, outcome, note (or that table's own columns).
 *
 * No staff code or licence number is read out. A column whose name is a secret is left off.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDYearlyPrint = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var PAGE_W = 281, PAGE_H = 194, BODY_H = 168;
  var SECRET = /licen[cs]e|staff_?code|password|\bsecret\b|\btoken\b|\bpin\b/i;
  var ID_SRC = '\\b[a-z]{2,5}-(?=[a-z0-9-]*\\d)[a-z0-9]+(?:-[a-z0-9]+)*\\b';
  var RESULT = { ok: 'done', done: 'done', concern: 'concern', not_done: 'not done', recorded: 'recorded', note: 'note', part_done: 'part done' };
  var MARK = { tick: '\u2713', part: '~', concern: '!', miss: '\u2717' };
  var DATE_KEYS = ['happened_at', 'taken_at', 'given_at', 'given_on', 'performed_on', 'born_on', 'whelped_on', 'mated_on', 'assessed_on', 'done_on', 'registered_on', 'implanted_on', 'chipped_on', 'raised_on', 'noticed_on', 'inspection_date', 'verified_on', 'declared_on', 'signed_on', 'period_start', 'on_date', 'moved_in', 'tested_on', 'screened_on', 'noted_on', 'completed_at', 'counted_on', 'recorded_on', 'sold_on', 'collected_on', 'handover_on', 'from_date'];

  function str(v) { return String(v == null ? '' : v).trim(); }
  function e(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ymOf(y, m) { return y + '-' + pad2(m + 1); }
  function isoDay(y, m, d) { return ymOf(y, m) + '-' + pad2(d); }
  function daysIn(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
  function listOf(v) { return str(v).split('|').map(function (x) { return x.trim(); }).filter(Boolean); }
  function human(s) {
    s = str(s).replace(/[._]+/g, ' ').replace(/\s+/g, ' ');
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }
  function everyDays(v) {
    var s = str(v);
    if (!/^[0-9]+$/.test(s)) return null;
    var n = parseInt(s, 10);
    return n > 0 ? n : null;
  }
  function clean(s) {
    return str(s)
      .replace(new RegExp('\\(?\\s*\\bfrom\\s+' + ID_SRC + '\\s*\\)?', 'gi'), ' ')
      .replace(new RegExp(ID_SRC, 'gi'), ' ')
      .replace(/\s+([.,;:])/g, '$1').replace(/([.,;:·|])(\s*[.,;:·|])+/g, '$1')
      .replace(/\s{2,}/g, ' ').replace(/^[\s.,;:·|]+|[\s,;:·|]+$/g, '').trim();
  }
  function who(s) { s = str(s); return /^visit:/i.test(s) ? 'Visitor (shared link)' : clean(s); }
  function secretKey(k) { return SECRET.test(String(k || '')); }

  var FMT = null;
  function london(at) {
    var s = str(at);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { date: s, time: '' };
    var d = new Date(s);
    if (!s || isNaN(d.getTime())) return { date: '', time: '' };
    if (!FMT) FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    var p = {}; FMT.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    return { date: p.year + '-' + p.month + '-' + p.day, time: p.hour + ':' + p.minute };
  }
  function dateOf(row) {
    var i, w;
    for (i = 0; i < DATE_KEYS.length; i++) {
      w = london(row[DATE_KEYS[i]]);
      if (w.date) return w;
    }
    return { date: '', time: '' };
  }
  function pick(row, keys) {
    var i, v;
    for (i = 0; i < keys.length; i++) { if (secretKey(keys[i])) continue; v = clean(row[keys[i]]); if (v) return v; }
    return '';
  }
  function monthWords(ym) { var m = /^(\d{4})-(\d{2})$/.exec(ym || ''); return m ? MON[Number(m[2]) - 1] + ' ' + m[1] : ''; }
  function ymd(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? Number(m[3]) + ' ' + MON[Number(m[2]) - 1].slice(0, 3) + ' ' + m[1] : ''; }

  /**
   * Grid or list, from the check_type row alone (not from its name).
   * Grid when the job is daily (every_days 1), or when every_days is blank and the job is per dog
   * (site_scope per_dog) or per area (target area). A yearly or weekly per-dog job stays a list.
   * Returns 'dogs' | 'areas' | 'items' | 'site' | 'list'.
   */
  function layoutOf(type) {
    if (!type) return 'list';
    var every = everyDays(type.every_days);
    var perDog = type.site_scope === 'per_dog' || type.target === 'dog' || type.target === 'subject';
    var perArea = type.target === 'area' || type.target === 'either';
    var perItem = type.target === 'item';
    var daily = every === 1 || (every == null && (type.site_scope === 'per_dog' || type.target === 'area'));
    if (!daily) return 'list';
    if (perDog && type.target !== 'area' && type.target !== 'either') return 'dogs';
    if (type.site_scope === 'per_dog') return 'dogs';
    if (perArea) return 'areas';
    if (perItem) return 'items';
    return 'site';
  }

  /** Months that have started, as {y, m} with m 0-11. A future month is left out. */
  function monthsFor(o) {
    var y = parseInt(o.year, 10), today = str(o.today);
    var list = o.period === 'year' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] : [parseInt(o.month, 10)];
    return list.filter(function (m) { return m >= 0 && m < 12 && isoDay(y, m, 1) <= today; })
      .map(function (m) { return { y: y, m: m, ym: ymOf(y, m) }; });
  }

  /** How far to shrink a page so it fits one sheet. 1 means it already fits. */
  function zoomFor(scrollPx, pageMm) {
    var max = (pageMm || PAGE_H) * 96 / 25.4;
    if (!(scrollPx > max)) return 1;
    return Math.floor(max / scrollPx * 1000) / 1000;
  }

  function dogName(ctx, id) {
    id = str(id);
    if (!id) return '';
    var n = ctx.dogName ? ctx.dogName(id) : '';
    return n || 'Dog not on the current list';
  }
  function areaName(ctx, id) {
    id = str(id);
    if (!id) return '';
    var n = ctx.areaName ? ctx.areaName(id) : '';
    return n || 'Room not on the list';
  }
  function itemName(ctx, id) {
    id = str(id);
    if (!id) return '';
    var n = ctx.itemName ? ctx.itemName(id) : '';
    return n || 'Item not on the list';
  }
  function litterName(ctx, id) {
    id = str(id);
    if (!id) return '';
    var n = ctx.litterName ? ctx.litterName(id) : '';
    return n || 'Litter not on the list';
  }

  function rowsOf(ctx, file) {
    var t = (ctx && ctx.tables) || {};
    return (t[file] || []).concat(t[file.replace(/\.csv$/, '-Archive.csv')] || []);
  }

  /* ---- catalogue ------------------------------------------------------- */

  var CHECK_PRINT = 'Compliance > Yearly print. Also: Compliance > Daily records > Print / PDF (the calendars), and Compliance > Checks register > Print / PDF';
  var CHECK_CSV = 'Compliance > Yearly print > Download CSV. The Checks register Download CSV is the one-month table';

  function checkSources(ctx) {
    var today = str(ctx.today), by = {}, out = [];
    (ctx.types || []).forEach(function (t) {
      if (!t || !str(t.type_key) || !str(t.id)) return;
      if (str(t.type_key).toLowerCase() === 'medicine') return;   // the medicines register prints these, with dose and dog
      var k = str(t.type_key);
      (by[k] = by[k] || []).push(t);
    });
    Object.keys(by).sort().forEach(function (k) {
      var rows = by[k], best = null;
      rows.forEach(function (r) {
        if (r.effective_from && r.effective_from <= today && (!best || r.effective_from > best.effective_from)) best = r;
      });
      var t = best || rows[rows.length - 1];
      var label = str(t.label);
      if (!label || /_/.test(label)) label = human(label || k);
      var layout = layoutOf(t);
      out.push({
        id: 'check:' + k, kind: 'check', typeKey: k, label: label, group: human(t.group) || (layout === 'list' ? 'Other checks' : 'Daily checks'),
        table: 'BLD-check_log.csv', layout: layout, type: t, typeIds: rows.map(function (r) { return str(r.id); }),
        printPath: CHECK_PRINT, exportPath: CHECK_CSV
      });
    });
    return out;
  }

  function fixedSources() {
    function src(id, label, group, file, layout, printPath, exportPath) {
      return { id: id, kind: 'table', label: label, group: group, table: file, layout: layout || 'list', printPath: printPath, exportPath: exportPath };
    }
    var yp = 'Compliance > Yearly print';
    var csv = 'Compliance > Yearly print > Download CSV';
    return [
      src('medicines', 'Medicines register', 'Medicines', 'BLD-dispense.csv + BLD-check_log.csv (type medicine)', 'meds',
        'Compliance > Medicines register (one month or whole year), and Compliance > Yearly print',
        'Compliance > Medicines register > Download CSV (one month or whole year), and Compliance > Yearly print > Download CSV'),
      src('microchip', 'Microchip register', 'Dog records', 'BLD-microchip.csv', 'list', yp, csv),
      src('microchip_registration', 'Microchip registration', 'Dog records', 'BLD-microchip_registration.csv', 'list', yp, csv),
      src('fit_to_breed', 'Fit to breed', 'Dog records', 'BLD-fit_to_breed.csv', 'list', yp, csv),
      src('weight', 'Weights', 'Dog records', 'BLD-weight.csv', 'list', yp, csv),
      src('vaccination', 'Vaccinations', 'Dog records', 'BLD-vaccination.csv', 'list', yp, csv),
      src('health_screen', 'Health screening', 'Dog records', 'BLD-health_screen.csv', 'list', yp, csv),
      src('clinical_note', 'Clinical notes', 'Dog records', 'BLD-clinical_note.csv', 'list', yp, csv),
      src('dna_result', 'DNA results', 'Dog records', 'BLD-dna_result.csv', 'list', yp, csv),
      src('litter', 'Litters', 'Litters and puppies', 'BLD-litter.csv', 'list', yp, csv),
      src('mating', 'Matings', 'Litters and puppies', 'BLD-mating.csv', 'list', yp, csv),
      src('sale', 'Puppy handover and sales', 'Litters and puppies', 'BLD-sale.csv', 'list', yp, csv),
      src('visit', 'Vet visits', 'Visits and findings', 'BLD-visit.csv', 'list', yp, csv),
      src('finding', 'Findings', 'Visits and findings', 'BLD-finding.csv', 'list', yp, csv),
      src('inspection', 'Inspections', 'Visits and findings', 'BLD-inspection.csv', 'list', yp, csv),
      src('deviation', 'Deviations', 'Visits and findings', 'BLD-deviation.csv', 'list', yp, csv),
      src('verification', 'Verifications', 'Visits and findings', 'BLD-verification.csv', 'list', yp, csv),
      src('declaration', 'Declarations', 'Visits and findings', 'BLD-declaration.csv', 'list', yp, csv),
      src('area_reading', 'Room temperatures', 'Temperatures', 'BLD-area_reading.csv', 'list',
        'Compliance > Yearly print, and Compliance > Room temperatures > Temperature history > Print / PDF (the room grid)',
        csv),
      src('outdoor_temp', 'Outdoor temperature', 'Temperatures', 'BLD-outdoor_temp.csv', 'list', yp, csv),
      src('items', 'Items and PAT history', 'Items', 'BLD-check_log.csv (item tests) + BLD-readings.csv', 'list', yp, csv),
      src('occupancy', 'Placements', 'Movements', 'BLD-occupancy.csv', 'list', yp, csv),
      src('stock_level', 'Medicine stock', 'Medicines', 'BLD-stock_level.csv', 'list', yp, csv),
      src('checklist_instance', 'Checklist records', 'Other records', 'BLD-checklist_instance.csv', 'list', yp, csv),
      src('credential', 'External requirements', 'Other records', 'BLD-credential.csv + BLD-credential_version.csv', 'list', yp, csv)
    ];
  }

  function catalogue(ctx) {
    ctx = ctx || {};
    return checkSources(ctx).concat(fixedSources());
  }

  function coverage(ctx) {
    return catalogue(ctx).map(function (s) {
      return { record: s.label, table: s.table, print: s.printPath, export: s.exportPath, layout: s.layout, id: s.id };
    });
  }

  /* ---- check logs ------------------------------------------------------ */

  function standing(logs) {
    var replaced = {};
    (logs || []).forEach(function (r) { if (str(r.corrects_id)) replaced[str(r.corrects_id)] = 1; });
    return (logs || []).filter(function (r) { return !replaced[str(r.id)]; });
  }
  function isNoteFor(r) { return str(r.outcome) === 'note' && !!str(r.note_for_id); }
  function logsFor(source, ctx) {
    var ids = {}, later = {};
    (source.typeIds || []).forEach(function (id) { ids[id] = 1; });
    var rows = standing(ctx.logs || []).filter(function (r) { return ids[str(r.check_type_id)]; });
    rows.forEach(function (r) { if (isNoteFor(r)) (later[str(r.note_for_id)] = later[str(r.note_for_id)] || []).push(r); });
    return rows.filter(function (r) { return !isNoteFor(r); }).map(function (r) {
      var extra = (later[str(r.id)] || []).map(function (n) { return clean(n.note); }).filter(Boolean);
      var note = [clean(r.note)].concat(extra).filter(Boolean).join(' ');
      var w = london(r.happened_at || r.taken_at);
      return { row: r, date: w.date, time: str(r.time_given).toLowerCase() === 'false' ? '' : w.time, note: note, outcome: str(r.outcome).toLowerCase() };
    });
  }

  function markOf(list, required) {
    if (!list.length) return required ? 'miss' : '';
    var outs = list.map(function (l) { return l.outcome; });
    if (outs.indexOf('concern') >= 0) return 'concern';
    if (outs.indexOf('part_done') >= 0) return 'part';
    if (outs.some(function (o) { return o === 'ok' || o === 'done' || o === 'recorded' || o === ''; })) return 'tick';
    if (outs.every(function (o) { return o === 'not_done'; })) return 'miss';
    return 'tick';
  }

  function expectedDog(type, dog) {
    if (!dog.onSite) return false;
    var never = listOf(type.not_in_areas);
    if (dog.area_id && never.indexOf(dog.area_id) >= 0) return false;
    var only = listOf(type.only_in_areas);
    if (only.length && only.indexOf(dog.area_id || '') < 0) return false;
    return true;
  }

  /** One month grid: {rows:[{id,name,expected}], days:[iso], marks:{rowId:{iso:mark}}, notes:[text]}. */
  function gridMonth(source, ym, ctx) {
    var type = source.type || {}, mine = logsFor(source, ctx).filter(function (l) { return l.date && l.date.slice(0, 7) === ym; });
    var y = parseInt(ym.slice(0, 4), 10), m = parseInt(ym.slice(5, 7), 10) - 1, n = daysIn(y, m), days = [];
    for (var d = 1; d <= n; d++) days.push(isoDay(y, m, d));
    var axis = source.layout, byId = {}, order = [];
    function add(id, name, expected, dob) {
      if (!id || byId[id]) { if (id && byId[id] && expected) byId[id].expected = true; return; }
      byId[id] = { id: id, name: name, expected: !!expected, dob: dob || '' };
      order.push(id);
    }
    if (axis === 'dogs') {
      (ctx.dogs || []).forEach(function (dog) { if (expectedDog(type, dog)) add(dog.id, dog.name || dogName(ctx, dog.id), true, dog.dob); });
      mine.forEach(function (l) { var id = str(l.row.subject_id); if (id) add(id, dogName(ctx, id), false, ''); });
    } else if (axis === 'areas') {
      (ctx.areas || []).forEach(function (a) { if (a.onSite) add(a.id, a.name || areaName(ctx, a.id), true, ''); });
      mine.forEach(function (l) { var id = str(l.row.area_id); if (id) add(id, areaName(ctx, id), false, ''); });
    } else if (axis === 'items') {
      (ctx.items || []).forEach(function (it) { if (it.onSite) add(it.id, it.name || itemName(ctx, it.id), true, ''); });
      mine.forEach(function (l) { var id = str(l.row.item_id); if (id) add(id, itemName(ctx, id), false, ''); });
    } else {
      add('site', 'Whole site', true, '');
    }
    order.sort(function (a, b) { return byId[a].name < byId[b].name ? -1 : byId[a].name > byId[b].name ? 1 : 0; });
    var from = str(type.effective_from), today = str(ctx.today), marks = {}, notes = [];
    order.forEach(function (id) {
      marks[id] = {};
      days.forEach(function (iso) {
        var hit = mine.filter(function (l) {
          if (l.date !== iso) return false;
          if (axis === 'dogs') return str(l.row.subject_id) === id;
          if (axis === 'areas') return str(l.row.area_id) === id;
          if (axis === 'items') return str(l.row.item_id) === id;
          return true;
        });
        var born = byId[id].dob && iso < String(byId[id].dob).slice(0, 10);
        var required = byId[id].expected && !born && iso <= today && (!from || iso >= from);
        var mark = markOf(hit, required);
        marks[id][iso] = mark;
        hit.forEach(function (l) {
          if ((l.outcome === 'concern' || l.outcome === 'part_done' || l.outcome === 'not_done') && l.note) {
            notes.push(ymd(iso) + ' \u00b7 ' + byId[id].name + ' \u00b7 ' + (RESULT[l.outcome] || l.outcome) + ' \u00b7 ' + l.note);
          }
        });
      });
    });
    return { rows: order.map(function (id) { return byId[id]; }), days: days, marks: marks, notes: notes };
  }

  function checkLine(l, ctx) {
    var r = l.row;
    var what = [r.subject_id ? dogName(ctx, r.subject_id) : '', r.area_id ? areaName(ctx, r.area_id) : '', r.litter_id ? litterName(ctx, r.litter_id) : '', r.item_id ? itemName(ctx, r.item_id) : '', clean(r.item), clean(r.amount)].filter(Boolean).join(', ');
    return { date: l.date, time: l.time, what: what || 'Whole site', who: who(r.taken_by), outcome: RESULT[l.outcome] || l.outcome || '', note: l.note };
  }

  /* ---- other tables ---------------------------------------------------- */

  var LIST5 = [['date', 'Date'], ['what', 'What'], ['who', 'Who'], ['outcome', 'Outcome'], ['note', 'Note']];

  function looseLine(row, ctx) {
    var w = dateOf(row);
    var bits = [];
    ['item', 'product', 'product_shorthand', 'test', 'kind', 'event_kind', 'label', 'wording_as_given', 'what_happened', 'title', 'name', 'marker_code', 'genotype', 'method', 'diseases_covered'].forEach(function (k) {
      if (secretKey(k)) return;
      var v = clean(row[k]); if (v && bits.indexOf(v) < 0) bits.push(v);
    });
    var whoV = who(pick(row, ['taken_by', 'given_by', 'recorded_by', 'administered_by', 'verified_by', 'noticed_by', 'set_by', 'vet_name', 'practice']));
    var outcome = clean(pick(row, ['outcome', 'result', 'grade', 'status', 'state', 'interpretation']));
    var note = clean(pick(row, ['note', 'notes', 'mitigation_note', 'reason', 'action_taken', 'action_agreed', 'source_text', 'outcome_summary']));
    var what = [row.subject_id ? dogName(ctx, row.subject_id) : '', row.dam_subject_id ? dogName(ctx, row.dam_subject_id) : '', row.area_id ? areaName(ctx, row.area_id) : '', row.item_id ? itemName(ctx, row.item_id) : ''].concat(bits).filter(Boolean).join(', ');
    return { date: w.date, time: w.time, what: what, who: whoV, outcome: outcome, note: note, _undated: !w.date };
  }

  function tableLines(source, ctx) {
    var id = source.id, rows = [];
    if (id === 'items') return itemLines(ctx);
    if (id === 'credential') return credentialLines(ctx);
    if (id === 'microchip') rows = rowsOf(ctx, 'BLD-microchip.csv');
    else if (id === 'microchip_registration') rows = rowsOf(ctx, 'BLD-microchip_registration.csv');
    else if (id === 'fit_to_breed') rows = rowsOf(ctx, 'BLD-fit_to_breed.csv');
    else if (id === 'weight') rows = rowsOf(ctx, 'BLD-weight.csv');
    else if (id === 'vaccination') rows = rowsOf(ctx, 'BLD-vaccination.csv');
    else if (id === 'health_screen') rows = rowsOf(ctx, 'BLD-health_screen.csv');
    else if (id === 'clinical_note') rows = rowsOf(ctx, 'BLD-clinical_note.csv');
    else if (id === 'dna_result') rows = rowsOf(ctx, 'BLD-dna_result.csv');
    else if (id === 'litter') rows = rowsOf(ctx, 'BLD-litter.csv');
    else if (id === 'mating') rows = rowsOf(ctx, 'BLD-mating.csv');
    else if (id === 'sale') rows = rowsOf(ctx, 'BLD-sale.csv');
    else if (id === 'visit') rows = rowsOf(ctx, 'BLD-visit.csv');
    else if (id === 'finding') rows = rowsOf(ctx, 'BLD-finding.csv');
    else if (id === 'inspection') rows = rowsOf(ctx, 'BLD-inspection.csv');
    else if (id === 'deviation') rows = rowsOf(ctx, 'BLD-deviation.csv');
    else if (id === 'verification') rows = rowsOf(ctx, 'BLD-verification.csv');
    else if (id === 'declaration') rows = rowsOf(ctx, 'BLD-declaration.csv');
    else if (id === 'area_reading') rows = rowsOf(ctx, 'BLD-area_reading.csv');
    else if (id === 'outdoor_temp') rows = rowsOf(ctx, 'BLD-outdoor_temp.csv');
    else if (id === 'occupancy') rows = rowsOf(ctx, 'BLD-occupancy.csv');
    else if (id === 'stock_level') rows = rowsOf(ctx, 'BLD-stock_level.csv');
    else if (id === 'checklist_instance') rows = rowsOf(ctx, 'BLD-checklist_instance.csv');
    return rows.map(function (r) { return shaped(id, r, ctx); });
  }

  function shaped(id, r, ctx) {
    var base = looseLine(r, ctx);
    if (id === 'microchip') {
      base.what = [dogName(ctx, r.subject_id), pick(r, ['chip_number', 'number', 'chip', 'microchip_number'])].filter(Boolean).join(', ');
      base.outcome = pick(r, ['status', 'state']);
    } else if (id === 'microchip_registration') {
      /* The registration row points at a chip (microchip_id). The number and the dog live on that chip row. */
      var chip = null;
      rowsOf(ctx, 'BLD-microchip.csv').forEach(function (c) { if (str(c.id) === str(r.microchip_id)) chip = c; });
      var wreg = london(r.registered_on || r.from_date);
      base.date = wreg.date; base.time = wreg.time; base._undated = !wreg.date;
      var sid = str(r.subject_id) || (chip ? str(chip.subject_id) : '');
      var num = pick(r, ['chip_number', 'number', 'chip', 'microchip_number']) || (chip ? pick(chip, ['chip_number', 'number', 'chip', 'microchip_number']) : '');
      base.what = [sid ? dogName(ctx, sid) : '', num, pick(r, ['registry', 'database', 'registered_with'])].filter(Boolean).join(', ');
      base.outcome = pick(r, ['status', 'state']);
    } else if (id === 'health_screen') {
      base.what = [dogName(ctx, r.subject_id), pick(r, ['test', 'screen'])].filter(Boolean).join(', ');
      base.outcome = pick(r, ['grade', 'result']);
      base.who = who(pick(r, ['attributed_to', 'taken_by']));
      base.note = [pick(r, ['certainty']), pick(r, ['source_text', 'note', 'notes'])].filter(Boolean).join(' ');
    } else if (id === 'fit_to_breed') {
      var w = london(r.assessed_on || r.done_on);
      base.date = w.date; base.time = w.time; base._undated = !w.date;
      base.what = [dogName(ctx, r.subject_id), pick(r, ['vet_name', 'vet'])].filter(Boolean).join(', ');
      base.outcome = pick(r, ['outcome', 'result']);
      base.note = [pick(r, ['note', 'notes']), pick(r, ['valid_until']) ? 'valid until ' + pick(r, ['valid_until']) : ''].filter(Boolean).join(' ');
    } else if (id === 'weight') {
      var kg = pick(r, ['weight_kg', 'kg']), unit = pick(r, ['unit']) || 'kg';
      base.what = dogName(ctx, r.subject_id);
      base.outcome = kg ? (kg + (kg.indexOf(unit) < 0 ? ' ' + unit : '')) : '';
      base.note = [pick(r, ['body_condition_score']) ? 'condition ' + pick(r, ['body_condition_score']) : '', pick(r, ['note', 'notes'])].filter(Boolean).join(' ');
    } else if (id === 'vaccination') {
      base.what = [dogName(ctx, r.subject_id), pick(r, ['product_shorthand', 'product']), pick(r, ['diseases_covered'])].filter(Boolean).join(', ');
      base.who = who(pick(r, ['administered_by', 'practice', 'taken_by']));
      base.note = [pick(r, ['note', 'notes']), str(r.voided_on) ? 'voided ' + str(r.voided_on) : '', pick(r, ['next_due_on_card']) ? 'next due ' + pick(r, ['next_due_on_card']) : ''].filter(Boolean).join(' ');
    } else if (id === 'litter') {
      var bw = london(r.born_on || r.whelped_on);
      base.date = bw.date; base.time = ''; base._undated = !bw.date;
      base.what = ['dam ' + dogName(ctx, r.dam_subject_id), r.sire_subject_id ? 'sire ' + dogName(ctx, r.sire_subject_id) : ''].filter(Boolean).join(', ');
      base.note = pick(r, ['notes', 'note']);
    } else if (id === 'mating') {
      base.what = ['dam ' + dogName(ctx, r.dam_subject_id), r.sire_subject_id ? 'sire ' + dogName(ctx, r.sire_subject_id) : '', pick(r, ['method'])].filter(Boolean).join(', ');
      base.note = [pick(r, ['notes', 'note']), pick(r, ['due_from_this_mating']) ? 'due ' + pick(r, ['due_from_this_mating']) : ''].filter(Boolean).join(' ');
    } else if (id === 'area_reading') {
      var rw = london(r.period_start || r.taken_at);
      base.date = rw.date; base.time = rw.time; base._undated = !rw.date;
      base.what = [areaName(ctx, r.area_id), (pick(r, ['min_c']) || pick(r, ['min_temp'])) ? (pick(r, ['min_c']) || pick(r, ['min_temp'])) + '\u2013' + (pick(r, ['max_c']) || pick(r, ['max_temp']) || '') + ' \u00b0C' : '', pick(r, ['spot_c']) ? 'bed ' + pick(r, ['spot_c']) : ''].filter(Boolean).join(', ');
      base.who = who(r.taken_by);
      base.outcome = str(r.room_empty).toLowerCase() === 'true' ? 'room empty' : (str(r.in_range).toLowerCase() === 'false' || str(r.compliant).toLowerCase() === 'false' ? 'outside' : '');
      base.note = pick(r, ['mitigation_note', 'note']);
    } else if (id === 'outdoor_temp') {
      base.what = [pick(r, ['min_temp']), pick(r, ['max_temp'])].filter(Boolean).join('\u2013') + (pick(r, ['min_temp']) || pick(r, ['max_temp']) ? ' \u00b0C' : '');
      base.outcome = pick(r, ['reading_kind', 'kind']);
      base.note = pick(r, ['phrase', 'note']);
    } else if (id === 'visit') {
      if (str(r.status).toLowerCase() === 'booked' || str(r.status).toLowerCase() === 'cancelled') base._skip = true;
      base.what = [dogName(ctx, r.subject_id), pick(r, ['kind']), pick(r, ['start_time'])].filter(Boolean).join(', ');
      base.outcome = pick(r, ['status']);
      base.note = pick(r, ['reason', 'note', 'notes']);
    } else if (id === 'occupancy') {
      base.what = [dogName(ctx, r.subject_id), areaName(ctx, r.area_id)].filter(Boolean).join(', ');
      base.note = [pick(r, ['moved_out']) ? 'moved out ' + pick(r, ['moved_out']) : '', pick(r, ['classification_note', 'note'])].filter(Boolean).join(' ');
    } else if (id === 'sale') {
      base.what = dogName(ctx, r.subject_id);
      base.outcome = [str(r.seen_with_dam) ? 'seen with dam ' + str(r.seen_with_dam) : '', str(r.vet_record_given) ? 'vet record ' + str(r.vet_record_given) : ''].filter(Boolean).join(', ');
      base.note = pick(r, ['notes', 'note']);
    }
    return base;
  }

  function itemLines(ctx) {
    var types = {};
    (ctx.types || []).forEach(function (t) { types[str(t.id)] = t; });
    var readings = {};
    var replacedReading = {};
    rowsOf(ctx, 'BLD-readings.csv').forEach(function (r) { if (str(r.corrects_id)) replacedReading[str(r.corrects_id)] = 1; });
    rowsOf(ctx, 'BLD-readings.csv').forEach(function (r) {
      if (replacedReading[str(r.id)]) return;
      var id = str(r.check_log_id);
      if (!id) return;
      var bit = [clean(r.label || r.key), clean(r.value), clean(r.unit)].filter(Boolean).join(' ');
      if (bit) (readings[id] = readings[id] || []).push(bit);
    });
    return logsFor({ typeIds: Object.keys(types) }, ctx)
      .filter(function (l) { return str(l.row.item_id) || (types[str(l.row.check_type_id)] && types[str(l.row.check_type_id)].target === 'item'); })
      .map(function (l) {
        var line = checkLine(l, ctx);
        var rd = (readings[str(l.row.id)] || []).join('; ');
        if (rd) line.note = [line.note, rd].filter(Boolean).join(' ');
        var t = types[str(l.row.check_type_id)];
        if (t && str(t.label)) line.what = [itemName(ctx, l.row.item_id), str(t.label)].filter(Boolean).join(', ');
        return line;
      });
  }

  function credentialLines(ctx) {
    var cred = {};
    rowsOf(ctx, 'BLD-credential.csv').forEach(function (r) { if (!secretKey('label')) cred[str(r.id)] = r; });
    var vers = rowsOf(ctx, 'BLD-credential_version.csv');
    if (!vers.length) return rowsOf(ctx, 'BLD-credential.csv').map(function (r) { return looseLine(r, ctx); });
    return vers.map(function (r) {
      var c = cred[str(r.credential_id)] || {};
      var line = looseLine(r, ctx);
      var w = london(r.from_date);
      line.date = w.date; line._undated = !w.date;
      line.what = [clean(c.label), r.area_id ? areaName(ctx, c.area_id || r.area_id) : ''].filter(Boolean).join(', ');
      line.note = [pick(r, ['to_date']) ? 'until ' + pick(r, ['to_date']) : '', pick(r, ['source'])].filter(function (x) { return x && !SECRET.test(x); }).join(' ');
      return line;
    });
  }

  function columnsFor(source) {
    if (source.kind === 'meds') return null;   // the medicines register supplies its own
    return LIST5;
  }

  /* ---- pages ----------------------------------------------------------- */

  function head(kennel, title, sub) {
    return '<div class="yp-head"><b>' + e(kennel || 'Kennel not recorded') + ' \u00b7 ' + e(title) + '</b><span>' + e(sub) + '</span></div>';
  }
  function foot(printed) {
    return '<div class="yp-foot"><span>Printed ' + e(printed || '') + '</span><span>Checked by ______________________ &nbsp; Signed ______________________</span></div>';
  }
  function pageOpen(source, ym, layout) {
    return '<section class="yp-page" data-yp-page data-yp-id="' + e(source.id) + '" data-month="' + e(ym) + '" data-layout="' + e(layout) + '">';
  }

  function gridHtml(source, g, ctx) {
    var counts = { tick: 0, part: 0, concern: 0, miss: 0 };
    var colW = (PAGE_W - 36) / Math.max(1, g.days.length);
    var rowH = (BODY_H - 12) / Math.max(1, g.rows.length + 1);
    var fs = Math.max(4.5, Math.min(8, colW * 3.78 / 1.4, rowH * 3.78 / 1.3));
    var h = '<p class="yp-key"><i class="yk tick">' + MARK.tick + '</i> done <i class="yk part">' + MARK.part + '</i> part <i class="yk concern">' + MARK.concern + '</i> concern <i class="yk miss">' + MARK.miss + '</i> missed</p>';
    if (!g.rows.length) return h + '<p>No dogs, rooms or items to list for this month.</p>';
    h += '<table class="yp-t" style="--fs:' + fs.toFixed(2) + 'px"><thead><tr><th>' + (source.layout === 'dogs' ? 'Dog' : source.layout === 'areas' ? 'Area' : source.layout === 'items' ? 'Item' : '') + '</th>';
    g.days.forEach(function (iso) { h += '<th>' + Number(iso.slice(8)) + '</th>'; });
    h += '</tr></thead><tbody>';
    g.rows.forEach(function (row) {
      h += '<tr><th>' + e(row.name) + '</th>';
      g.days.forEach(function (iso) {
        var mark = (g.marks[row.id] || {})[iso] || '';
        if (counts[mark] != null) counts[mark]++;
        h += '<td class="m-' + (mark || 'blank') + '" data-day="' + e(iso) + '" data-mark="' + e(mark) + '">' + (MARK[mark] || '') + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table>';
    h += '<p class="yp-tot" data-yp-totals>Done <b>' + counts.tick + '</b> \u00b7 part <b>' + counts.part + '</b> \u00b7 concern <b>' + counts.concern + '</b> \u00b7 missed <b>' + counts.miss + '</b></p>';
    if (g.notes.length) h += '<ul class="yp-notes">' + g.notes.map(function (n) { return '<li>' + e(n) + '</li>'; }).join('') + '</ul>';
    return h;
  }

  function listHtml(cols, lines, cell) {
    if (!lines.length) return '';
    var h = '<table class="yp-list"><thead><tr>' + cols.map(function (c) { return '<th scope="col">' + e(c[1]) + '</th>'; }).join('') + '</tr></thead><tbody>';
    lines.forEach(function (l) {
      h += '<tr>' + cols.map(function (c) {
        var v = cell ? cell(l, c[0]) : (l[c[0]] || '');
        return '<td>' + e(v) + '</td>';
      }).join('') + '</tr>';
    });
    return h + '</tbody></table>';
  }

  function showLine(l) {
    var d = l.date && /^\d{4}-\d{2}-\d{2}$/.test(l.date) ? ymd(l.date) : (l.date || '');
    return { date: d + (l.time ? ' ' + l.time : ''), what: l.what || '', who: l.who || '', outcome: l.outcome || '', note: l.note || '' };
  }
  function listPage(source, ym, lines, ctx, cols, cell) {
    var title = monthWords(ym);
    var shown = cell ? lines : lines.map(showLine);
    var body = lines.length ? listHtml(cols, shown, cell) : '<p>No records in ' + e(title) + '.</p>';
    var n = '<p class="yp-tot" data-yp-totals>Entries <b>' + lines.length + '</b></p>';
    return pageOpen(source, ym, 'list') + head(ctx.kennel, source.label, title) + body + n + foot(ctx.printed) + '</section>';
  }

  /**
   * The pages for a choice: {period:'month'|'year', year, month:0-11, ids:[source id], today}.
   * ctx: kennel, printed, today, types, logs, tables, dogs, areas, items, dogName, areaName, itemName, litterName,
   *      meds: function(ym) -> {columns, lines, cell} | null
   */
  function build(choice, ctx) {
    ctx = ctx || {}; choice = choice || {};
    ctx.today = str(choice.today || ctx.today);
    var cat = catalogue(ctx), want = {}, pages = [], html = '';
    (choice.ids || []).forEach(function (id) { want[id] = 1; });
    var sources = cat.filter(function (s) { return want[s.id]; });
    var months = monthsFor({ period: choice.period, year: choice.year, month: choice.month, today: ctx.today });
    if (!sources.length || !months.length) {
      html = '<section class="yp-page" data-yp-page data-layout="empty"><p>Nothing to print for that choice.</p></section>';
      return { html: html, pages: [{ id: '', month: '', layout: 'empty', html: html }] };
    }
    sources.forEach(function (source) {
      if (source.kind === 'check' && source.layout !== 'list') {
        months.forEach(function (mo) {
          var g = gridMonth(source, mo.ym, ctx);
          var one = pageOpen(source, mo.ym, source.layout) + head(ctx.kennel, source.label, monthWords(mo.ym)) + gridHtml(source, g, ctx) + foot(ctx.printed) + '</section>';
          pages.push({ id: source.id, month: mo.ym, layout: source.layout, html: one });
          html += one;
        });
        return;
      }
      if (source.id === 'medicines') {
        months.forEach(function (mo) {
          var pack = ctx.meds ? ctx.meds(mo.ym) : null;
          var cols = pack && pack.columns ? pack.columns : LIST5;
          var lines = pack && pack.lines ? pack.lines : [];
          var one = listPage(source, mo.ym, lines, ctx, cols, pack && pack.cell);
          pages.push({ id: source.id, month: mo.ym, layout: 'meds', html: one });
          html += one;
        });
        return;
      }
      var all = source.kind === 'check' ? logsFor(source, ctx).map(function (l) { return checkLine(l, ctx); }) : tableLines(source, ctx).filter(function (l) { return !l._skip; });
      var dated = [], undated = [];
      all.forEach(function (l) { if (l._undated || !l.date) undated.push(l); else dated.push(l); });
      months.forEach(function (mo) {
        var lines = dated.filter(function (l) { return l.date.slice(0, 7) === mo.ym; });
        lines.sort(function (a, b) { return (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1; });
        var one = listPage(source, mo.ym, lines, ctx, columnsFor(source), null);
        pages.push({ id: source.id, month: mo.ym, layout: 'list', html: one });
        html += one;
      });
      if (undated.length) {
        var u = pageOpen(source, 'undated', 'list') + head(ctx.kennel, source.label, 'No date on the record')
          + listHtml(columnsFor(source), undated.map(showLine), null)
          + '<p class="yp-tot" data-yp-totals>Entries <b>' + undated.length + '</b></p>' + foot(ctx.printed) + '</section>';
        pages.push({ id: source.id, month: 'undated', layout: 'list', html: u });
        html += u;
      }
    });
    return { html: html, pages: pages };
  }

  /* ---- CSV ------------------------------------------------------------- */

  function csvCell(v) {
    v = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function csvRow(cells) { return cells.map(csvCell).join(','); }

  function linesOf(source, ctx, choice) {
    var months = monthsFor(choice), allow = {};
    months.forEach(function (mo) { allow[mo.ym] = 1; });
    var year = choice.period === 'year';
    function keep(l) {
      if (l._skip) return false;
      if (!l.date) return true;   // a chip number or a grade with no date is still part of the export
      return !!allow[l.date.slice(0, 7)];
    }
    if (source.id === 'medicines') {
      var cols = null, lines = [];
      months.forEach(function (mo) {
        var pack = ctx.meds ? ctx.meds(mo.ym) : null;
        if (pack) { cols = pack.columns; (pack.lines || []).forEach(function (l) { lines.push({ pack: pack, line: l }); }); }
      });
      return { columns: cols || LIST5, lines: lines, meds: true };
    }
    if (source.kind === 'check' && source.layout !== 'list') {
      var flat = [];
      months.forEach(function (mo) {
        var g = gridMonth(source, mo.ym, ctx);
        g.rows.forEach(function (row) {
          g.days.forEach(function (iso) {
            var mark = (g.marks[row.id] || {})[iso] || '';
            if (!mark) return;
            flat.push({ date: iso, what: row.name, who: '', outcome: { tick: 'done', part: 'part done', concern: 'concern', miss: 'missed' }[mark] || mark, note: '' });
          });
        });
      });
      return { columns: LIST5, lines: flat, meds: false };
    }
    var all = source.kind === 'check' ? logsFor(source, ctx).map(function (l) { return checkLine(l, ctx); }) : tableLines(source, ctx);
    return { columns: columnsFor(source), lines: all.filter(keep), meds: false };
  }

  function toCsv(choice, ctx) {
    ctx = ctx || {}; choice = choice || {};
    ctx.today = str(choice.today || ctx.today);
    var cat = catalogue(ctx), want = {};
    (choice.ids || []).forEach(function (id) { want[id] = 1; });
    var sources = cat.filter(function (s) { return want[s.id]; });
    var period = choice.period === 'year' ? String(choice.year) : ymOf(parseInt(choice.year, 10), parseInt(choice.month, 10));
    var blocks = [];
    sources.forEach(function (source) {
      var got = linesOf(source, ctx, choice);
      var head = [
        [source.label, str(ctx.kennel) || 'Kennel not recorded'],
        ['Period', choice.period === 'year' ? String(choice.year) : monthWords(period)],
        ['Printed', str(ctx.printed)],
        ['Missing details', 'left blank; nothing is filled in or guessed']
      ];
      var cols = got.columns;
      var body = [cols.map(function (c) { return c[1]; })];
      got.lines.forEach(function (l) {
        if (got.meds) body.push(cols.map(function (c) { return l.pack.cell ? l.pack.cell(l.line, c[0]) : (l.line[c[0]] || ''); }));
        else body.push(cols.map(function (c) { return c[0] === 'date' && l.date ? l.date : (l[c[0]] || ''); }));
      });
      blocks.push(head.concat([[]]).concat(body));
    });
    if (!blocks.length) blocks.push([['Yearly print', ''], ['Period', ''], [], ['Nothing to export']]);
    var text = blocks.map(function (rows) { return rows.map(csvRow).join('\r\n'); }).join('\r\n\r\n');
    return '\ufeff' + text + '\r\n';
  }

  function fileName(choice) {
    var period = choice.period === 'year' ? String(choice.year) : ymOf(parseInt(choice.year, 10), parseInt(choice.month, 10));
    var slug = (choice.ids || []).length === 1 ? String(choice.ids[0]).replace(/^check:/, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() : 'records';
    return 'yearly-' + (slug || 'records') + '-' + period + '.csv';
  }

  /* ---- screen (existing card, button and field classes only) ---------- */

  function presetIds(sub, cat, ctx) {
    sub = str(sub);
    if (sub === 'cal') {
      var keys = ctx.calKeys || [];
      return cat.filter(function (s) { return s.typeKey && keys.indexOf(s.typeKey) >= 0; }).map(function (s) { return s.id; });
    }
    if (sub === 'checks') return cat.filter(function (s) { return s.kind === 'check'; }).map(function (s) { return s.id; });
    if (sub) {
      var hit = cat.filter(function (s) { return (s.typeIds || []).indexOf(sub) >= 0; });
      if (hit.length) return hit.map(function (s) { return s.id; });
    }
    return [];
  }

  function screenHtml(ctx) {
    ctx = ctx || {};
    var cat = catalogue(ctx), preset = {}, today = str(ctx.today) || '2026-01-01';
    presetIds(ctx.preset, cat, ctx).forEach(function (id) { preset[id] = 1; });
    var y = parseInt(today.slice(0, 4), 10), m = parseInt(today.slice(5, 7), 10) - 1;
    var years = [];
    for (var i = 0; i < 6; i++) years.push(y - i);
    var groups = [], by = {};
    cat.forEach(function (s) { if (!by[s.group]) { by[s.group] = []; groups.push(s.group); } by[s.group].push(s); });
    var h = '<h2>Yearly print</h2><p class="sub help">One A4 landscape page for each month of each record, to save as a PDF. A daily check is a grid. Anything recorded now and then is a list. Nothing on this page is saved.</p>';
    h += '<div class="card"><div class="frow"><label for="ypPeriod">Period</label> <select id="ypPeriod" aria-label="Period"><option value="month" selected>One month</option><option value="year">Whole year</option></select> ';
    h += '<label for="ypMonth">Month</label> <select id="ypMonth" aria-label="Month">' + MON.map(function (name, i) { return '<option value="' + i + '"' + (i === m ? ' selected' : '') + '>' + name + '</option>'; }).join('') + '</select> ';
    h += '<label for="ypYear">Year</label> <select id="ypYear" aria-label="Year">' + years.map(function (yy) { return '<option value="' + yy + '"' + (yy === y ? ' selected' : '') + '>' + yy + '</option>'; }).join('') + '</select></div>';
    h += '<div class="frow"><button type="button" class="btn" id="ypPrint">Print / PDF</button> <button type="button" class="btn" id="ypCsv">Download CSV</button> <button type="button" class="btn" id="ypAll">All records</button> <button type="button" class="btn" id="ypNone">None</button></div>';
    h += '<p class="mut" id="ypMsg" aria-live="polite">In the print window choose Save as PDF.</p></div>';
    groups.forEach(function (g) {
      h += '<section class="card"><h3>' + e(g) + '</h3><div class="frow">';
      by[g].forEach(function (s) {
        h += '<label><input type="checkbox" name="ypType" value="' + e(s.id) + '"' + (preset[s.id] ? ' checked' : '') + '> ' + e(s.label) + '</label> ';
      });
      h += '</div>';
      if (g === 'Temperatures') h += '<p class="mut">The room-by-room temperature grid stays on <a href="./history.html#report">Temperature history</a>.</p>';
      h += '</section>';
    });
    return h;
  }

  var CSS = '#ypReport{display:none}#ypReport.yp-measure{display:block;position:absolute;left:-10000px;top:0;width:281mm}'
    + '#ypReport{color:var(--ink);font:9px/1.25 system-ui,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    + '#ypReport .yp-page{width:281mm;box-sizing:border-box;overflow:hidden}'
    + '#ypReport .yp-head{display:flex;justify-content:space-between;gap:8px;font-size:13px;border-bottom:1px solid var(--ink);margin-bottom:4px}'
    + '#ypReport .yp-foot{display:flex;justify-content:space-between;gap:8px;margin-top:6px;font-size:8px}'
    + '#ypReport .yp-key{margin:2px 0 4px}#ypReport .yp-tot{margin:4px 0}#ypReport .yp-notes{margin:2px 0 0 14px;padding:0}'
    + '#ypReport .yp-t,#ypReport .yp-list{width:100%;border-collapse:collapse;table-layout:fixed}'
    + '#ypReport .yp-t th,#ypReport .yp-t td,#ypReport .yp-list th,#ypReport .yp-list td{border:0.5px solid var(--line);padding:0 1px;text-align:center;font-size:var(--fs,7px);line-height:1.2;white-space:nowrap;overflow:hidden}'
    + '#ypReport .yp-list td,#ypReport .yp-list th{text-align:left;white-space:normal;font-size:8px;padding:2px 3px;vertical-align:top}'
    + '#ypReport .yp-t tbody th{text-align:left;font-size:7px;width:32mm}'
    + '#ypReport td.m-tick{background:var(--ljr-5);color:var(--paper);font-weight:700}'
    + '#ypReport td.m-part{outline:1.5px solid var(--ljr-3);outline-offset:-1.5px;font-weight:700}'
    + '#ypReport td.m-concern{background:var(--ljr-3);color:var(--ink);font-weight:700}'
    + '#ypReport td.m-miss{outline:1.5px solid var(--ljr-2-text);outline-offset:-1.5px;font-weight:700}'
    + '#ypReport .yk{display:inline-block;width:12px;text-align:center;font-style:normal}'
    + '#ypReport .yk.tick{background:var(--ljr-5);color:var(--paper)}#ypReport .yk.part{outline:1.5px solid var(--ljr-3)}#ypReport .yk.concern{background:var(--ljr-3)}#ypReport .yk.miss{outline:1.5px solid var(--ljr-2-text)}'
    + '@media print{@page{size:A4 landscape;margin:8mm}html,body.yp-printing{background:none!important}body.yp-printing>*:not(#ypReport){display:none!important}body.yp-printing #ypReport{display:block}'
    + '#ypReport .yp-page{height:194mm;page-break-after:always;break-after:page;break-inside:avoid}#ypReport .yp-page:last-child{page-break-after:auto;break-after:auto}}';

  function fit(rep) {
    if (!rep || !rep.classList) return;
    rep.classList.add('yp-measure');
    var max = PAGE_H * 96 / 25.4;
    var nodes = rep.querySelectorAll ? rep.querySelectorAll('.yp-page') : [];
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].style.zoom = '';
      var h = nodes[i].scrollHeight;
      if (h > max) nodes[i].style.zoom = zoomFor(h, PAGE_H).toString();
    }
    rep.classList.remove('yp-measure');
  }

  function choiceFrom(root) {
    var periodEl = root.querySelector('#ypPeriod');
    var boxes = root.querySelectorAll('input[name="ypType"]:checked');
    var ids = [];
    for (var i = 0; i < boxes.length; i++) ids.push(boxes[i].value);
    return {
      period: periodEl ? periodEl.value : 'month',
      year: parseInt((root.querySelector('#ypYear') || {}).value, 10),
      month: parseInt((root.querySelector('#ypMonth') || {}).value, 10),
      ids: ids
    };
  }

  return {
    MON: MON, PAGE_W: PAGE_W, PAGE_H: PAGE_H, MARK: MARK, LIST5: LIST5, CSS: CSS,
    layoutOf: layoutOf, monthsFor: monthsFor, zoomFor: zoomFor, gridMonth: gridMonth,
    catalogue: catalogue, coverage: coverage, build: build, toCsv: toCsv, fileName: fileName,
    screenHtml: screenHtml, presetIds: presetIds, fit: fit, choiceFrom: choiceFrom,
    clean: clean, who: who, london: london
  };
}));
