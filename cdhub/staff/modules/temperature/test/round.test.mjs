// The round is the thermometer rows, never a coded list (overseer, 11 Nov 2026: one thermometer per place,
// corridors are their own place, fields have none). When a room or thermometer is needed comes only from
// BLD-requirement rows through the shared lib (Lisa 11 Nov 2026, "A standard"). Invented rows only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const N = req('../../../lib/needs.js');
globalThis.self = { BLDNeeds: N };
globalThis.window = { BLDNeeds: N, BLDThermometer: req('../../../lib/thermometer.js'), BLDOccupancy: req('../../../lib/occupancy.js') };
globalThis.document = { currentScript: null };
new Function(readFileSync(new URL('../module.js', import.meta.url), 'utf8'))();
const { roundAreas, areaRows } = globalThis.window.BLDTemperature;

const RAW = [
  { id: 'a1', code: '3A.1/2', group_sort: '1' }, { id: 'a2', code: '3A.3/4/5', group_sort: '2' },
  { id: 'ac', code: '3A corridor', group_sort: '3' }, { id: 'f1', code: 'Field 1', group_sort: '4' },
  { id: 'old', code: '3A.2/3', group_sort: '0' }
];
const NEED = [
  { need_type: 'room.in_use', target_table: 'area', target_id: 'old', from_date: '2025-01-01', to_date: '2026-11-11' },
  { need_type: 'reading.temperature', target_table: 'thermometer', target_id: 't-old', from_date: '2025-01-01', to_date: '2026-11-11' },
  { need_type: 'reading.temperature', target_table: 'thermometer', target_id: 't-new', from_date: '2026-11-12', to_date: '' }
];
const areas = areaRows(RAW, NEED, '2026-11-12');

test('a room whose room.in_use rows have ended reads "(retired 11 Nov 2026)" and sorts last; no ZZ_ name check', () => {
  assert.deepEqual(areas.map((a) => a.label), ['3A.1/2', '3A.3/4/5', '3A corridor', 'Field 1', '3A.2/3 (retired 11 Nov 2026)']);
  assert.equal(areaRows(RAW, NEED, '2026-11-11').find((a) => a.id === 'old').label, '3A.2/3');
  assert.equal(areaRows([{ id: 'z', code: 'ZZ_old' }], [], '2026-11-12')[0].label, 'ZZ_old');
});

test('no thermometer rows yet: every room in use that day is listed', () => {
  assert.deepEqual(roundAreas(areas, [], '2026-11-12', NEED).map((x) => x.id), ['a1', 'a2', 'ac', 'f1']);
  assert.deepEqual(roundAreas(areas, [], '2026-11-11', NEED).map((x) => x.id), ['a1', 'a2', 'ac', 'f1', 'old']);
});

test('Lisa 11 Nov: the old thermometer is due up to and including 11 Nov, the new one from 12 Nov', () => {
  const rows = [{ id: 't-old', name: '3A.2/3', area_id: 'old' }, { id: 't-new', name: '3A.1/2', area_id: 'a1' }];
  assert.deepEqual(roundAreas(areas, rows, '2026-11-11', NEED).map((x) => x.id), ['old']);
  assert.deepEqual(roundAreas(areas, rows, '2026-11-12', NEED).map((x) => x.id), ['a1']);
});

test('only places with a thermometer are on the round, in room order; two thermometers in one room are listed by name', () => {
  const r = roundAreas(areas, [
    { id: 't3', name: '3A corridor', area_id: 'ac' },
    { id: 't1', name: 'T1', area_id: 'a1' },
    { id: 't1b', name: 'T1 spare', area_id: 'a1' }
  ], '2026-11-12', NEED);
  assert.deepEqual(r.map((x) => x.id), ['a1', 'a1', 'ac']);
  assert.deepEqual(r.map((x) => x.label), ['3A.1/2 · T1', '3A.1/2 · T1 spare', '3A corridor']);
  assert.deepEqual(r.map((x) => x.thermometerId), ['t1', 't1b', 't3']);
});
