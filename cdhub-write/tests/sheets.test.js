'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

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
const recs = (env, t) => { const [h, ...rows] = env.rows(t); return rows.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i] === undefined ? '' : r[i]]))); };
const shownRecs = (env, t) => {
  const f = env.file(t)[0], tab = env.tabOf(f), n = f.sheet.length, w = f.sheet[0].length;
  const [h, ...rows] = tab.getRange(1, 1, n, w).getDisplayValues();
  return rows.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i]])));
};
const fmtOf = (env, t, row, col) => env.file(t)[0].cfmt[row + ':' + col];

test('Sheet: a reading is added as ONE row under the last row: temperatures real numbers (1dp), times real dates (UK time)', () => {
  const env = sheetEnv();
  const ps = new Date(env.nowMs - 3600000).toISOString().slice(0, 13) + ':00:00+00:00';
  const r = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '11.3', max_c: '14.2', period_start: ps } }));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.status, 'saved');
  const rows = env.rows('BLD-area_reading.csv');
  assert.equal(rows.length, 2);
  assert.deepEqual([...rows[0]], fx.AREA_READING_HEADER);        // header untouched
  const row = recs(env, 'BLD-area_reading.csv')[0];
  assert.equal(row.min_c, 11.3);
  assert.equal(row.max_c, 14.2);
  assert.equal(row[''], 2.9);                                    // the range column
  assert.equal(row.precision_dp, 1);
  assert.ok(row.period_start instanceof Date && row.period_start.getTime() === Date.parse(ps));
  assert.ok(row.taken_at instanceof Date && row.taken_at.getTime() === env.nowMs - (env.nowMs % 1000));
  assert.equal(typeof row.area_id, 'string');                    // every other column stays text
  assert.equal(typeof row.id, 'string');
  const shown = shownRecs(env, 'BLD-area_reading.csv')[0];
  assert.equal(shown.min_c, '11.3');
  assert.equal(shown[''], '2.9');
  assert.match(shown.period_start, /^\d{4}-\d{2}-\d{2} \d{2}:00$/);
  assert.equal(fmtOf(env, 'BLD-area_reading.csv', 2, 5), '0.0');
  assert.equal(fmtOf(env, 'BLD-area_reading.csv', 2, 3), '@');   // area_id stays plain text
  assert.equal(env.writes.length, 0);                            // no CSV write at all
  assert.equal(env.sheetWrites.length, 1);
});

test('Sheet: area_reading read back gives the same text the hub and staff page send (period_start, numbers)', () => {
  const env = sheetEnv();
  const ps = '2026-10-15T21:00:00+01:00';
  save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '22.5', period_start: ps } }));
  const rec = env.ctx.store_read_('BLD-area_reading.csv', true).records[0];
  assert.equal(rec.period_start, ps);
  assert.match(rec.taken_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  assert.equal(rec.min_c, '20.0');
  assert.equal(rec.max_c, '22.5');
  const again = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '22.5', period_start: ps } }));
  assert.equal(again.code, 'DUPLICATE', JSON.stringify(again));
  assert.equal(env.rows('BLD-area_reading.csv').length, 2);
  const utc = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '22.5', period_start: '2026-10-15T20:00:00Z' } }));
  assert.equal(utc.code, 'DUPLICATE', JSON.stringify(utc));
  assert.equal(env.rows('BLD-area_reading.csv').length, 2);
});

test('Sheet: rows typed by hand (real numbers and real dates) are read as before and left untouched by a save', () => {
  const env = sheetEnv();
  const h = fx.AREA_READING_HEADER, old = h.map(() => '');
  old[0] = 'rdg-old'; old[1] = fx.TENANT; old[2] = 'area-t2'; old[4] = 18; old[5] = 21.5; old[6] = 3.5; old[8] = 1;
  old[9] = new Date('2025-01-01T08:00:00Z'); old[10] = new Date('2025-01-01T08:05:00Z');
  const f = env.file('BLD-area_reading.csv')[0]; f.sheet.push(old); f.cfmt = f.cfmt || {};
  [5, 6, 7, 9].forEach((c) => { f.cfmt['2:' + c] = '0.0'; }); f.cfmt['2:10'] = 'yyyy-mm-dd hh:mm'; f.cfmt['2:11'] = 'yyyy-mm-dd hh:mm';
  const before = old.slice();
  const read = env.ctx.store_read_('BLD-area_reading.csv', true);
  assert.equal(read.records[0].period_start, '2025-01-01T08:00:00+00:00');
  assert.equal(read.records[0].min_c, '18.0');
  const r = save(env, req(env));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(env.rows('BLD-area_reading.csv')[1], before);
});

