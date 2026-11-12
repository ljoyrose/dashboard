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
var READ_METHODS_ = ['camera', 'typed', 'photo'];   // photo (11 Nov 2026): typed later from a photo. Saved, never shown (Lisa 11 Nov)

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
      'read_method',        // PROPOSED 8 Nov 2026: 'camera' or 'typed'; 'photo' (11 Nov) = typed later from a photo
      'camera_value_changed', // PROPOSED 8 Nov 2026: 'true' if staff changed the number the camera read
      'room_empty',         // PROPOSED 11 Nov 2026 (Lisa): 'yes' = no dog in the room for this slot; blank = not said
      'thermometer_id'      // PROPOSED 11 Nov 2026 (Lisa): which named thermometer, so a room with 2 has 2 readings a slot
    ],
    proposedColumns: ['corrects_id', 'mitigation_note', 'read_method', 'camera_value_changed', 'room_empty', 'thermometer_id'],
    computedColumns: ['applied_limit_id', 'in_range', 'compliant', 'mitigation_required'],
    // thermometer: id -> its area_id (valCol), so a reading can only name a thermometer in its own room
    lookups: [{ name: 'area', file: 'BLD-area.csv', idCol: 'id' }, { name: 'thermometer', file: 'BLD-thermometer.csv', idCol: 'id', valCol: 'area_id' }],
    // Lisa 16 Oct (S02-4): staff see NO past entries, so they cannot point at one. A wrong entry is reported to
    // the owner, who fixes it with the owner edit (or an OWNER code sends a correction row).
    perms: { add: ROLE_ALL, correct: ['OWNER'] },
    ownerEditable: true,
    alwaysPending: false,
    defaultMode: 'direct',   // Lisa 16 Oct: temperature readings go straight in; corrections always wait
    // Lisa 11 Nov 2026 ("remove 7 day limit on readings"): any role may send a period_start older than 7 days, back as
    // far as temperature records are kept (BLD-retention_setting row for section temperature, else the default in
    // Config.gs). Never a future time. taken_at/taken_by still show when it was typed.
    ageCap: { retentionSection: 'temperature', field: 'period_start' },
    // fields the browser may send (everything else is set by the server)
    input: {
      area_id:             { type: 'ref', lookup: 'area', required: true },
      reading_type:        { type: 'enum', values: ['temperature'], dflt: 'temperature' },
      min_c:               { type: 'temp' },   // needed unless room_empty = yes (checkRow)
      max_c:               { type: 'temp' },
      spot_c:              { type: 'temp' },
      period_start:        { type: 'datetime' },
      reset_after_reading: { type: 'bool' },
      mitigation_note:     { type: 'text' },
      read_method:         { type: 'enum', values: READ_METHODS_, dflt: 'typed' },
      camera_value_changed: { type: 'bool' },
      // Lisa 11 Nov 2026: a room with no dog in it. The slot counts as covered and is shown flagged "Room empty", never
      // as non-compliant. A reading is optional then (staff may still read it: a dog may move in later), but both
      // min and max or neither. in_range / compliant stay blank: the save never judges a reading.
      room_empty:          { type: 'enum', values: ['yes'] },
      // Lisa 11 Nov 2026: "room H5/6 has 2 named thermometers". Optional: blank = one reading per room per slot, as before.
      thermometer_id:      { type: 'ref', lookup: 'thermometer' }
    },
    // duplicate guard: same tenant + same area + same thermometer (blank = none named) + same period (morning/afternoon
    // slot sent by the hub) within DUP_WINDOW_MIN of taken_at. Without period_start: same room inside the window.
    dupKey: ['area_id', 'thermometer_id', 'period_start'], dupTimeCol: 'taken_at',
    stamp: function (row, ctx) {
      row.precision_dp = '1';   // Lisa 7 Nov 2026: room temperatures are kept to 1 decimal place
      if (row.min_c !== '' && row.max_c !== '') row[''] = (parseFloat(row.max_c) - parseFloat(row.min_c)).toFixed(1);
      row.taken_at = ctx.nowIso;
      row.taken_by = ctx.who;
    },
    checkRow: function (row, errors, lookups) {
      if (row.thermometer_id && !errors.thermometer_id && !errors.area_id && lookups && lookups.thermometer &&
          lookups.thermometer[row.thermometer_id] !== row.area_id) {
        errors.thermometer_id = 'That thermometer is in another room.';
      }
      if (!errors.min_c && !errors.max_c && !errors.room_empty) {
        if (row.room_empty !== 'yes') {
          if (row.min_c === '') errors.min_c = 'This is needed.';
          if (row.max_c === '') errors.max_c = 'This is needed.';
        } else if ((row.min_c === '') !== (row.max_c === '')) {
          errors[row.min_c === '' ? 'min_c' : 'max_c'] = 'Fill in both lowest and highest, or neither.';
        }
      }
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
    ageCap: { retentionSection: 'temperature', field: 'period_start' },   // as area_reading (Lisa 11 Nov 2026)
    input: {
      area_id:              { type: 'ref', lookup: 'area', required: true },
      min_c:                { type: 'temp', required: true },
      max_c:                { type: 'temp', required: true },
      spot_c:               { type: 'temp' },
      period_start:         { type: 'datetime' },
      read_method:          { type: 'enum', values: READ_METHODS_, dflt: 'typed' },
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

  // ---------------------------------------------------------------- sensor_reading
  // One room's daily low and high from a plug-in sensor (Govee export), added by the OWNER from the year report
  // page (NEW: TEMPS, 11 Nov 2026). A separate file: a sensor day never counts as, or overwrites, a staff reading.
  // samples = how many sensor readings made that day's low and high. Lisa creates the file (header row only);
  // own switch TABLE_ON_sensor_reading, OFF by default. The same room, day and source twice is a repeat, not a new day.
  sensor_reading: {
    key: 'sensor_reading',
    file: 'BLD-sensor_reading.csv',
    idPrefix: 'snr',
    columns: ['id', 'tenant_id', 'area_id', 'day', 'min_c', 'max_c', 'samples', 'source', 'device_label', 'taken_at', 'taken_by'],
    proposedColumns: ['id', 'tenant_id', 'area_id', 'day', 'min_c', 'max_c', 'samples', 'source', 'device_label', 'taken_at', 'taken_by'],
    computedColumns: [],
    lookups: [{ name: 'area', file: 'BLD-area.csv', idCol: 'id' }],
    perms: { add: ['OWNER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      area_id:      { type: 'ref', lookup: 'area', required: true },
      day:          { type: 'date', required: true },
      min_c:        { type: 'temp', required: true },
      max_c:        { type: 'temp', required: true },
      samples:      { type: 'text', required: true },   // checked below: a whole number (a day of minute readings is 1440)
      source:       { type: 'text', required: true },   // e.g. govee
      device_label: { type: 'text' }
    },
    dupKey: ['area_id', 'day', 'source'], dupTimeCol: null,
    stamp: function (row, ctx) { row.taken_at = ctx.nowIso; row.taken_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) {
      if (!errors.samples && row.samples !== '' && !/^\d{1,6}$/.test(row.samples)) errors.samples = 'Use a whole number.';
      if (!errors.min_c && !errors.max_c && row.min_c !== '' && row.max_c !== '' &&
          parseFloat(row.min_c) > parseFloat(row.max_c)) {
        errors.min_c = 'The lowest reading cannot be higher than the highest reading.';
      }
    }
  },

  // ---------------------------------------------------------------- thermometer
  // One thermometer per place (a room or a corridor, never a field), so the round lists the thermometers, not the
  // rooms (NEW: TEMPS, 11 Nov 2026). How many there are is rows, never code. The OWNER adds one; its QR card is made on
  // the print page like a room sign (qr_tag kind thermometer). Readings still save against area_id. A thing carries no
  // dates (Lisa 11 Nov 2026, "A standard"): when it is needed is BLD-requirement rows (need_type reading.temperature).
  // To fix a row the owner edits it in place (name, area_id). Own switch, OFF by default.
  thermometer: {
    key: 'thermometer',
    file: 'BLD-thermometer.csv',
    idPrefix: 'thm',
    columns: ['id', 'tenant_id', 'name', 'area_id', 'made_at', 'made_by'],
    proposedColumns: ['id', 'tenant_id', 'name', 'area_id', 'made_at', 'made_by'],
    computedColumns: [],
    lookups: [{ name: 'area', file: 'BLD-area.csv', idCol: 'id' }],
    perms: { add: ['OWNER'], correct: [] },
    noCorrect: true,
    ownerEditable: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      name:      { type: 'text', required: true },
      area_id:   { type: 'ref', lookup: 'area', required: true }
    },
    dupKey: ['name'], dupTimeCol: null,
    stamp: function (row, ctx) { row.made_at = ctx.nowIso; row.made_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) {
      if (!errors.name && row.name !== '' && row.name.length > 40) errors.name = 'Use 40 characters or fewer.';
    }
  },

  // ---------------------------------------------------------------- requirement
  // Need rows (Lisa 11 Nov 2026, "A standard"): when a thing is needed or in use. need_type is a row value
  // (reading.temperature on a thermometer, room.in_use on an area; more later as rows, never columns). A target with no
  // rows of a need_type is always needed; with rows, only on days a row covers (from_date..to_date, both inclusive,
  // blank to_date = no end). To end one, the owner fills in to_date; rows are never deleted. Own switch, OFF by default.
  requirement: {
    key: 'requirement',
    file: 'BLD-requirement.csv',
    idPrefix: 'req',
    columns: ['id', 'tenant_id', 'need_type', 'target_table', 'target_id', 'from_date', 'to_date', 'source', 'set_by', 'set_on'],
    proposedColumns: ['id', 'tenant_id', 'need_type', 'target_table', 'target_id', 'from_date', 'to_date', 'source', 'set_by', 'set_on'],
    computedColumns: [],
    lookups: [],
    perms: { add: ['OWNER'], correct: [] },
    noCorrect: true,
    ownerEditable: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      need_type:    { type: 'text', required: true },   // e.g. reading.temperature, room.in_use
      target_table: { type: 'text', required: true },   // e.g. thermometer, area
      target_id:    { type: 'text', required: true },
      from_date:    { type: 'date', required: true },
      to_date:      { type: 'date' },                   // blank = no end
      source:       { type: 'text' }                    // why: a licence condition, a document, Lisa's decision
    },
    dupKey: ['need_type', 'target_table', 'target_id', 'from_date'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_on = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) {
      ['need_type', 'target_table', 'target_id'].forEach(function (k) {
        if (!errors[k] && row[k] !== '' && !/^[a-z0-9_.\-]{1,60}$/i.test(row[k])) errors[k] = 'Letters, numbers, dots, dashes or _ only.';
      });
      if (!errors.from_date && !errors.to_date && row.from_date && row.to_date && row.to_date < row.from_date) errors.to_date = 'The end date cannot be before the start date.';
    }
  },

  // ---------------------------------------------------------------- area_link
  // Room links (Lisa 12 Nov 2026, option B via NEW: TEMPS): for from_date..to_date (both inclusive, blank to_date =
  // no end) a reading taken in from_area_id also counts for to_area_id, e.g. while one thermometer covers two rooms.
  // A link row, never dates on the room ("A standard"); readings are never copied or changed, the pages count them
  // through BLDAreaLink.expand. To end one, the owner fills in to_date; rows are never deleted. Own switch, OFF by default.
  area_link: {
    key: 'area_link',
    file: 'BLD-area_link.csv',
    idPrefix: 'alk',
    columns: ['id', 'tenant_id', 'from_area_id', 'to_area_id', 'from_date', 'to_date', 'source', 'set_by', 'set_on'],
    proposedColumns: ['id', 'tenant_id', 'from_area_id', 'to_area_id', 'from_date', 'to_date', 'source', 'set_by', 'set_on'],
    computedColumns: [],
    lookups: [{ name: 'area', file: 'BLD-area.csv', idCol: 'id' }],
    perms: { add: ['OWNER'], correct: [] },
    noCorrect: true,
    ownerEditable: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      from_area_id: { type: 'ref', lookup: 'area', required: true },   // the room the reading is taken in
      to_area_id:   { type: 'ref', lookup: 'area', required: true },   // the room it also counts for
      from_date:    { type: 'date', required: true },
      to_date:      { type: 'date' },                                  // blank = no end
      source:       { type: 'text' }                                   // why: Lisa's decision, an inspector's note
    },
    dupKey: ['from_area_id', 'to_area_id', 'from_date'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_on = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) {
      if (!errors.to_area_id && row.from_area_id && row.from_area_id === row.to_area_id) errors.to_area_id = 'Choose a different room.';
      if (!errors.from_date && !errors.to_date && row.from_date && row.to_date && row.to_date < row.from_date) errors.to_date = 'The end date cannot be before the start date.';
    }
  },

  // ---------------------------------------------------------------- check_type
  // The kennel's own list of staff checks (feeding, medicine, cleaning...): entered by the OWNER as rows, never
  // hard-coded, because they differ by kennel. NEW table, own switch, OFF by default. A change is a new row with a
  // later effective_from, so an old entry keeps pointing at the version in force when it was made. target tells the
  // screen what to ask for: a room, a dog, either, optional (may name one, need not), or neither. The label, note and
  // outcome columns set the wording and what is compulsory, so a new kind of check needs no code. active=false retires a check from that date.
  check_type: {
    key: 'check_type',
    file: 'BLD-check_type.csv',
    idPrefix: 'cty',
    columns: ['id', 'tenant_id', 'type_key', 'label', 'target', 'asks_item', 'item_label', 'asks_amount', 'amount_unit', 'note_label', 'note_required', 'asks_outcome', 'frequency',
              'active', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'every_days', 'group', 'includes', 'sop', 'evidence', 'site_scope', 'not_in_areas', 'only_in_areas'],
    proposedColumns: ['type_key', 'label', 'target', 'asks_item', 'item_label', 'asks_amount', 'amount_unit', 'note_label', 'note_required', 'asks_outcome', 'frequency',
                      'active', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'every_days', 'group', 'includes', 'sop', 'evidence', 'site_scope', 'not_in_areas', 'only_in_areas'],
    computedColumns: [],
    lookups: [],
    perms: { add: ['OWNER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      type_key:       { type: 'text', required: true },
      label:          { type: 'text', required: true },
      target:         { type: 'enum', values: ['area', 'dog', 'either', 'optional', 'none', 'litter'], required: true },   // litter (12 Nov 2026): a litter's jobs, opened from its tag
      asks_item:      { type: 'bool', dflt: 'false' },
      asks_amount:    { type: 'bool', dflt: 'false' },
      item_label:     { type: 'text' },
      amount_unit:    { type: 'text' },
      note_label:     { type: 'text' },
      note_required:  { type: 'bool', dflt: 'false' },
      asks_outcome:   { type: 'bool', dflt: 'true' },
      frequency:      { type: 'text' },
      active:         { type: 'bool', dflt: 'true' },
      effective_from: { type: 'date', required: true },
      source:         { type: 'text' },
      note:           { type: 'text' },
      every_days:     { type: 'count' },                                            // days between jobs; blank = as needed
      group:          { type: 'text' },                                             // the phone button it sits under, e.g. a sub-menu
      includes:       { type: 'text' },                                             // type_keys this job also covers, separated by |
      sop:            { type: 'text' },                                             // the SOP's short name
      evidence:       { type: 'enum', values: ['none', 'optional', 'required'], dflt: 'none' },
      site_scope:     { type: 'enum', values: ['one_line', 'per_dog'] },            // target none or area: what one tap writes
      not_in_areas:   { type: 'text' },                                             // per_dog: room ids a whole-site tap never covers (isolation), by |, or none
      only_in_areas:  { type: 'text' }                                              // a room job for these rooms only (e.g. isolation), by |; blank = every room
    },
    dupKey: ['type_key', 'effective_from'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_at = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) {
      if (!errors.type_key && row.type_key !== '' && !/^[a-z][a-z0-9_]{1,39}$/.test(row.type_key)) {
        errors.type_key = 'Use lower-case letters, numbers and underscores, e.g. feeding.';
      }
      if (!errors.every_days && row.every_days === '0') errors.every_days = 'Use 1 or more, or leave blank for as needed.';
      if (!errors.includes && row.includes !== '') {
        var keys = row.includes.split('|').map(function (k) { return k.trim(); }).filter(String), bad = false, self = false;
        keys.forEach(function (k) { if (!/^[a-z][a-z0-9_]{1,39}$/.test(k)) bad = true; if (k === row.type_key) self = true; });
        if (bad) errors.includes = 'List check names separated by |, e.g. nails|ears.';
        else if (self) errors.includes = 'A check cannot include itself.';
        else row.includes = keys.join('|');
      }
      if (!errors.site_scope && row.site_scope !== '' && row.target !== 'none' && row.target !== 'area') errors.site_scope = 'Only for a whole-site or room check.';
      if (!errors.not_in_areas && row.target === 'none' && row.site_scope === 'per_dog' && row.not_in_areas === '') {
        errors.not_in_areas = 'List the isolation rooms this tap must never cover, separated by |, or type none.';
      }
      if (!errors.only_in_areas && row.only_in_areas !== '') {
        var rooms = row.only_in_areas.split('|').map(function (a) { return a.trim(); }).filter(String);
        if (row.target !== 'area') errors.only_in_areas = 'Only for a room job.';
        else if (!rooms.length || rooms.some(function (a) { return !ID_RE_.test(a); })) errors.only_in_areas = 'List room ids separated by |, e.g. area-h2-iso.';
        else row.only_in_areas = rooms.join('|');
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
      // SOP jobs, 12 Nov 2026: a whole-site job whose includes names a room job restarts that job in every room, so it
      // must say which rooms it never covers (isolation), as a per_dog tap must. A room job = its latest row has target area.
      if (clean.target === 'none' && clean.includes && !clean.not_in_areas && !errors.includes && !errors.not_in_areas) {
        var latest = {};
        records.forEach(function (r) { if (!latest[r.type_key] || (r.effective_from || '') > (latest[r.type_key].effective_from || '')) latest[r.type_key] = r; });
        if (clean.includes.split('|').some(function (k) { return latest[k] && latest[k].target === 'area'; })) {
          errors.not_in_areas = 'This covers room jobs. List the isolation rooms it must never cover, separated by |, or type none.';
        }
      }
    }
  },

  // ---------------------------------------------------------------- check_field
  // A check's form (SOP jobs, 12 Nov 2026): one row per question, so a form is rows, never code. Versioned like
  // check_type: a change is a NEW row with a later effective_from; the row in force on a day is the latest one with
  // effective_from on or before it, and active=false drops the question from that date. kind says what is typed;
  // choice lists its answers in choices, separated by |. The answers go to check_value, sent with the check_log row.
  // OWNER only, own switch, OFF by default.
  check_field: {
    key: 'check_field',
    file: 'BLD-check_field.csv',
    idPrefix: 'cfd',
    columns: ['id', 'tenant_id', 'type_key', 'field_key', 'label', 'kind', 'choices', 'required', 'sort', 'active', 'effective_from', 'set_at', 'set_by'],
    proposedColumns: ['id', 'tenant_id', 'type_key', 'field_key', 'label', 'kind', 'choices', 'required', 'sort', 'active', 'effective_from', 'set_at', 'set_by'],
    computedColumns: [],
    lookups: [{ name: 'check_type_key', file: 'BLD-check_type.csv', idCol: 'type_key' }],
    perms: { add: ['OWNER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      type_key:       { type: 'text', required: true },                              // the check (check_type.type_key) this question belongs to
      field_key:      { type: 'text', required: true },                              // the question's short name, e.g. stool
      label:          { type: 'text', required: true },                              // what staff read
      kind:           { type: 'enum', values: ['text', 'number', 'date', 'yesno', 'choice'], required: true },
      choices:        { type: 'text' },                                              // choice only: answers separated by |
      required:       { type: 'bool', dflt: 'false' },
      sort:           { type: 'count' },                                             // order on the screen
      active:         { type: 'bool', dflt: 'true' },
      effective_from: { type: 'date', required: true }
    },
    dupKey: ['type_key', 'field_key', 'effective_from'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_at = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors, lookups) {
      ['type_key', 'field_key'].forEach(function (k) {
        if (!errors[k] && row[k] !== '' && !/^[a-z][a-z0-9_]{1,39}$/.test(row[k])) errors[k] = 'Use lower-case letters, numbers and underscores, e.g. stool.';
      });
      if (!errors.type_key && row.type_key && lookups && lookups.check_type_key && !lookups.check_type_key[row.type_key]) errors.type_key = 'No check with that name.';
      if (!errors.choices && !errors.kind) {
        var list = String(row.choices || '').split('|').map(function (c) { return c.trim(); }).filter(String);
        if (row.kind === 'choice' && list.length < 2) errors.choices = 'List at least two answers, separated by |.';
        else if (row.kind !== 'choice' && list.length) errors.choices = 'Only a choice question has answers to pick from.';
        else if (list.length > 30) errors.choices = 'Keep it to 30 answers or fewer.';
        else row.choices = list.join('|');
      }
    },
    checkAgainst: function (clean, records, errors) {
      if (errors.type_key || errors.field_key || errors.effective_from) return;
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type_key === clean.type_key && r.field_key === clean.field_key && (r.effective_from || '') >= clean.effective_from) {
          errors.effective_from = 'This question already has a version from ' + r.effective_from + '. A change must start after that date.';
          return;
        }
      }
    }
  },

  // ---------------------------------------------------------------- check_value
  // The answers to a check's form: one row per answer, pointing at the check_log row and the exact check_field
  // version asked. Never sent on its own: the save writes these with the check_log row (Sink.gs formRows_), all or
  // none. Own switch, OFF by default; while it is off, a check_log save with answers is refused.
  check_value: {
    key: 'check_value',
    file: 'BLD-check_value.csv',
    idPrefix: 'cvl',
    columns: ['id', 'tenant_id', 'check_log_id', 'check_field_id', 'field_key', 'value'],
    proposedColumns: ['id', 'tenant_id', 'check_log_id', 'check_field_id', 'field_key', 'value'],
    computedColumns: [],
    lookups: [],
    perms: { add: [], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {},
    dupKey: [], dupTimeCol: null,
    stamp: function () {}
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
              'note', 'taken_at', 'taken_by', 'corrects_id', 'photo', 'how_recorded', 'litter_id'],
    proposedColumns: ['check_type_id', 'area_id', 'subject_id', 'item', 'amount', 'outcome', 'happened_at',
                      'note', 'taken_at', 'taken_by', 'corrects_id', 'photo', 'how_recorded', 'litter_id'],
    computedColumns: [],
    lookups: [
      { name: 'check_type', file: 'BLD-check_type.csv', idCol: 'id' },
      { name: 'check_type_only', file: 'BLD-check_type.csv', idCol: 'id', valCol: 'only_in_areas' },
      { name: 'area', file: 'BLD-area.csv', idCol: 'id' },
      { name: 'subject', file: 'BLD-subject.csv', idCol: 'id' },
      { name: 'litter', file: 'BLD-litter.csv', idCol: 'id' }
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
      outcome:       { type: 'enum', values: ['ok', 'concern', 'not_done', 'recorded'], required: true },   // recorded = a report, such as an incident, with no pass or fail
      happened_at:   { type: 'datetime' },
      note:          { type: 'text' },
      photo:         { type: 'text' },                                              // where the photo is kept; a saved photo is evidence, a scan is not
      how_recorded:  { type: 'enum', values: ['scanned', 'tapped', 'typed', 'site_tap'] },      // scanned = opened from a tag: it says which screen, not that anyone was there
      litter_id:     { type: 'ref', lookup: 'litter' }                              // 12 Nov 2026: a litter job (check_type target litter)
    },
    dupKey: ['check_type_id', 'area_id', 'subject_id', 'litter_id', 'item'], dupTimeCol: 'taken_at',
    stamp: function (row, ctx) { row.taken_at = ctx.nowIso; row.taken_by = ctx.who; },
    checkRow: function (row, errors, lookups) {
      if ((row.outcome === 'concern' || row.outcome === 'not_done') && row.note === '' && !errors.note) {
        errors.note = 'Say briefly what the concern is or why it was not done.';
      }
      // a room job for some rooms only (check_type.only_in_areas): never saved for another room
      var only = lookups && lookups.check_type_only ? lookups.check_type_only[row.check_type_id] : true;
      if (!errors.area_id && row.area_id && typeof only === 'string' && only.split('|').indexOf(row.area_id) < 0) {
        errors.area_id = 'This job is not for this room.';
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
      kind:   { type: 'enum', values: ['area', 'subject', 'litter', 'site', 'thermometer'], required: true },   // site = the one premises code
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
    // to_date (Lisa 12 Nov 2026: every limit is a dated row): blank = no end; the last day the rule applies, inclusive.
    columns: ['id', 'tenant_id', 'rule_key', 'value', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'to_date'],
    proposedColumns: ['rule_key', 'value', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'to_date'],
    computedColumns: [],
    lookups: [],
    perms: { add: ['OWNER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      // any key (overseer 12 Nov 2026 sweep): size_from_kg.*, size_colour.*, compliance.*, staffing.*, room.* are rows too.
      // Only the keys in BREEDING_RULE_LIMITS_ are checked as whole numbers with a usual range.
      rule_key:       { type: 'text', required: true },
      value:          { type: 'text', required: true },
      effective_from: { type: 'date', required: true },
      to_date:        { type: 'date' },
      source:         { type: 'text' },
      note:           { type: 'text' },
      // not a column: "yes" keeps a value outside the usual range (overseer 12 Nov 2026: a council may allow it)
      confirm_unusual: { type: 'enum', values: ['yes'] }
    },
    // the same rule given twice from the same date is a repeat tap
    dupKey: ['rule_key', 'effective_from'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_at = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) {
      if (row.to_date && row.effective_from && !errors.to_date && !errors.effective_from && row.to_date < row.effective_from) {
        errors.to_date = 'The end date cannot be before the start date.';
      }
      if (row.rule_key && !/^[a-z][a-z0-9_.\-]{1,99}$/.test(row.rule_key)) errors.rule_key = 'Use lower-case letters, numbers, dots, dashes and underscores, e.g. size_from_kg.medium.';
      var lim = BREEDING_RULE_LIMITS_[row.rule_key];
      if (lim && row.value !== '' && !errors.value) {
        if (!/^\d{1,3}$/.test(row.value)) errors.value = 'Use a whole number from 0 to 999.';
        else row.value = String(parseInt(row.value, 10));
      }
      if (lim && !errors.value && row.value !== '') {
        var n = parseInt(row.value, 10);
        if ((n < lim[0] || n > lim[1]) && row.confirm_unusual !== 'yes') {
          errors.value = 'Unusual value: the usual range is ' + lim[0] + ' to ' + lim[1] + ' ' + lim[2] + '. Check the number, or save anyway.';
          errors.confirm_unusual = 'Save anyway?';   // the page shows a "Save anyway" button and sends confirm_unusual = yes
        }
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

/** Usual bounds for each breeding rule, so a typo (e.g. 120 months) is caught: [lowest, highest, unit]. Outside them
 *  is a warning, not a stop: confirm_unusual = yes saves it (a council may allow other values). */
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
  var out = [BLD.PENDING_FILE].concat(inspectFiles_()).concat(dogcardFiles_());   // dog card saves (Dogcard.gs), each behind its own switch   // inspector link files: written only by the owner's make-link and the visit log
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
  check_field:     { file: 'BLD-check_field.csv',     vis: 'check_field',     authorCol: 'set_by',      dateCol: 'set_at' },
  check_value:     { file: 'BLD-check_value.csv',     vis: 'check_value',     authorCol: '',            dateCol: '' },
  qr_tag:          { file: 'BLD-qr_tag.csv',          vis: 'qr_tag',          authorCol: '',            dateCol: '' },
  area_capacity:   { file: 'BLD-area_capacity.csv',   vis: 'area_capacity',   authorCol: '',            dateCol: '' },
  area_access:     { file: 'BLD-area_access.csv',     vis: 'area_access',     authorCol: '',            dateCol: '' },
  litter:          { file: 'BLD-litter.csv',          vis: 'litter',          authorCol: '',            dateCol: '' },
  // health results (12 Nov 2026, for inspector links; staff and owner still need visibility rows, none planned)
  health_screen:   { file: 'BLD-health_screen.csv',   vis: 'health_screen',   authorCol: '',            dateCol: '' },
  fit_to_breed:    { file: 'BLD-fit_to_breed.csv',    vis: 'fit_to_breed',    authorCol: '',            dateCol: '' },
  // 12 Nov 2026 (DOGCARD): the kennel print card shows Colour and Microchip. Read only as far as visibility rows
  // allow; the planned rows are for aud-admin (the owner) only.
  coat_colour:     { file: 'BLD-coat_colour.csv',     vis: 'coat_colour',     authorCol: '',            dateCol: '' },
  coat_pattern:    { file: 'BLD-coat_pattern.csv',    vis: 'coat_pattern',    authorCol: '',            dateCol: '' },
  nose_pigment:    { file: 'BLD-nose_pigment.csv',    vis: 'nose_pigment',    authorCol: '',            dateCol: '' },
  microchip:       { file: 'BLD-microchip.csv',       vis: 'microchip',       authorCol: '',            dateCol: '' },
  // temperature limits by age (and, if area_id is filled, for one room): rows Lisa enters, read by the staff page
  temperature_band: { file: 'BLD-temperature_band.csv', vis: 'temperature_band', authorCol: '',          dateCol: '' },
  sensor_reading:  { file: 'BLD-sensor_reading.csv',  vis: 'sensor_reading',  authorCol: 'taken_by',    dateCol: 'taken_at' },
  thermometer:     { file: 'BLD-thermometer.csv',     vis: 'thermometer',     authorCol: 'made_by',     dateCol: 'made_at' },
  requirement:     { file: 'BLD-requirement.csv',     vis: 'requirement',     authorCol: 'set_by',      dateCol: 'set_on' },
  area_link:       { file: 'BLD-area_link.csv',       vis: 'area_link',       authorCol: 'set_by',      dateCol: 'set_on' },
  // the owner types rows here in the Sheet (over_capacity_action = refuse or reason); no row = a reason is required
  capacity_setting: { file: 'BLD-capacity_setting.csv', vis: 'capacity_setting', authorCol: '',          dateCol: '' },
  // 12 Nov 2026 (Lisa): size is worked out from the latest weight, never kept as its own field. The room scan needs
  // the weights to do that; read only as far as visibility rows allow (one row: table_name weight, staff, all rows).
  weight:          { file: 'BLD-weight.csv',          vis: 'weight',          authorCol: '',            dateCol: 'performed_on' }
};
