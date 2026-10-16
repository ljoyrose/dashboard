'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, makeEnv, req, save, nextRid } = require('./harness');
const fx = require('./fixtures');

const lines = (t) => t.split('\r\n').filter(Boolean);
const rows = (env, title) => env.ctx.csvRecords_(env.text(title)).records;
/** Simulates the later decision to put a proposed table on the allow-list (a one-line code change). */
const promote = (env, key) => { env.ctx.TABLES[key] = env.ctx.PROPOSED_TABLES[key]; };

/** Every write the script made only ever ADDED text to the end of the old text. */
function assertAppendOnly(env) {
  env.writes.forEach((w) => {
    assert.ok(w.next.startsWith(w.old), `write to ${w.title} changed earlier bytes`);
    assert.ok(w.next.length > w.old.length, `write to ${w.title} did not add anything`);
  });
}

// ------------------------------------------------------------------ 1. valid append
test('valid reading is appended as exactly one new row (direct mode)', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  const before = env.text('BLD-area_reading.csv');
  const r = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '21.47', max_c: '24.1', spot_c: '22' } }));
  assert.equal(r.ok, true);
  assert.equal(r.result.status, 'saved');
  const after = env.text('BLD-area_reading.csv');
  assert.ok(after.startsWith(before));
  assert.equal(lines(after).length, 2);
  const row = rows(env, 'BLD-area_reading.csv')[0];
  assert.equal(row.id, r.result.id);
  assert.match(row.id, /^rdg-20261015-233000-[a-z0-9]{4}$/); // London time
  assert.equal(row.tenant_id, fx.TENANT);
  assert.equal(row.area_id, 'area-t1');
  assert.equal(row.reading_type, 'temperature');
  assert.equal(row.min_c, '21.47');
  assert.equal(row.max_c, '24.10'); // kept to two decimal places
  assert.equal(row.spot_c, '22.00');
  assert.equal(row.precision_dp, '2');
  assert.equal(row.taken_at, '2026-10-15T23:30:00+01:00');
  assert.equal(row.taken_by, 'Sam Staff');
  assert.equal(row.corrects_id, '');
  assert.equal(row.in_range, ''); // computed columns are left for the app to work out
  assert.equal(env.writes.length, 1);
  assertAppendOnly(env);
});

// ------------------------------------------------------------------ 2. bad input
test('bad input is refused with plain messages and nothing is written', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  const before = env.text('BLD-area_reading.csv');
  const bad = [
    [{ area_id: 'area-t1', min_c: '25', max_c: '20' }, 'min_c', /cannot be higher/],
    [{ area_id: 'area-t1', min_c: 'warm', max_c: '20' }, 'min_c', /degrees C/],
    [{ area_id: 'area-t1', min_c: '21.475', max_c: '22' }, 'min_c', /at most 2 decimals/],
    [{ area_id: 'area-t1', min_c: '21', max_c: '99' }, 'max_c', /outside/],
    [{ area_id: 'area-t1', min_c: '21' }, 'max_c', /needed/],
    [{ min_c: '21', max_c: '22' }, 'area_id', /needed/],
    [{ area_id: 'area-t1', min_c: '21', max_c: '22', taken_by: 'Someone Else' }, 'taken_by', /system fills/],
    [{ area_id: 'area-t1', min_c: '21', max_c: '22', mitigation_note: '=HYPERLINK("x")' }, 'mitigation_note', /formula/],
    [{ area_id: 'area-t1', min_c: '21', max_c: '22', reading_type: 'humidity' }, 'reading_type', /Not one of/],
    [{ area_id: 'area-t1', min_c: '21', max_c: '22', period_start: '2026-10-15 07:40' }, 'period_start', /time zone/],
    [{ area_id: 'area-t1', min_c: '21', max_c: '22', period_start: '2027-01-01T00:00:00Z' }, 'period_start', /future/],
    [{ area_id: 'area-t1', min_c: '21', max_c: '22', period_start: '2026-09-01T00:00:00Z' }, 'period_start', /7 days/]
  ];
  bad.forEach(([fields, field, re]) => {
    const r = save(env, req(env, { fields }));
    assert.equal(r.ok, false, JSON.stringify(fields));
    assert.equal(r.code, 'INVALID');
    assert.match(r.fields[field], re, field);
  });
  assert.equal(env.text('BLD-area_reading.csv'), before);
  assert.equal(env.writes.length, 0);
});

// ------------------------------------------------------------------ 3. unknown id
test('an id that is not in the lookup table is refused', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  const r = save(env, req(env, { fields: { area_id: 'area-nope', min_c: '21', max_c: '22' } }));
  assert.equal(r.ok, false);
  assert.match(r.fields.area_id, /Not found in the area list/);
  assert.equal(env.writes.length, 0);
});

test('a missing lookup file is said plainly, not guessed', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  env.drive = env.drive.filter((f) => f.title !== 'BLD-area.csv');
  const r = save(env, req(env));
  assert.equal(r.ok, false);
  assert.match(r.fields.area_id, /Cannot check/);
});

test('rows of another tenant are not accepted as lookups', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  env.file('BLD-area.csv')[0].content += 'area-other,ten-other,X,G,1,5,u-m2,yes,\r\n';
  const r = save(env, req(env, { fields: { area_id: 'area-other', min_c: '21', max_c: '22' } }));
  assert.equal(r.ok, false);
  assert.match(r.fields.area_id, /Not found/);
});

// ------------------------------------------------------------------ 4. allow-list
test('a file that is not on the allow-list is refused, and no live table is touched', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  const snapshot = JSON.stringify(env.drive);
  ['BLD-subject.csv', 'BLD-area.csv', 'BLD-field_visibility.csv', 'BLD-subject_status.csv', '../BLD-area_reading.csv', 'area_reading.csv ', '', 'constructor', '__proto__']
    .forEach((name) => {
      const r = save(env, req(env, { table: name }));
      assert.equal(r.ok, false, name);
      assert.equal(r.code, 'FILE_NOT_ALLOWED', name);
    });
  // table + a mismatching file name is also refused
  const r2 = save(env, req(env, { table: 'area_reading', file: 'BLD-subject.csv' }));
  assert.equal(r2.code, 'FILE_NOT_ALLOWED');
  assert.equal(JSON.stringify(env.drive), snapshot);
  // the low-level writer enforces the same list independently
  assert.throws(() => env.ctx.store_append_('BLD-subject.csv', ['id'], ['x'], { header: ['id'], file: {}, text: '', size: 0 }),
    (e) => e.code === 'FILE_NOT_ALLOWED');
  assert.deepEqual(Array.from(env.ctx.allowedFiles_()).sort(),
    ['BLD-_pending.csv', 'BLD-area_reading.csv', 'BLD-occupancy.csv', 'BLD-occupancy_check.csv']);
});

test('the exact file name is accepted as an alias for the table key', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  const r = save(env, req(env, { table: 'BLD-area_reading.csv' }));
  assert.equal(r.ok, true);
});

// ------------------------------------------------------------------ 5. earlier rows never change
test('a second append leaves the first row byte-for-byte alone', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  assert.equal(save(env, req(env)).ok, true);
  const afterFirst = env.text('BLD-area_reading.csv');
  const r2 = save(env, req(env, { fields: { area_id: 'area-t2', min_c: '19', max_c: '20.5' } }));
  assert.equal(r2.ok, true);
  const afterSecond = env.text('BLD-area_reading.csv');
  assert.ok(afterSecond.startsWith(afterFirst));
  assert.equal(lines(afterSecond).length, 3);
  assertAppendOnly(env);
});

test('same room again inside the window is a duplicate (staff are told to tell the owner)', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  assert.equal(save(env, req(env)).ok, true);
  env.nowMs += 10 * 60000;
  const r = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '21' } }));
  assert.equal(r.ok, false);
  assert.equal(r.code, 'DUPLICATE');
  assert.match(r.message, /tell the owner/);
  env.nowMs += 12 * 3600000; // the evening reading is fine
  assert.equal(save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '21' } })).ok, true);
});

test('a repeated request id returns the first answer and writes nothing twice', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  const q = req(env);
  const a = save(env, q), b = save(env, q);
  assert.equal(a.ok && b.ok, true);
  assert.equal(b.result.repeat, true);
  assert.equal(a.result.id, b.result.id);
  assert.equal(lines(env.text('BLD-area_reading.csv')).length, 2);
});

