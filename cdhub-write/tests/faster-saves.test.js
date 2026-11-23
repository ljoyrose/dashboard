'use strict';
/**
 * 20 Nov 2026: live reading saves took 49-98 s. Most of it was turning every old date in the reading table into
 * London text (about 62,000 times a save) and reading the rooms, thermometers and kept-years lists in full every save.
 * These tests prove the same saves and refusals happen with neither.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv, req, save } = require('./harness');
const fx = require('./fixtures');

const T = 'BLD-area_reading.csv';
const H = fx.AREA_READING_HEADER;
const col = (name) => H.indexOf(name);

function bigEnv(n) {
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  ['BLD-area_reading.csv', 'BLD-_pending.csv'].forEach((t) => {
    const f = env.file(t)[0];
    f.sheet = env.ctx.csvParse_(f.content).filter((r) => !(r.length === 1 && r[0] === ''));
    f.fmt = {}; f.cfmt = {}; f.maxRows = 1000; delete f.content;
  });
  const f = env.file(T)[0];
  for (let i = 0; i < n; i++) {
    const r = H.map(() => ''); r[col('id')] = 'rdg-old' + i; r[col('tenant_id')] = fx.TENANT; r[col('area_id')] = 'area-t2';
    r[col('reading_type')] = 'temperature'; r[col('min_c')] = 18; r[col('max_c')] = 21.5; r[6] = 3.5; r[col('precision_dp')] = 1;
    r[col('period_start')] = new Date(Date.UTC(2025, 0, 1, 8) + i * 3600000); r[col('taken_at')] = new Date(Date.UTC(2025, 0, 1, 8, 5) + i * 3600000);
    r[col('taken_by')] = 'Hand'; f.sheet.push(r);
  }
  return env;
}

function countFormats(env) {
  const c = { n: 0 }, of = env.ctx.Utilities.formatDate;
  env.ctx.Utilities.formatDate = (...a) => { c.n++; return of(...a); };
  return c;
}

function countReads(env) {
  const c = {}, orig = env.ctx.store_read_;
  env.ctx.store_read_ = (title, must) => { c[title] = (c[title] || 0) + 1; return orig(title, must); };
  return c;
}

test('faster saves: a reading on a big table does not turn every old date into London text', () => {
  const env = bigEnv(3000);
  const fmt = countFormats(env);
  const r = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '11.3', max_c: '14.2' } }));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(fmt.n < 1000, 'date formats: ' + fmt.n);   // the last rows only (was over 6,000 for 3,000 rows)
});

test('faster saves: a repeat of an old reading sent with an offset is still caught as the same instant', () => {
  const env = bigEnv(500);
  // row 10's period_start is 2025-01-01T18:00Z; sent weeks later with an explicit offset, it is the same slot
  const ps = new Date(Date.UTC(2025, 0, 1, 8) + 10 * 3600000);
  env.nowMs = Date.UTC(2025, 1, 20, 12);   // weeks later: a late reading for a filled slot
  const iso = '2025-01-01T18:00:00+00:00';
  assert.equal(Date.parse(iso), ps.getTime());
  const r = save(env, req(env, { fields: { area_id: 'area-t2', min_c: '18.0', max_c: '21.5', period_start: iso } }));
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.code || (r.error && r.error.code), 'DUPLICATE', JSON.stringify(r));
});

test('faster saves: the rooms and thermometers lists are read once, then remembered while unchanged', () => {
  const env = bigEnv(50);
  const reads = countReads(env);
  for (let k = 0; k < 3; k++) {
    env.nowMs += 3 * 3600000;
    const r = save(env, req(env, { fields: { area_id: 'area-t1', min_c: '11.' + k, max_c: '14.2' } }));
    assert.equal(r.ok, true, JSON.stringify(r));
  }
  assert.equal(reads['BLD-area.csv'], 1, JSON.stringify(reads));
  assert.ok((reads['BLD-thermometer.csv'] || 0) <= 1, JSON.stringify(reads));
});

test('faster saves: a room the owner adds is accepted on the very next save (the remembered list is dropped)', () => {
  const env = bigEnv(50);
  let r = save(env, req(env, { fields: { area_id: 'area-new', min_c: '11.0', max_c: '14.2' } }));
  assert.equal(r.ok, false);
  const a = env.file('BLD-area.csv')[0];
  a.content = a.content.replace(/\r\n$/, '') + `\r\narea-new,${fx.TENANT},N1,T - Test house,1,8,u-m2,yes,\r\n`;
  env.nowMs += 3 * 3600000;
  r = save(env, req(env, { fields: { area_id: 'area-new', min_c: '11.0', max_c: '14.2' } }));
  assert.equal(r.ok, true, JSON.stringify(r));
});

test('faster saves: a remembered list is never used past 2 minutes, and a big list is not remembered', () => {
  const env = standardEnv();
  const puts = [];
  const real = env.ctx.CacheService.getScriptCache;
  env.ctx.CacheService.getScriptCache = () => { const c = real(); return { get: c.get, put: (k, v, s) => { puts.push([k, s]); c.put(k, v, s); } }; };
  env.ctx.store_readSmall_('BLD-area.csv');
  const small = puts.filter((p) => p[0].indexOf('small:') === 0);
  assert.equal(small.length, 1);
  assert.ok(small[0][1] <= 120);
  const a = env.file('BLD-area.csv')[0];
  for (let i = 0; i < 2000; i++) a.content += `area-x${i},${fx.TENANT},X${i},X - a long grouping name for size,1,8,u-m2,yes,a note to make the row longer\r\n`;
  puts.length = 0;
  env.ctx.store_readSmall_('BLD-area.csv');
  assert.equal(puts.filter((p) => p[0].indexOf('small:') === 0).length, 0);
});

/* ---- One request for a round (OV12 20 Nov 2026) ---- */
const many = (env, items, over = {}) => save(env, Object.assign({ v: 1, request_id: 'r-batch-' + Math.random().toString(36).slice(2, 10), code: env.codes.staff, action: 'add_many', items }, over));

