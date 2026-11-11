'use strict';
/** The staff checks screen, driven in a fake browser against the REAL Apps Script code on a fake Drive. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const { standardEnv, save, req } = require('./harness');
const fx = require('./fixtures');
const BLDSave = require('../client/bld-save.js');
const BLDChecks = require('../records/checks.js');

const URL_OK = 'https://script.google.com/macros/s/AKfycbxTEST/exec';
const TYPE_H = ['id', 'tenant_id', 'type_key', 'label', 'target', 'asks_item', 'item_label', 'asks_amount', 'amount_unit', 'note_label', 'note_required', 'asks_outcome', 'frequency', 'active', 'effective_from', 'source', 'note', 'set_at', 'set_by', 'every_days', 'group', 'includes', 'sop', 'evidence', 'site_scope', 'not_in_areas'];
const LOG_H = ['id', 'tenant_id', 'check_type_id', 'area_id', 'subject_id', 'item', 'amount', 'outcome', 'happened_at', 'note', 'taken_at', 'taken_by', 'corrects_id', 'photo', 'how_recorded'];
const flush = () => new Promise((r) => setTimeout(r, 15));

function world() {
  const env = standardEnv({ props: { TABLE_ON_check_type: 'true', TABLE_ON_check_log: 'true', READ_ENABLED: 'true' } });
  env.addFile('BLD-check_type.csv', fx.headerOnly(TYPE_H));
  env.addFile('BLD-check_log.csv', fx.headerOnly(LOG_H));
  // the permissions Lisa would add: staff may see the three lists the screen needs
  const vis = env.file('BLD-field_visibility.csv')[0];
  [['check_type', ['id', 'type_key', 'label', 'target', 'asks_item', 'item_label', 'asks_amount', 'amount_unit', 'note_label', 'note_required', 'asks_outcome', 'active', 'effective_from']], ['area', ['id', 'code']], ['subject', ['id', 'name']]].forEach(([t, cols]) => {
    vis.content += `v-${t}*,${fx.TENANT},${t},*,aud-staff,yes,,,,,,\r\n`;
    cols.forEach((c) => { vis.content += `v-${t}-${c},${fx.TENANT},${t},${c},aud-staff,yes,,,,,\r\n`; });
  });
  const r = save(env, req(env, { code: env.codes.owner, table: 'check_type', fields: { type_key: 'feeding', label: 'Feeding', target: 'dog', asks_item: 'true', asks_amount: 'true', amount_unit: 'g', effective_from: '2026-01-01' } }));
  assert.equal(r.ok, true, JSON.stringify(r));
  const fetch = async (url, init = {}) => {
    if (!init.method || init.method === 'GET') { const o = env.ctx.doGet({ parameter: {} }); return { json: async () => JSON.parse(o.getContent()) }; }
    const o = env.ctx.doPost({ postData: { contents: init.body } });
    return { json: async () => JSON.parse(o.getContent()) };
  };
  const s = BLDSave.create({ fetch, localStorage: null, sessionStorage: null, scriptUrl: URL_OK });
  s.setCode(env.codes.staff, false);
  const dom = new JSDOM('<div id="a"></div>');
  return { env, s, dom, host: dom.window.document.getElementById('a') };
}
const logRows = (env) => { const [h, ...rows] = env.ctx.csvParse_(env.file('BLD-check_log.csv')[0].content).filter((r) => r.length > 1); return rows.map((r) => Object.fromEntries(h.map((c, i) => [c, r[i] || '']))); };
const opts = { type: 'feeding', now: new Date('2026-11-08T10:00:00Z') };
const fill = (d, id, v) => { d.getElementById('chk-' + id).value = v; };
const press = (w) => w.host.querySelector('form').dispatchEvent(new w.dom.window.Event('submit', { cancelable: true, bubbles: true }));

test('checks screen: feeding saves end to end, as the staff member, to the check log', async () => {
  const w = world(), d = w.dom.window.document;
  const m = await BLDChecks.mount(w.host, w.s, opts);
  assert.equal(m.ok, true, JSON.stringify(m));
  assert.equal(d.getElementById('chk-area_id').closest('.bs-field').hidden, true);
  fill(d, 'subject_id', 'sub-test-a'); fill(d, 'item', 'Dry food'); fill(d, 'amount', '250'); fill(d, 'outcome', 'ok');
  press(w); await flush();
  assert.equal(w.host.querySelector('.bs-result').textContent, 'Saved. Feeding, Test A, Dry food, 250.');
  const rows = logRows(w.env);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].subject_id, 'sub-test-a');
  assert.equal(rows[0].amount, '250');
  assert.equal(rows[0].taken_by, 'Sam Staff');
  assert.equal(d.getElementById('chk-item').value, '');
});

test('checks screen: a missing dog or a concern without a note is stopped before sending', async () => {
  const w = world(), d = w.dom.window.document;
  await BLDChecks.mount(w.host, w.s, opts);
  fill(d, 'item', 'Dry food'); fill(d, 'amount', '250'); fill(d, 'outcome', 'concern');
  press(w); await flush();
  assert.match(w.host.textContent, /Choose the dog/);
  assert.match(w.host.textContent, /what the concern is/);
  assert.equal(logRows(w.env).length, 0);
});

test('checks screen: dog names from the sheet are shown as text, never as markup', async () => {
  const w = world();
  w.env.file('BLD-subject.csv')[0].content += `sub-x,${fx.TENANT},<img src=x>,2020-01-01,Female,1\r\n`;
  assert.equal((await BLDChecks.mount(w.host, w.s, opts)).ok, true);
  assert.equal(w.host.querySelector('img'), null);
  assert.ok(w.host.textContent.includes('<img src=x>'));
});

test('current checks: latest version on or before today wins; retired and future ones are left out', () => {
  const rows = [
    { id: 'a', type_key: 'feeding', label: 'Old', effective_from: '2026-01-01' },
    { id: 'b', type_key: 'feeding', label: 'New', effective_from: '2026-06-01' },
    { id: 'c', type_key: 'feeding', label: 'Future', effective_from: '2027-01-01' },
    { id: 'd', type_key: 'gone', label: 'Gone', effective_from: '2026-01-01' },
    { id: 'e', type_key: 'gone', label: 'Gone', effective_from: '2026-02-01', active: 'false' }
  ];
  assert.deepEqual(BLDChecks.currentTypes(rows, '2026-11-08').map((r) => r.id), ['b']);
});

test('checks screen: stays closed while the table is off', async () => {
  const w = world();
  w.env.props.TABLE_ON_check_log = 'false';
  assert.equal((await BLDChecks.mount(w.host, w.s, opts)).reason, 'off');
});

test('the four approved checks, one after another, each save with their own wording and rules', async () => {
  const w = world(), d = w.dom.window.document;
  const add = (f) => assert.equal(save(w.env, req(w.env, { code: w.env.codes.owner, table: 'check_type', fields: Object.assign({ effective_from: '2026-01-01' }, f) })).ok, true);
  add({ type_key: 'medicine', label: 'Medicine given', target: 'dog', asks_item: 'true', item_label: 'Medicine', asks_amount: 'true', amount_unit: 'dose' });
  add({ type_key: 'cleaning', label: 'Cleaning', target: 'area' });
  add({ type_key: 'incident', label: 'Incident or near miss', target: 'optional', note_label: 'What happened?', note_required: 'true', asks_outcome: 'false' });
  await BLDChecks.mount(w.host, w.s, opts);
  const pick = (k) => { fill(d, 'check', k); d.getElementById('chk-check').dispatchEvent(new w.dom.window.Event('change')); };
  const go = async () => { press(w); await flush(); return w.host.querySelector('.bs-result').textContent; };
  pick('feeding'); fill(d, 'subject_id', 'sub-test-a'); fill(d, 'item', 'Dry'); fill(d, 'amount', '250'); fill(d, 'outcome', 'ok');
  assert.match(await go(), /^Saved/);
  pick('medicine');
  assert.equal(d.querySelector('label[for=chk-item]').textContent, 'Medicine');
  fill(d, 'subject_id', 'sub-test-a'); fill(d, 'outcome', 'ok');
  await go();
  assert.match(w.host.textContent, /This is needed/);
  fill(d, 'item', 'Wormer'); fill(d, 'amount', '1');
  assert.match(await go(), /^Saved/);
  pick('cleaning'); fill(d, 'area_id', 'area-t1'); fill(d, 'outcome', 'not_done');
  await go();
  assert.match(w.host.textContent, /why it was not done/);
  fill(d, 'outcome', 'ok');
  assert.match(await go(), /^Saved/);
  pick('incident');
  assert.equal(d.getElementById('chk-outcome').closest('.bs-field').hidden, true);
  await go();
  assert.match(w.host.textContent, /This is needed/);
  fill(d, 'note', 'Gate left open, no harm');
  assert.match(await go(), /^Saved/);
  const rows = logRows(w.env);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.outcome), ['ok', 'ok', 'ok', 'recorded']);
  assert.equal(rows[3].area_id + rows[3].subject_id, '');
});

test('published checks page: its copy of the screen matches, and it loads only published files', () => {
  const fs = require('node:fs'), path = require('node:path'), root = path.join(__dirname, '..', '..');
  assert.equal(fs.readFileSync(path.join(root, 'cdhub/checks/checks.js'), 'utf8'), fs.readFileSync(path.join(root, 'cdhub-write/records/checks.js'), 'utf8'));
  const html = fs.readFileSync(path.join(root, 'cdhub/checks/index.html'), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)) assert.ok(fs.existsSync(path.join(root, 'cdhub/checks', m[1])), m[1]);
});

test('published checks page: a refused code brings the code box back, and typing is sent in capitals', async () => {
  const fs = require('node:fs'), path = require('node:path');
  const { JSDOM } = require('jsdom');
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'cdhub/checks/index.html'), 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
  const codes = [];
  const fake = { getScriptUrlSet: () => true, setCode: (c) => codes.push(c), clearCode: () => codes.push('') };
  const dom = new JSDOM(html, { url: 'https://example.test/cdhub/checks/', runScripts: 'outside-only' });
  const w = dom.window;
  w.BLDSave = { create: () => fake };
  w.BLDChecks = { mount: () => Promise.resolve({ ok: false, reason: 'read' }) };
  w.eval(dom.window.document.querySelector('script').textContent);
  const gate = w.document.getElementById('gate'), code = w.document.getElementById('code');
  assert.equal(gate.hidden, false);
  code.value = 'abc234';
  gate.dispatchEvent(new w.Event('submit', { cancelable: true }));
  assert.equal(gate.hidden, true);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(codes, ['ABC234', '']);
  assert.equal(gate.hidden, false);
  assert.equal(code.value, '');
});

test('the dog list is only dogs on site, A-Z: a dog that has left is not offered', async () => {
  global.BLDOccupancy = require('../client/occupancy.js');
  try {
    const w = world(), d = w.dom.window.document;
    const occ = w.env.file('BLD-occupancy.csv')[0];
    const h = w.env.ctx.csvParse_(occ.content)[0], row = (o) => h.map((c) => o[c] || '').join(',') + '\r\n';
    occ.content += row({ id: 'occ-left', tenant_id: fx.TENANT, subject_id: 'sub-test-a', off_site_kind: 'sold', moved_in: '2026-11-01' });
    await BLDChecks.mount(w.host, w.s, opts); await flush();
    const names = [...d.getElementById('chk-subject_id').options].map((o) => o.value).filter(Boolean);
    assert.equal(names.includes('sub-test-a'), false);
    assert.ok(names.length > 0);
    assert.deepEqual(names, names.slice().sort());
  } finally { delete global.BLDOccupancy; }
});

test('a room whose room.in_use rows ended before today is never offered on the checks; one still in use is', async () => {
  global.BLDNeeds = require('../client/needs.js');
  global.BLDOccupancy = require('../client/occupancy.js');
  try {
    const w = world(), d = w.dom.window.document;
    const af = w.env.file('BLD-area.csv')[0];
    const h = w.env.ctx.csvParse_(af.content)[0];
    af.content += h.map((c) => ({ id: 'area-old', tenant_id: fx.TENANT, code: 'OLD1', grouping: 'T - Test house' })[c] || '').join(',') + '\r\n';
    af.content += h.map((c) => ({ id: 'area-new', tenant_id: fx.TENANT, code: 'NEW1', grouping: 'T - Test house' })[c] || '').join(',') + '\r\n';
    const RH = ['id', 'tenant_id', 'need_type', 'target_table', 'target_id', 'from_date', 'to_date', 'source', 'set_by', 'set_on'];
    const row = (o) => RH.map((c) => o[c] || '').join(',');
    const vis = w.env.file('BLD-field_visibility.csv')[0];
    ['*', 'id', 'need_type', 'target_table', 'target_id', 'from_date', 'to_date'].forEach((c) => { vis.content += `v-req-${c},${fx.TENANT},requirement,${c},aud-staff,yes,,,,,\r\n`; });
    w.env.addFile('BLD-requirement.csv', RH.join(',') + '\r\n'
      + row({ id: 'req-1', tenant_id: fx.TENANT, need_type: 'room.in_use', target_table: 'area', target_id: 'area-old', from_date: '2026-01-01', to_date: '2026-01-02' }) + '\r\n'
      + row({ id: 'req-2', tenant_id: fx.TENANT, need_type: 'room.in_use', target_table: 'area', target_id: 'area-new', from_date: '2026-01-01' }) + '\r\n');
    await BLDChecks.mount(w.host, w.s, opts); await flush();
    const rooms = [...d.getElementById('chk-area_id').options].map((o) => o.value).filter(Boolean);
    assert.equal(rooms.includes('area-old'), false);
    assert.equal(rooms.includes('area-new'), true);
    assert.ok(rooms.length > 1);
  } finally { delete global.BLDOccupancy; delete global.BLDNeeds; }
});

test('inUse is the one room rule: no rows = in use; rows = in use only on covered days (11 Nov in, 12 Nov out); a ZZ_ name means nothing now', () => {
  const Occ = require('../client/occupancy.js');
  const req = [{ need_type: 'room.in_use', target_table: 'area', target_id: 'a2', from_date: '2026-01-01', to_date: '2026-11-11' },
    { need_type: 'reading.temperature', target_table: 'thermometer', target_id: 'a3', from_date: '2026-01-01', to_date: '2026-01-02' }];
  const T = { area: [{ id: 'a1', code: 'R1' }, { id: 'a2', code: '3A.1' }, { id: 'a3', code: 'ZZ_R3' }], subject: [], occupancy: [], subject_status: [], requirement: req };
  assert.deepEqual(Occ.dailyList(T, '2026-11-11').areas.map((a) => a.id), ['a1', 'a2', 'a3']);
  assert.deepEqual(Occ.dailyList(T, '2026-11-12').areas.map((a) => a.id), ['a1', 'a3']);   // another need_type never hides a room
  assert.equal(Occ.inUse({ id: 'a2' }, '2026-11-11', req), true);
  assert.equal(Occ.inUse({ id: 'a2' }, '2026-11-12', req), false);
  assert.equal(Occ.inUse({ id: 'a2' }, '2025-12-31', req), false);
  assert.equal(Occ.inUse({ id: 'x', code: 'ZZ_X' }, '2026-11-12', req), true);
  assert.equal(Occ.inUse(null), false);
});

test('BLDNeeds.coversDay: inclusive both ends, blank to_date = no end, any covering row counts; endDay gives the last day', () => {
  const N = require('../client/needs.js');
  const r = (f, t) => ({ need_type: 'n', target_table: 't', target_id: '1', from_date: f, to_date: t || '' });
  assert.equal(N.coversDay([], 'n', 't', '1', '2026-11-12'), true);
  const rows = [r('2026-11-01', '2026-11-05'), r('2026-11-10', '2026-11-11')];
  ['2026-11-01', '2026-11-05', '2026-11-10', '2026-11-11'].forEach((d) => assert.equal(N.coversDay(rows, 'n', 't', '1', d), true, d));
  ['2026-10-31', '2026-11-06', '2026-11-12'].forEach((d) => assert.equal(N.coversDay(rows, 'n', 't', '1', d), false, d));
  assert.equal(N.coversDay([r('2026-11-01')], 'n', 't', '1', '2099-01-01'), true);
  assert.equal(N.endDay(rows, 'n', 't', '1'), '2026-11-11');
  assert.equal(N.endDay(rows.concat([r('2026-11-20')]), 'n', 't', '1'), '');
  assert.equal(N.endDay([], 'n', 't', '1'), '');
  assert.equal(N.coversDay(rows, 'n', 't', '2', '2026-11-12'), true);   // another target has no rows: open
});
