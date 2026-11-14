'use strict';
// One file store: file_add (14 Nov 2026, DOGCARD). Invented rows and a one-pixel picture only; folder ids are stand-ins.
const { test } = require('node:test');
const assert = require('node:assert');
const { standardEnv } = require('./harness');

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const FILES_H = 'id,tenant_id,kind,drive_file_id,url,mime,name,size_bytes,taken_on,sha256,source,set_by,set_on,created_at,updated_at';
const RULE_H = 'id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by,to_date';
let n = 0;

function env(props, rules) {
  const e = standardEnv({ props: Object.assign({ TABLE_ON_files: 'true', FILES_FOLDER_ID: 'FOLDER-FILES' }, props || {}) });
  e.addFile('BLD-files.csv', FILES_H + '\r\n');
  const t = e.props.TENANT_ID;
  const text = [RULE_H].concat((rules || [
    `r1,${t},file.types,image/png|image/jpeg|application/pdf,2026-01-01,test,,,,`,
    `r2,${t},file.max_bytes,5000,2026-01-01,test,,,,`
  ])).join('\r\n') + '\r\n';
  const f = e.file('BLD-breeding_rule.csv');
  if (f.length) { f[0].content = text; f[0].sheet = undefined; } else e.addFile('BLD-breeding_rule.csv', text);
  return e;
}
function post(e, fields, code) {
  n += 1;
  const body = { v: 1, request_id: 'req-files-' + String(n).padStart(4, '0'), code: code || e.codes.owner, action: 'file_add', fields };
  return JSON.parse(e.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
}
const rows = (e) => {
  const lines = e.file('BLD-files.csv')[0].content.trim().split(/\r?\n/);
  const head = lines[0].split(',');
  const cells = (l) => (l.match(/("(?:[^"]|"")*"|[^,]*)(,|$)/g) || []).slice(0, head.length).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'));
  return lines.slice(1).map((l) => Object.fromEntries(cells(l).map((v, i) => [head[i], v])));
};

test('file_add: owner only by default, behind its own switch', () => {
  const off = env({ TABLE_ON_files: '' });
  assert.equal(post(off, { kind: 'link', url: 'https://example.org/a' }).code, 'TABLE_OFF');
  const e = env();
  assert.equal(post(e, { kind: 'link', url: 'https://example.org/a' }, e.codes.staff).code, 'NOT_ALLOWED');
  assert.equal(rows(e).length, 0);
});

test('a photo is stored in the file store folder under a neutral name and one files row is added (set_on day, UTC created_at, sha256)', () => {
  const e = env();
  const r = post(e, { kind: 'photo', mime: 'image/png', data_base64: PNG, taken_on: '2026-10-01' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.match(r.result.id, /^fil/);
  assert.equal(e.stored.length, 1);
  assert.equal(e.stored[0].parent, 'files');
  assert.match(e.stored[0].title, /^file-\d{8}-\d{6}-[0-9a-f]{8}\.png$/);
  const [row] = rows(e);
  assert.equal(row.kind, 'photo');
  assert.equal(row.drive_file_id, r.result.drive_file_id);
  assert.equal(row.taken_on, '2026-10-01');
  assert.match(row.sha256, /^[0-9a-f]{64}$/);
  assert.equal(row.set_on, '2026-10-15');   // the London day
  assert.equal(row.created_at, '2026-10-15T22:30:00Z');   // UTC
  assert.equal(row.updated_at, '');
  assert.equal(row.set_by, e.ids.owner);   // the code's public id, not a name
});

test('the same bytes again are not stored twice: the existing id comes back', () => {
  const e = env();
  const a = post(e, { kind: 'photo', mime: 'image/png', data_base64: PNG });
  const b = post(e, { kind: 'photo', mime: 'image/png', data_base64: PNG });
  assert.equal(b.result.id, a.result.id);
  assert.equal(b.result.already, true);
  assert.equal(e.stored.length, 1);
  assert.equal(rows(e).length, 1);
});

test('a link saves without a folder or types row; https addresses only', () => {
  const e = env({ FILES_FOLDER_ID: '' }, []);
  const r = post(e, { kind: 'link', url: 'https://example.org/video', name: 'Pretend video' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(rows(e)[0].url, 'https://example.org/video');
  assert.equal(post(e, { kind: 'link', url: 'javascript:alert(1)' }).code, 'INVALID');
  assert.equal(post(e, { kind: 'link', url: 'http://example.org/plain' }).code, 'INVALID');   // https only
});

test('types and size come from owner rule rows: none set = refused; not listed = refused; over max_bytes = refused', () => {
  assert.equal(post(env({}, []), { kind: 'photo', mime: 'image/png', data_base64: PNG }).code, 'INVALID');
  assert.equal(post(env(), { kind: 'upload', mime: 'application/zip', data_base64: PNG }).code, 'INVALID');
  const t = 'ten-test';
  const small = env({}, [`r1,${t},file.types,image/png,2026-01-01,test,,,,`, `r2,${t},file.max_bytes,10,2026-01-01,test,,,,`]);
  const r = post(small, { kind: 'photo', mime: 'image/png', data_base64: PNG });
  assert.equal(r.code, 'INVALID');
  assert.match(JSON.stringify(r), /too large/);
});

test('no file store folder: a photo is refused plainly and no row is written', () => {
  const e = env({ FILES_FOLDER_ID: '' });
  const r = post(e, { kind: 'photo', mime: 'image/png', data_base64: PNG });
  assert.equal(r.code, 'NOT_CONFIGURED');
  assert.equal(rows(e).length, 0);
});

test('the bytes must match the claimed type; a files sheet missing created_at/updated_at is refused, not dropped', () => {
  const e = env();
  const r = post(e, { kind: 'upload', mime: 'application/pdf', data_base64: PNG });
  assert.equal(r.code, 'INVALID');
  assert.match(JSON.stringify(r), /not the kind it says/);
  const old = env();
  old.file('BLD-files.csv')[0].content = 'id,tenant_id,kind,drive_file_id,url,mime,name,size_bytes,taken_on,sha256,source,set_by,set_on\r\n';
  assert.notEqual(post(old, { kind: 'link', url: 'https://example.org/a' }).ok, true);
});

test('who may add is an owner rule row file.who_may: blank = owner only; the owner can add the STAFF role or one person', () => {
  const base = (t) => [`r1,${t},file.types,image/png,2026-01-01,test,,,,`];
  const t = 'ten-test';
  const none = env({}, base(t));
  assert.equal(post(none, { kind: 'link', url: 'https://example.org/a' }, none.codes.staff).code, 'NOT_ALLOWED');
  const role = env({}, base(t).concat([`r2,${t},file.who_may,OWNER|STAFF,2026-01-01,test,,,,`]));
  assert.equal(post(role, { kind: 'link', url: 'https://example.org/a' }, role.codes.staff).ok, true);
  const person = env({}, base(t));
  const f = person.file('BLD-breeding_rule.csv')[0];
  f.content += `r3,${t},file.who_may,person:${person.ids.staff},2026-01-01,test,,,,\r\n`;
  assert.equal(post(person, { kind: 'link', url: 'https://example.org/b' }, person.codes.staff).ok, true);
  assert.equal(post(person, { kind: 'link', url: 'https://example.org/c' }, person.codes.owner).ok, true);   // the owner always may
});