// ------------------------------------------------------------------ 6. pending -> approved
test('MODE_area_reading=pending: nothing reaches the table until the owner approves', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'pending' } });
  const target0 = env.text('BLD-area_reading.csv');
  const r = save(env, req(env));
  assert.equal(r.ok, true);
  assert.equal(r.result.status, 'queued');
  assert.equal(env.text('BLD-area_reading.csv'), target0);
  assert.equal(rows(env, 'BLD-_pending.csv').length, 1);

  // a non-owner cannot see or decide
  env.email = 'stranger@example.test';
  assert.equal(env.ctx.ui_pending().code, 'NOT_OWNER');
  assert.equal(env.ctx.ui_decide(r.result.pending_id, 'approve', '').code, 'NOT_OWNER');
  assert.equal(env.text('BLD-area_reading.csv'), target0);

  env.email = 'Owner@Example.test';
  const list = env.ctx.ui_pending();
  assert.equal(list.ok, true);
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].row.area_id, 'area-t1');

  const d = env.ctx.ui_decide(r.result.pending_id, 'approve', 'looks right');
  assert.equal(d.ok, true);
  assert.equal(d.result.status, 'applied');
  const row = rows(env, 'BLD-area_reading.csv')[0];
  assert.equal(row.id, r.result.id);
  assert.equal(row.taken_by, 'Sam Staff'); // who entered it, not who approved
  const ev = Array.from(rows(env, 'BLD-_pending.csv')).map((x) => x.event);
  assert.deepEqual(ev, ['queued', 'approved', 'applied']);
  assert.equal(env.ctx.ui_pending().items.length, 0);

  // cannot approve twice
  assert.equal(env.ctx.ui_decide(r.result.pending_id, 'approve', '').code, 'ALREADY_DECIDED');
  assert.equal(lines(env.text('BLD-area_reading.csv')).length, 2);
  assertAppendOnly(env);
});

test('rejecting leaves the table alone and is logged', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'pending' } });
  const target0 = env.text('BLD-area_reading.csv');
  const r = save(env, req(env));
  env.email = 'owner@example.test';
  const d = env.ctx.ui_decide(r.result.pending_id, 'reject', 'wrong room');
  assert.equal(d.ok, true);
  assert.equal(env.text('BLD-area_reading.csv'), target0);
  const ev = rows(env, 'BLD-_pending.csv');
  assert.deepEqual(Array.from(ev).map((x) => x.event), ['queued', 'rejected']);
  assert.equal(ev[1].note, 'wrong room');
  assert.equal(env.ctx.ui_decide(r.result.pending_id, 'approve', '').code, 'ALREADY_DECIDED');
});

test('approval re-checks the room still exists', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'pending' } });
  const r = save(env, req(env));
  env.drive = env.drive.map((f) => (f.title === 'BLD-area.csv' ? Object.assign(f, { content: f.content.replace(/^area-t1.*\r\n/m, '') }) : f));
  env.email = 'owner@example.test';
  const d = env.ctx.ui_decide(r.result.pending_id, 'approve', '');
  assert.equal(d.ok, false);
  assert.match(d.message, /no longer in the area list/);
  assert.equal(lines(env.text('BLD-area_reading.csv')).length, 1);
});

test('approving again after a crash does not write a second copy', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'pending' } });
  const r = save(env, req(env));
  env.email = 'owner@example.test';
  // simulate: the table write happened but the "applied" event did not
  const q = rows(env, 'BLD-_pending.csv')[0];
  const row = JSON.parse(q.payload_json);
  env.file('BLD-area_reading.csv')[0].content += env.ctx.csvLine_(env.ctx.rowValues_(env.ctx.TABLES.area_reading.columns, row)) + '\r\n';
  const d = env.ctx.ui_decide(r.result.pending_id, 'approve', '');
  assert.equal(d.ok, true);
  assert.equal(lines(env.text('BLD-area_reading.csv')).length, 2);
  const last = rows(env, 'BLD-_pending.csv').pop();
  assert.equal(last.event, 'applied');
  assert.equal(last.result, 'already present');
});

// ------------------------------------------------------------------ 7. corrections
test('a correction is a NEW row pointing at the old one, and always waits for approval', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } }); // even in direct mode
  const first = save(env, req(env));
  assert.equal(first.result.status, 'saved');
  const t1 = env.text('BLD-area_reading.csv');
  const origLine = lines(t1)[1];

  const c = save(env, req(env, {
    code: env.codes.owner, action: 'correct', corrects_id: first.result.id, reason: 'typed the wrong digit',
    fields: { area_id: 'area-t1', min_c: '21.74', max_c: '24.10' }
  }));
  assert.equal(c.ok, true);
  assert.equal(c.result.status, 'queued');
  assert.equal(env.text('BLD-area_reading.csv'), t1); // nothing changed yet

  env.email = 'owner@example.test';
  assert.equal(env.ctx.ui_decide(c.result.pending_id, 'approve', '').ok, true);
  const t2 = env.text('BLD-area_reading.csv');
  assert.ok(t2.startsWith(t1));
  assert.equal(lines(t2)[1], origLine);          // the original row is untouched
  assert.equal(lines(t2).length, 3);
  const all = rows(env, 'BLD-area_reading.csv');
  assert.equal(all[1].corrects_id, first.result.id);
  assert.equal(all[1].min_c, '21.74');
  assertAppendOnly(env);

  // the original cannot be corrected a second time
  const c2 = save(env, req(env, { code: env.codes.owner, action: 'correct', corrects_id: first.result.id, reason: 'again', fields: { area_id: 'area-t1', min_c: '20', max_c: '21' } }));
  assert.equal(c2.ok, false);
  assert.match(c2.fields.corrects_id, /already has a correction/);
});

test('a correction needs a real target row and a reason', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  const f = { area_id: 'area-t1', min_c: '20', max_c: '21' };
  let r = save(env, req(env, { code: env.codes.owner, action: 'correct', corrects_id: 'rdg-nope', reason: 'because', fields: f }));
  assert.match(r.fields.corrects_id, /not found/);
  const ok = save(env, req(env));
  r = save(env, req(env, { code: env.codes.owner, action: 'correct', corrects_id: ok.result.id, reason: '', fields: f }));
  assert.match(r.fields.reason, /why it needs correcting/);
  r = save(env, req(env, { code: env.codes.owner, action: 'correct', corrects_id: '', reason: 'abc', fields: f }));
  assert.match(r.fields.corrects_id, /Say which/);
});

test('a waiting correction blocks a second correction of the same row', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  const ok = save(env, req(env));
  const f = { area_id: 'area-t1', min_c: '20', max_c: '21' };
  assert.equal(save(env, req(env, { code: env.codes.owner, action: 'correct', corrects_id: ok.result.id, reason: 'first fix', fields: f })).ok, true);
  const r = save(env, req(env, { code: env.codes.owner, action: 'correct', corrects_id: ok.result.id, reason: 'second fix', fields: f }));
  assert.equal(r.ok, false);
  assert.match(r.fields.corrects_id, /already has a correction/);
});

// ------------------------------------------------------------------ 8. switches and safety
test('ships OFF: no SAVE_ENABLED means every save is refused', () => {
  const env = standardEnv({ props: { SAVE_ENABLED: 'false' } });
  const r = save(env, req(env));
  assert.equal(r.code, 'SAVE_OFF');
  delete env.props.SAVE_ENABLED;
  assert.equal(save(env, req(env)).code, 'SAVE_OFF');
  assert.equal(env.writes.length, 0);
});

test('each allow-listed table has its own switch', () => {
  const env = standardEnv({ props: { TABLE_ON_area_reading: 'false' } });
  assert.equal(save(env, req(env)).code, 'TABLE_OFF');
});

