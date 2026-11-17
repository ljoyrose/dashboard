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

/* Dated hiding (Lisa 15 Nov 2026, Q3): optional columns row_id, role_code, from_date, to_date, source at the end of
   BLD-field_visibility.csv. The test clock is 15 Oct 2026 (London). Invented rows only. */
const VIS_Q3 = 'id,tenant_id,table_name,field_name,audience_id,visible,condition,redaction,set_by,set_on,reason,row_id,role_code,from_date,to_date,source';
function q3Env(extra) {
  const env = standardEnv({ props: { READ_ENABLED: 'true' } });
  const t = fx.TENANT, base = (aud) => ['*', 'id', 'code', 'm2_note'].map((c) => `fv-b,${t},area,${c},${aud},yes,,,t,2026-10-01,t,,,,,`);
  const f = env.file('BLD-field_visibility.csv')[0];
  f.content = [VIS_Q3].concat(base('aud-admin'), base('aud-staff'), extra.map((x) => `fv-q,${t},area,${x}`)).join('\r\n') + '\r\n';
  f.sheet = undefined;
  return env;
}
const readArea = (env, code) => env.ctx.sinkRead_({ v: 1, action: 'read', code: code || env.codes.staff, table: 'area' });
// extra row: field,audience,visible,condition,redaction,set_by,set_on,reason,row_id,role_code,from_date,to_date,source

test('Q3: no new columns, or blank ones: reads exactly as before', () => {
  const r = readArea(q3Env([]));
  assert.deepEqual(Array.from(r.rows, (x) => x.id), ['area-t1', 'area-t2', 'area-t3-1']);
  assert.equal(r.rows[1].m2_note, 'fake note, with a comma');
});

test('Q3: one record hidden (row_id + *), one cell hidden (row_id + column), for staff only', () => {
  const env = q3Env(['*,aud-staff,no,,,t,2026-10-01,t,area-t1,,,,owner', 'm2_note,aud-staff,no,,,t,2026-10-01,t,area-t2,,,,owner']);
  const s = readArea(env);
  assert.deepEqual(Array.from(s.rows, (x) => x.id), ['area-t2', 'area-t3-1']);
  assert.equal(s.rows[0].m2_note, '');
  assert.equal(s.rows[0].code, 'T2');
  const o = readArea(env, env.codes.owner);
  assert.deepEqual(Array.from(o.rows, (x) => x.id), ['area-t1', 'area-t2', 'area-t3-1']);
  assert.equal(o.rows[1].m2_note, 'fake note, with a comma');
});

test('Q3: a hide row is in force only from .. to (both days included); a whole column can be hidden for a while', () => {
  const ids = (env) => Array.from(readArea(env).rows, (x) => x.id);
  assert.deepEqual(ids(q3Env(['*,aud-staff,no,,,t,,t,area-t1,,2026-10-16,,'])), ['area-t1', 'area-t2', 'area-t3-1']);   // starts tomorrow
  assert.deepEqual(ids(q3Env(['*,aud-staff,no,,,t,,t,area-t1,,2026-10-15,2026-10-15,'])), ['area-t2', 'area-t3-1']);   // today only
  assert.deepEqual(ids(q3Env(['*,aud-staff,no,,,t,,t,area-t1,,2026-10-01,2026-10-14,'])), ['area-t1', 'area-t2', 'area-t3-1']);   // ended yesterday
  const col = readArea(q3Env(['m2_note,aud-staff,no,,,t,,t,,,2026-10-01,2026-10-31,']));
  assert.ok(!Array.from(col.fields).includes('m2_note'));
});

test('Q3: an unreadable date keeps a hide row in force and a show row out; a row_id row can never show more', () => {
  assert.deepEqual(Array.from(readArea(q3Env(['*,aud-staff,no,,,t,,t,area-t1,,someday,,'])).rows, (x) => x.id), ['area-t2', 'area-t3-1']);
  // a show row for grouping with a bad date gives nothing extra
  assert.ok(!Array.from(readArea(q3Env(['grouping,aud-staff,yes,,,t,,t,,,soon,,'])).fields).includes('grouping'));
  // a yes row with a row_id does not widen anything
  assert.ok(!Array.from(readArea(q3Env(['grouping,aud-staff,yes,,,t,,t,area-t1,,,,'])).fields).includes('grouping'));
  // and a hide row with a row_id does not switch the whole list off
  assert.equal(readArea(q3Env(['*,aud-staff,no,,,t,,t,area-t3-1,,,,'])).rows.length, 2);
});

test('Q3: role_code names the role when audience_id is blank; the person\'s and the role\'s hides both apply', () => {
  const env = q3Env(['*,,no,,,t,,t,area-t1,STAFF,,,', 'grouping,,yes,,,t,,t,,STAFF,,,']);
  const s = readArea(env);
  assert.deepEqual(Array.from(s.rows, (x) => x.id), ['area-t2', 'area-t3-1']);
  assert.ok(Array.from(s.fields).includes('grouping'));
  assert.equal(readArea(env, env.codes.owner).rows.length, 3);
  const p = q3Env([`*,person:${'X'},no,,,t,,t,area-t2,,,,`].map((x) => x));
  const sid = p.ids.staff;
  const f = p.file('BLD-field_visibility.csv')[0];
  f.content = f.content.replace('person:X', 'person:' + sid) + `fv-q,${fx.TENANT},area,*,,no,,,t,,t,area-t3-1,STAFF,,,\r\n`;
  assert.deepEqual(Array.from(readArea(p).rows, (x) => x.id), ['area-t1']);
});
