'use strict';
/**
 * 11 Nov 2026, for the temperature round (PR 381): the owner's sensor days, the temperature limit rows staff read,
 * and the read filter {area_id, from, to} that only ever narrows a read.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const SENSOR_HEADER = ['id', 'tenant_id', 'area_id', 'day', 'min_c', 'max_c', 'samples', 'source', 'device_label', 'taken_at', 'taken_by'];
const BAND_HEADER = ['id', 'tenant_id', 'band', 'age_from_days', 'age_to_days', 'min_temp', 'max_temp', 'area_id', 'basis'];
const fv = (table, field, aud, cond = '') => `fv-x,${fx.TENANT},${table},${field},${aud},yes,${cond},,t,2026-11-11,t`;

const env0 = (props) => {
  const env = standardEnv({ props: Object.assign({ TABLE_ON_sensor_reading: 'true', READ_ENABLED: 'true' }, props || {}) });
  env.addFile('BLD-sensor_reading.csv', fx.headerOnly(SENSOR_HEADER));
  env.addFile('BLD-temperature_band.csv', [BAND_HEADER.join(','),
    `tb-1,${fx.TENANT},adult,57,,10,26,,Welsh guidance s1.4`, `tb-2,${fx.TENANT},pups,0,28,26,28,,Welsh guidance s1.4`].join('\r\n') + '\r\n');
  return env;
};
const recs = (env, title) => { const f = env.file(title)[0];
  const [h, ...rows] = env.ctx.csvParse_(f.content).filter((r) => !(r.length === 1 && r[0] === '')); return rows.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i] || '']))); };
const areas = (env) => recs(env, 'BLD-area.csv').map((r) => r.id);
const day = (env, code, extra) => save(env, req(env, { code, table: 'sensor_reading',
  fields: Object.assign({ area_id: areas(env)[0], day: '2026-07-01', min_c: '14.0', max_c: '27.9', samples: '1440', source: 'govee', device_label: 'H5075 shed' }, extra || {}) }));
function read(env, over) {
  try { return { ok: true, result: env.ctx.sinkRead_(Object.assign({ v: 1, action: 'read', code: env.codes.staff, table: 'area' }, over)) }; }
  catch (e) { return env.ctx.errorBody_(e); }
}
function addVis(env, lines) { const f = env.file('BLD-field_visibility.csv')[0]; f.content = f.content.replace(/\r?\n?$/, '\r\n') + lines.join('\r\n') + '\r\n'; }

test('sensor_reading: the owner saves one room-day straight in, at 1 dp, stamped with who and when', () => {
  const env = env0();
  const r = day(env, env.codes.owner);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.status, 'saved');
  const [row] = recs(env, 'BLD-sensor_reading.csv');
  assert.equal(row.min_c, '14.0'); assert.equal(row.max_c, '27.9'); assert.equal(row.samples, '1440');
  assert.equal(row.source, 'govee'); assert.ok(row.taken_at); assert.ok(row.taken_by);
  assert.equal(recs(env, 'BLD-area_reading.csv').length, 0);              // never touches the staff log
});

test('sensor_reading: the same room, day and source twice is a repeat; another day or source saves', () => {
  const env = env0();
  assert.equal(day(env, env.codes.owner).ok, true);
  assert.equal(day(env, env.codes.owner).code, 'DUPLICATE');
  assert.equal(day(env, env.codes.owner, { day: '2026-07-02' }).ok, true);
  assert.equal(day(env, env.codes.owner, { source: 'other' }).ok, true);
  assert.equal(recs(env, 'BLD-sensor_reading.csv').length, 3);
});

test('sensor_reading: staff and guests cannot add; bad values are refused; switch off refuses', () => {
  const env = env0();
  assert.equal(day(env, env.codes.staff).code, 'NOT_ALLOWED');
  assert.equal(day(env, env.codes.owner, { samples: 'lots' }).code, 'INVALID');
  assert.equal(day(env, env.codes.owner, { day: '2026-02-30' }).code, 'INVALID');
  assert.equal(day(env, env.codes.owner, { min_c: '30.0' }).code, 'INVALID');
  assert.equal(recs(env, 'BLD-sensor_reading.csv').length, 0);
  const off = env0({ TABLE_ON_sensor_reading: 'false' });
  assert.notEqual(day(off, off.codes.owner).ok, true);
});

test('temperature_band: staff read the limit rows only when a visibility row allows it', () => {
  const env = env0();
  assert.equal(read(env, { table: 'temperature_band' }).code, 'NOT_ALLOWED');                 // default deny
  addVis(env, ['id', 'band', 'age_from_days', 'age_to_days', 'min_temp', 'max_temp', 'area_id'].map((f) => fv('temperature_band', f, 'aud-staff')).concat(fv('temperature_band', '*', 'aud-staff')));
  const r = read(env, { table: 'temperature_band' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.count, 2);
  assert.equal(r.result.fields.includes('basis'), false);
  assert.equal(read(env, { table: 'temperature_band', code: env.ctx.adminAddGuestCode() }).code, 'NOT_ALLOWED');   // guests: rooms only
});

test('read filter: area_id and London days narrow the rows; it never widens them', () => {
  const env = env0();
  const [a1, a2] = areas(env);
  addVis(env, ['id', 'area_id', 'day', 'min_c', 'max_c', 'taken_at'].map((f) => fv('sensor_reading', f, 'aud-admin')).concat(fv('sensor_reading', '*', 'aud-admin')));
  const rows = [
    `snr-1,${fx.TENANT},${a1},2026-07-01,14.0,22.0,10,govee,,2026-07-02T08:00:00+01:00,o`,
    `snr-2,${fx.TENANT},${a2},2026-07-01,14.0,22.0,10,govee,,2026-07-02T08:00:00+01:00,o`,
    `snr-3,${fx.TENANT},${a1},2026-07-02,14.0,22.0,10,govee,,2026-07-03T00:30:00+01:00,o`
  ];
  env.file('BLD-sensor_reading.csv')[0].content = [SENSOR_HEADER.join(',')].concat(rows).join('\r\n') + '\r\n';
  const own = { table: 'sensor_reading', code: env.codes.owner };
  assert.equal(read(env, own).result.count, 3);
  assert.deepEqual(Array.from(read(env, Object.assign({ filter: { area_id: a1 } }, own)).result.rows).map((r) => r.id), ['snr-1', 'snr-3']);
  assert.deepEqual(Array.from(read(env, Object.assign({ filter: { area_id: a1, from: '2026-07-03', to: '2026-07-03' } }, own)).result.rows).map((r) => r.id), ['snr-3']);   // 00:30 London is the 3rd
  assert.deepEqual(Array.from(read(env, Object.assign({ filter: { to: '2026-07-02' } }, own)).result.rows).map((r) => r.id), ['snr-1', 'snr-2']);
  ['x', { area_id: 'a b' }, { from: '2026-13-01' }, { from: '2026-07-03', to: '2026-07-01' }, { colour: 'red' }].forEach((f) => {
    assert.equal(read(env, Object.assign({ filter: f }, own)).code, 'BAD_FILTER', JSON.stringify(f));
  });
  assert.equal(read(env, { table: 'sensor_reading', filter: { area_id: a1 } }).code, 'NOT_ALLOWED');   // staff: a filter opens nothing
  assert.equal(read(env, { table: 'area', filter: { from: '2026-07-01' } }).code, 'BAD_FILTER');        // no date column to filter on
});

// ---- thermometers (NEW: TEMPS, 11 Nov 2026): one per place; the count is rows, not code
const THM_HEADER = ['id', 'tenant_id', 'name', 'area_id', 'active', 'made_at', 'made_by'];
const thmEnv = (props) => {
  const env = env0(Object.assign({ TABLE_ON_thermometer: 'true', TABLE_ON_qr_tag: 'true', OWNER_EDIT_ENABLED: 'true' }, props || {}));
  env.addFile('BLD-thermometer.csv', fx.headerOnly(THM_HEADER));
  env.addFile('BLD-qr_tag.csv', fx.headerOnly(['id', 'tenant_id', 'tag', 'kind', 'ref_id', 'active', 'made_at', 'made_by']));
  return env;
};
const thm = (env, code, fields) => save(env, req(env, { code, table: 'thermometer', fields: Object.assign({ name: 'T1', area_id: areas(env)[0] }, fields || {}) }));

test('thermometer: the owner adds one straight in, stamped active; the same name twice is a repeat; staff and guests cannot add', () => {
  const env = thmEnv();
  const r = thm(env, env.codes.owner);
  assert.equal(r.ok, true); assert.match(r.result.id, /^thm-/);
  const [row] = recs(env, 'BLD-thermometer.csv');
  assert.equal(row.active, 'true'); assert.ok(row.made_at && row.made_by);
  assert.equal(thm(env, env.codes.owner).code, 'DUPLICATE');
  assert.equal(thm(env, env.codes.owner, { name: 'Corridor 1', area_id: areas(env)[1] }).ok, true);
  assert.equal(thm(env, env.codes.staff, { name: 'T9' }).code, 'NOT_ALLOWED');
  assert.equal(thm(env, env.ctx.adminAddGuestCode(), { name: 'T8' }).code, 'NOT_ALLOWED');
  assert.equal(thm(env, env.codes.owner, { name: 'T7', area_id: 'area-nope' }).ok, false);   // the room must exist
  assert.equal(recs(env, 'BLD-thermometer.csv').length, 2);
  const off = thmEnv({ TABLE_ON_thermometer: 'false' });
  assert.equal(thm(off, off.codes.owner).code, 'TABLE_OFF');
});

test('thermometer: a QR tag of kind thermometer can be made; the owner edit renames, moves or retires one in place', () => {
  const env = thmEnv();
  const id = thm(env, env.codes.owner).result.id;
  assert.equal(save(env, req(env, { code: env.codes.owner, table: 'qr_tag', fields: { tag: 'THERMO23', kind: 'thermometer', ref_id: id } })).ok, true);
  env.email = 'owner@example.test';
  const r = env.ctx.ui_edit('thermometer', id, { name: 'Hall', area_id: areas(env)[1], active: 'false' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const [row] = recs(env, 'BLD-thermometer.csv');
  assert.equal(row.name, 'Hall'); assert.equal(row.area_id, areas(env)[1]); assert.equal(row.active, 'false');
  assert.equal(recs(env, 'BLD-thermometer.csv').length, 1);
  assert.equal(save(env, req(env, { code: env.codes.owner, table: 'thermometer', action: 'correct', corrects_id: id, reason: 'renamed', fields: { name: 'X', area_id: areas(env)[0] } })).ok, false);   // fixed by the owner edit, not the queue
});

test('thermometer: staff and owner can read the list when Lisa allows it; guests never', () => {
  const env = thmEnv();
  thm(env, env.codes.owner);
  assert.equal(read(env, { table: 'thermometer' }).code, 'NOT_ALLOWED');   // default-deny until the visibility rows exist
  addVis(env, ['*', 'id', 'name', 'area_id', 'active'].map((f) => fv('thermometer', f, 'aud-staff')));
  const r = read(env, { table: 'thermometer' });
  assert.equal(r.ok, true); assert.equal(r.result.count, 1);
  assert.equal(r.result.fields.includes('made_by'), false);
  assert.equal(read(env, { table: 'thermometer', code: env.ctx.adminAddGuestCode() }).code, 'NOT_ALLOWED');
});
