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
const TYPE_H = ['id', 'tenant_id', 'type_key', 'label', 'target', 'asks_item', 'asks_amount', 'amount_unit', 'frequency', 'active', 'effective_from', 'source', 'note', 'set_at', 'set_by'];
const LOG_H = ['id', 'tenant_id', 'check_type_id', 'area_id', 'subject_id', 'item', 'amount', 'outcome', 'happened_at', 'note', 'taken_at', 'taken_by', 'corrects_id'];
const flush = () => new Promise((r) => setTimeout(r, 15));

function world() {
  const env = standardEnv({ props: { TABLE_ON_check_type: 'true', TABLE_ON_check_log: 'true', READ_ENABLED: 'true' } });
  env.addFile('BLD-check_type.csv', fx.headerOnly(TYPE_H));
  env.addFile('BLD-check_log.csv', fx.headerOnly(LOG_H));
  // the permissions Lisa would add: staff may see the three lists the screen needs
  const vis = env.file('BLD-field_visibility.csv')[0];
  [['check_type', ['id', 'type_key', 'label', 'target', 'asks_item', 'asks_amount', 'amount_unit', 'active', 'effective_from']], ['area', ['id', 'code']], ['subject', ['id', 'name']]].forEach(([t, cols]) => {
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
  assert.equal(w.host.querySelector('.bs-result').textContent, 'Saved.');
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
