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
  // today's shape: no visit_id column, the visit is in taken_by
  const byVisit = (link) => ({ id: 'v-t', check_type_id: 'cty-clean-1', area_id: 'r1', outcome: 'ok', taken_by: 'visit:' + link, taken_at: '2026-03-02T09:00:00Z' });
  assert.equal(one([byVisit('vl1')]), 'never');
  assert.equal(one([byVisit('vl1')], [{ id: 'vl1', record_counts: 'clean' }]), 'ok');
  assert.equal(one([Object.assign(byVisit('vl1'), { counts_due: 'true' })]), 'ok');
  assert.equal(one([Object.assign(byVisit('vl1'), { taken_by: 'p-staff1' })]), 'ok');
  assert.equal(D.visitOf({ taken_by: 'visit:vl9' }), 'vl9');
  // the stamp saved on the row wins over the link (the link may be edited later)
  assert.equal(one([Object.assign(rec('vl1'), { counts_due: 'true' })]), 'ok');
  assert.equal(one([Object.assign(rec('vl1'), { counts_due: 'TRUE' })]), 'ok');
  assert.equal(one([Object.assign(rec('vl1'), { counts_due: 'false' })], [{ id: 'vl1', record_counts: 'clean' }]), 'never');
});

test('a note added to a done job never counts as a second done', () => {
  const types = [T('bowls', 'none', '1')];
  const logs = [{ id: 'n1', check_type_id: 'cty-bowls-1', outcome: 'note', note: 'x', note_for_id: 'gone', taken_at: '2026-03-02T09:00:00Z' }];
  assert.equal(D.forTarget(types, logs, {}, '2026-03-02')[0].status, 'never');
});

test('part done is never counted as done', () => {
  const types = [T('bowls', 'none', '1')];
  const logs = [{ id: 'p1', check_type_id: 'cty-bowls-1', outcome: 'part_done', note: 'x', taken_at: '2026-03-02T09:00:00Z' }];
  assert.equal(D.forTarget(types, logs, {}, '2026-03-02')[0].status, 'never');
});

test('round.* types are written by the Round itself and are never listed as jobs (15 Nov 2026)', () => {
  const keys = D.jobsInForce(TYPES.concat([T('round.presence', 'dog', '')]), '2026-10-02').map((r) => r.type_key);
  assert.ok(keys.includes('ears'));
  assert.ok(!keys.includes('round.presence'));
});

test('an item test (target item) is never a job: it is due per item on the Items page', () => {
  const types = [
    { id: 'c1', type_key: 'run', label: 'run', target: 'area', every_days: 1, active: 'true', effective_from: '2026-01-01' },
    { id: 'c2', type_key: 'pat_class_1', label: 'PAT Class I', target: 'item', item_kind: 'appliance_class_1', every_days: 365, active: 'true', effective_from: '2025-01-01' }
  ];
  assert.deepEqual(D.jobsInForce(types, '2026-03-02').map((r) => r.type_key), ['run']);
});

test('only_groups: a dog job belongs only to dogs in those groups on the day; blank = every dog; unknown groups = shown', () => {
  const D = require('../records/due.js');
  const job = { id: 'cty-ftb', type_key: 'ftb', label: 'Fit to breed', target: 'dog', every_days: '365', effective_from: '2026-01-01', only_groups: 'breeding' };
  const links = [
    { role: 'member_of', from_table: 'subject', from_id: 'd1', to_table: 'group', to_id: 'breeding', from_date: '2026-01-01', to_date: '' },
    { role: 'member_of', from_table: 'subject', from_id: 'd2', to_table: 'group', to_id: 'breeding', from_date: '2025-01-01', to_date: '2026-02-01' },
    { role: 'bff', from_table: 'subject', from_id: 'd3', to_table: 'group', to_id: 'breeding', from_date: '2026-01-01', to_date: '' },
  ];
  const day = '2026-03-02';
  assert.deepEqual(D.groupsOf(links, 'd1', day), ['breeding']);
  assert.deepEqual(D.groupsOf(links, 'd2', day), []);   // left the group 1 Feb 2026
  assert.deepEqual(D.groupsOf(links, 'd2', '2026-01-15'), ['breeding']);   // the past is judged by the row then
  assert.deepEqual(D.groupsOf(links, 'd3', day), []);   // another kind of link
  const n = (sid) => D.forTarget([job], [], { subject_id: sid, groups: D.groupsOf(links, sid, day) }, day).length;
  assert.equal(n('d1'), 1);
  assert.equal(n('d2'), 0);
  assert.equal(D.forTarget([job], [], { subject_id: 'd2' }, day).length, 1);   // caller did not say: shown
  assert.equal(D.forTarget([Object.assign({}, job, { only_groups: '' })], [], { subject_id: 'd2', groups: [] }, day).length, 1);
});

