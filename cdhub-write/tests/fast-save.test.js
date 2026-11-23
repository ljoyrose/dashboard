'use strict';
/**
 * 16 Nov 2026: BLD-area_reading has ~31,000 rows and every save read all of them (~25 s a save). A reading add now
 * reads the last rows in full and, for every row, only the columns the repeat and id checks use. These tests prove
 * the checks still cover the WHOLE table, the save reads far fewer cells, and the write guards still hold.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const T = 'BLD-area_reading.csv';
const H = fx.AREA_READING_HEADER;
const col = (name) => H.indexOf(name);

/** A Sheet area_reading with `n` old rows typed by hand (real numbers and dates), plus anything in `extra` first. */
function bigEnv(n, extra) {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  ['BLD-area_reading.csv', 'BLD-_pending.csv'].forEach((t) => {
    const f = env.file(t)[0];
    f.sheet = env.ctx.csvParse_(f.content).filter((r) => !(r.length === 1 && r[0] === ''));
    f.fmt = {}; f.cfmt = {}; f.maxRows = 1000; delete f.content;
  });
  const f = env.file(T)[0];
  const row = (id, area, ps, at) => {
    const r = H.map(() => ''); r[col('id')] = id; r[col('tenant_id')] = fx.TENANT; r[col('area_id')] = area;
    r[col('reading_type')] = 'temperature'; r[col('min_c')] = 18; r[col('max_c')] = 21.5; r[6] = 3.5; r[col('precision_dp')] = 1;
    r[col('period_start')] = new Date(ps); r[col('taken_at')] = new Date(at); r[col('taken_by')] = 'Hand';
    return r;
  };
  (extra || []).forEach((e) => f.sheet.push(row(e.id, e.area, e.ps, e.at)));
  for (let i = 0; i < n; i++) f.sheet.push(row('rdg-old' + i, 'area-t2', Date.UTC(2025, 0, 1, 8) + i * 3600000, Date.UTC(2025, 0, 1, 8, 5) + i * 3600000));
  return env;
}

/** Count the cells a save reads from area_reading. */
function countReads(env) {
  const count = { cells: 0 };
  const orig = env.ctx.store_tab_;
  env.ctx.store_tab_ = (file) => {
    const sh = orig(file);
    if (file.getName() !== T) return sh;
    const getRange = sh.getRange;
    sh.getRange = (r, c, nr, nc) => {
      const rg = getRange(r, c, nr, nc);
      ['getDisplayValues', 'getValues'].forEach((m) => { const g = rg[m]; rg[m] = () => { count.cells += (nr || 1) * (nc || 1); return g(); }; });
      return rg;
    };
    return sh;
  };
  return count;
}

test('fast save: a reading on a big table reads a small part of it, and the row is added once under the last row', () => {
  const env = bigEnv(3000);
  const count = countReads(env);
  const r = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '11.3', max_c: '14.2' } }));
  assert.equal(r.ok, true, JSON.stringify(r));
  const rows = env.rows(T);
  assert.equal(rows.length, 3002);
  assert.equal(rows[3001][col('id')], r.result.id);
  assert.equal(rows[3001][col('min_c')], 11.3);
  const whole = 3001 * H.length;
  assert.ok(count.cells < whole / 2, 'read ' + count.cells + ' cells; a full read is ' + whole + ' (and was done 3 times)');
});

test('fast save: a repeat of a reading saved long before the last rows is still caught (whole table checked)', () => {
  const probe = standardEnv();
  const now = probe.nowMs;
  const slot = new Date(now - 3600000).toISOString().slice(0, 13) + ':00:00Z';
  // the matching reading is the FIRST data row, with 3000 rows after it (as if typed in out of order)
  const env = bigEnv(3000, [{ id: 'rdg-first', area: 'area-t1', ps: Date.parse(slot), at: now - 60000 }]);
  const r = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '22', period_start: slot } }));
  assert.equal(r.code, 'DUPLICATE', JSON.stringify(r));
  assert.equal(env.rows(T).length, 3002);
});

test('fast save: a late reading for a slot filled at the top of the table is refused (whole table checked)', () => {
  const probe = standardEnv();
  const slot = new Date(probe.nowMs - 20 * 86400000).toISOString().slice(0, 10) + 'T07:00:00Z';   // 20 days ago
  const env = bigEnv(3000, [{ id: 'rdg-slot', area: 'area-t1', ps: Date.parse(slot), at: Date.parse(slot) + 600000 }]);
  const r = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '22', period_start: slot } }));
  assert.equal(r.code, 'DUPLICATE', JSON.stringify(r));
  const london = new Date(Date.parse(slot)).toLocaleString('sv-SE', { timeZone: 'Europe/London' }).replace(' ', 'T');
  const off = (Date.parse(london + 'Z') - Date.parse(slot)) / 3600000;   // the same instant written as London time
  const same = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '20', max_c: '22', period_start: london + '+0' + off + ':00' } }));
  assert.equal(same.code, 'DUPLICATE', JSON.stringify(same));
  const other = save(env, req(env, { fields: { area_id: 'area-t2', min_c: '20', max_c: '22', period_start: slot } }));
  assert.equal(other.ok, true, JSON.stringify(other));   // another room, same slot: saved
});

test('fast save: a correction still finds a row at the top of the table (full read)', () => {
  const env = bigEnv(500, [{ id: 'rdg-fix', area: 'area-t1', ps: Date.UTC(2025, 0, 1, 7), at: Date.UTC(2025, 0, 1, 7, 5) }]);
  const r = save(env, req(env, { code: env.codes.owner, action: 'correct', corrects_id: 'rdg-fix', reason: 'typed it wrong', fields: { area_id: 'area-t1', min_c: '19', max_c: '21' } }));
  assert.equal(r.ok, true, JSON.stringify(r));
  const missing = save(env, req(env, { code: env.codes.owner, action: 'correct', corrects_id: 'rdg-nothere', reason: 'typed it wrong', fields: { area_id: 'area-t1', min_c: '19', max_c: '21' } }));
  assert.equal(missing.code, 'INVALID');
});

test('fast save: a change to the last rows while saving is caught and nothing is saved', () => {
  const env = bigEnv(400);
  const read = env.ctx.store_readTail_(T, 200, ['id']);
  env.rows(T)[400][col('taken_by')] = 'Edited';            // someone edits the last row between the read and the write
  const vals = H.map(() => ''); vals[0] = 'rdg-new';
  assert.throws(() => env.ctx.store_append_(T, env.ctx.TABLES.area_reading.columns, vals, read), /changed while saving/);
  assert.equal(env.rows(T).length, 401);
});

test('fast save: a bad read-back takes the new row out again and says so', () => {
  const env = bigEnv(400);
  env.breakSetValues = 'once'; env.breakTitle = T;
  const before = env.rows(T).map((r) => r.slice());
  const r = save(env, req(env));
  assert.equal(r.ok, false);
  assert.equal(r.code, 'VERIFY_FAILED', JSON.stringify(r));
  assert.deepEqual(env.rows(T), before);
});

test('fast save: a small table (all rows inside the tail) and a CSV table save as before', () => {
  const env = bigEnv(3);
  assert.equal(save(env, req(env)).ok, true);
  assert.equal(env.rows(T).length, 5);
  const csv = standardEnv({ props: { MODE_area_reading: 'direct' } });   // area_reading still a CSV file
  assert.equal(save(csv, req(csv)).ok, true);
  assert.equal(csv.ctx.store_read_(T, true).records.length, 1);
});
