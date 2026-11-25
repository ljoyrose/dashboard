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

test('a litter job due by age (owner row job.by_age.<key>): daily in week 1, weekly to 4 weeks, then at 6 and 10 weeks', () => {
  const types = [{ id: 'pw', type_key: 'pup_weights', label: 'Puppy weights', target: 'litter', every_days: '', active: 'true', effective_from: '2026-01-01' }];
  const rules = [{ rule_key: 'job.by_age.pup_weights', value: '0-6:1|7-27:7|42|70', effective_from: '2026-01-01', source: 'Lisa 22 Nov 2026' }];
  const born = '2026-03-01', t = { litter_id: 'lit1', born };
  const log = (day) => ({ id: 'w' + day, check_type_id: 'pw', litter_id: 'lit1', outcome: 'ok', taken_at: day + 'T09:00:00Z' });
  const at = (day, logs) => D.forTarget(types, logs, t, day, null, { rules })[0];
  assert.equal(at('2026-03-03', []).status, 'today');                                   // day 2: daily
  assert.equal(at('2026-03-03', [log('2026-03-03')]).next_due, '2026-03-04');
  assert.deepEqual([at('2026-03-04', [log('2026-03-02')]).status, at('2026-03-04', [log('2026-03-02')]).days_late], ['today', 0]);
  const wk2 = at('2026-03-10', [log('2026-03-08')]);                                    // weekly from day 7: done day 7, next day 14
  assert.deepEqual([wk2.status, wk2.next_due], ['ok', '2026-03-15']);
  const gap = at('2026-04-01', [log('2026-03-22')]);                                    // after 4 weeks nothing until 6 weeks
  assert.deepEqual([gap.status, gap.next_due], ['ok', '2026-04-12']);
  const missed = at('2026-04-14', [log('2026-03-22')]);                                 // 6-week weight missed
  assert.deepEqual([missed.status, missed.days_late], ['late', 2]);
  assert.equal(at('2026-06-01', [log('2026-05-10')]).status, 'ok');                     // after 10 weeks: done
  assert.equal(D.forTarget(types, [], { litter_id: 'lit1' }, '2026-03-03', null, { rules })[0].status, 'as_needed');   // no birth date: as before
  assert.equal(D.forTarget(types, [], t, '2026-03-03', null, {})[0].status, 'as_needed');                              // no row: as before
});

test('the by-age row in force on the day wins, and bad parts of it are skipped', () => {
  const rules = [{ rule_key: 'job.by_age.x', value: '0', effective_from: '2026-01-01' }, { rule_key: 'job.by_age.x', value: '3|junk|5-1:1|7-9:0', effective_from: '2026-03-01' }];
  assert.deepEqual(D.ageDates(rules, 'x', '2026-02-01', '2026-01-10'), ['2026-01-10']);
  assert.deepEqual(D.ageDates(rules, 'x', '2026-03-02', '2026-03-01T10:00:00Z'), ['2026-03-04']);
});

test('londonDate keeps one formatter for the time zone', () => {
  const Real = Intl.DateTimeFormat;
  function count(rel) {
    const p = require.resolve(rel);
    delete require.cache[p];
    let n = 0;
    Intl.DateTimeFormat = function (a, b) { n++; return new Real(a, b); };
    const M = require(rel);
    M.londonDate('2026-07-01T23:30:00Z');
    M.londonDate('2026-11-01T00:30:00Z');
    Intl.DateTimeFormat = Real;
    delete require.cache[p];
    return n;
  }
  assert.equal(count('../records/due.js'), 1);
  assert.equal(count('../../cdhub/staff/lib/due.js'), 1);
});

