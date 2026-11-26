const { test } = require('node:test');
const assert = require('node:assert/strict');
const Y = require('../cdhub/yearly-print.js');
const Meds = require('../cdhub/meds-register.js');

const TODAY = '2026-03-15';
const TYPES = [
  { id: 'ct-h', type_key: 'health_check_all', label: 'Health check', target: 'none', site_scope: 'per_dog', every_days: '1', effective_from: '2026-01-01', group: 'Care' },
  { id: 'ct-p', type_key: 'parasites', label: 'Parasites', target: 'dog', every_days: '90', effective_from: '2026-01-01' },
  { id: 'ct-w', type_key: 'water_bowls', label: 'Water bowls', target: 'area', every_days: '1', effective_from: '2026-01-01' },
  { id: 'ct-f', type_key: 'future_job', label: 'Future job', target: 'none', every_days: '1', effective_from: '2026-03-01' },
  { id: 'ct-m', type_key: 'medicine', label: 'Medicine given', target: 'dog', every_days: '1', effective_from: '2026-01-01' }
];
const DOGS = [
  { id: 'd-ada', name: 'Ada', dob: '2024-01-01', area_id: 'a1', onSite: true },
  { id: 'd-bob', name: 'Bob', dob: '2026-03-10', area_id: 'a1', onSite: true }
];
const AREAS = [{ id: 'a1', name: 'Cabin A', onSite: true }];
function ctx(extra) {
  return Object.assign({
    today: TODAY, kennel: 'Sample Kennel', printed: '15 Mar 2026',
    types: TYPES, logs: [], dogs: DOGS, areas: AREAS, tables: {},
    dogName: (id) => (DOGS.find((d) => d.id === id) || {}).name || '',
    areaName: (id) => (AREAS.find((a) => a.id === id) || {}).name || ''
  }, extra || {});
}
function log(id, type, iso, dog, outcome, note) {
  return { id: id, check_type_id: type, subject_id: dog || '', outcome: outcome || 'ok', happened_at: iso + 'T09:00:00Z', taken_by: 'Sample Staff', note: note || '' };
}

test('a year is the months that have started, and a future month is left out', () => {
  assert.deepEqual(Y.monthsFor({ period: 'year', year: 2026, today: TODAY }).map((m) => m.ym), ['2026-01', '2026-02', '2026-03']);
  assert.deepEqual(Y.monthsFor({ period: 'month', year: 2026, month: 2, today: TODAY }).map((m) => m.ym), ['2026-03']);
  assert.deepEqual(Y.monthsFor({ period: 'month', year: 2026, month: 10, today: TODAY }), []);
});

test('layout follows the check type, including one this kennel has never used', () => {
  assert.equal(Y.layoutOf(TYPES[0]), 'dogs');
  assert.equal(Y.layoutOf(TYPES[1]), 'list');
  assert.equal(Y.layoutOf(TYPES[2]), 'areas');
  assert.equal(Y.layoutOf(TYPES[3]), 'site');
  assert.equal(Y.layoutOf({ type_key: 'weekly_nails', target: 'dog', every_days: '7' }), 'list');
  assert.equal(Y.layoutOf({ type_key: 'room_clean', target: 'area', every_days: '' }), 'areas');
  const ids = Y.catalogue(ctx()).map((s) => s.id);
  assert.ok(ids.includes('check:future_job'));
  assert.ok(ids.includes('check:health_check_all'));
  assert.equal(ids.includes('check:medicine'), false);
  ['medicines', 'microchip', 'microchip_registration', 'fit_to_breed', 'visit', 'area_reading', 'items', 'litter', 'weight', 'vaccination', 'sale'].forEach((id) => {
    assert.ok(ids.includes(id), id);
  });
});

