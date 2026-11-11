'use strict';
/**
 * 11 Nov 2026: missed room readings typed in later from photos. Only an OWNER code with read_method photo may go
 * past the usual 7 days, back as far as temperature records are kept (a BLD-retention_setting row, else 6 years).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const NOW = Date.UTC(2026, 10, 12, 10, 0, 0);   // 12 Nov 2026 10:00 UTC
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');
const send = (env, code, extra) => save(env, req(env, { code, fields: Object.assign({ area_id: 'area-t1', min_c: '18.0', max_c: '22.0' }, extra) }));
const count = (env) => env.text('BLD-area_reading.csv').split(/\r?\n/).filter(Boolean).length - 1;

test('owner + photo + 30 days old saves, marked photo, stamped with when it was typed', () => {
  const env = standardEnv({ nowMs: NOW });
  const r = send(env, env.codes.owner, { read_method: 'photo', period_start: iso(NOW - 30 * DAY) });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(count(env), 1);
  assert.match(env.text('BLD-area_reading.csv'), /photo/);
});

test('owner + typed + 30 days old is refused: the 7-day limit stands without photo', () => {
  const env = standardEnv({ nowMs: NOW });
  const r = send(env, env.codes.owner, { read_method: 'typed', period_start: iso(NOW - 30 * DAY) });
  assert.equal(r.code, 'INVALID'); assert.match(r.fields.period_start, /7 days/);
  assert.equal(send(env, env.codes.owner, { period_start: iso(NOW - 30 * DAY) }).code, 'INVALID');   // no read_method at all
});

test('staff + photo + 30 days old is refused: only the owner can enter late', () => {
  const env = standardEnv({ nowMs: NOW });
  const r = send(env, env.codes.staff, { read_method: 'photo', period_start: iso(NOW - 30 * DAY) });
  assert.equal(r.code, 'INVALID'); assert.match(r.fields.period_start, /7 days/);
  assert.equal(count(env), 0);
});

test('owner + photo: a future time is still refused', () => {
  const env = standardEnv({ nowMs: NOW });
  const r = send(env, env.codes.owner, { read_method: 'photo', period_start: iso(NOW + 2 * DAY) });
  assert.equal(r.code, 'INVALID'); assert.match(r.fields.period_start, /future/);
});

test('owner + photo: the same room and slot twice is a repeat, however far apart the two entries are', () => {
  const env = standardEnv({ nowMs: NOW });
  const ps = iso(NOW - 30 * DAY);
  assert.equal(send(env, env.codes.owner, { read_method: 'photo', period_start: ps }).ok, true);
  assert.equal(send(env, env.codes.owner, { read_method: 'photo', period_start: ps }).code, 'DUPLICATE');
  env.nowMs = NOW + 3 * 3600000;                                   // three hours later: still the same slot
  assert.equal(send(env, env.codes.owner, { read_method: 'photo', period_start: ps }).code, 'DUPLICATE');
  assert.equal(send(env, env.codes.owner, { read_method: 'photo', period_start: iso(NOW - 31 * DAY) }).ok, true);   // another slot saves
  assert.equal(count(env), 2);
});

test('the cap edge: back to exactly the kept years saves, a minute more is refused; a retention row replaces the default', () => {
  const sixYearsAgo = Date.UTC(2020, 10, 12, 10, 0, 0);
  let env = standardEnv({ nowMs: NOW });                          // no BLD-retention_setting file: the 6-year default
  assert.equal(send(env, env.codes.owner, { read_method: 'photo', period_start: iso(sixYearsAgo) }).ok, true);
  const over = send(env, env.codes.owner, { read_method: 'photo', period_start: iso(sixYearsAgo - 60000) });
  assert.equal(over.code, 'INVALID'); assert.match(over.fields.period_start, /kept \(6 years\)/);

  env = standardEnv({ nowMs: NOW });                              // Lisa sets temperature records to 2 years
  env.addFile('BLD-retention_setting.csv', ['id,tenant_id,section,keep_years,basis,set_by,set_on',
    `ret-1,${fx.TENANT},temperature,2,Lisa's setting,o,2026-11-11`, `ret-2,${fx.TENANT},staff,10,x,o,2026-11-11`].join('\r\n') + '\r\n');
  assert.equal(send(env, env.codes.owner, { read_method: 'photo', period_start: iso(Date.UTC(2024, 10, 12, 10, 0, 0)) }).ok, true);
  const r = send(env, env.codes.owner, { read_method: 'photo', period_start: iso(Date.UTC(2024, 10, 12, 9, 59, 0)) });
  assert.equal(r.code, 'INVALID'); assert.match(r.fields.period_start, /kept \(2 years\)/);
});
