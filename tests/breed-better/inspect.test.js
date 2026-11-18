'use strict';
const test = require('node:test');
const assert = require('node:assert');
const I = require('../../cdhub/staff/inspect/inspect.js');

test('the link carries the script id and code after the #; anything else is refused', () => {
  assert.deepStrictEqual(I.parseHash('#s=FAKE-TEST-ID-123&c=FAKECODE23456789'), { script: 'https://script.google.com/macros/s/FAKE-TEST-ID-123/exec', code: 'FAKECODE23456789' });
  assert.strictEqual(I.parseHash('#s=FAKE-TEST-ID-123&c=FAKECODE'), null);
  assert.strictEqual(I.parseHash('#s=FAKE-TEST-ID-123&c=fakecode23456789'), null);
  assert.strictEqual(I.parseHash('#c=FAKECODE'), null);
  assert.strictEqual(I.parseHash('#s=bad/id&c=X'), null);
  assert.strictEqual(I.parseHash(''), null);
});

test('records group under each dog, dogs A to Z, newest first, dates read like 2 Mar 2026, ids hidden', () => {
  const res = {
    subject: { fields: ['id', 'name', 'sex', 'dob'], rows: [{ id: 'b', name: 'Test Dog Two', sex: 'female', dob: '2022-03-02' }, { id: 'a', name: 'Test Dog One', sex: 'male', dob: '' }] },
    health_screen: { fields: ['id', 'subject_id', 'test', 'grade', 'tested_on'], rows: [
      { id: 'h1', subject_id: 'b', test: 'hips', grade: '8', tested_on: '2024-01-05' },
      { id: 'h2', subject_id: 'b', test: 'elbows', grade: '0', tested_on: '2025-06-01' }] },
    litter: { fields: ['id', 'dam_subject_id', 'dob'], rows: [{ id: 'l1', dam_subject_id: 'b', dob: '2026-03-02' }] }
  };
  const dogs = I.build(res);
  assert.deepStrictEqual(dogs.map((d) => d.name), ['Test Dog One', 'Test Dog Two']);
  assert.deepStrictEqual(dogs[0].lists, []);
  assert.deepStrictEqual(dogs[1].facts, ['Sex female', 'DOB 2 Mar 2022']);
  const hs = dogs[1].lists.find((l) => l.title === 'Health tests');
  assert.deepStrictEqual(hs.rows[0], [{ label: 'Test', value: 'elbows' }, { label: 'Grade', value: '0' }, { label: 'Tested on', value: '1 Jun 2025' }]);
  assert.deepStrictEqual(dogs[1].lists.find((l) => l.title === 'Litters').rows[0], [{ label: 'DOB', value: '2 Mar 2026' }]);
});

test('demo 3b: temperature readings group by room, rooms in number order, newest first, London day and time', () => {
  const res = { area_reading: { fields: ['id', 'area_id', 'room', 'period_start', 'min_c', 'max_c', 'mitigation_note'], rows: [
    { id: 'r1', area_id: 'a10', room: 'T10', period_start: '2026-03-02T07:00:00Z', min_c: '15.0', max_c: '19.0', mitigation_note: '' },
    { id: 'r2', area_id: 'a2', room: 'T2', period_start: '2026-07-01T06:00:00Z', min_c: '18.0', max_c: '24.5', mitigation_note: 'Fan on' },
    { id: 'r3', area_id: 'a2', room: 'T2', period_start: '2026-07-01T15:00:00Z', min_c: '19.0', max_c: '23.0', mitigation_note: '' }
  ] } };
  const rooms = I.buildRooms(res);
  assert.deepStrictEqual(rooms.map((r) => r.name), ['T2', 'T10']);
  assert.deepStrictEqual(rooms[0].lists[0].title, 'Temperatures');
  assert.deepStrictEqual(rooms[0].lists[0].rows[0], [{ label: 'For', value: '1 Jul 2026 16:00' }, { label: 'Min °C', value: '19.0' }, { label: 'Max °C', value: '23.0' }, { label: 'Action', value: '' }]);
  assert.deepStrictEqual(rooms[0].lists[0].rows[1][3], { label: 'Action', value: 'Fan on' });
  assert.deepStrictEqual(rooms[1].lists[0].rows[0][0], { label: 'For', value: '2 Mar 2026 07:00' });   // GMT in March
  assert.deepStrictEqual(I.buildRooms({}), []);
  assert.strictEqual(I.when('2025-06-01'), '1 Jun 2025');   // a date with no time stays a date
});