test('the 24 kennel check names all print once a row exists, whatever the industry calls them', () => {
  const keys = ['health_check_all', 'parasites', 'whole_site_clean', 'water_bowls', 'evening_count', 'food_bowls', 'fresh_food', 'site_check', 'socialization', 'fit_to_breed', 'exercise_all', 'round.presence', 'pat_class_1', 'pat_class_2', 'bedding', 'toys', 'pest_checks', 'vehicle_crate', 'cleaning_kit', 'brush_bath_clip', 'cleaning', 'ext_service_co2', 'ext_service_water', 'ext_service_powder'];
  const types = keys.map((k, i) => ({ id: 't' + i, type_key: k, label: k.replace(/[._]/g, ' '), target: 'none', every_days: '30', effective_from: '2026-01-01' }));
  const got = Y.catalogue(ctx({ types: types })).filter((s) => s.kind === 'check').map((s) => s.typeKey);
  assert.deepEqual(got, keys.slice().sort());
});

test('a per-dog month is a grid: tick, part, missed, and a pup is not missed before it is born', () => {
  const logs = [
    log('l1', 'ct-h', '2026-03-01', 'd-ada', 'ok'),
    log('l2', 'ct-h', '2026-03-02', 'd-ada', 'part_done', 'ate slowly'),
    log('l3', 'ct-h', '2026-03-01', 'd-bob', 'ok'),
    log('l4', 'ct-h', '2026-03-04', 'd-ada', 'concern', 'limp')
  ];
  const g = Y.gridMonth(Y.catalogue(ctx({ logs: logs })).find((s) => s.id === 'check:health_check_all'), '2026-03', ctx({ logs: logs }));
  assert.deepEqual(g.rows.map((r) => r.name), ['Ada', 'Bob']);
  assert.equal(g.days.length, 31);
  assert.equal(g.marks['d-ada']['2026-03-01'], 'tick');
  assert.equal(g.marks['d-ada']['2026-03-02'], 'part');
  assert.equal(g.marks['d-ada']['2026-03-03'], 'miss');
  assert.equal(g.marks['d-ada']['2026-03-04'], 'concern');
  assert.equal(g.marks['d-ada']['2026-03-16'], '');
  assert.equal(g.marks['d-bob']['2026-03-01'], 'tick');
  assert.equal(g.marks['d-bob']['2026-03-09'], '');
  assert.equal(g.marks['d-bob']['2026-03-10'], 'miss');
  const built = Y.build({ period: 'month', year: 2026, month: 2, ids: ['check:health_check_all'], today: TODAY }, ctx({ logs: logs }));
  assert.equal(built.pages.length, 1);
  assert.match(built.html, /data-layout="dogs"/);
  assert.match(built.html, /Sample Kennel/);
  assert.match(built.html, /Health check/);
  assert.match(built.html, /March 2026/);
  assert.match(built.html, /Signed/);
  assert.match(built.html, /data-mark="tick"/);
  assert.match(built.pages[0].html, /\u2713/);
});

test('a sparse type is one list page, and a year is one page per started month', () => {
  const logs = [log('l9', 'ct-p', '2026-02-02', 'd-ada', 'ok', 'from clg-20261118-042020-vf20 spot')];
  const month = Y.build({ period: 'month', year: 2026, month: 1, ids: ['check:parasites'], today: TODAY }, ctx({ logs: logs }));
  assert.equal(month.pages.length, 1);
  assert.match(month.html, /data-layout="list"/);
  assert.match(month.html, /February 2026/);
  assert.match(month.html, /Ada/);
  assert.match(month.html, /done/);
  assert.match(month.html, /spot/);
  assert.doesNotMatch(month.html, /clg-20261118-042020-vf20/);
  const year = Y.build({ period: 'year', year: 2026, month: 0, ids: ['check:parasites'], today: TODAY }, ctx({ logs: logs }));
  assert.deepEqual(year.pages.map((p) => p.month), ['2026-01', '2026-02', '2026-03']);
  assert.match(year.pages[0].html, /No records in January 2026/);
  const future = Y.build({ period: 'year', year: 2026, ids: ['check:future_job'], today: TODAY }, ctx());
  assert.equal(future.pages.length, 3);
  assert.ok(future.pages.every((p) => p.layout === 'site'));
});

