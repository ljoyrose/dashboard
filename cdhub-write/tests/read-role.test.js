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

test('key_prefix=job. (15 Nov 2026, SOPJOBS S8): staff read only the job.* owner settings from breeding_rule', () => {
  const env = standardEnv({ props: { READ_ENABLED: 'true' } });
  const t = fx.TENANT;
  const rules = env.file('BLD-breeding_rule.csv');
  const text = ['id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date',
    `br-1,${t},job.paper_default_time,12:00,2026-11-14,Lisa,,,,`, `br-2,${t},link_kind.main,Main photo,2026-01-01,t,,,,`,
    `br-3,${t},file.who_may,STAFF,2026-01-01,t,,,,`].join('\r\n') + '\r\n';
  if (rules.length) { rules[0].content = text; rules[0].sheet = undefined; } else env.addFile('BLD-breeding_rule.csv', text);
  const f = env.file('BLD-field_visibility.csv')[0];
  f.content = f.content.replace(/\r?\n?$/, '\r\n') + [['*', 'key_prefix=job.'], ['rule_key', ''], ['value', ''], ['effective_from', ''], ['to_date', '']]
    .map(([c, cond]) => `fv-x,${t},breeding_rule,${c},aud-staff,yes,${cond},,t,2026-11-15,t`).join('\r\n') + '\r\n';
  const r = env.ctx.sinkRead_({ v: 1, action: 'read', code: env.codes.staff, table: 'breeding_rule' });
  assert.deepEqual(Array.from(r.rows, (x) => x.rule_key), ['job.paper_default_time']);
  assert.equal(r.rows[0].value, '12:00');
  assert.equal(r.scope, 'the job.* rows');
});
