'use strict';
// Code admin on the owner page (13 Nov 2026, draft for V8): make, rename, new code; no-secrets BLD-code_register mirror.
const { test } = require('node:test');
const assert = require('node:assert');
const { standardEnv, req, save } = require('./harness');

const REG_H = 'id,tenant_id,code_id,who,role,from_date,to_date,ended_by';
function env(on) {
  const e = standardEnv({ props: on === false ? {} : { TABLE_ON_code_register: 'true' } });
  e.addFile('BLD-code_register.csv', REG_H + '\r\n');
  e.email = 'owner@example.test';
  return e;
}
const rows = (e) => e.file('BLD-code_register.csv')[0].content.trim().split(/\r?\n/).slice(1);
const saves = (e, code) => save(e, req(e, { code })).ok;

test('make a code: owner only; the code works at once, is returned once, and only its name/role/dates reach the register', () => {
  const e = env();
  e.email = 'sam@example.test';
  assert.equal(e.ctx.ui_issueCode('New Person', 'STAFF').code, 'NOT_OWNER');
  e.email = 'owner@example.test';
  const r = e.ctx.ui_issueCode('New Person', 'staff');
  assert.equal(r.ok, true, JSON.stringify(r));
  const code = r.result.code;
  assert.match(code, /^[A-HJ-NP-Z2-9]{10}$/);
  assert.equal(r.result.role, 'STAFF');
  assert.equal(r.result.mirrored, true);
  assert.equal(saves(e, code), true);
  const reg = e.props.STAFF_REGISTRY;
  assert.ok(!reg.includes(code), 'the registry holds a hash, not the code');
  const all = JSON.stringify(e.drive);
  assert.ok(!all.includes(code), 'the code is in no file');
  assert.equal(rows(e).length, 1);
  assert.match(rows(e)[0], new RegExp('^cr-[^,]+,[^,]+,' + r.result.id + ',New Person,STAFF,\\d{4}-\\d{2}-\\d{2},,$'));
  assert.equal(e.ctx.ui_issueCode('', 'STAFF').code, 'INVALID');
  assert.equal(e.ctx.ui_issueCode('=HACK()', 'STAFF').code, 'INVALID');
  assert.equal(e.ctx.ui_issueCode('X', 'GUEST').code, 'INVALID');
});

test('rename: same code, new name; the register row is ended and a new one added', () => {
  const e = env();
  const r = e.ctx.ui_renameCode(e.ids.staff, 'Sam Renamed');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(saves(e, e.codes.staff), true);
  assert.equal(e.ctx.ui_staffList().result.staff.find((p) => p.id === e.ids.staff).who, 'Sam Renamed');
  assert.equal(e.ctx.ui_renameCode(e.ids.staff, 'Sam Renamed').code, 'NOTHING_CHANGED');
  assert.equal(e.ctx.ui_renameCode('sc-nobody', 'X').code, 'NOT_FOUND');
});

test('new code for the same person: old code refused at once, new one works, the public id stays', () => {
  const e = env();
  e.ctx.ui_codeRegisterSync();
  const r = e.ctx.ui_resetCode(e.ids.staff);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.result.id, e.ids.staff);
  assert.equal(saves(e, e.codes.staff), false);
  assert.equal(saves(e, r.result.code), true);
  const mine = rows(e).filter((l) => l.includes(',' + e.ids.staff + ','));
  assert.equal(mine.length, 2);
  assert.match(mine[0], /,\d{4}-\d{2}-\d{2},new code by owner$/);
  assert.match(mine[1], /,Sam Staff,STAFF,\d{4}-\d{2}-\d{2},,$/);
  const list = e.ctx.ui_staffList().result.staff;
  assert.equal(list.filter((p) => p.replaced).length, 1);
  assert.equal(list.filter((p) => p.id === e.ids.staff && p.active).length, 1);
  // switching off ends the open row
  assert.equal(e.ctx.ui_revokeCode(e.ids.staff).result.mirrored, true);
  assert.match(rows(e).filter((l) => l.includes(',' + e.ids.staff + ','))[1], /,switched off by owner$/);
});

test('sync fills the register once; with the register off, codes still work and the reply says mirrored:false', () => {
  const e = env();
  assert.equal(e.ctx.ui_codeRegisterSync().result.added, 2);
  assert.equal(e.ctx.ui_codeRegisterSync().result.added, 0);
  const off = env(false);
  const r = off.ctx.ui_issueCode('Off Person', 'STAFF');
  assert.equal(r.ok, true);
  assert.equal(r.result.mirrored, false);
  assert.equal(rows(off).length, 0);
  assert.equal(off.ctx.ui_codeRegisterSync().code, 'TABLE_OFF');
});

test('owner page: Make their code shows it once; "I have written it down" clears it; New code and Change name work from the list', async () => {
  const { JSDOM } = require('jsdom');
  const fs = require('node:fs'), path = require('node:path');
  const e = env();
  const html = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'ApprovePage.html'), 'utf8');
  const w = new JSDOM(html, { runScripts: 'outside-only', url: 'https://script.example.test/' }).window;
  const run = () => {
    let ok = () => {};
    const p = new Proxy({}, { get: (_, k) => {
      if (k === 'withSuccessHandler') return (f) => { ok = f; return p; };
      if (k === 'withFailureHandler') return () => p;
      return (...a) => setTimeout(() => ok(JSON.parse(JSON.stringify(e.ctx[k](...a)))), 0);
    } });
    return p;
  };
  w.google = { script: { get run() { return run(); } } };
  w.confirm = () => true;
  w.prompt = () => 'Sam New Name';
  w.eval(html.split('<script>')[1].split('</script>')[0]);
  const tick = () => new Promise((r) => setTimeout(r, 5));
  const $ = (s) => w.document.querySelector(s);

  $('#sc-name').value = 'Page Person'; $('#sc-issue').click(); await tick();
  const code = $('#sc-once-code').textContent;
  assert.match(code, /^[A-HJ-NP-Z2-9]{10}$/);
  assert.equal($('#sc-once').hidden, false);
  assert.equal(saves(e, code), true);
  $('#sc-once-hide').click(); await tick(); await tick();
  assert.equal($('#sc-once-code').textContent, '');
  assert.equal($('#sc-once').hidden, true);
  assert.equal(w.document.body.textContent.includes(code), false);
  const card = [...$('#sc-list').children].find((c) => c.textContent.includes('Sam Staff'));
  [...card.querySelectorAll('button')].find((b) => b.textContent === 'Change name').click(); await tick();
  assert.equal(e.ctx.ui_staffList().result.staff.find((p) => p.id === e.ids.staff).who, 'Sam New Name');
  [...card.querySelectorAll('button')].find((b) => b.textContent === 'Give them a new code').click(); await tick();
  assert.match($('#sc-once-code').textContent, /^[A-HJ-NP-Z2-9]{10}$/);
  assert.equal(saves(e, e.codes.staff), false);
});
