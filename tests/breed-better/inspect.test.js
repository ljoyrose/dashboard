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
  const dogs = I.build(res, '2026-11-13');
  assert.deepStrictEqual(dogs.map((d) => d.name), ['Test Dog One', 'Test Dog Two']);
  assert.deepStrictEqual(dogs[0].checks, []);
  assert.deepStrictEqual(dogs[1].facts, ['female', 'DOB 2 Mar 2022']);
  const elbows = dogs[1].checks.find((c) => c.label === 'Elbows');
  assert.strictEqual(elbows.sub, '0 · 1 Jun 2025');
  assert.strictEqual(elbows.word, '');
  assert.deepStrictEqual(elbows.open[0], [{ label: 'Test', value: 'elbows' }, { label: 'Grade', value: '0' }, { label: 'Tested on', value: '1 Jun 2025' }]);
  assert.deepStrictEqual(dogs[1].litters, { n: 1, limit: null, last: '2 Mar 2026', recent: 1 });
});

test('must-pass words show only when the summary is sent and the level shows them; points never come through', () => {
  const L = require('../../cdhub/staff/lib/viewer-levels.js');
  const res = {
    subject: { fields: ['id', 'name'], rows: [{ id: 'a', name: 'Test Dog A' }] },
    must_pass: { fields: ['subject_id', 'label', 'outcome', 'points'], rows: [{ subject_id: 'a', label: 'Hips X-ray', outcome: 'pass', answer: 'Good', date: '2025-01-02', points: '15' }] }
  };
  const inspector = L.showsFor(null, 'inspector', '2026-11-13');
  const b = I.build(res, '2026-11-13', Object.assign({ grades: true }, inspector));
  assert.strictEqual(b[0].checks[0].word, 'pass');
  assert.strictEqual(b[0].word, 'pass');
  assert.doesNotMatch(JSON.stringify(b), /15|points/);
  const vet = L.showsFor(null, 'vet', '2026-11-13');
  const c = I.build(res, '2026-11-13', Object.assign({ grades: true }, vet));
  assert.strictEqual(c[0].checks[0].word, '');
  assert.strictEqual(c[0].checks[0].sub, 'Good · 2 Jan 2025');
});

test('litters read as x of the breeder\'s own limit row, with the count in the last 12 months', () => {
  const res = {
    subject: { fields: ['id', 'name'], rows: [{ id: 'a', name: 'Test Dog A' }] },
    litter: { fields: ['id', 'dam_subject_id', 'dob'], rows: [{ id: 'l1', dam_subject_id: 'a', dob: '2026-03-02' }, { id: 'l2', dam_subject_id: 'a', dob: '2025-12-01' }, { id: 'l3', dam_subject_id: 'a', dob: '2023-01-01' }] },
    breeding_rule: { fields: ['rule_key', 'value', 'effective_from'], rows: [{ rule_key: 'max_litters_per_dam', value: '4', effective_from: '2020-01-01' }, { rule_key: 'max_litters_per_dam', value: '9', effective_from: '2030-01-01' }] }
  };
  assert.deepStrictEqual(I.build(res, '2026-11-13')[0].litters, { n: 3, limit: 4, last: '2 Mar 2026', recent: 2 });
});