test('the proposed staff table and the retired round_event are NOT on the allow-list: refused even if every switch is on', () => {
  const env = standardEnv({ props: { TABLE_ON_staff: 'true', TABLE_ON_round_event: 'true', MODE_staff: 'direct' } });
  env.addFile('BLD-round_event.csv', fx.headerOnly(['id', 'tenant_id']));
  env.addFile('BLD-staff.csv', fx.headerOnly(fx.STAFF_HEADER));
  ['staff', 'round_event', 'BLD-round_event.csv', 'BLD-staff.csv'].forEach((t) => {
    const r = save(env, req(env, { table: t, code: env.codes.owner, fields: {} }));
    assert.equal(r.code, 'FILE_NOT_ALLOWED', t);
  });
  assert.deepEqual(Array.from(Object.keys(env.ctx.TABLES)), ['area_reading', 'occupancy', 'occupancy_check']);
  assert.deepEqual(Array.from(Object.keys(env.ctx.PROPOSED_TABLES)), ['staff']);
  assert.deepEqual(Array.from(Object.keys(env.ctx.RETIRED_TABLES)), ['round_event']);
  assert.equal(env.writes.length, 0);
  assert.throws(() => env.ctx.store_append_('BLD-staff.csv', fx.STAFF_HEADER, [], { header: fx.STAFF_HEADER, file: {}, text: '' }), (e) => e.code === 'FILE_NOT_ALLOWED');
});

test('wrong, missing and switched-off staff codes are refused; the code is never stored in clear', () => {
  const env = standardEnv();
  assert.equal(save(env, req(env, { code: 'NOTACODE123' })).code, 'BAD_CODE');
  assert.equal(save(env, req(env, { code: '' })).code, 'NO_CODE');
  assert.equal(save(env, req(env, { code: undefined })).code, 'NO_CODE');
  assert.ok(!env.props.STAFF_REGISTRY.includes(env.codes.staff));
  assert.ok(!env.props.STAFF_REGISTRY.includes(env.codes.owner));
  // revoke Sam
  const reg = JSON.parse(env.props.STAFF_REGISTRY);
  Object.keys(reg).forEach((h) => { if (reg[h].who === 'Sam Staff') reg[h].active = false; });
  env.props.STAFF_REGISTRY = JSON.stringify(reg);
  assert.equal(save(env, req(env)).code, 'BAD_CODE');
});

test('too many wrong codes pauses saving for everyone for a while', () => {
  const env = standardEnv();
  for (let i = 0; i < 25; i++) save(env, req(env, { code: 'WRONGWRONG' + i }));
  const r = save(env, req(env)); // even the right code
  assert.equal(r.code, 'TOO_MANY_TRIES');
});

test('roles (once the proposed staff table is promoted): staff cannot change the roster; the owner can, but it still waits for approval', () => {
  const env = standardEnv({ props: { TABLE_ON_staff: 'true', MODE_staff: 'direct' } });
  promote(env, 'staff');
  env.addFile('BLD-staff.csv', fx.headerOnly(fx.STAFF_HEADER));
  const f = { person_id: 'per-test-1', role: 'Kennel assistant', employment: 'part_time', started_on: '2026-09-01' };
  assert.equal(save(env, req(env, { table: 'staff', fields: f })).code, 'NOT_ALLOWED');
  const r = save(env, req(env, { table: 'staff', code: env.codes.owner, fields: f }));
  assert.equal(r.ok, true);
  assert.equal(r.result.status, 'queued'); // staff roster is always pending, even when MODE says direct
  assert.equal(lines(env.text('BLD-staff.csv')).length, 1);
  env.email = 'owner@example.test';
  assert.equal(env.ctx.ui_decide(r.result.pending_id, 'approve', '').ok, true);
  assert.equal(rows(env, 'BLD-staff.csv')[0].person_id, 'per-test-1');
  // unknown person refused
  const r2 = save(env, req(env, { table: 'staff', code: env.codes.owner, fields: Object.assign({}, f, { person_id: 'per-nope', started_on: '2026-09-02' }) }));
  assert.match(r2.fields.person_id, /Not found/);
});

test('a table file that does not exist yet is said plainly (the sink never creates files)', () => {
  const env = standardEnv({ noTargets: true, props: { MODE_area_reading: 'direct' } });
  const r = save(env, req(env));
  assert.equal(r.code, 'FILE_MISSING');
  assert.match(r.message, /Lisa needs to create it/);
  assert.equal(env.created.length, 0);
});

test('a file whose header is not what the sink expects is left alone', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  env.file('BLD-area_reading.csv')[0].content = 'id,tenant_id,area_id,something_else\r\n';
  const r = save(env, req(env));
  assert.equal(r.code, 'HEADER_MISMATCH');
  assert.equal(env.writes.length, 0);
});

test('two files with the same title: refuse, like CD Hub does', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  env.addFile('BLD-area.csv', 'id,tenant_id\r\n');
  const r = save(env, req(env));
  assert.equal(r.code, 'DUPLICATE_TITLE');
  assert.equal(env.writes.length, 0);
});

test('a file that ends without a newline is handled, line ending style is kept, awkward text is quoted', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  const f = env.file('BLD-area_reading.csv')[0];
  f.content = fx.AREA_READING_HEADER.join(',').split(',').join(',') + '\n'; // LF file
  const r = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '21', mitigation_note: 'Fans on, "doors" open, windows too' } }));
  assert.equal(r.ok, true);
  assert.ok(!f.content.includes('\r\n'));
  const row = env.ctx.csvRecords_(f.content).records[0];
  assert.equal(row.mitigation_note, 'Fans on, "doors" open, windows too');
  f.content = f.content.replace(/\n$/, ''); // now remove the final newline
  env.nowMs += 13 * 3600000;
  assert.equal(save(env, req(env, { fields: { area_id: 'area-t2', min_c: '20', max_c: '21' } })).ok, true);
  assert.equal(env.ctx.csvRecords_(f.content).records.length, 2);
  assertAppendOnly(env);
});

test('read-back check fails once: the EXACT old text is put back, nothing is saved, and it is logged in the approvals queue', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  assert.equal(save(env, req(env)).ok, true);          // one good row first
  const before = env.text('BLD-area_reading.csv');
  env.nowMs += 13 * 3600000;
  env.breakSetContent = 'once'; env.breakTitle = 'BLD-area_reading.csv';
  const r = save(env, req(env, { fields: { area_id: 'area-t2', min_c: '19', max_c: '23' } }));
  assert.equal(r.code, 'VERIFY_FAILED');
  assert.match(r.message, /put back exactly/);
  assert.equal(env.text('BLD-area_reading.csv'), before);   // byte-for-byte what it was
  const ev = rows(env, 'BLD-_pending.csv').pop();
  assert.equal(ev.event, 'write_check_failed');
  assert.equal(ev.target_file, 'BLD-area_reading.csv');
  assert.equal(ev.result, 'old text restored');
  env.breakSetContent = false;                          // and a retry then works
  env.nowMs += 1000;
  assert.equal(save(env, req(env, { fields: { area_id: 'area-t2', min_c: '19', max_c: '23' } })).ok, true);
});

test('read-back check fails AND the restore cannot be confirmed: say so loudly', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  env.breakSetContent = true;
  const r = save(env, req(env));
  assert.equal(r.code, 'VERIFY_FAILED');
  assert.match(r.message, /Tell Lisa now/);
  assert.match(r.message, /could not be confirmed/);
});

test('a failed read-back during approval is logged on that queued item, and it can be approved again', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'pending' } });
  const q = save(env, req(env));
  env.email = 'owner@example.test';
  const before = env.text('BLD-area_reading.csv');
  env.breakSetContent = 'once'; env.breakTitle = 'BLD-area_reading.csv';
  const d = env.ctx.ui_decide(q.result.pending_id, 'approve', '');
  assert.equal(d.code, 'VERIFY_FAILED');
  assert.equal(env.text('BLD-area_reading.csv'), before);
  const last = rows(env, 'BLD-_pending.csv').pop();
  assert.equal(last.event, 'apply_failed');
  assert.equal(last.result, 'old text restored');
  env.breakSetContent = false;
  assert.equal(env.ctx.ui_decide(q.result.pending_id, 'approve', '').ok, true);
  assert.equal(lines(env.text('BLD-area_reading.csv')).length, 2);
});

test('if the file changes while saving, the save stops (longer file, and an edit of the SAME length)', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  assert.equal(save(env, req(env)).ok, true);
  const cols = env.ctx.TABLES.area_reading.columns;
  const f = env.file('BLD-area_reading.csv')[0];
  let target = env.ctx.store_read_('BLD-area_reading.csv', true);
  f.content += 'sneaky,edit\r\n';
  assert.throws(() => env.ctx.store_append_('BLD-area_reading.csv', cols, ['x'], target), (e) => e.code === 'CHANGED_DURING_WRITE');
  target = env.ctx.store_read_('BLD-area_reading.csv', true);
  f.content = f.content.replace('sneaky,edit', 'sneaky,EDIT'); // same length, different text: a size check would miss this
  assert.equal(Buffer.byteLength(f.content), target.size);
  assert.throws(() => env.ctx.store_append_('BLD-area_reading.csv', cols, ['x'], target), (e) => e.code === 'CHANGED_DURING_WRITE');
});

