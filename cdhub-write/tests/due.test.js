'use strict';
/** Next-due dates and "includes" resets, from check_type and check_log rows. */
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../records/due.js');

test('a room job saved per dog shows done for the room, and for each dog only when counting every dog', () => {
  const types = [{ id: 'c1', type_key: 'run', label: 'run', target: 'area', every_days: 1, site_scope: 'per_dog', active: 'true', effective_from: '2026-01-01' }];
  const logs = [{ id: 'l1', check_type_id: 'c1', area_id: 'r1', subject_id: 'd1', outcome: 'ok', taken_at: '2026-03-02T09:00:00Z' }];
  const day = '2026-03-02';
  assert.equal(D.forTarget(types, logs, { area_id: 'r1' }, day)[0].status, 'ok');
  assert.equal(D.forTarget(types, logs, { subject_id: 'd1' }, day).length, 0);
  assert.equal(D.forTarget(types, logs, { subject_id: 'd1', everyDog: true }, day)[0].status, 'ok');
  assert.equal(D.forTarget(types, logs, { subject_id: 'd2', everyDog: true }, day)[0].status, 'never');
});

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

test('a litter job belongs to one litter only, and never shows for a dog, room or the site', () => {
  const types = [T('socialise', 'litter', '1'), T('nails', 'dog', '28')];
  const logs = [L('socialise', '2026-03-02', { subject_id: '', litter_id: 'lit1' })];
  assert.equal(one(D.forTarget(types, logs, { litter_id: 'lit1' }, '2026-03-02'), 'socialise').status, 'ok');
  assert.equal(one(D.forTarget(types, logs, { litter_id: 'lit2' }, '2026-03-02'), 'socialise').status, 'never');
  assert.equal(D.forTarget(types, logs, { litter_id: 'lit1' }, '2026-03-02').length, 1);
  assert.equal(D.forTarget(types, logs, { subject_id: 'd1' }, '2026-03-02').filter((j) => j.type_key === 'socialise').length, 0);
  assert.equal(D.forTarget(types, logs, { area_id: 'r1' }, '2026-03-02').length, 0);
  assert.equal(D.forTarget(types, logs, {}, '2026-03-02').length, 0);
});

test('a whole-site job that includes a room job restarts it in every room except the ones it never covers', () => {
  const types = [T('site_clean', 'none', '1', { includes: 'daily_clean', not_in_areas: 'iso' }), T('daily_clean', 'area', '1'), T('bowls', 'none', '1')];
  const logs = [L('site_clean', '2026-03-02', { subject_id: '', how_recorded: 'site_tap' })];
  const room = D.forTarget(types, logs, { area_id: 'r1' }, '2026-03-02');
  assert.equal(one(room, 'daily_clean').status, 'ok');
  assert.equal(one(room, 'daily_clean').reset_by, 'site_clean');
  assert.equal(one(D.forTarget(types, logs, { area_id: 'iso' }, '2026-03-02'), 'daily_clean').status, 'never');
  assert.equal(one(D.forTarget(types, logs, {}, '2026-03-02'), 'site_clean').status, 'ok');
  assert.equal(D.forTarget(types, logs, { subject_id: 'd1' }, '2026-03-02').length, 0);
  const plain = [T('site_clean', 'none', '1', { not_in_areas: 'iso' }), T('daily_clean', 'area', '1')];
  assert.equal(one(D.forTarget(plain, logs.map((l) => Object.assign({}, l, { check_type_id: 'cty-site_clean-1' })), { area_id: 'r1' }, '2026-03-02'), 'daily_clean').status, 'never');
});

