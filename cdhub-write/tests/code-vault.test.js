'use strict';
// Codes vault, save-script side (Lisa 14 Nov 2026, option B). Only sealed hex is kept; a typed code is checked once and
// answered match true/false only, never logged or echoed, and a miss counts towards the sign-in limit.
const { test } = require('node:test');
const assert = require('node:assert');
const { standardEnv, req, save } = require('./harness');

const H = 'id,tenant_id,code_id,cipher,iv,salt,kdf,kdf_iter,from_date,to_date,set_by,set_on';
const hex = (n) => 'ab'.repeat(n);
const ROW = { code_id: 'vault-check', cipher: hex(30), iv: hex(12), salt: hex(16), kdf: 'PBKDF2-SHA256/AES-GCM-256', kdf_iter: '600000' };
function env(on = true) {
  const e = standardEnv({ props: on ? { TABLE_ON_code_vaults: 'true' } : {} });
  e.addFile('BLD-code_vaults.csv', H + '\r\n');
  return e;
}
const post = (e, body) => JSON.parse(e.ctx.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());

test('a sealed row saves for an owner code; staff codes and a switched-off table are refused', () => {
  const e = env();
  const r = save(e, req(e, { code: e.codes.owner, table: 'code_vaults', fields: ROW }));
  assert.equal(r.ok, true, JSON.stringify(r));
  const lines = e.file('BLD-code_vaults.csv')[0].content.trim().split(/\r?\n/);
  assert.equal(lines.length, 2);
  assert.match(lines[1], /,vault-check,(ab)+,(ab)+,(ab)+,PBKDF2-SHA256\/AES-GCM-256,600000,\d{4}-\d{2}-\d{2},,/);
  assert.equal(save(e, req(e, { code: e.codes.staff, table: 'code_vaults', fields: Object.assign({}, ROW, { cipher: hex(31) }) })).ok, false);
  const off = env(false);
  assert.equal(save(off, req(off, { code: off.codes.owner, table: 'code_vaults', fields: ROW })).ok, false);
});

test('anything that is not sealed hex is refused: a plain code, a weak seal, a strange id', () => {
  const e = env();
  const bad = (f) => save(e, req(e, { code: e.codes.owner, table: 'code_vaults', fields: Object.assign({}, ROW, f) }));
  assert.equal(bad({ cipher: 'TESTCODE23' }).ok, false);
  assert.equal(bad({ kdf_iter: '1000' }).ok, false);
  assert.equal(bad({ kdf: 'none' }).ok, false);
  assert.equal(bad({ iv: hex(4) }).ok, false);
  assert.equal(bad({ code_id: 'anything' }).ok, false);
  assert.equal(bad({ code_id: e.ids.staff }).ok, true);
});

test('code check: match true only for the right code against its own id; nothing logged or echoed', () => {
  const e = env();
  const logs0 = e.logs.length;   // set-up logs (adminAddStaffCode prints a new code to its owner) are not part of this check
  const chk = (typed, id, code = e.codes.owner) => post(e, { v: 1, action: 'code_check', code, code_id: id, typed });
  const yes = chk(e.codes.staff, e.ids.staff);
  assert.deepEqual(yes, { ok: true, result: { match: true } });
  assert.equal(chk(' ' + e.codes.staff + ' ', e.ids.staff).result.match, true);
  assert.equal(chk(e.codes.staff, e.ids.owner).result.match, false, 'the right code under another person is a no');
  assert.equal(chk('WRONGCODE9', e.ids.staff).result.match, false);
  assert.equal(chk(e.codes.staff, e.ids.staff, e.codes.staff).code, 'NOT_ALLOWED', 'staff codes cannot use the vault');
  assert.equal(chk(e.codes.staff, 'nope').code, 'INVALID');
  const all = JSON.stringify(e.logs.slice(logs0)) + JSON.stringify(e.drive);
  assert.ok(!all.includes(e.codes.staff), 'the typed code is in no log and no file');
});

test('code check misses count towards the sign-in limit', () => {
  const e = env();
  let last;
  for (let i = 0; i < 30; i++) { last = post(e, { v: 1, action: 'code_check', code: e.codes.owner, code_id: e.ids.staff, typed: 'WRONG' + i }); if (!last.ok) break; }
  assert.equal(last.code, 'TOO_MANY_TRIES');
});
