'use strict';
/**
 * v3 (Lisa's answers to slip 02): permissions, per-person overrides, owner revoke of staff codes, the one-tap
 * "All the rest unmoved" log, moves queue by date, not-on-site rules. FAKE data only (tenant ten-test).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const DOCS = path.join(__dirname, '..', 'docs');
const VIS_FILE = path.join(DOCS, 'AA_2026-10-16_JOB4-PROPOSED-visibility-rows__claude-job4.csv');
const POL_FILE = path.join(DOCS, 'AA_2026-10-16_JOB4-PROPOSED-table_policy-rows__claude-job4.csv');
const rows = (env, title) => env.ctx.csvRecords_(env.text(title)).records;
const lines = (t) => t.split('\r\n').filter(Boolean);

function read(env, over = {}) {
  try { return { ok: true, result: env.ctx.sinkRead_(Object.assign({ v: 1, action: 'read', code: env.codes.staff, table: 'area' }, over)) }; }
  catch (e) { return env.ctx.errorBody_(e); }
}
const withRead = (props = {}) => standardEnv({ props: Object.assign({ READ_ENABLED: 'true' }, props) });
function setVisibility(env, rowsText) { env.file('BLD-field_visibility.csv')[0].content = [fx.VIS_HEADER].concat(rowsText).join('\r\n') + '\r\n'; }
let fvn = 0;
const fv = (table, field, aud, visible, cond = '', red = '') => `fv-v3-${++fvn},${fx.TENANT},${table},${field},${aud},${visible},${cond},${red},t,2026-10-16,t`;
const asOwner = (env) => { env.email = 'owner@example.test'; };

// ================================================================== STEP 1: the proposed permission rows (S02-3 A, S02-4 D)
test('proposed visibility rows: 42 remain, none of fv-p018 to fv-p024, the rest exactly as before', () => {
  const text = fs.readFileSync(VIS_FILE, 'utf8');
  const recs = text.split('\r\n').filter(Boolean);
  assert.equal(recs.length - 1, 42);
  assert.equal(recs[0], fx.VIS_HEADER);
  const ids = recs.slice(1).map((l) => l.split(',')[0]);
  for (let n = 18; n <= 24; n++) assert.equal(ids.includes('fv-p' + String(n).padStart(3, '0')), false, 'fv-p0' + n);
  assert.equal(new Set(ids).size, 42);
  // the 42 that are kept: p001-p017 and p025-p049
  const want = [];
  for (let n = 1; n <= 17; n++) want.push('fv-p' + String(n).padStart(3, '0'));
  for (let n = 25; n <= 49; n++) want.push('fv-p' + String(n).padStart(3, '0'));
  assert.deepEqual(ids, want);
  // no row at all gives staff anything on area_reading
  const staffTemp = recs.slice(1).filter((l) => { const c = l.split(','); return c[2] === 'area_reading' && c[4] === 'aud-staff'; });
  assert.deepEqual(staffTemp, []);
  // and no staff row has a "days" rule any more
  assert.equal(recs.slice(1).some((l) => /rows_days<=/.test(l)), false);
});

test('proposed CSVs keep CRLF line endings (no bare LF anywhere)', () => {
  [VIS_FILE, POL_FILE].forEach((f) => {
    const t = fs.readFileSync(f, 'utf8');
    assert.ok(t.length > 0 && t.endsWith('\r\n'), path.basename(f) + ' ends with CRLF');
    assert.equal(t.replace(/\r\n/g, '').includes('\n'), false, path.basename(f) + ' has a bare LF');
    assert.equal(t.replace(/\r\n/g, '').includes('\r'), false, path.basename(f) + ' has a bare CR');
  });
});

test('table_policy tp-p01: staff do not read the temperature log, only the owner (all)', () => {
  const recs = fs.readFileSync(POL_FILE, 'utf8').split('\r\n').filter(Boolean);
  const env0 = standardEnv();
  const parsed = env0.ctx.csvRecords_(fs.readFileSync(POL_FILE, 'utf8')).records;
  const p01 = parsed.filter((r) => r.id === 'tp-p01')[0];
  assert.equal(p01.table_name, 'area_reading');
  assert.equal(p01.who_may_read_by_default, 'owner (all)');
  assert.ok(recs.length >= 3);
  const p02 = parsed.filter((r) => r.id === 'tp-p02')[0];
  assert.equal(p02.who_may_read_by_default, 'owner (all)');       // staff have no read rows for the check log either
});

test('staff cannot read any past temperature entry, not even their own, with the proposed rows', () => {
  const env = withRead();
  env.file('BLD-field_visibility.csv')[0].content = fs.readFileSync(VIS_FILE, 'utf8').split('ten-REPLACE-ME').join(fx.TENANT);
  assert.equal(save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '22' } })).ok, true);
  const r = read(env, { table: 'area_reading' });
  assert.equal(r.code, 'NOT_ALLOWED');
  assert.equal(JSON.stringify(r).includes('20.00'), false);
  assert.equal(read(env, { table: 'area_reading', code: env.codes.owner }).result.count, 1);   // the owner sees it
});

test('a staff code can no longer send a correction (there is no entry for staff to point at); an OWNER code still can', () => {
  const env = standardEnv();
  const ok = save(env, req(env));
  const fields = { area_id: 'area-t1', min_c: '20', max_c: '21' };
  const staff = save(env, req(env, { action: 'correct', corrects_id: ok.result.id, reason: 'typed it wrong', fields }));
  assert.equal(staff.code, 'NOT_ALLOWED');
  const before = lines(env.text('BLD-_pending.csv')).length;
  const owner = save(env, req(env, { code: env.codes.owner, action: 'correct', corrects_id: ok.result.id, reason: 'typed it wrong', fields }));
  assert.equal(owner.result.status, 'queued');
  assert.equal(lines(env.text('BLD-_pending.csv')).length, before + 1);
});

// ================================================================== STEP 2: per-person overrides
test('override GRANTS: a person row lets one named person read what their role cannot', () => {
  const env = withRead();
  setVisibility(env, [   // staff role: occupancy only
    fv('occupancy', 'subject_id', 'aud-staff', 'yes'), fv('occupancy', 'area_id', 'aud-staff', 'yes'), fv('occupancy', '*', 'aud-staff', 'yes')
  ]);
  assert.equal(read(env, { table: 'area_reading' }).code, 'NOT_ALLOWED');                  // role: nothing on temperatures
  const me = 'person:' + env.ids.staff;
  setVisibility(env, [
    fv('occupancy', 'subject_id', 'aud-staff', 'yes'), fv('occupancy', 'area_id', 'aud-staff', 'yes'), fv('occupancy', '*', 'aud-staff', 'yes'),
    fv('area_reading', 'area_id', me, 'yes'), fv('area_reading', 'min_c', me, 'yes'), fv('area_reading', 'max_c', me, 'yes'), fv('area_reading', '*', me, 'yes')
  ]);
  assert.equal(save(env, req(env, { code: env.codes.owner, fields: { area_id: 'area-t1', min_c: '20', max_c: '22' } })).ok, true);
  const r = read(env, { table: 'area_reading' });
  assert.equal(r.ok, true);
  assert.deepEqual(Array.from(r.result.fields), ['area_id', 'min_c', 'max_c']);
  assert.equal(r.result.count, 1);
  // a different member of staff with the same role gets nothing: the grant is for one person only
  const salt = env.props.CODE_SALT, reg = JSON.parse(env.props.STAFF_REGISTRY);
  reg[env.ctx.hashCode_('OTHERSTAFF1', salt)] = { id: 'sc-zzzzzz', who: 'Other Staff', role: 'STAFF', active: true };
  env.props.STAFF_REGISTRY = JSON.stringify(reg);
  assert.equal(read(env, { table: 'area_reading', code: 'OTHERSTAFF1' }).code, 'NOT_ALLOWED');
  assert.equal(read(env, { table: 'occupancy', code: 'OTHERSTAFF1' }).ok, true);            // their role rows still work
});

test('override DENIES: a person row takes away what the role allows (a column, or the whole list)', () => {
  const env = withRead();
  const me = 'person:' + env.ids.staff;
  setVisibility(env, [
    fv('subject', 'id', 'aud-staff', 'yes'), fv('subject', 'name', 'aud-staff', 'yes'), fv('subject', 'dob', 'aud-staff', 'yes'), fv('subject', '*', 'aud-staff', 'yes'),
    fv('occupancy', 'subject_id', 'aud-staff', 'yes'), fv('occupancy', '*', 'aud-staff', 'yes'),
    fv('subject', 'dob', me, 'no'),                      // this person must not see dates of birth
    fv('occupancy', '*', me, 'no')                       // ... nor the occupancy list at all
  ]);
  const s = read(env, { table: 'subject' });
  assert.deepEqual(Array.from(s.result.fields), ['id', 'name']);                            // dob gone, the rest from the role
  assert.equal(read(env, { table: 'occupancy' }).code, 'NOT_ALLOWED');                      // whole list denied for this person
  // someone else on the same role still has both
  const salt = env.props.CODE_SALT, reg = JSON.parse(env.props.STAFF_REGISTRY);
  reg[env.ctx.hashCode_('OTHERSTAFF1', salt)] = { id: 'sc-zzzzzz', who: 'Other Staff', role: 'STAFF', active: true };
  env.props.STAFF_REGISTRY = JSON.stringify(reg);
  assert.deepEqual(Array.from(read(env, { table: 'subject', code: 'OTHERSTAFF1' }).result.fields), ['id', 'name', 'dob']);
  assert.equal(read(env, { table: 'occupancy', code: 'OTHERSTAFF1' }).ok, true);
});

test('NO override: the role rows apply unchanged; other people\'s person rows and a person row for another list do not matter', () => {
  const env = withRead();
  const base = [fv('area', 'id', 'aud-staff', 'yes'), fv('area', 'code', 'aud-staff', 'yes'), fv('area', '*', 'aud-staff', 'yes')];
  setVisibility(env, base);
  const plain = read(env, { table: 'area' });
  setVisibility(env, base.concat([
    fv('area', 'code', 'person:sc-zzzzzz', 'no'),                  // someone else
    fv('occupancy', '*', 'person:' + env.ids.staff, 'yes'),         // this person, but a different list
    fv('area', 'code', 'person:', 'no'), fv('area', 'code', 'person', 'no'), fv('area', 'code', env.ids.staff, 'no')   // malformed audience values do not match
  ]));
  const withNoise = read(env, { table: 'area' });
  assert.equal(JSON.stringify(withNoise.result), JSON.stringify(plain.result));
  assert.deepEqual(Array.from(withNoise.result.fields), ['id', 'code']);
});

test('override rules: person row-rule beats the role row-rule; "no" beats "yes" inside the person rows; a person row with a condition stays hidden; default deny stays', () => {
  const env = withRead();
  const me = 'person:' + env.ids.staff;
  save(env, req(env, { code: env.codes.owner, fields: { area_id: 'area-t1', min_c: '20', max_c: '22' } }));
  const cols = (aud) => ['id', 'area_id', 'min_c', 'taken_by', 'taken_at'].map((f) => fv('area_reading', f, aud, 'yes'));
  // role: all rows. person: only their own rows (so zero, as the owner made the entry)
  setVisibility(env, cols('aud-staff').concat([fv('area_reading', '*', 'aud-staff', 'yes')]));
  assert.equal(read(env, { table: 'area_reading' }).result.count, 1);
  setVisibility(env, cols('aud-staff').concat([fv('area_reading', '*', 'aud-staff', 'yes'), fv('area_reading', '*', me, 'yes', 'own_rows_days<=14')]));
  assert.equal(read(env, { table: 'area_reading' }).result.count, 0);
  // inside the person rows, no beats yes
  setVisibility(env, cols('aud-staff').concat([fv('area_reading', '*', 'aud-staff', 'yes'), fv('area_reading', 'min_c', me, 'yes'), fv('area_reading', 'min_c', me, 'no')]));
  assert.equal(Array.from(read(env, { table: 'area_reading' }).result.fields).includes('min_c'), false);
  // a person "yes" with a condition cannot be applied, so the column is hidden even though the role says yes
  setVisibility(env, cols('aud-staff').concat([fv('area_reading', '*', 'aud-staff', 'yes'), fv('area_reading', 'min_c', me, 'yes', 'some condition')]));
  assert.equal(Array.from(read(env, { table: 'area_reading' }).result.fields).includes('min_c'), false);
  // a person row-rule we cannot understand denies the list (it does not fall back to the role)
  setVisibility(env, cols('aud-staff').concat([fv('area_reading', '*', 'aud-staff', 'yes'), fv('area_reading', '*', me, 'yes', 'garbage')]));
  assert.equal(read(env, { table: 'area_reading' }).code, 'NOT_ALLOWED');
  // person columns alone, with no row-rule anywhere, still mean nothing
  setVisibility(env, cols(me));
  assert.equal(read(env, { table: 'area_reading' }).code, 'NOT_ALLOWED');
});

test('a person row can grant a role that has no audience (a vet), but only that person, and a revoked code still gets nothing', () => {
  const env = withRead();
  const salt = env.props.CODE_SALT, reg = JSON.parse(env.props.STAFF_REGISTRY);
  reg[env.ctx.hashCode_('VETCODE12345', salt)] = { id: 'sc-vet111', who: 'Vera Vet', role: 'VET', active: true };
  env.props.STAFF_REGISTRY = JSON.stringify(reg);
  assert.equal(read(env, { code: 'VETCODE12345', table: 'area' }).code, 'NOT_ALLOWED');
  setVisibility(env, [fv('area', 'id', 'person:sc-vet111', 'yes'), fv('area', 'code', 'person:sc-vet111', 'yes'), fv('area', '*', 'person:sc-vet111', 'yes')]);
  assert.deepEqual(Array.from(read(env, { code: 'VETCODE12345', table: 'area' }).result.fields), ['id', 'code']);
  assert.equal(read(env, { code: 'VETCODE12345', table: 'subject' }).code, 'NOT_ALLOWED');
});

// ================================================================== STEP 2b: owner revoke of staff codes
const pendingEvents = (env) => rows(env, 'BLD-_pending.csv');

test('revoke: the owner switches a code off; it is refused on read AND write straight away; the entry is kept', () => {
  const env = withRead({ TABLE_ON_occupancy: 'true' });
  assert.equal(read(env).ok, true);
  assert.equal(save(env, req(env)).ok, true);
  asOwner(env);
  const r = env.ctx.ui_revokeCode(env.ids.staff);
  assert.equal(r.ok, true);
  assert.equal(r.result.status, 'revoked');
  assert.equal(r.result.logged, true);
  assert.equal(read(env).code, 'BAD_CODE');                                      // read refused at once
  assert.equal(save(env, req(env, { fields: { area_id: 'area-t2', min_c: '19', max_c: '21' } })).code, 'BAD_CODE');   // write refused at once
  assert.equal(save(env, req(env, { table: 'occupancy', fields: { subject_id: 'sub-test-b', area_id: 'area-t2' } })).code, 'BAD_CODE');
  // the entry is still in the registry, with revoked_at / revoked_by, and nothing was deleted
  const reg = JSON.parse(env.props.STAFF_REGISTRY), entry = Object.keys(reg).map((h) => reg[h]).filter((e) => e.id === env.ids.staff)[0];
  assert.equal(entry.active, false);
  assert.match(entry.revoked_at, /^2026-10-15T23:30:00\+01:00$/);
  assert.equal(entry.revoked_by, 'owner@example.test');
  assert.equal(Object.keys(reg).length, 2);
  // the owner's own code is untouched
  assert.equal(read(env, { code: env.codes.owner, table: 'area_reading' }).ok, true);
  // the failed tries above count as wrong codes like any other
});

test('revoke is logged in the approvals queue file (kind code_revoke) and the log holds no code and no hash', () => {
  const env = standardEnv();
  asOwner(env);
  const before = env.text('BLD-_pending.csv');
  assert.equal(env.ctx.ui_revokeCode(env.ids.staff).ok, true);
  const after = env.text('BLD-_pending.csv');
  assert.ok(after.startsWith(before));                                           // appended, nothing changed above
  const ev = pendingEvents(env).pop();
  assert.equal(ev.kind, 'code_revoke');
  assert.equal(ev.event, 'revoked');
  assert.equal(ev.row_id, env.ids.staff);
  assert.equal(ev.by, 'owner@example.test');
  assert.equal(ev.role, 'OWNER');
  // neither the code, nor its hash, nor the salt, nor the person's name is in the log
  const salt = env.props.CODE_SALT;
  [env.codes.staff, env.ctx.hashCode_(env.codes.staff, salt), salt, 'Sam Staff'].forEach((secret) => assert.equal(after.includes(secret), false, secret));
  // the queue's own list is not confused by it
  assert.equal(env.ctx.sinkPendingList_().length, 0);
});

test('a non-owner cannot revoke: not a staff code, not an owner CODE, not a staff Google account, not an empty session', () => {
  const env = standardEnv();
  const snapshot = JSON.stringify(env.drive), props = JSON.stringify(env.props);
  ['', 'sam@example.test'].forEach((who) => {
    env.email = who;
    assert.equal(env.ctx.ui_revokeCode(env.ids.owner).code, 'NOT_OWNER', who);
    assert.equal(env.ctx.ui_staffList().code, 'NOT_OWNER', who);
  });
  // the save endpoint has no revoke action, whatever code is sent
  const post = (body) => JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
  ['revoke', 'revoke_code', 'code_revoke', 'staff'].forEach((action) => {
    [env.codes.staff, env.codes.owner].forEach((code) => {
      const out = post(req(env, { action, code, row_id: env.ids.staff, id: env.ids.staff }));
      assert.equal(out.ok, false);
    });
  });
  assert.equal(JSON.stringify(env.drive), snapshot);
  assert.equal(JSON.stringify(env.props), props);                                // not one setting moved
  assert.equal(read(withRead()).ok, true);
});

test('revoke edge cases: unknown id, malformed id, already switched off (no second log line), failed log still switches the code off', () => {
  const env = standardEnv();
  asOwner(env);
  assert.equal(env.ctx.ui_revokeCode('sc-nope99').code, 'NOT_FOUND');
  ['', 'x', '../../etc', "sc-'; DROP", undefined].forEach((bad) => assert.equal(env.ctx.ui_revokeCode(bad).code, 'INVALID', String(bad)));
  assert.equal(env.ctx.ui_revokeCode(env.ids.staff).ok, true);
  const n = pendingEvents(env).length;
  assert.equal(env.ctx.ui_revokeCode(env.ids.staff).code, 'ALREADY_REVOKED');
  assert.equal(pendingEvents(env).length, n);                                    // no second line
  // the queue file is missing: the code is still switched off, and the answer says it was not logged
  const env2 = standardEnv();
  env2.drive = env2.drive.filter((f) => f.title !== 'BLD-_pending.csv');
  asOwner(env2);
  const r = env2.ctx.ui_revokeCode(env2.ids.staff);
  assert.equal(r.ok, true);
  assert.equal(r.result.logged, false);
  assert.equal(save(env2, req(env2)).code, 'BAD_CODE');
});

test('the staff list shows names, roles, ids and state only: never a code, a hash or the salt', () => {
  const env = standardEnv();
  asOwner(env);
  const out = env.ctx.ui_staffList();
  assert.equal(out.ok, true);
  const list = Array.from(out.result.staff);
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((s) => s.who).sort(), ['Olive Owner', 'Sam Staff']);
  const text = JSON.stringify(out), salt = env.props.CODE_SALT;
  [env.codes.staff, env.codes.owner, env.ctx.hashCode_(env.codes.staff, salt), salt].forEach((x) => assert.equal(text.includes(x), false));
  list.forEach((s) => assert.match(s.id, /^sc-[a-z0-9]{6}$/));
  env.ctx.ui_revokeCode(env.ids.staff);
  assert.equal(Array.from(env.ctx.ui_staffList().result.staff).filter((s) => s.active === false).length, 1);
});

test('adminAssignCodeIds gives ids to codes made before ids existed, and changes nothing else', () => {
  const env = standardEnv();
  const reg = JSON.parse(env.props.STAFF_REGISTRY);
  Object.keys(reg).forEach((h) => { delete reg[h].id; });
  env.props.STAFF_REGISTRY = JSON.stringify(reg);
  assert.equal(save(env, req(env)).ok, true);                                    // old codes still work without an id
  assert.equal(rows(env, 'BLD-area_reading.csv')[0].taken_by, 'Sam Staff');
  env.ctx.adminAssignCodeIds();
  const after = JSON.parse(env.props.STAFF_REGISTRY);
  Object.keys(after).forEach((h) => { assert.match(after[h].id, /^sc-[a-z0-9]{6}$/); assert.equal(after[h].who, reg[h].who); assert.equal(after[h].role, reg[h].role); });
  assert.deepEqual(Object.keys(after).sort(), Object.keys(reg).sort());           // same hashes
  const ids = Object.keys(after).map((h) => after[h].id);
  env.ctx.adminAssignCodeIds();                                                   // run again: nothing changes
  assert.deepEqual(Object.keys(JSON.parse(env.props.STAFF_REGISTRY)).map((h) => JSON.parse(env.props.STAFF_REGISTRY)[h].id), ids);
});

test('adminRevokeStaff (editor) also keeps the entry and stamps revoked_at', () => {
  const env = standardEnv();
  const fsrc = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Admin.gs'), 'utf8');
  require('node:vm').runInContext(fsrc.replace("var NAME = 'Example Name';      // <- change this\n  var reg = registry_(), hit = 0;", "var NAME = 'Sam Staff';\n  var reg = registry_(), hit = 0;").replace(/function admin(\w+)\(/g, 'function admin$1_t('), env.ctx);
  env.ctx.adminRevokeStaff_t();
  assert.equal(save(env, req(env)).code, 'BAD_CODE');
  const reg = JSON.parse(env.props.STAFF_REGISTRY);
  assert.equal(Object.keys(reg).length, 2);
  assert.ok(Object.keys(reg).map((h) => reg[h]).filter((e) => e.who === 'Sam Staff')[0].revoked_at);
});

// ================================================================== STEP 3: owner edit stays OFF by default
test('the owner-edit switch is OFF by default: nothing in a fresh setup turns it on, and with it off the owner cannot edit', () => {
  const env = standardEnv();
  assert.equal('OWNER_EDIT_ENABLED' in env.props, false);
  assert.equal(env.ctx.ownerEditEnabled_(), false);
  assert.equal(env.ctx.BLD.PROP.OWNER_EDIT_ENABLED, 'OWNER_EDIT_ENABLED');
  const first = save(env, req(env));
  asOwner(env);
  const snapshot = JSON.stringify(env.drive);
  assert.equal(env.ctx.ui_edit('area_reading', first.result.id, { min_c: '1', max_c: '2' }).code, 'EDIT_OFF');
  assert.equal(env.ctx.ui_editList('area_reading').code, 'EDIT_OFF');
  assert.equal(JSON.stringify(env.drive), snapshot);
  ['false', 'FALSE', 'yes', '1', ''].forEach((v) => { env.props.OWNER_EDIT_ENABLED = v; assert.equal(env.ctx.ownerEditEnabled_(), false, v); });
  env.props.OWNER_EDIT_ENABLED = 'true';
  assert.equal(env.ctx.ownerEditEnabled_(), true);
  // the owner edit never reaches the daily check log (only temperatures and moves)
  assert.equal(env.ctx.ui_edit('occupancy_check', 'chk-1', { note: 'x' }).code, 'FILE_NOT_ALLOWED');
});

// ================================================================== STEP 4: "All the rest unmoved" (S02-1)
function bulkDogs(env, n) {
  let text = env.text('BLD-subject.csv');
  for (let i = 1; i <= n; i++) text += `sub-bulk-${String(i).padStart(4, '0')},${fx.TENANT},Bulk ${i},2022-01-01,Female,9990000${String(i).padStart(8, '0')}\r\n`;
  env.file('BLD-subject.csv')[0].content = text;
  return Array.from({ length: n }, (_, i) => `sub-bulk-${String(i + 1).padStart(4, '0')}`);
}
const check = (env, fields, over = {}) => save(env, req(env, Object.assign({ table: 'occupancy_check', fields }, over)));

test('occupancy_check is on the allow-list behind its own switch, OFF by default', () => {
  const env = standardEnv();
  assert.ok(env.ctx.allowedFiles_().indexOf('BLD-occupancy_check.csv') >= 0);
  assert.equal(env.ctx.tableOn_(env.ctx.TABLES.occupancy_check), false);
  const before = env.text('BLD-occupancy_check.csv');
  assert.equal(check(env, { dog_ids: ['sub-test-a'] }).code, 'TABLE_OFF');
  assert.equal(env.text('BLD-occupancy_check.csv'), before);
  assert.equal(env.writes.length, 0);
  assert.deepEqual(Array.from(env.ctx.TABLES.occupancy_check.columns), fx.OCCUPANCY_CHECK_HEADER);
  assert.deepEqual(Array.from(Object.keys(env.ctx.PROPOSED_TABLES)), ['staff']);
});

test('ONE tap with 150 dogs appends exactly ONE row: who (code id), when, the dog list, the moved count', () => {
  const env = standardEnv({ props: { TABLE_ON_occupancy_check: 'true' } });
  const dogs = bulkDogs(env, 150);
  const before = env.text('BLD-occupancy_check.csv');
  const shuffled = dogs.slice().reverse();                                       // order sent does not matter
  const r = check(env, { dog_ids: shuffled, moved_count: 7, note: 'rain all day' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.status, 'saved');
  const after = env.text('BLD-occupancy_check.csv');
  assert.ok(after.startsWith(before));
  assert.equal(lines(after).length, 2);                                          // header + ONE row
  assert.equal(env.writes.length, 1);
  const row = rows(env, 'BLD-occupancy_check.csv')[0];
  assert.match(row.id, /^chk-20261015-233000-[a-z0-9]{4}$/);
  assert.equal(row.tenant_id, fx.TENANT);
  assert.equal(row.confirmed_at, '2026-10-15T23:30:00+01:00');                  // ISO with offset, set by the script
  assert.equal(row.confirmed_by, env.ids.staff);                                 // the staff code id, not the name, not the code
  assert.equal(row.moved_count, '7');
  assert.equal(row.note, 'rain all day');
  assert.deepEqual(row.dog_ids.split('|'), dogs);                                // pipe-separated, sorted, all 150
  assert.equal(row.dog_ids.split('|').length, 150);
  assert.equal(after.includes(env.codes.staff), false);
  // the same 150 again straight away is a repeat tap
  assert.equal(check(env, { dog_ids: dogs }).code, 'DUPLICATE');
  // through the real web entry point, under the body limit
  const body = JSON.stringify(req(env, { table: 'occupancy_check', fields: { dog_ids: dogs.slice(0, 149), moved_count: 1 } }));
  assert.ok(body.length < env.ctx.BLD.LIMITS.MAX_BODY_CHARS);
  assert.equal(JSON.parse(env.ctx.doPost({ postData: { contents: body } }).getContent()).ok, true);
});

test('a 500-dog list fits the body limit; 501 dogs, an empty list, an unknown dog and fields the script sets are all refused with nothing written', () => {
  const env = standardEnv({ props: { TABLE_ON_occupancy_check: 'true' } });
  const dogs = bulkDogs(env, 501);
  assert.ok(JSON.stringify(req(env, { table: 'occupancy_check', fields: { dog_ids: dogs } })).length < env.ctx.BLD.LIMITS.MAX_BODY_CHARS);
  assert.match(check(env, { dog_ids: dogs }).fields.dog_ids, /Too many dogs/);
  assert.match(check(env, { dog_ids: [] }).fields.dog_ids, /needed/);
  assert.match(check(env, { dog_ids: '' }).fields.dog_ids, /needed/);
  assert.match(check(env, { dog_ids: ['sub-test-a', 'sub-nope', 'sub-nope2', 'sub-nope3', 'sub-nope4'] }).fields.dog_ids, /Not found.*sub-nope.*and 1 more/);
  assert.match(check(env, { dog_ids: ['sub-test-a'], moved_count: 'many' }).fields.moved_count, /whole number/);
  assert.match(check(env, { dog_ids: ['sub-test-a'], confirmed_at: '2020-01-01T00:00:00Z' }).fields.confirmed_at, /system fills/);
  assert.match(check(env, { dog_ids: ['sub-test-a'], confirmed_by: 'someone else' }).fields.confirmed_by, /system fills/);
  assert.match(check(env, { dog_ids: ['sub-test-a'], note: '=HYPERLINK("x")' }).fields.note, /formula/);
  assert.equal(check(env, { dog_ids: ['sub-test-a|sub-test-b'] }).ok, true);    // a pipe-separated string works too
  assert.equal(rows(env, 'BLD-occupancy_check.csv')[0].dog_ids, 'sub-test-a|sub-test-b');
  assert.equal(rows(env, 'BLD-occupancy_check.csv')[0].moved_count, '0');         // default
  assert.equal(env.writes.length, 1);                                             // only the one good request wrote
});

test('the daily check: other kennels\' dogs are not accepted, there is no correction of a check, and a list is never edited', () => {
  const env = standardEnv({ props: { TABLE_ON_occupancy_check: 'true' } });
  env.file('BLD-subject.csv')[0].content += `sub-other,ten-other,Other,2020-01-01,Female,1\r\n`;
  assert.match(check(env, { dog_ids: ['sub-other'] }).fields.dog_ids, /Not found/);
  const ok = check(env, { dog_ids: ['sub-test-a'] });
  assert.equal(ok.ok, true);
  const c = save(env, req(env, { table: 'occupancy_check', code: env.codes.owner, action: 'correct', corrects_id: ok.result.id, reason: 'oops', fields: { dog_ids: ['sub-test-b'] } }));
  assert.equal(c.code, 'CORRECT_NOT_SUPPORTED');
  assert.equal(lines(env.text('BLD-occupancy_check.csv')).length, 2);
  env.writes.forEach((w) => assert.ok(w.next.startsWith(w.old)));                // append-only
});

test('the daily check can be read by the owner only if Lisa adds rows; staff get nothing by default', () => {
  const env = withRead({ TABLE_ON_occupancy_check: 'true' });
  assert.equal(check(env, { dog_ids: ['sub-test-a'] }).ok, true);
  assert.equal(read(env, { table: 'occupancy_check' }).code, 'NOT_ALLOWED');
  setVisibility(env, ['id', 'confirmed_at', 'confirmed_by', 'dog_ids'].map((f) => fv('occupancy_check', f, 'aud-admin', 'yes')).concat([fv('occupancy_check', '*', 'aud-admin', 'yes')]));
  const r = read(env, { table: 'occupancy_check', code: env.codes.owner });
  assert.equal(r.result.count, 1);
  assert.equal(r.result.rows[0].confirmed_by, env.ids.staff);
  assert.equal(read(env, { table: 'occupancy_check' }).code, 'NOT_ALLOWED');
});

// ================================================================== STEP 5: moves queue for the first 14 days, then straight in (S02-2 A)
const mv = (env, s, a) => save(env, req(env, { table: 'occupancy', fields: { subject_id: s, area_id: a } }));
const DAY = 86400000;

test('moves queue up to and including MOVES_QUEUE_UNTIL, then go straight in (both sides of the date)', () => {
  const env = standardEnv({ props: { TABLE_ON_occupancy: 'true', MOVES_QUEUE_UNTIL: '2026-10-20' } });
  assert.equal(env.ctx.modeFor_(env.ctx.TABLES.occupancy), 'pending');           // 15 Oct
  assert.equal(mv(env, 'sub-test-b', 'area-t2').result.status, 'queued');
  env.nowMs = Date.UTC(2026, 9, 20, 12, 0, 0);                                   // the last queued day
  assert.equal(mv(env, 'sub-test-e', 'area-t1').result.status, 'queued');
  assert.equal(rows(env, 'BLD-occupancy.csv').length, 5);                        // nothing reached the table
  env.nowMs = Date.UTC(2026, 9, 20, 22, 59, 59);                                 // 23:59:59 London, still the 20th
  assert.equal(env.ctx.modeFor_(env.ctx.TABLES.occupancy), 'pending');
  env.nowMs = Date.UTC(2026, 9, 20, 23, 0, 0);                                   // 00:00 on the 21st London
  assert.equal(env.ctx.modeFor_(env.ctx.TABLES.occupancy), 'direct');
  env.nowMs = Date.UTC(2026, 9, 21, 12, 0, 0);
  const r = mv(env, 'sub-test-b', 'area-t3-1');
  assert.equal(r.result.status, 'saved');                                        // straight in
  const last = rows(env, 'BLD-occupancy.csv').pop();
  assert.equal(last.subject_id, 'sub-test-b');
  assert.equal(last.moved_in, '2026-10-21');
  assert.equal(rows(env, 'BLD-occupancy.csv').length, 6);
  // the status page tells the screens which way it is today
  const mode = (e) => JSON.parse(e.ctx.doGet({ parameter: {} }).getContent()).tables.filter((t) => t.key === 'occupancy')[0].mode;
  assert.equal(mode(env), 'direct');
  env.nowMs = Date.UTC(2026, 9, 18, 12, 0, 0);
  assert.equal(mode(env), 'pending');
});

test('moves queue: missing or unreadable date = always queue; an explicit MODE_occupancy beats the date either way', () => {
  const env = standardEnv({ props: { TABLE_ON_occupancy: 'true' } });
  const spec = env.ctx.TABLES.occupancy;
  env.nowMs = Date.UTC(2027, 0, 1, 12, 0, 0);
  assert.equal(env.ctx.modeFor_(spec), 'pending');                               // unset
  ['not a date', '2026-13-45', '20/10/2026', ''].forEach((v) => { env.props.MOVES_QUEUE_UNTIL = v; assert.equal(env.ctx.modeFor_(spec), 'pending', v); });
  env.props.MOVES_QUEUE_UNTIL = '2026-10-20';
  assert.equal(env.ctx.modeFor_(spec), 'direct');                                // long past
  env.props.MODE_occupancy = 'pending';
  assert.equal(env.ctx.modeFor_(spec), 'pending');
  env.nowMs = Date.UTC(2026, 9, 15, 12, 0, 0);
  env.props.MODE_occupancy = 'direct';
  assert.equal(env.ctx.modeFor_(spec), 'direct');                                // still inside the queue period
  // other tables ignore the date
  env.props.MOVES_QUEUE_UNTIL = '2099-01-01';
  assert.equal(env.ctx.modeFor_(env.ctx.TABLES.area_reading), 'direct');
  assert.equal(env.ctx.modeFor_(env.ctx.TABLES.occupancy_check), 'direct');
});

test('adminStartMovesQueue sets the last queued day to 14 days counting today, and day 15 goes straight in', () => {
  const env = standardEnv({ props: { TABLE_ON_occupancy: 'true' } });
  env.ctx.adminStartMovesQueue();
  assert.equal(env.props.MOVES_QUEUE_UNTIL, '2026-10-28');                       // 15 Oct + 13
  const spec = env.ctx.TABLES.occupancy;
  env.nowMs = Date.UTC(2026, 9, 28, 12, 0, 0);                                   // day 14
  assert.equal(env.ctx.modeFor_(spec), 'pending');
  env.nowMs = Date.UTC(2026, 9, 29, 12, 0, 0);                                   // day 15
  assert.equal(env.ctx.modeFor_(spec), 'direct');
  // a clock change in the middle (25 Oct 2026) cannot move the date: calendar arithmetic
  env.nowMs = Date.UTC(2026, 9, 23, 23, 30, 0);                                  // 00:30 BST on the 24th
  env.ctx.adminStartMovesQueue();
  assert.equal(env.props.MOVES_QUEUE_UNTIL, '2026-11-06');
  assert.equal(env.ctx.addDays_('2026-12-25', 10), '2027-01-04');
  assert.equal(env.ctx.addDays_('2028-02-27', 2), '2028-02-29');
});

// ================================================================== STEP 6: not on site (S02-7 B) - server side
test('permanently gone = sold, owned_by_family, Collected, deceased: such a dog is never asked to move', () => {
  const env = standardEnv({ props: { TABLE_ON_occupancy: 'true', MODE_occupancy: 'direct' } });
  env.file('BLD-occupancy.csv')[0].content += `occ-z1,${fx.TENANT},sub-test-e,,deceased,2026-10-02,,,\r\n`;
  assert.match(save(env, req(env, { table: 'occupancy', fields: { subject_id: 'sub-test-e', area_id: 'area-t1' } })).fields.subject_id, /no longer on site/);
  env.file('BLD-occupancy.csv')[0].content += `occ-z2,${fx.TENANT},sub-test-b,area-t1,,2026-10-12,,Deceased,\r\n`;
  assert.match(save(env, req(env, { table: 'occupancy', fields: { subject_id: 'sub-test-b', area_id: 'area-t2' } })).fields.subject_id, /no longer on site/);
  ['sold', 'owned_by_family', 'DECEASED'].forEach((k) => assert.equal(env.ctx.permanentlyGone_({ off_site_kind: k }), true, k));
  ['Collected', 'collected', 'Deceased'].forEach((c) => assert.equal(env.ctx.permanentlyGone_({ classification: c }), true, c));
  assert.equal(env.ctx.permanentlyGone_({ off_site_kind: 'off_site_temp' }), false);   // away at the vet is NOT permanent
  assert.equal(env.ctx.permanentlyGone_({ classification: 'SLA label, not a place' }), false);
  assert.equal(env.ctx.permanentlyGone_(null), false);
});

test('config: version bumped, the new switch is documented, and nothing secret is in the repository files', () => {
  const env = standardEnv();
  assert.equal(env.ctx.BLD.VERSION, '1.2.0');
  const dir = path.join(__dirname, '..', fs.existsSync(path.join(__dirname, '..', 'code')) ? 'code' : '', 'apps-script');
  const cfg = fs.readFileSync(path.join(dir, 'Config.gs'), 'utf8');
  assert.match(cfg, /MOVES_QUEUE_UNTIL/);
  fs.readdirSync(dir).forEach((f) => {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.equal(/AKfycb|1[A-Za-z0-9_-]{32,}\.(?:apps|google)/.test(t), false, f);   // no real Script URL / Drive id
  });
});
