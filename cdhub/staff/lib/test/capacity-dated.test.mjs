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

// LD-SC audit, OV11 15 Nov 2026: the flap and the sign's limits read the dated rows in force, never just the last row.
test('accessOn: from_date (or an older effective_from), to_date ended, a future row ignored, latest start wins, undated is oldest', () => {
  const A = [
    { area_id: 'r1', access_type: 'limited', from_date: '2026-11-01' },
    { area_id: 'r1', access_type: 'free' },                                        // undated: oldest, never beats a dated row
    { area_id: 'r1', access_type: 'free', from_date: '2026-11-20' },               // not started yet on 15 Nov
    { area_id: 'r2', access_type: 'free', effective_from: '2026-10-01', to_date: '2026-11-10' },
    { area_id: 'r2', access_type: 'limited', effective_from: '2026-09-01' }];
  assert.equal(C.accessOn(A, 'r1', '2026-11-15'), 'limited');
  assert.equal(C.accessOn(A, 'r1', '2026-11-20'), 'free');
  assert.equal(C.accessOn(A, 'r2', '2026-11-05'), 'free');
  assert.equal(C.accessOn(A, 'r2', '2026-11-11'), 'limited');   // the free row ended on 10 Nov
  assert.equal(C.accessOn(A, 'r3', '2026-11-11'), '');
  assert.equal(C.accessOn([{ area_id: 'r1', access_type: 'free', from_date: '2026-11-01' }, { area_id: 'r1', access_type: 'limited', from_date: '2026-11-01' }], 'r1', '2026-11-15'), 'limited');   // same start: the later row
});
test('limitsOn: the sign shows the rows in force that day, small first, "+ pups" left out', () => {
  const R = [
    { area_id: 'r1', access_type: 'limited', size_band: 'medium', max_dogs: '1', from_date: '2026-01-01' },
    { area_id: 'r1', access_type: 'limited', size_band: 'medium', max_dogs: '2', from_date: '2026-11-11' },
    { area_id: 'r1', access_type: 'limited', size_band: 'small', max_dogs: '3', from_date: '2026-11-11' },
    { area_id: 'r1', access_type: 'limited', size_band: 'large + pups', max_dogs: '1', from_date: '2026-11-11' },
    { area_id: 'r1', access_type: 'free', size_band: 'small', max_dogs: '5', from_date: '2026-11-11' }];
  assert.deepEqual(C.limitsOn(R, 'r1', 'limited', '2026-11-15'), [{ band: 'small', n: 3 }, { band: 'medium', n: 2 }]);
  assert.deepEqual(C.limitsOn(R, 'r1', 'limited', '2026-11-10'), [{ band: 'medium', n: 1 }]);
  assert.deepEqual(C.limitsOn(R, 'r1', '', '2026-11-15'), []);
});
test('facts and summary: size from the latest weight with the cut-off rows, the dam of a litter; one plain line', () => {
  const rules = [{ rule_key: 'size_from_kg.medium', value: '10', source: 'invented', effective_from: '2026-01-01' },
    { rule_key: 'size_from_kg.large', value: '25', source: 'invented', effective_from: '2026-01-01' }];
  const f = C.facts({ subjects: [{ id: 'd1', size_band: 'large' }, { id: 'p1', birth_litter_id: 'l1' }], litters: [{ id: 'l1', dam_subject_id: 'd1' }],
    weights: [{ subject_id: 'd1', performed_on: '2026-01-01', weight_kg: '30' }, { subject_id: 'd1', performed_on: '2026-11-01', weight_kg: '12' }], weightsRead: true, rules, today: '2026-11-15' });
  assert.deepEqual(f('d1'), { id: 'd1', size: 'medium', damId: '' });
  assert.equal(f('p1').damId, 'd1');
  assert.equal(C.facts({ subjects: [{ id: 'd1', size_band: 'large' }], weightsRead: false, rules })('d1').size, 'large');
  const r = C.check({ areaId: 'r1', access: 'limited', capacity: [{ area_id: 'r1', access_type: 'limited', size_band: 'small', max_dogs: '3' }], dogs: [{ id: 'x', size: 'small' }] });
  assert.equal(C.summary(r), 'Takes 3 small with limited access. 1 of 3 now.');
});