test('a whole year of a fixed table keeps undated rows on their own page, and the CSV cannot run a formula', () => {
  const tables = { 'BLD-microchip.csv': [
    { id: 'mc-1', subject_id: 'd-ada', chip_number: '900000000000001' },
    { id: 'mc-2', subject_id: 'd-bob', chip_number: '900000000000002', registered_on: '2026-01-04' }
  ] };
  const built = Y.build({ period: 'year', year: 2026, ids: ['microchip'], today: TODAY }, ctx({ tables: tables }));
  assert.ok(built.pages.some((p) => p.month === 'undated' && /900000000000001/.test(p.html) && /Ada/.test(p.html)));
  assert.match(built.pages.find((p) => p.month === '2026-01').html, /900000000000002/);
  const csv = Y.toCsv({ period: 'month', year: 2026, month: 1, ids: ['check:parasites'], today: TODAY }, ctx({
    logs: [log('l9', 'ct-p', '2026-02-02', 'd-ada', 'ok', '=CMD()')]
  }));
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /'=CMD\(\)/);
  assert.doesNotMatch(csv, /,=CMD/);
  assert.equal(Y.fileName({ period: 'month', year: 2026, month: 1, ids: ['check:parasites'] }), 'yearly-parasites-2026-02.csv');
});

test('PR 785 year pack: chip number, registration, fit to breed, medicines, vaccination, weight, vet visit, mating, health grade', () => {
  const tables = {
    'BLD-microchip.csv': [{ id: 'mc-1', subject_id: 'd-ada', chip_number: '900000000000001' }],
    'BLD-microchip_registration.csv': [{ id: 'mr-1', microchip_id: 'mc-1', registry: 'Sample registry', registered_on: '2026-02-02' }],
    'BLD-fit_to_breed.csv': [{ id: 'f1', subject_id: 'd-ada', assessed_on: '2026-02-03', outcome: 'fit', vet_name: 'Sample Vet' }],
    'BLD-vaccination.csv': [{ id: 'v1', subject_id: 'd-ada', given_on: '2026-02-04', product: 'Sample Vaccine', diseases_covered: 'Sample course' }],
    'BLD-weight.csv': [{ id: 'w1', subject_id: 'd-ada', performed_on: '2026-02-05', weight_kg: '12.5', unit: 'kg' }],
    'BLD-visit.csv': [{ id: 'vs1', subject_id: 'd-ada', performed_on: '2026-02-06', kind: 'appointment', status: 'done', reason: 'Sample check' }],
    'BLD-mating.csv': [{ id: 'mt1', dam_subject_id: 'd-ada', sire_subject_id: 'd-bob', mated_on: '2026-02-07', method: 'natural' }],
    'BLD-health_screen.csv': [{ id: 'hs1', subject_id: 'd-ada', test: 'hips', grade: 'A' }]
  };
  const c = ctx({ tables: tables, meds: (ym) => {
    if (ym !== '2026-02') return { columns: Meds.COLUMNS, lines: [], cell: (l, k) => Meds.cell(l, k) };
    const lines = Meds.build([{ id: 'dsp1', subject_id: 'd-ada', given_on: '2026-02-08', product: 'Med C', dose_volume: '1 tablet', given_by: 'Sample Staff' }], { month: ym, dog: () => ({ name: 'Ada', chip: '' }) });
    return { columns: Meds.COLUMNS, lines: lines, cell: (l, k) => Meds.cell(l, k) };
  } });
  const choice = { period: 'month', year: 2026, month: 1, today: TODAY };
  function page(id) { return Y.build(Object.assign({ ids: [id] }, choice), c).html; }
  function csv(id) { return Y.toCsv(Object.assign({ ids: [id] }, choice), c); }
  assert.match(page('microchip'), /900000000000001/);
  assert.match(page('microchip'), /Ada/);
  assert.match(csv('microchip'), /900000000000001/);
  const reg = page('microchip_registration');
  assert.match(reg, /February 2026/);
  assert.match(reg, /900000000000001/);
  assert.match(reg, /Sample registry/);
  assert.match(reg, /Ada/);
  assert.match(page('fit_to_breed'), /fit/);
  assert.match(page('fit_to_breed'), /Sample Vet/);
  assert.match(page('vaccination'), /Sample Vaccine/);
  assert.match(page('vaccination'), /Sample course/);
  assert.match(page('weight'), /12\.5 kg/);
  assert.match(page('visit'), /Sample check/);
  assert.match(page('mating'), /natural/);
  assert.match(page('mating'), /Bob/);
  const grade = page('health_screen');
  assert.match(grade, /hips/);
  assert.match(grade, />A</);
  assert.match(csv('health_screen'), /,A/);
  const meds = page('medicines');
  assert.match(meds, /Med C/);
  assert.match(meds, /1 tablet/);
  assert.match(meds, /Sample Staff/);
  assert.match(csv('medicines'), /Med C/);
  // Room temperatures keep the existing year PDF. This page still exports the readings.
  const temps = Y.catalogue(c).find((s) => s.id === 'area_reading');
  assert.match(temps.printPath, /Temperature history/);
});

