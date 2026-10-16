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

/** The default allow-list: the temperature log (plus the approvals queue, see Config.gs PENDING_FILE). */
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
      'area_id', 'reading_type', 'min_c', 'max_c', 'spot_c', 'precision_dp',
      'period_start', 'taken_at', 'taken_by', 'device_id', 'reset_after_reading',
      'applied_limit_id', 'in_range', 'compliant', 'mitigation_required',
      'corrects_id',        // PROPOSED: pointer to the row this one corrects
      'mitigation_note'     // PROPOSED: what was done when a reading is out of band
    ],
    proposedColumns: ['corrects_id', 'mitigation_note'],
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
      mitigation_note:     { type: 'text' }
    },
    // duplicate guard: same tenant + same area within DUP_WINDOW_MIN of taken_at
    dupKey: ['area_id'], dupTimeCol: 'taken_at',
    stamp: function (row, ctx) {
      row.precision_dp = '2';
      row.taken_at = ctx.nowIso;
      row.taken_by = ctx.who;
    },
    checkRow: function (row, errors) {
      if (!errors.min_c && !errors.max_c && row.min_c !== '' && row.max_c !== '' &&
          parseFloat(row.min_c) > parseFloat(row.max_c)) {
        errors.min_c = 'The lowest reading cannot be higher than the highest reading.';
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
      area_id:    { type: 'ref', lookup: 'area', required: true }
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
  }
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
  for (var k in TABLES) if (Object.prototype.hasOwnProperty.call(TABLES, k)) out.push(TABLES[k].file);
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
  occupancy_check: { file: 'BLD-occupancy_check.csv', vis: 'occupancy_check', authorCol: 'confirmed_by', dateCol: 'confirmed_at' }
};
