'use strict';
// Flap access rows: a voided row (to_date before from_date) never counts; with a date, an ended or future row does not either (OV12 18 Nov 2026, 3A.1/2).
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../cdhub/staff/lib/capacity.js');

const rows = [
  { area_id: 'a1', access_type: 'free', from_date: '2026-11-11', to_date: '' },
  { area_id: 'a1', access_type: 'limited', from_date: '2026-11-12', to_date: '2026-11-11' }   // voided
];

test('a voided row never wins, with or without a date', () => {
  assert.equal(C.accessOf(rows, 'a1'), 'free');
  assert.equal(C.accessOf(rows, 'a1', '2026-11-14'), 'free');
  assert.equal(C.accessRowCounts(rows[1], '2026-11-12'), false);
});

test('with a date, an ended row and a not-yet-started row do not count', () => {
  const r = rows.concat([
    { area_id: 'a1', access_type: 'limited', from_date: '2026-11-13', to_date: '2026-11-15' },
    { area_id: 'a1', access_type: 'limited', from_date: '2026-12-01', to_date: '' }
  ]);
  assert.equal(C.accessOf(r, 'a1', '2026-11-14'), 'limited');
  assert.equal(C.accessOf(r, 'a1', '2026-11-18'), 'free');
});

test('the last counting row still wins, and an undated row (just saved) counts', () => {
  const r = rows.concat([{ area_id: 'a1', access_type: 'limited' }]);
  assert.equal(C.accessOf(r, 'a1', '2026-11-18'), 'limited');
  assert.equal(C.accessOf(r, 'a2'), '');
});
