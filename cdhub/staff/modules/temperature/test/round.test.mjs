// The round is the thermometer rows, never a coded list (overseer, 11 Nov 2026: one thermometer per place,
// corridors are their own place, fields have none).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createRequire } from 'node:module';
globalThis.window = { BLDThermometer: createRequire(import.meta.url)('../../../lib/thermometer.js') };
globalThis.document = { currentScript: null };
new Function(readFileSync(new URL('../module.js', import.meta.url), 'utf8'))();
const { roundAreas } = globalThis.window.BLDTemperature;

const areas = [
  { id: 'a1', label: '3A.1/2' }, { id: 'a2', label: '3A.3/4/5' }, { id: 'ac', label: '3A corridor' }, { id: 'f1', label: 'Field 1' },
  { id: 'old', label: '3A.2/3 (retired)', retired: true }
];

test('no thermometer rows yet: every room in use is listed, as before; retired rooms are not', () => {
  assert.deepEqual(roundAreas(areas, [], '2026-11-12').map((x) => x.id), ['a1', 'a2', 'ac', 'f1']);
});

test('Lisa 11 Nov: the old thermometers are due up to and including 11 Nov, the new ones from 12 Nov', () => {
  const rows = [
    { id: 't-old', name: '3A.2/3', area_id: 'old', active: 'true', valid_from: '2025-01-01', valid_to: '2026-11-11' },
    { id: 't-new', name: '3A.1/2', area_id: 'a1', active: 'true', valid_from: '2026-11-12', valid_to: '' },
    { id: 't-oops', name: 'typo', area_id: 'a2', active: 'false', valid_from: '', valid_to: '' }
  ];
  assert.deepEqual(roundAreas(areas, rows, '2026-11-11').map((x) => x.id), ['old']);
  assert.deepEqual(roundAreas(areas, rows, '2026-11-12').map((x) => x.id), ['a1']);
});

test('only places with an active thermometer are on the round, in room order, one each', () => {
  const r = roundAreas(areas, [
    { id: 't3', name: '3A corridor', area_id: 'ac', active: 'true' },
    { id: 't1', name: 'T1', area_id: 'a1', active: 'true' },
    { id: 't1b', name: 'T1 spare', area_id: 'a1', active: 'true' },
    { id: 't2', name: '3A.3/4/5', area_id: 'a2', active: 'false' }
  ], '2026-11-12');
  assert.deepEqual(r.map((x) => x.id), ['a1', 'ac']);
  assert.equal(r[0].label, 'T1 · 3A.1/2');
  assert.equal(r[0].thermometerId, 't1');
  assert.equal(r[1].label, '3A corridor');
});