test('a room job with only_in_areas shows only in those rooms, and counts only the dogs in them', () => {
  const types = [T('iso_checks', 'area', '1', { only_in_areas: 'iso', site_scope: 'per_dog' }), T('daily_clean', 'area', '1')];
  const day = '2026-03-02';
  assert.deepEqual(D.forTarget(types, [], { area_id: 'iso' }, day).map((j) => j.type_key).sort(), ['daily_clean', 'iso_checks']);
  assert.deepEqual(D.forTarget(types, [], { area_id: 'r1' }, day).map((j) => j.type_key), ['daily_clean']);
  assert.equal(D.forTarget(types, [], { subject_id: 'd1', everyDog: true, dogArea: 'iso' }, day).length, 1);
  assert.equal(D.forTarget(types, [], { subject_id: 'd2', everyDog: true, dogArea: 'r1' }, day).length, 0);
  assert.equal(D.forTarget(types, [], { subject_id: 'd2', everyDog: true }, day).length, 0);
});

test('a whole-site job about dogs: shown on each dog and room it covers, done once every dog has a line', () => {
  const types = [T('health', 'none', '1', { site_scope: 'per_dog', not_in_areas: 'iso' })];
  const dogs = [{ id: 'd1', area_id: 'r1' }, { id: 'd2', area_id: 'r2' }, { id: 'd3', area_id: 'iso' }];
  const line = (dog) => ({ id: 'l-' + dog, check_type_id: 'cty-health-1', subject_id: dog, outcome: 'ok', how_recorded: 'site_tap', taken_at: '2026-03-02T09:00:00Z' });
  const one = (target, logs) => D.forTarget(types, logs, target, '2026-03-02')[0];
  // one dog done as they go: that dog and its room are done; the site waits for the other dog (the isolation dog is never counted)
  assert.equal(one({ subject_id: 'd1', dogs: [dogs[0]] }, [line('d1')]).status, 'ok');
  assert.equal(one({ area_id: 'r1', dogs: [dogs[0]] }, [line('d1')]).status, 'ok');
  assert.equal(one({ area_id: 'r2', dogs: [dogs[1]] }, [line('d1')]).status, 'never');
  assert.equal(one({ dogs }, [line('d1')]).status, 'never');
  assert.equal(one({ dogs }, [line('d1'), line('d2')]).status, 'ok');
  // not on the isolation room or its dog, and not on a dog or room screen unless the dogs are given
  assert.equal(one({ area_id: 'iso', dogs: [dogs[2]] }, []), undefined);
  assert.equal(one({ subject_id: 'd3', dogs: [dogs[2]] }, []), undefined);
  assert.equal(one({ subject_id: 'd1' }, []), undefined);
  // an older dog line makes the site late by that dog
  const old = Object.assign(line('d2'), { taken_at: '2026-02-27T09:00:00Z' });
  assert.equal(one({ dogs }, [line('d1'), old]).days_late, 2);
});

test("a visitor's record is kept separate unless that visit counts the job", () => {
  const types = [T('clean', 'area', '1')];
  const room = { area_id: 'r1' };
  const rec = (visit) => ({ id: 'v-l', check_type_id: 'cty-clean-1', area_id: 'r1', outcome: 'ok', visit_id: visit, taken_at: '2026-03-02T09:00:00Z' });
  const one = (logs, visits) => D.forTarget(types, logs, room, '2026-03-02', visits)[0].status;
  assert.equal(one([rec('vl1')]), 'never');                                                        // no visit rows given: left out
  assert.equal(one([rec('vl1')], [{ id: 'vl1', record_counts: '' }]), 'never');                     // default: kept separate
  assert.equal(one([rec('vl1')], [{ id: 'vl1', record_counts: 'feed|clean' }]), 'ok');              // the visit counts this job
  assert.equal(one([rec('vl2')], [{ id: 'vl1', record_counts: 'clean' }]), 'never');                // another visit's grant does not carry over
  assert.equal(one([Object.assign(rec(''), { visit_id: '' })]), 'ok');                              // a staff record is unchanged
  // the stamp saved on the row wins over the link (the link may be edited later)
  assert.equal(one([Object.assign(rec('vl1'), { counts_due: 'true' })]), 'ok');
  assert.equal(one([Object.assign(rec('vl1'), { counts_due: 'TRUE' })]), 'ok');
  assert.equal(one([Object.assign(rec('vl1'), { counts_due: 'false' })], [{ id: 'vl1', record_counts: 'clean' }]), 'never');
});
