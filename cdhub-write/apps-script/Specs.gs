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
    perms: { add: ROLE_ALL, correct: ROLE_ALL },
    alwaysPending: false,
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
  },

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

/** Resolve a table key or an exact file name to a spec. Anything else is refused. */
function specFor_(keyOrFile) {
  var k;
  for (k in TABLES) {
    if (!Object.prototype.hasOwnProperty.call(TABLES, k)) continue;
    if (TABLES[k].key === keyOrFile || TABLES[k].file === keyOrFile) return TABLES[k];
  }
  return null;
}

/** The complete list of file names the sink can ever write to. */
function allowedFiles_() {
  var out = [BLD.PENDING_FILE];
  for (var k in TABLES) if (Object.prototype.hasOwnProperty.call(TABLES, k)) out.push(TABLES[k].file);
  return out;
}