test('times a day: an owner row makes a daily job stay due until done that many times today; no row = once', () => {
  const room = { area_id: 'iso' };
  const types = [T('iso_check', 'area', '1'), T('clean', 'area', '1')];
  const A = (key, at) => ({ id: 'x' + (++n), check_type_id: 'cty-' + key + '-1', area_id: 'iso', outcome: 'ok', happened_at: at, taken_at: at });
  const R = (k, v, from, to) => ({ rule_key: k, value: v, effective_from: from, to_date: to || '', source: 'test' });
  const rules = [R('job.times_per_day.iso_check', '2', '2026-01-01')];
  const once = [A('iso_check', '2026-10-02T08:00:00Z'), A('clean', '2026-10-02T08:00:00Z')];
  let r = D.forTarget(types, once, room, '2026-10-02', null, { rules });
  const iso = r.find((j) => j.type_key === 'iso_check'), clean = r.find((j) => j.type_key === 'clean');
  assert.equal(iso.status, 'today'); assert.equal(iso.done_today, 1); assert.equal(iso.times_per_day, 2);
  assert.equal(clean.status, 'ok'); assert.equal(clean.times_per_day, 1);
  r = D.forTarget(types, once.concat([A('iso_check', '2026-10-02T18:00:00Z')]), room, '2026-10-02', null, { rules });
  assert.equal(r.find((j) => j.type_key === 'iso_check').status, 'ok');
  // no rules given: once a day, as before
  assert.equal(D.forTarget(types, once, room, '2026-10-02').find((j) => j.type_key === 'iso_check').status, 'ok');
  // the row in force on the day: an ended row no longer counts
  assert.equal(D.timesPerDay([R('job.times_per_day.iso_check', '2', '2026-01-01', '2026-06-30')], 'iso_check', '2026-10-02'), 1);
  assert.equal(D.timesPerDay([R('job.times_per_day', '3', '2026-01-01')], 'iso_check', '2026-10-02'), 3);
});

test('a room job saved per dog: not due in an empty room; times a day counted per dog, by its least-checked dog', () => {
  const types = [{ id: 'cty-iso_checks-1', type_key: 'iso_checks', label: 'Isolation checks', target: 'area', site_scope: 'per_dog', every_days: '1', active: 'true', effective_from: '2026-01-01', only_in_areas: 'iso' }];
  const rules = [{ rule_key: 'job.times_per_day.iso_checks', value: '3', effective_from: '2026-01-01', to_date: '', source: 'test' }];
  let n = 0;
  const L = (dog, at) => ({ id: 'y' + (++n), check_type_id: 'cty-iso_checks-1', area_id: 'iso', subject_id: dog, outcome: 'ok', happened_at: at, taken_at: at });
  // nobody in the room: no job
  assert.equal(D.forTarget(types, [], { area_id: 'iso', roomDogIds: [] }, '2026-10-02', null, { rules }).length, 0);
  // no roomDogIds given (hub, Earlier): as before
  assert.equal(D.forTarget(types, [], { area_id: 'iso' }, '2026-10-02', null, { rules }).length, 1);
  // two dogs: one room tap = one line each = 1 time, not 2
  const room = { area_id: 'iso', roomDogIds: ['d1', 'd2'] };
  let logs = [L('d1', '2026-10-02T08:00:00Z'), L('d2', '2026-10-02T08:00:00Z')];
  let j = D.forTarget(types, logs, room, '2026-10-02', null, { rules })[0];
  assert.equal(j.done_today, 1); assert.equal(j.status, 'today'); assert.equal(j.times_per_day, 3);
  logs = logs.concat([L('d1', '2026-10-02T12:00:00Z'), L('d2', '2026-10-02T12:00:00Z'), L('d1', '2026-10-02T18:00:00Z')]);
  j = D.forTarget(types, logs, room, '2026-10-02', null, { rules })[0];
  assert.equal(j.done_today, 2); assert.equal(j.status, 'today');   // d2 only twice
  logs = logs.concat([L('d2', '2026-10-02T18:05:00Z')]);
  assert.equal(D.forTarget(types, logs, room, '2026-10-02', null, { rules })[0].status, 'ok');
  // one dog's own card counts that dog only
  j = D.forTarget(types, logs.slice(0, 3), { subject_id: 'd1', everyDog: true, dogArea: 'iso' }, '2026-10-02', null, { rules })[0];
  assert.equal(j.done_today, 2);
});