// ------------------------------------------------------------------ optional daily backup
test('backup is off by default and copies nothing', () => {
  const env = standardEnv();
  env.ctx.adminDailyBackup();
  assert.equal(env.copies.length, 0);
  assert.equal(Object.keys(env.subfolders).length, 0);
  assert.ok(env.logs.some((l) => /Backup is off/.test(l)));
});

test('backup when on: one copy per existing file per day, in BLD-backups, nothing deleted or overwritten', () => {
  const env = standardEnv({ props: { BACKUP_ON: 'true' } });
  const live = JSON.stringify(env.drive);
  env.ctx.adminDailyBackup();
  assert.deepEqual(env.copies.map((c) => c.name).sort(),
    ['BLD-_pending.csv.pre-daily-2026-10-15.bak', 'BLD-area_reading.csv.pre-daily-2026-10-15.bak', 'BLD-occupancy.csv.pre-daily-2026-10-15.bak', 'BLD-occupancy_check.csv.pre-daily-2026-10-15.bak']);
  assert.equal(JSON.stringify(env.drive), live);            // the live files are untouched
  env.ctx.adminDailyBackup();                               // same day again: nothing new
  assert.equal(env.copies.length, 4);
  env.nowMs += 24 * 3600000;
  env.ctx.adminDailyBackup();                               // next day: four more, the old ones stay
  assert.equal(env.copies.length, 8);
  assert.equal(env.subfolders['BLD-backups'].files.length, 8);
  assert.equal(env.writes.length, 0);
});

test('backup schedule installs once and removes without touching copies', () => {
  const env = standardEnv({ props: { BACKUP_ON: 'true' } });
  env.ctx.adminInstallDailyBackup(); env.ctx.adminInstallDailyBackup();
  assert.equal(env.triggers.length, 1);
  env.ctx.adminDailyBackup();
  env.ctx.adminRemoveDailyBackup();
  assert.equal(env.triggers.length, 0);
  assert.equal(env.copies.length, 4);
});

test('bad requests are not understood, not crashed on', () => {
  const env = standardEnv();
  const post = (body) => JSON.parse(env.ctx.doPost({ postData: { contents: body } }).getContent());
  assert.equal(post('not json').code, 'BAD_REQUEST');
  assert.equal(post('"just a string"').code, 'BAD_REQUEST');
  assert.equal(post(JSON.stringify(req(env, { action: 'delete' }))).code, 'BAD_REQUEST');
  assert.equal(post(JSON.stringify(req(env, { request_id: 'x' }))).code, 'BAD_REQUEST');
  assert.equal(post('x'.repeat(20001)).code, 'BAD_REQUEST');
  const okRes = post(JSON.stringify(req(env)));
  assert.equal(okRes.ok, true);
  assert.equal(okRes.result.status, 'saved');   // temperature readings go straight in (Lisa, 16 Oct)
});

test('status check shows switches only: no codes, no ids, no data', () => {
  const env = standardEnv();
  const out = JSON.parse(env.ctx.doGet({ parameter: {} }).getContent());
  assert.equal(out.ok, true);
  assert.equal(out.saveEnabled, true);
  const s = JSON.stringify(out);
  assert.ok(!s.includes(env.codes.staff) && !s.includes(fx.TENANT) && !s.includes('FOLDER-TEST'));
  assert.deepEqual(Array.from(out.tables).map((t) => t.key), ['area_reading', 'occupancy', 'occupancy_check']);
  assert.deepEqual(Array.from(out.tables).map((t) => t.on), [true, false, false]);        // occupancy and the daily check have their own switches, OFF
  assert.deepEqual(Array.from(out.tables).map((t) => t.mode), ['direct', 'pending', 'direct']);   // temperature straight in, moves queue, the check log straight in
  assert.equal(out.readEnabled, false);                                                    // reading is OFF by default
  assert.deepEqual(Array.from(out.proposed), ['staff']);
  // approval page is only for owners
  assert.match(env.ctx.doGet({ parameter: { page: 'approve' } }).html, /for the kennel owner/);
  env.email = 'owner@example.test';
  assert.match(env.ctx.doGet({ parameter: { page: 'approve' } }).html, /ApprovePage/);
});

// ------------------------------------------------------------------ 9. admin tools
test('admin: empty files are created only when allowed, only the listed ones, never over an existing file', () => {
  const env = standardEnv({ noTargets: true });
  env.ctx.adminCreateEmptyTables();
  assert.equal(env.created.length, 0);
  assert.ok(env.logs.some((l) => /Refused/.test(l)));
  env.props.ALLOW_CREATE = 'true';
  env.ctx.adminCreateEmptyTables();
  assert.deepEqual(env.created.sort(), ['BLD-_pending.csv', 'BLD-area_reading.csv', 'BLD-occupancy_check.csv']);
  assert.equal(env.text('BLD-area_reading.csv'), fx.headerOnly(fx.AREA_READING_HEADER));
  assert.equal(env.text('BLD-_pending.csv'), fx.headerOnly(fx.PENDING_HEADER));
  assert.equal(env.text('BLD-occupancy_check.csv'), fx.headerOnly(fx.OCCUPANCY_CHECK_HEADER));
  env.created.length = 0;
  env.ctx.adminCreateEmptyTables(); // second run: nothing is overwritten
  assert.equal(env.created.length, 0);
  assert.equal(env.writes.length, 0);
});

test('admin: health check changes nothing and speaks plainly', () => {
  const env = standardEnv();
  env.ctx.adminCheckSetup();
  assert.equal(env.writes.length, 0);
  assert.ok(env.logs.some((l) => /BLD-area_reading.csv exists with 0 row/.test(l)));
  assert.ok(env.logs.some((l) => /BLD-_pending.csv exists with 0 row/.test(l)));
  assert.ok(!env.logs.some((l) => /BLD-staff.csv/.test(l))); // proposed tables are not checked
  assert.ok(env.logs.some((l) => /SAVE_ENABLED is TRUE/.test(l)));
});

// ------------------------------------------------------------------ 10. the pending queue is itself append-only
test('nothing the sink ever does shortens or edits any file', () => {
  const env = standardEnv();
  const a = save(env, req(env));
  env.nowMs += 13 * 3600000;
  const b = save(env, req(env, { fields: { area_id: 'area-t2', min_c: '19', max_c: '23' } }));
  env.email = 'owner@example.test';
  env.ctx.ui_decide(a.result.pending_id, 'approve', '');
  env.ctx.ui_decide(b.result.pending_id, 'reject', 'no');
  assertAppendOnly(env);
  assert.ok(env.writes.every((w) => ['BLD-area_reading.csv', 'BLD-_pending.csv'].includes(w.title)));
  assert.equal(env.drive.filter((f) => f.title === 'BLD-area.csv')[0].content, require('./fixtures').csvFiles()['BLD-area.csv']);
});

// ================================================================== occupancy (live table, own switch, append-only)
const occTable = (env) => rows(env, 'BLD-occupancy.csv');
const move = (env, subject_id, area_id, over = {}) => save(env, req(env, Object.assign({ table: 'occupancy', fields: { subject_id, area_id } }, over)));

test('occupancy is on the allow-list but behind its own switch, OFF by default', () => {
  const env = standardEnv();
  const before = env.text('BLD-occupancy.csv');
  const r = move(env, 'sub-test-b', 'area-t2');
  assert.equal(r.code, 'TABLE_OFF');
  assert.equal(env.text('BLD-occupancy.csv'), before);
  assert.equal(env.writes.length, 0);
  assert.ok(env.ctx.allowedFiles_().indexOf('BLD-occupancy.csv') >= 0);
});

