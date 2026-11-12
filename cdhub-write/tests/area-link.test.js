'use strict';
/**
 * 12 Nov 2026, Lisa chose option B (via NEW: TEMPS): BLD-area_link rows say that, for from_date..to_date, a reading
 * taken in one room also counts for another. A link row with dates, never dates on the room ("A standard").
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const HEADER = ['id', 'tenant_id', 'from_area_id', 'to_area_id', 'from_date', 'to_date', 'source', 'set_by', 'set_on'];
const fv = (table, field, aud) => `fv-x,${fx.TENANT},${table},${field},${aud},yes,,,t,2026-11-12,t`;
const env1 = (props) => {
  const env = standardEnv({ props: Object.assign({ TABLE_ON_area_link: 'true', READ_ENABLED: 'true', OWNER_EDIT_ENABLED: 'true' }, props || {}) });
  env.addFile('BLD-area_link.csv', fx.headerOnly(HEADER));
  return env;
};
const recs = (env) => { const f = env.file('BLD-area_link.csv')[0];
  const [h, ...rows] = env.ctx.csvParse_(f.content).filter((r) => !(r.length === 1 && r[0] === '')); return rows.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i] || '']))); };
const link = (env, code, f) => save(env, req(env, { code, table: 'area_link', fields: Object.assign({ from_area_id: 'area-t1', to_area_id: 'area-t2', from_date: '2026-11-12' }, f || {}) }));
function read(env, over) {
  try { return { ok: true, result: env.ctx.sinkRead_(Object.assign({ v: 1, action: 'read', code: env.codes.staff, table: 'area' }, over)) }; }
  catch (e) { return env.ctx.errorBody_(e); }
}
function addVis(env, lines) { const f = env.file('BLD-field_visibility.csv')[0]; f.content = f.content.replace(/\r?\n?$/, '\r\n') + lines.join('\r\n') + '\r\n'; }

test('area_link: the owner adds one straight in, stamped; the columns are the link-row standard', () => {
  const env = env1();
  const r = link(env, env.codes.owner, { source: 'Lisa 12 Nov' });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.match(r.result.id, /^alk-/);
  const [row] = recs(env);
  assert.deepEqual(Object.keys(row), HEADER);
  assert.equal(row.to_date, ''); assert.ok(row.set_by && row.set_on);
  assert.deepEqual(Array.from(env.ctx.TABLES.area_link.columns), HEADER);
});

test('area_link: refused when a room does not exist, both rooms are the same, the end is before the start, or From is missing; a repeat is refused', () => {
  const env = env1();
  assert.equal(link(env, env.codes.owner, { to_area_id: 'area-nope' }).ok, false);
  const same = link(env, env.codes.owner, { to_area_id: 'area-t1' });
  assert.equal(same.ok, false); assert.equal(same.fields.to_area_id, 'Choose a different room.');
  const back = link(env, env.codes.owner, { to_date: '2026-11-11' });
  assert.equal(back.ok, false); assert.match(back.fields.to_date, /before the start/);
  assert.equal(link(env, env.codes.owner, { from_date: '' }).ok, false);
  assert.equal(link(env, env.codes.owner).ok, true);
  assert.equal(link(env, env.codes.owner).code, 'DUPLICATE');
  assert.equal(link(env, env.codes.owner, { from_date: '2026-12-01' }).ok, true);   // a later spell is a new row
  assert.equal(recs(env).length, 2);
});

test('area_link: staff and guests cannot add; the switch is off by default', () => {
  const env = env1();
  assert.equal(link(env, env.codes.staff).code, 'NOT_ALLOWED');
  assert.equal(link(env, env.ctx.adminAddGuestCode()).code, 'NOT_ALLOWED');
  const off = env1({ TABLE_ON_area_link: 'false' });
  assert.equal(link(off, off.codes.owner).code, 'TABLE_OFF');
  assert.equal(recs(env).length, 0);
});

test('area_link: the owner edit ends a link by filling in to_date, never before its start, never to the same room', () => {
  const env = env1();
  const id = link(env, env.codes.owner).result.id;
  env.email = 'owner@example.test';
  assert.equal(env.ctx.ui_edit('area_link', id, { to_date: '2026-11-11' }).ok, false);
  assert.equal(env.ctx.ui_edit('area_link', id, { to_area_id: 'area-t1' }).ok, false);
  assert.equal(env.ctx.ui_edit('area_link', id, { to_date: '2026-11-20' }).ok, true);
  assert.equal(recs(env)[0].to_date, '2026-11-20');
  assert.equal(recs(env).length, 1);
});

test('area_link: staff read it only through visibility rows, never who set it; guests never', () => {
  const env = env1();
  link(env, env.codes.owner);
  assert.equal(read(env, { table: 'area_link' }).code, 'NOT_ALLOWED');
  addVis(env, ['*', 'id', 'from_area_id', 'to_area_id', 'from_date', 'to_date'].map((f) => fv('area_link', f, 'aud-staff')));
  const r = read(env, { table: 'area_link' });
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.result.count, 1);
  assert.equal(r.result.fields.includes('set_by'), false);
  assert.equal(read(env, { table: 'area_link', code: env.ctx.adminAddGuestCode() }).code, 'NOT_ALLOWED');
});