test('daily clean and isolation clean are due only when the room is occupied that day', () => {
  const types = [T('daily_clean', 'area', '1', { label: 'Daily clean' }), T('iso_clean', 'area', '1', { label: 'Isolation clean', only_in_areas: 'area-b' })];
  const day = '2026-11-02';
  assert.equal(D.forTarget(types, [], { area_id: 'area-a', roomDogIds: [] }, day).length, 0);
  assert.equal(D.forTarget(types, [], { area_id: 'area-b', roomDogIds: [] }, day).length, 0);
  assert.deepEqual(D.forTarget(types, [], { area_id: 'area-a', roomDogIds: ['sub-test-a'] }, day).map((j) => j.type_key), ['daily_clean']);
  assert.deepEqual(D.forTarget(types, [], { area_id: 'area-b', roomDogIds: ['sub-test-b'] }, day).map((j) => j.type_key).sort(), ['daily_clean', 'iso_clean']);
  assert.equal(D.forTarget(types, [], { area_id: 'area-a' }, day).some((j) => j.type_key === 'daily_clean'), true);
});

test('deep clean, room disinfected, full clean and room emptied skip retired areas and field or corridor kinds', () => {
  const types = ['deep_clean', 'room_disinfected', 'full_clean', 'room_emptied'].map((k) => T(k, 'area', '7', { label: k }));
  const day = '2026-11-02';
  const keys = (target) => D.forTarget(types, [], target, day).map((j) => j.type_key).sort();
  assert.deepEqual(keys({ area_id: 'area-a', roomDogIds: [] }), ['deep_clean', 'full_clean', 'room_disinfected', 'room_emptied']);
  assert.deepEqual(keys({ area_id: 'area-a', areaRetired: true }), []);
  assert.deepEqual(keys({ area_id: 'area-b', areaKind: 'field' }), []);
  assert.deepEqual(keys({ area_id: 'area-c', areaUse: 'corridor' }), []);
  assert.deepEqual(keys({ area_id: 'area-d', areaGroup: 'fields', areaNoDogs: true }), []);
});

test('weight, medicine, vaccination and microchip use their own tables for the last date', () => {
  const types = [
    T('weight', 'dog', '7', { label: 'Weight' }),
    T('medicine', 'dog', '1', { label: 'Medicine' }),
    T('vaccination', 'dog', '365', { label: 'Vaccination' }),
    T('microchip', 'dog', '365', { label: 'Microchip' })
  ];
  const records = {
    weight: [{ subject_id: 'sub-test-a', performed_on: '2026-11-01', weight_kg: '1' }, { subject_id: 'sub-test-b', performed_on: '2026-10-01' }],
    dispense: [{ subject_id: 'sub-test-a', given_on: '2026-11-02' }],
    vaccination: [{ subject_id: 'sub-test-a', given_on: '2026-01-02' }, { subject_id: 'sub-test-a', given_on: '2026-06-01', voided_on: '2026-06-02' }],
    microchip: [{ subject_id: 'sub-test-a', fitted_on: '2024-03-01' }]
  };
  const row = (key) => D.forTarget(types, [], { subject_id: 'sub-test-a' }, '2026-11-02', null, { records }).find((j) => j.type_key === key);
  assert.equal(row('weight').last_done, '2026-11-01');
  assert.equal(row('weight').next_due, '2026-11-08');
  assert.equal(row('weight').status, 'ok');
  assert.equal(row('medicine').last_done, '2026-11-02');
  assert.equal(row('medicine').status, 'ok');
  assert.equal(row('vaccination').last_done, '2026-01-02');
  assert.equal(row('microchip').last_done, '2024-03-01');
  assert.equal(D.forTarget(types, [], { subject_id: 'sub-test-b' }, '2026-11-02', null, { records }).find((j) => j.type_key === 'weight').last_done, '2026-10-01');
});

