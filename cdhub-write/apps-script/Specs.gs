/**
 * The fixed allow-list of files the sink may append to, and what a row must look like.
 *
 * Column names come from the BLD design (bld-schema.js, 23 Sep 2026) and the live
 * BLD-*.csv headers read on 15 Oct 2026. Every column NOT in the design is tagged
 * proposed:true and is raised with Lisa in the Q&A slip. Nothing is renamed.
 *
 * `file` is the ONLY name the sink will ever write to for that table. The browser
 * sends a table key (or the exact file name), never a path.
 */
var ROLE_ALL = ['OWNER', 'STAFF', 'VET', 'TRAINER'];
/**
 * A visitor's code (an inspector, say). Deliberately NOT in ROLE_ALL: it may only add rows to guest_reading.
 * It always expires (Auth.gs) and can read the room list only (Read.gs). adminAddGuestCode (Auth.gs) is the only way to make one.
 */
var ROLE_GUEST = 'GUEST';

/** The default allow-list: the temperature log (plus the approvals queue, see Config.gs PENDING_FILE). */
var READ_METHODS_ = ['camera', 'typed'];

var TABLES = {

  // ---------------------------------------------------------------- area_reading
  // Temperature log. File ABSENT on Drive on 15 Oct 2026: Lisa creates it (decision 2).
  area_reading: {
    key: 'area_reading',
    file: 'BLD-area_reading.csv',
    idPrefix: 'rdg',
    // id + tenant_id are the standard first two columns on every live BLD table.
    columns: [
      'id', 'tenant_id',
      // '' = the live Sheet's 7th column, which has no name and holds max_c - min_c (Lisa to name it; see PR)
      'area_id', 'reading_type', 'min_c', 'max_c', '', 'spot_c', 'precision_dp',
      'period_start', 'taken_at', 'taken_by', 'device_id', 'reset_after_reading',
      'applied_limit_id', 'in_range', 'compliant', 'mitigation_required',
      'corrects_id',        // PROPOSED: pointer to the row this one corrects
      'mitigation_note',    // PROPOSED: what was done when a reading is out of band
      'read_method',        // PROPOSED 8 Nov 2026: 'camera' or 'typed'
      'camera_value_changed' // PROPOSED 8 Nov 2026: 'true' if staff changed the number the camera read
    ],
    proposedColumns: ['corrects_id', 'mitigation_note', 'read_method', 'camera_value_changed'],
    computedColumns: ['applied_limit_id', 'in_range', 'compliant', 'mitigation_required'],
    lookups: [{ name: 'area', file: 'BLD-area.csv', idCol: 'id' }],
    // Lisa 16 Oct (S02-4): staff see NO past entries, so they cannot point at one. A wrong entry is reported to
    // the owner, who fixes it with the owner edit (or an OWNER code sends a correction row).
    perms: { add: ROLE_ALL, correct: ['OWNER'] },
    ownerEditable: true,
    alwaysPending: false,
    defaultMode: 'direct',   // Lisa 16 Oct: temperature readings go straight in; corrections always wait
    // fields the browser may send (everything else is set by the server)
    input: {
      area_id:             { type: 'ref', lookup: 'area', required: true },
      reading_type:        { type: 'enum', values: ['temperature'], dflt: 'temperature' },
      min_c:               { type: 'temp', required: true },
      max_c:               { type: 'temp', required: true },
      spot_c:              { type: 'temp' },
      period_start:        { type: 'datetime' },
      reset_after_reading: { type: 'bool' },
      mitigation_note:     { type: 'text' },
      read_method:         { type: 'enum', values: READ_METHODS_ },
      camera_value_changed: { type: 'bool' }
    },
    // duplicate guard: same tenant + same area + same period (morning/afternoon slot sent by the hub) within
    // DUP_WINDOW_MIN of taken_at. Without period_start this is the old rule: same room inside the window.
    dupKey: ['area_id', 'period_start'], dupTimeCol: 'taken_at',
    stamp: function (row, ctx) {
      row.precision_dp = '1';   // Lisa 7 Nov 2026: room temperatures are kept to 1 decimal place
      if (row.min_c !== '' && row.max_c !== '') row[''] = (parseFloat(row.max_c) - parseFloat(row.min_c)).toFixed(1);
      row.taken_at = ctx.nowIso;
      row.taken_by = ctx.who;
    },
    checkRow: function (row, errors) {
      if (!errors.min_c && !errors.max_c && row.min_c !== '' && row.max_c !== '' &&
          parseFloat(row.min_c) > parseFloat(row.max_c)) {
        errors.min_c = 'The lowest reading cannot be higher than the highest reading.';
      }
      checkReadMethod_(row, errors);
    }
  },

  // ---------------------------------------------------------------- guest_reading
  // A visitor's own temperature readings (8 Nov 2026). A separate file on purpose: a guest reading can never count
  // as, block, or overwrite a staff reading, because it never touches BLD-area_reading. Only a GUEST code can add
  // here and a GUEST code can add nowhere else. Lisa creates the file (header row only); own switch, OFF by default.
  // taken_by is the guest's label and public code id. A guest can read the room list and nothing else (Read.gs).
  guest_reading: {
    key: 'guest_reading',
    file: 'BLD-guest_reading.csv',
    idPrefix: 'grd',
    columns: ['id', 'tenant_id', 'area_id', 'min_c', 'max_c', 'spot_c', 'precision_dp', 'period_start',
              'taken_at', 'taken_by', 'read_method', 'camera_value_changed', 'mitigation_note', 'note'],
    proposedColumns: ['id', 'tenant_id', 'area_id', 'min_c', 'max_c', 'spot_c', 'precision_dp', 'period_start',
                      'taken_at', 'taken_by', 'read_method', 'camera_value_changed', 'mitigation_note', 'note'],
    computedColumns: [],
    lookups: [{ name: 'area', file: 'BLD-area.csv', idCol: 'id' }],
    perms: { add: [ROLE_GUEST], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      area_id:              { type: 'ref', lookup: 'area', required: true },
      min_c:                { type: 'temp', required: true },
      max_c:                { type: 'temp', required: true },
      spot_c:               { type: 'temp' },
      period_start:         { type: 'datetime' },
      read_method:          { type: 'enum', values: READ_METHODS_ },
      camera_value_changed: { type: 'bool' },
      mitigation_note:      { type: 'text' },
      note:                 { type: 'text' }
    },
    dupKey: ['area_id', 'period_start'], dupTimeCol: 'taken_at',
    stamp: function (row, ctx) { row.precision_dp = '1'; row.taken_at = ctx.nowIso; row.taken_by = ctx.who; },
    checkRow: function (row, errors) {
      if (!errors.min_c && !errors.max_c && row.min_c !== '' && row.max_c !== '' &&
          parseFloat(row.min_c) > parseFloat(row.max_c)) {
        errors.min_c = 'The lowest reading cannot be higher than the highest reading.';
      }
      checkReadMethod_(row, errors);
    }
  },

  // ---------------------------------------------------------------- check_type
  // The kennel's own list of staff checks (feeding, medicine, cleaning...): entered by the OWNER as rows, never
  // hard-coded, because they differ by kennel. NEW table, own switch, OFF by default. A change is a new row with a
  // later effective_from, so an old entry keeps pointing at the version in force when it was made. target tells the
  // screen what to ask for: a room, a dog, either, or neither. active=false retires a check from that date.
  check_type: {
    key: 'check_type',
    file: 'BLD-check_type.csv',
    idPrefix: 'cty',
    columns: ['id', 'tenant_id', 'type_key', 'label', 'target', 'asks_item', 'asks_amount', 'amount_unit', 'frequency',
              'active', 'effective_from', 'source', 'note', 'set_at', 'set_by'],
    proposedColumns: ['type_key', 'label', 'target', 'asks_item', 'asks_amount', 'amount_unit', 'frequency',
                      'active', 'effective_from', 'source', 'note', 'set_at', 'set_by'],
    computedColumns: [],
    lookups: [],
    perms: { add: ['OWNER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      type_key:       { type: 'text', required: true },
      label:          { type: 'text', required: true },
      target:         { type: 'enum', values: ['area', 'dog', 'either', 'none'], required: true },
      asks_item:      { type: 'bool', dflt: 'false' },
      asks_amount:    { type: 'bool', dflt: 'false' },
      amount_unit:    { type: 'text' },
      frequency:      { type: 'text' },
      active:         { type: 'bool', dflt: 'true' },
      effective_from: { type: 'date', required: true },
      source:         { type: 'text' },
      note:           { type: 'text' }
    },
    dupKey: ['type_key', 'effective_from'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_at = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) {
      if (!errors.type_key && row.type_key !== '' && !/^[a-z][a-z0-9_]{1,39}$/.test(row.type_key)) {
        errors.type_key = 'Use lower-case letters, numbers and underscores, e.g. feeding.';
      }
    },
    checkAgainst: function (clean, records, errors) {
      if (errors.type_key || errors.effective_from) return;
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type_key === clean.type_key && (r.effective_from || '') >= clean.effective_from) {
          errors.effective_from = 'This check already has a version from ' + r.effective_from + '. A change must start after that date.';
          return;
        }
      }
    }
  },

  // ---------------------------------------------------------------- check_log
  // One staff record against one check_type row. One table for every check, so a new check is a new row in
  // check_type and needs no code. item/amount hold what the check asks for (a medicine and dose, a food and weight,
  // a visitor's name). NEW table, own switch, OFF by default. Wrong entries are corrected by the owner, as for temperatures.
  check_log: {
    key: 'check_log',
    file: 'BLD-check_log.csv',
    idPrefix: 'clg',
    columns: ['id', 'tenant_id', 'check_type_id', 'area_id', 'subject_id', 'item', 'amount', 'outcome', 'happened_at',
              'note', 'taken_at', 'taken_by', 'corrects_id'],
    proposedColumns: ['check_type_id', 'area_id', 'subject_id', 'item', 'amount', 'outcome', 'happened_at',
                      'note', 'taken_at', 'taken_by', 'corrects_id'],
    computedColumns: [],
    lookups: [
      { name: 'check_type', file: 'BLD-check_type.csv', idCol: 'id' },
      { name: 'area', file: 'BLD-area.csv', idCol: 'id' },
      { name: 'subject', file: 'BLD-subject.csv', idCol: 'id' }
    ],
    perms: { add: ['OWNER', 'STAFF'], correct: ['OWNER'] },
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      check_type_id: { type: 'ref', lookup: 'check_type', required: true },
      area_id:       { type: 'ref', lookup: 'area' },
      subject_id:    { type: 'ref', lookup: 'subject' },
      item:          { type: 'text' },
      amount:        { type: 'text' },
      outcome:       { type: 'enum', values: ['ok', 'concern', 'not_done'], required: true },
      happened_at:   { type: 'datetime' },
      note:          { type: 'text' }
    },
    dupKey: ['check_type_id', 'area_id', 'subject_id', 'item'], dupTimeCol: 'taken_at',
    stamp: function (row, ctx) { row.taken_at = ctx.nowIso; row.taken_by = ctx.who; },
    checkRow: function (row, errors) {
      if ((row.outcome === 'concern' || row.outcome === 'not_done') && row.note === '' && !errors.note) {
        errors.note = 'Say briefly what the concern is or why it was not done.';
      }
    }
  },

  // ---------------------------------------------------------------- occupancy
  // Where each dog is. LIVE table (BLD-occupancy.csv, header checked 15 Oct). EXISTING column names only.
  // A move APPENDS a new row (subject_id, area_id, moved_in = today). moved_out is NEVER written and no
  // existing row is ever edited: the current room is the row with the latest moved_in.
  // Own switch (TABLE_ON_occupancy), OFF by default. Moves queue for Lisa for the first 14 days after go-live
  // (MOVES_QUEUE_UNTIL), then go straight in; MODE_occupancy, if set, beats the date.
  // There is no corrects_id column here, so a wrong room is fixed by moving the dog again.
  occupancy: {
    key: 'occupancy',
    file: 'BLD-occupancy.csv',
    idPrefix: 'occ',
    columns: ['id', 'tenant_id', 'subject_id', 'area_id', 'off_site_kind', 'moved_in', 'moved_out', 'classification', 'classification_note'],
    proposedColumns: [],
    computedColumns: [],
    lookups: [
      { name: 'area', file: 'BLD-area.csv', idCol: 'id' },
      { name: 'subject', file: 'BLD-subject.csv', idCol: 'id' }
    ],
    perms: { add: ['OWNER', 'STAFF'], correct: [] },
    noCorrect: true,
    ownerEditable: true,
    // moves queue for the first MOVES_QUEUE_DAYS days after go-live, then go straight in (modeFor_ in Sink.gs)
    movesQueue: true,
    // fields ONLY the owner's in-place edit may also change (staff can never set these)
    ownerEdit: { moved_in: { type: 'date' }, moved_out: { type: 'date' } },
    alwaysPending: false,
    defaultMode: 'pending',
    input: {
      subject_id: { type: 'ref', lookup: 'subject', required: true },
      area_id:    { type: 'ref', lookup: 'area', required: true },
      classification_note: { type: 'text' }   // the reason given for a move over the room's limit
    },
    // same dog into the same room twice on one day is a repeat tap, not a second move
    dupKey: ['subject_id', 'area_id'], dupTimeCol: null, dupDayCol: 'moved_in',
    stamp: function (row, ctx) { row.moved_in = ctx.today; },
    checkRow: function () {},
    checkAgainst: function (clean, records, errors) {
      if (errors.subject_id || errors.area_id) return;
      var cur = occupancyLatest_(records, clean.subject_id);
      if (!cur) return;
      if (permanentlyGone_(cur)) {
        errors.subject_id = 'This dog is recorded as no longer on site. Ask Lisa before moving it.';
      } else if (cur.area_id && cur.area_id === clean.area_id) {
        errors.area_id = 'That dog is already recorded in that room, so it has not moved.';
      }
    }
  },

  // ---------------------------------------------------------------- occupancy_out
  // A dog taken out of its room (staff page, 8 Nov 2026). A second way in to BLD-occupancy.csv: the same file and
  // columns, area_id blank, moved_in = today. Every one waits for Lisa, because a dog recorded as gone stops being asked about.
  occupancy_out: {
    key: 'occupancy_out',
    file: 'BLD-occupancy.csv',
    idPrefix: 'occ',
    columns: ['id', 'tenant_id', 'subject_id', 'area_id', 'off_site_kind', 'moved_in', 'moved_out', 'classification', 'classification_note'],
    proposedColumns: [],
    computedColumns: [],
    lookups: [{ name: 'subject', file: 'BLD-subject.csv', idCol: 'id' }],
    perms: { add: ['OWNER', 'STAFF'], correct: [] },
    noCorrect: true,
    alwaysPending: true,
    defaultMode: 'pending',
    input: {
      subject_id:          { type: 'ref', lookup: 'subject', required: true },
      off_site_kind:       { type: 'enum', values: ['temporary', 'sold', 'owned_by_family', 'deceased'], required: true },
      classification_note: { type: 'text' }
    },
    dupKey: ['subject_id', 'off_site_kind'], dupTimeCol: null, dupDayCol: 'moved_in',
    stamp: function (row, ctx) { row.moved_in = ctx.today; },
    checkRow: function () {},
    checkAgainst: function (clean, records, errors) {
      if (errors.subject_id) return;
      if (permanentlyGone_(occupancyLatest_(records, clean.subject_id))) {
        errors.subject_id = 'This dog is already recorded as no longer on site.';
      }
    }
  },

  // ---------------------------------------------------------------- area_access
  // Whether a room's flap is free or limited (staff page). LIVE table, existing columns. A change appends a row and
  // the newest row with a value wins. dupKey 'id' never matches, so free, limited, free on one day all save; a
  // repeat tap is caught by checkAgainst instead. Own switch, OFF by default.
  area_access: {
    key: 'area_access',
    file: 'BLD-area_access.csv',
    idPrefix: 'acc',
    columns: ['id', 'tenant_id', 'area_id', 'access_type', 'from_date', 'to_date', 'reason', 'set_by'],
    proposedColumns: [],
    computedColumns: [],
    lookups: [{ name: 'area', file: 'BLD-area.csv', idCol: 'id' }],
    perms: { add: ['OWNER', 'STAFF'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      area_id:     { type: 'ref', lookup: 'area', required: true },
      access_type: { type: 'enum', values: ['free', 'limited'], required: true }
    },
    dupKey: ['id'], dupTimeCol: null,
    stamp: function (row, ctx) { row.from_date = ctx.today; row.set_by = ctx.whoId || ctx.who; },
    checkRow: function () {},
    checkAgainst: function (clean, records, errors) {
      if (errors.area_id || errors.access_type) return;
      var cur = '';
      records.forEach(function (r) { if (r.area_id === clean.area_id && r.access_type) cur = r.access_type; });
      if (cur === clean.access_type) errors.access_type = 'That room is already recorded as ' + cur + '.';
    }
  },

  // ---------------------------------------------------------------- qr_tag
  // What each QR code means: a random tag, never a name or health detail. NEW table, own switch, OFF by default.
  qr_tag: {
    key: 'qr_tag',
    file: 'BLD-qr_tag.csv',
    idPrefix: 'qrt',
    columns: ['id', 'tenant_id', 'tag', 'kind', 'ref_id', 'active', 'made_at', 'made_by'],
    proposedColumns: ['tag', 'kind', 'ref_id', 'active', 'made_at', 'made_by'],
    computedColumns: [],
    lookups: [],
    perms: { add: ['OWNER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      tag:    { type: 'text', required: true },
      kind:   { type: 'enum', values: ['area', 'subject', 'litter'], required: true },
      ref_id: { type: 'text', required: true }
    },
    dupKey: ['tag'], dupTimeCol: null,
    stamp: function (row, ctx) { row.active = 'true'; row.made_at = ctx.nowIso; row.made_by = ctx.whoId || ctx.who; },
    checkRow: function () {}
  },

  // ---------------------------------------------------------------- occupancy_check
  // The daily "All the rest unmoved" confirmation (Lisa 16 Oct, S02-1). ONE row per tap: who confirmed, when,
  // and the list of dogs confirmed where they were last recorded. Moves are separate: they still append
  // BLD-occupancy rows. NEW table (not in the BLD design, not on Drive): Lisa creates the file, and it has its
  // own switch (TABLE_ON_occupancy_check), OFF by default. confirmed_at and confirmed_by are set by the script.
  // dog_ids is pipe-separated (sorted); 500 dogs at most per row.
  occupancy_check: {
    key: 'occupancy_check',
    file: 'BLD-occupancy_check.csv',
    idPrefix: 'chk',
    columns: ['id', 'tenant_id', 'confirmed_at', 'confirmed_by', 'dog_ids', 'moved_count', 'note'],
    proposedColumns: ['confirmed_at', 'confirmed_by', 'dog_ids', 'moved_count', 'note'],
    computedColumns: [],
    lookups: [{ name: 'subject', file: 'BLD-subject.csv', idCol: 'id' }],
    perms: { add: ['OWNER', 'STAFF'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      dog_ids:     { type: 'idlist', lookup: 'subject', required: true },
      moved_count: { type: 'count', dflt: '0' },
      note:        { type: 'text' }
    },
    // the same set of dogs confirmed twice within DUP_WINDOW_MIN is a repeat tap
    dupKey: ['dog_ids'], dupTimeCol: 'confirmed_at',
    stamp: function (row, ctx) { row.confirmed_at = ctx.nowIso; row.confirmed_by = ctx.whoId || ctx.who; },
    checkRow: function () {}
  },

  // ---------------------------------------------------------------- breeding_rule
  // The breeder's own breeding limits (Lisa 8 Nov 2026): typed in by the OWNER when setting up the app, never
  // hard-coded, because they differ by country, licence and kennel club. NEW table: Lisa creates BLD-breeding_rule
  // (header row only); own switch TABLE_ON_breeding_rule, OFF by default.
  // A change is a NEW row with its own effective_from, never an edit, so an old litter is judged by the rule in
  // force on its own date. The rule for a date = the row for that key with the latest effective_from on or before it.
  breeding_rule: {
    key: 'breeding_rule',
    file: 'BLD-breeding_rule.csv',
    idPrefix: 'brl',
    columns: ['id', 'tenant_id', 'rule_key', 'value', 'effective_from', 'source', 'note', 'set_at', 'set_by'],
    proposedColumns: ['rule_key', 'value', 'effective_from', 'source', 'note', 'set_at', 'set_by'],
    computedColumns: [],
    lookups: [],
    perms: { add: ['OWNER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      rule_key:       { type: 'enum', values: ['min_dam_age_months', 'max_litters_per_dam', 'min_months_between_litters'], required: true },
      value:          { type: 'count', required: true },
      effective_from: { type: 'date', required: true },
      source:         { type: 'text' },
      note:           { type: 'text' }
    },
    // the same rule given twice from the same date is a repeat tap
    dupKey: ['rule_key', 'effective_from'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_at = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) {
      var lim = BREEDING_RULE_LIMITS_[row.rule_key];
      if (lim && !errors.value && row.value !== '') {
        var n = parseInt(row.value, 10);
        if (n < lim[0] || n > lim[1]) errors.value = 'Use a number from ' + lim[0] + ' to ' + lim[1] + ' ' + lim[2] + '.';
      }
    },
    // a new version must start after the latest one already saved for that rule (history is never rewritten)
    checkAgainst: function (clean, records, errors) {
      if (errors.rule_key || errors.effective_from) return;
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.rule_key === clean.rule_key && (r.effective_from || '') >= clean.effective_from) {
          errors.effective_from = 'This rule already has a version from ' + r.effective_from + '. A change must start after that date.';
          return;
        }
      }
    }
  }
};

/** A reading's camera fields: the "changed" flag only makes sense for a camera reading. */
function checkReadMethod_(row, errors) {
  if (row.camera_value_changed === 'true' && row.read_method !== 'camera' && !errors.read_method) {
    errors.camera_value_changed = 'Only a camera reading can have its number changed.';
  }
}

/** Sensible bounds for each breeding rule, so a typo (e.g. 120 months) is refused: [lowest, highest, unit]. */
var BREEDING_RULE_LIMITS_ = {
  min_dam_age_months:          [6, 48, 'months'],
  max_litters_per_dam:         [1, 20, 'litters'],
  min_months_between_litters:  [1, 36, 'months']
};

/** Permanently not on site (Lisa 16 Oct, S02-7): sold, owned_by_family, Collected or deceased. Such a dog is never asked to move. */
function permanentlyGone_(row) {
  if (!row) return false;
  var kind = String(row.off_site_kind || '').toLowerCase(), cls = String(row.classification || '').toLowerCase();
  return kind === 'sold' || kind === 'owned_by_family' || kind === 'deceased' || cls === 'collected' || cls === 'deceased';
}

/**
 * Latest occupancy row for a dog: the highest moved_in. A row with no moved_in ranks below any dated row,
 * and a tie goes to the later row in the file. Nothing is ever edited, so "current" is always computed.
 */
function occupancyLatest_(records, subjectId) {
  var best = null, bestKey = '', bestIdx = -1;
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    if (r.subject_id !== subjectId) continue;
    var key = r.moved_in || '';
    if (best === null || key > bestKey || (key === bestKey && i >= bestIdx)) { best = r; bestKey = key; bestIdx = i; }
  }
  return best;
}

