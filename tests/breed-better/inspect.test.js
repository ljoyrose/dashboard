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

test('demo 3b: a dog\'s daily checks sit under the dog; room, litter and whole-site records get their own cards; ids hidden', () => {
  const res = {
    subject: { fields: ['id', 'name'], rows: [{ id: 'a', name: 'Test Dog One' }] },
    check_log: { fields: ['subject_id', 'litter', 'room', 'job', 'done_on', 'time', 'outcome'], rows: [
      { subject_id: '', room: '', litter: '', job: 'Whole-site clean', done_on: '2026-11-18', time: '17:00', outcome: 'ok' },
      { subject_id: '', room: '', litter: 'Litter of Test Dog One, born 2026-09-01', job: 'Puppy check', done_on: '2026-11-18', time: '10:00', outcome: 'ok' },
      { subject_id: '', room: '3A', litter: '', job: 'Bowls and water', done_on: '2026-11-18', time: '09:00', outcome: 'ok' },
      { subject_id: 'a', room: '', litter: '', job: 'Daily health check', done_on: '2026-11-18', time: '08:00', outcome: 'ok' }] },
    area_reading: { fields: ['room', 'done_on', 'min_c', 'max_c'], rows: [{ room: '3A', done_on: '2026-11-18', min_c: '18.0', max_c: '21.0' }] }
  };
  const dogs = I.build(res);
  assert.deepStrictEqual(dogs[0].lists.map((l) => l.title), ['Daily checks']);
  assert.strictEqual(dogs[0].lists[0].rows.length, 1);
  const places = I.buildSite(res);
  assert.deepStrictEqual(places.map((p) => p.place), ['Room 3A', 'Litter of Test Dog One, born 2026-09-01', 'Whole site']);
  assert.deepStrictEqual(places[0].lists.map((l) => l.title), ['Temperatures', 'Daily jobs']);
  assert.deepStrictEqual(places[0].lists[0].rows[0].map((c) => c.label + ' ' + c.value), ['Date 18 Nov 2026', 'Min °C 18.0', 'Max °C 21.0']);
});