test('on site that day uses occupancy and status dates; juveniles stay in until a rule or setting says otherwise', () => {
  const occ = [
    { subject_id: 'sub-test-a', area_id: 'area-a', moved_in: '2026-01-01' },
    { subject_id: 'sub-test-b', area_id: 'area-a', moved_in: '2026-11-16', moved_out: '2026-11-20' },
    { subject_id: 'sub-test-c', area_id: 'area-a', moved_in: '2026-01-01' },
    { subject_id: 'sub-test-d', area_id: 'area-a', moved_in: '2026-10-01' }
  ];
  const statuses = [
    { subject_id: 'sub-test-a', state: 'active', from_date: '2020-01-01' },
    { subject_id: 'sub-test-b', state: 'active', from_date: '2026-11-16' },
    { subject_id: 'sub-test-c', state: 'active', from_date: '2020-01-01' },
    { subject_id: 'sub-test-c', state: 'deceased', from_date: '2026-11-10' }
  ];
  const subjects = [
    { id: 'sub-test-a', area_id: 'area-a', kind: 'adult', dob: '2020-01-01' },
    { id: 'sub-test-b', area_id: 'area-a', kind: 'adult', dob: '2020-01-01' },
    { id: 'sub-test-c', area_id: 'area-a', kind: 'adult', dob: '2020-01-01' },
    { id: 'sub-test-d', area_id: 'area-a', kind: 'pup', dob: '2026-10-01' }
  ];
  assert.equal(D.onSite(subjects[0], occ, statuses, '2026-11-15'), true);
  assert.equal(D.onSite(subjects[1], occ, statuses, '2026-11-15'), false);
  assert.equal(D.onSite(subjects[1], occ, statuses, '2026-11-16'), true);
  assert.equal(D.onSite(subjects[1], occ, statuses, '2026-11-21'), false);
  assert.equal(D.onSite(subjects[2], occ, statuses, '2026-11-15'), false);
  const job = T('health_check_all', 'none', '1', { site_scope: 'per_dog', label: 'Health check' });
  const day = '2026-11-16';
  assert.equal(D.subjectsFor(job, subjects, day, { occupancy: occ, statuses }).some((d) => d.id === 'sub-test-d'), true);
  const rules = [{ rule_key: 'job.exclude_juvenile.health_check_all', value: 'on', effective_from: '2026-01-01' }];
  assert.equal(D.subjectsFor(job, subjects, day, { occupancy: occ, statuses, rules }).some((d) => d.id === 'sub-test-d'), false);
  assert.equal(D.subjectsFor(job, subjects, day, { occupancy: occ, statuses, rules }).some((d) => d.id === 'sub-test-a'), true);
  const settings = [{ type_key: 'health_check_all', exclude_juvenile: 'true', from_date: '2026-01-01' }];
  assert.equal(D.excludeJuvenile([], 'health_check_all', day, settings), true);
  assert.equal(D.excludeJuvenile([], 'health_check_all', day, []), false);
});

