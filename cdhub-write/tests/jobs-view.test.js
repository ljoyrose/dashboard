'use strict';
/** Compliance job counts: litter jobs count only for the litters the caller passes as current. */
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../../cdhub/jobs-view.js');

const T = (key, target, every) => ({ id: 'cty-' + key, type_key: key, label: key, target, every_days: every, active: 'true', effective_from: '2026-01-01', sop: 'Socialisation' });
const base = { today: '2026-03-02', types: [T('socialise', 'litter', '1')], dogs: [], areas: [] };
const logs = [{ id: 'l1', check_type_id: 'cty-socialise', litter_id: 'lit1', outcome: 'ok', taken_at: '2026-03-02T09:00:00Z' }];

test('litter jobs count per current litter, and not at all with no current litters', () => {
  const one = V.summary(Object.assign({}, base, { logs, litters: [{ id: 'lit1' }, { id: 'lit2' }] }))[0];
  assert.equal(one.ok, 1);
  assert.equal(one.due, 1);
  assert.equal(V.summary(Object.assign({}, base, { logs, litters: [] })).length, 0);
  assert.equal(V.summary(Object.assign({}, base, { logs })).length, 0);
});

test('a litter\'s history lists only its own records', () => {
  const v = Object.assign({}, base, { logs: logs.concat([{ id: 'l2', check_type_id: 'cty-socialise', litter_id: 'lit2', outcome: 'ok', taken_at: '2026-03-01T09:00:00Z' }]) });
  assert.deepEqual(V.history(v, { litter_id: 'lit1' }).map((r) => r.at), ['2026-03-02T09:00:00Z']);
});

test('an isolation-only room job is counted for the isolation room and its dogs, not every room and dog', () => {
  const v = { today: '2026-03-02', logs: [], litters: [], types: [Object.assign(T('iso_checks', 'area', '1'), { only_in_areas: 'iso', site_scope: 'per_dog', sop: 'Isolation' })],
    dogs: [{ id: 'd1', area_id: 'iso' }, { id: 'd2', area_id: 'r1' }], areas: [{ id: 'iso' }, { id: 'r1' }] };
  const row = V.summary(v)[0];
  assert.equal(row.due, 1);
});
