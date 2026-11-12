'use strict';
/** 12 Nov 2026 (DOGCARD): coat_colour, coat_pattern, nose_pigment and microchip are readable, only through visibility rows. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv } = require('./harness');
const fx = require('./fixtures');

const fv = (table, field, aud) => `fv-x,${fx.TENANT},${table},${field},${aud},yes,,,t,2026-11-12,t`;
function read(env, over) {
  try { return { ok: true, result: env.ctx.sinkRead_(Object.assign({ v: 1, action: 'read', code: env.codes.owner, table: 'area' }, over)) }; }
  catch (e) { return env.ctx.errorBody_(e); }
}
function addVis(env, lines) { const f = env.file('BLD-field_visibility.csv')[0]; f.content = f.content.replace(/\r?\n?$/, '\r\n') + lines.join('\r\n') + '\r\n'; }

test('microchip and the colour lists: nothing until Lisa adds rows; owner rows let the owner read, never staff', () => {
  const env = standardEnv({ props: { READ_ENABLED: 'true' } });
  env.addFile('BLD-microchip.csv', ['id,tenant_id,subject_id,chip_number', `mc-1,${fx.TENANT},sub-test-a,000000000000001`].join('\r\n') + '\r\n');
  env.addFile('BLD-coat_colour.csv', ['id,name,base_family,swatch_hex,nose_pigment_applies', 'cc-1,Red,red,#aa3300,yes'].join('\r\n') + '\r\n');
  env.addFile('BLD-coat_pattern.csv', ['id,name', 'cp-1,Solid'].join('\r\n') + '\r\n');
  env.addFile('BLD-nose_pigment.csv', ['id,name,code,swatch_hex', 'np-1,Black,B,#000000'].join('\r\n') + '\r\n');
  ['microchip', 'coat_colour', 'coat_pattern', 'nose_pigment'].forEach((t) => assert.equal(read(env, { table: t }).code, 'NOT_ALLOWED', t));
  addVis(env, ['*', 'id', 'subject_id', 'chip_number'].map((f) => fv('microchip', f, 'aud-admin')));
  addVis(env, ['*', 'id', 'name'].map((f) => fv('coat_colour', f, 'aud-admin')));
  addVis(env, ['*', 'id', 'name'].map((f) => fv('coat_pattern', f, 'aud-admin')));
  addVis(env, ['*', 'id', 'name'].map((f) => fv('nose_pigment', f, 'aud-admin')));
  const mc = read(env, { table: 'microchip' });
  assert.equal(mc.ok, true, JSON.stringify(mc)); assert.equal(mc.result.rows[0].chip_number, '000000000000001');
  assert.equal(read(env, { table: 'coat_colour' }).result.rows[0].name, 'Red');
  assert.equal(read(env, { table: 'coat_colour' }).result.fields.includes('swatch_hex'), false);
  assert.equal(read(env, { table: 'coat_pattern' }).ok, true);
  assert.equal(read(env, { table: 'nose_pigment' }).ok, true);
  assert.equal(read(env, { table: 'microchip', code: env.codes.staff }).code, 'NOT_ALLOWED');
});
