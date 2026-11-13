// BLDCapacity dated limits (Lisa 12 Nov 2026): rows in force on a date; old placements judged by the rule then. Invented rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('../capacity.js');

test('inForce: from <= date <= to, to inclusive, blank or bad dates open, datetimes cut to the day, no date = all rows', () => {
  const R = [{ id: 'a', from_date: '2026-11-12' }, { id: 'b', to_date: '2026-11-11' }, { id: 'c' }, { id: 'd', from_date: 'soon', to_date: 'x' }];
  assert.deepEqual(C.inForce(R, '2026-11-11T23:00:00').map((r) => r.id), ['b', 'c', 'd']);
  assert.deepEqual(C.inForce(R, '2026-11-12').map((r) => r.id), ['a', 'c', 'd']);
  assert.equal(C.inForce(R, '').length, 4);
  assert.deepEqual(C.inForce(null, '2026-11-12'), []);
});

const CAP = [
  { area_id: 'r1', access_type: 'free', size_band: '<10kg (small)', max_dogs: '4', to_date: '2026-11-11' },
  { area_id: 'r1', access_type: 'free', size_band: '<10kg (small)', max_dogs: '3', from_date: '2026-11-12' }
];
const dogs = [{ id: 'x1', size: 'small' }, { id: 'x2', size: 'small' }, { id: 'x3', size: 'small' }, { id: 'x4', size: 'small' }];
test('check with a date: 4 small was fine on 11 Nov and is over from 12 Nov; no date keeps the old stricter reading', () => {
  assert.equal(C.check({ areaId: 'r1', access: 'free', capacity: CAP, dogs, date: '2026-11-11' }).status, 'ok');
  assert.equal(C.check({ areaId: 'r1', access: 'free', capacity: CAP, dogs, date: '2026-11-12' }).status, 'over');
  assert.equal(C.check({ areaId: 'r1', access: 'free', capacity: CAP, dogs }).limit, 3);
});
test('two rows in force for the same band: the latest from_date wins', () => {
  const open = [{ area_id: 'r1', access_type: 'free', size_band: 'small', max_dogs: '2', from_date: '2026-01-01' },
    { area_id: 'r1', access_type: 'free', size_band: 'small', max_dogs: '4', from_date: '2026-11-12' }];
  assert.equal(C.check({ areaId: 'r1', access: 'free', capacity: open, dogs, date: '2026-11-12' }).limit, 4);
  assert.equal(C.audit([{ areaId: 'r1', access: 'free', dogs, date: '2026-11-11' }], CAP).ok, 1);
});
test('sizeCutoffs: a row past its to_date no longer counts', () => {
  const rules = [{ rule_key: 'size_from_kg.medium', value: '10', effective_from: '2026-01-01', source: 'P' },
    { rule_key: 'size_from_kg.large', value: '25', effective_from: '2026-01-01', to_date: '2026-06-30', source: 'P' },
    { rule_key: 'size_from_kg.large', value: '20', effective_from: '2026-07-01', source: 'P' }];
  assert.equal(C.sizeCutoffs(rules, '2026-03-01').large, 25);
  assert.equal(C.sizeCutoffs(rules, '2026-11-12').large, 20);
});

test('freePlaces: lists remaining places of the incoming size, and 0 when the room would be over', () => {
  const cap = [
    { area_id: 'r1', access_type: 'free', size_band: 'small', max_dogs: '3', from_date: '2026-01-01' },
    { area_id: 'r1', access_type: 'free', size_band: 'medium', max_dogs: '2', from_date: '2026-01-01' }
  ];
  const empty = C.freePlaces({ areaId: 'r1', access: 'free', capacity: cap, dogs: [], add: { id: 'a', size: 'small' }, date: '2026-11-12' });
  assert.equal(empty.ok, true);
  assert.equal(empty.free, 3);
  assert.equal(empty.size, 'small');
  const one = C.freePlaces({ areaId: 'r1', access: 'free', capacity: cap, dogs: [{ id: 'x', size: 'small' }], add: { id: 'a', size: 'small' }, date: '2026-11-12' });
  assert.equal(one.ok, true);
  assert.equal(one.free, 2);
  const med = C.freePlaces({ areaId: 'r1', access: 'free', capacity: cap, dogs: [{ id: 'x', size: 'small' }, { id: 'y', size: 'small' }], add: { id: 'a', size: 'medium' }, date: '2026-11-12' });
  assert.equal(med.ok, false);
  assert.equal(med.free, 0);
  const medOk = C.freePlaces({ areaId: 'r1', access: 'free', capacity: cap, dogs: [{ id: 'x', size: 'small' }], add: { id: 'a', size: 'medium' }, date: '2026-11-12' });
  assert.equal(medOk.ok, true);
  assert.equal(medOk.free, 1);
});
