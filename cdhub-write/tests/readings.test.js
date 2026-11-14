'use strict';
// 14 Nov 2026: one readings record (Lisa READINGS = B). Item test steps (PAT) are readings rows. Invented rows only.
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const R_H = ['id', 'tenant_id', 'kind_id', 'area_id', 'item_id', 'subject_id', 'check_log_id', 'value_min', 'value_max', 'value',
  'unit_id', 'precision_dp', 'period_start', 'taken_at', 'taken_by', 'source', 'how_entered', 'read_method', 'samples',
  'device_label', 'area_empty', 'limit_id', 'in_range', 'corrects_id', 'note', 'mitigation_note', 'sign_in_id',
  'import_batch_id', 'camera_value_changed', 'reset_after_reading', 'set_by', 'created_at', 'updated_at'];
const NOW = Date.UTC(2026, 10, 14, 10, 0, 0);

function env0(props) {
  const env = standardEnv({ nowMs: NOW, props: Object.assign({ TABLE_ON_readings: 'true' }, props || {}) });
  const t = env.props.TENANT_ID;
  env.addFile('BLD-readings.csv', fx.headerOnly(R_H));
  env.addFile('BLD-reading_kinds.csv', `id,tenant_id,kind_key,label,unit_id,value_shape,precision_dp,source,set_by,set_on\r\nrk-earth,${t},earth_bond,Earth bond,ohm,single,2,test,,\r\nrk-ins,${t},insulation,Insulation,megohm,single,1,test,,\r\n`);
  env.addFile('BLD-reading_limits.csv', `id,tenant_id,kind_id,scope_table,scope_id,low,high,label,from_date,to_date,source,set_by,set_on\r\nrl-earth,${t},rk-earth,,,,0.1,,2025-01-01,,test,,\r\nrl-ins,${t},rk-ins,,,1,,,2025-01-01,,test,,\r\nrl-old,${t},rk-earth,,,,0.5,,2020-01-01,2024-12-31,test,,\r\n`);
  env.addFile('BLD-items.csv', `id,tenant_id,item_no,name\r\nitm-1,${t},01,Kettle\r\nitm-2,${t},02,Lamp\r\n`);
  env.addFile('BLD-check_log.csv', `id,tenant_id,check_type_id,item_id\r\nclg-1,${t},ct-pat,itm-1\r\n`);
  return env;
}
const add = (env, fields, code) => save(env, req(env, { code: code || env.codes.staff, table: 'readings', fields }));
const recs = (env) => { const f = env.file('BLD-readings.csv')[0];
  const [h, ...rows] = env.ctx.csvParse_(f.content).filter((r) => !(r.length === 1 && r[0] === '')); return rows.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i] || '']))); };
const step = (extra) => Object.assign({ kind_id: 'rk-earth', item_id: 'itm-1', check_log_id: 'clg-1', value: '0.05', limit_id: 'rl-earth', taken_at: '2026-11-14T09:30:00+00:00', how_entered: 'typed', source: 'staff' }, extra || {});

test('readings: off until its switch; a PAT step saves with the kind\'s unit, UTC time and in_range worked out here', () => {
  assert.equal(add(env0({ TABLE_ON_readings: '' }), step()).ok, false);
  const env = env0();
  const r = add(env, step({ in_range: 'false' }));   // the page's in_range is ignored
  assert.equal(r.ok, true, JSON.stringify(r));
  const row = recs(env)[0];
  assert.equal(row.unit_id, 'ohm');
  assert.equal(row.in_range, 'true');
  assert.equal(row.taken_at, '2026-11-14T09:30:00Z');
  assert.match(row.created_at, /Z$/);
  assert.equal(row.item_id, 'itm-1');
});

test('readings: out of limit is saved (evidence), never refused; one-sided limits; a resend is a DUPLICATE', () => {
  const env = env0();
  const hi = add(env, step({ value: '0.4' }));
  assert.equal(hi.ok, true, JSON.stringify(hi));
  assert.equal(recs(env)[0].in_range, 'false');
  assert.equal(add(env, step({ kind_id: 'rk-ins', value: '0.5', limit_id: 'rl-ins' })).ok, true);
  assert.equal(recs(env)[1].in_range, 'false');
  assert.equal(add(env, step({ value: '0.4' })).code, 'DUPLICATE');
});

test('readings: wrong unit, wrong limit kind, limit not in force, test on another item, not a number: refused', () => {
  const env = env0();
  assert.equal(add(env, step({ unit_id: 'megohm' })).code, 'INVALID');
  assert.equal(add(env, step({ limit_id: 'rl-ins' })).code, 'INVALID');
  assert.equal(add(env, step({ limit_id: 'rl-old' })).code, 'INVALID');
  assert.equal(add(env, step({ item_id: 'itm-2' })).code, 'INVALID');
  assert.equal(add(env, step({ value: '1,2' })).code, 'INVALID');
  assert.equal(add(env, step({ value: '' })).code, 'INVALID');
  assert.equal(recs(env).length, 0);
});
