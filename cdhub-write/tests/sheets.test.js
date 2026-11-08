'use strict';
/**
 * 7 Nov 2026: every BLD table is now a Google Sheet that keeps its ".csv" name. These tests run the real
 * Store.gs against a fake Sheet (tests/harness.js) and check the same promises the CSV tests check:
 * one row added, nothing else touched, plain text, a change while saving is caught, a failed read-back is undone.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

/** Turn the CSV fakes into Sheet fakes (same rows), as happened in Drive on 7 Nov. */
function asSheets(env, titles) {
  titles.forEach((t) => {
    const f = env.file(t)[0];
    f.sheet = env.ctx.csvParse_(f.content).filter((r) => !(r.length === 1 && r[0] === ''));
    f.fmt = {}; f.maxRows = 1000; delete f.content;
  });
}
const sheetEnv = (props) => {
  const env = standardEnv({ props: Object.assign({ MODE_area_reading: 'direct' }, props || {}) });
  asSheets(env, ['BLD-area_reading.csv', 'BLD-_pending.csv']);
  return env;
};
const recs = (env, t) => { const [h, ...rows] = env.rows(t); return rows.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i] || '']))); };

test('Sheet: a reading is added as ONE plain-text row under the last row, 1 decimal place, range filled in', () => {
  const env = sheetEnv();
  const r = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '11.3', max_c: '14.2' } }));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.status, 'saved');
  const rows = env.rows('BLD-area_reading.csv');
  assert.equal(rows.length, 2);
  assert.deepEqual([...rows[0]], fx.AREA_READING_HEADER);        // header untouched
  const row = recs(env, 'BLD-area_reading.csv')[0];
  assert.equal(row.min_c, '11.3');
  assert.equal(row.max_c, '14.2');
  assert.equal(row[''], '2.9');                                  // the unnamed range column, as in the live Sheet
  assert.equal(row.precision_dp, '1');
  assert.equal(env.file('BLD-area_reading.csv')[0].fmt[2], '@'); // stored as plain text
  assert.equal(env.writes.length, 0);                            // no CSV write at all
  assert.equal(env.sheetWrites.length, 1);
});

test('Sheet: a second save leaves the first row exactly as it was', () => {
  const env = sheetEnv();
  save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '22' } }));
  const first = env.rows('BLD-area_reading.csv')[1].slice();
  const r = save(env, req(env, { fields: { area_id: 'area-t2', min_c: '19', max_c: '21' } }));
  assert.equal(r.ok, true);
  assert.deepEqual(env.rows('BLD-area_reading.csv')[1], first);
  assert.equal(env.rows('BLD-area_reading.csv').length, 3);
});

test('Sheet: 2 decimals are refused (room temperatures are 1 decimal place)', () => {
  const env = sheetEnv();
  const r = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '21.47', max_c: '22' } }));
  assert.equal(r.ok, false);
  assert.equal(r.code, 'INVALID');
  assert.match(r.fields.min_c, /at most 1 decimal/);
  assert.equal(env.rows('BLD-area_reading.csv').length, 1);
});

test('Sheet: a header that differs from the live one (e.g. the unnamed column given a name) stops the save', () => {
  const env = sheetEnv();
  env.rows('BLD-area_reading.csv')[0][6] = 'range_c';
  const r = save(env, req(env));
  assert.equal(r.code, 'HEADER_MISMATCH');
  assert.equal(env.rows('BLD-area_reading.csv').length, 1);
});

test('Sheet: if the table changes between reading and writing, nothing is saved', () => {
  const env = sheetEnv();
  const read = env.ctx.store_read_('BLD-area_reading.csv', true);
  env.rows('BLD-area_reading.csv').push(['rdg-x', fx.TENANT, 'area-t1']);   // someone typed in the Sheet
  assert.throws(() => env.ctx.store_append_('BLD-area_reading.csv', fx.AREA_READING_HEADER, ['a'], read),
    (e) => e.code === 'CHANGED_DURING_WRITE');
  assert.equal(env.rows('BLD-area_reading.csv').length, 2);
});

test('Sheet: a failed read-back takes the added row out again, says so, and logs it', () => {
  const env = sheetEnv();
  env.breakSetValues = 'once'; env.breakTitle = 'BLD-area_reading.csv';
  const r = save(env, req(env));
  assert.equal(r.ok, false);
  assert.equal(r.code, 'VERIFY_FAILED');
  assert.match(r.message, /taken out again/);
  assert.equal(env.rows('BLD-area_reading.csv').length, 1);       // back to header only
  const log = recs(env, 'BLD-_pending.csv');
  assert.equal(log.length, 1);
  assert.equal(log[0].event, 'write_check_failed');
  assert.equal(log[0].result, 'old text restored');
});

test('Sheet: blank rows and empty cells past the header are read safely', () => {
  const env = sheetEnv();
  const rows = env.rows('BLD-area_reading.csv');
  rows[0] = rows[0].concat(['', '']);                            // empty header cells at the end
  rows.push(new Array(rows[0].length).fill(''));                 // a blank row
  const read = env.ctx.store_read_('BLD-area_reading.csv', true);
  assert.deepEqual([...read.header], fx.AREA_READING_HEADER);
  assert.equal(read.records.length, 0);
});

test('Sheet: owner edit changes ONE row in place and every other cell is identical', () => {
  const env = sheetEnv({ OWNER_EDIT_ENABLED: 'true' });
  const ids = [];
  [['area-t1', '20', '22'], ['area-t2', '19', '21'], ['area-t3-1', '18', '20']].forEach(([a, mn, mx]) => {
    env.nowMs += 60 * 60000;
    ids.push(save(env, req(env, { fields: { area_id: a, min_c: mn, max_c: mx } })).result.id);
  });
  const before = env.rows('BLD-area_reading.csv').map((r) => r.slice());
  env.email = 'owner@example.test';
  const r = env.ctx.ui_edit('area_reading', ids[1], { min_c: '18.5' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const after = env.rows('BLD-area_reading.csv');
  assert.deepEqual(after[1], before[1]);
  assert.deepEqual(after[3], before[3]);
  assert.equal(recs(env, 'BLD-area_reading.csv')[1].min_c, '18.5');
});

test('Sheet: a CSV table still works the old way (mixed folder while the last tables are converted)', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  asSheets(env, ['BLD-_pending.csv']);                           // the reading log stays a CSV here
  const r = save(env, req(env));
  assert.equal(r.ok, true);
  assert.equal(env.writes.length, 1);
});

test('Sheet: max lower than min (typed the wrong way round) is refused and nothing is added', () => {
  const env = sheetEnv();
  const r = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '18.2', max_c: '12.4' } }));
  assert.equal(r.ok, false);
  assert.equal(r.code, 'INVALID');
  assert.match(r.fields.min_c, /cannot be higher/);
  assert.equal(env.rows('BLD-area_reading.csv').length, 1);
  assert.equal(env.sheetWrites.length, 0);
});

test('Sheet: max equal to min is allowed and the range column is 0.0, never negative', () => {
  const env = sheetEnv();
  const r = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '19.5', max_c: '19.5' } }));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(recs(env, 'BLD-area_reading.csv')[0][''], '0.0');
});
