// Year report: how a reading was taken is saved, never shown; outside-limit rows are orange, never red
// (Lisa, 11 Nov 2026). Invented rows only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.window = {};
globalThis.document = { currentScript: null };
const src = readFileSync(new URL('../module.js', import.meta.url), 'utf8');
new Function(src)();
const { yearRows } = globalThis.window.BLDTemperature;

test('no row says how it was read', () => {
  const rows = yearRows([
    { area_id: 'a1', taken_at: '2026-01-05T09:00:00Z', min_c: '12.0', max_c: '15.0', read_method: 'camera', camera_value_changed: 'true' },
    { area_id: 'a1', taken_at: '2026-01-05T16:00:00Z', min_c: '12.0', max_c: '15.0', read_method: 'typed' },
    { area_id: 'a1', taken_at: '2026-01-06T09:00:00Z', min_c: '12.0', max_c: '15.0', read_method: 'photo' }
  ], [], [], 'a1', '2026');
  assert.equal(rows.length, 3);
  for (const r of rows) assert.doesNotMatch(JSON.stringify(r), /camera|typed|photo|corrected/i);
});

test('the table has no How column, and outside-limit rows are not red', () => {
  assert.match(src, /\['Date', 'Round', 'Min', 'Max', 'Spot', 'What was done'\]/);
  assert.doesNotMatch(src, /'How'/);
  assert.doesNotMatch(src, /\.tg-br td\{color:var\(--bad\)/);
});
