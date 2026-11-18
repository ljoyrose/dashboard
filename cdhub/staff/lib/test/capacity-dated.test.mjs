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

test('sizeFromKg follows SOP Care Rounds: small under 10, medium 10 to 25, large OVER 25 (exactly 25 kg is medium)', () => {
  const cut = { medium: 10, large: 25 };
  assert.equal(C.sizeFromKg('9.99', cut), 'small');
  assert.equal(C.sizeFromKg('10', cut), 'medium');
  assert.equal(C.sizeFromKg('25', cut), 'medium');
  assert.equal(C.sizeFromKg('25.01', cut), 'large');
  assert.equal(C.sizeFromKg('', cut), '');
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

test('flap set to limited but limits only recorded for free access: unknown, and the reason says so (3A.1/2, 17 Nov 2026)', () => {
  const rows = [{ area_id: 'r2', access_type: 'free', size_band: '10-25kg (medium)', max_dogs: '3' }];
  const r = C.check({ areaId: 'r2', access: 'limited', capacity: rows, dogs: [{ id: 'a', size: 'medium' }, { id: 'b', size: 'medium' }], date: '2026-11-17' });
  assert.equal(r.status, 'unknown');
  assert.match(r.message, /flap is set to limited access, but this room only has limits for free access/);
  const ok = C.check({ areaId: 'r2', access: 'free', capacity: rows, dogs: [{ id: 'a', size: 'medium' }], date: '2026-11-17' });
  assert.equal(ok.status, 'ok');
  assert.doesNotMatch(ok.message, /flap is set/);
});

// The Space Rules poster as BLD-breeding_rule holds it (rule keys as in the live sheet, 11 Nov 2026). Invented ids.
const POSTER = [];
[['free', { small: [2.5, 2.5, 4.5, 6.0], medium: [2.5, 4.5, 6.0], large: [4.5, 6.0] }, { small: 5, medium: 5, large: 9 }],
 ['limited', { small: [4.5, 4.5, 6.5, 8.5], medium: [4.5, 6.5, 8.5], large: [6.5, 8.5] }, { small: 9, medium: 9, large: 13 }]].forEach(([mode, t, p]) => {
  Object.keys(t).forEach((sz) => t[sz].forEach((v, i) => POSTER.push({ rule_key: `space.${mode}.adult.${sz}.${i + 1}`, value: String(v), effective_from: '2026-11-11' })));
  Object.keys(p).forEach((sz) => POSTER.push({ rule_key: `space.${mode}.mum_with_pups.${sz}.1`, value: String(p[sz]), effective_from: '2026-11-11' }));
});

test('space rules: 3A.1/2 (9 m²) with the flap shut gets 4 small, 3 medium or 2 large, small/medium mum with pups but not large', () => {
  const space = C.spaceRules(POSTER, '2026-11-17');
  const rows = C.deriveRows('r3', 9, space).filter((r) => r.access_type === 'limited');
  const by = Object.fromEntries(rows.map((r) => [r.size_band, r.max_dogs]));
  assert.deepEqual(by, { small: '4', medium: '3', large: '2', 'small + pups': '1', 'medium + pups': '1', 'large + pups': '0' });
  const free = Object.fromEntries(C.deriveRows('r3', 3.14, space).filter((r) => r.access_type === 'free').map((r) => [r.size_band, r.max_dogs]));
  assert.equal(free.small, '2'); assert.equal(free.medium, '1'); assert.equal(free.large, '0');   // matches 4A on the Cabin List
});

test('check: a flap setting with no rows of its own uses the space rules and says so; the owner\'s own rows still win', () => {
  const space = C.spaceRules(POSTER, '2026-11-17');
  const own = [{ area_id: 'r3', access_type: 'free', size_band: '10-25kg (medium)', max_dogs: '3' }];
  const two = [{ id: 'a', size: 'medium' }, { id: 'b', size: 'medium' }];
  const r = C.check({ areaId: 'r3', access: 'limited', capacity: own, dogs: two, date: '2026-11-17', m2: 9, space });
  assert.equal(r.status, 'ok'); assert.equal(r.limit, 3);
  assert.match(r.message, /worked out from the room size \(9 m²\)/);
  const mine = C.check({ areaId: 'r3', access: 'free', capacity: [{ area_id: 'r3', access_type: 'free', size_band: '10-25kg (medium)', max_dogs: '1' }], dogs: two, date: '2026-11-17', m2: 9, space });
  assert.equal(mine.status, 'over');   // the owner's row (1) is used, not the derived 3
  assert.equal(C.spaceRules([], '2026-11-17').free, undefined);   // no poster rows: nothing is invented
});
