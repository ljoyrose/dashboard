// Places where dogs are not placed (overseer 12 Nov 2026): a dated room.no_dogs need row, never a word in code. Invented rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
global.BLDNeeds = req('../needs.js');
const O = req('../occupancy.js');

const T = {
  area: [{ id: 'area-r1', code: 'R1' }, { id: 'area-c1', code: 'C1' }, { id: 'area-c2', code: 'C2' }],
  requirement: [
    { need_type: 'room.no_dogs', target_table: 'area', target_id: 'area-c1', from_date: '2026-11-03', to_date: '' },
    { need_type: 'room.no_dogs', target_table: 'area', target_id: 'area-c2', from_date: '2026-01-01', to_date: '2026-06-30' }
  ]
};
test('room.no_dogs: a covered place still lists (for temperatures) but is marked dogs:false; no row = dogs can go there', () => {
  const by = Object.fromEntries(O.dailyList(T, '2026-11-12').areas.map((a) => [a.id, a.dogs]));
  assert.deepEqual(by, { 'area-r1': true, 'area-c1': false, 'area-c2': true });
});
test('room.no_dogs is dated: before its from_date, and after its to_date, dogs can be placed', () => {
  assert.equal(O.takesDogs(T.area[1], '2026-11-02', T.requirement), true);
  assert.equal(O.takesDogs(T.area[2], '2026-03-01', T.requirement), false);
  assert.equal(O.takesDogs(T.area[2], '2026-07-01', T.requirement), true);
});
test('room.no_overnight: dogs can still be placed, but overnight cabins leave it out', () => {
  const req = [
    { need_type: 'room.no_overnight', target_table: 'area', target_id: 'area-r1', from_date: '2026-11-12', to_date: '' },
    { need_type: 'room.no_dogs', target_table: 'area', target_id: 'area-c1', from_date: '2026-11-03', to_date: '' }
  ];
  assert.equal(O.takesDogs(T.area[0], '2026-11-12', req), true);
  assert.equal(O.takesOvernight(T.area[0], '2026-11-12', req), false);
  assert.equal(O.takesOvernight(T.area[0], '2026-11-11', req), true);
  assert.equal(O.takesDogs(T.area[1], '2026-11-12', req), false);
  assert.equal(O.takesOvernight(T.area[1], '2026-11-12', req), false);
});
