'use strict';
/**
 * 8 Nov 2026: visitor (GUEST) codes, the camera fields on a reading, and the rows-based staff checks.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const GUEST_HEADER = ['id', 'tenant_id', 'area_id', 'min_c', 'max_c', 'spot_c', 'precision_dp', 'period_start', 'taken_at', 'taken_by', 'read_method', 'camera_value_changed', 'note'];
const TYPE_HEADER = ['id', 'tenant_id', 'type_key', 'label', 'target', 'asks_item', 'asks_amount', 'amount_unit', 'frequency', 'active', 'effective_from', 'source', 'note', 'set_at', 'set_by'];
const LOG_HEADER = ['id', 'tenant_id', 'check_type_id', 'area_id', 'subject_id', 'item', 'amount', 'outcome', 'happened_at', 'note', 'taken_at', 'taken_by', 'corrects_id'];

const env0 = () => {
  const env = standardEnv({ props: { TABLE_ON_guest_reading: 'true', TABLE_ON_check_type: 'true', TABLE_ON_check_log: 'true', READ_ENABLED: 'true' } });
  env.addFile('BLD-guest_reading.csv', fx.headerOnly(GUEST_HEADER));
  env.addFile('BLD-check_type.csv', fx.headerOnly(TYPE_HEADER));
  env.addFile('BLD-check_log.csv', fx.headerOnly(LOG_HEADER));
  env.guest = env.ctx.adminAddGuestCode();
  return env;
};
const recs = (env, title) => { const f = env.file(title)[0];
  const [h, ...rows] = env.ctx.csvParse_(f.content).filter((r) => !(r.length === 1 && r[0] === '')); return rows.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i] || '']))); };
const area = (env) => recs(env, 'BLD-area.csv')[0].id;
const dog = (env) => recs(env, 'BLD-subject.csv')[0].id;
const reading = (env, code, table, extra) => save(env, req(env, { code, table, fields: Object.assign({ area_id: area(env), min_c: '14.0', max_c: '20.5' }, extra || {}) }));
const addType = (env, key, extra) => { const r = save(env, req(env, { code: env.codes.owner, table: 'check_type',
  fields: Object.assign({ type_key: key, label: key, target: 'dog', effective_from: '2026-01-01' }, extra || {}) })); assert.equal(r.ok, true, JSON.stringify(r)); return r.result.id; };

test('guest: a visitor code saves to the guest list, marked as the guest, and not to the staff log', () => {
  const env = env0();
  const r = reading(env, env.guest, 'guest_reading', { read_method: 'typed' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const [row] = recs(env, 'BLD-guest_reading.csv');
  assert.match(row.taken_by, /^Guest - Example visit \(sc-[a-z0-9]{6}\)$/);
  assert.equal(recs(env, 'BLD-area_reading.csv').length, 0);
});

test('guest: refused on every other table, including the staff temperature log', () => {
  const env = env0();
  assert.equal(reading(env, env.guest, 'area_reading').code, 'NOT_ALLOWED');
  const occ = save(env, req(env, { code: env.guest, table: 'occupancy', fields: { subject_id: dog(env), area_id: area(env) } }));
  assert.equal(occ.ok, false);
  const typeId = addType(env, 'feeding');
  assert.equal(save(env, req(env, { code: env.guest, table: 'check_log', fields: { check_type_id: typeId, outcome: 'ok' } })).code, 'NOT_ALLOWED');
  assert.equal(recs(env, 'BLD-check_log.csv').length, 0);
});

test('guest: staff cannot use the guest list', () => {
  const env = env0();
  assert.equal(reading(env, env.codes.staff, 'guest_reading').code, 'NOT_ALLOWED');
});

test('guest: a guest reading and a staff reading for the same room both save; neither blocks the other', () => {
  const env = env0();
  assert.equal(reading(env, env.guest, 'guest_reading').ok, true);
  const staff = reading(env, env.codes.staff, 'area_reading');
  assert.equal(staff.ok, true, JSON.stringify(staff));
  assert.equal(recs(env, 'BLD-area_reading.csv').length, 1);
  assert.equal(recs(env, 'BLD-guest_reading.csv').length, 1);
});

test('guest: cannot read any list, even with a person permission row for its id', () => {
  const env = env0();
  const id = JSON.stringify(env.ctx.sinkStaffList_().filter((p) => p.role === 'GUEST')[0].id).replace(/"/g, '');
  const vis = env.file('BLD-field_visibility.csv')[0];
  vis.content += `v-x,${fx.TENANT},area,id,person:${id},yes,,\r\n`;
  assert.throws(() => env.ctx.sinkRead_({ code: env.guest, table: 'area' }), (e) => e.code === 'NOT_ALLOWED');
  assert.throws(() => env.ctx.sinkRead_({ code: env.guest, table: 'subject' }), (e) => e.code === 'NOT_ALLOWED');
});

test('guest: the code ends by itself after 7 days', () => {
  const env = env0();
  env.nowMs += 7 * 86400000 - 60000;
  assert.equal(reading(env, env.guest, 'guest_reading').ok, true);
  env.nowMs += 120000;
  assert.equal(reading(env, env.guest, 'guest_reading', { min_c: '15.0' }).code, 'CODE_EXPIRED');
  const p = env.ctx.sinkStaffList_().filter((x) => x.role === 'GUEST')[0];
  assert.equal(p.active, false);
  assert.match(p.revoked_at, /^ended /);
});

test('guest: a code with no end date is refused; the owner can switch one off early', () => {
  const env = env0();
  const p = env.ctx.sinkStaffList_().filter((x) => x.role === 'GUEST')[0];
  assert.equal(p.active, true);
  assert.match(p.who, /\(ends /);
  env.ctx.sinkRevokeCode_(p.id, 'owner@example.test');
  assert.equal(reading(env, env.guest, 'guest_reading').code, 'BAD_CODE');
  const env2 = env0();
  const reg = JSON.parse(env2.props.STAFF_REGISTRY);
  Object.keys(reg).forEach((h) => { if (reg[h].role === 'GUEST') delete reg[h].expires_at; });
  env2.props.STAFF_REGISTRY = JSON.stringify(reg);
  assert.equal(reading(env2, env2.guest, 'guest_reading').code, 'CODE_EXPIRED');
});

test('guest: the ordinary add-a-code tool cannot make a GUEST code', () => {
  const env = env0();
  assert.equal(env.ctx.ROLE_ALL.indexOf('GUEST'), -1);
});

test('area_reading: stores how it was read and whether the camera number was changed', () => {
  const env = env0();
  assert.equal(reading(env, env.codes.staff, 'area_reading', { read_method: 'camera', camera_value_changed: 'yes' }).ok, true);
  const [row] = recs(env, 'BLD-area_reading.csv');
  assert.equal(row.read_method, 'camera');
  assert.equal(row.camera_value_changed, 'true');
});

test('area_reading: refuses a changed flag on a typed reading and an unknown method', () => {
  const env = env0();
  assert.equal(reading(env, env.codes.staff, 'area_reading', { read_method: 'typed', camera_value_changed: 'true' }).code, 'INVALID');
  assert.equal(reading(env, env.codes.staff, 'area_reading', { read_method: 'guess' }).code, 'INVALID');
});

test('checks: the owner adds a check type as a row; staff cannot', () => {
  const env = env0();
  addType(env, 'medicine', { asks_item: 'true', asks_amount: 'true' });
  assert.equal(recs(env, 'BLD-check_type.csv')[0].asks_item, 'true');
  const r = save(env, req(env, { code: env.codes.staff, table: 'check_type', fields: { type_key: 'cleaning', label: 'Cleaning', target: 'area', effective_from: '2026-01-01' } }));
  assert.equal(r.code, 'NOT_ALLOWED');
});

test('checks: a change is a new row from a later date; a bad key is refused', () => {
  const env = env0();
  addType(env, 'feeding');
  addType(env, 'feeding', { effective_from: '2026-06-01', active: 'false' });
  const back = save(env, req(env, { code: env.codes.owner, table: 'check_type', fields: { type_key: 'feeding', label: 'x', target: 'dog', effective_from: '2026-03-01' } }));
  assert.equal(back.code, 'INVALID');
  const bad = save(env, req(env, { code: env.codes.owner, table: 'check_type', fields: { type_key: 'Feed ing', label: 'x', target: 'dog', effective_from: '2026-03-01' } }));
  assert.equal(bad.code, 'INVALID');
});

test('checks: a staff record saves against a type, stamped with who and when', () => {
  const env = env0();
  const typeId = addType(env, 'medicine');
  const r = save(env, req(env, { code: env.codes.staff, table: 'check_log', fields: { check_type_id: typeId, subject_id: dog(env), item: 'Wormer', amount: '1 tablet', outcome: 'ok' } }));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.result.at);
  const [row] = recs(env, 'BLD-check_log.csv');
  assert.equal(row.check_type_id, typeId);
  assert.equal(row.taken_by, 'Sam Staff');
});

test('checks: an unknown type is refused; a concern needs a note; a repeat tap is refused', () => {
  const env = env0();
  const typeId = addType(env, 'feeding');
  const send = (f) => save(env, req(env, { code: env.codes.staff, table: 'check_log', fields: f }));
  assert.equal(send({ check_type_id: 'cty-nope', outcome: 'ok' }).code, 'INVALID');
  assert.equal(send({ check_type_id: typeId, outcome: 'concern' }).code, 'INVALID');
  assert.equal(send({ check_type_id: typeId, subject_id: dog(env), outcome: 'ok' }).ok, true);
  assert.equal(send({ check_type_id: typeId, subject_id: dog(env), outcome: 'ok' }).code, 'DUPLICATE');
});

test('new tables are off until their own switch is on', () => {
  const env = standardEnv();
  env.addFile('BLD-check_type.csv', fx.headerOnly(TYPE_HEADER));
  const r = save(env, req(env, { code: env.codes.owner, table: 'check_type', fields: { type_key: 'feeding', label: 'x', target: 'dog', effective_from: '2026-01-01' } }));
  assert.equal(r.code, 'TABLE_OFF');
});
