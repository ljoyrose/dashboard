// Yearly print: month split, the daily grid, and a check type the code has never heard of.
// Run: node --test tests/yearly-print.test.js
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
  const keys = ['health_check_all', 'parasites', 'whole_site_clean', 'water_bowls', 'evening_count', 'food_bowls', 'fresh_food', 'site_check', 'socialisation', 'fit_to_breed', 'exercise_all', 'round.presence', 'pat_class_1', 'pat_class_2', 'bedding', 'toys', 'pest_checks', 'vehicle_crate', 'cleaning_kit', 'brush_bath_clip', 'cleaning', 'ext_service_co2', 'ext_service_water', 'ext_service_powder'];
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
  assert.equal(g.marks['d-bob']['2026-03-01'], 'tick');   // a real record is shown even before the birth date used for "missed"
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
    const lines = Meds.build([{ id: 'dsp1', subject_id: 'd-ada', given_on: '2026-02-08', product: 'Sample Wormer', dose_volume: '1 tablet', given_by: 'Sample Staff' }], { month: ym, dog: () => ({ name: 'Ada', chip: '' }) });
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
  assert.match(meds, /Sample Wormer/);
  assert.match(meds, /1 tablet/);
  assert.match(meds, /Sample Staff/);
  assert.match(csv('medicines'), /Sample Wormer/);
  // Room temperatures keep the existing year PDF. This page still exports the readings.
  const temps = Y.catalogue(c).find((s) => s.id === 'area_reading');
  assert.match(temps.printPath, /Temperature history/);
});

test('zoom shrinks a page that is taller than one sheet and leaves a short page alone', () => {
  const max = 194 * 96 / 25.4;
  assert.equal(Y.zoomFor(max - 10, 194), 1);
  const z = Y.zoomFor(max * 2, 194);
  assert.ok(z < 1 && z > 0.4);
});

test('medicines: a year is one A4 sheet per month and keeps dose, dog and who', () => {
  const lines = Meds.build([{ id: 'd1', subject_id: 'd-ada', given_on: '2026-02-03', product: 'Sample Wormer', dose_volume: '1 tablet', given_by: 'Sample Staff' }], { month: '2026-02', dog: () => ({ name: 'Ada', chip: '' }) });
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
