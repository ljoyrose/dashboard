'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { standardEnv } = require('./harness');

const T = 'BLD-area_reading.csv';

function counting(env) {
  const folder = env.ctx.DriveApp.getFolderById('FOLDER-TEST');
  const orig = folder.getFilesByName.bind(folder);
  let n = 0;
  folder.getFilesByName = (t) => { n++; return orig(t); };
  return () => n;
}

test('a file found by name is remembered: the second lookup does not search the folder', () => {
  const env = standardEnv();
  const searches = counting(env);
  const a = env.ctx.store_findOne_(T), b = env.ctx.store_findOne_(T);
  assert.equal(a.getId(), b.getId());
  assert.equal(searches(), 1);
});

test('a remembered file that was renamed or binned is not used: the folder is searched again', () => {
  const env = standardEnv();
  const searches = counting(env);
  const first = env.ctx.store_findOne_(T);
  const f = env.file(T)[0];
  f.title = 'zz_' + T;                                   // renamed away
  assert.equal(env.ctx.store_findOne_(T), null);
  assert.equal(searches(), 2);
  f.title = T; f.trashed = true;
  env.ctx.store_findOne_(T);
  assert.equal(searches(), 3);
  assert.ok(first);
});

test('two files with one name are still refused when the folder is searched', () => {
  const env = standardEnv();
  const f = env.file(T)[0];
  env.drive.push(Object.assign({}, f, { id: f.id + '-2' }));
  assert.throws(() => env.ctx.store_findOne_(T), (e) => e.code === 'DUPLICATE_TITLE');
});

test('the waiting-room-moves pass runs at most once a minute from saves', () => {
  const { req } = require('./harness');
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  const post = (r) => JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify(r) } }).getContent());
  const a = post(req(env, {}));
  assert.ok(a.ok || a.code, 'first save answered');
  assert.equal(env.cache['moves:ran'], '1', 'the once-a-minute mark is set by the first save');
  const pendBefore = env.text ? env.text('BLD-_pending.csv') : '';
  const b = post(req(env, {}));
  assert.ok(b.ok || b.code, 'second save answered');
  assert.equal(env.text ? env.text('BLD-_pending.csv') : '', pendBefore, 'a save inside the minute leaves the queue alone');
});

test('a save returns how long its steps took (numbers only), and ?status=1 lists the last saves\' timings', () => {
  const { req } = require('./harness');
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  const out = JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify(req(env, {})) } }).getContent());
  assert.equal(out.ok, true, JSON.stringify(out));
  const t = out.result.timing;
  assert.equal(t.table, 'area_reading');
  ['sign_in', 'lock_wait', 'work', 'write'].forEach((k) => assert.equal(typeof t[k], 'number', k));
  const st = JSON.parse(env.ctx.doGet({ parameter: { status: '1' } }).getContent());
  assert.equal(st.lastSaveTimings.length, 1);
  assert.equal(st.lastSaveTimings[0].table, 'area_reading');
  assert.equal(typeof st.lastSaveTimings[0].total, 'number');
  const words = JSON.stringify(st.lastSaveTimings);
  assert.ok(!/@|tenant|area-|rdg-/.test(words), 'no data or names in the timings: ' + words);
});

test('a refused save is listed in ?status=1 with its reason, table, room and slot, but no code, token or name', () => {
  const { req } = require('./harness');
  const env = standardEnv({ props: { MODE_area_reading: 'direct' } });
  const post = (r) => JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify(r) } }).getContent());
  const first = req(env, {});
  assert.equal(post(first).ok, true);
  const again = Object.assign({}, first, { request_id: first.request_id + 'x' });
  const out = post(again);                                  // the same reading again: turned down
  assert.equal(out.ok, false, JSON.stringify(out));
  const st = JSON.parse(env.ctx.doGet({ parameter: { status: '1' } }).getContent());
  assert.equal(st.lastRefusals.length, 1);
  const x = st.lastRefusals[0];
  assert.equal(x.code, out.code);
  assert.equal(x.table, 'area_reading');
  assert.equal(x.room, first.fields.area_id);
  assert.ok(x.message);
  const words = JSON.stringify(st.lastRefusals);
  assert.ok(!words.includes(String(first.code)), 'no staff code');
  assert.ok(!/@/.test(words), 'no emails');
});

test('a request that cannot be read is listed without failing', () => {
  const env = standardEnv();
  const out = JSON.parse(env.ctx.doPost({ postData: { contents: 'not json' } }).getContent());
  assert.equal(out.code, 'BAD_REQUEST');
  const st = JSON.parse(env.ctx.doGet({ parameter: { status: '1' } }).getContent());
  assert.equal(st.lastRefusals[0].code, 'BAD_REQUEST');
});

