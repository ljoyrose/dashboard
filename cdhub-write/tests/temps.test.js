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

// ---- thermometers (NEW: TEMPS, 11 Nov 2026): one per place; the count is rows, not code. A thing carries no dates
// (Lisa 11 Nov 2026, "A standard"): when one is needed is BLD-requirement rows.
const THM_HEADER = ['id', 'tenant_id', 'name', 'area_id', 'made_at', 'made_by'];
const REQ_HEADER = ['id', 'tenant_id', 'need_type', 'target_table', 'target_id', 'from_date', 'to_date', 'source', 'set_by', 'set_on'];
const thmEnv = (props) => {
  const env = env0(Object.assign({ TABLE_ON_thermometer: 'true', TABLE_ON_qr_tag: 'true', TABLE_ON_requirement: 'true', OWNER_EDIT_ENABLED: 'true' }, props || {}));
  env.addFile('BLD-thermometer.csv', fx.headerOnly(THM_HEADER));
  env.addFile('BLD-requirement.csv', fx.headerOnly(REQ_HEADER));
  env.addFile('BLD-qr_tag.csv', fx.headerOnly(['id', 'tenant_id', 'tag', 'kind', 'ref_id', 'active', 'made_at', 'made_by']));
  return env;
};
const thm = (env, code, fields) => save(env, req(env, { code, table: 'thermometer', fields: Object.assign({ name: 'T1', area_id: areas(env)[0] }, fields || {}) }));
const need = (env, code, fields) => save(env, req(env, { code, table: 'requirement', fields: Object.assign({ need_type: 'reading.temperature', target_table: 'thermometer', target_id: 'thm-1', from_date: '2026-11-01' }, fields || {}) }));
const R = (type, table, id, from, to) => ({ need_type: type, target_table: table, target_id: id, from_date: from, to_date: to || '' });

test('thermometer: the owner adds one straight in, with no dates and no active column; the same name twice is a repeat; staff and guests cannot add', () => {
  const env = thmEnv();
  const r = thm(env, env.codes.owner);
  assert.equal(r.ok, true); assert.match(r.result.id, /^thm-/);
  const [row] = recs(env, 'BLD-thermometer.csv');
  assert.deepEqual(Object.keys(row), THM_HEADER); assert.ok(row.made_at && row.made_by);
  assert.equal(thm(env, env.codes.owner).code, 'DUPLICATE');
  assert.equal(thm(env, env.codes.owner, { name: 'Corridor 1', area_id: areas(env)[1] }).ok, true);
  assert.equal(thm(env, env.codes.staff, { name: 'T9' }).code, 'NOT_ALLOWED');
  assert.equal(thm(env, env.ctx.adminAddGuestCode(), { name: 'T8' }).code, 'NOT_ALLOWED');
  assert.equal(thm(env, env.codes.owner, { name: 'T7', area_id: 'area-nope' }).ok, false);   // the room must exist
  assert.equal(recs(env, 'BLD-thermometer.csv').length, 2);
  const off = thmEnv({ TABLE_ON_thermometer: 'false' });
  assert.equal(thm(off, off.codes.owner).code, 'TABLE_OFF');
});

test('thermometer: a QR tag of kind thermometer can be made; the owner edit renames or moves one in place', () => {
  const env = thmEnv();
  const id = thm(env, env.codes.owner).result.id;
  assert.equal(save(env, req(env, { code: env.codes.owner, table: 'qr_tag', fields: { tag: 'THERMO23', kind: 'thermometer', ref_id: id } })).ok, true);
  env.email = 'owner@example.test';
  const r = env.ctx.ui_edit('thermometer', id, { name: 'Hall', area_id: areas(env)[1] });
  assert.equal(r.ok, true, JSON.stringify(r));
  const [row] = recs(env, 'BLD-thermometer.csv');
  assert.equal(row.name, 'Hall'); assert.equal(row.area_id, areas(env)[1]);
  assert.equal(recs(env, 'BLD-thermometer.csv').length, 1);
  assert.equal(save(env, req(env, { code: env.codes.owner, table: 'thermometer', action: 'correct', corrects_id: id, reason: 'renamed', fields: { name: 'X', area_id: areas(env)[0] } })).ok, false);   // fixed by the owner edit, not the queue
});

