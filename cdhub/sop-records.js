/*!
 * BLDSopRecords — one record and one print for every SOP on the hub (the owner, 25 Nov 2026).
 *
 * A check type whose sop column matches the SOP, or whose type_key is the known name for that SOP
 * (Specs.gs, the 8 Nov and 21 Nov job lists, and the checks the hub already saves), keeps the job form.
 * An SOP with none of those in force gets Checked today: one whole-site check_log row. The first time,
 * that also adds the check_type row (target none), through the save the hub already uses.
 * A licence on the wall, an emergency notice and the signs index are display checks: Checked today is the record.
 *
 * Print records uses the yearly print (BLDYearlyPrint, PR 788) when that script is on the page.
 * Otherwise it prints this month with the Checks register (checks-register.js). Nothing here writes.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BLDSopRecords = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* name, known type_keys, extra tables besides BLD-check_log, yearly-print source ids (PR 788), display-only. */
  var SPEC = [
    { name: 'Microchip Audit', keys: ['microchip_check', 'pup_microchip'], files: ['BLD-microchip.csv', 'BLD-microchip_registration.csv'], yearlyIds: ['microchip', 'microchip_registration'] },
    { name: 'Sign-Off', keys: ['sign_off'], files: ['BLD-declaration.csv', 'BLD-verification.csv'], yearlyIds: ['declaration', 'verification'] },
    { name: 'Licence Display', keys: ['licence_display'], files: ['BLD-credential.csv', 'BLD-credential_version.csv'], yearlyIds: ['credential'], display: true },
    { name: 'Record Keeping', keys: ['record_keeping'], files: [], yearlyIds: [] },
    { name: 'Read-and-Sign', keys: ['read_and_sign'], files: [], yearlyIds: [] },
    { name: 'Mating Plan', keys: ['mating_plan'], files: ['BLD-mating.csv'], yearlyIds: ['mating'] },
    { name: 'Emergency Display', keys: ['emergency_display'], files: [], yearlyIds: [], display: true },
    { name: 'Site Security', keys: ['site_security', 'site_check'], files: [], yearlyIds: [] },
    { name: 'Workplace Safety', keys: ['workplace_safety'], files: [], yearlyIds: [] },
    { name: 'Accident Report', keys: ['incident', 'accident', 'accident_report'], files: [], yearlyIds: [] },
    { name: 'Euthanasia', keys: ['euthanasia'], files: [], yearlyIds: [] },
    { name: 'Evacuation', keys: ['evacuation'], files: [], yearlyIds: [] },
    { name: 'Inspections', keys: ['inspections'], files: ['BLD-inspection.csv', 'BLD-finding.csv'], yearlyIds: ['inspection', 'finding'] },
    { name: 'Lost Dog', keys: ['lost_dog', 'lost'], files: [], yearlyIds: [] },
    { name: 'Outbreak Response', keys: ['outbreak', 'outbreak_response'], files: [], yearlyIds: [] },
    { name: 'Health Screening', keys: ['health_screening'], files: ['BLD-health_screen.csv', 'BLD-dna_result.csv'], yearlyIds: ['health_screen', 'dna_result'] },
    { name: 'Care Rounds', keys: ['care_rounds', 'evening_count', 'water_toileting'], files: [], yearlyIds: [] },
    { name: 'Cleaning', keys: ['cleaning', 'clean', 'daily_clean', 'whole_site_clean', 'cleaning_kit'], files: [], yearlyIds: [] },
    { name: 'Feeding', keys: ['feeding', 'food_bowls', 'water_bowls', 'fresh_food'], files: [], yearlyIds: [] },
    { name: 'Health Check', keys: ['health', 'health_check', 'health_check_all', 'health_observation'], files: ['BLD-clinical_note.csv', 'BLD-visit.csv'], yearlyIds: ['clinical_note', 'visit'] },
    { name: 'Deep Clean', keys: ['deep', 'deep_clean'], files: [], yearlyIds: [] },
    { name: 'Pest Checks', keys: ['pest_checks'], files: [], yearlyIds: [] },
    { name: 'Care Check', keys: ['nails', 'ears', 'weigh', 'teeth', 'full_groom', 'care_check', 'bedding', 'toys', 'brush_bath_clip'], files: ['BLD-weight.csv'], yearlyIds: ['weight'] },
    { name: 'Condition Scoring', keys: ['condition_scoring', 'bcs'], files: ['BLD-weight.csv'], yearlyIds: ['weight'] },
    { name: 'Full Clean', keys: ['full_clean'], files: [], yearlyIds: [] },
    { name: 'Fitness Review', keys: ['fitness_review', 'fitness'], files: ['BLD-fit_to_breed.csv'], yearlyIds: ['fit_to_breed'] },
    { name: 'Hygiene', keys: ['hygiene'], files: [], yearlyIds: [] },
    { name: 'Pest Control', keys: ['pest_control'], files: [], yearlyIds: [] },
    { name: 'Whelping', keys: ['whelping', 'whelping_log'], files: ['BLD-litter.csv'], yearlyIds: ['litter'] },
    { name: 'Dog Intake', keys: ['dog_intake', 'intake'], files: [], yearlyIds: [] },
    { name: 'Isolation', keys: ['isolation', 'iso_checks'], files: [], yearlyIds: [] },
    { name: 'Isolation Release', keys: ['isolation_release'], files: [], yearlyIds: [] },
    { name: 'Occupant Clean', keys: ['occupant_clean'], files: [], yearlyIds: [] },
    { name: 'Parasites and Zoonoses', keys: ['parasites', 'parasites_zoonoses'], files: [], yearlyIds: [] },
    { name: 'Transport', keys: ['transport', 'vehicle_crate'], files: [], yearlyIds: [] },
    { name: 'Vaccinations', keys: ['vaccination', 'vaccinations'], files: ['BLD-vaccination.csv'], yearlyIds: ['vaccination'] },
    { name: 'Mating and Retirement', keys: ['mating_retirement', 'fit_to_breed'], files: ['BLD-mating.csv', 'BLD-fit_to_breed.csv'], yearlyIds: ['mating', 'fit_to_breed'] },
    { name: 'Ovulation Testing', keys: ['ovulation', 'ovulation_testing'], files: [], yearlyIds: [] },
    { name: 'Season Tracking', keys: ['season', 'season_tracking'], files: [], yearlyIds: [] },
    { name: 'Staff Rota', keys: ['staff_rota', 'rota'], files: [], yearlyIds: [] },
    { name: 'Staff Training', keys: ['staff_training', 'training', 'training_signoff'], files: [], yearlyIds: [] },
    { name: 'Staffing Ratio and Cover', keys: ['staffing_ratio'], files: [], yearlyIds: [] },
    { name: 'Induction', keys: ['induction'], files: [], yearlyIds: [] },
    { name: 'Puppy Handover', keys: ['puppy_handover', 'handover'], files: ['BLD-sale.csv'], yearlyIds: ['sale'] },
    { name: 'Puppy Packs', keys: ['puppy_pack', 'puppy_packs'], files: [], yearlyIds: [] },
    { name: 'Socialisation', keys: ['socialisation', 'social', 'exercise_all', 'exercise_enrichment'], files: [], yearlyIds: [] },
    { name: 'Collections', keys: ['collections'], files: ['BLD-sale.csv'], yearlyIds: ['sale'] },
    { name: 'Signs/Posters Index', keys: ['signs_posters'], files: [], yearlyIds: [], display: true },
    { name: 'Medicines', keys: ['medicine'], files: ['BLD-dispense.csv', 'BLD-stock_level.csv'], yearlyIds: ['medicines', 'stock_level'], meds: true }
  ];

  var BY = {};
  SPEC.forEach(function (s) { BY[s.name] = s; });
  var KEY_SOP = {};
  SPEC.forEach(function (s) { (s.keys || []).forEach(function (k) { if (!KEY_SOP[k]) KEY_SOP[k] = s.name; }); });

  var FILE_LABEL = {
    'BLD-microchip.csv': 'Microchip', 'BLD-microchip_registration.csv': 'Microchip registration',
    'BLD-declaration.csv': 'Declaration', 'BLD-verification.csv': 'Verification',
    'BLD-credential.csv': 'Licence', 'BLD-credential_version.csv': 'Licence version',
    'BLD-mating.csv': 'Mating', 'BLD-inspection.csv': 'Inspection', 'BLD-finding.csv': 'Finding',
    'BLD-health_screen.csv': 'Health screening', 'BLD-dna_result.csv': 'DNA result',
    'BLD-clinical_note.csv': 'Clinical note', 'BLD-visit.csv': 'Vet visit', 'BLD-weight.csv': 'Weight',
    'BLD-fit_to_breed.csv': 'Fit to breed', 'BLD-litter.csv': 'Litter', 'BLD-dispense.csv': 'Medicine given',
    'BLD-stock_level.csv': 'Medicine stock', 'BLD-vaccination.csv': 'Vaccination', 'BLD-sale.csv': 'Puppy handover'
  };
  var DATE_KEYS = ['happened_at', 'taken_at', 'given_at', 'given_on', 'performed_on', 'born_on', 'mated_on', 'assessed_on', 'registered_on', 'implanted_on', 'chipped_on', 'raised_on', 'noticed_on', 'inspection_date', 'verified_on', 'sold_on', 'from_date', 'screened_on', 'noted_on', 'completed_at', 'tested_on', 'counted_on'];
  var RESULT = { ok: 'done', done: 'done', concern: 'concern', not_done: 'not done', recorded: 'recorded', note: 'note', part_done: 'part done' };

  function str(v) { return String(v == null ? '' : v).trim(); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function isOff(v) { return str(v).toLowerCase() === 'false'; }
  function specOf(name) { return BY[name] || { name: name, keys: [], files: [], yearlyIds: [], display: false }; }

  /** type_key for the Checked today row. Lower case, and short enough for the save. */
  function slug(name) {
    var s = 'sop_' + str(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return s.slice(0, 40);
  }
  function everyFor(frequency) {
    var f = str(frequency);
    if (f === 'Annual') return '365';
    if (f === 'Weekly') return '7';
    if (f === 'Monthly') return '30';
    return '1';
  }

  /** Same rule as BLDDue.jobsInForce: the latest row on or before today, still on, not an item test, not the round. */
  function jobsInForce(types, today) {
    var best = {};
    (types || []).forEach(function (r) {
      if (!r || !r.type_key || !r.effective_from || r.effective_from > today) return;
      if (!best[r.type_key] || r.effective_from > best[r.type_key].effective_from) best[r.type_key] = r;
    });
    return Object.keys(best).map(function (k) { return best[k]; }).filter(function (r) {
      return !isOff(r.active) && r.target !== 'item' && str(r.type_key).indexOf('round.') !== 0;
    });
  }

  /** A blank sop is filled from the known type_key, so Feeding still opens when the sheet left the SOP column empty. */
  function withSop(types) {
    return (types || []).map(function (t) {
      if (!t || str(t.sop)) return t;
      var name = KEY_SOP[str(t.type_key)];
      if (!name) return t;
      var c = {};
      Object.keys(t).forEach(function (k) { c[k] = t[k]; });
      c.sop = name;
      return c;
    });
  }
  function shownOn(types, today, name) {
    return jobsInForce(withSop(types), today).filter(function (t) { return str(t.sop) === name; });
  }
  /** Every version of a check that belongs to this SOP, including ones no longer in force, so the print keeps the old rows. */
  function typesFor(types, name) {
    var spec = specOf(name), keys = {};
    (spec.keys || []).forEach(function (k) { keys[k] = 1; });
    keys[slug(name)] = 1;
    return withSop(types).filter(function (t) { return t && (str(t.sop) === name || keys[str(t.type_key)]); });
  }

  function typeByKey(types, key, today) {
    var best = null;
    (types || []).forEach(function (t) {
      if (!t || str(t.type_key) !== key) return;
      if (t.effective_from && t.effective_from > today) return;
      if (!best || str(t.effective_from) > str(best.effective_from)) best = t;
    });
    return best && !isOff(best.active) ? best : null;
  }

  /**
   * The saves for Checked today. The check_type row is added only when this SOP has no sop_<name> check yet.
   * Then one check_log, outcome recorded, how_recorded tapped, at the real time.
   */
  function checkedPlan(ctx, sop, now) {
    var name = str(sop && (sop.short_name || sop.name));
    if (!name) return { error: 'That SOP was not found.' };
    var today = str(ctx && ctx.today);
    var key = slug(name);
    var have = typeByKey(ctx && ctx.types, key, today);
    var log = { outcome: 'recorded', happened_at: now || '', how_recorded: 'tapped', note: 'Checked today' };
    if (have) return { typeId: have.id, steps: [{ table: 'check_log', action: 'add', fields: Object.assign({ check_type_id: have.id }, log) }] };
    var type = {
      type_key: key, label: 'Checked: ' + name, target: 'none', site_scope: 'one_line',
      asks_outcome: 'false', active: 'true', effective_from: today, sop: name,
      frequency: str(sop.frequency) || 'Checked today', source: 'CD Hub SOPs', every_days: everyFor(sop.frequency)
    };
    return { typeId: '', steps: [{ table: 'check_type', action: 'add', fields: type }, { table: 'check_log', action: 'add', needsType: true, fields: log }] };
  }

  function extraHtml(ctx, sop) {
    var name = str(sop && sop.short_name);
    if (!name) return '';
    var jobs = shownOn(ctx && ctx.types, str(ctx && ctx.today), name);
    var h = '';
    if (!jobs.length) {
      h += '<div data-sop-record="' + esc(slug(name)) + '" data-one-kind="site">'
        + '<button type="button" class="btn" data-sop-checked="' + esc(name) + '">Checked today</button>'
        + '<p class="mut" data-sop-msg role="status"></p></div>';
    }
    h += '<p class="sopprint"><a class="btn" href="#/sops/' + encodeURIComponent(name) + '" data-sop-print="' + esc(name) + '">Print records</a></p>';
    return h;
  }

  var FMT = null;
  function london(at) {
    var s = str(at);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { date: s, time: '' };
    var d = new Date(s);
    if (!s || isNaN(d.getTime())) return { date: '', time: '' };
    if (!FMT) FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    var p = {};
    FMT.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
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
  function inMonth(row, ym) {
    var w = dateOf(row);
    if (w.date && w.date.slice(0, 7) === ym) return true;
    var from = str(row.from_date || row.effective_from).slice(0, 10), to = str(row.to_date).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(from) && from.slice(0, 7) <= ym && (!to || to.slice(0, 7) >= ym)) return true;
    return false;
  }
  function blankLine() {
    return { date: '', time: '', noTime: false, check: '', subject: '', result: '', detail: '', note: '', action: '', needsAction: false, by: '', how: '', correction: '' };
  }
  function logLine(row, type, ctx) {
    var w = dateOf(row), outcome = str(row.outcome).toLowerCase();
    var subject = row.subject_id ? ((ctx.dogName && ctx.dogName(row.subject_id)) || 'Dog not on the current list') : (row.area_id ? 'Room' : (row.litter_id ? 'Litter' : 'Whole site'));
    var line = blankLine();
    line.date = w.date; line.time = str(row.time_given).toLowerCase() === 'false' ? '' : w.time; line.noTime = !line.time;
    line.check = (type && str(type.label)) || 'Check';
    line.subject = subject;
    line.result = RESULT[outcome] || str(row.outcome);
    line.detail = [str(row.item), str(row.amount)].filter(Boolean).join(', ');
    line.note = str(row.note);
    line.needsAction = outcome === 'concern' || outcome === 'not_done' || outcome === 'part_done';
    line.by = str(row.taken_by);
    return line;
  }
  function fileLine(file, row, ctx) {
    var w = dateOf(row);
    var subjectId = str(row.subject_id || row.dam_subject_id);
    var line = blankLine();
    line.date = w.date; line.time = w.time; line.noTime = !w.time;
    line.check = FILE_LABEL[file] || 'Record';
    line.subject = subjectId ? ((ctx.dogName && ctx.dogName(subjectId)) || 'Dog not on the current list') : '';
    line.result = str(row.outcome || row.grade || row.method || row.status || '');
    line.detail = [str(row.chip_number), str(row.product), str(row.test), str(row.weight_kg), str(row.label), str(row.kind)].filter(Boolean).slice(0, 3).join(', ');
    line.note = str(row.note || row.notes || row.wording_as_given || row.outcome_summary || '');
    line.by = str(row.taken_by || row.performed_by || row.verified_by || row.assessed_by || '');
    return line;
  }

  /** This month's lines for the Checks register print: the SOP's check_log rows, then the other tables it is stored in. */
  function printPack(ctx, name, opts) {
    ctx = ctx || {}; opts = opts || {};
    var ym = str(opts.month || str(ctx.today).slice(0, 7));
    var types = {}, lines = [];
    typesFor(ctx.types, name).forEach(function (t) { if (t.id) types[t.id] = t; });
    (ctx.logs || []).forEach(function (r) {
      if (!r || !types[r.check_type_id]) return;
      if (str(r.outcome) === 'note' && str(r.note_for_id)) return;
      if (!inMonth(r, ym)) return;
      lines.push(logLine(r, types[r.check_type_id], ctx));
    });
    var tables = ctx.tables || {};
    (specOf(name).files || []).forEach(function (file) {
      (tables[file] || []).forEach(function (r) {
        if (!r || !inMonth(r, ym)) return;
        lines.push(fileLine(file, r, ctx));
      });
    });
    lines.sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
    return { head: { kennel: str(ctx.kennel), month: ym, which: name, printed: str(opts.printed) }, lines: lines };
  }

  /** Yearly-print source ids for this SOP (check:<type_key> plus the fixed tables). Empty until that catalogue is passed in. */
  /** Yearly-print source ids for this SOP: its known checks, its fixed tables, and any check whose SOP name matches. */
  function yearlyIds(name, catalogue) {
    var spec = specOf(name), want = {};
    (spec.keys || []).forEach(function (k) { want['check:' + k] = 1; });
    want['check:' + slug(name)] = 1;
    (spec.yearlyIds || []).forEach(function (id) { want[id] = 1; });
    return (catalogue || []).filter(function (s) {
      if (!s) return false;
      if (want[s.id]) return true;
      if (s.kind !== 'check') return false;
      var sop = s.type && str(s.type.sop);
      if (!sop && s.typeKey) sop = KEY_SOP[str(s.typeKey)] || '';
      return sop === name;
    }).map(function (s) { return s.id; });
  }

  function recordWords(spec) {
    if (spec.display) return 'Yes — Checked today (display)';
    if ((spec.keys || []).length) return 'Yes — job form (' + spec.keys.join(', ') + '), or Checked today if none of those checks is in force';
    return 'Yes — Checked today';
  }
  function printWords(spec) {
    var yearly = 'Compliance → Yearly print and Download CSV';
    var bits = (spec.yearlyIds || []).slice();
    bits.unshift('its check log');
    if (spec.meds) return 'SOPs → Print records (this month). Also Compliance → Medicines register → Print and Download CSV. ' + yearly + ' (' + bits.join(', ') + ')';
    return 'SOPs → Print records (this month, Checks register). CSV: Compliance → Checks register → Download CSV. ' + yearly + ' (' + bits.join(', ') + ')';
  }
  function storageWords(spec) {
    return ['BLD-check_log.csv'].concat(spec.files || []).join('; ');
  }

  /** One row per SOP in the index: record control, where it is stored, and how it prints. */
  function audit(sops) {
    var list = (sops && sops.length) ? sops : SPEC.map(function (s) { return { short_name: s.name }; });
    return list.map(function (sop) {
      var name = str(sop.short_name || sop.name), spec = specOf(name);
      return { sop: name, record: recordWords(spec), storage: storageWords(spec), print: printWords(spec) };
    });
  }

  return {
    SPEC: SPEC, spec: specOf, slug: slug, everyFor: everyFor, withSop: withSop, shownOn: shownOn, typesFor: typesFor,
    checkedPlan: checkedPlan, extraHtml: extraHtml, printPack: printPack, yearlyIds: yearlyIds, audit: audit
  };
}));
