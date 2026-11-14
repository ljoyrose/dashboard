'use strict';
/** 14 Nov 2026, ITEMS: the Items page maths (cdhub/items-view.js) on the 2025 PAT and extinguisher records. */
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../../cdhub/items-view.js');

const T0 = () => ({
  'BLD-item_kinds.csv': [{ kind_key: 'appliance_class_1', label: 'Plug-in Class I' }, { kind_key: 'extinguisher_co2', label: 'Extinguisher CO2' }],
  'BLD-items.csv': [
    { id: 'itm-1', item_no: '04', name: 'Kettle', kind_key: 'appliance_class_1', created_at: '2026-11-14T01:00:00Z' },
    { id: 'itm-2', item_no: 'EXT-03', name: 'CO2', kind_key: 'extinguisher_co2', size: '2.2 kg', expires_on: '2026-12-01', created_at: '2026-11-14T01:00:00Z' },
    { id: 'itm-3', item_no: '04', name: 'Kettle (staff room)', kind_key: 'appliance_class_1', corrects_id: 'itm-1', created_at: '2026-11-14T02:00:00Z' }
  ],
  'BLD-check_type.csv': [
    { id: 'cty-1', type_key: 'pat_class_1', label: 'PAT', target: 'item', item_kind: 'appliance_class_1', every_days: '365', effective_from: '2025-01-01' },
    { id: 'cty-2', type_key: 'ext_service', label: 'Service', target: 'item', item_kind: 'extinguisher_co2', every_days: '365', effective_from: '2025-01-01' },
    { id: 'cty-3', type_key: 'bowls', label: 'Bowls', target: 'none', effective_from: '2025-01-01' }
  ],
  'BLD-check_field.csv': [{ type_key: 'pat_class_1', field_key: 'earth_bond', label: 'Earth bond', kind: 'number', unit: 'Ω', limit_high: '0.1', effective_from: '2025-01-01' }],
  'BLD-check_log.csv': [
    { id: 'clg-1', check_type_id: 'cty-1', item_id: 'itm-1', outcome: 'ok', happened_at: '2025-05-28T12:00:00Z' },
    { id: 'clg-2', check_type_id: 'cty-2', item_id: 'itm-2', outcome: 'ok', happened_at: '2026-08-28T12:00:00Z' }
  ],
  'BLD-check_value.csv': [{ check_log_id: 'clg-1', field_key: 'earth_bond', value: '0.09' }],
  'BLD-links.csv': [
    { from_table: 'items', from_id: 'itm-1', role: 'placed_in', to_table: 'areas', to_id: 'area-1', from_date: '2025-05-28' },
    { from_table: 'items', from_id: 'itm-1', role: 'placed_in', to_table: 'areas', to_id: 'area-2', from_date: '2026-11-01' }
  ],
  'BLD-area.csv': [{ id: 'area-1', code: 'Kitchen' }, { id: 'area-2', code: 'Staff room' }],
  'BLD-breeding_rule.csv': [{ rule_key: 'items.due_soon_days', value: '30', effective_from: '2026-01-01' }],
  'BLD-requirement.csv': []
});
const ON = '2026-11-14';

test('a change shows the latest name; tests stay on the first row id', () => {
  const cur = V.current(T0());
  assert.equal(cur.length, 2);
  assert.equal(cur.find((x) => x.id === 'itm-1').name, 'Kettle (staff room)');
});

test('PAT passed 28 May 2025 every 365 days is overdue on 14 Nov 2026; the room is the latest placed_in row', () => {
  const x = V.list(T0(), ON).find((y) => y.it.id === 'itm-1');
  assert.equal(x.s.st, 'due');
  assert.equal(x.s.lines[0].next, '2026-05-28');
  assert.equal(x.place, 'Staff room');
  assert.equal(V.list(T0(), '2026-10-01').find((y) => y.it.id === 'itm-1').place, 'Kitchen', 'what was true on an earlier day');
});

test('an extinguisher expiring within the due-soon rule is amber; past expiry is red; no rule row = no amber', () => {
  assert.equal(V.list(T0(), ON).find((y) => y.it.id === 'itm-2').s.st, 'soon');
  assert.equal(V.list(T0(), '2026-12-02').find((y) => y.it.id === 'itm-2').s.st, 'expired');
  const T = T0(); T['BLD-breeding_rule.csv'] = [];
  assert.equal(V.list(T, ON).find((y) => y.it.id === 'itm-2').s.st, 'ok');
});

test('a Fail is red until a later Pass; archived items leave the list and sort last', () => {
  const T = T0();
  T['BLD-check_log.csv'].push({ id: 'clg-3', check_type_id: 'cty-2', item_id: 'itm-2', outcome: 'concern', happened_at: '2026-11-10T12:00:00Z' });
  assert.equal(V.list(T, ON).find((y) => y.it.id === 'itm-2').s.st, 'fail');
  T['BLD-requirement.csv'].push({ need_type: 'item.in_use', target_table: 'items', target_id: 'itm-2', from_date: '2025-08-28', to_date: '2026-11-12', source: 'Failed test' });
  const all = V.list(T, ON);
  assert.equal(all[all.length - 1].it.id, 'itm-2');
  assert.equal(all[all.length - 1].archived, true);
  assert.equal(V.list(T, '2026-11-01').find((y) => y.it.id === 'itm-2').archived, false, 'in use on the days its row covers');
});

test('limits: inside / outside / not set', () => {
  const f = { limit_high: '0.1' };
  assert.equal(V.inLimit(f, '0.09'), true);
  assert.equal(V.inLimit(f, '0.2'), false);
  assert.equal(V.inLimit({}, '5'), null);
});

test('CSV: one line per item and test with readings; formulas are made safe', () => {
  const T = T0(); T['BLD-items.csv'][0].name = '=HYPERLINK()'; T['BLD-items.csv'].pop();
  const out = V.csv(T, ON);
  assert.match(out, /^item_no,name,kind,room/);
  assert.match(out, /earth_bond=0\.09/);
  assert.match(out, /"'=HYPERLINK\(\)"/);
});

test('Compliance fold: per kind in date / due soon / overdue, SOP named, archived left out', () => {
  const T = T0(); T['BLD-check_type.csv'][0].sop = 'Electrical safety';
  const v = { T, esc: (x) => String(x), dmy: (x) => x };
  const h = V.complianceHtml(v, null, ON);
  assert.match(h, /Plug-in Class I/);
  assert.match(h, /Electrical safety/);
  assert.match(h, /data-itm-go="due"><span class="pill no">1/);
  assert.match(h, /data-itm-go="soon"><span class="pill w">1/);
  assert.equal(V.complianceHtml({ T: {}, esc: String, dmy: String }, null, ON), '');
});
