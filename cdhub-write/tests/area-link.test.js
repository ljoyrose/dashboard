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

/* Edit, archive and delete with a code, logged (Lisa 15 Nov 2026, Q1/Q2; Edit.gs). OFF until RECORD_EDIT_ON.
   Who may: BLD-permission rows, else the starting defaults (owner edits and archives, nobody deletes). Invented rows only. */
const AUDIT_H = ['id', 'tenant_id', 'at', 'person_id', 'sign_in_id', 'device_id', 'action', 'table_name', 'record_id', 'before', 'after', 'reason'];
const PERM_H = 'id,tenant_id,role_code,person_id,table_name,action,allowed,from_date,to_date,set_by,reason';
const envE = (o) => {
  o = o || {};
  const env = env1(Object.assign({ RECORD_EDIT_ON: 'true' }, o.props || {}));
  if (o.audit !== false) env.addFile('BLD-audit_log.csv', fx.headerOnly(AUDIT_H));
  if (o.perm) env.addFile('BLD-permission.csv', [PERM_H].concat(o.perm.map((p) => `pm-x,${fx.TENANT},${p}`)).join('\r\n') + '\r\n');
  if (o.rules) {
    const text = ['id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date'].concat(o.rules.map(([k, v]) => `br-x,${fx.TENANT},${k},${v},2026-01-01,t,,,,`)).join('\r\n') + '\r\n';
    const f = env.file('BLD-breeding_rule.csv');
    if (f.length) { f[0].content = text; f[0].sheet = undefined; } else env.addFile('BLD-breeding_rule.csv', text);
  }
  link(env, env.codes.owner, { source: 'first' });
  return env;
};
const call = (env, fn, r) => { try { return { ok: true, result: env.ctx[fn](Object.assign({ table: 'area_link', record_id: recs(env)[0].id }, r)) }; } catch (e) { return env.ctx.errorBody_(e); } };
const audit = (env) => { const f = env.file('BLD-audit_log.csv')[0]; const [h, ...rows] = env.ctx.csvParse_(f.content).filter((r) => !(r.length === 1 && r[0] === '')); return rows.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i] || '']))); };

test('record edit: off by default; the status lists its switch; nothing changes while off', () => {
  const env = envE({ props: { RECORD_EDIT_ON: '' } });
  const r = call(env, 'sinkRecordEdit_', { code: env.codes.owner, fields: { source: 'changed' } });
  assert.equal(r.code, 'EDIT_OFF');
  assert.equal(recs(env)[0].source, 'first');
  assert.ok(Array.from(env.ctx.switchesStatus_()).some((s) => s.name === 'RECORD_EDIT_ON' && s.on === false));
});

