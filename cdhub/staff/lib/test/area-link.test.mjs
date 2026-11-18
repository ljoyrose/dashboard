// BLDAreaLink (Lisa 12 Nov 2026: old rooms link to the new rooms so temperatures show continuously). Invented rows only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const L = createRequire(import.meta.url)('../area-link.js');
const LINKS = [
  { from_area_id: 'old-a', to_area_id: 'new-1', from_date: '2025-01-01', to_date: '2026-11-02' },
  { from_area_id: 'old-split', to_area_id: 'new-1', from_date: '2025-01-01', to_date: '2026-11-02' },
  { from_area_id: 'old-split', to_area_id: 'new-2', from_date: '2025-01-01', to_date: '2026-11-02' },
  { from_area_id: 'x', to_area_id: 'x' }   // a room never links to itself
];

test('a reading inside the dates also counts for the new room; the original is unchanged', () => {
  const r = { id: 'r1', area_id: 'old-a', thermometer_id: 'th-9', period_start: '2026-11-02T12:00:00+00:00', min_c: '12.0', max_c: '18.0' };
  const out = L.expand([r], LINKS);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], r);
  assert.deepEqual(out[1], Object.assign({}, r, { area_id: 'new-1', thermometer_id: '', linked_from: 'old-a' }));
});

test('a split room counts for both new rooms; outside the dates it counts for neither', () => {
  const inside = { area_id: 'old-split', taken_at: '2025-06-01T08:00:00Z' };
  const after = { area_id: 'old-split', period_start: '2026-11-03T00:00:00+00:00' };
  assert.deepEqual(L.expand([inside], LINKS).map((r) => r.area_id), ['old-split', 'new-1', 'new-2']);
  assert.deepEqual(L.expand([after], LINKS).map((r) => r.area_id), ['old-split']);
});

test('linksInto and sourcesOf; no links = readings unchanged', () => {
  assert.deepEqual(L.linksInto(LINKS, 'new-1', '2026-01-01'), ['old-a', 'old-split']);
  assert.deepEqual(L.linksInto(LINKS, 'new-1', '2026-11-03'), []);
  assert.deepEqual(L.sourcesOf(LINKS, 'new-2'), ['old-split']);
  const rows = [{ area_id: 'old-a', period_start: '2026-01-01' }];
  assert.deepEqual(L.expand(rows, []), rows);
});

test('two readings in one slot: widest, never an average', () => {
  assert.deepEqual(L.widest({ min: '11.0', max: '19.5' }, { min: '9.5', max: '18.0' }), { min: 9.5, max: 19.5 });
  assert.deepEqual(L.widest({ min: '', max: '20.0' }, null), { min: null, max: 20 });
});