/**
 * PROPOSED tables. NOT on the allow-list: the script refuses these files today, whatever switches are set.
 * They are kept here, complete and tested, so a later decision (Lisa, Q&A slip) is a one-line change:
 * move an entry from PROPOSED_TABLES into TABLES. Until then nothing can write to them.
 */
var PROPOSED_TABLES = {

  // ---------------------------------------------------------------- staff
  // Staff roster. Columns from the `staff` design table. File ABSENT on Drive.
  // Roster changes are OWNER-only and always go through the pending queue.
  staff: {
    key: 'staff',
    file: 'BLD-staff.csv',
    idPrefix: 'stf',
    columns: ['id', 'tenant_id', 'person_id', 'role', 'employment', 'started_on', 'ended_on', 'corrects_id'],
    proposedColumns: ['corrects_id'],
    computedColumns: [],
    lookups: [{ name: 'person', file: 'BLD-person.csv', idCol: 'id' }],
    perms: { add: ['OWNER'], correct: ['OWNER'] },
    alwaysPending: true,
    input: {
      person_id:  { type: 'ref', lookup: 'person', required: true },
      role:       { type: 'text', required: true },
      employment: { type: 'enum', values: ['full_time', 'part_time'], required: true },
      started_on: { type: 'date', required: true },
      ended_on:   { type: 'date' }
    },
    dupKey: ['person_id', 'started_on'], dupTimeCol: null,
    stamp: function () {},
    checkRow: function (row, errors) {
      if (row.ended_on && row.started_on && row.ended_on < row.started_on && !errors.ended_on) {
        errors.ended_on = 'The end date cannot be before the start date.';
      }
    }
  }
};