test('list save: several readings in one request are each saved, in order, each with its own answer', () => {
  const env = bigEnv(50);
  const before = env.rows(T).length;
  const r = many(env, [
    { request_id: 'r-item-00001', table: 'area_reading', fields: { area_id: 'area-t1', min_c: '18.0', max_c: '21.0' } },
    { request_id: 'r-item-00002', table: 'area_reading', fields: { area_id: 'area-t2', min_c: '17.5', max_c: '20.5' } }
  ]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(JSON.parse(JSON.stringify(r.result.items.map((x) => [x.request_id, x.ok, x.result && x.result.status]))), [['r-item-00001', true, 'saved'], ['r-item-00002', true, 'saved']]);
  assert.equal(env.rows(T).length, before + 2);
});

test('list save: one refused entry does not stop the rest, and its reason comes back', () => {
  const env = bigEnv(50);
  const r = many(env, [
    { request_id: 'r-item-00011', table: 'area_reading', fields: { area_id: 'area-nope', min_c: '18.0', max_c: '21.0' } },
    { request_id: 'r-item-00012', table: 'area_reading', fields: { area_id: 'area-t1', min_c: '18.0', max_c: '21.0' } }
  ]);
  assert.equal(r.result.items[0].ok, false);
  assert.equal(r.result.items[0].code, 'INVALID');
  assert.equal(r.result.items[1].ok, true);
});

test('list save: sending the same list again saves nothing twice (each entry remembered by its own reference)', () => {
  const env = bigEnv(50);
  const items = [{ request_id: 'r-item-00021', table: 'area_reading', fields: { area_id: 'area-t1', min_c: '18.0', max_c: '21.0' } }];
  many(env, items);
  const n = env.rows(T).length;
  const again = many(env, items);
  assert.equal(again.result.items[0].ok, true);
  assert.equal(again.result.items[0].result.repeat, true);
  assert.equal(env.rows(T).length, n);
  // and one entry of the list resent on its own gets the same first answer
  const single = save(env, req(env, { request_id: 'r-item-00021', fields: items[0].fields }));
  assert.equal(single.result.repeat, true);
  assert.equal(env.rows(T).length, n);
});

test('list save: a wrong code, an empty list or more than 20 entries refuse the whole list and save nothing', () => {
  const env = bigEnv(10);
  const n = env.rows(T).length;
  const it = (k) => ({ request_id: 'r-item-1' + String(k).padStart(4, '0'), table: 'area_reading', fields: { area_id: 'area-t1', min_c: '18.0', max_c: '21.0' } });
  assert.equal(many(env, [it(1)], { code: 'not-a-code' }).ok, false);
  assert.equal(many(env, Array.from({ length: 21 }, (_, k) => it(k))).code, 'BAD_REQUEST');
  assert.equal(many(env, []).code, 'BAD_REQUEST');
  assert.equal(env.rows(T).length, n);
});
