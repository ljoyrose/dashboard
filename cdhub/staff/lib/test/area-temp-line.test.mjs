// BLDAreaTempLine: today's temperature line for a room card (DOGCARD, 12 Nov 2026). Invented rows only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const req = createRequire(import.meta.url);
const N = req('../needs.js');
globalThis.self = { BLDNeeds: N };
const { lineFor, limitFor } = req('../area-temp-line.js');

const BANDS = [{ id: 'tb-1', min_temp: '10', max_temp: '26' }];
const T = [{ id: 'th-h5', name: 'H5', area_id: 'h' }, { id: 'th-h6', name: 'H6', area_id: 'h' }, { id: 'th-s', name: 'S1', area_id: 's' }];
const at = (h) => '2026-11-12T' + (h === 'am' ? '00' : '12') + ':00:00+00:00';

test('one thermometer: no label, "AM 12.0–15.0 ✓ · PM due" before noon', () => {
  const r = lineFor('s', [{ area_id: 's', period_start: at('am'), min_c: '12.0', max_c: '15.0' }], T, [], BANDS, '2026-11-12', { hour: 9 });
  assert.deepEqual(r.lines.map((l) => [l.label, l.text, l.ok]), [['', 'AM 12.0–15.0 ✓ · PM due', true]]);
  assert.deepEqual(r.limit, { lo: 10, hi: 26, source: 'tb-1' });
});

test('two thermometers: a line each, by name; outside uses the round\'s word; AM missed after noon', () => {
  const rd = [{ area_id: 'h', thermometer_id: 'th-h6', period_start: at('am'), min_c: '8.5', max_c: '15.0' }];
  const r = lineFor('h', rd, T, [], BANDS, '2026-11-12', { hour: 14 });
  assert.deepEqual(r.lines.map((l) => [l.label, l.text, l.ok]), [
    ['H5', 'AM missed · PM due', false], ['H6', 'AM Outside 8.5–15.0 · PM due', false]]);
  assert.equal(r.lines[1].am.state, 'out');
});

test('room empty; a room with no thermometer has no line; before thermometer rows exist the room is one line', () => {
  const e = lineFor('s', [{ area_id: 's', period_start: at('pm'), room_empty: 'yes' }], T, [], BANDS, '2026-11-12', { hour: 15 });
  assert.equal(e.lines[0].pm.text, 'PM empty');
  assert.deepEqual(lineFor('field', [], T, [], BANDS, '2026-11-12', { hour: 9 }).lines, []);
  assert.equal(lineFor('x', [], [], [], BANDS, '2026-11-12', { hour: 9 }).lines.length, 1);
});

test('a linked old room\'s reading counts; the room\'s own reading wins', () => {
  const links = [{ from_area_id: 'old', to_area_id: 's', from_date: '2026-01-01', to_date: '2026-12-31' }];
  const rd = [{ area_id: 'old', period_start: at('am'), min_c: '11.0', max_c: '14.0' }];
  assert.equal(lineFor('s', rd, T, links, BANDS, '2026-11-12', { hour: 9 }).lines[0].am.text, 'AM 11.0–14.0 ✓');
  rd.push({ area_id: 's', period_start: at('am'), min_c: '12.0', max_c: '13.0' });
  assert.equal(lineFor('s', rd, T, links, BANDS, '2026-11-12', { hour: 9 }).lines[0].am.text, 'AM 12.0–13.0 ✓');
});

test('limit: by the youngest dog when rows have ages; unknown age says "by age"; the room\'s own rows first', () => {
  const aged = [{ id: 'p', age_from_days: '0', age_to_days: '28', min_temp: '26', max_temp: '28' }, { id: 'a', age_from_days: '29', min_temp: '10', max_temp: '26' }];
  assert.deepEqual(limitFor('s', aged, 10), { lo: 26, hi: 28, source: 'p' });
  assert.deepEqual(limitFor('s', aged, 400), { lo: 10, hi: 26, source: 'a' });
  assert.deepEqual(limitFor('s', aged), { lo: null, hi: null, source: 'by age' });
  assert.deepEqual(limitFor('s', BANDS.concat([{ id: 'own', area_id: 's', min_c: '15', max_c: '20' }])), { lo: 15, hi: 20, source: 'own' });
  assert.equal(limitFor('s', []), null);
});
