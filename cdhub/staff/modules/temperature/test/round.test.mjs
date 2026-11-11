// The round is the thermometer rows, never a coded list (overseer, 11 Nov 2026: one thermometer per place,
// corridors are their own place, fields have none).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.window = {};
globalThis.document = { currentScript: null };
new Function(readFileSync(new URL('../module.js', import.meta.url), 'utf8'))();
const { roundAreas } = globalThis.window.BLDTemperature;

const areas = [
  { id: 'a1', label: '3A.1/2' }, { id: 'a2', label: '3A.3/4/5' }, { id: 'ac', label: '3A corridor' }, { id: 'f1', label: 'Field 1' }
];

test('no thermometer rows yet: every room is listed, as before', () => {
  assert.deepEqual(roundAreas(areas, []), areas);
});

test('only places with an active thermometer are on the round, in room order, one each', () => {
  const r = roundAreas(areas, [
    { id: 't3', name: '3A corridor', area_id: 'ac', active: 'true' },
    { id: 't1', name: 'T1', area_id: 'a1', active: 'true' },
    { id: 't1b', name: 'T1 spare', area_id: 'a1', active: 'true' },
    { id: 't2', name: '3A.3/4/5', area_id: 'a2', active: 'false' }
  ]);
  assert.deepEqual(r.map((x) => x.id), ['a1', 'ac']);
  assert.equal(r[0].label, 'T1 · 3A.1/2');
  assert.equal(r[0].thermometerId, 't1');
  assert.equal(r[1].label, '3A corridor');
});