test('thermometer: staff and owner can read the list when Lisa allows it; guests never', () => {
  const env = thmEnv();
  thm(env, env.codes.owner);
  assert.equal(read(env, { table: 'thermometer' }).code, 'NOT_ALLOWED');   // default-deny until the visibility rows exist
  addVis(env, ['*', 'id', 'name', 'area_id'].map((f) => fv('thermometer', f, 'aud-staff')));
  const r = read(env, { table: 'thermometer' });
  assert.equal(r.ok, true); assert.equal(r.result.count, 1);
  assert.equal(r.result.fields.includes('made_by'), false);
  assert.equal(read(env, { table: 'thermometer', code: env.ctx.adminAddGuestCode() }).code, 'NOT_ALLOWED');
});

test('requirement: the owner adds a need row straight in; From is required, an end before the start is refused; staff and guests cannot add', () => {
  const env = thmEnv();
  const r = need(env, env.codes.owner, { to_date: '2026-11-11', source: 'Lisa 11 Nov' });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.match(r.result.id, /^req-/);
  const [row] = recs(env, 'BLD-requirement.csv');
  assert.deepEqual(Object.keys(row), REQ_HEADER);
  assert.equal(row.to_date, '2026-11-11'); assert.ok(row.set_by && row.set_on);
  assert.equal(need(env, env.codes.owner, { to_date: '2026-11-11' }).code, 'DUPLICATE');   // same need, same target, same From
  assert.equal(need(env, env.codes.owner, { from_date: '' }).ok, false);
  const bad = need(env, env.codes.owner, { from_date: '2026-11-11', to_date: '2026-11-10' });
  assert.equal(bad.ok, false); assert.match(bad.fields.to_date, /before the start/);
  assert.equal(need(env, env.codes.owner, { target_id: 'a b,c' }).ok, false);
  assert.equal(need(env, env.codes.staff, { from_date: '2026-11-02' }).code, 'NOT_ALLOWED');
  assert.equal(need(env, env.ctx.adminAddGuestCode(), { from_date: '2026-11-03' }).code, 'NOT_ALLOWED');
  const room = need(env, env.codes.owner, { need_type: 'room.in_use', target_table: 'area', target_id: areas(env)[0] });
  assert.equal(room.ok, true);
  env.email = 'owner@example.test';
  assert.equal(env.ctx.ui_edit('requirement', room.result.id, { to_date: '2026-11-11' }).ok, true);   // to end it, fill in its to_date
  assert.equal(env.ctx.ui_edit('requirement', room.result.id, { to_date: '2026-10-01' }).ok, false);
  assert.equal(recs(env, 'BLD-requirement.csv').length, 2);
  const off = thmEnv({ TABLE_ON_requirement: 'false' });
  assert.equal(need(off, off.codes.owner).code, 'TABLE_OFF');
});

test('requirement: staff read it through visibility rows; a guest may read it too (for the room list), only as far as the rows allow', () => {
  const env = thmEnv();
  need(env, env.codes.owner, { need_type: 'room.in_use', target_table: 'area', target_id: areas(env)[0], to_date: '2026-11-11' });
  assert.equal(read(env, { table: 'requirement' }).code, 'NOT_ALLOWED');
  const F = ['*', 'id', 'need_type', 'target_table', 'target_id', 'from_date', 'to_date'];
  addVis(env, F.map((f) => fv('requirement', f, 'aud-staff')));
  const r = read(env, { table: 'requirement' });
  assert.equal(r.ok, true); assert.equal(r.result.count, 1); assert.equal(r.result.fields.includes('set_by'), false);
  const g = env.ctx.adminAddGuestCode();
  assert.equal(read(env, { table: 'requirement', code: g }).code, 'NOT_ALLOWED');   // no guest rows yet
  addVis(env, F.map((f) => fv('requirement', f, 'aud-guest')));
  assert.equal(read(env, { table: 'requirement', code: g }).ok, true);
  assert.equal(read(env, { table: 'thermometer', code: g }).code, 'NOT_ALLOWED');   // still nothing else
});

test('BLDThermometer: the 2 extra thermometers are needed up to and including 11 Nov 2026, then not; one with no need rows is always needed', () => {
  const T = require('../../cdhub/staff/lib/thermometer.js');
  const extra = { id: 'thm-23', name: 'Extra A' }, kept = { id: 'thm-1', name: 'Hall' }, later = { id: 'thm-30', name: 'Corridor 2' };
  const req = [R('reading.temperature', 'thermometer', 'thm-23', '2026-11-01', '2026-11-11'), R('reading.temperature', 'thermometer', 'thm-30', '2026-12-01'),
    R('room.in_use', 'area', 'thm-1', '2020-01-01', '2020-01-02')];   // another need_type never ends a thermometer
  assert.equal(T.neededOn(extra, '2026-11-11', req), true);
  assert.equal(T.neededOn(extra, '2026-11-12', req), false);
  assert.equal(T.neededOn(extra, '2026-10-31', req), false);
  assert.equal(T.neededOn(kept, '2027-06-01', req), true);
  assert.equal(T.neededOn(later, '2026-11-30', req), false);
  assert.equal(T.neededOn(later, '2026-12-01', req), true);
  assert.equal(T.neededOn(kept, '', req), false);
  assert.equal(T.neededOn(kept, '2026-11-12'), true);   // no need rows read at all: needed
  const all = [extra, kept, later];
  assert.deepEqual(T.neededList(all, '2026-11-11', req).map((t) => t.id), ['thm-23', 'thm-1']);
  assert.deepEqual(T.neededList(all, '2026-11-12', req).map((t) => t.id), ['thm-1']);
});

