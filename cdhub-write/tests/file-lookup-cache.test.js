'use strict';
/**
 * 17 Nov 2026: live saves took 17-127 s. A save looks up several files by name, and each folder search is slow, so the
 * id found is remembered for 5 minutes. A remembered id is used only while that file keeps its exact name and is not
 * in the bin; otherwise the folder is searched again (with the two-files-one-name check).
 */
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
  f.title = T; f.trashed = true;                         // back under the name, but in the bin
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
