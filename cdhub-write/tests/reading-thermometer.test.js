'use strict';
/**
 * 11 Nov 2026, Lisa: "each reading needs to be shown in the room but by name ... room H5/6 has 2 named thermometers".
 * area_reading.thermometer_id (optional, last column): a room with 2 thermometers takes 2 readings a slot; the
 * thermometer must be in the reading's room; blank keeps the old rule (one reading per room per slot).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const NOW = Date.UTC(2026, 10, 12, 10, 0, 0);   // 12 Nov 2026
const THM = ['id', 'tenant_id', 'name', 'area_id', 'made_at', 'made_by'];
const env1 = () => {
  const env = standardEnv({ nowMs: NOW, props: { OWNER_EDIT_ENABLED: 'true' } });
  env.addFile('BLD-thermometer.csv', [THM.join(','), `thm-a,${fx.TENANT},H5 left,area-t1,2026-11-01T09:00:00Z,o`, `thm-b,${fx.TENANT},H5 right,area-t1,2026-11-01T09:00:00Z,o`, `thm-c,${fx.TENANT},Other,area-t2,2026-11-01T09:00:00Z,o`].join('\r\n') + '\r\n');
  return env;
};
const send = (env, f, code) => save(env, req(env, { code: code || env.codes.staff, fields: Object.assign({ area_id: 'area-t1', min_c: '18.0', max_c: '22.0', period_start: '2026-11-12T08:00:00Z' }, f) }));
const rows = (env) => {
  const lines = env.text('BLD-area_reading.csv').split(/\r?\n/).filter(Boolean);
  const h = env.ctx.csvParse_(lines[0])[0];
  return lines.slice(1).map((l) => { const v = env.ctx.csvParse_(l)[0]; const o = {}; h.forEach((c, i) => { o[c] = v[i]; }); return o; });
};

test('thermometer_id is the last column, after room_empty', () => {
  const cols = Array.from(env1().ctx.TABLES.area_reading.columns);
  assert.deepEqual(cols.slice(-2), ['room_empty', 'thermometer_id']);
  assert.deepEqual(cols, fx.AREA_READING_HEADER);
});

test('two thermometers in one room: each takes its own reading for the same slot; the same one twice is a repeat', () => {
  const env = env1();
  assert.equal(send(env, { thermometer_id: 'thm-a' }).ok, true);
  const b = send(env, { thermometer_id: 'thm-b' });
  assert.equal(b.ok, true, JSON.stringify(b));
  assert.equal(send(env, { thermometer_id: 'thm-a' }).code, 'DUPLICATE');
  assert.deepEqual(rows(env).map((r) => r.thermometer_id), ['thm-a', 'thm-b']);
});

test('blank thermometer_id keeps the old rule: one reading per room per slot', () => {
  const env = env1();
  assert.equal(send(env, {}).ok, true);
  assert.equal(send(env, {}).code, 'DUPLICATE');
  assert.equal(rows(env)[0].thermometer_id, '');
});

test('a thermometer in another room, or one that does not exist, is refused', () => {
  const env = env1();
  const r = send(env, { thermometer_id: 'thm-c' });
  assert.equal(r.code, 'INVALID'); assert.equal(r.fields.thermometer_id, 'That thermometer is in another room.');
  assert.equal(send(env, { thermometer_id: 'thm-zz' }).code, 'INVALID');
  assert.equal(send(env, { area_id: 'area-t2', thermometer_id: 'thm-c' }).ok, true);
  assert.equal(rows(env).length, 1);
});

test('late readings (over 7 days): the slot check also tells the two thermometers apart', () => {
  const env = env1();
  const old = { period_start: '2026-10-20T08:00:00Z' };
  assert.equal(send(env, Object.assign({ thermometer_id: 'thm-a' }, old)).ok, true);
  assert.equal(send(env, Object.assign({ thermometer_id: 'thm-b' }, old)).ok, true);
  assert.equal(send(env, Object.assign({ thermometer_id: 'thm-a' }, old)).code, 'DUPLICATE');
  assert.equal(rows(env).length, 2);
});

test('owner edit: a reading cannot be moved to a thermometer in another room', () => {
  const env = env1();
  const id = send(env, { thermometer_id: 'thm-a' }).result.id;
  env.email = 'owner@example.test';
  assert.equal(env.ctx.ui_edit('area_reading', id, { thermometer_id: 'thm-c' }).ok, false);
  assert.equal(env.ctx.ui_edit('area_reading', id, { thermometer_id: 'thm-b' }).ok, true);
});

test('the page check (bld-save.js, both copies): thermometer_id optional, checked only when the list is loaded', () => {
  ['../client/bld-save.js', '../../cdhub/staff/lib/bld-save.js'].forEach((p) => {
    const s = require(p).create({ fetch: async () => ({}), localStorage: null, sessionStorage: null });
    s.setLookups({ area: [{ id: 'area-t1' }] });
    const v = (f) => s.validate('area_reading', Object.assign({ area_id: 'area-t1', min_c: '18.0', max_c: '22.0' }, f));
    assert.equal(v({}).ok, true, p);
    assert.equal(v({ thermometer_id: 'thm-a' }).ok, true, p);   // list not loaded: the save checks it
    s.setLookups({ area: [{ id: 'area-t1' }], thermometer: [{ id: 'thm-a' }] });
    assert.equal(v({ thermometer_id: 'thm-a' }).ok, true, p);
    assert.equal(v({ thermometer_id: 'thm-zz' }).ok, false, p);
  });
});

test('missingOn: a reading covers the thermometer it names; an unnamed one covers its room only when the room has one thermometer', () => {
  const T = require('../../cdhub/staff/lib/thermometer.js');
  const rows = [{ id: 'thm-a', name: 'H5 left', area_id: 'h5' }, { id: 'thm-b', name: 'H5 right', area_id: 'h5' }, { id: 'thm-c', name: 'Hall', area_id: 'hall' }];
  const d = '2026-11-12', at = '2026-11-12T08:00:00Z';
  const miss = (readings) => T.missingOn(rows, readings, d, []).map((t) => t.id).sort();
  assert.deepEqual(miss([]), ['thm-a', 'thm-b', 'thm-c']);
  assert.deepEqual(miss([{ area_id: 'h5', thermometer_id: 'thm-a', period_start: at }]), ['thm-b', 'thm-c']);
  assert.deepEqual(miss([{ area_id: 'h5', period_start: at }]), ['thm-a', 'thm-b', 'thm-c']);   // unnamed in a 2-thermometer room: covers neither
  assert.deepEqual(miss([{ area_id: 'hall', period_start: at }]), ['thm-a', 'thm-b']);          // unnamed, one thermometer: covers it
  assert.deepEqual(miss([{ area_id: 'h5', thermometer_id: 'thm-a', period_start: at }, { area_id: 'h5', thermometer_id: 'thm-b', room_empty: 'yes', period_start: at }, { area_id: 'hall', thermometer_id: 'thm-c', taken_at: at }]), []);
});
