'use strict';
/**
 * 22 Nov 2026: the staff Temperatures screen read all of BLD-area_reading (~31,000 rows) on every open and sat on
 * "Loading..." for minutes; for an owner ("all rows") the read also stopped at the first 3,000 rows, the OLDEST, so
 * today's readings were missing. A read with filter.from now reads only the newest rows when they reach back past
 * that date, and the whole table otherwise. Invented rows only.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv } = require('./harness');
const fx = require('./fixtures');

const T = 'BLD-area_reading.csv';
const H = fx.AREA_READING_HEADER;
const col = (name) => H.indexOf(name);
const DAY = 86400000;

/** A Sheet area_reading: `rows` = [{id, at}] in sheet order (at = ms). */
function sheetEnv(rows) {
  const env = standardEnv({ props: { MODE_area_reading: 'direct', READ_ENABLED: 'true' } });
  const f = env.file(T)[0];
  f.sheet = env.ctx.csvParse_(f.content).filter((r) => !(r.length === 1 && r[0] === '')).slice(0, 1);
  f.fmt = {}; f.cfmt = {}; f.maxRows = 1000; delete f.content;
  rows.forEach((x) => {
    const r = H.map(() => ''); r[col('id')] = x.id; r[col('tenant_id')] = fx.TENANT; r[col('area_id')] = 'area-t1';
    r[col('reading_type')] = 'temperature'; r[col('min_c')] = 18; r[col('max_c')] = 21; r[col('precision_dp')] = 1;
    r[col('period_start')] = new Date(x.at - 300000); r[col('taken_at')] = new Date(x.at); r[col('taken_by')] = 'Hand';
    f.sheet.push(r);
  });
  return env;
}
function countCells(env) {
  const count = { cells: 0 }, orig = env.ctx.store_tab_;
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
function read(env, filter) {
  try { return { ok: true, result: env.ctx.sinkRead_({ v: 1, action: 'read', code: env.codes.owner, table: 'area_reading', filter }) }; }
  catch (e) { return env.ctx.errorBody_(e); }
}
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);

test('recent read: from a date, a big table reads only its newest rows and returns every reading since then', () => {
  const now = standardEnv().nowMs;
  const old = Array.from({ length: 6000 }, (_, i) => ({ id: 'rdg-old' + i, at: now - 400 * DAY + i * 3600000 }));   // 6,000 old rows, in time order
  const recent = Array.from({ length: 40 }, (_, i) => ({ id: 'rdg-new' + i, at: now - 10 * DAY + i * 3600000 }));
  const env = sheetEnv(old.concat(recent));
  const count = countCells(env);
  const r = read(env, { from: ymd(now - 31 * DAY) });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(Array.from(r.result.rows).map((x) => x.id), recent.map((x) => x.id));
  assert.equal(r.result.truncated, false);
  const whole = 6041 * H.length;
  assert.ok(count.cells < whole * 0.6, 'read ' + count.cells + ' cells; the whole table is ' + whole);
});

test('recent read: was the bug (a read with no date stopped at the first 3,000 rows and missed today); now the newest rows are kept', () => {
  const now = standardEnv().nowMs;
  const old = Array.from({ length: 3500 }, (_, i) => ({ id: 'rdg-old' + i, at: now - 400 * DAY + i * 3600000 }));
  const env = sheetEnv(old.concat([{ id: 'rdg-today', at: now - 3600000 }]));
  const plain = read(env);
  assert.equal(plain.result.truncated, true);
  assert.equal(Array.from(plain.result.rows).some((x) => x.id === 'rdg-today'), true);   // PR 751: past the limit the NEWEST rows are kept
  const recent = read(env, { from: ymd(now - 31 * DAY) });
  assert.deepEqual(Array.from(recent.result.rows).map((x) => x.id), ['rdg-today']);
});

test('recent read: rows out of time order near the edge, or a short table, read the whole table (nothing missed)', () => {
  const now = standardEnv().nowMs;
  // a recent row typed in early, then 3,500 old rows after it: the newest block starts with old rows, but the first
  // rows of the table are newer than `from`, so only a whole read finds them. The edge check sees old rows and trusts
  // time order; so put a recent row INSIDE the edge too, which must make it fall back.
  const rows = [{ id: 'rdg-early-recent', at: now - 5 * DAY }]
    .concat(Array.from({ length: 3500 }, (_, i) => ({ id: 'rdg-old' + i, at: now - 400 * DAY + i * 3600000 })));
  rows.splice(rows.length - 3000 + 5, 0, { id: 'rdg-edge-recent', at: now - 2 * DAY });   // inside the first 20 of the newest 3,000
  const env = sheetEnv(rows);
  const r = read(env, { from: ymd(now - 31 * DAY) });
  assert.deepEqual(Array.from(r.result.rows).map((x) => x.id).sort(), ['rdg-early-recent', 'rdg-edge-recent']);
  const small = sheetEnv([{ id: 'rdg-a', at: now - 40 * DAY }, { id: 'rdg-b', at: now - DAY }]);
  assert.deepEqual(Array.from(read(small, { from: ymd(now - 31 * DAY) }).result.rows).map((x) => x.id), ['rdg-b']);
});
