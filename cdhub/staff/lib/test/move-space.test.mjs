import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('../capacity.js');

/* Cabins with space, most free first — the over-limit and dog-chip move picker. */
test('freePlaces: list cabins with space, most free first, format like "3A.2: 4 small free"', () => {
  const cap = [
    { area_id: 'area-a', access_type: 'free', size_band: 'small', max_dogs: '3', from_date: '2026-01-01' },
    { area_id: 'area-b', access_type: 'free', size_band: 'small', max_dogs: '4', from_date: '2026-01-01' },
    { area_id: 'area-c', access_type: 'free', size_band: 'small', max_dogs: '1', from_date: '2026-01-01' },
  ];
  const add = { id: 'd-new', size: 'small', damId: '' };
  function freeOf(areaId, occupantCount) {
    const dogs = Array.from({ length: occupantCount }, (_, i) => ({ id: 'd' + i, size: 'small', damId: '' }));
    return C.freePlaces({ areaId, access: 'free', capacity: cap, dogs, add, date: '2026-11-12' });
  }
  const rooms = [
    { id: 'area-a', code: '3A.1', ...freeOf('area-a', 1) },
    { id: 'area-b', code: '3A.2', ...freeOf('area-b', 0) },
    { id: 'area-c', code: '3C.3', ...freeOf('area-c', 1) },
  ].filter((x) => x.ok && x.free >= 1)
    .sort((a, b) => b.free - a.free || String(a.code).localeCompare(String(b.code), 'en', { numeric: true }));

  assert.equal(rooms.length, 2);
  assert.equal(rooms[0].code, '3A.2');
  assert.equal(rooms[0].free, 4);
  assert.equal(rooms[1].code, '3A.1');
  assert.equal(rooms[1].free, 2);
  const labels = rooms.map((x) => x.code + ': ' + x.free + ' ' + x.size + ' free');
  assert.deepEqual(labels, ['3A.2: 4 small free', '3A.1: 2 small free']);
});