test('entry counts follow the chosen months and a missed day is not a row', () => {
  const today = '2026-03-15';
  const types = [
    { id: 't-a', type_key: 'type_a', label: 'Type A', target: 'none', site_scope: 'per_dog', every_days: '1', effective_from: '2026-01-01', group: 'Group A' },
    { id: 't-b', type_key: 'type_b', label: 'Type B', target: 'dog', every_days: '90', effective_from: '2026-01-01', group: 'Group B' },
    { id: 't-c', type_key: 'type_c', label: 'Type C', target: 'none', site_scope: 'per_dog', every_days: '1', effective_from: '2026-01-01', group: 'Group A' },
    { id: 't-m', type_key: 'medicine', label: 'Medicine given', target: 'dog', every_days: '1', effective_from: '2026-01-01' }
  ];
  const logs = [
    { id: 'r1', check_type_id: 't-a', subject_id: 's1', outcome: 'ok', happened_at: '2026-03-02T09:00:00Z' },
    { id: 'r2', check_type_id: 't-b', subject_id: 's1', outcome: 'ok', happened_at: '2026-02-11T09:00:00Z' },
    { id: 'job-1', check_type_id: 't-m', subject_id: 's1', outcome: 'ok', happened_at: '2026-03-04T09:00:00Z', item: 'Item A' },
    { id: 'job-2', check_type_id: 't-m', subject_id: 's1', outcome: 'ok', happened_at: '2026-03-05T09:00:00Z', item: 'Item C' }
  ];
  const tables = {
    'BLD-dispense.csv': [
      { id: 'm1', subject_id: 's1', given_on: '2026-03-04', product: 'Item A', dose_volume: '1', note: 'from job-1' },
      { id: 'm2', subject_id: 's1', given_on: '2026-01-02', product: 'Item B', dose_volume: '1' }
    ],
    'BLD-weight.csv': [{ id: 'w1', subject_id: 's1', performed_on: '2026-02-05', weight_kg: '2' }],
    'BLD-visit.csv': [
      { id: 'v1', subject_id: 's1', performed_on: '2026-03-02', status: 'booked', reason: 'Later' },
      { id: 'v2', subject_id: 's1', performed_on: '2026-03-03', status: 'done', reason: 'Seen' }
    ],
    'BLD-area_reading.csv': [
      { id: 'a1', area_id: 'rm1', min_c: '10', max_c: '18', period_start: '2026-03-02T08:00:00Z' },
      { id: 'a2', area_id: 'rm1', min_c: '1', max_c: '2', period_start: '2026-03-02T09:00:00Z', linked_from: 'a1' },
      { id: 'a3', area_id: '', min_c: '1', max_c: '2', period_start: '2026-03-04T08:00:00Z' }
    ],
    'BLD-microchip.csv': [
      { id: 'c1', subject_id: 's1', chip_number: '100' },
      { id: 'c2', subject_id: 's1', chip_number: '200', registered_on: '2026-03-01' }
    ]
  };
  const c = ctx({
    today: today, types: types, logs: logs, tables: tables,
    dogs: [{ id: 's1', name: 'One', dob: '2024-01-01', onSite: true }]
  });
  function at(period, month) {
    return Y.entryCounts(c, { period: period, year: 2026, month: month, today: today });
  }
  const mar = at('month', 2);
  assert.equal(mar['check:type_a'], 1);
  assert.equal(mar['check:type_b'], 0);
  assert.equal(mar['check:type_c'], 0);
  assert.equal(mar.medicines, 2);
  assert.equal(mar.weight, 0);
  assert.equal(mar.visit, 1);
  assert.equal(mar.area_reading, 1);
  assert.equal(mar.microchip, 1);
  const feb = at('month', 1);
  assert.equal(feb['check:type_a'], 0);
  assert.equal(feb['check:type_b'], 1);
  assert.equal(feb.weight, 1);
  assert.equal(feb.medicines, 0);
  const year = at('year', 0);
  assert.equal(year['check:type_a'], 1);
  assert.equal(year['check:type_b'], 1);
  assert.equal(year.medicines, 3);
  assert.equal(year.weight, 1);
  const future = at('month', 10);
  assert.equal(future['check:type_a'], 0);
  assert.equal(future.medicines, 0);
  const via = Y.entryCounts(ctx({
    today: today, types: [], logs: [], tables: {},
    meds: (ym) => ({ lines: ym === '2026-03' ? [{}, {}] : [] })
  }), { period: 'month', year: 2026, month: 2, today: today });
  assert.equal(via.medicines, 2);
  const html = Y.screenHtml(c);
  assert.match(html, /id="ypAll">Select all</);
  assert.match(html, /id="ypNone">None</);
  assert.match(html, /id="ypEntries">Select all with entries</);
  assert.doesNotMatch(html, /All records/);
  assert.match(html, /data-yp-n="check:type_a"[^>]*>1</);
  assert.match(html, /data-yp-n="check:type_b"[^>]*>0</);
  assert.match(html, />Group A</);
  assert.match(html, /class="btn"/);
});

