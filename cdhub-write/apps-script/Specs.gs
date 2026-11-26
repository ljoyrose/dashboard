var ROLE_ALL = ['USER', 'STAFF', 'VET', 'TRAINER'];
var ROLE_GUEST = 'GUEST';

var READ_METHODS_ = ['camera', 'typed', 'photo'];

var TABLES = {

  area_reading: {
    key: 'area_reading',
    file: 'BLD-area_reading.csv',
    idPrefix: 'rdg',
    columns: [
      'id', 'tenant_id',
      'area_id', 'reading_type', 'min_c', 'max_c', '', 'spot_c', 'precision_dp',
      'period_start', 'taken_at', 'taken_by', 'device_id', 'reset_after_reading',
      'applied_limit_id', 'in_range', 'compliant', 'mitigation_required',
      'corrects_id',
      'mitigation_note',
      'read_method',
      'camera_value_changed',
      'room_empty',
      'thermometer_id'
    ],
    proposedColumns: ['corrects_id', 'mitigation_note', 'read_method', 'camera_value_changed', 'room_empty', 'thermometer_id'],
    computedColumns: ['applied_limit_id', 'in_range', 'compliant', 'mitigation_required'],
    sheetTypes: { min_c: 'num1', max_c: 'num1', '': 'num1', variance_c: 'num1', spot_c: 'num1', precision_dp: 'int', period_start: 'datetime', taken_at: 'datetime' },
    lookups: [{ name: 'area', file: 'BLD-area.csv', idCol: 'id' }, { name: 'thermometer', file: 'BLD-thermometer.csv', idCol: 'id', valCol: 'area_id' }],
    perms: { add: ROLE_ALL, correct: ['USER'] },
    userEditable: true,
    alwaysPending: false,
    defaultMode: 'direct',
    ageCap: { retentionSection: 'temperature', field: 'period_start' },
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
      room_empty:          { type: 'enum', values: ['yes'] },
      thermometer_id:      { type: 'ref', lookup: 'thermometer' }
    },
    dupKey: ['area_id', 'thermometer_id', 'period_start'], dupTimeCol: 'taken_at',
    fastAppend: true,
    stamp: function (row, ctx) {
      row.precision_dp = '1';
      if (row.min_c !== '' && row.max_c !== '') row[''] = (parseFloat(row.max_c) - parseFloat(row.min_c)).toFixed(1);   // the 7th column (blank or variance_c)
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
      if (!errors.min_c && !errors.max_c) {
        var pairMsg_ = tempPairError_(row.min_c, row.max_c);
        if (pairMsg_) errors.min_c = pairMsg_;
      }
      checkReadMethod_(row, errors);
    }
  },

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
    ageCap: { retentionSection: 'temperature', field: 'period_start' },
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
      if (!errors.min_c && !errors.max_c) {
        var pairMsg_ = tempPairError_(row.min_c, row.max_c);
        if (pairMsg_) errors.min_c = pairMsg_;
      }
      checkReadMethod_(row, errors);
    }
  },

  sensor_reading: {
    key: 'sensor_reading',
    file: 'BLD-sensor_reading.csv',
    idPrefix: 'snr',
    columns: ['id', 'tenant_id', 'area_id', 'day', 'min_c', 'max_c', 'samples', 'source', 'device_label', 'taken_at', 'taken_by'],
    proposedColumns: ['id', 'tenant_id', 'area_id', 'day', 'min_c', 'max_c', 'samples', 'source', 'device_label', 'taken_at', 'taken_by'],
    computedColumns: [],
    lookups: [{ name: 'area', file: 'BLD-area.csv', idCol: 'id' }],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      area_id:      { type: 'ref', lookup: 'area', required: true },
      day:          { type: 'date', required: true },
      min_c:        { type: 'temp', required: true },
      max_c:        { type: 'temp', required: true },
      samples:      { type: 'text', required: true },
      source:       { type: 'text', required: true },
      device_label: { type: 'text' }
    },
    dupKey: ['area_id', 'day', 'source'], dupTimeCol: null,
    stamp: function (row, ctx) { row.taken_at = ctx.nowIso; row.taken_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) {
      if (!errors.samples && row.samples !== '' && !/^\d{1,6}$/.test(row.samples)) errors.samples = 'Use a whole number.';
      if (!errors.min_c && !errors.max_c) {
        var pairMsg_ = tempPairError_(row.min_c, row.max_c);
        if (pairMsg_) errors.min_c = pairMsg_;
      }
    }
  },

  thermometer: {
    key: 'thermometer',
    file: 'BLD-thermometer.csv',
    idPrefix: 'thm',
    qrKind: 'thermometer',
    columns: ['id', 'tenant_id', 'name', 'area_id', 'made_at', 'made_by'],
    proposedColumns: ['id', 'tenant_id', 'name', 'area_id', 'made_at', 'made_by'],
    computedColumns: [],
    lookups: [{ name: 'area', file: 'BLD-area.csv', idCol: 'id' }],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    userEditable: true,
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

  requirement: {
    key: 'requirement',
    file: 'BLD-requirement.csv',
    idPrefix: 'req',
    columns: ['id', 'tenant_id', 'need_type', 'target_table', 'target_id', 'from_date', 'to_date', 'source', 'set_by', 'set_on'],
    proposedColumns: ['id', 'tenant_id', 'need_type', 'target_table', 'target_id', 'from_date', 'to_date', 'source', 'set_by', 'set_on'],
    computedColumns: [],
    lookups: [],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    userEditable: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      need_type:    { type: 'text', required: true },
      target_table: { type: 'text', required: true },
      target_id:    { type: 'text', required: true },
      from_date:    { type: 'date', required: true },
      to_date:      { type: 'date' },                   // blank = no end
      source:       { type: 'text' }
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

  area_link: {
    key: 'area_link',
    file: 'BLD-area_link.csv',
    idPrefix: 'alk',
    columns: ['id', 'tenant_id', 'from_area_id', 'to_area_id', 'from_date', 'to_date', 'source', 'set_by', 'set_on'],
    proposedColumns: ['id', 'tenant_id', 'from_area_id', 'to_area_id', 'from_date', 'to_date', 'source', 'set_by', 'set_on'],
    computedColumns: [],
    lookups: [{ name: 'area', file: 'BLD-area.csv', idCol: 'id' }],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    userEditable: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      from_area_id: { type: 'ref', lookup: 'area', required: true },
      to_area_id:   { type: 'ref', lookup: 'area', required: true },   // the room it also counts for
      from_date:    { type: 'date', required: true },
      to_date:      { type: 'date' },                                  // blank = no end
      source:       { type: 'text' }
    },
    dupKey: ['from_area_id', 'to_area_id', 'from_date'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_on = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) {
      if (!errors.to_area_id && row.from_area_id && row.from_area_id === row.to_area_id) errors.to_area_id = 'Choose a different room.';
      if (!errors.from_date && !errors.to_date && row.from_date && row.to_date && row.to_date < row.from_date) errors.to_date = 'The end date cannot be before the start date.';
    }
  },

  check_type: {
    key: 'check_type',
    file: 'BLD-check_type.csv',
    idPrefix: 'cty',
    columns: ['id', 'tenant_id', 'type_key', 'label', 'target', 'asks_item', 'item_label', 'asks_amount', 'amount_unit', 'note_label', 'note_required', 'asks_outcome', 'frequency',
              'active', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'every_days', 'group', 'includes', 'sop', 'evidence', 'site_scope', 'not_in_areas', 'only_in_areas', 'item_kind', 'only_groups'],
    proposedColumns: ['type_key', 'label', 'target', 'asks_item', 'item_label', 'asks_amount', 'amount_unit', 'note_label', 'note_required', 'asks_outcome', 'frequency',
                      'active', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'every_days', 'group', 'includes', 'sop', 'evidence', 'site_scope', 'not_in_areas', 'only_in_areas', 'item_kind', 'only_groups'],
    computedColumns: [],
    lookups: [],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      type_key:       { type: 'text', required: true },
      label:          { type: 'text', required: true },
      target:         { type: 'enum', values: ['area', 'dog', 'either', 'optional', 'none', 'litter', 'item'], required: true },
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
      every_days:     { type: 'count' },
      group:          { type: 'text' },
      includes:       { type: 'text' },
      sop:            { type: 'text' },                                             // the SOP's short name
      evidence:       { type: 'enum', values: ['none', 'optional', 'required'], dflt: 'none' },
      site_scope:     { type: 'enum', values: ['one_line', 'per_dog'] },
      not_in_areas:   { type: 'text' },
      only_in_areas:  { type: 'text' },
      item_kind:      { type: 'text' },
      only_groups:    { type: 'text' }
    },
    dupKey: ['type_key', 'effective_from'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_at = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) {
      if (!errors.type_key && row.type_key !== '' && !/^(round\.)?[a-z][a-z0-9_]{1,39}$/.test(row.type_key)) {
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
      if (!errors.item_kind && row.item_kind !== '') {
        if (row.target !== 'item') errors.item_kind = 'Only for an item test.';
        else if (!/^[a-z][a-z0-9_]{1,39}$/.test(row.item_kind)) errors.item_kind = 'Use the kind\'s short name, e.g. appliance_class_1.';
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
      if (clean.target === 'none' && clean.includes && !clean.not_in_areas && !errors.includes && !errors.not_in_areas) {
        var latest = {};
        records.forEach(function (r) { if (!latest[r.type_key] || (r.effective_from || '') > (latest[r.type_key].effective_from || '')) latest[r.type_key] = r; });
        if (clean.includes.split('|').some(function (k) { return latest[k] && latest[k].target === 'area'; })) {
          errors.not_in_areas = 'This covers room jobs. List the isolation rooms it must never cover, separated by |, or type none.';
        }
      }
    }
  },

  check_field: {
    key: 'check_field',
    file: 'BLD-check_field.csv',
    idPrefix: 'cfd',
    columns: ['id', 'tenant_id', 'type_key', 'field_key', 'label', 'kind', 'choices', 'required', 'sort', 'active', 'effective_from', 'set_at', 'set_by', 'unit', 'limit_low', 'limit_high', 'source'],
    proposedColumns: ['id', 'tenant_id', 'type_key', 'field_key', 'label', 'kind', 'choices', 'required', 'sort', 'active', 'effective_from', 'set_at', 'set_by', 'unit', 'limit_low', 'limit_high', 'source'],
    computedColumns: [],
    lookups: [{ name: 'check_type_key', file: 'BLD-check_type.csv', idCol: 'type_key' }],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      type_key:       { type: 'text', required: true },
      field_key:      { type: 'text', required: true },
      label:          { type: 'text', required: true },                              // what staff read
      kind:           { type: 'enum', values: ['text', 'number', 'date', 'yesno', 'choice'], required: true },
      choices:        { type: 'text' },                                              // choice only: answers separated by |
      required:       { type: 'bool', dflt: 'false' },
      sort:           { type: 'count' },                                             // order on the screen
      active:         { type: 'bool', dflt: 'true' },
      effective_from: { type: 'date', required: true },
      unit:           { type: 'text' },
      limit_low:      { type: 'text' },
      limit_high:     { type: 'text' },
      source:         { type: 'text' }
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
      ['limit_low', 'limit_high'].forEach(function (k) {
        if (errors[k] || row[k] === '') return;
        if (row.kind !== 'number') errors[k] = 'Only a number question has limits.';
        else if (!/^-?\d{1,7}(\.\d{1,3})?$/.test(row[k])) errors[k] = 'Type a number, e.g. 0.1.';
      });
      if (!errors.limit_low && !errors.limit_high && row.limit_low !== '' && row.limit_high !== '' && parseFloat(row.limit_low) > parseFloat(row.limit_high)) errors.limit_high = 'The upper limit cannot be below the lower one.';
      if (!errors.unit && row.unit !== '' && row.kind !== 'number') errors.unit = 'Only a number question has a unit.';
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

  check_log: {
    key: 'check_log',
    file: 'BLD-check_log.csv',
    idPrefix: 'clg',
    columns: ['id', 'tenant_id', 'check_type_id', 'area_id', 'subject_id', 'item', 'amount', 'outcome', 'happened_at',
              'note', 'taken_at', 'taken_by', 'corrects_id', 'photo', 'how_recorded', 'litter_id', 'note_for_id',
              'item_id', 'time_given', 'grant_id', 'counts_due', 'covered_ids', 'exceptions'],
    proposedColumns: ['check_type_id', 'area_id', 'subject_id', 'item', 'amount', 'outcome', 'happened_at',
                      'note', 'taken_at', 'taken_by', 'corrects_id', 'photo', 'how_recorded', 'litter_id', 'note_for_id',
                      'item_id', 'time_given', 'grant_id', 'counts_due', 'covered_ids', 'exceptions'],
    computedColumns: [],
    lookups: [
      { name: 'check_type', file: 'BLD-check_type.csv', idCol: 'id' },
      { name: 'check_type_key', file: 'BLD-check_type.csv', idCol: 'id', valCol: 'type_key' },
      { name: 'check_type_only', file: 'BLD-check_type.csv', idCol: 'id', valCol: 'only_in_areas' },
      { name: 'area', file: 'BLD-area.csv', idCol: 'id' },
      { name: 'subject', file: 'BLD-subject.csv', idCol: 'id' },
      { name: 'litter', file: 'BLD-litter.csv', idCol: 'id' },
      { name: 'check_log_outcome', file: 'BLD-check_log.csv', idCol: 'id', valCol: 'outcome', onlyIfField: 'note_for_id' },
      { name: 'check_type_target', file: 'BLD-check_type.csv', idCol: 'id', valCol: 'target' },
      { name: 'check_type_item_kind', file: 'BLD-check_type.csv', idCol: 'id', valCol: 'item_kind' },
      { name: 'items', file: 'BLD-items.csv', idCol: 'id', valCol: 'kind_key' }
    ],
    perms: { add: ['USER', 'STAFF'], correct: ['USER'] },
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      check_type_id: { type: 'ref', lookup: 'check_type', required: true },
      area_id:       { type: 'ref', lookup: 'area' },
      subject_id:    { type: 'ref', lookup: 'subject' },
      item:          { type: 'text' },
      amount:        { type: 'text' },
      outcome:       { type: 'enum', values: ['ok', 'concern', 'not_done', 'recorded', 'note', 'part_done'], required: true },
      happened_at:   { type: 'datetime' },
      note:          { type: 'text' },
      photo:         { type: 'text' },
      how_recorded:  { type: 'enum', values: ['scanned', 'tapped', 'typed', 'site_tap', 'paper', 'bulk', 'import'] },
      litter_id:     { type: 'ref', lookup: 'litter' },
      note_for_id:   { type: 'text' },
      item_id:       { type: 'ref', lookup: 'items' },
      time_given:    { type: 'enum', values: ['false'] },
      covered_ids:  { type: 'idlist', lookup: 'subject' },
      exceptions:   { type: 'text', max: 8000 }
    },
    dupKey: ['check_type_id', 'area_id', 'subject_id', 'litter_id', 'item_id', 'item', 'outcome', 'covered_ids', 'exceptions'], dupTimeCol: 'taken_at',
    dupNewestBy: ['check_type_id', 'area_id', 'subject_id', 'litter_id', 'item_id'],
    fastAppend: true,
    dupDateCols: ['happened_at'],
    dupSkip: function (r) { return r.outcome === 'note'; },
    stamp: function (row, ctx) { row.taken_at = ctx.nowIso; row.taken_by = ctx.who; },
    checkRow: function (row, errors, lookups) {
      if ((row.outcome === 'concern' || row.outcome === 'not_done' || row.outcome === 'part_done') && row.note === '' && !errors.note) {
        errors.note = row.outcome === 'part_done' ? 'Say briefly what is left to do.' : 'Say briefly what the concern is or why it was not done.';
      }
      if (row.outcome === 'note') {
        if (row.note === '' && !errors.note) errors.note = 'Type the note.';
        var target = lookups && lookups.check_log_outcome ? lookups.check_log_outcome[row.note_for_id] : undefined;
        if (!row.note_for_id) errors.note_for_id = 'Say which record the note is for.';
        else if (lookups && lookups.check_log_outcome && (target === undefined || target === 'note')) errors.note_for_id = 'That record was not found.';
      } else if (row.note_for_id && !errors.note_for_id) {
        errors.note_for_id = 'Only a note can point at another record.';
      }
      var tgt = lookups && lookups.check_type_target ? lookups.check_type_target[row.check_type_id] : undefined;
      if (tgt === 'item' && row.outcome !== 'note') {
        if (!row.item_id && !errors.item_id) errors.item_id = 'Say which item.';
        var wantKind = lookups.check_type_item_kind ? lookups.check_type_item_kind[row.check_type_id] : true;
        var isKind = row.item_id && lookups.items ? lookups.items[row.item_id] : undefined;
        if (!errors.item_id && typeof wantKind === 'string' && typeof isKind === 'string' && wantKind !== isKind) errors.item_id = 'This test is not for that kind of item.';
      } else if (row.item_id && !errors.item_id && typeof tgt === 'string') {
        errors.item_id = 'Only an item test names an item.';
      }
      var only = lookups && lookups.check_type_only ? lookups.check_type_only[row.check_type_id] : true;
      if (!errors.area_id && row.area_id && typeof only === 'string' && only.split('|').indexOf(row.area_id) < 0) {
        errors.area_id = 'This job is not for this room.';
      }
      if (!errors.exceptions && row.exceptions) row.exceptions = checkExceptions_(row.exceptions, errors, lookups);
      if (!errors.covered_ids && !errors.exceptions && row.covered_ids && row.exceptions) {
        var skip = {};
        row.exceptions.split('|').forEach(function (p) { skip[p.split(':')[0]] = 1; });
        row.covered_ids = row.covered_ids.split('|').filter(function (id) { return !skip[id]; }).join('|');
        if (!row.covered_ids && !row.exceptions) errors.covered_ids = 'Name the dogs this round covered, or the exceptions.';
      }
    }
  },

  readings: {
    key: 'readings',
    file: 'BLD-readings.csv',
    idPrefix: 'rdg',
    columns: ['id', 'tenant_id', 'kind_id', 'area_id', 'item_id', 'subject_id', 'check_log_id', 'value_min', 'value_max', 'value',
              'unit_id', 'precision_dp', 'period_start', 'taken_at', 'taken_by', 'source', 'how_entered', 'read_method', 'samples',
              'device_label', 'area_empty', 'limit_id', 'in_range', 'corrects_id', 'note', 'mitigation_note', 'sign_in_id',
              'import_batch_id', 'camera_value_changed', 'reset_after_reading', 'set_by', 'created_at', 'updated_at'],
    proposedColumns: ['id', 'tenant_id', 'kind_id', 'area_id', 'item_id', 'subject_id', 'check_log_id', 'value_min', 'value_max', 'value',
              'unit_id', 'precision_dp', 'period_start', 'taken_at', 'taken_by', 'source', 'how_entered', 'read_method', 'samples',
              'device_label', 'area_empty', 'limit_id', 'in_range', 'corrects_id', 'note', 'mitigation_note', 'sign_in_id',
              'import_batch_id', 'camera_value_changed', 'reset_after_reading', 'set_by', 'created_at', 'updated_at'],
    computedColumns: [],
    lookups: [
      { name: 'reading_kinds', file: 'BLD-reading_kinds.csv', idCol: 'id', valCol: 'unit_id' },
      { name: 'limit_kind', file: 'BLD-reading_limits.csv', idCol: 'id', valCol: 'kind_id' },
      { name: 'limit_low', file: 'BLD-reading_limits.csv', idCol: 'id', valCol: 'low' },
      { name: 'limit_high', file: 'BLD-reading_limits.csv', idCol: 'id', valCol: 'high' },
      { name: 'limit_from', file: 'BLD-reading_limits.csv', idCol: 'id', valCol: 'from_date' },
      { name: 'limit_to', file: 'BLD-reading_limits.csv', idCol: 'id', valCol: 'to_date' },
      { name: 'check_log_item', file: 'BLD-check_log.csv', idCol: 'id', valCol: 'item_id' },
      { name: 'items', file: 'BLD-items.csv', idCol: 'id' },
      { name: 'area', file: 'BLD-area.csv', idCol: 'id' },
      { name: 'subject', file: 'BLD-subject.csv', idCol: 'id' }
    ],
    perms: { add: ['USER', 'STAFF'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      kind_id:      { type: 'ref', lookup: 'reading_kinds', required: true },
      item_id:      { type: 'ref', lookup: 'items' },
      check_log_id: { type: 'ref', lookup: 'check_log_item' },
      area_id:      { type: 'ref', lookup: 'area' },
      subject_id:   { type: 'ref', lookup: 'subject' },
      value:        { type: 'number' },
      value_min:    { type: 'number' },
      value_max:    { type: 'number' },
      unit_id:      { type: 'text' },
      precision_dp: { type: 'count' },
      limit_id:     { type: 'ref', lookup: 'limit_kind' },
      in_range:     { type: 'text' },                    // ignored: worked out here from limit_id
      taken_at:     { type: 'datetime' },
      source:       { type: 'enum', values: ['staff', 'guest', 'import', 'sensor'] },
      how_entered:  { type: 'enum', values: ['typed', 'camera', 'photo', 'paper', 'file'] },
      note:         { type: 'text' },
      corrects_id:  { type: 'text' }
    },
    dupKey: ['kind_id', 'item_id', 'check_log_id', 'area_id', 'subject_id', 'taken_at'], dupTimeCol: null,
    stamp: function (row, ctx) {
      var utc = new Date(Date.parse(ctx.nowIso)).toISOString().replace(/\.\d{3}Z$/, 'Z');
      if (!row.taken_at) row.taken_at = utc;
      row.created_at = utc;
      row.taken_by = ctx.whoId || ctx.who;
      row.set_by = ctx.whoId || ctx.who;
    },
    checkRow: function (row, errors, lookups) {
      if (row.taken_at && !errors.taken_at) row.taken_at = new Date(Date.parse(row.taken_at)).toISOString().replace(/\.\d{3}Z$/, 'Z');
      if (row.value === '' && (row.value_min === '' || row.value_max === '') && !errors.value) errors.value = 'Type the value.';
      if (row.value_min !== '' && row.value_max !== '' && +row.value_max < +row.value_min && !errors.value_max) errors.value_max = 'The highest cannot be below the lowest.';
      if (!row.item_id && !row.area_id && !row.subject_id && !errors.item_id) errors.item_id = 'Say what this reading is for.';
      var unit = lookups && lookups.reading_kinds ? lookups.reading_kinds[row.kind_id] : undefined;
      if (typeof unit === 'string' && !errors.unit_id) {
        if (row.unit_id && row.unit_id !== unit) errors.unit_id = 'That is not the unit for this kind of reading.';
        else row.unit_id = unit;
      }
      if (row.check_log_id && !errors.check_log_id && lookups && lookups.check_log_item) {
        var on = lookups.check_log_item[row.check_log_id];
        if (typeof on === 'string' && row.item_id && on !== row.item_id) errors.check_log_id = 'That test is on a different item.';
        else if (typeof on === 'string' && !row.item_id) row.item_id = on;
      }
      row.in_range = '';
      if (row.limit_id && !errors.limit_id && lookups && lookups.limit_kind) {
        var lk = lookups.limit_kind[row.limit_id];
        var day = (row.taken_at || new Date().toISOString()).slice(0, 10);
        var from = lookups.limit_from[row.limit_id], to = lookups.limit_to[row.limit_id];
        if (lk !== row.kind_id) errors.limit_id = 'That limit is for a different kind of reading.';
        else if ((typeof from === 'string' && from > day) || (typeof to === 'string' && to < day)) errors.limit_id = 'That limit was not in force on the reading\'s date.';
        else if (row.value !== '') {
          var lo = lookups.limit_low[row.limit_id], hi = lookups.limit_high[row.limit_id], v = +row.value;
          row.in_range = ((typeof lo !== 'string' || v >= +lo) && (typeof hi !== 'string' || v <= +hi)) ? 'true' : 'false';
        }
      }
      if (row.corrects_id && !ID_RE_.test(row.corrects_id) && !errors.corrects_id) errors.corrects_id = 'That is not a valid id.';
    }
  },

  items: {
    key: 'items',
    file: 'BLD-items.csv',
    idPrefix: 'itm',
    qrKind: 'item', qrSub: 'kind_key',
    columns: ['id', 'tenant_id', 'item_no', 'name', 'kind_key', 'make', 'model', 'serial_no', 'size', 'made_on', 'expires_on', 'photo', 'note', 'corrects_id', 'created_at', 'created_by'],
    proposedColumns: ['id', 'tenant_id', 'item_no', 'name', 'kind_key', 'make', 'model', 'serial_no', 'size', 'made_on', 'expires_on', 'photo', 'note', 'corrects_id', 'created_at', 'created_by'],
    computedColumns: [],
    lookups: [
      { name: 'item_kind_key', file: 'BLD-item_kinds.csv', idCol: 'kind_key' },
      { name: 'items_first', file: 'BLD-items.csv', idCol: 'id', valCol: 'corrects_id' }
    ],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      item_no:     { type: 'text', required: true },
      name:        { type: 'text', required: true },
      kind_key:    { type: 'text', required: true },
      make:        { type: 'text' },
      model:       { type: 'text' },
      serial_no:   { type: 'text' },
      size:        { type: 'text' },
      made_on:     { type: 'date' },
      expires_on:  { type: 'date' },
      photo:       { type: 'text' },
      note:        { type: 'text' },
      corrects_id: { type: 'text' }
    },
    dupKey: ['item_no', 'name', 'kind_key', 'corrects_id'], dupTimeCol: null,
    stamp: function (row, ctx) { row.created_at = ctx.nowIso; row.created_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors, lookups) {
      if (!errors.made_on && !errors.expires_on && row.made_on && row.expires_on && row.expires_on < row.made_on) errors.expires_on = 'The expiry date cannot be before the date it was made.';
      if (!errors.kind_key && row.kind_key !== '') {
        if (!/^[a-z][a-z0-9_]{1,39}$/.test(row.kind_key)) errors.kind_key = 'Use the kind\'s short name, e.g. appliance_class_1.';
        else if (lookups && lookups.item_kind_key && !lookups.item_kind_key[row.kind_key]) errors.kind_key = 'No kind with that name. Add it to the kinds first.';
      }
      if (!errors.corrects_id && row.corrects_id !== '') {
        var first = lookups && lookups.items_first ? lookups.items_first[row.corrects_id] : undefined;
        if (!ID_RE_.test(row.corrects_id)) errors.corrects_id = 'That is not a valid id.';
        else if (lookups && lookups.items_first && first === undefined) errors.corrects_id = 'That item was not found.';
        else if (typeof first === 'string') errors.corrects_id = 'Point at the item\'s first row, not a change.';
      }
    }
  },

  item_kinds: {
    key: 'item_kinds',
    file: 'BLD-item_kinds.csv',
    idPrefix: 'ikd',
    columns: ['id', 'tenant_id', 'kind_key', 'label', 'source', 'set_by', 'set_on'],
    proposedColumns: ['id', 'tenant_id', 'kind_key', 'label', 'source', 'set_by', 'set_on'],
    computedColumns: [],
    lookups: [],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      kind_key: { type: 'text', required: true },
      label:    { type: 'text', required: true },
      source:   { type: 'text' }
    },
    dupKey: ['kind_key', 'label'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_on = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) {
      if (!errors.kind_key && row.kind_key !== '' && !/^[a-z][a-z0-9_]{1,39}$/.test(row.kind_key)) errors.kind_key = 'Use lower-case letters, numbers and underscores, e.g. extinguisher_co2.';
    }
  },

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
    perms: { add: ['USER', 'STAFF'], correct: [] },
    noCorrect: true,
    userEditable: true,
    movesQueue: false,
    userEdit: { moved_in: { type: 'date' }, moved_out: { type: 'date' } },
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      subject_id: { type: 'ref', lookup: 'subject', required: true },
      area_id:    { type: 'ref', lookup: 'area', required: true },
      classification_note: { type: 'text' }
    },
    dupKey: ['subject_id', 'area_id'], dupTimeCol: null, dupDayCol: 'moved_in',
    stamp: function (row, ctx) { row.moved_in = ctx.today; },
    checkRow: function () {},
    checkAgainst: function (clean, records, errors) {
      if (errors.subject_id || errors.area_id) return;
      var cur = occupancyLatest_(records, clean.subject_id);
      if (!cur) return;
      if (permanentlyGone_(cur)) {
        errors.subject_id = 'This dog is recorded as no longer on site. Ask User before moving it.';
      } else if (cur.area_id && cur.area_id === clean.area_id) {
        errors.area_id = 'That dog is already recorded in that room, so it has not moved.';
      }
    }
  },

  occupancy_out: {
    key: 'occupancy_out',
    file: 'BLD-occupancy.csv',
    idPrefix: 'occ',
    columns: ['id', 'tenant_id', 'subject_id', 'area_id', 'off_site_kind', 'moved_in', 'moved_out', 'classification', 'classification_note'],
    proposedColumns: [],
    computedColumns: [],
    lookups: [{ name: 'subject', file: 'BLD-subject.csv', idCol: 'id' }],
    perms: { add: ['USER', 'STAFF'], correct: [] },
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

  area_access: {
    key: 'area_access',
    file: 'BLD-area_access.csv',
    idPrefix: 'acc',
    columns: ['id', 'tenant_id', 'area_id', 'access_type', 'from_date', 'to_date', 'reason', 'set_by'],
    proposedColumns: [],
    computedColumns: [],
    lookups: [{ name: 'area', file: 'BLD-area.csv', idCol: 'id' }],
    perms: { add: ['USER', 'STAFF'], correct: [] },
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

  qr_tag: {
    key: 'qr_tag',
    file: 'BLD-qr_tag.csv',
    idPrefix: 'qrt',
    columns: ['id', 'tenant_id', 'tag', 'kind', 'ref_id', 'active', 'made_at', 'made_by'],
    proposedColumns: ['tag', 'kind', 'ref_id', 'active', 'made_at', 'made_by'],
    computedColumns: [],
    lookups: [],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      tag:    { type: 'text', required: true },
      kind:   { type: 'enum', values: ['area', 'subject', 'litter', 'site', 'thermometer', 'item'], required: true },
      ref_id: { type: 'text', required: true }
    },
    dupKey: ['tag'], dupTimeCol: null,
    stamp: function (row, ctx) { row.active = 'true'; row.made_at = ctx.nowIso; row.made_by = ctx.whoId || ctx.who; },
    checkRow: function () {}
  },

  code_vaults: {
    key: 'code_vaults',
    file: 'BLD-code_vaults.csv',
    idPrefix: 'cv',
    columns: ['id', 'tenant_id', 'code_id', 'cipher', 'iv', 'salt', 'kdf', 'kdf_iter', 'from_date', 'to_date', 'set_by', 'set_on'],
    proposedColumns: ['code_id', 'cipher', 'iv', 'salt', 'kdf', 'kdf_iter', 'from_date', 'to_date', 'set_by', 'set_on'],
    computedColumns: [],
    lookups: [],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      code_id:  { type: 'text', required: true },
      cipher:   { type: 'text', required: true },
      iv:       { type: 'text', required: true },
      salt:     { type: 'text', required: true },
      kdf:      { type: 'text', required: true },
      kdf_iter: { type: 'text', required: true }
    },
    dupKey: ['cipher'], dupTimeCol: null,
    stamp: function (row, ctx) { row.from_date = String(ctx.nowIso).slice(0, 10); row.set_on = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) {
      if (!/^(sc-[a-z0-9]{6}|vault-check)$/.test(row.code_id || '')) errors.code_id = 'Say which code.';
      ['cipher', 'iv', 'salt'].forEach(function (k) { if (!/^([0-9a-f]{2})+$/.test(row[k] || '')) errors[k] = 'Only sealed text can be kept.'; });
      if ((row.iv || '').length !== 24) errors.iv = 'Only sealed text can be kept.';
      if ((row.salt || '').length < 32) errors.salt = 'Only sealed text can be kept.';
      if (row.kdf !== 'PBKDF2-SHA256/AES-GCM-256') errors.kdf = 'Only sealed text can be kept.';
      if (!(parseInt(row.kdf_iter, 10) >= 600000)) errors.kdf_iter = 'Only sealed text can be kept.';
    }
  },

  occupancy_check: {
    key: 'occupancy_check',
    file: 'BLD-occupancy_check.csv',
    idPrefix: 'chk',
    columns: ['id', 'tenant_id', 'confirmed_at', 'confirmed_by', 'dog_ids', 'moved_count', 'note'],
    proposedColumns: ['confirmed_at', 'confirmed_by', 'dog_ids', 'moved_count', 'note'],
    computedColumns: [],
    lookups: [{ name: 'subject', file: 'BLD-subject.csv', idCol: 'id' }],
    perms: { add: ['USER', 'STAFF'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      dog_ids:     { type: 'idlist', lookup: 'subject', required: true },
      moved_count: { type: 'count', dflt: '0' },
      note:        { type: 'text' }
    },
    dupKey: ['dog_ids'], dupTimeCol: 'confirmed_at',
    stamp: function (row, ctx) { row.confirmed_at = ctx.nowIso; row.confirmed_by = ctx.whoId || ctx.who; },
    checkRow: function () {}
  },

  check_setting: {
    key: 'check_setting',
    file: 'BLD-check_setting.csv',
    idPrefix: 'cks',
    columns: ['id', 'tenant_id', 'type_key', 'record_as', 'every_days', 'frequency', 'site_scope', 'session_row', 'from_date', 'to_date', 'source', 'set_by', 'set_at'],
    proposedColumns: ['type_key', 'record_as', 'every_days', 'frequency', 'site_scope', 'session_row', 'from_date', 'to_date', 'source', 'set_by', 'set_at'],
    computedColumns: [],
    lookups: [],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      type_key:    { type: 'text', required: true },
      record_as:   { type: 'enum', values: ['logged', 'print', 'both'], required: true },
      every_days:  { type: 'count' },
      frequency:   { type: 'text' },
      site_scope:  { type: 'enum', values: ['one_line', 'per_dog'] },
      session_row: { type: 'bool', dflt: 'false' },
      from_date:   { type: 'date', required: true },
      to_date:     { type: 'date' },
      source:      { type: 'text' }
    },
    dupKey: ['type_key', 'from_date'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_at = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) {
      if (!errors.to_date && !errors.from_date && row.to_date && row.from_date && row.to_date < row.from_date) errors.to_date = 'The end date cannot be before the start date.';
      if (!errors.type_key && row.type_key && !/^(round\.)?[a-z][a-z0-9_]{1,39}$/.test(row.type_key)) errors.type_key = 'Use the check\'s short name.';
      if (!errors.every_days && row.every_days === '0') errors.every_days = 'Use 1 or more, or leave blank for as needed.';
      var sessionOk = { 'round.presence': 1, 'round_presence': 1, 'health_check_all': 1, 'exercise_all': 1 };
      if (!errors.session_row && String(row.session_row) === 'true' && !sessionOk[row.type_key]) errors.session_row = 'One line for the round is only for Present, Health check: all dogs, and Exercise and play: all dogs.';
      if (errors.type_key || !row.type_key) return;
      var types = store_read_('BLD-check_type.csv', false);
      var live = checkTypeInForce_(types && types.records, row.type_key, row.from_date || '9999-12-31');
      if (!live) { errors.type_key = 'No check with that name is in force on that date.'; return; }
      var ban = checkPrintBan_(live);
      if (!errors.record_as && row.record_as === 'print' && ban) errors.record_as = ban;
      var floor = checkEvery_(live.every_days), want = checkEvery_(row.every_days);
      if (!errors.every_days && floor && (!want || want > floor)) errors.every_days = 'The legal minimum is every ' + floor + ' day' + (floor === 1 ? '' : 's') + '. It can be more often, not less.';
    },
    checkAgainst: function (clean, records, errors) {
      if (errors.type_key || errors.from_date) return;
      for (var i = 0; i < records.length; i++) {
        if (records[i].type_key === clean.type_key && (records[i].from_date || '') >= clean.from_date) {
          errors.from_date = 'This check already has a setting from ' + records[i].from_date + '. A change must start after that date.';
          return;
        }
      }
    }
  },

  retention_setting: {
    key: 'retention_setting',
    file: 'BLD-retention_setting.csv',
    idPrefix: 'rtn',
    columns: ['id', 'tenant_id', 'section', 'keep_years', 'basis', 'set_by', 'set_on', 'from_date', 'to_date'],
    proposedColumns: ['section', 'keep_years', 'basis', 'set_by', 'set_on', 'from_date', 'to_date'],
    computedColumns: [],
    lookups: [],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      section:    { type: 'text', required: true },
      keep_years: { type: 'count', required: true },
      basis:      { type: 'text' },
      from_date:  { type: 'date', required: true },
      to_date:    { type: 'date' }
    },
    dupKey: ['section', 'from_date'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_on = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) {
      if (!errors.to_date && !errors.from_date && row.to_date && row.from_date && row.to_date < row.from_date) errors.to_date = 'The end date cannot be before the start date.';
      if (!errors.section && row.section && !/^[a-z][a-z0-9_]{0,40}$/.test(row.section)) errors.section = 'Use a short name such as checks.';
      var years = parseInt(row.keep_years, 10);
      if (!errors.keep_years && (row.section === 'checks' || row.section === 'jobs') && !(years >= 6)) errors.keep_years = 'Check records are kept at least 6 years.';
    },
    checkAgainst: function (clean, records, errors) {
      if (errors.section || errors.from_date) return;
      for (var i = 0; i < records.length; i++) {
        if (records[i].section === clean.section && (records[i].from_date || '') >= clean.from_date) {
          errors.from_date = 'This already has a period from ' + records[i].from_date + '. A change must start after that date.';
          return;
        }
      }
    }
  },

  breeding_rule: {
    key: 'breeding_rule',
    file: 'BLD-breeding_rule.csv',
    idPrefix: 'brl',
    columns: ['id', 'tenant_id', 'rule_key', 'value', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'to_date'],
    proposedColumns: ['rule_key', 'value', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'to_date'],
    computedColumns: [],
    lookups: [],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      rule_key:       { type: 'text', required: true },
      value:          { type: 'text', required: true },
      effective_from: { type: 'date', required: true },
      to_date:        { type: 'date' },
      source:         { type: 'text' },
      note:           { type: 'text' },
      confirm_unusual: { type: 'enum', values: ['yes'] }
    },
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
          errors.confirm_unusual = 'Save anyway?';
        }
      }
    },
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
  },

  person: {
    key: 'person',
    file: 'BLD-person.csv',
    idPrefix: 'per',
    columns: ['id', 'tenant_id', 'full_name', 'party_kind', 'title', 'first_name', 'last_name', 'pronouns', 'known_as', 'email', 'phone', 'phone_alt', 'email_alt', 'preferred_contact', 'best_time_to_call', 'address_line', 'address_line_2', 'address_locality', 'address_region', 'address_postal_code', 'address_country_code', 'is_vet', 'is_supplier_contact', 'marketing_consent', 'consent_basis', 'consent_recorded_on', 'source', 'effective_from', 'effective_to', 'date_of_birth', 'id_checked_on', 'do_not_contact', 'gdpr_erasure_requested_on', 'retention_review_on', 'notes', 'external_ref', 'external_ref_system', 'visibility', 'visible_from', 'visible_to', 'visibility_set_by'],
    proposedColumns: [],
    computedColumns: [],
    lookups: [],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: true,
    defaultMode: 'pending',
    input: {
      full_name: { type: 'text', required: true },
      known_as:  { type: 'text' }
    },
    dupKey: ['full_name', 'known_as'], dupTimeCol: null,
    stamp: function () {},
    checkRow: function () {}
  },

  household: {
    key: 'household',
    file: 'BLD-household.csv',
    idPrefix: 'hhd',
    columns: ['id', 'tenant_id', 'household_name', 'primary_person_id', 'address_line', 'postcode', 'country', 'home_type', 'garden', 'other_pets', 'children_at_home', 'hours_alone_typical', 'work_pattern', 'stage', 'first_enquiry_on', 'source', 'notes', 'visibility', 'visible_from', 'visible_to', 'visibility_set_by'],
    proposedColumns: [],
    computedColumns: [],
    lookups: [{ name: 'person', file: 'BLD-person.csv', idCol: 'id' }],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: true,
    defaultMode: 'pending',
    input: {
      name: { type: 'text', required: true },
      primary_person_id: { type: 'ref', lookup: 'person', required: true },
      stage: { type: 'enum', values: ['enquiry', 'deposit', 'working to collection', 'after collection'], required: true }
    },
    dupKey: ['primary_person_id', 'stage'], dupTimeCol: null,
    stamp: function (row) { row.household_name = row.name; },
    checkRow: function () {}
  },

  household_member: {
    key: 'household_member',
    file: 'BLD-household_member.csv',
    idPrefix: 'hhm',
    columns: ['id', 'tenant_id', 'household_id', 'person_id', 'role', 'is_decision_maker', 'is_primary_handler', 'relationship_note', 'from_date', 'to_date', 'visibility', 'visible_from', 'visible_to', 'visibility_set_by'],
    proposedColumns: [],
    computedColumns: [],
    lookups: [
      { name: 'household', file: 'BLD-household.csv', idCol: 'id' },
      { name: 'person', file: 'BLD-person.csv', idCol: 'id' }
    ],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: true,
    defaultMode: 'pending',
    input: {
      household_id: { type: 'ref', lookup: 'household', required: true },
      person_id: { type: 'ref', lookup: 'person', required: true }
    },
    dupKey: ['household_id', 'person_id'], dupTimeCol: null,
    stamp: function () {},
    checkRow: function () {}
  },

  subject_user: {
    key: 'subject_user',
    file: 'BLD-subject_user.csv',
    idPrefix: 'sow',
    columns: ['id', 'tenant_id', 'subject_id', 'person_id', 'household_id', 'role', 'from_date', 'to_date', 'transfer_document_id', 'microchip_transferred_on', 'registry_transferred_on', 'notes', 'visibility', 'visible_from', 'visible_to', 'visibility_set_by'],
    proposedColumns: [],
    computedColumns: [],
    lookups: [
      { name: 'subject', file: 'BLD-subject.csv', idCol: 'id' },
      { name: 'person', file: 'BLD-person.csv', idCol: 'id' },
      { name: 'household', file: 'BLD-household.csv', idCol: 'id' }
    ],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: true,
    defaultMode: 'pending',
    input: {
      subject_id: { type: 'ref', lookup: 'subject', required: true },
      person_id: { type: 'ref', lookup: 'person', required: true },
      household_id: { type: 'ref', lookup: 'household', required: true },
      role: { type: 'enum', values: ['assigned', 'user'], required: true }
    },
    dupKey: ['subject_id', 'person_id', 'role'], dupTimeCol: null,
    stamp: function () {},
    checkRow: function () {}
  },

  sale: {
    key: 'sale',
    file: 'BLD-sale.csv',
    idPrefix: 'sal',
    columns: ['id', 'tenant_id', 'subject_id', 'person_id', 'household_id', 'sold_on', 'age_at_sale_days', 'microchip_number_at_sale', 'seen_with_dam', 'vet_record_given', 'price', 'deposit', 'deposit_date', 'contract_document_id', 'notes', 'visibility', 'visible_from', 'visible_to', 'visibility_set_by'],
    proposedColumns: [],
    computedColumns: [],
    lookups: [
      { name: 'subject', file: 'BLD-subject.csv', idCol: 'id' },
      { name: 'person', file: 'BLD-person.csv', idCol: 'id' },
      { name: 'household', file: 'BLD-household.csv', idCol: 'id' }
    ],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: true,
    defaultMode: 'pending',
    input: {
      subject_id: { type: 'ref', lookup: 'subject', required: true },
      person_id: { type: 'ref', lookup: 'person', required: true },
      household_id: { type: 'ref', lookup: 'household', required: true },
      deposit: { type: 'text' },
      deposit_date: { type: 'date' },
      sold_on: { type: 'date' },
      price: { type: 'text' }
    },
    dupKey: ['subject_id', 'person_id', 'deposit_date', 'sold_on'], dupTimeCol: null,
    stamp: function () {},
    checkRow: function () {}
  }
};

