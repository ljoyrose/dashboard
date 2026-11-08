'use strict';
/** Next-due dates and "includes" resets, from check_type and check_log rows. */
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../records/due.js');

const T = (key, target, every, extra) => Object.assign({ id: 'cty-' + key + '-1', type_key: key, label: key, target, every_days: every, active: 'true', effective_from: '2026-01-01' }, extra);
const dog = { subject_id: 'd1' };
let n = 0;
const L = (key, date, extra) => Object.assign({ id: 'l' + (++n), check_type_id: 'cty-' + key + '-1', subject_id: 'd1', area_id: '', outcome: 'ok', happened_at: date + 'T10:00:00Z', taken_at: date + 'T10:00:00Z' }, extra);
const one = (rows, key) => rows.filter((r) => r.type_key === key)[0];
const TYPES = [T('full', 'dog', '84', { includes: 'ears|nails' }), T('ears', 'dog', '28'), T('nails', 'dog', '28'), T('bath', 'dog', '')];

test('each job keeps its own due date', () => {
  const r = D.forTarget(TYPES, [L('full', '2026-06-01'), L('ears', '2026-10-01')], dog, '2026-10-02');
  assert.equal(one(r, 'full').next_due, '2026-08-24');
  assert.equal(one(r, 'ears').next_due, '2026-10-29');
  assert.equal(one(r, 'ears').status, 'ok');
});

test('a full groom restarts the jobs it includes and says so', () => {
  const r = D.forTarget(TYPES, [L('ears', '2026-05-01'), L('full', '2026-10-01')], dog, '2026-10-02');
  assert.equal(one(r, 'ears').last_done, '2026-10-01');
  assert.equal(one(r, 'ears').reset_by, 'full');
  assert.equal(one(r, 'nails').next_due, '2026-10-29');
});

test('a smaller job never restarts the bigger one', () => {
  const r = D.forTarget(TYPES, [L('ears', '2026-10-01')], dog, '2026-10-02');
  assert.equal(one(r, 'full').status, 'never');
});

test('a later small job shows as done by itself, not reset', () => {
  const r = D.forTarget(TYPES, [L('full', '2026-09-01'), L('ears', '2026-10-01')], dog, '2026-10-02');
  assert.equal(one(r, 'ears').reset_by, '');
});

test('late, due today, never and as needed', () => {
  const r = D.forTarget(TYPES, [L('ears', '2026-09-01'), L('nails', '2026-09-04')], dog, '2026-10-02');
  assert.equal(one(r, 'ears').status, 'late');
  assert.equal(one(r, 'ears').days_late, 3);
  assert.equal(one(r, 'nails').status, 'today');
  assert.equal(one(r, 'full').status, 'never');
  assert.equal(one(r, 'bath').status, 'as_needed');
});

test('another dog\'s record does not count', () => {
  const r = D.forTarget(TYPES, [L('ears', '2026-10-01', { subject_id: 'd2' })], dog, '2026-10-02');
  assert.equal(one(r, 'ears').status, 'never');
});

test('not done does not count; a concern does, because the job happened', () => {
  const r = D.forTarget(TYPES, [L('ears', '2026-10-01', { outcome: 'not_done' }), L('nails', '2026-10-01', { outcome: 'concern' })], dog, '2026-10-02');
  assert.equal(one(r, 'ears').status, 'never');
  assert.equal(one(r, 'nails').status, 'ok');
});

test('a corrected record gives way to its correction', () => {
  const wrong = L('ears', '2026-10-01');
  const r = D.forTarget(TYPES, [wrong, L('ears', '2026-09-20', { corrects_id: wrong.id })], dog, '2026-10-02');
  assert.equal(one(r, 'ears').last_done, '2026-09-20');
});

test('a late-night save in British summer time lands on the London date', () => {
  const r = D.forTarget(TYPES, [L('ears', '', { happened_at: '2026-07-01T23:30:00Z', taken_at: '' })], dog, '2026-07-02');
  assert.equal(one(r, 'ears').last_done, '2026-07-02');
});

test('dates cross the clock change without slipping', () => {
  const r = D.forTarget([T('ears', 'dog', '28')], [L('ears', '2026-10-10')], dog, '2026-10-12');
  assert.equal(one(r, 'ears').next_due, '2026-11-07');
});

test('a changed frequency applies from its date; the old row still finds its records', () => {
  const types = [T('ears', 'dog', '28'), T('ears', 'dog', '14', { id: 'cty-ears-2', effective_from: '2026-09-01' })];
  const r = D.forTarget(types, [L('ears', '2026-08-30')], dog, '2026-09-02');
  assert.equal(one(r, 'ears').every_days, 14);
  assert.equal(one(r, 'ears').next_due, '2026-09-13');
});

test('a switched-off job disappears; a future change does not apply yet', () => {
  const types = [T('ears', 'dog', '28'), T('ears', 'dog', '28', { id: 'cty-ears-2', active: 'false', effective_from: '2026-11-01' })];
  assert.equal(D.forTarget(types, [], dog, '2026-10-02').length, 1);
  assert.equal(D.forTarget(types, [], dog, '2026-11-02').length, 0);
});

test('dog, room and whole-site jobs stay apart', () => {
  const types = [T('ears', 'dog', '28'), T('clean', 'area', '1'), T('bowls', 'none', '1'), T('feed', 'either', '1')];
  const keys = (t) => D.forTarget(types, [], t, '2026-10-02').map((r) => r.type_key).sort();
  assert.deepEqual(keys(dog), ['ears', 'feed']);
  assert.deepEqual(keys({ area_id: 'a1' }), ['clean', 'feed']);
  assert.deepEqual(keys({}), ['bowls']);
});

test('until the columns exist every job is as needed, and bad numbers do not guess', () => {
  const r = D.forTarget([{ id: 'x', type_key: 'k', label: 'k', target: 'dog', active: 'true', effective_from: '2026-01-01' }], [], dog, '2026-10-02');
  assert.equal(r[0].status, 'as_needed');
  ['', '0', '-3', '2.5', 'weekly', null].forEach((v) => assert.equal(D.everyDays(v), null));
  assert.equal(D.everyDays(' 12 '), 12);
});