test('a move APPENDS one new row (subject, room, moved_in = today); no existing row changes and moved_out is never written', () => {
  const env = standardEnv({ props: { TABLE_ON_occupancy: 'true', MODE_occupancy: 'direct' } });
  const before = env.text('BLD-occupancy.csv');
  const r = move(env, 'sub-test-b', 'area-t2');
  assert.equal(r.ok, true);
  assert.equal(r.result.status, 'saved');
  const after = env.text('BLD-occupancy.csv');
  assert.ok(after.startsWith(before));
  assert.equal(lines(after).length, lines(before).length + 1);
  const row = occTable(env).pop();
  assert.match(row.id, /^occ-20261015-233000-[a-z0-9]{4}$/);
  assert.equal(row.tenant_id, fx.TENANT);
  assert.equal(row.subject_id, 'sub-test-b');
  assert.equal(row.area_id, 'area-t2');
  assert.equal(row.moved_in, '2026-10-15');                 // set by the script (London date), never by the browser
  ['off_site_kind', 'moved_out', 'classification', 'classification_note'].forEach((c) => assert.equal(row[c], '', c));
  assert.equal(env.writes.length, 1);
  assertAppendOnly(env);
  // the live header is untouched: only existing BLD column names are used
  assert.deepEqual(Array.from(env.ctx.TABLES.occupancy.columns), fx.OCCUPANCY_HEADER);
});

test('current room = the latest moved_in; moving into the room it is already in is refused (it has not moved)', () => {
  const env = standardEnv({ props: { TABLE_ON_occupancy: 'true', MODE_occupancy: 'direct' } });
  // Test A has an older row for t1 and a newer one for t2: it is in t2
  assert.equal(env.ctx.occupancyLatest_(occTable(env), 'sub-test-a').area_id, 'area-t2');
  const same = move(env, 'sub-test-a', 'area-t2');
  assert.equal(same.code, 'INVALID');
  assert.match(same.fields.area_id, /has not moved/);
  assert.equal(move(env, 'sub-test-a', 'area-t1').ok, true);          // a real move back to t1 is fine
  assert.equal(env.ctx.occupancyLatest_(occTable(env), 'sub-test-a').area_id, 'area-t1');
  assertAppendOnly(env);
});

test('a dog recorded as sold, collected or owned by a family cannot be moved here; a dog with no row can be placed', () => {
  const env = standardEnv({ props: { TABLE_ON_occupancy: 'true', MODE_occupancy: 'direct' } });
  assert.match(move(env, 'sub-test-c', 'area-t1').fields.subject_id, /no longer on site/);
  assert.match(move(env, 'sub-test-d', 'area-t1').fields.subject_id, /no longer on site/);
  assert.equal(move(env, 'sub-test-e', 'area-t1').ok, true);
});

test('occupancy input is checked: unknown dog or room, fields the system fills, corrections are not offered', () => {
  const env = standardEnv({ props: { TABLE_ON_occupancy: 'true', MODE_occupancy: 'direct' } });
  assert.match(move(env, 'sub-nope', 'area-t1').fields.subject_id, /Not found/);
  assert.match(move(env, 'sub-test-b', 'area-nope').fields.area_id, /Not found/);
  assert.match(save(env, req(env, { table: 'occupancy', fields: { subject_id: 'sub-test-b', area_id: 'area-t2', moved_in: '2020-01-01' } })).fields.moved_in, /system fills/);
  assert.match(save(env, req(env, { table: 'occupancy', fields: { subject_id: 'sub-test-b', area_id: 'area-t2', moved_out: '2026-10-15' } })).fields.moved_out, /system fills/);
  const c = save(env, req(env, { table: 'occupancy', action: 'correct', corrects_id: 'occ-a2', reason: 'wrong room', fields: { subject_id: 'sub-test-a', area_id: 'area-t1' } }));
  assert.equal(c.code, 'CORRECT_NOT_SUPPORTED');
  assert.match(c.message, /moving the dog again/);
  assert.equal(env.writes.length, 0);
});

test('occupancy in pending mode (its default): the move waits in the approvals queue and Lisa\'s approval appends the row', () => {
  const env = standardEnv({ props: { TABLE_ON_occupancy: 'true' } });
  const before = env.text('BLD-occupancy.csv');
  const r = move(env, 'sub-test-b', 'area-t2');
  assert.equal(r.result.status, 'queued');
  assert.equal(env.text('BLD-occupancy.csv'), before);
  assert.match(move(env, 'sub-test-b', 'area-t2').fields.area_id, /has not moved/);       // a waiting move counts as the current room
  env.email = 'owner@example.test';
  assert.equal(env.ctx.ui_decide(r.result.pending_id, 'approve', '').ok, true);
  assert.equal(occTable(env).pop().subject_id, 'sub-test-b');
  assertAppendOnly(env);
});

test('a failed read-back on the occupancy file puts the exact old text back and logs it', () => {
  const env = standardEnv({ props: { TABLE_ON_occupancy: 'true', MODE_occupancy: 'direct' } });
  const before = env.text('BLD-occupancy.csv');
  env.breakSetContent = 'once'; env.breakTitle = 'BLD-occupancy.csv';
  const r = move(env, 'sub-test-e', 'area-t1');
  assert.equal(r.code, 'VERIFY_FAILED');
  assert.equal(env.text('BLD-occupancy.csv'), before);
  const ev = rows(env, 'BLD-_pending.csv').pop();
  assert.equal(ev.event, 'write_check_failed');
  assert.equal(ev.target_file, 'BLD-occupancy.csv');
});

// ================================================================== the code-gated READ action (default deny)
function read(env, over = {}) {
  try { return { ok: true, result: env.ctx.sinkRead_(Object.assign({ v: 1, action: 'read', code: env.codes.staff, table: 'area' }, over)) }; }
  catch (e) { return env.ctx.errorBody_(e); }
}
const withRead = (props = {}) => standardEnv({ props: Object.assign({ READ_ENABLED: 'true' }, props) });
/** Replace the permissions file with these lines (header added). */
function setVisibility(env, rowsText) { env.file('BLD-field_visibility.csv')[0].content = [fx.VIS_HEADER].concat(rowsText).join('\r\n') + '\r\n'; }
const fv = (table, field, aud, visible, cond = '', red = '') => `fv-x,${fx.TENANT},${table},${field},${aud},${visible},${cond},${red},t,2026-10-16,t`;

test('reading is OFF by default and nothing is returned', () => {
  const env = standardEnv();
  const r = read(env);
  assert.equal(r.code, 'READ_OFF');
  assert.equal(JSON.stringify(r).includes('area-t1'), false);
});

test('a bad, missing or switched-off code gets nothing, and wrong codes are counted', () => {
  const env = withRead();
  [['NOTACODE999', 'BAD_CODE'], ['', 'NO_CODE'], [undefined, 'NO_CODE']].forEach(([code, want]) => {
    const r = read(env, { code });
    assert.equal(r.code, want);
    assert.equal(r.result, undefined);
    assert.equal(r.rows, undefined);
    assert.equal(JSON.stringify(r).includes('area-t1'), false);
  });
  for (let i = 0; i < 25; i++) read(env, { code: 'WRONGWRONG' + i });
  assert.equal(read(env).code, 'TOO_MANY_TRIES');                                  // even the right code, like saving
  const env2 = withRead();
  const reg = JSON.parse(env2.props.STAFF_REGISTRY);
  Object.keys(reg).forEach((h) => { if (reg[h].who === 'Sam Staff') reg[h].active = false; });
  env2.props.STAFF_REGISTRY = JSON.stringify(reg);
  assert.equal(read(env2).code, 'BAD_CODE');
});

test('a role sees only the columns Lisa allowed: no tenant_id, no unlisted column, nothing with a condition or redaction', () => {
  const env = withRead();
  let r = read(env, { table: 'area' });
  assert.equal(r.ok, true);
  assert.deepEqual(Array.from(r.result.fields), ['id', 'code', 'grouping', 'group_sort']);   // not area_value, m2_confirmed, m2_note, tenant_id
  assert.equal(r.result.count, 3);
  r.result.rows.forEach((row) => assert.deepEqual(Object.keys(row), ['id', 'code', 'grouping', 'group_sort']));
  r = read(env, { table: 'subject' });
  assert.deepEqual(Array.from(r.result.fields), ['id', 'name', 'dob']);                      // chip_number (condition) and sex (redaction) stay hidden
  assert.equal(JSON.stringify(r).includes('999000000000001'), false);
  r = read(env, { table: 'occupancy' });
  assert.deepEqual(Array.from(r.result.fields), ['subject_id', 'area_id', 'off_site_kind', 'moved_in', 'classification']);   // not id, moved_out, classification_note
  assert.equal(JSON.stringify(r).includes('SLA label'), true);                               // classification is allowed, its text is returned
  assert.equal(env.writes.length, 0);                                                         // reading never writes
  assert.equal(env.created.length, 0);
});