test('times a day by age: bands, fallback, litters, mixed ages, bowls', () => {
  const R = (k, v, from) => ({ rule_key: k, value: v, effective_from: from, to_date: '' });
  const young = { id: 'sub-test-a', dob: '2026-03-01' };
  const adult = { id: 'sub-test-b', dob: '2020-01-01' };
  const day = '2026-03-11';
  const flat = [R('job.times_per_day.feeding', '2', '2026-01-01')];
  const bands = flat.concat([R('job.times_per_day.feeding.by_age', '0-10:4|11-:2', '2026-01-01')]);
  const live = [T('feeding', 'dog', '1'), T('food_bowls', 'none', '1'), T('water_bowls', 'none', '1')];
  assert.equal(D.timesPerDay(flat, 'feeding', day, { subjects: [young] }), 2);
  assert.equal(D.timesPerDay([], 'feeding', day, { subjects: [young] }), 1);
  assert.equal(D.timesPerDay([R('job.times_per_day', '3', '2026-01-01')], 'feeding', day, { subjects: [young] }), 3);
  assert.equal(D.timesPerDay(bands, 'feeding', day, { subjects: [young] }), 4);
  assert.equal(D.timesPerDay(bands, 'feeding', '2026-03-01', { subjects: [young] }), 4);
  assert.equal(D.timesPerDay(bands, 'feeding', '2026-03-12', { subjects: [young] }), 2);
  assert.equal(D.timesPerDay(bands, 'feeding', day, { litters: [{ id: 'lit-test-1', born: '2026-03-01' }] }), 4);
  assert.equal(D.timesPerDay(bands, 'feeding', day, { subjects: [young, adult] }), 4);
  assert.equal(D.timesPerDay(bands, 'feeding', day, { subjects: [{ id: 'sub-test-c' }] }), 2);
  assert.equal(D.timesPerDay(bands, 'feeding', day, { subjects: [{ id: 'sub-test-c' }, young] }), 4);
  const high = [R('job.times_per_day.feeding.by_age', '0-10:3|11-:2', '2026-01-01'), R('job.times_per_day.feeding', '5', '2026-01-01')];
  assert.equal(D.timesPerDay(high, 'feeding', day, { subjects: [{ id: 'sub-test-c' }, young] }), 5);
  assert.equal(D.timesPerDay(bands, 'food_bowls', day, { subjects: [young, adult], types: live }), 4);
  assert.equal(D.timesPerDay(bands.concat([R('job.times_per_day.water_bowls', '1', '2026-01-01')]), 'water_bowls', day, { subjects: [young, adult], types: live }), 1);
  assert.equal(D.timesPerDay(bands, 'water_bowls', day, { subjects: [young], types: live }), 1);
  const off = [T('feeding', 'dog', '1', { active: 'false' }), T('food_bowls', 'none', '1')];
  assert.equal(D.timesPerDay(bands.concat([R('job.times_per_day.food_bowls', '2', '2026-01-01')]), 'food_bowls', day, { subjects: [young], types: off }), 2);
  assert.equal(D.timesPerDay(bands, 'food_bowls', day, { subjects: [young], types: [T('food_bowls', 'none', '1')] }), 1);
  const dated = [R('job.times_per_day.feeding.by_age', '0-:2', '2026-01-01'), R('job.times_per_day.feeding.by_age', '0-:5', '2026-06-01'), R('job.times_per_day.feeding', '2', '2026-01-01')];
  assert.equal(D.timesPerDay(dated, 'feeding', day, { subjects: [young] }), 2);
  assert.equal(D.timesPerDay(dated, 'feeding', '2026-06-02', { subjects: [{ id: 'sub-test-a', dob: '2026-06-01' }] }), 5);
  const empty = [R('job.times_per_day.feeding', '2', '2026-01-01'), R('job.times_per_day.feeding.by_age', '', '2026-03-01')];
  assert.equal(D.timesPerDay(empty, 'feeding', day, { subjects: [young] }), 2);
  const none = D.timesRules('feeding', '', [{ from: '', to: '', n: '' }]);
  assert.equal(none.error, '');
  assert.equal(none.rules.length, 0);
  const only = D.timesRules('feeding', '2', [{ from: '', to: '', n: '' }]);
  assert.deepEqual(only.rules, [{ rule_key: 'job.times_per_day.feeding', value: '2' }]);
  const bad = D.timesRules('feeding', '2', [{ from: '0', to: '', n: '' }]);
  assert.equal(bad.rules.length, 0);
  assert.ok(bad.error);
  const both = D.timesRules('feeding', '2', [{ from: '0', to: '10', n: '4' }, { from: '11', to: '', n: '2' }]);
  assert.equal(both.error, '');
  assert.deepEqual(both.rules.map((r) => r.rule_key), ['job.times_per_day.feeding', 'job.times_per_day.feeding.by_age']);
  assert.equal(both.rules[1].value, '0-10:4|11-:2');
  const litter = D.forTarget([T('feeding', 'litter', '1')], [], { litter_id: 'lit-test-1', born: '2026-03-01' }, day, null, { rules: bands })[0];
  assert.equal(litter.times_per_day, 4);
  const one = D.forTarget([T('feeding', 'dog', '1')], [], { subject_id: 'sub-test-a', dob: '2026-03-01' }, day, null, { rules: bands })[0];
  assert.equal(one.times_per_day, 4);
  const mixed = D.forTarget([T('food_bowls', 'none', '1'), T('feeding', 'dog', '1')], [], { dogs: [young, adult] }, day, null, { rules: bands }).find((j) => j.type_key === 'food_bowls');
  assert.equal(mixed.times_per_day, 4);
  const room = D.forTarget([T('feeding', 'either', '1')], [], { area_id: 'area-a', roomDogs: [young, adult] }, day, null, { rules: bands })[0];
  assert.equal(room.times_per_day, 4);
});