/**
 * RETIRED tables. Kept for the record, never written to, refused like the proposed ones. Nothing was deleted.
 * round_event (16 Oct 2026, Lisa): replaced by occupancy_check (now on the allow-list, own switch) + the live occupancy table.
 */
var RETIRED_TABLES = {

  // ---------------------------------------------------------------- round_event
  // Placement / cabin-access log from "The round". DESIGN ONLY: not in the BLD design,
  // not on Drive. Proposed by this job. Switched off until Lisa creates the file.
  round_event: {
    key: 'round_event',
    file: 'BLD-round_event.csv',
    idPrefix: 'rnd',
    columns: [
      'id', 'tenant_id',
      'round_date', 'area_id', 'subject_id', 'event_type', 'access_type',
      'recorded_by', 'recorded_at', 'corrects_id'
    ],
    proposedColumns: ['round_date', 'area_id', 'subject_id', 'event_type', 'access_type',
                      'recorded_by', 'recorded_at', 'corrects_id'],
    computedColumns: [],
    lookups: [
      { name: 'area', file: 'BLD-area.csv', idCol: 'id' },
      { name: 'subject', file: 'BLD-subject.csv', idCol: 'id' }
    ],
    perms: { add: ROLE_ALL, correct: ROLE_ALL },
    alwaysPending: false,
    input: {
      round_date:  { type: 'date', required: true },
      area_id:     { type: 'ref', lookup: 'area', required: true },
      subject_id:  { type: 'ref', lookup: 'subject' },
      event_type:  { type: 'enum', values: ['placed', 'removed', 'access_set'], required: true },
      access_type: { type: 'enum', values: ['free', 'limited'] }
    },
    dupKey: ['round_date', 'area_id', 'subject_id', 'event_type', 'access_type'], dupTimeCol: 'recorded_at',
    stamp: function (row, ctx) { row.recorded_at = ctx.nowIso; row.recorded_by = ctx.who; },
    checkRow: function (row, errors) {
      if ((row.event_type === 'placed' || row.event_type === 'removed') && !row.subject_id && !errors.subject_id) {
        errors.subject_id = 'Say which dog was placed or removed.';
      }
      if (row.event_type === 'access_set' && !row.access_type && !errors.access_type) {
        errors.access_type = 'Say whether the flap was free or limited.';
      }
    }
  }
};

