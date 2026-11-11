'use strict';
/**
 * 11 Nov 2026, Lisa: "empty just means no dog present - they may be moving in later so reading the temp";
 * "empty rows marked because room was empty don't count as non compliant issues". Room empty is a flag on the slot's
 * area_reading row: the reading is optional then (both min and max, or neither), and the save never sets in_range or
 * compliant. Without the flag a reading still needs both numbers.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const NOW = Date.UTC(2026, 10, 12, 10, 0, 0);   // 12 Nov 2026
const env1 = (props) => standardEnv({ nowMs: NOW, props: props || {} });

const send = (env, fields) => save(env, req(env, { code: env.codes.staff, fields: Object.assign({ area_id: 'area-t1', period_start: '2026-11-11T08:00:00Z' }, fields) }));
const rows = (env) => {
  const lines = env.text('BLD-area_reading.csv').split(/\r?\n/).filter(Boolean);
  const h = env.ctx.csvParse_(lines[0])[0];
  return lines.slice(1).map((l) => { const v = env.ctx.csvParse_(l)[0]; const o = {}; h.forEach((c, i) => { o[c] = v[i]; }); return o; });
};

test('room_empty is the last column of the area_reading header', () => {
  const env = env1();
  const cols = Array.from(env.ctx.TABLES.area_reading.columns);
  assert.equal(cols[cols.length - 1], 'room_empty');
  assert.deepEqual(cols, fx.AREA_READING_HEADER);
});

test('room empty with no reading saves: no numbers, no range, in_range and compliant blank', () => {
  const env = env1();
  const r = send(env, { room_empty: 'yes' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const [row] = rows(env);
  assert.equal(row.room_empty, 'yes');
  assert.equal(row.min_c, ''); assert.equal(row.max_c, ''); assert.equal(row[''], '');
  assert.equal(row.in_range, ''); assert.equal(row.compliant, '');
  assert.ok(row.taken_at && row.taken_by);
});

test('room empty with a reading saves the reading too, still never judged', () => {
  const env = env1();
  assert.equal(send(env, { room_empty: 'yes', min_c: '30.0', max_c: '35.0' }).ok, true);
  const [row] = rows(env);
  assert.equal(row.min_c, '30.0'); assert.equal(row.max_c, '35.0'); assert.equal(row[''], '5.0');
  assert.equal(row.in_range, ''); assert.equal(row.compliant, '');
});

test('room empty: both numbers or neither; low above high is still refused', () => {
  const env = env1();
  const one = send(env, { room_empty: 'yes', min_c: '18.0' });
  assert.equal(one.code, 'INVALID'); assert.match(one.fields.max_c, /both/);
  assert.equal(send(env, { room_empty: 'yes', max_c: '18.0' }).fields.min_c.includes('both'), true);
  assert.equal(send(env, { room_empty: 'yes', min_c: '22.0', max_c: '18.0' }).code, 'INVALID');
  assert.equal(rows(env).length, 0);
});

test('without room empty, both numbers are still needed; room_empty takes only yes or blank', () => {
  const env = env1();
  const r = send(env, {});
  assert.equal(r.code, 'INVALID'); assert.equal(r.fields.min_c, 'This is needed.'); assert.equal(r.fields.max_c, 'This is needed.');
  assert.equal(send(env, { min_c: '18.0' }).fields.max_c, 'This is needed.');
  assert.equal(send(env, { room_empty: 'no' }).code, 'INVALID');
  assert.equal(send(env, { room_empty: '', min_c: '18.0', max_c: '22.0' }).ok, true);
  assert.equal(rows(env)[0].room_empty, '');
});

test('a guest reading has no room_empty: a guest cannot mark a room empty', () => {
  const env = env1({ TABLE_ON_guest_reading: 'true' });
  env.addFile('BLD-guest_reading.csv', fx.headerOnly(['id', 'tenant_id', 'area_id', 'min_c', 'max_c', 'spot_c', 'precision_dp', 'period_start', 'taken_at', 'taken_by', 'read_method', 'camera_value_changed', 'mitigation_note', 'note']));
  const g = save(env, req(env, { code: env.ctx.adminAddGuestCode(), table: 'guest_reading', fields: { area_id: 'area-t1', room_empty: 'yes' } }));
  assert.equal(g.ok, false);
});
