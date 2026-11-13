'use strict';
/** 12 Nov 2026 (TEMPS): a read reply carries the caller's own role, so the page can hide owner-only buttons. The script still decides what is read. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv } = require('./harness');
const fx = require('./fixtures');

test('a read reply says the caller\'s own role: OWNER for an owner code, STAFF for a staff code', () => {
  const env = standardEnv({ props: { READ_ENABLED: 'true' } });
  const f = env.file('BLD-field_visibility.csv')[0];
  f.content = f.content.replace(/\r?\n?$/, '\r\n') + ['aud-admin', 'aud-staff'].flatMap((a) => ['*', 'id', 'name'].map((c) => `fv-x,${fx.TENANT},area,${c},${a},yes,,,t,2026-11-12,t`)).join('\r\n') + '\r\n';
  const role = (code) => env.ctx.sinkRead_({ v: 1, action: 'read', code, table: 'area' }).role;
  assert.equal(role(env.codes.owner), 'OWNER');
  assert.equal(role(env.codes.staff), 'STAFF');
});

test('a read reply also says the caller\'s own name (the Welcome line), never anyone else\'s', () => {
  const env = standardEnv({ props: { READ_ENABLED: 'true' } });
  const f = env.file('BLD-field_visibility.csv')[0];
  f.content = f.content.replace(/\r?\n?$/, '\r\n') + ['aud-admin', 'aud-staff'].flatMap((a) => ['*', 'id', 'name'].map((c) => `fv-x,${fx.TENANT},area,${c},${a},yes,,,t,2026-11-12,t`)).join('\r\n') + '\r\n';
  const r = (code) => env.ctx.sinkRead_({ v: 1, action: 'read', code, table: 'area' });
  assert.equal(typeof r(env.codes.staff).name, 'string');
  assert.ok(r(env.codes.staff).name.length > 0);
  assert.notEqual(r(env.codes.staff).name, r(env.codes.owner).name);
});