/** Resolve a table key or an exact file name to a spec. Anything else is refused. */
function specFor_(keyOrFile) {
  var k;
  for (k in TABLES) {
    if (!Object.prototype.hasOwnProperty.call(TABLES, k)) continue;
    if (TABLES[k].key === keyOrFile || TABLES[k].file === keyOrFile) return TABLES[k];
  }
  return null;
}

/** The complete list of file names the sink can ever write to (proposed tables are NOT in it). */
function allowedFiles_() {
  var out = [BLD.PENDING_FILE];
  for (var k in TABLES) if (Object.prototype.hasOwnProperty.call(TABLES, k) && out.indexOf(TABLES[k].file) < 0) out.push(TABLES[k].file);
  return out;
}

/**
 * Lists a staff code may READ, through the read action (Read.gs), and only as far as BLD-field_visibility.csv allows.
 * `vis` is the table_name used in BLD-field_visibility.csv rows. authorCol/dateCol let a row rule such as
 * own_rows_days<=14 work; a table without them cannot be narrowed that way (such a rule is refused, not guessed).
 */
var READABLE = {
  area:            { file: 'BLD-area.csv',            vis: 'area',            authorCol: '',            dateCol: '' },
  subject:         { file: 'BLD-subject.csv',         vis: 'subject',         authorCol: '',            dateCol: '' },
  subject_status:  { file: 'BLD-subject_status.csv',  vis: 'subject_status',  authorCol: '',            dateCol: '' },
  occupancy:       { file: 'BLD-occupancy.csv',       vis: 'occupancy',       authorCol: '',            dateCol: '' },
  area_reading:    { file: 'BLD-area_reading.csv',    vis: 'area_reading',    authorCol: 'taken_by',    dateCol: 'taken_at' },
  occupancy_check: { file: 'BLD-occupancy_check.csv', vis: 'occupancy_check', authorCol: 'confirmed_by', dateCol: 'confirmed_at' },
  breeding_rule:   { file: 'BLD-breeding_rule.csv',   vis: 'breeding_rule',   authorCol: 'set_by',      dateCol: 'set_at' },
  guest_reading:   { file: 'BLD-guest_reading.csv',   vis: 'guest_reading',   authorCol: 'taken_by',    dateCol: 'taken_at' },
  check_type:      { file: 'BLD-check_type.csv',      vis: 'check_type',      authorCol: 'set_by',      dateCol: 'set_at' },
  check_log:       { file: 'BLD-check_log.csv',       vis: 'check_log',       authorCol: 'taken_by',    dateCol: 'taken_at' },
  qr_tag:          { file: 'BLD-qr_tag.csv',          vis: 'qr_tag',          authorCol: '',            dateCol: '' },
  area_capacity:   { file: 'BLD-area_capacity.csv',   vis: 'area_capacity',   authorCol: '',            dateCol: '' },
  area_access:     { file: 'BLD-area_access.csv',     vis: 'area_access',     authorCol: '',            dateCol: '' },
  litter:          { file: 'BLD-litter.csv',          vis: 'litter',          authorCol: '',            dateCol: '' },
  // the owner types rows here in the Sheet (over_capacity_action = refuse or reason); no row = a reason is required
  capacity_setting: { file: 'BLD-capacity_setting.csv', vis: 'capacity_setting', authorCol: '',          dateCol: '' }
};
