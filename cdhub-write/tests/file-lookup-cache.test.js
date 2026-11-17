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