test('Sheet: other tables still write exactly as before - every cell plain text ("@"), no numbers or dates', () => {
  const env = sheetEnv();
  env.breakSetValues = 'once'; env.breakTitle = 'BLD-area_reading.csv';
  save(env, req(env));
  const w = env.sheetWrites.filter((x) => x.title === 'BLD-_pending.csv');
  assert.equal(w.length, 1);
  w[0].vals.forEach((row) => row.forEach((v) => assert.equal(typeof v, 'string')));
  const f = env.file('BLD-_pending.csv')[0];
  assert.equal(f.fmt[w[0].row], '@');
  Object.keys(f.cfmt).filter((k) => k.startsWith(w[0].row + ':')).forEach((k) => assert.equal(f.cfmt[k], '@'));
  // only area_reading has sheetTypes
  const typed = Object.keys(env.ctx.TABLES).filter((k) => env.ctx.TABLES[k].sheetTypes);
  assert.deepEqual(typed, ['area_reading']);
});

test('Sheet: the 7th column named variance_c in the live Sheet is accepted and filled; blank still works', () => {
  const env = sheetEnv();
  env.rows('BLD-area_reading.csv')[0][6] = 'variance_c';
  const r = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '11.3', max_c: '14.2' } }));
  assert.equal(r.ok, true, JSON.stringify(r));
  const row = recs(env, 'BLD-area_reading.csv')[0];
  assert.equal(row.variance_c, 2.9);
  assert.equal(env.rows('BLD-area_reading.csv')[0][6], 'variance_c');   // the header is left as the owner named it
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

test('Sheet: a header that differs from the live one (any other name for the 7th column) stops the save', () => {
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

test('Sheet: user edit changes ONE row in place and every other cell is identical', () => {
  const env = sheetEnv({ USER_EDIT_ENABLED: 'true' });
  const ids = [];
  [['area-t1', '20', '22'], ['area-t2', '19', '21'], ['area-t3-1', '18', '20']].forEach(([a, mn, mx]) => {
    env.nowMs += 60 * 60000;
    ids.push(save(env, req(env, { fields: { area_id: a, min_c: mn, max_c: mx } })).result.id);
  });
  const before = env.rows('BLD-area_reading.csv').map((r) => r.slice());
  env.email = 'user@example.test';
  const r = env.ctx.ui_edit('area_reading', ids[1], { min_c: '18.5' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const after = env.rows('BLD-area_reading.csv');
  assert.deepEqual(after[1], before[1]);
  assert.deepEqual(after[3], before[3]);
  assert.equal(recs(env, 'BLD-area_reading.csv')[1].min_c, 18.5);
});

test('Sheet: a CSV table still works the old way (mixed folder while the last tables are converted)', () => {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  asSheets(env, ['BLD-_pending.csv']);
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
  assert.equal(recs(env, 'BLD-area_reading.csv')[0][''], 0);
  assert.equal(shownRecs(env, 'BLD-area_reading.csv')[0][''], '0.0');
});

test('Sheet: with the 7th column named variance_c, an user edit keeps it exactly as with the blank name (not emptied)', () => {
  const env = sheetEnv({ USER_EDIT_ENABLED: 'true' });
  env.rows('BLD-area_reading.csv')[0][6] = 'variance_c';
  const id = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '22' } })).result.id;
  env.email = 'user@example.test';
  const r = env.ctx.ui_edit('area_reading', id, { min_c: '18.5' });
  assert.equal(r.ok, true, JSON.stringify(r));
  const row = recs(env, 'BLD-area_reading.csv')[0];
  assert.equal(row.min_c, 18.5);
  assert.equal(row.variance_c, 2);
});

// the owner 16 Nov 2026: saves took about 25 s on the 30,000-row temperature log and blocked anyone else saving. An append
// now reads the whole tab ONCE; the checks before and after writing look only at the header, the last row and the new row.
test('Sheet: one save reads the whole tab once, not three times', () => {
  const env = sheetEnv();
  const f = env.file('BLD-area_reading.csv')[0];
  for (let i = 0; i < 30; i++) f.sheet.push([`rdg-old-${i}`, fx.TENANT, 'area-t2', 'temperature', '20.0', '21.0']);
  env.ranges.length = 0;
  const r = save(env, req(env));
  assert.equal(r.ok, true, JSON.stringify(r));
  const whole = env.ranges.filter(([name, , , nr, nc]) => name === 'BLD-area_reading.csv' && nr > 3 && nc > 1);
  assert.equal(whole.length, 1, JSON.stringify(env.ranges.filter((x) => x[0] === 'BLD-area_reading.csv')));
  assert.equal(env.rows('BLD-area_reading.csv').length, 32);
});