function tempPairError_(min, max) {
  if (min !== '' && max !== '' && parseFloat(min) > parseFloat(max)) {
    return 'The lowest reading cannot be higher than the highest reading.';
  }
  return '';
}

function checkReadMethod_(row, errors) {
  if (row.camera_value_changed === 'true' && row.read_method !== 'camera' && !errors.read_method) {
    errors.camera_value_changed = 'Only a camera reading can have its number changed.';
  }
}

var BREEDING_RULE_LIMITS_ = {
  min_dam_age_months:          [6, 48, 'months'],
  max_litters_per_dam:         [1, 20, 'litters'],
  min_months_between_litters:  [1, 36, 'months']
};

function permanentlyGone_(row) {
  if (!row) return false;
  var kind = String(row.off_site_kind || '').toLowerCase(), cls = String(row.classification || '').toLowerCase();
  return kind === 'sold' || kind === 'owned_by_family' || kind === 'deceased' || cls === 'collected' || cls === 'deceased';
}

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

var PROPOSED_TABLES = {

  staff: {
    key: 'staff',
    file: 'BLD-staff.csv',
    idPrefix: 'stf',
    columns: ['id', 'tenant_id', 'person_id', 'role', 'employment', 'started_on', 'ended_on', 'corrects_id'],
    proposedColumns: ['corrects_id'],
    computedColumns: [],
    lookups: [{ name: 'person', file: 'BLD-person.csv', idCol: 'id' }],
    perms: { add: ['USER'], correct: ['USER'] },
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
  },


  parties: {
    key: 'parties',
    file: 'BLD-parties.csv',
    idPrefix: 'pty',
    columns: ['id', 'tenant_id', 'kind', 'name', 'country_iso', 'note', 'source', 'set_by', 'set_on', 'created_at', 'updated_at'],
    proposedColumns: ['id', 'tenant_id', 'kind', 'name', 'country_iso', 'note', 'source', 'set_by', 'set_on', 'created_at', 'updated_at'],
    computedColumns: [],
    lookups: [],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      kind:        { type: 'enum', values: ['person', 'organisation'], required: true },
      name:        { type: 'text', required: true },
      country_iso: { type: 'text' },
      note:        { type: 'text' },
      source:      { type: 'text' }
    },
    dupKey: ['kind', 'name'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_on = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; row.created_at = ctx.nowIso; },
    checkRow: function (row, errors) {
      if (!errors.country_iso && row.country_iso !== '' && !/^[A-Z]{2}$/.test(row.country_iso)) errors.country_iso = 'Use the two-letter country code, e.g. GB.';
    }
  },

  products: {
    key: 'products',
    file: 'BLD-products.csv',
    idPrefix: 'prd',
    columns: ['id', 'tenant_id', 'name', 'dose_type', 'maker_party_id', 'form', 'strength', 'unit_id', 'note', 'source', 'set_by', 'set_on', 'created_at', 'updated_at'],
    proposedColumns: ['id', 'tenant_id', 'name', 'dose_type', 'maker_party_id', 'form', 'strength', 'unit_id', 'note', 'source', 'set_by', 'set_on', 'created_at', 'updated_at'],
    computedColumns: [],
    lookups: [{ name: 'party', file: 'BLD-parties.csv', idCol: 'id' }],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      name:           { type: 'text', required: true },
      dose_type:      { type: 'text', required: true },
      maker_party_id: { type: 'ref', lookup: 'party' },
      form:           { type: 'text' },
      strength:       { type: 'text' },
      unit_id:        { type: 'text' },
      note:           { type: 'text' },
      source:         { type: 'text' }
    },
    dupKey: ['name', 'dose_type', 'maker_party_id'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_on = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; row.created_at = ctx.nowIso; },
    checkRow: function (row, errors) { checkKindKey_(row, errors, 'dose_type', 'vaccine'); }
  },

  lots: {
    key: 'lots',
    file: 'BLD-lots.csv',
    idPrefix: 'lot',
    columns: ['id', 'tenant_id', 'product_id', 'batch', 'expires_on', 'quantity', 'unit_id', 'supplier_party_id', 'received_on', 'note', 'set_by', 'set_on', 'created_at', 'updated_at'],
    proposedColumns: ['id', 'tenant_id', 'product_id', 'batch', 'expires_on', 'quantity', 'unit_id', 'supplier_party_id', 'received_on', 'note', 'set_by', 'set_on', 'created_at', 'updated_at'],
    computedColumns: [],
    lookups: [{ name: 'product', file: 'BLD-products.csv', idCol: 'id' }, { name: 'party', file: 'BLD-parties.csv', idCol: 'id' }],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      product_id:        { type: 'ref', lookup: 'product', required: true },
      batch:             { type: 'text', required: true },
      expires_on:        { type: 'date' },
      quantity:          { type: 'number', required: true },
      unit_id:           { type: 'text' },
      supplier_party_id: { type: 'ref', lookup: 'party' },
      received_on:       { type: 'date' },
      note:              { type: 'text' }
    },
    dupKey: ['product_id', 'batch'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_on = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; row.created_at = ctx.nowIso; },
    checkRow: function (row, errors) {
      if (!errors.quantity && row.quantity !== '' && Number(row.quantity) <= 0) errors.quantity = 'A lot starts with more than nothing.';
    }
  },

  stock_movements: {
    key: 'stock_movements',
    file: 'BLD-stock_movements.csv',
    idPrefix: 'stm',
    columns: ['id', 'tenant_id', 'lot_id', 'quantity', 'reason', 'dose_id', 'note', 'at', 'by', 'sign_in_id', 'corrects_id', 'created_at', 'updated_at'],
    proposedColumns: ['id', 'tenant_id', 'lot_id', 'quantity', 'reason', 'dose_id', 'note', 'at', 'by', 'sign_in_id', 'corrects_id', 'created_at', 'updated_at'],
    computedColumns: [],
    lookups: [{ name: 'lot', file: 'BLD-lots.csv', idCol: 'id' }],
    perms: { add: ['USER', 'STAFF'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      lot_id:      { type: 'ref', lookup: 'lot', required: true },
      quantity:    { type: 'number', required: true },   // + in, - out
      reason:      { type: 'text', required: true },
      dose_id:     { type: 'text' },
      note:        { type: 'text' },
      corrects_id: { type: 'text' }
    },
    dupKey: ['lot_id', 'quantity', 'reason', 'dose_id'], dupTimeCol: 'at',
    stamp: function (row, ctx) { row.at = ctx.nowIso; row.by = ctx.whoId || ctx.who; row.created_at = ctx.nowIso; },
    checkRow: function (row, errors) {
      checkKindKey_(row, errors, 'reason', 'given');
      if (!errors.quantity && row.quantity !== '' && Number(row.quantity) === 0) errors.quantity = 'A movement of nothing is not a movement.';
      if (!errors.dose_id && row.dose_id !== '' && !ID_RE_.test(row.dose_id)) errors.dose_id = 'That is not a valid id.';
    }
  },

  courses: {
    key: 'courses',
    file: 'BLD-courses.csv',
    idPrefix: 'crs',
    columns: ['id', 'tenant_id', 'subject_id', 'product_id', 'dose_type', 'steps', 'from_date', 'to_date', 'note', 'source', 'set_by', 'set_on', 'created_at', 'updated_at'],
    proposedColumns: ['id', 'tenant_id', 'subject_id', 'product_id', 'dose_type', 'steps', 'from_date', 'to_date', 'note', 'source', 'set_by', 'set_on', 'created_at', 'updated_at'],
    computedColumns: [],
    lookups: [{ name: 'product', file: 'BLD-products.csv', idCol: 'id' }],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      subject_id: { type: 'text', required: true },
      product_id: { type: 'ref', lookup: 'product' },
      dose_type:  { type: 'text', required: true },
      steps:      { type: 'count', required: true },
      from_date:  { type: 'date', required: true },
      to_date:    { type: 'date' },
      note:       { type: 'text' },
      source:     { type: 'text' }
    },
    dupKey: ['subject_id', 'dose_type', 'product_id', 'from_date'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_on = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; row.created_at = ctx.nowIso; },
    checkRow: function (row, errors) {
      checkKindKey_(row, errors, 'dose_type', 'vaccine');
      if (!errors.subject_id && !ID_RE_.test(row.subject_id)) errors.subject_id = 'That is not a valid id.';
      if (!errors.steps && row.steps !== '' && Number(row.steps) < 1) errors.steps = 'A course has at least one dose.';
      checkDates_(row, errors);
    }
  },

  doses: {
    key: 'doses',
    file: 'BLD-doses.csv',
    idPrefix: 'dos',
    columns: ['id', 'tenant_id', 'subject_id', 'dose_type', 'product_id', 'lot_id', 'course_id', 'course_step', 'given_at', 'given_by', 'sign_in_id', 'route', 'amount', 'unit_id', 'next_due_on', 'due_source', 'note', 'corrects_id', 'created_at', 'updated_at'],
    proposedColumns: ['id', 'tenant_id', 'subject_id', 'dose_type', 'product_id', 'lot_id', 'course_id', 'course_step', 'given_at', 'given_by', 'sign_in_id', 'route', 'amount', 'unit_id', 'next_due_on', 'due_source', 'note', 'corrects_id', 'created_at', 'updated_at'],
    computedColumns: [],
    lookups: [{ name: 'product', file: 'BLD-products.csv', idCol: 'id' }, { name: 'lot', file: 'BLD-lots.csv', idCol: 'id', valCol: 'product_id' },
      { name: 'course', file: 'BLD-courses.csv', idCol: 'id', valCol: 'steps' }],
    perms: { add: ['USER', 'STAFF'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      subject_id:  { type: 'text', required: true },
      dose_type:   { type: 'text', required: true },
      product_id:  { type: 'ref', lookup: 'product', required: true },
      lot_id:      { type: 'ref', lookup: 'lot' },
      course_id:   { type: 'ref', lookup: 'course' },
      course_step: { type: 'count' },
      given_at:    { type: 'datetime', required: true },
      route:       { type: 'text' },
      amount:      { type: 'number' },
      unit_id:     { type: 'text' },
      next_due_on: { type: 'date' },
      due_source:  { type: 'text' },
      note:        { type: 'text' },
      corrects_id: { type: 'text' }
    },
    dupKey: ['subject_id', 'product_id', 'given_at', 'corrects_id'], dupTimeCol: null,
    stamp: function (row, ctx) { row.given_by = ctx.whoId || ctx.who; row.created_at = ctx.nowIso; },
    checkRow: function (row, errors, lookups) {
      checkKindKey_(row, errors, 'dose_type', 'wormer');
      if (!errors.subject_id && !ID_RE_.test(row.subject_id)) errors.subject_id = 'That is not a valid id.';
      if (!errors.lot_id && row.lot_id !== '' && lookups && lookups.lot && lookups.lot[row.lot_id] !== row.product_id) errors.lot_id = 'That lot is of another product.';
      if (!errors.course_step && row.course_step !== '' && row.course_id === '') errors.course_step = 'A step needs its course.';
      if (!errors.course_step && row.course_step !== '' && row.course_id !== '' && lookups && lookups.course) {
        var steps = Number(lookups.course[row.course_id]);
        if (Number(row.course_step) < 1 || (steps && Number(row.course_step) > steps)) errors.course_step = 'That course has ' + steps + ' doses.';
      }
      if (!errors.next_due_on && row.next_due_on !== '' && !errors.given_at && row.next_due_on < row.given_at.slice(0, 10)) errors.next_due_on = 'Next due cannot be before the dose was given.';
      if (!errors.corrects_id && row.corrects_id !== '' && !ID_RE_.test(row.corrects_id)) errors.corrects_id = 'That is not a valid id.';
    }
  },

  prescriptions: {
    key: 'prescriptions',
    file: 'BLD-prescriptions.csv',
    idPrefix: 'rx',
    columns: ['id', 'tenant_id', 'subject_id', 'product_id', 'prescriber_party_id', 'instructions', 'from_date', 'to_date', 'note', 'source', 'set_by', 'set_on', 'created_at', 'updated_at'],
    proposedColumns: ['id', 'tenant_id', 'subject_id', 'product_id', 'prescriber_party_id', 'instructions', 'from_date', 'to_date', 'note', 'source', 'set_by', 'set_on', 'created_at', 'updated_at'],
    computedColumns: [],
    lookups: [{ name: 'product', file: 'BLD-products.csv', idCol: 'id' }, { name: 'party', file: 'BLD-parties.csv', idCol: 'id' }],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      subject_id:          { type: 'text', required: true },
      product_id:          { type: 'ref', lookup: 'product', required: true },
      prescriber_party_id: { type: 'ref', lookup: 'party' },
      instructions:        { type: 'text' },
      from_date:           { type: 'date', required: true },
      to_date:             { type: 'date' },
      note:                { type: 'text' },
      source:              { type: 'text' }
    },
    dupKey: ['subject_id', 'product_id', 'from_date'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_on = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; row.created_at = ctx.nowIso; },
    checkRow: function (row, errors) {
      if (!errors.subject_id && !ID_RE_.test(row.subject_id)) errors.subject_id = 'That is not a valid id.';
      checkDates_(row, errors);
    }
  },

  product_dose_bands: {
    key: 'product_dose_bands',
    file: 'BLD-product_dose_bands.csv',
    idPrefix: 'pdb',
    columns: ['id', 'tenant_id', 'product_id', 'weight_from', 'weight_to', 'weight_unit_id', 'amount', 'unit_id', 'from_date', 'to_date', 'source', 'set_by', 'set_on'],
    proposedColumns: ['id', 'tenant_id', 'product_id', 'weight_from', 'weight_to', 'weight_unit_id', 'amount', 'unit_id', 'from_date', 'to_date', 'source', 'set_by', 'set_on'],
    computedColumns: [],
    lookups: [{ name: 'product', file: 'BLD-products.csv', idCol: 'id' }],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      product_id:     { type: 'ref', lookup: 'product', required: true },
      weight_from:    { type: 'number' },
      weight_to:      { type: 'number' },
      weight_unit_id: { type: 'text' },
      amount:         { type: 'number', required: true },
      unit_id:        { type: 'text', required: true },
      from_date:      { type: 'date', required: true },
      to_date:        { type: 'date' },
      source:         { type: 'text', required: true }
    },
    dupKey: ['product_id', 'weight_from', 'weight_to', 'from_date'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_on = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) {
      if (!errors.weight_to && row.weight_from !== '' && row.weight_to !== '' && Number(row.weight_to) <= Number(row.weight_from)) errors.weight_to = 'The top of the band must be above its bottom.';
      checkDates_(row, errors);
    }
  },

  certificate_kinds: {
    key: 'certificate_kinds',
    file: 'BLD-certificate_kinds.csv',
    idPrefix: 'ckd',
    columns: ['id', 'tenant_id', 'kind_key', 'label', 'issuer_hint', 'grades_shape', 'source', 'set_by', 'set_on'],
    proposedColumns: ['id', 'tenant_id', 'kind_key', 'label', 'issuer_hint', 'grades_shape', 'source', 'set_by', 'set_on'],
    computedColumns: [],
    lookups: [],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      kind_key:     { type: 'text', required: true },
      label:        { type: 'text', required: true },
      issuer_hint:  { type: 'text' },
      grades_shape: { type: 'enum', values: ['none', 'pass_fail', 'grade', 'score', 'pair'] },
      source:       { type: 'text' }
    },
    dupKey: ['kind_key', 'label'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_on = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; },
    checkRow: function (row, errors) { checkKindKey_(row, errors, 'kind_key', 'gas_safety'); }
  },

  certificates: {
    key: 'certificates',
    file: 'BLD-certificates.csv',
    idPrefix: 'crt',
    columns: ['id', 'tenant_id', 'subject_table', 'subject_id', 'cert_kind_key', 'issuer_party_id', 'number', 'issued_on', 'result', 'grades', 'expires_on', 'note', 'corrects_id', 'source', 'set_by', 'set_on', 'created_at', 'updated_at'],
    proposedColumns: ['id', 'tenant_id', 'subject_table', 'subject_id', 'cert_kind_key', 'issuer_party_id', 'number', 'issued_on', 'result', 'grades', 'expires_on', 'note', 'corrects_id', 'source', 'set_by', 'set_on', 'created_at', 'updated_at'],
    computedColumns: [],
    lookups: [{ name: 'cert_kind', file: 'BLD-certificate_kinds.csv', idCol: 'kind_key' }, { name: 'party', file: 'BLD-parties.csv', idCol: 'id' }],
    perms: { add: ['USER'], correct: [] },
    noCorrect: true,
    alwaysPending: false,
    defaultMode: 'direct',
    input: {
      subject_table:   { type: 'text', required: true },
      subject_id:      { type: 'text', required: true },
      cert_kind_key:   { type: 'text', required: true },
      issuer_party_id: { type: 'ref', lookup: 'party' },
      number:          { type: 'text' },
      issued_on:       { type: 'date', required: true },
      result:          { type: 'text' },
      grades:          { type: 'text' },
      expires_on:      { type: 'date' },
      note:            { type: 'text' },
      corrects_id:     { type: 'text' },
      source:          { type: 'text' }
    },
    dupKey: ['subject_table', 'subject_id', 'cert_kind_key', 'issued_on', 'number', 'corrects_id'], dupTimeCol: null,
    stamp: function (row, ctx) { row.set_on = ctx.nowIso; row.set_by = ctx.whoId || ctx.who; row.created_at = ctx.nowIso; },
    checkRow: function (row, errors, lookups) {
      if (!errors.subject_table && !/^[a-z][a-z0-9_]{1,39}$/.test(row.subject_table)) errors.subject_table = 'Use the table\'s name, e.g. subjects or areas.';
      if (!errors.subject_id && !ID_RE_.test(row.subject_id)) errors.subject_id = 'That is not a valid id.';
      if (!errors.cert_kind_key && lookups && lookups.cert_kind && !lookups.cert_kind[row.cert_kind_key]) errors.cert_kind_key = 'No certificate kind with that name. Add it to the kinds first.';
      if (!errors.expires_on && row.expires_on !== '' && !errors.issued_on && row.expires_on < row.issued_on) errors.expires_on = 'It cannot expire before it was issued.';
      if (!errors.corrects_id && row.corrects_id !== '' && !ID_RE_.test(row.corrects_id)) errors.corrects_id = 'That is not a valid id.';
    }
  }
};