test('record edit: the owner may by default and it is logged (old and new values); staff may not unless a row says so; a person "no" beats the role', () => {
  const env = envE();
  const r = call(env, 'sinkRecordEdit_', { code: env.codes.owner, fields: { source: 'changed' } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(recs(env)[0].source, 'changed');
  const [a] = audit(env);
  assert.equal(a.action, 'edit'); assert.equal(a.table_name, 'area_link'); assert.equal(a.record_id, recs(env)[0].id);
  assert.deepEqual(JSON.parse(a.before), { source: 'first' }); assert.deepEqual(JSON.parse(a.after), { source: 'changed' });
  assert.match(a.id, /^aud-/); assert.match(a.at, /Z$/);
  assert.equal(call(env, 'sinkRecordEdit_', { code: env.codes.staff, fields: { source: 'x' } }).code, 'NOT_ALLOWED');
  const s = envE({ perm: ['STAFF,,area_link,edit,yes,,,t,'] });
  assert.equal(call(s, 'sinkRecordEdit_', { code: s.codes.staff, fields: { source: 'by staff' } }).ok, true);
  const p = envE({ perm: ['STAFF,,*,edit,yes,,,t,'] });
  p.file('BLD-permission.csv')[0].content += `pm-y,${fx.TENANT},,${p.ids.staff},area_link,edit,no,,,t,\r\n`;
  assert.equal(call(p, 'sinkRecordEdit_', { code: p.codes.staff, fields: { source: 'x' } }).code, 'NOT_ALLOWED');
  // a permission row that has ended no longer counts
  const ended = envE({ perm: ['STAFF,,area_link,edit,yes,2026-01-01,2026-02-01,t,'] });
  assert.equal(call(ended, 'sinkRecordEdit_', { code: ended.codes.staff, fields: { source: 'x' } }).code, 'NOT_ALLOWED');
});

test('record edit: rule rows decide logging and reasons; unlogged needs edit_unlogged; no change log file = nothing changed', () => {
  const quiet = envE({ rules: [['edit.log.area_link', 'no']] });
  assert.equal(call(quiet, 'sinkRecordEdit_', { code: quiet.codes.owner, fields: { source: 'q' } }).result.logged, false);
  assert.equal(audit(quiet).length, 0);
  const why = envE({ rules: [['edit.reason_required', 'yes']] });
  assert.equal(call(why, 'sinkRecordEdit_', { code: why.codes.owner, fields: { source: 'w' } }).fields.reason.length > 0, true);
  assert.equal(call(why, 'sinkRecordEdit_', { code: why.codes.owner, fields: { source: 'w' }, reason: 'paper record says so' }).ok, true);
  assert.equal(audit(why)[0].reason, 'paper record says so');
  const un = envE();
  assert.equal(call(un, 'sinkRecordEdit_', { code: un.codes.owner, fields: { source: 'u' }, unlogged: true }).code, 'NOT_ALLOWED');
  const un2 = envE({ perm: ['OWNER,,*,edit_unlogged,yes,,,t,'] });
  assert.equal(call(un2, 'sinkRecordEdit_', { code: un2.codes.owner, fields: { source: 'u' }, unlogged: true }).result.logged, false);
  const none = envE({ audit: false });
  assert.equal(call(none, 'sinkRecordEdit_', { code: none.codes.owner, fields: { source: 'n' } }).code, 'NOT_CONFIGURED');
  assert.equal(recs(none)[0].source, 'first');
  // only editable fields, checked as on add
  const bad = envE();
  assert.equal(call(bad, 'sinkRecordEdit_', { code: bad.codes.owner, fields: { to_date: '2026-11-01' } }).ok, false);
  assert.equal(call(bad, 'sinkRecordEdit_', { code: bad.codes.owner, fields: { set_by: 'me' } }).ok, false);
});

test('record archive: the owner may by default; the row stays with an end date; logged; staff may not', () => {
  const env = envE();
  assert.equal(call(env, 'sinkRecordArchive_', { code: env.codes.staff }).code, 'NOT_ALLOWED');
  const r = call(env, 'sinkRecordArchive_', { code: env.codes.owner, to_date: '2026-11-20', reason: 'room rebuilt' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(recs(env).length, 1); assert.equal(recs(env)[0].to_date, '2026-11-20');
  const [a] = audit(env);
  assert.equal(a.action, 'archive'); assert.deepEqual(JSON.parse(a.after), { to_date: '2026-11-20' }); assert.equal(a.reason, 'room rebuilt');
  assert.equal(call(env, 'sinkRecordArchive_', { code: env.codes.owner, to_date: '2026-11-25' }).code, 'NOTHING_CHANGED');
  assert.equal(call(env, 'sinkRecordArchive_', { code: env.codes.owner, to_date: '2026-11-01' }).ok, false);
});

test('record delete: nobody by default, the owner included; with a row it removes the entry and the log keeps its last values', () => {
  const env = envE();
  assert.equal(call(env, 'sinkRecordDelete_', { code: env.codes.owner, reason: 'made in error' }).code, 'NOT_ALLOWED');
  const d = envE({ perm: ['OWNER,,area_link,delete,yes,,,t,'] });
  link(d, d.codes.owner, { to_area_id: 'area-t3-1', source: 'second' });
  const id = recs(d)[0].id;
  assert.equal(call(d, 'sinkRecordDelete_', { code: d.codes.owner }).fields.reason.length > 0, true);
  const r = call(d, 'sinkRecordDelete_', { code: d.codes.owner, reason: 'made in error' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(recs(d).map((x) => x.source), ['second']);
  const [a] = audit(d);
  assert.equal(a.action, 'delete'); assert.equal(a.record_id, id);
  assert.equal(JSON.parse(a.before).source, 'first'); assert.ok(!('tenant_id' in JSON.parse(a.before)));
  assert.equal(call(d, 'sinkRecordDelete_', { code: d.codes.owner, reason: 'again', record_id: id }).code, 'NOT_FOUND');
  // the change log itself can never be removed through this
  assert.throws(() => d.ctx.store_removeRow_('BLD-audit_log.csv', AUDIT_H, 0, d.ctx.store_read_('BLD-audit_log.csv', true)));
});