test('a "no" row beats a "yes" row for the same column (area_reading.mitigation_note is hidden from staff, shown to the owner)', () => {
  const env = withRead();
  assert.equal(save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '29', mitigation_note: 'fans on' } })).ok, true);
  const s = read(env, { table: 'area_reading' });
  assert.deepEqual(Array.from(s.result.fields), ['id', 'area_id', 'min_c', 'max_c', 'taken_at', 'taken_by']);
  assert.equal(JSON.stringify(s).includes('fans on'), false);
  const o = read(env, { table: 'area_reading', code: env.codes.owner });
  assert.equal(o.result.fields.indexOf('mitigation_note') >= 0, true);
  assert.equal(o.result.rows[0].mitigation_note, 'fans on');
});

test('a role sees only the rows Lisa allowed: own_rows_days<=14 means my own entries from the last 14 days', () => {
  const env = withRead();
  assert.equal(save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '22' } })).ok, true);                         // Sam, day 0
  assert.equal(save(env, req(env, { code: env.codes.owner, fields: { area_id: 'area-t2', min_c: '19', max_c: '21' } })).ok, true);  // Olive, day 0
  let r = read(env, { table: 'area_reading' });
  assert.equal(r.result.count, 1);                                                  // Sam sees Sam's only
  assert.equal(r.result.rows[0].taken_by, 'Sam Staff');
  assert.match(r.result.scope, /your own rows from the last 14 days/);
  assert.equal(read(env, { table: 'area_reading', code: env.codes.owner }).result.count, 2);   // the owner row rule is "all rows"
  env.nowMs += 15 * 86400000;                                                       // 15 days on: Sam's earlier entry is out of range
  r = read(env, { table: 'area_reading' });
  assert.equal(r.result.count, 0);
  assert.equal(read(env, { table: 'area_reading', code: env.codes.owner }).result.count, 2);
});

test('default deny: no row, an unreadable row rule, a "no" row rule or an unsupported rule all mean nothing', () => {
  const env = withRead();
  // no rows for occupancy_check at all (and the file does not exist): denied, not "missing", so nothing is revealed
  assert.equal(read(env, { table: 'occupancy_check' }).code, 'NOT_ALLOWED');
  const cols = ['subject_id', 'area_id'].map((f) => fv('occupancy', f, 'aud-staff', 'yes'));
  [
    [],                                                                  // columns but no row rule
    [fv('occupancy', '*', 'aud-staff', 'no')],                           // row rule says no
    [fv('occupancy', '*', 'aud-staff', 'yes', 'rows_days<=abc')],        // not understood
    [fv('occupancy', '*', 'aud-staff', 'yes', 'rows_days<=14')],         // understood, but occupancy has no date column to apply it to
    [fv('occupancy', '*', 'aud-staff', 'yes', 'own_rows_days<=14')],     // ... nor an author column
    [fv('occupancy', '*', 'aud-staff', 'yes', 'all; DROP')],             // junk
    [fv('occupancy', '*', 'aud-staff', 'yes'), fv('occupancy', '*', 'aud-staff', 'yes', 'garbage')]   // one bad rule poisons the lot
  ].forEach((rule, i) => {
    setVisibility(env, cols.concat(rule));
    assert.equal(read(env, { table: 'occupancy' }).code, 'NOT_ALLOWED', 'case ' + i);
  });
  setVisibility(env, [fv('occupancy', '*', 'aud-staff', 'yes')]);          // a row rule but no columns
  assert.equal(read(env, { table: 'occupancy' }).code, 'NOT_ALLOWED');
  setVisibility(env, cols.concat([fv('occupancy', '*', 'aud-staff', 'yes')]));   // a proper pair works
  assert.equal(read(env, { table: 'occupancy' }).ok, true);
  setVisibility(env, cols.concat([fv('occupancy', '*', 'aud-admin', 'yes')]));   // rows for another audience do not help staff
  assert.equal(read(env, { table: 'occupancy' }).code, 'NOT_ALLOWED');
  setVisibility(env, cols.map((c) => c.replace('aud-staff', 'aud-public')).concat([fv('occupancy', '*', 'aud-public', 'yes')]));
  assert.equal(read(env, { table: 'occupancy' }).code, 'NOT_ALLOWED');
});

test('roles without an audience (vet, trainer) and a missing or malformed permissions file get nothing', () => {
  const env = withRead();
  const salt = env.props.CODE_SALT, reg = JSON.parse(env.props.STAFF_REGISTRY);
  reg[env.ctx.hashCode_('VETCODE12345', salt)] = { who: 'Vera Vet', role: 'VET', active: true };
  env.props.STAFF_REGISTRY = JSON.stringify(reg);
  assert.equal(read(env, { code: 'VETCODE12345' }).code, 'NOT_ALLOWED');
  env.drive = env.drive.filter((f) => f.title !== 'BLD-field_visibility.csv');
  assert.equal(read(env).code, 'READ_NOT_CONFIGURED');
  env.addFile('BLD-field_visibility.csv', 'id,table_name\r\nx,area\r\n');
  assert.equal(read(env).code, 'READ_NOT_CONFIGURED');
  env.file('BLD-field_visibility.csv')[0].content = fx.VIS_HEADER + '\r\n';                         // header only
  assert.equal(read(env).code, 'NOT_ALLOWED');
});

test('only the listed lists can be read: not the approvals queue, not the permissions file, not a path', () => {
  const env = withRead();
  ['pending', '_pending', 'BLD-_pending.csv', 'field_visibility', 'BLD-field_visibility.csv', 'person', 'staff', '../BLD-area.csv', 'constructor', '__proto__', 'hasOwnProperty', '', undefined, 7, { a: 1 }]
    .forEach((t) => assert.equal(read(env, { table: t }).code, 'FILE_NOT_ALLOWED', String(t)));
  // extra things in the request cannot widen a read
  const r = read(env, { table: 'area', fields: { area_value: 1 }, where: '1=1', rows: 'all', columns: ['area_value'], audience: 'aud-admin', role: 'OWNER' });
  assert.deepEqual(Array.from(r.result.fields), ['id', 'code', 'grouping', 'group_sort']);
});

test('rows of another tenant are never returned, and a long list is capped', () => {
  const env = withRead();
  env.file('BLD-occupancy.csv')[0].content += 'occ-x,ten-other,sub-zzz,area-x,,2026-10-01,,,\r\n';
  const r = read(env, { table: 'occupancy' });
  assert.equal(r.result.rows.some((x) => x.subject_id === 'sub-zzz'), false);
  env.ctx.BLD.LIMITS.READ_MAX_ROWS = 2;
  const c = read(env, { table: 'occupancy' });
  assert.equal(c.result.count, 2);
  assert.equal(c.result.truncated, true);
});

test('reading is a separate switch from saving, and works through doPost', () => {
  const env = withRead({ SAVE_ENABLED: 'false' });
  const post = (body) => JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
  const out = post({ v: 1, action: 'read', code: env.codes.staff, table: 'area' });
  assert.equal(out.ok, true);
  assert.equal(out.result.count, 3);
  assert.equal(post({ v: 1, action: 'read', code: 'NOTACODE999', table: 'area' }).code, 'BAD_CODE');
  assert.equal(post(req(env)).code, 'SAVE_OFF');                                   // saving is still off
  assert.equal(JSON.parse(env.ctx.doGet({ parameter: {} }).getContent()).readEnabled, true);
});

// ================================================================== OWNER EDIT: Lisa overwrites a wrong entry in place (owner page only)
const asOwner = (env) => { env.email = 'owner@example.test'; };
function seedThree(env) {
  const ids = [];
  [['area-t1', '20', '22'], ['area-t2', '19', '21'], ['area-t3-1', '18', '20']].forEach(([a, mn, mx]) => {
    const r = save(env, req(env, { fields: { area_id: a, min_c: mn, max_c: mx } }));
    assert.equal(r.ok, true);
    ids.push(r.result.id);
  });
  return ids;
}

