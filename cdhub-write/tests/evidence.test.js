'use strict';
// Evidence files (ITEMS, 14 Nov 2026): a photo or PDF is stored in its own folder and its file id comes back. Invented bytes only.
const { test } = require('node:test');
const assert = require('node:assert');
const { standardEnv } = require('./harness');

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const PDF = Buffer.from('%PDF-1.4 pretend certificate').toString('base64');
let n = 0;
const body = (env, fields, code) => ({ v: 1, request_id: 'req-evid-' + String(++n).padStart(4, '0'), code: code || env.codes.staff, action: 'evidence_file', fields });
const post = (env, b) => JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify(b) } }).getContent());
const ready = (props) => standardEnv({ props: Object.assign({ EVIDENCE_FOLDER_ID: 'FOLDER-EVIDENCE' }, props || {}) });

test('a photo or a PDF certificate is stored in the evidence folder; the file id comes back; no table is written', () => {
  const env = ready();
  const before = env.drive.map((f) => f.title + f.content).join('|');
  const r = post(env, body(env, { mime: 'image/png', file_base64: PNG, for_table: 'check_log', for_id: 'itm-abc' }));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.file_id, env.photos[0].id);
  assert.match(env.photos[0].title, /^evidence-check_log-itm-abc-\d{8}-\d{6}\.png$/);
  const p = post(env, body(env, { mime: 'application/pdf', file_base64: PDF, for_table: 'items' }, env.codes.owner));
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.match(env.photos[1].title, /\.pdf$/);
  assert.equal(env.drive.map((f) => f.title + f.content).join('|'), before);
});

test('refused: no folder set, the tables folder, a wrong type, a fake PDF, no purpose, a guest', () => {
  const none = standardEnv({});
  assert.match(JSON.stringify(post(none, body(none, { mime: 'image/png', file_base64: PNG, for_table: 'items' }))), /NOT_CONFIGURED|not set up/);
  const same = ready({ EVIDENCE_FOLDER_ID: 'FOLDER-TEST' });
  assert.match(JSON.stringify(post(same, body(same, { mime: 'image/png', file_base64: PNG, for_table: 'items' }))), /own Shared Drive folder/);
  const env = ready();
  assert.match(JSON.stringify(post(env, body(env, { mime: 'text/html', file_base64: PNG, for_table: 'items' }))), /photo or a PDF/);
  assert.match(JSON.stringify(post(env, body(env, { mime: 'application/pdf', file_base64: PNG, for_table: 'items' }))), /not a PDF/);
  assert.match(JSON.stringify(post(env, body(env, { mime: 'image/png', file_base64: PNG }))), /what the evidence is for/);
  if (env.codes.guest) assert.equal(post(env, body(env, { mime: 'image/png', file_base64: PNG, for_table: 'items' }, env.codes.guest)).ok, false);
  assert.equal((env.photos || []).length, 0);
});

test('a large evidence body is let through only for evidence_file', () => {
  const env = ready();
  const big = 'A'.repeat(70000);
  const r = JSON.parse(env.ctx.doPost({ postData: { contents: JSON.stringify({ v: 1, action: 'read', pad: big }) } }).getContent());
  assert.equal(r.ok, false);
  assert.match(r.message, /too large/);
});