test('compliance: a retired thermometer with no reading on 12 Nov is not flagged; a needed one with no reading is', () => {
  const T = require('../../cdhub/staff/lib/thermometer.js');
  const rows = [{ id: 'thm-23', name: 'Extra A', area_id: 'area-3a' }, { id: 'thm-1', name: 'Hall', area_id: 'area-h' }, { id: 'thm-2', name: 'Cabin', area_id: 'area-c' }];
  const req = [R('reading.temperature', 'thermometer', 'thm-23', '2026-11-01', '2026-11-11'), R('reading.temperature', 'thermometer', 'thm-1', '2026-11-01'), R('reading.temperature', 'thermometer', 'thm-2', '2026-11-01')];
  const readings = [{ area_id: 'area-c', taken_at: '2026-11-12T08:05:00+00:00' }, { area_id: 'area-3a', taken_at: '2026-11-11T08:00:00+00:00' }];
  assert.deepEqual(T.missingOn(rows, readings, '2026-11-12', req).map((t) => t.id), ['thm-1']);            // Extra A ended 11 Nov: no flag
  assert.deepEqual(T.missingOn(rows, readings, '2026-11-11', req).map((t) => t.id).sort(), ['thm-1', 'thm-2']);   // on 11 Nov Extra A had its reading
  assert.deepEqual(T.missingOn(rows, [], '2026-10-31', req), []);                                         // before any from_date: nothing to flag
  const late = [{ area_id: 'area-h', period_start: '2026-11-12T07:00:00Z', taken_at: '2026-11-20T09:00:00+00:00' }, { area_id: 'area-c', taken_at: '2026-11-12T08:00:00+00:00' }];
  assert.deepEqual(T.missingOn(rows, late, '2026-11-12', req), []);                                        // a reading typed in on the 20th for the 12th covers the 12th
  assert.deepEqual(T.missingOn(rows, late, '2026-11-20', req).map((t) => t.id).sort(), ['thm-1', 'thm-2']); // and not the day it was typed
  assert.deepEqual(T.missingOn(rows, [{ area_id: 'area-h', period_start: '2026-11-12T07:00:00Z', room_empty: 'yes' }, { area_id: 'area-c', taken_at: '2026-11-12T08:00:00+00:00' }], '2026-11-12', req), []);   // a Room empty row covers its slot
});

test('after a thermometer ends, a late reading for a day it was needed still saves (Lisa 11 Nov: late readings from photos)', () => {
  const T = require('../../cdhub/staff/lib/thermometer.js');
  const env = standardEnv({ nowMs: Date.UTC(2026, 10, 12, 10, 0, 0), props: { TABLE_ON_thermometer: 'true' } });   // today is 12 Nov
  env.addFile('BLD-thermometer.csv', fx.headerOnly(THM_HEADER));
  const a = areas(env)[0];
  const ended = { id: 'thm-23', name: 'Extra A', area_id: a };
  const need23 = [R('reading.temperature', 'thermometer', 'thm-23', '2026-11-01', '2026-11-11')];
  env.file('BLD-thermometer.csv')[0].content = [THM_HEADER.join(','), `thm-23,${fx.TENANT},Extra A,${a},2026-11-01T09:00:00+00:00,o`].join('\r\n') + '\r\n';
  assert.equal(T.neededOn(ended, '2026-11-12', need23), false);   // gone from today's round and the print list
  assert.equal(T.neededOn(ended, '2026-11-11', need23), true);   // its own days stay open for entry and show in History
  const late = save(env, req(env, { fields: { area_id: a, min_c: '18.0', max_c: '22.0', period_start: '2026-11-11T08:00:00Z' } }));
  assert.equal(late.ok, true, JSON.stringify(late));        // never refused because today is past the end date
  const rows = recs(env, 'BLD-area_reading.csv');
  assert.equal(rows.length, 1); assert.equal(rows[0].area_id, a); assert.equal(rows[0].period_start, '2026-11-11T08:00:00Z');
});
