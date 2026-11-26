'use strict';
/**
 * 17 Nov 2026 (the owner: "Clear all failures and ensure this is not repeated"): BLD-outdoor_temp had wx-0584 and wx-0585
 * twice. These tests run the real outdoor-temp/Code.gs against a fake Sheet and prove a new row always takes the
 * next number after the highest ever used, never one already used, and only one run writes at a time.
 * Invented location and tenant only.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'outdoor-temp', 'Code.gs'), 'utf8');
const TODAY = '2026-11-17';

function makeEnv(rows, opts = {}) {
  const props = Object.assign({ LAT: '50.1', LON: '-3.1', LOCATION: 'Test point', LOCATION_KEY: 'TEST', TENANT: 'ten-test' }, opts.props || {});
  const sheet = rows.map((r) => r.slice());
  const triggers = (opts.triggers || []).map((h) => ({ h }));
  const log = [];
  let locked = !!opts.lockHeld;
  const width = (r) => r.length;
  const range = (r, c, nr, nc) => ({
    setNumberFormat() { return this; },
    setValues(vals) { for (let i = 0; i < nr; i++) { while (sheet.length < r + i) sheet.push([]); const row = sheet[r - 1 + i]; for (let j = 0; j < nc; j++) row[c - 1 + j] = vals[i][j]; } return this; },
    getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push((sheet[r - 1 + i] || [])[c - 1 + j] ?? ''); out.push(row); } return out; }
  });
  const sh = {
    getLastRow: () => sheet.length, getMaxRows: () => Math.max(sheet.length, 1000),
    insertRowsAfter() {}, setName() {}, setFrozenRows() {}, appendRow: (r) => sheet.push(r.slice()),
    getRange: range,
    getDataRange: () => range(1, 1, sheet.length, sheet.reduce((m, r) => Math.max(m, width(r)), 0)),
    sort(col) { const [h, ...rest] = sheet; rest.sort((a, b) => String(a[col - 1]).localeCompare(String(b[col - 1]))); sheet.length = 0; sheet.push(h, ...rest); }
  };
  const days = opts.days || [TODAY];
  const daily = {
    time: days, temperature_2m_min: days.map(() => 5), temperature_2m_max: days.map(() => 11),
    apparent_temperature_max: days.map(() => 9), cloud_cover_mean: days.map(() => 50), wind_speed_10m_max: days.map(() => 20),
    precipitation_sum: days.map(() => 1.2), weather_code: days.map(() => 3)
  };
  const ctx = {
    Logger: { log: (s) => log.push(String(s)) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sh, getSheets: () => [sh], setActiveSheet() {}, moveActiveSheet() {}, insertSheet: () => sh }) },
    UrlFetchApp: { fetch: () => opts.status ? ({ getResponseCode: () => opts.status, getContentText: () => '{"reason":"Daily API request limit exceeded. Please try again tomorrow.","error":true}' }) : ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ daily, current: { temperature_2m: 7, time: TODAY + 'T12:00' } }) }) },
    Utilities: { formatDate: (d, tz, f) => (f === 'yyyy-MM-dd' ? TODAY : TODAY + 'T12:00Z'), parseCsv: () => [] },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => { if (locked) return false; locked = true; return true; }, releaseLock: () => { locked = false; } }) },
    ScriptApp: {
      getProjectTriggers: () => triggers.map((t) => ({ getHandlerFunction: () => t.h, _t: t })),
      deleteTrigger: (t) => { const i = triggers.indexOf(t._t); if (i >= 0) triggers.splice(i, 1); },
      newTrigger: (h) => ({ timeBased: () => ({ everyHours: () => ({ create: () => triggers.push({ h }) }) }) })
    },
    MailApp: { sendEmail() {} }, DriveApp: {}
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { ctx, sheet, props, triggers, log };
}

const H = ['id','tenant_id','location','location_key','on_date','reading_kind','min_temp','temp_unit_id','max_temp','realfeel_max_temp',
  'cloud_cover_pct','wind_kmh','rain_value','rain_unit_id','phrase','captured_at','unit_as_returned','source','note','current_temp','current_at','locked'];
const row = (id, date, kind = 'actual') => { const r = H.map(() => ''); r[0] = id; r[4] = date; r[5] = kind; return r; };
const ids = (env) => env.sheet.slice(1).map((r) => r[0]);

test('outdoor temp: a new day takes the next number after the highest id in the sheet, wherever that row sits', () => {
  // rows out of order (an old AccuWeather row with a high id dated earlier), as in the live sheet
  const env = makeEnv([H, row('wx-0584', '2026-11-08'), row('wx-0100', '2026-11-10'), row('wx-0583', '2026-11-16')]);
  env.ctx.run();
  assert.deepEqual(ids(env).sort(), ['wx-0100', 'wx-0583', 'wx-0584', 'wx-0585']);
  assert.equal(env.props.WX_LAST_ID, '585');
});

test('outdoor temp: a deleted top row never gives its number out again (the highest handed out is kept)', () => {
  const env = makeEnv([H, row('wx-0010', '2026-11-10')], { props: { WX_LAST_ID: '600' } });
  env.ctx.run();
  assert.deepEqual(ids(env), ['wx-0010', 'wx-0601']);
});

test('outdoor temp: every new day in one run gets its own number, all above the highest, none repeated', () => {
  const days = ['2026-11-16', TODAY, '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'];
  const env = makeEnv([H, row('wx-0585', '2026-11-15')], { days });
  env.ctx.run();
  const all = ids(env);
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(all.slice(1), ['wx-0586', 'wx-0587', 'wx-0588', 'wx-0589', 'wx-0590', 'wx-0591', 'wx-0592', 'wx-0593']);
  // a second run updates the same days in place: no new rows, no new numbers
  env.ctx.run();
  assert.deepEqual(ids(env), all);
});

test('outdoor temp: an existing day keeps its id; a locked row is not touched', () => {
  const locked = row('wx-0005', TODAY, 'today'); locked[21] = 'Y'; locked[6] = '99';
  const env = makeEnv([H, locked]);
  env.ctx.run();
  assert.equal(env.sheet.length, 2);
  assert.equal(env.sheet[1][6], '99');
});

test('outdoor temp: while another run holds the lock, a run writes nothing', () => {
  const env = makeEnv([H, row('wx-0001', '2026-11-10')], { lockHeld: true });
  env.ctx.run();
  assert.equal(env.sheet.length, 2);
  assert.match(env.log.join('\n'), /Another run is writing/);
});

test('outdoor temp: the archive back-fill skips days already there and numbers after the highest (it used to restart at wx-0001)', () => {
  const env = makeEnv([H, row('wx-0700', '2026-11-15')], { days: ['2026-11-14', '2026-11-15', '2026-11-16'] });
  env.ctx.runBackfill();
  assert.deepEqual(ids(env), ['wx-0701', 'wx-0700', 'wx-0702']);
  assert.equal(env.sheet.filter((r) => r[4] === '2026-11-15').length, 1);
});

test('outdoor temp: Open-Meteo busy (429) is not a failure: nothing written, one line logged, the next run tries again', () => {
  const env = makeEnv([H, row('wx-0001', '2026-11-10')], { status: 429 });
  assert.equal(env.ctx.run(), undefined);
  assert.equal(env.sheet.length, 2);
  assert.match(env.log.join('\n'), /Open-Meteo busy \(429/);
  const bad = makeEnv([H], { status: 500 });
  assert.throws(() => bad.ctx.run(), /Open-Meteo 500/);   // any other refusal still shows as a failed run
});

test('outdoor temp: missing location settings stop the run plainly and nothing is written', () => {
  const env = makeEnv([H], { props: { LAT: '' } });
  assert.throws(() => env.ctx.run(), /Script Properties missing: LAT/);
  assert.equal(env.sheet.length, 1);
});

test('outdoor temp: fixTriggers leaves one run trigger and deletes one for a function that no longer exists', () => {
  const env = makeEnv([H], { triggers: ['run', 'writeForecast', 'run'] });
  const gone = env.ctx.fixTriggers();
  assert.deepEqual(env.triggers.map((t) => t.h), ['run']);
  assert.deepEqual([...gone], ['writeForecast', 'run']);
  const none = makeEnv([H], { triggers: ['writeForecast'] });
  none.ctx.fixTriggers();
  assert.deepEqual(none.triggers.map((t) => t.h), ['run']);
});

test('outdoor temp: the script holds no address, Drive id or email (public repo)', () => {
  assert.doesNotMatch(SRC, /@[a-z0-9-]+\.[a-z]/i);
  assert.doesNotMatch(SRC, /\b[A-Za-z0-9_-]{28,}\b/);
  assert.doesNotMatch(SRC, /\b[A-Z]{1,2}\d{1,2}[A-Z]? ?\d[A-Z]{2}\b/);   // a UK postcode
});