test('owner edit is OFF by default: nothing changes, even for the owner', () => {
  const env = standardEnv();
  const [, mid] = seedThree(env);
  asOwner(env);
  const before = env.text('BLD-area_reading.csv');
  const r = env.ctx.ui_edit('area_reading', mid, { min_c: '10' });
  assert.equal(r.code, 'EDIT_OFF');
  assert.equal(env.ctx.ui_editList('area_reading').code, 'EDIT_OFF');
  assert.equal(env.text('BLD-area_reading.csv'), before);
});

test('owner edit REPLACES the row in place; every other row is byte-for-byte unchanged; no record of the change is kept', () => {
  const env = standardEnv({ props: { OWNER_EDIT_ENABLED: 'true' } });
  const [a, b, c] = seedThree(env);
  const queueBefore = env.text('BLD-_pending.csv');
  const lns = lines(env.text('BLD-area_reading.csv'));
  const writesBefore = env.writes.length;
  asOwner(env);
  const list = env.ctx.ui_editList('area_reading');
  assert.equal(list.ok, true);
  assert.deepEqual(Array.from(list.result.rows).map((x) => x.id), [c, b, a]);               // newest first
  const r = env.ctx.ui_edit('area_reading', b, { min_c: '19.5', max_c: '21.25', mitigation_note: 'thermometer was misread' });
  assert.equal(r.ok, true);
  assert.equal(r.result.status, 'edited');
  assert.deepEqual(Array.from(r.result.changed).sort(), ['max_c', 'min_c', 'mitigation_note']);
  const after = lines(env.text('BLD-area_reading.csv'));
  assert.equal(after.length, lns.length);                                                    // replaced, not appended
  assert.equal(after[0], lns[0]);                                                            // header
  assert.equal(after[1], lns[1]);                                                            // row a untouched
  assert.equal(after[3], lns[3]);                                                            // row c untouched
  const row = rows(env, 'BLD-area_reading.csv')[1];
  assert.equal(row.id, b);                                                                   // same id
  assert.equal(row.min_c, '19.50');                                                          // new values, kept to 2 dp
  assert.equal(row.max_c, '21.25');
  assert.equal(row.mitigation_note, 'thermometer was misread');
  assert.equal(row.taken_by, 'Sam Staff');                                                   // stamped fields untouched
  assert.equal(row.area_id, 'area-t2');
  assert.equal(env.writes.length, writesBefore + 1);                                         // exactly one file write
  const w = env.writes[env.writes.length - 1];
  assert.equal(w.title, 'BLD-area_reading.csv');
  assert.equal(env.text('BLD-_pending.csv'), queueBefore);                                   // NO event, NO record of the old value
  assert.equal(JSON.stringify(env.drive.map((f) => f.content)).includes(' 19.00') , false);
  assert.equal(env.text('BLD-area_reading.csv').includes('19.00'), false);                   // the old value is gone from the file
  // a staff save after the edit still appends cleanly and the edit survives
  env.nowMs += 13 * 3600000;
  assert.equal(save(env, req(env, { fields: { area_id: 'area-t1', min_c: '21', max_c: '23' } })).ok, true);
  const all = rows(env, 'BLD-area_reading.csv');
  assert.equal(all.length, 4);
  assert.equal(all[1].min_c, '19.50');
});

test('owner edit of an OLD row: an unchanged old period_start is not re-checked (no "more than 7 days ago")', () => {
  const env = standardEnv({ props: { OWNER_EDIT_ENABLED: 'true' } });
  const ps = '2026-10-15T07:40:00+01:00';
  const r = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '22', period_start: ps } }));
  env.nowMs += 40 * 86400000;
  asOwner(env);
  const e = env.ctx.ui_edit('area_reading', r.result.id, { period_start: ps, mitigation_note: 'added later' });
  assert.equal(e.ok, true);
  assert.deepEqual(Array.from(e.result.changed), ['mitigation_note']);
  assert.equal(rows(env, 'BLD-area_reading.csv')[0].period_start, ps);
  // but a CHANGED date is checked
  const bad = env.ctx.ui_edit('area_reading', r.result.id, { period_start: '2026-01-01T00:00:00Z' });
  assert.match(bad.fields.period_start, /7 days/);
});

test('owner edit of an occupancy row (including moved_out, which staff can never set); other rows unchanged', () => {
  const env = standardEnv({ props: { OWNER_EDIT_ENABLED: 'true' } });
  const lns = lines(env.text('BLD-occupancy.csv'));
  asOwner(env);
  const r = env.ctx.ui_edit('occupancy', 'occ-a2', { moved_out: '2026-10-12', area_id: 'area-t3-1' });
  assert.equal(r.ok, true);
  const after = lines(env.text('BLD-occupancy.csv'));
  assert.equal(after.length, lns.length);
  after.forEach((l, i) => { if (i !== 2) assert.equal(l, lns[i], 'line ' + i); });       // only line 2 (occ-a2) differs
  const row = rows(env, 'BLD-occupancy.csv')[1];
  assert.equal(row.id, 'occ-a2');
  assert.equal(row.moved_out, '2026-10-12');
  assert.equal(row.area_id, 'area-t3-1');
  assert.equal(row.subject_id, 'sub-test-a');                                               // not editable, untouched
  assert.match(env.ctx.ui_edit('occupancy', 'occ-a2', { area_id: 'area-nope' }).fields.area_id, /Not found/);
  assert.match(env.ctx.ui_edit('occupancy', 'occ-a2', { moved_in: '15/10/2026' }).fields.moved_in, /YYYY-MM-DD/);
});

test('a staff code can NEVER edit or delete: not by the save endpoint, not with an owner-role code, not by the owner functions', () => {
  const env = standardEnv({ props: { OWNER_EDIT_ENABLED: 'true' } });
  const [, mid] = seedThree(env);
  const snapshot = JSON.stringify(env.drive);
  const post = (body) => JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
  ['edit', 'update', 'overwrite', 'delete', 'replace', 'remove'].forEach((action) => {
    [env.codes.staff, env.codes.owner].forEach((code) => {
      const out = post(req(env, { action, code, corrects_id: mid, row_id: mid, fields: { min_c: '1', max_c: '2', area_id: 'area-t1' } }));
      assert.equal(out.ok, false, action);
      assert.equal(out.code, 'BAD_REQUEST', action);
    });
  });
  // the owner functions need a signed-in Google owner account: nobody, a staff Google account, or a code are all refused
  ['', 'sam@example.test', 'OWNER-CODE-GUESS'].forEach((who) => {
    env.email = who;
    assert.equal(env.ctx.ui_edit('area_reading', mid, { min_c: '1' }).code, 'NOT_OWNER', who);
    assert.equal(env.ctx.ui_editList('area_reading').code, 'NOT_OWNER', who);
    assert.equal(env.ctx.ui_decide('pnd-x', 'approve', '').code, 'NOT_OWNER', who);
  });
  assert.equal(JSON.stringify(env.drive), snapshot);                                         // not one byte moved
  // a staff code in the request body is not an owner session either
  env.email = '';
  assert.equal(env.ctx.ui_edit('area_reading', mid, { min_c: '1', code: env.codes.owner }).code, 'NOT_OWNER');
  assert.equal(JSON.stringify(env.drive), snapshot);
});

test('owner edit only reaches the two table files; never the approvals queue, the lookups or a proposed table', () => {
  const env = standardEnv({ props: { OWNER_EDIT_ENABLED: 'true' } });
  seedThree(env);
  asOwner(env);
  const snapshot = JSON.stringify(env.drive);
  ['pending', '_pending', 'BLD-_pending.csv', 'area', 'BLD-area.csv', 'subject', 'staff', 'occupancy_check', 'round_event', 'BLD-field_visibility.csv', '', '__proto__']
    .forEach((t) => assert.equal(env.ctx.ui_edit(t, 'x1', { min_c: '1' }).code, 'FILE_NOT_ALLOWED', t));
  assert.throws(() => env.ctx.store_replaceRow_('BLD-_pending.csv', fx.PENDING_HEADER, 0, [], { header: fx.PENDING_HEADER, file: {}, text: '', records: [] }), (e) => e.code === 'FILE_NOT_ALLOWED');
  assert.throws(() => env.ctx.store_replaceRow_('BLD-area.csv', ['id'], 0, [], { header: ['id'], file: {}, text: '', records: [] }), (e) => e.code === 'FILE_NOT_ALLOWED');
  assert.equal(JSON.stringify(env.drive), snapshot);
});

