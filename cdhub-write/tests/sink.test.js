'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, makeEnv, req, save, nextRid } = require('./harness');
const fx = require('./fixtures');

const lines = (t) => t.split('\r\n').filter(Boolean);
const rows = (env, title) => env.ctx.csvRecords_(env.text(title)).records;

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
  ['BLD-subject.csv', 'BLD-area.csv', 'BLD-occupancy.csv', '../BLD-area_reading.csv', 'area_reading.csv ', '', 'constructor', '__proto__']
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
    ['BLD-_pending.csv', 'BLD-area_reading.csv', 'BLD-round_event.csv', 'BLD-staff.csv']);
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

test('same room again inside the window is a duplicate (use a correction instead)', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  assert.equal(save(env, req(env)).ok, true);
  env.nowMs += 10 * 60000;
  const r = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '21' } }));
  assert.equal(r.ok, false);
  assert.equal(r.code, 'DUPLICATE');
  assert.match(r.message, /correction/);
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
test('default mode is pending: nothing reaches the table until the owner approves', () => {
  const env = standardEnv(); // no MODE_ property = pending
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
  const env = standardEnv();
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
  const env = standardEnv();
  const r = save(env, req(env));
  env.drive = env.drive.map((f) => (f.title === 'BLD-area.csv' ? Object.assign(f, { content: f.content.replace(/^area-t1.*\r\n/m, '') }) : f));
  env.email = 'owner@example.test';
  const d = env.ctx.ui_decide(r.result.pending_id, 'approve', '');
  assert.equal(d.ok, false);
  assert.match(d.message, /no longer in the area list/);
  assert.equal(lines(env.text('BLD-area_reading.csv')).length, 1);
});

test('approving again after a crash does not write a second copy', () => {
  const env = standardEnv();
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
    action: 'correct', corrects_id: first.result.id, reason: 'typed the wrong digit',
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
  const c2 = save(env, req(env, { action: 'correct', corrects_id: first.result.id, reason: 'again', fields: { area_id: 'area-t1', min_c: '20', max_c: '21' } }));
  assert.equal(c2.ok, false);
  assert.match(c2.fields.corrects_id, /already has a correction/);
});

test('a correction needs a real target row and a reason', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  const f = { area_id: 'area-t1', min_c: '20', max_c: '21' };
  let r = save(env, req(env, { action: 'correct', corrects_id: 'rdg-nope', reason: 'because', fields: f }));
  assert.match(r.fields.corrects_id, /not found/);
  const ok = save(env, req(env));
  r = save(env, req(env, { action: 'correct', corrects_id: ok.result.id, reason: '', fields: f }));
  assert.match(r.fields.reason, /why it needs correcting/);
  r = save(env, req(env, { action: 'correct', corrects_id: '', reason: 'abc', fields: f }));
  assert.match(r.fields.corrects_id, /Say which/);
});

test('a waiting correction blocks a second correction of the same row', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  const ok = save(env, req(env));
  const f = { area_id: 'area-t1', min_c: '20', max_c: '21' };
  assert.equal(save(env, req(env, { action: 'correct', corrects_id: ok.result.id, reason: 'first fix', fields: f })).ok, true);
  const r = save(env, req(env, { action: 'correct', corrects_id: ok.result.id, reason: 'second fix', fields: f }));
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

test('each table has its own switch', () => {
  const env = standardEnv({ props: { TABLE_ON_area_reading: 'false' } });
  assert.equal(save(env, req(env)).code, 'TABLE_OFF');
  // round_event and staff are off unless switched on, even with saving ON
  assert.equal(save(env, req(env, { table: 'round_event', fields: {} })).code, 'TABLE_OFF');
  assert.equal(save(env, req(env, { table: 'staff', fields: {} })).code, 'TABLE_OFF');
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

test('roles: staff cannot change the roster; the owner can, but it still waits for approval', () => {
  const env = standardEnv({ props: { TABLE_ON_staff: 'true', MODE_staff: 'direct' } });
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

test('round_event: placed needs a dog, access_set needs a flap setting', () => {
  const env = standardEnv({ props: { TABLE_ON_round_event: 'true', MODE_round_event: 'direct' } });
  env.addFile('BLD-round_event.csv', fx.headerOnly(['id', 'tenant_id', 'round_date', 'area_id', 'subject_id', 'event_type', 'access_type', 'recorded_by', 'recorded_at', 'corrects_id']));
  let r = save(env, req(env, { table: 'round_event', fields: { round_date: '2026-10-15', area_id: 'area-t1', event_type: 'placed' } }));
  assert.match(r.fields.subject_id, /which dog/);
  r = save(env, req(env, { table: 'round_event', fields: { round_date: '2026-10-15', area_id: 'area-t1', event_type: 'access_set' } }));
  assert.match(r.fields.access_type, /free or limited/);
  r = save(env, req(env, { table: 'round_event', fields: { round_date: '2026-10-15', area_id: 'area-t1', subject_id: 'sub-test-a', event_type: 'placed' } }));
  assert.equal(r.result.status, 'saved');
  r = save(env, req(env, { table: 'round_event', fields: { round_date: '2026-10-15', area_id: 'area-t1', subject_id: 'sub-test-zzz', event_type: 'placed' } }));
  assert.match(r.fields.subject_id, /Not found/);
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

test('if Drive hands back something different after the write, the script says so loudly', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  env.breakSetContent = true;
  const r = save(env, req(env));
  assert.equal(r.code, 'VERIFY_FAILED');
  assert.match(r.message, /Tell Lisa/);
});

test('if the file changes size while saving, the save stops', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  const target = env.ctx.store_read_('BLD-area_reading.csv', true);
  env.file('BLD-area_reading.csv')[0].content += 'sneaky,edit\r\n';
  assert.throws(() => env.ctx.store_append_('BLD-area_reading.csv', env.ctx.TABLES.area_reading.columns, ['x'], target), (e) => e.code === 'CHANGED_DURING_WRITE');
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
  assert.equal(okRes.result.status, 'queued');
});

test('status check shows switches only: no codes, no ids, no data', () => {
  const env = standardEnv();
  const out = JSON.parse(env.ctx.doGet({ parameter: {} }).getContent());
  assert.equal(out.ok, true);
  assert.equal(out.saveEnabled, true);
  const s = JSON.stringify(out);
  assert.ok(!s.includes(env.codes.staff) && !s.includes(fx.TENANT) && !s.includes('FOLDER-TEST'));
  assert.deepEqual(out.tables.map((t) => t.key), ['area_reading', 'round_event', 'staff']);
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
  assert.deepEqual(env.created.sort(), ['BLD-_pending.csv', 'BLD-area_reading.csv']);
  assert.equal(env.text('BLD-area_reading.csv'), fx.headerOnly(fx.AREA_READING_HEADER));
  assert.equal(env.text('BLD-_pending.csv'), fx.headerOnly(fx.PENDING_HEADER));
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
  assert.ok(env.logs.some((l) => /BLD-staff.csv does not exist yet/.test(l)));
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