test('area rows keep one active room, names stay unique, and an empty grid is one line', () => {
  const today = '2026-03-15';
  const types = [{ id: 't-w', type_key: 'water_bowls', label: 'Water', target: 'area', every_days: '1', effective_from: '2026-01-01' }];
  const areas = [
    { id: 'r1', name: 'Room A', onSite: true },
    { id: 'r1', name: 'Room A', onSite: true },
    { id: 'r2', name: 'Room A', onSite: true },
    { id: 'r3', name: 'Room B', onSite: false, retired: true },
    { id: 'r4', name: 'Kind X', onSite: true, kind: 'corridor' },
    { id: 'r5', name: 'Room C', onSite: true, empty: true },
    { id: 'r9', name: 'Room D', onSite: false, retired: true }
  ];
  const tables = {
    'BLD-requirement.csv': [
      { need_type: 'room.in_use', target_table: 'area', target_id: 'r9', from_date: '2026-03-01', to_date: '' }
    ]
  };
  const c = ctx({
    today, types, areas, tables, dogs: [],
    logs: [{ id: 'rw', check_type_id: 't-w', area_id: 'r1', outcome: 'ok', happened_at: '2026-03-02T09:15:00Z', taken_by: 'A B' }]
  });
  const src = Y.catalogue(c).find((s) => s.id === 'check:water_bowls');
  const g = Y.gridMonth(src, '2026-03', c);
  assert.deepEqual(g.rows.map((r) => r.name), ['Room A', 'Room A (2)', 'Room D']);
  const built = Y.build({ period: 'month', year: 2026, month: 2, ids: ['check:water_bowls'], today: today }, c);
  assert.match(built.html, /AB 09:15/);
  assert.match(built.html, /class="yp-stick"/);
  assert.match(built.html, /Room A/);
  assert.doesNotMatch(built.html, /Kind X/);
  assert.doesNotMatch(built.html, />Room C</);
  const blank = Y.build({ period: 'month', year: 2026, month: 2, ids: ['check:water_bowls'], today: today }, ctx({
    today, types, dogs: [], logs: [], areas: [{ id: 'r1', name: 'Room A', onSite: true }]
  }));
  assert.match(blank.html, /yp-stick[\s\S]*No records in March 2026/);
  assert.doesNotMatch(blank.html, /data-mark=/);
  assert.match(Y.CSS, /counter\(pages\)/);
  assert.doesNotMatch(Y.CSS, /page-break-after:always/);
  assert.match(Y.CSS, /padding:0!important/);
  assert.match(Y.CSS, /width:46mm/);
  assert.match(Y.CSS, /tbody th\{[^}]*white-space:normal/);
  assert.match(Y.CSS, /\.yp-t tr,#ypReport \.yp-list tr\{break-inside:avoid/);
  assert.match(Y.CSS, /\.yp-stick\{break-inside:avoid/);
});

test('an all-subject grid lists only subjects on site in that month', () => {
  const today = '2026-03-15';
  const types = [{ id: 't-a', type_key: 'type_a', label: 'Type A', target: 'none', site_scope: 'per_dog', every_days: '1', effective_from: '2026-01-01' }];
  const dogs = [
    { id: 's1', name: 'One', dob: '2020-01-01', onSite: true },
    { id: 's2', name: 'Two', dob: '2020-01-01', onSite: true }
  ];
  const tables = {
    'BLD-occupancy.csv': [
      { id: 'o1', subject_id: 's1', area_id: 'r1', moved_in: '2026-01-01' },
      { id: 'o2', subject_id: 's2', area_id: 'r1', moved_in: '2026-01-01', moved_out: '2026-02-02' }
    ]
  };
  const logs = [
    { id: 'l1', check_type_id: 't-a', subject_id: 's1', outcome: 'ok', happened_at: '2026-03-04T08:05:00Z', taken_by: 'A B' },
    { id: 'l2', check_type_id: 't-a', subject_id: 's2', outcome: 'ok', happened_at: '2026-03-04T08:05:00Z', taken_by: 'C D' }
  ];
  const c = ctx({ today, types, dogs, logs, tables, dogName: (id) => (id === 's1' ? 'One' : 'Two') });
  const mar = Y.gridMonth(Y.catalogue(c).find((s) => s.typeKey === 'type_a'), '2026-03', c);
  assert.deepEqual(mar.rows.map((r) => r.id), ['s1']);
  const feb = Y.gridMonth(Y.catalogue(c).find((s) => s.typeKey === 'type_a'), '2026-02', c);
  assert.deepEqual(feb.rows.map((r) => r.id), ['s1', 's2']);
  const html = Y.build({ period: 'month', year: 2026, month: 2, ids: ['check:type_a'], today: today }, c).html;
  assert.match(html, /AB 08:05/);
  assert.match(html, /One/);
  assert.doesNotMatch(html, /CD/);
  assert.match(html, /class="yp-stick"/);
});

test('zoom shrinks a page that is taller than one sheet and leaves a short page alone', () => {
  const max = 194 * 96 / 25.4;
  assert.equal(Y.zoomFor(max - 10, 194), 1);
  const z = Y.zoomFor(max * 2, 194);
  assert.ok(z < 1 && z > 0.4);
});

test('medicines: a year is one A4 sheet per month and keeps dose, dog and who', () => {
  const lines = Meds.build([{ id: 'd1', subject_id: 'd-ada', given_on: '2026-02-03', product: 'Med C', dose_volume: '1 tablet', given_by: 'Sample Staff' }], { month: '2026-02', dog: () => ({ name: 'Ada', chip: '' }) });
  const html = Meds.toYearHtml({ kennel: 'Sample Kennel', year: '2026', printed: '15 Mar 2026' }, [
    { month: '2026-01', lines: [] },
    { month: '2026-02', lines: lines }
  ]);
  assert.match(html, /@page\{size:A4 landscape/);
  assert.equal((html.match(/class="meds-sheet"/g) || []).length, 1);
  assert.doesNotMatch(html, /January 2026/);
  assert.match(Meds.toYearHtml({ kennel: '', year: '2026', printed: '' }, [{ month: '2026-01', lines: [] }, { month: '2026-02', lines: [] }]), /No records this month/);
  assert.match(html, /Medicines register · February 2026/);
  assert.match(html, />Dose</);
  assert.match(html, /Ada/);
  assert.match(html, /Sample Staff/);
  assert.match(html, /1 tablet/);
  const one = Meds.toHtml({ kennel: 'Sample Kennel', month: '2026-02', printed: '15 Mar 2026' }, lines);
  assert.match(one, /<title>Medicines register · February 2026<\/title>/);
  assert.match(one, /meds-sheet/);
});