test('owner edit refuses plainly: unknown entry, fields it cannot change, bad values, no change, another kennel\'s row', () => {
  const env = standardEnv({ props: { OWNER_EDIT_ENABLED: 'true' } });
  const [a] = seedThree(env);
  asOwner(env);
  env.file('BLD-area_reading.csv')[0].content += `rdg-other,ten-other,area-t1,temperature,1.00,2.00,,2,,,,,,,,,,,\r\n`;
  const snapshot = JSON.stringify(env.drive);
  assert.equal(env.ctx.ui_edit('area_reading', 'rdg-nope', { min_c: '1' }).code, 'NOT_FOUND');
  assert.equal(env.ctx.ui_edit('area_reading', 'rdg-other', { min_c: '1' }).code, 'NOT_FOUND');     // other tenant
  assert.equal(env.ctx.ui_edit('area_reading', '', { min_c: '1' }).code, 'INVALID');
  const f = env.ctx.ui_edit('area_reading', a, { id: 'rdg-new', tenant_id: 'ten-other', taken_by: 'Someone', taken_at: '2020-01-01T00:00:00Z', corrects_id: 'x' });
  assert.equal(f.code, 'INVALID');
  ['id', 'tenant_id', 'taken_by', 'taken_at', 'corrects_id'].forEach((k) => assert.match(f.fields[k], /not a field the owner edit can change/));
  assert.match(env.ctx.ui_edit('area_reading', a, { min_c: 'warm' }).fields.min_c, /degrees C/);
  assert.match(env.ctx.ui_edit('area_reading', a, { min_c: '30', max_c: '10' }).fields.min_c, /cannot be higher/);
  assert.match(env.ctx.ui_edit('area_reading', a, { mitigation_note: '=HYPERLINK("x")' }).fields.mitigation_note, /formula/);
  assert.match(env.ctx.ui_edit('area_reading', a, { area_id: 'area-nope' }).fields.area_id, /Not found/);
  assert.match(env.ctx.ui_edit('area_reading', a, { min_c: '' }).fields.min_c, /needed/);
  assert.equal(env.ctx.ui_edit('area_reading', a, { min_c: '20.00', max_c: '22' }).code, 'NOTHING_CHANGED');
  assert.equal(JSON.stringify(env.drive), snapshot);
});

test('owner edit keeps the lock and the whole-file hash check: a busy lock, a same-length outside edit, and a bad read-back all leave the file exactly as it was', () => {
  const env = standardEnv({ props: { OWNER_EDIT_ENABLED: 'true' } });
  const [, mid] = seedThree(env);
  asOwner(env);
  const before = env.text('BLD-area_reading.csv');
  env.lockBusy = true;
  assert.equal(env.ctx.ui_edit('area_reading', mid, { min_c: '1' }).code, 'BUSY');           // a staff save has the lock
  env.lockBusy = false;
  assert.equal(env.text('BLD-area_reading.csv'), before);
  // the file changes (same length!) between the read and the write
  const spec = env.ctx.TABLES.area_reading;
  const t = env.ctx.store_read_('BLD-area_reading.csv', true);
  const f = env.file('BLD-area_reading.csv')[0];
  f.content = f.content.replace('area-t1', 'area-tX');
  assert.equal(Buffer.byteLength(f.content), t.size);
  assert.throws(() => env.ctx.store_replaceRow_('BLD-area_reading.csv', spec.columns, 1, ['a'], t), (e) => e.code === 'CHANGED_DURING_WRITE');
  f.content = before;
  // the read-back fails once: exact old text back, a failure notice (no old value) in the queue, then it works
  env.breakSetContent = 'once'; env.breakTitle = 'BLD-area_reading.csv';
  const r = env.ctx.ui_edit('area_reading', mid, { min_c: '17.5' });
  assert.equal(r.code, 'VERIFY_FAILED');
  assert.equal(env.text('BLD-area_reading.csv'), before);
  const ev = rows(env, 'BLD-_pending.csv').pop();
  assert.equal(ev.event, 'write_check_failed');
  assert.equal(ev.result, 'old text restored');
  assert.equal(JSON.stringify(ev).includes('19.00'), false);
  env.breakSetContent = false;
  assert.equal(env.ctx.ui_edit('area_reading', mid, { min_c: '17.5' }).ok, true);
  assert.equal(rows(env, 'BLD-area_reading.csv')[1].min_c, '17.50');
});

test('owner edit leaves awkward neighbouring rows alone (quoted commas and line breaks, LF files, no final newline, BOM, blank lines)', () => {
  const env = standardEnv({ props: { OWNER_EDIT_ENABLED: 'true' } });
  const H = fx.AREA_READING_HEADER.join(',');
  const rowLine = (id, note) => `${id},ten-test,area-t1,temperature,20.00,22.00,,2,,2026-10-15T07:00:00+01:00,Sam Staff,,,,,,,,${note}`;
  const odd = [H, rowLine('rdg-1', '"fans on, doors ""open""\nand windows"'), '', rowLine('rdg-2', 'plain'), rowLine('rdg-3', '"line one\r\nline two"')];
  [['\r\n', true], ['\n', false], ['\r\n', false]].forEach(([eol, finalNl], i) => {
    let text = '﻿' + odd.join(eol) + (finalNl ? eol : '');
    if (i === 1) text = odd.join(eol) + (finalNl ? eol : '');
    env.file('BLD-area_reading.csv')[0].content = text;
    const spans = env.ctx.csvSpans_(text);
    assert.equal(spans.length, env.ctx.csvRecords_(text).records.length + 1);             // every real record has a span
    asOwner(env);
    const r = env.ctx.ui_edit('area_reading', 'rdg-2', { min_c: '15', mitigation_note: 'edited, with a comma' });
    assert.equal(r.ok, true, 'variant ' + i);
    const next = env.text('BLD-area_reading.csv');
    const sp2 = env.ctx.csvSpans_(text)[2], sp3 = env.ctx.csvSpans_(text)[3];
    assert.equal(next.slice(0, sp2.start), text.slice(0, sp2.start));                       // everything before the row, byte for byte (incl. BOM, quoted line breaks)
    assert.equal(next.slice(next.length - (text.length - sp3.start)), text.slice(sp3.start)); // everything after
    const recs = env.ctx.csvRecords_(next).records;
    assert.equal(recs.length, 3);
    assert.equal(recs[0].mitigation_note, 'fans on, doors "open"\nand windows');
    assert.equal(recs[1].min_c, '15.00');
    assert.equal(recs[1].mitigation_note, 'edited, with a comma');
    assert.equal(recs[2].mitigation_note, 'line one\r\nline two');
  });
});

test('the PROPOSED permission rows (docs) give staff exactly the daily-check lists and NO past temperature entries (S02-4)', () => {
  const fs = require('node:fs'), path = require('node:path');
  const text = fs.readFileSync(path.join(__dirname, '..', 'docs', 'AA_2026-10-16_JOB4-PROPOSED-visibility-rows__claude-job4.csv'), 'utf8').split('ten-REPLACE-ME').join(fx.TENANT);
  const env = withRead();
  env.file('BLD-field_visibility.csv')[0].content = text;
  assert.equal(text.split('\r\n')[0], fx.VIS_HEADER);                                       // same columns as the live permissions file
  const f = (t, code) => { const r = read(env, { table: t, code: code || env.codes.staff }); return r.ok ? Array.from(r.result.fields) : r.code; };
  assert.deepEqual(f('area'), ['id', 'code', 'grouping', 'group_sort']);
  assert.deepEqual(f('subject'), ['id', 'name']);                                           // no dob, no chip number, no sex
  assert.deepEqual(f('subject_status'), ['subject_id', 'state']);
  assert.deepEqual(f('occupancy'), ['subject_id', 'area_id', 'off_site_kind', 'moved_in', 'classification']);
  assert.equal(f('area_reading'), 'NOT_ALLOWED');                                           // staff: not even their own entries
  assert.equal(f('occupancy_check'), 'NOT_ALLOWED');                                        // nothing proposed for the log itself
  assert.equal(save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '22' } })).ok, true);
  assert.equal(f('area_reading'), 'NOT_ALLOWED');                                           // still nothing after they have saved one
  assert.equal(f('area_reading', env.codes.owner).includes('mitigation_note'), true);       // the owner sees the note
  assert.equal(read(env, { table: 'area_reading', code: env.codes.owner }).result.scope, 'all rows');
});
