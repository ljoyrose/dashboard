'use strict';
/** tools/backfill-rooms.js on FAKE data only. The tool outputs NEW rows and never edits the occupancy file. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { standardEnv } = require('./harness');
const fx = require('./fixtures');
const { backfill, toCsv, main, HEADER } = require('../tools/backfill-rooms.js');
const Lookups = require('../client/drive-lookups.js');
const Occ = require('../client/occupancy.js');

const T = fx.TENANT;
const AREAS = [{ id: 'area-t1', tenant_id: T, code: 'T1' }, { id: 'area-t2', tenant_id: T, code: 'T2' }, { id: 'area-t31', tenant_id: T, code: 'T3.1' }, { id: 'area-x', tenant_id: 'ten-other', code: 'XX' }];
const occ = (id, dog, area, extra = {}) => Object.assign({ id, tenant_id: T, subject_id: dog, area_id: area, off_site_kind: '', moved_in: '', moved_out: '', classification: '', classification_note: '' }, extra);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

test('fills ONLY dogs with no room: blank area_id, or no row at all; every other case is reported and left alone', () => {
  const existing = [
    occ('o1', 'd-blank', ''),                                              // a row with no room
    occ('o2', 'd-blank-dated', '', { moved_in: '2026-10-01' }),            // dated, no room
    occ('o3', 'd-same', 'area-t1', { moved_in: '2026-10-01' }),            // register agrees
    occ('o4', 'd-conflict', 'area-t2', { moved_in: '2026-10-01' }),        // a different room is already recorded
    occ('o5', 'd-sold', '', { off_site_kind: 'sold' }),
    occ('o6', 'd-dead', '', { classification: 'Deceased' }),
    occ('o7', 'd-collected', '', { classification: 'Collected' }),
    occ('o8', 'd-future', '', { moved_in: '2026-11-30' }),                 // dated after the back-fill date
    occ('o9', 'd-old', 'area-t1', { moved_in: '2026-09-01' }), occ('o10', 'd-old', '', { moved_in: '2026-10-05' })   // latest row has no room
  ];
  const register = [
    { dog_id: 'd-blank', room_code: 'T1' }, { dog_id: 'd-blank-dated', room_code: 't3.1' }, { dog_id: 'd-new', room_code: ' T2 ' },
    { dog_id: 'd-same', room_code: 'T1' }, { dog_id: 'd-conflict', room_code: 'T1' }, { dog_id: 'd-sold', room_code: 'T1' },
    { dog_id: 'd-dead', room_code: 'T1' }, { dog_id: 'd-collected', room_code: 'T1' }, { dog_id: 'd-future', room_code: 'T1' },
    { dog_id: 'd-old', room_code: 'T2' },
    { dog_id: 'd-nowhere', room_code: 'ZZ9' },                              // no such room
    { dog_id: 'd-twice', room_code: 'T1' }, { dog_id: 'd-twice', room_code: 'T2' },     // ambiguous
    { dog_id: 'd-dup', room_code: 'T1' }, { dog_id: 'd-dup', room_code: 'T1' },          // same room twice: one row
    { dog_id: 'd-othertenant', room_code: 'XX' },                           // another kennel's room code
    { dog_id: '', room_code: 'T1' }, { dog_id: 'd-noroom', room_code: '' }  // blank lines are ignored
  ];
  const before = JSON.stringify(existing);
  const r = backfill(register, existing, AREAS, { tenant: T, date: '2026-10-20' });
  assert.equal(JSON.stringify(existing), before);                          // the input was not touched
  const got = {}; r.rows.forEach((x) => { got[x.subject_id] = x.area_id; });
  assert.deepEqual(got, { 'd-blank': 'area-t1', 'd-blank-dated': 'area-t31', 'd-new': 'area-t2', 'd-old': 'area-t2', 'd-dup': 'area-t1' });
  assert.deepEqual(JSON.parse(JSON.stringify(r.report)), {
    filled: 5, already_there: 1, conflict: 1, gone: 3, unknown_room: 2, ambiguous: 1, too_early: 1, duplicate: 1, register_dogs: 14
  });
  const why = {}; r.details.forEach((d) => { why[d.dog_id] = d.result; });
  assert.equal(why['d-conflict'], 'conflict'); assert.equal(why['d-future'], 'too_early'); assert.equal(why['d-twice'], 'ambiguous');
  assert.equal(why['d-othertenant'], 'unknown_room');
  // every new row: live header, tenant, back-fill date as moved_in, no moved_out, no classification, unique ids
  r.rows.forEach((x) => {
    assert.deepEqual(Object.keys(x), HEADER);
    assert.equal(x.tenant_id, T); assert.equal(x.moved_in, '2026-10-20');
    ['off_site_kind', 'moved_out', 'classification', 'classification_note'].forEach((c) => assert.equal(x[c], ''));
    assert.match(x.id, /^occ-bf-20261020-\d{4}$/);
  });
  assert.equal(new Set(r.rows.map((x) => x.id)).size, r.rows.length);
});

test('the new rows, appended to a COPY, make each dog\'s current room the register\'s room - in the script and on the screens alike', () => {
  const env = standardEnv();
  const copy = env.text('BLD-occupancy.csv');
  const existing = Lookups.parseCsv(copy);
  // Test B has an undated row in T1; make a blank-room dog from a fresh dog id in the same file
  const blank = existing.concat([occ('occ-blank', 'sub-test-e', '')]);
  const r = backfill([{ dog_id: 'sub-test-e', room_code: 'T3.1' }, { dog_id: 'sub-test-a', room_code: 'T1' }], blank, [{ id: 'area-t3-1', tenant_id: T, code: 'T3.1' }, { id: 'area-t1', tenant_id: T, code: 'T1' }], { tenant: T, date: '2026-10-20' });
  assert.deepEqual(r.rows.map((x) => x.subject_id), ['sub-test-e']);       // sub-test-a is in T2: a conflict, left alone
  assert.equal(r.report.conflict, 1);
  const appended = copy + toCsv(r.rows).split('\r\n').slice(1).join('\r\n');
  env.file('BLD-occupancy.csv')[0].content = appended;
  const rows = env.ctx.csvRecords_(env.text('BLD-occupancy.csv')).records;
  assert.equal(env.ctx.occupancyLatest_(rows, 'sub-test-e').area_id, 'area-t3-1');          // the script's rule
  assert.equal(Occ.latestRow(Lookups.parseCsv(appended), 'sub-test-e').area_id, 'area-t3-1');   // the browser's rule
  assert.ok(appended.startsWith(copy));                                                    // old rows are the first bytes, unchanged
  const list = Occ.dailyList({ area: Lookups.parseCsv(fx.csvFiles()['BLD-area.csv']), subject: Lookups.parseCsv(fx.csvFiles()['BLD-subject.csv']), subject_status: [{ subject_id: 'sub-test-e', state: 'Active' }], occupancy: Lookups.parseCsv(appended) });
  assert.equal(list.dogs.filter((d) => d.id === 'sub-test-e')[0].known, true);
});

test('CLI: reads files, prints NEW rows with CRLF, never changes the occupancy file, refuses to overwrite or write over an input', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-'));
  const f = (n, t) => { const p = path.join(dir, n); fs.writeFileSync(p, t); return p; };
  const occFile = f('occ.csv', fx.csvFiles()['BLD-occupancy.csv'] + `occ-blank,${T},sub-test-e,,,,,,\r\n`);
  const reg = f('reg.csv', 'dog_id,room_code\r\nsub-test-e,T1\r\nsub-test-b,T2\r\n');
  const areas = f('area.csv', fx.csvFiles()['BLD-area.csv']);
  const hashes = [occFile, reg, areas].map((p) => sha(fs.readFileSync(p)));
  const argv = ['--register', reg, '--occupancy', occFile, '--areas', areas, '--tenant', T, '--date', '2026-10-20'];
  let out = '', err = '';
  const res = main(argv, (s) => { out += s; }, (s) => { err += s; });
  assert.equal(res.rows.length, 1);
  assert.equal(out.split('\r\n')[0], HEADER.join(','));
  assert.equal(out.replace(/\r\n/g, '').includes('\n'), false);                          // CRLF throughout
  assert.match(out, /sub-test-e,area-t1,,2026-10-20/);
  assert.match(err, /conflict: sub-test-b/);
  assert.match(err, /NEW rows only \(1\)/);
  // --out writes a NEW file only
  const target = path.join(dir, 'new-rows.csv');
  main(argv.concat(['--out', target]), () => {}, () => {});
  assert.equal(fs.readFileSync(target, 'utf8'), out);
  assert.throws(() => main(argv.concat(['--out', target]), () => {}, () => {}), /never overwrites/);       // exists
  assert.throws(() => main(argv.concat(['--out', occFile]), () => {}, () => {}), /NEW file/);               // the occupancy file itself
  assert.throws(() => main(argv.concat(['--out', reg]), () => {}, () => {}), /NEW file/);
  assert.deepEqual([occFile, reg, areas].map((p) => sha(fs.readFileSync(p))), hashes);                       // inputs are byte-identical
  // bad arguments stop with a plain message
  assert.throws(() => main(argv.slice(0, 8), () => {}, () => {}), /--date is needed/);
  assert.throws(() => main(argv.map((x) => (x === '2026-10-20' ? '20/10/2026' : x)), () => {}, () => {}), /real date/);
  assert.throws(() => main(argv.map((x) => (x === T ? 'nope' : x)), () => {}, () => {}), /--tenant/);
  assert.throws(() => main(['--register'], () => {}, () => {}), /./);
  assert.throws(() => main(['register', 'x'], () => {}, () => {}), /Unknown argument/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('150+ dogs: only the blanks are filled and the rest are untouched', () => {
  const existing = [], register = [];
  for (let i = 1; i <= 160; i++) {
    const id = 'dog-' + String(i).padStart(4, '0');
    existing.push(occ('o' + i, id, i % 3 === 0 ? '' : 'area-t1', { moved_in: i % 3 === 0 ? '' : '2026-10-01' }));
    register.push({ dog_id: id, room_code: i % 2 ? 'T1' : 'T2' });
  }
  const r = backfill(register, existing, AREAS, { tenant: T, date: '2026-10-20' });
  assert.equal(r.rows.length, 53);                                          // every third dog: 3,6,...,159
  assert.equal(r.report.filled + r.report.already_there + r.report.conflict, 160);
  assert.ok(r.rows.every((x) => Number(x.subject_id.slice(4)) % 3 === 0));
});
