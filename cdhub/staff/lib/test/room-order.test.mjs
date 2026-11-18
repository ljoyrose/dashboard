// Room order on Where and the other staff lists (Lisa 12 Nov 2026): group_sort from the area rows, then the code in
// natural order. No list in code. Invented rows, in a muddled file order on purpose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
global.BLDNeeds = req('../needs.js');
const O = req('../occupancy.js');

test('rooms sort by group_sort, then code naturally; a room with no group_sort goes last', () => {
  const area = [
    { id: 'a1', code: 'Q.9/10', group_sort: '3' }, { id: 'a2', code: 'P1', group_sort: '1' },
    { id: 'a3', code: 'Q.1/2/3', group_sort: '3' }, { id: 'a4', code: 'Field', group_sort: '' },
    { id: 'a5', code: 'R2', group_sort: '2' }, { id: 'a6', code: 'Q.4/5', group_sort: '3' }, { id: 'a7', code: 'P10', group_sort: '1' }
  ];
  const got = O.dailyList({ area }, '2026-11-12').areas.map((a) => a.label);
  assert.deepEqual(got, ['P1', 'P10', 'R2', 'Q.1/2/3', 'Q.4/5', 'Q.9/10', 'Field']);
});
