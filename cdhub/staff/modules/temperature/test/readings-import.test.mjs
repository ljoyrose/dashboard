// node --test cdhub/staff/modules/temperature/test/
// the owner, 22 Nov 2026: paper or spreadsheet readings into BLD-area_reading. Every row checked and shown; saved only on the
// press; a slot already filled is skipped; a past or unusual row sends the script's "save anyway". Pretend rooms only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const I = require('../readings-import.js');
const londonIso = (d, hh) => d + 'T' + hh + ':00:00+00:00';
const base = (readings) => ({
  today: '2026-11-22', nowHour: 23, londonIso,
  areas: [{ id: 'a1', code: '3A.1/2', label: '3A.1/2' }, { id: 'a2', code: 'H5/6', label: 'H5/6' }, { id: 'a3', code: 'Pretend', label: 'Pretend' }],
  thermos: [{ id: 't1', name: '3A.1/2', area_id: 'a1' }, { id: 't5', name: 'H5', area_id: 'a2' }, { id: 't6', name: 'H6', area_id: 'a2' }],
  readings: readings || []
});
const H = 'date,room,thermometer,slot,min,max,room_empty,note\n';

test('ready rows: room by code, thermometer optional for a one-thermometer room, slot to the round period_start', () => {
  const rows = I.parse(base(), H + '2026-11-22,3A.1/2,,day,14.5,19.0,,\n22/11/2026,h5/6,H6,overnight,"18,5",21,,paper\n');
  assert.deepEqual(rows.map((x) => x.ok), [true, true]);
  assert.deepEqual(I.fields(rows[0]), { area_id: 'a1', thermometer_id: 't1', period_start: '2026-11-22T12:00:00+00:00', min_c: '14.5', max_c: '19.0', read_method: 'typed' });
  assert.deepEqual(I.fields(rows[1]), { area_id: 'a2', thermometer_id: 't6', period_start: '2026-11-22T00:00:00+00:00', min_c: '18.5', max_c: '21.0', read_method: 'typed', mitigation_note: 'paper' });
  assert.equal(I.requestId(rows[0]), 'rimp-a1-t1-2026-11-22-12');
});

test('each bad row says why; nothing here saves', () => {
  const rows = I.parse(base(), H + [
    'nope,3A.1/2,,day,1,2,,',            // date
    '2026-11-21,Nowhere,,day,1,2,,',      // room
    '2026-11-21,H5/6,,day,1,2,,',         // two thermometers: say which
    '2026-11-21,3A.1/2,H5,day,1,2,,',     // a thermometer in another room
    '2026-11-21,3A.1/2,,lunch,1,2,,',     // slot
    '2026-11-23,3A.1/2,,day,1,2,,',       // future
    '2026-11-21,3A.1/2,,day,22,18,,',     // min above max
    '2026-11-21,3A.1/2,,day,,18,,',       // one missing
    '2026-11-21,3A.1/2,,day,abc,18,,'     // not a number
  ].join('\n'));
  assert.ok(rows.every((x) => !x.ok));
  assert.deepEqual(rows.map((x) => x.why), [
    'date not understood (use 2026-11-22 or 22/11/2026)', 'room not found: use its code as on the round',
    'this room has 2 thermometers: say which', 'that thermometer is in another room', 'slot not understood (overnight or day)',
    'a future slot', 'lowest is higher than highest', 'both lowest and highest are needed', 'a temperature not understood (e.g. 18.5)'
  ]);
});

test('today\'s day slot before noon is in the future', () => {
  const rows = I.parse(Object.assign(base(), { nowHour: 9 }), H + '2026-11-22,3A.1/2,,day,1,2,,\n2026-11-22,3A.1/2,,overnight,1,2,,\n');
  assert.deepEqual(rows.map((x) => x.ok), [false, true]);
});

test('a slot already filled (saved rows, as read back "2026-11-20 00:00") is skipped, and a repeat in the file too', () => {
  const rows = I.parse(base([{ area_id: 'a1', thermometer_id: '', period_start: '2026-11-20 00:00', min_c: '10', max_c: '15' }]),
    H + '2026-11-20,3A.1/2,,overnight,10,15,,\n2026-11-20,3A.1/2,,day,10,15,,\n2026-11-20,3A.1/2,3A.1/2,day,11,16,,\n');
  assert.deepEqual(rows.map((x) => x.ok), [false, true, false]);
  assert.match(rows[0].why, /already recorded/);   // an older row with no thermometer named: the room's only one
  assert.match(rows[2].why, /repeated in this file/);
});

test('a row a week or more old, or an unusual temperature, sends confirm_unusual yes; room empty may have no numbers', () => {
  const rows = I.parse(base(), H + '2026-10-23,3A.1/2,,day,12,18,,\n2026-11-21,3A.1/2,,day,12,65,,\n2026-11-21,Pretend,,overnight,,,yes,\n2026-11-21,3A.1/2,,overnight,12,18,,\n');
  assert.deepEqual(rows.map((x) => x.ok), [true, true, true, true]);
  assert.equal(I.fields(rows[0]).confirm_unusual, 'yes');
  assert.equal(rows[0].past, true);
  assert.match(rows[1].warn, /unusual/);
  assert.equal(I.fields(rows[1]).confirm_unusual, 'yes');
  assert.deepEqual(I.fields(rows[2]), { area_id: 'a3', period_start: '2026-11-21T00:00:00+00:00', read_method: 'typed', room_empty: 'yes' });
  assert.equal(I.fields(rows[3]).confirm_unusual, undefined);
});

test('the starter file: the heading row and one row per thermometer (a room with none gets one blank)', () => {
  const t = I.template(base());
  assert.equal(t, 'date,room,thermometer,slot,min,max,room_empty,note\r\n2026-11-21,3A.1/2,3A.1/2,overnight,,,,\r\n2026-11-21,H5/6,H5,overnight,,,,\r\n2026-11-21,H5/6,H6,overnight,,,,\r\n2026-11-21,Pretend,,overnight,,,,\r\n');
  const back = I.parse(base(), t);   // filled in, the starter file reads back column for column
  assert.equal(back.length, 4);
  assert.match(back[0].why, /both lowest and highest/);
});
