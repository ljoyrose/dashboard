'use strict';
// Dog photo upload. Invented dogs and a one-pixel picture only. The folder id here is a stand-in, not a real Drive id.
const { test } = require('node:test');
const assert = require('node:assert');
const { standardEnv } = require('./harness');

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
let n = 0;

function withSubjects(env, header, rows) {
  const text = [header].concat(rows).join('\r\n') + '\r\n';
  const files = env.file('BLD-subject.csv');
  if (files.length) { files[0].content = text; files[0].sheet = undefined; }
  else env.addFile('BLD-subject.csv', text);
}

function photoBody(env, over) {
  over = over || {};
  n += 1;
  return {
    v: 1,
    request_id: over.request_id || ('req-photo-' + String(n).padStart(4, '0')),
    code: over.code || env.codes.staff,
    action: 'dog_photo',
    fields: over.fields || { subject_id: 'sub-test-a', mime: 'image/png', image_base64: PNG }
  };
}

function post(env, body) {
  return JSON.parse(env.ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).getContent());
}

function ready(props) {
  const env = standardEnv({ props: Object.assign({ DOG_PHOTOS_FOLDER_ID: 'FOLDER-PHOTOS' }, props || {}) });
  // photo is not the last column, so a writer that used a column letter would hit `note` instead.
  withSubjects(env, 'id,tenant_id,name,photo,note', [
    'sub-test-a,ten-test,Test A,,keep',
    'sub-test-b,ten-test,Test B,,keep'
  ]);
  return env;
}

function cells(env) {
  const lines = env.text('BLD-subject.csv').trim().split(/\r\n/);
  const head = lines[0].split(',');
  return { head, rows: lines.slice(1).map((line) => line.split(',')) };
}

test('a picture is stored in the photos folder and the file id is written on that dog, found by the photo header', () => {
  const env = ready();
  const r = post(env, photoBody(env));
  assert.equal(r.ok, true);
  assert.equal(r.result.status, 'saved');
  assert.equal(r.result.subject_id, 'sub-test-a');
  assert.equal(env.photos.length, 1);
  assert.equal(env.photos[0].id, r.result.file_id);
  assert.equal(env.photos[0].parent, 'photos');
  assert.match(env.photos[0].title, /^dog-sub-test-a-\d{8}-\d{6}\.png$/);
  assert.equal(/Test A/.test(env.photos[0].title), false);
  assert.equal(env.drive.some((f) => f.title === env.photos[0].title), false);
  const t = cells(env);
  const photo = t.head.indexOf('photo'), note = t.head.indexOf('note');
  assert.ok(photo >= 0 && photo < note);
  assert.equal(t.rows[0][photo], r.result.file_id);
  assert.equal(t.rows[0][note], 'keep');
  assert.equal(t.rows[0][t.head.indexOf('name')], 'Test A');
  assert.equal(t.rows[1][photo], '');
  assert.equal(t.rows[1][note], 'keep');
});

test('the same request id does not store a second file', () => {
  const env = ready();
  const body = photoBody(env, { request_id: 'req-photo-same1' });
  const a = post(env, body);
  const b = post(env, body);
  assert.equal(a.ok, true);
  assert.equal(b.result.repeat, true);
  assert.equal(b.result.file_id, a.result.file_id);
  assert.equal(env.photos.length, 1);
});

test('no folder id, no photo column, an unknown dog, a non-picture and an oversized ordinary save change nothing', () => {
  const off = ready();
  delete off.props.DOG_PHOTOS_FOLDER_ID;
  let r = post(off, photoBody(off));
  assert.equal(r.code, 'NOT_CONFIGURED');
  assert.equal(off.photos, undefined);

  const nocol = ready();
  withSubjects(nocol, 'id,tenant_id,name', ['sub-test-a,ten-test,Test A']);
  r = post(nocol, photoBody(nocol));
  assert.equal(r.code, 'HEADER_MISMATCH');
  assert.equal(nocol.photos, undefined);

  const missing = ready();
  r = post(missing, photoBody(missing, { fields: { subject_id: 'sub-missing', mime: 'image/png', image_base64: PNG } }));
  assert.equal(r.code, 'NOT_FOUND');
  assert.equal(missing.photos, undefined);

  const bad = ready();
  r = post(bad, photoBody(bad, { fields: { subject_id: 'sub-test-a', mime: 'text/plain', image_base64: PNG } }));
  assert.equal(r.code, 'INVALID');
  assert.equal(bad.photos, undefined);

  const env = ready();
  r = post(env, 'x'.repeat(70000));
  assert.equal(r.code, 'BAD_REQUEST');
  assert.equal(env.photos, undefined);
});

test('a failed cell write trashes the new file and leaves the row as it was', () => {
  const env = ready();
  const before = env.text('BLD-subject.csv');
  env.breakSetContent = 'once';
  env.breakTitle = 'BLD-subject.csv';
  const r = post(env, photoBody(env));
  assert.equal(r.ok, false);
  assert.equal(r.code, 'VERIFY_FAILED');
  assert.equal(env.text('BLD-subject.csv'), before);
  assert.equal(env.photos.length, 1);
  assert.equal(env.photos[0].trashed, true);
});

test('a Sheet is the first tab, and the photo header is used even when it is not the last column', () => {
  const env = ready();
  env.drive = env.drive.filter((f) => f.title !== 'BLD-subject.csv');
  env.addSheet('BLD-subject.csv', [
    ['id', 'tenant_id', 'name', 'photo', 'note'],
    ['sub-test-a', 'ten-test', 'Test A', '', 'keep'],
    ['sub-test-b', 'ten-test', 'Test B', 'old-id', 'keep']
  ]);
  const r = post(env, photoBody(env, { code: env.codes.owner, fields: { subject_id: 'sub-test-b', mime: 'image/png', image_base64: PNG } }));
  assert.equal(r.ok, true, r.message);
  const rows = env.rows('BLD-subject.csv');
  const photo = rows[0].indexOf('photo'), note = rows[0].indexOf('note');
  assert.ok(photo >= 0 && photo < note);
  assert.equal(rows[1][photo], '');
  assert.equal(rows[1][note], 'keep');
  assert.equal(rows[2][photo], r.result.file_id);
  assert.equal(rows[2][note], 'keep');
  assert.equal(rows[2][rows[0].indexOf('name')], 'Test B');
});

test('saving switched off refuses the picture and writes nothing', () => {
  const env = ready();
  env.props.SAVE_ENABLED = 'false';
  const r = post(env, photoBody(env));
  assert.equal(r.code, 'SAVE_OFF');
  assert.equal(env.photos, undefined);
});
