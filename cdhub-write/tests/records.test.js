'use strict';
/**
 * 8 Nov 2026: visitor (GUEST) codes, the camera fields on a reading, and the rows-based staff checks.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const GUEST_HEADER = ['id', 'tenant_id', 'area_id', 'min_c', 'max_c', 'spot_c', 'precision_dp', 'period_start', 'taken_at', 'taken_by', 'read_method', 'camera_value_changed', 'mitigation_note', 'note'];
const TYPE_HEADER = ['id', 'tenant_id', 'type_key', 'label', 'target', 'asks_item', 'item_label', 'asks_amount', 'amount_unit', 'note_label', 'note_required', 'asks_outcome', 'frequency', 'active', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'every_days', 'group', 'includes', 'sop', 'evidence', 'site_scope', 'not_in_areas', 'only_in_areas'];
const LOG_HEADER = ['id', 'tenant_id', 'check_type_id', 'area_id', 'subject_id', 'item', 'amount', 'outcome', 'happened_at', 'note', 'taken_at', 'taken_by', 'corrects_id', 'photo', 'how_recorded', 'litter_id', 'note_for_id', 'visit_id', 'counts_due'];

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

test('guest: sees only what the rows allow of the room list, and no other list even with rows for it', () => {
  const env = env0();
  const vis = env.file('BLD-field_visibility.csv')[0];
  const row = (t, f) => `v-${t}-${f},${fx.TENANT},${t},${f},aud-guest,yes,,,,,\r\n`;
  vis.content += row('area', '*') + row('area', 'id') + row('area', 'code') + row('subject', '*') + row('subject', 'name');
  const out = env.ctx.sinkRead_({ code: env.guest, table: 'area' });
  assert.deepEqual([...out.fields].sort(), ['code', 'id']);
  assert.throws(() => env.ctx.sinkRead_({ code: env.guest, table: 'subject' }), (e) => e.code === 'NOT_ALLOWED');
  assert.throws(() => env.ctx.sinkRead_({ code: env.guest, table: 'occupancy' }), (e) => e.code === 'NOT_ALLOWED');
});

test('guest: a person permission row cannot open anything to a guest', () => {
  const env = env0();
  const id = env.ctx.sinkStaffList_().filter((p) => p.role === 'GUEST')[0].id;
  env.file('BLD-field_visibility.csv')[0].content += `v-x,${fx.TENANT},area,*,person:${id},yes,,,,,\r\nv-y,${fx.TENANT},area,id,person:${id},yes,,,,,\r\n`;
  assert.throws(() => env.ctx.sinkRead_({ code: env.guest, table: 'area' }), (e) => e.code === 'NOT_ALLOWED');
});

test('guest: the code ends by itself after HOURS hours (8 in the editor function)', () => {
  const env = env0();
  env.nowMs += 8 * 3600000 - 60000;
  assert.equal(reading(env, env.guest, 'guest_reading').ok, true);
  env.nowMs += 120000;
  assert.equal(reading(env, env.guest, 'guest_reading', { min_c: '15.0' }).code, 'BAD_CODE');
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
  assert.equal(reading(env2, env2.guest, 'guest_reading').code, 'BAD_CODE');
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

// ---- staff page requests (W1)
const ACCESS_H = ['id', 'tenant_id', 'area_id', 'access_type', 'from_date', 'to_date', 'reason', 'set_by'];
const QR_H = ['id', 'tenant_id', 'tag', 'kind', 'ref_id', 'active', 'made_at', 'made_by'];
const OCC_ON = { TABLE_ON_occupancy: 'true', TABLE_ON_occupancy_out: 'true', TABLE_ON_area_access: 'true', TABLE_ON_qr_tag: 'true' };
const env1 = () => { const env = standardEnv({ email: 'owner@example.test', props: OCC_ON });
  env.addFile('BLD-area_access.csv', fx.headerOnly(ACCESS_H)); env.addFile('BLD-qr_tag.csv', fx.headerOnly(QR_H));
  if (!env.file('BLD-occupancy.csv').length) env.addFile('BLD-occupancy.csv', fx.headerOnly(fx.OCCUPANCY_HEADER));
  return env; };
const send = (env, table, fields, code) => save(env, req(env, { code: code || env.codes.staff, table, fields }));

test('area_access: staff set the flap, newest row wins, free-limited-free works in one day, a repeat tap is refused', () => {
  const env = env1(); const a = area(env);
  assert.equal(send(env, 'area_access', { area_id: a, access_type: 'free' }).ok, true);
  assert.equal(send(env, 'area_access', { area_id: a, access_type: 'limited' }).ok, true);
  assert.equal(send(env, 'area_access', { area_id: a, access_type: 'free' }).ok, true);
  const again = send(env, 'area_access', { area_id: a, access_type: 'free' });
  assert.equal(again.code, 'INVALID'); assert.match(again.fields.access_type, /already recorded/);
  const rows = recs(env, 'BLD-area_access.csv');
  assert.equal(rows.length, 3);
  assert.ok(rows[0].from_date && rows[0].set_by);
});

test('qr_tag: owner only, stamped active, the same tag twice is refused', () => {
  const env = env1(); const f = { tag: 'Ab3dEf7h', kind: 'area', ref_id: area(env) };
  assert.equal(send(env, 'qr_tag', f).code, 'NOT_ALLOWED');
  assert.equal(send(env, 'qr_tag', f, env.codes.owner).ok, true);
  assert.equal(send(env, 'qr_tag', f, env.codes.owner).code, 'DUPLICATE');
  assert.equal(recs(env, 'BLD-qr_tag.csv')[0].active, 'true');
});

test('occupancy: a move can carry the over-limit reason', () => {
  const env = env1();
  const r = send(env, 'occupancy', { subject_id: dog(env), area_id: area(env), classification_note: 'Short stay' });
  assert.equal(r.ok, true, JSON.stringify(r));
  // moves go straight in (Lisa 12 Nov 2026), so the reason is on the saved row, not in the approvals queue
  const rows = recs(env, 'BLD-occupancy.csv');
  assert.equal(rows[rows.length - 1].classification_note, 'Short stay');
});

test('occupancy_out: waits for approval, then is written to the occupancy file with no room', () => {
  const env = env1();
  const before = recs(env, 'BLD-occupancy.csv').length;
  const r = send(env, 'occupancy_out', { subject_id: dog(env), off_site_kind: 'sold' });
  assert.equal(r.result.status, 'queued', JSON.stringify(r));
  assert.equal(recs(env, 'BLD-occupancy.csv').length, before);
  env.ctx.sinkDecide_(r.result.pending_id, 'approve', '', 'owner@example.test');
  const rows = recs(env, 'BLD-occupancy.csv');
  assert.equal(rows.length, before + 1);
  assert.equal(rows[before].off_site_kind, 'sold');
  assert.equal(rows[before].area_id, '');
  assert.ok(rows[before].moved_in);
});

test('occupancy_out: a bad kind, a repeat tap and a dog already gone are refused', () => {
  const env = env1(); const d = dog(env);
  assert.equal(send(env, 'occupancy_out', { subject_id: d, off_site_kind: 'lost' }).code, 'INVALID');
  assert.equal(send(env, 'occupancy_out', { subject_id: d, off_site_kind: 'temporary' }).ok, true);
  assert.equal(send(env, 'occupancy_out', { subject_id: d, off_site_kind: 'temporary' }).code, 'DUPLICATE');
  const other = recs(env, 'BLD-subject.csv')[1].id;
  const r = send(env, 'occupancy_out', { subject_id: other, off_site_kind: 'sold' });
  env.ctx.sinkDecide_(r.result.pending_id, 'approve', '', 'owner@example.test');
  assert.equal(send(env, 'occupancy_out', { subject_id: other, off_site_kind: 'deceased' }).code, 'INVALID');
});

test('the allow-list names each file once, though two tables share the occupancy file', () => {
  const list = Array.from(env1().ctx.allowedFiles_());
  assert.equal(new Set(list).size, list.length);
  assert.equal(env1().ctx.specFor_('BLD-occupancy.csv').key, 'occupancy');
});

test('check_type: job columns are saved and checked', () => {
  const env = env0();
  addType(env, 'full_groom', { every_days: '84', group: 'Grooming', includes: 'nails | ears', sop: 'Care Check', evidence: 'optional' });
  const [row] = recs(env, 'BLD-check_type.csv');
  assert.equal(row.every_days, '84'); assert.equal(row.group, 'Grooming'); assert.equal(row.includes, 'nails|ears');
  assert.equal(row.sop, 'Care Check'); assert.equal(row.evidence, 'optional');
  const bad = (f) => save(env, req(env, { code: env.codes.owner, table: 'check_type', fields: Object.assign({ type_key: 'k_x', label: 'x', target: 'dog', effective_from: '2026-02-01' }, f) }));
  assert.match(bad({ every_days: '0' }).fields.every_days, /1 or more/);
  assert.match(bad({ includes: 'Not A Key' }).fields.includes, /separated by/);
  assert.match(bad({ includes: 'k_x|nails' }).fields.includes, /cannot include itself/);
  assert.equal(bad({ evidence: 'maybe' }).code, 'INVALID');
  assert.match(bad({ site_scope: 'per_dog', not_in_areas: 'none' }).fields.site_scope, /whole-site/);
  assert.match(bad({ target: 'none', site_scope: 'per_dog' }).fields.not_in_areas, /isolation rooms/);
});

test('check_type: a job with no new columns is as needed, no evidence, and whole-site scope is allowed', () => {
  const env = env0();
  addType(env, 'bowls', { target: 'none', site_scope: 'one_line' });
  const [row] = recs(env, 'BLD-check_type.csv');
  assert.equal(row.every_days, ''); assert.equal(row.evidence, 'none'); assert.equal(row.site_scope, 'one_line');
});

test('check_log: says how it was recorded and can point at a photo; anything else is refused', () => {
  const env = env0(); const id = addType(env, 'feeding');
  const send1 = (f) => save(env, req(env, { code: env.codes.staff || env.codes.owner, table: 'check_log', fields: Object.assign({ check_type_id: id, subject_id: dog(env), outcome: 'ok' }, f) }));
  assert.equal(send1({ how_recorded: 'verified' }).code, 'INVALID');
  assert.equal(send1({ how_recorded: 'scanned', photo: 'photo-ref-1' }).ok, true);
  const [row] = recs(env, 'BLD-check_log.csv');
  assert.equal(row.how_recorded, 'scanned'); assert.equal(row.photo, 'photo-ref-1');
});

test('qr_tag: a site code can be made for the premises; an unknown kind cannot', () => {
  const env = standardEnv({ props: { TABLE_ON_qr_tag: 'true' } });
  env.addFile('BLD-qr_tag.csv', fx.headerOnly(['id', 'tenant_id', 'tag', 'kind', 'ref_id', 'active', 'made_at', 'made_by']));
  const send2 = (kind, tag) => save(env, req(env, { code: env.codes.owner, table: 'qr_tag', fields: { tag, kind, ref_id: 'premises' } }));
  assert.equal(send2('site', 'Ab3dEf7h').ok, true);
  assert.equal(send2('planet', 'Zz3dEf7h').code, 'INVALID');
});

// ---- whole-site tap (fake rooms and dogs from fixtures: A is in area-t2, B in area-t1, C sold, D with a family, E has no room)
const siteEnv = () => { const env = env0(); return env; };
const siteTap = (env, f, code) => save(env, req(env, { code: code || env.codes.staff, table: 'check_log', action: 'add_site', fields: f }));
const allDogs = (env) => recs(env, 'BLD-subject.csv').map((r) => r.id).join('|');

test('the save reply says who saved it, the same name as the row, so the tick on the item can show it', () => {
  const env = siteEnv(); const id = addType(env, 'bowls2', { target: 'none', site_scope: 'one_line' });
  const r = siteTap(env, { check_type_id: id, outcome: 'ok' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const rows = recs(env, 'BLD-check_log.csv');
  assert.ok(r.result.who);
  assert.equal(r.result.who, rows[0].taken_by);
});

test('site tap: a job about a place stays one line, whoever is on site', () => {
  const env = siteEnv(); const id = addType(env, 'bowls', { target: 'none', site_scope: 'one_line' });
  const r = siteTap(env, { check_type_id: id, outcome: 'ok', dog_ids: allDogs(env) });
  assert.equal(r.ok, true, JSON.stringify(r));
  const rows = recs(env, 'BLD-check_log.csv');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].subject_id, '');
  assert.equal(rows[0].how_recorded, 'site_tap');
});

test('site tap: a job about dogs writes one line per dog, and isolation, off-site and unknown-room dogs are never covered', () => {
  const env = siteEnv(); const id = addType(env, 'walk', { target: 'none', site_scope: 'per_dog', not_in_areas: 'area-t2' });
  const r = siteTap(env, { check_type_id: id, outcome: 'ok', dog_ids: allDogs(env) });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.saved, 1);
  assert.equal(JSON.stringify(r.result.left_out), JSON.stringify({ isolation: 1, no_room: 1, off_site: 2, repeat: 0 }));
  const rows = recs(env, 'BLD-check_log.csv');
  assert.deepEqual(rows.map((x) => x.subject_id), ['sub-test-b']);
  assert.equal(rows[0].how_recorded, 'site_tap');
  assert.ok(rows[0].taken_by);
});

test('site tap: a whole-site job about dogs tapped from a dog scan keeps the real route, not site_tap', () => {
  const env = siteEnv(); const id = addType(env, 'health_all', { target: 'none', site_scope: 'per_dog', not_in_areas: 'none' });
  const r = siteTap(env, { check_type_id: id, outcome: 'ok', dog_ids: 'sub-test-b', how_recorded: 'scanned' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const rows = recs(env, 'BLD-check_log.csv');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].how_recorded, 'scanned');
  assert.equal(siteTap(env, { check_type_id: id, outcome: 'ok', dog_ids: 'sub-test-b', how_recorded: 'magic' }).code, 'INVALID');
});

test('room tap: a room job about dogs writes one line per ticked dog in that room, as scanned', () => {
  const env = siteEnv(); const id = addType(env, 'exercise', { target: 'area', site_scope: 'per_dog' });
  const r = siteTap(env, { check_type_id: id, area_id: 'area-t1', outcome: 'ok', how_recorded: 'scanned', dog_ids: 'sub-test-a|sub-test-b' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.saved, 1);
  assert.equal(r.result.left_out.no_room, 1);
  const rows = recs(env, 'BLD-check_log.csv');
  assert.deepEqual(rows.map((x) => x.subject_id), ['sub-test-b']);
  assert.equal(rows[0].area_id, 'area-t1'); assert.equal(rows[0].how_recorded, 'scanned');
  assert.equal(siteTap(env, { check_type_id: id, outcome: 'ok', dog_ids: 'sub-test-b' }).code, 'INVALID');
  const clean = addType(env, 'cleaned', { target: 'area' });
  assert.equal(siteTap(env, { check_type_id: clean, area_id: 'area-t1', outcome: 'ok', dog_ids: 'sub-test-b' }).code, 'INVALID');
});

test('site tap: a repeat tap saves nothing new; no one eligible is refused', () => {
  const env = siteEnv(); const id = addType(env, 'walk', { target: 'none', site_scope: 'per_dog', not_in_areas: 'none' });
  assert.equal(siteTap(env, { check_type_id: id, outcome: 'ok', dog_ids: 'sub-test-a|sub-test-b' }).result.saved, 2);
  assert.equal(siteTap(env, { check_type_id: id, outcome: 'ok', dog_ids: 'sub-test-a|sub-test-b' }).code, 'DUPLICATE');
  assert.equal(recs(env, 'BLD-check_log.csv').length, 2);
  assert.equal(siteTap(env, { check_type_id: id, outcome: 'ok', dog_ids: 'sub-test-c|sub-test-e' }).code, 'INVALID');
});

test('site tap: refused for a dog or room job, an unknown dog, a guest, or another table', () => {
  const env = siteEnv(); const dogJob = addType(env, 'nails'); const id = addType(env, 'walk', { target: 'none', site_scope: 'per_dog', not_in_areas: 'none' });
  assert.equal(siteTap(env, { check_type_id: dogJob, outcome: 'ok', dog_ids: 'sub-test-a' }).code, 'INVALID');
  assert.equal(siteTap(env, { check_type_id: id, outcome: 'ok', dog_ids: 'sub-nope' }).code, 'INVALID');
  assert.equal(siteTap(env, { check_type_id: id, outcome: 'ok', dog_ids: 'sub-test-a' }, env.guest).code, 'NOT_ALLOWED');
  assert.equal(save(env, req(env, { code: env.codes.staff, table: 'qr_tag', action: 'add_site', fields: {} })).ok, false);
  assert.equal(recs(env, 'BLD-check_log.csv').length, 0);
});

test('site tap on a Sheet: all rows are added as plain text, and a failed read-back takes them all out again', () => {
  const asSheet = (env, title) => { const f = env.file(title)[0]; f.sheet = env.ctx.csvParse_(f.content).filter((r) => !(r.length === 1 && r[0] === '')); f.fmt = {}; f.maxRows = 3; delete f.content; };
  const env = siteEnv(); const id = addType(env, 'walk', { target: 'none', site_scope: 'per_dog', not_in_areas: 'none' });
  asSheet(env, 'BLD-check_log.csv');
  assert.equal(siteTap(env, { check_type_id: id, outcome: 'ok', dog_ids: 'sub-test-a|sub-test-b' }).result.saved, 2);
  const f = env.file('BLD-check_log.csv')[0];
  assert.equal(f.sheet.length, 3);
  assert.equal(f.fmt[2], '@'); assert.equal(f.fmt[3], '@');

  const id2 = addType(env, 'run', { target: 'none', site_scope: 'per_dog', not_in_areas: 'none' });
  const realFlush = env.ctx.SpreadsheetApp.flush; let n = 0;
  env.ctx.SpreadsheetApp.flush = () => { if (++n === 1) f.sheet[f.sheet.length - 1][0] = 'garbled'; return realFlush && realFlush(); };
  const bad = siteTap(env, { check_type_id: id2, outcome: 'ok', dog_ids: 'sub-test-a|sub-test-b' });
  env.ctx.SpreadsheetApp.flush = realFlush;
  assert.equal(bad.code, 'VERIFY_FAILED');
  assert.equal(f.sheet.length, 3);
});