function checkKindKey_(row, errors, col, eg) {
  if (!errors[col] && row[col] !== '' && !/^[a-z][a-z0-9_]{1,39}$/.test(row[col])) errors[col] = 'Use lower-case letters, numbers and underscores, e.g. ' + eg + '.';
}
function checkDates_(row, errors) {
  if (!errors.to_date && row.to_date && row.from_date && row.to_date < row.from_date) errors.to_date = 'The end date cannot be before the start date.';
}

var RETIRED_TABLES = {

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

function checkExceptions_(raw, errors, lookups) {
  var parts = String(raw || '').split('|'), out = [], seen = {}, i;
  for (i = 0; i < parts.length; i++) {
    var bit = parts[i].trim();
    if (!bit) continue;
    var bits = bit.split(':'), id = bits[0].trim(), kind = String(bits[1] || '').trim(), text = bits.slice(2).join(':').trim();
    if (!ID_RE_.test(id)) { errors.exceptions = 'Each exception starts with the dog\'s id.'; return raw; }
    if (kind !== 'not_here' && kind !== 'concern' && kind !== 'note') { errors.exceptions = 'An exception is not here, a concern, or a note.'; return raw; }
    if ((kind === 'concern' || kind === 'note') && !text) { errors.exceptions = 'Say briefly what the concern or note is.'; return raw; }
    if (seen[id]) { errors.exceptions = 'A dog can only have one exception on a round.'; return raw; }
    if (lookups && lookups.subject && !lookups.subject[id]) { errors.exceptions = 'That dog was not found.'; return raw; }
    seen[id] = 1;
    out.push(text ? (id + ':' + kind + ':' + text) : (id + ':' + kind));
  }
  return out.join('|');
}

function checkTypeInForce_(records, typeKey, day) {
  var best = null;
  (records || []).forEach(function (r) {
    if (r.type_key !== typeKey || !r.effective_from || r.effective_from > day) return;
    if (!best || r.effective_from >= best.effective_from) best = r;
  });
  if (best && String(best.active).toLowerCase() === 'false') return null;
  return best;
}

function checkPrintBan_(type) {
  if (!type) return '';
  if (String(type.evidence || '') === 'required') return 'Evidence is required, so this check cannot be print only.';
  var blob = (String(type.type_key || '') + ' ' + String(type.label || '')).toLowerCase();
  if (/\bmedicine\b|medicines/.test(blob) || blob.indexOf('medicine') >= 0) return 'Medicines cannot be print only.';
  if (blob.indexOf('incident') >= 0) return 'Incidents cannot be print only.';
  var every = parseInt(type.every_days, 10), freq = String(type.frequency || '').toLowerCase();
  var yearly = (every >= 300) || /year|annual/.test(freq);
  if (yearly && /vet|fitness|screen/.test(blob)) return 'A yearly vet, fitness or screening check cannot be print only.';
  return '';
}

function checkEvery_(v) {
  var s = String(v == null ? '' : v).trim();
  if (!/^\d+$/.test(s)) return null;
  var n = parseInt(s, 10);
  return n > 0 ? n : null;
}

function specFor_(keyOrFile) {
  var k;
  for (k in TABLES) {
    if (!Object.prototype.hasOwnProperty.call(TABLES, k)) continue;
    if (TABLES[k].key === keyOrFile || TABLES[k].file === keyOrFile) return TABLES[k];
  }
  return null;
}

function allowedFiles_() {
  var out = [BLD.PENDING_FILE].concat(inspectFiles_()).concat(dogcardFiles_()).concat(codeRegisterFiles_()).concat(visitFiles_()).concat(linksFiles_()).concat(editFiles_()).concat(scoresFiles_());
  for (var k in TABLES) if (Object.prototype.hasOwnProperty.call(TABLES, k) && out.indexOf(TABLES[k].file) < 0) out.push(TABLES[k].file);
  return out;
}

var READABLE = {
  area:            { file: 'BLD-area.csv',            vis: 'area',            authorCol: '',            dateCol: '' },
  subject:         { file: 'BLD-subject.csv',         vis: 'subject',         authorCol: '',            dateCol: '' },
  subject_status:  { file: 'BLD-subject_status.csv',  vis: 'subject_status',  authorCol: '',            dateCol: '' },
  occupancy:       { file: 'BLD-occupancy.csv',       vis: 'occupancy',       authorCol: '',            dateCol: '' },
  area_reading:    { file: 'BLD-area_reading.csv',    vis: 'area_reading',    authorCol: 'taken_by',    dateCol: 'taken_at' },
  occupancy_check: { file: 'BLD-occupancy_check.csv', vis: 'occupancy_check', authorCol: 'confirmed_by', dateCol: 'confirmed_at' },
  breeding_rule:   { file: 'BLD-breeding_rule.csv',   vis: 'breeding_rule',   authorCol: 'set_by',      dateCol: 'set_at', keyCol: 'rule_key' },
  code_register:   { file: 'BLD-code_register.csv',   vis: 'code_register',   authorCol: '',            dateCol: '' },
  code_vaults:     { file: 'BLD-code_vaults.csv',     vis: 'code_vaults',     authorCol: '',            dateCol: '' },
  guest_reading:   { file: 'BLD-guest_reading.csv',   vis: 'guest_reading',   authorCol: 'taken_by',    dateCol: 'taken_at' },
  check_type:      { file: 'BLD-check_type.csv',      vis: 'check_type',      authorCol: 'set_by',      dateCol: 'set_at' },
  check_log:       { file: 'BLD-check_log.csv',       vis: 'check_log',       authorCol: 'taken_by',    dateCol: 'taken_at' },
  check_setting:   { file: 'BLD-check_setting.csv',   vis: 'check_setting',   authorCol: 'set_by',      dateCol: 'set_at' },
  retention_setting: { file: 'BLD-retention_setting.csv', vis: 'retention_setting', authorCol: 'set_by', dateCol: 'set_on' },
  check_field:     { file: 'BLD-check_field.csv',     vis: 'check_field',     authorCol: 'set_by',      dateCol: 'set_at' },
  check_value:     { file: 'BLD-check_value.csv',     vis: 'check_value',     authorCol: '',            dateCol: '' },
  qr_tag:          { file: 'BLD-qr_tag.csv',          vis: 'qr_tag',          authorCol: '',            dateCol: '' },
  area_capacity:   { file: 'BLD-area_capacity.csv',   vis: 'area_capacity',   authorCol: '',            dateCol: '' },
  area_access:     { file: 'BLD-area_access.csv',     vis: 'area_access',     authorCol: '',            dateCol: '' },
  litter:          { file: 'BLD-litter.csv',          vis: 'litter',          authorCol: '',            dateCol: '' },
  health_screen:   { file: 'BLD-health_screen.csv',   vis: 'health_screen',   authorCol: '',            dateCol: '' },
  fit_to_breed:    { file: 'BLD-fit_to_breed.csv',    vis: 'fit_to_breed',    authorCol: '',            dateCol: '' },
  coat_colour:     { file: 'BLD-coat_colour.csv',     vis: 'coat_colour',     authorCol: '',            dateCol: '' },
  coat_pattern:    { file: 'BLD-coat_pattern.csv',    vis: 'coat_pattern',    authorCol: '',            dateCol: '' },
  nose_pigment:    { file: 'BLD-nose_pigment.csv',    vis: 'nose_pigment',    authorCol: '',            dateCol: '' },
  microchip:       { file: 'BLD-microchip.csv',       vis: 'microchip',       authorCol: '',            dateCol: '' },
  temperature_band: { file: 'BLD-temperature_band.csv', vis: 'temperature_band', authorCol: '',          dateCol: '' },
  sensor_reading:  { file: 'BLD-sensor_reading.csv',  vis: 'sensor_reading',  authorCol: 'taken_by',    dateCol: 'taken_at' },
  thermometer:     { file: 'BLD-thermometer.csv',     vis: 'thermometer',     authorCol: 'made_by',     dateCol: 'made_at' },
  requirement:     { file: 'BLD-requirement.csv',     vis: 'requirement',     authorCol: 'set_by',      dateCol: 'set_on' },
  area_link:       { file: 'BLD-area_link.csv',       vis: 'area_link',       authorCol: 'set_by',      dateCol: 'set_on' },
  capacity_setting: { file: 'BLD-capacity_setting.csv', vis: 'capacity_setting', authorCol: '',          dateCol: '' },
  weight:          { file: 'BLD-weight.csv',          vis: 'weight',          authorCol: '',            dateCol: 'performed_on' },
  subject_link:    { file: 'BLD-subject_link.csv',    vis: 'subject_link',    authorCol: 'set_by',      dateCol: 'set_at' },
  items:           { file: 'BLD-items.csv',           vis: 'items',           authorCol: 'created_by',  dateCol: 'created_at' },
  item_kinds:      { file: 'BLD-item_kinds.csv',      vis: 'item_kinds',      authorCol: 'set_by',      dateCol: 'set_on' },
  links:           { file: 'BLD-links.csv',           vis: 'links',           authorCol: 'set_by',      dateCol: 'set_on' },
  files:           { file: 'BLD-files.csv',           vis: 'files',           authorCol: 'set_by',      dateCol: 'set_on' }
};

