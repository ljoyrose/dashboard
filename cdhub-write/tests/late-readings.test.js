'use strict';
/**
 * 11 Nov 2026, Lisa: "remove 7 day limit on readings". Room temperature readings (staff, owner, guest) may be typed in
 * late, e.g. from photos, back as far as temperature records are kept (a BLD-retention_setting row, else 6 years).
 * Never a future time; read_method is required; taken_at / taken_by show when it was typed; other lists keep 7 days.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const NOW = Date.UTC(2026, 10, 12, 10, 0, 0);   // 12 Nov 2026 10:00 UTC
const DAY = 86400000;
const GUEST_HEADER = ['id', 'tenant_id', 'area_id', 'min_c', 'max_c', 'spot_c', 'precision_dp', 'period_start', 'taken_at', 'taken_by', 'read_method', 'camera_value_changed', 'mitigation_note', 'note'];
const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');
const env0 = () => {
  const env = standardEnv({ nowMs: NOW, props: { TABLE_ON_guest_reading: 'true' } });
  env.addFile('BLD-guest_reading.csv', fx.headerOnly(GUEST_HEADER));
  env.guest = env.ctx.adminAddGuestCode();
  return env;
};
const send = (env, code, extra, table) => save(env, req(env, { code, table: table || 'area_reading', fields: Object.assign({ area_id: 'area-t1', min_c: '18.0', max_c: '22.0', read_method: 'typed' }, extra) }));
const count = (env, f) => env.text(f || 'BLD-area_reading.csv').split(/\r?\n/).filter(Boolean).length - 1;

test('staff, owner and guest: a reading 30 days old saves, typed or from a photo, stamped with when it was typed', () => {
  const env = env0();
  assert.equal(send(env, env.codes.staff, { period_start: iso(NOW - 30 * DAY) }).ok, true);
  assert.equal(send(env, env.codes.owner, { read_method: 'photo', period_start: iso(NOW - 31 * DAY) }).ok, true);
  const g = send(env, env.guest, { read_method: 'camera', period_start: iso(NOW - 32 * DAY) }, 'guest_reading');
  assert.equal(g.ok, true, JSON.stringify(g));
  assert.equal(count(env), 2); assert.equal(count(env, 'BLD-guest_reading.csv'), 1);
  assert.match(env.text('BLD-area_reading.csv'), /2026-11-12T10:00:00Z?|2026-11-12T10:00:00\+00:00/);   // taken_at = when typed
});

test('read_method is required: camera, typed or photo, nothing else', () => {
  const env = env0();
  const none = send(env, env.codes.staff, { read_method: '' });
  assert.equal(none.code, 'INVALID'); assert.match(none.fields.read_method, /needed/);
  assert.equal(send(env, env.codes.staff, { read_method: 'guess' }).code, 'INVALID');
  assert.equal(send(env, env.guest, { read_method: '' }, 'guest_reading').code, 'INVALID');
  assert.equal(count(env), 0);
});

test('a future time is still refused, for every role', () => {
  const env = env0();
  [env.codes.staff, env.codes.owner].forEach((c) => assert.match(send(env, c, { period_start: iso(NOW + 2 * DAY) }).fields.period_start, /future/));
  assert.match(send(env, env.guest, { period_start: iso(NOW + 2 * DAY) }, 'guest_reading').fields.period_start, /future/);
});

test('a late reading never fills a slot already filled, however far apart the two entries are', () => {
  const env = env0();
  const ps = iso(NOW - 30 * DAY);
  assert.equal(send(env, env.codes.owner, { read_method: 'photo', period_start: ps }).ok, true);
  assert.equal(send(env, env.codes.staff, { period_start: ps }).code, 'DUPLICATE');
  env.nowMs = NOW + 3 * 3600000;                                  // three hours later: still the same slot
  assert.equal(send(env, env.codes.owner, { read_method: 'photo', period_start: ps }).code, 'DUPLICATE');
  assert.equal(send(env, env.codes.owner, { read_method: 'photo', period_start: iso(NOW - 31 * DAY) }).ok, true);   // another slot saves
  assert.equal(count(env), 2);
});

test('only readings change: other lists keep the 7-day limit', () => {
  const env = env0();
  const v = env.ctx.validateInput_({ input: { happened_at: { type: 'datetime' } } }, { happened_at: iso(NOW - 30 * DAY) }, {}, NOW);
  assert.match(v.errors.happened_at, /7 days/);
  assert.equal(env.ctx.TABLES.check_log.ageCap, undefined);
  assert.ok(env.ctx.TABLES.area_reading.ageCap && env.ctx.TABLES.guest_reading.ageCap);
});

test('the cap edge: back to exactly the kept years saves, a minute more is refused; a retention row replaces the default', () => {
  const sixYearsAgo = Date.UTC(2020, 10, 12, 10, 0, 0);
  let env = env0();                                               // no BLD-retention_setting file: the 6-year default
  assert.equal(send(env, env.codes.staff, { period_start: iso(sixYearsAgo) }).ok, true);
  const over = send(env, env.codes.staff, { period_start: iso(sixYearsAgo - 60000) });
  assert.equal(over.code, 'INVALID'); assert.match(over.fields.period_start, /kept \(6 years\)/);

  env = env0();                                                   // Lisa sets temperature records to 2 years
  env.addFile('BLD-retention_setting.csv', ['id,tenant_id,section,keep_years,basis,set_by,set_on',
    `ret-1,${fx.TENANT},temperature,2,Lisa's setting,o,2026-11-11`, `ret-2,${fx.TENANT},staff,10,x,o,2026-11-11`].join('\r\n') + '\r\n');
  assert.equal(send(env, env.codes.owner, { read_method: 'photo', period_start: iso(Date.UTC(2024, 10, 12, 10, 0, 0)) }).ok, true);
  const r = send(env, env.codes.owner, { read_method: 'photo', period_start: iso(Date.UTC(2024, 10, 12, 9, 59, 0)) });
  assert.equal(r.code, 'INVALID'); assert.match(r.fields.period_start, /kept \(2 years\)/);
});
