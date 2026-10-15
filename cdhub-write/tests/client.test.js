'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fsx = require('node:fs'), pathx = require('node:path');
const CODE = fsx.existsSync(pathx.join(__dirname, '..', 'code')) ? pathx.join(__dirname, '..', 'code') : pathx.join(__dirname, '..');
const BLDSave = require(CODE + '/client/bld-save.js');
const BLDBands = require(CODE + '/client/bands.js');

const GOOD_URL = 'https://script.google.com/macros/s/AKfycbxTESTTESTTEST/exec';

/** A fake fetch that behaves like the Apps Script web app. */
function fakeServer(over = {}) {
  const calls = [];
  const state = Object.assign({
    saveEnabled: true,
    tables: [{ key: 'area_reading', file: 'BLD-area_reading.csv', on: true, mode: 'pending' }],
    proposed: ['round_event', 'staff'],
    reply: { ok: true, result: { status: 'queued', id: 'rdg-test-1', pending_id: 'pnd-1' } },
    fail: false
  }, over);
  const f = async (url, init = {}) => {
    calls.push({ url, init });
    if (state.fail) throw new Error('offline');
    if (!init.method || init.method === 'GET') return { json: async () => ({ ok: true, version: '1.0.0', saveEnabled: state.saveEnabled, tables: state.tables, proposed: state.proposed }) };
    return { json: async () => state.reply };
  };
  return { f, calls, state };
}

const mk = (srv, extra = {}) => BLDSave.create(Object.assign({ fetch: srv.f, localStorage: null, sessionStorage: null }, extra));

test('ships OFF: no Script URL means no save and the banner says so', async () => {
  const srv = fakeServer();
  const s = mk(srv);
  await s.checkStatus();
  const b = s.banner('area_reading');
  assert.equal(b.kind, 'off');
  assert.equal(b.canSave, false);
  assert.match(b.text, /Saving is off/);
  s.setLookups({ area: [{ id: 'area-t1' }] }); s.setCode('ABC');
  const r = await s.submit('area_reading', { area_id: 'area-t1', min_c: '20', max_c: '21' });
  assert.equal(r.code, 'SAVE_OFF');
  assert.equal(srv.calls.length, 0); // nothing was even sent
});

test('only a real Apps Script address is accepted as the Script URL', () => {
  const s = mk(fakeServer());
  ['http://script.google.com/macros/s/ABC/exec', 'https://evil.example/macros/s/ABC/exec', 'https://script.google.com/macros/s/ABC/dev',
    'https://script.google.com.evil.example/macros/s/ABC/exec', 'javascript:alert(1)', 'ABC'].forEach((u) => {
    assert.equal(s.setScriptUrl(u).ok, false, u);
    assert.equal(s.getScriptUrlSet(), false);
  });
  assert.equal(s.setScriptUrl(GOOD_URL).ok, true);
  assert.equal(s.getScriptUrlSet(), true);
});

test('banner follows what the script reports', async () => {
  const srv = fakeServer();
  const s = mk(srv, { scriptUrl: GOOD_URL });
  assert.equal(s.banner('area_reading').kind, 'checking');
  await s.checkStatus();
  assert.equal(s.banner('area_reading').kind, 'pending');
  assert.equal(s.banner('area_reading').canSave, true);
  assert.equal(s.banner('staff').canSave, false);
  assert.match(s.banner('staff').text, /only a proposal/);
  srv.state.tables[0].mode = 'direct'; await s.checkStatus();
  assert.equal(s.banner('area_reading').kind, 'on');
  srv.state.saveEnabled = false; await s.checkStatus();
  assert.equal(s.banner('area_reading').kind, 'off');
  srv.state.fail = true; await s.checkStatus();
  assert.match(s.banner('area_reading').text, /Cannot reach/);
});

test('page checks mirror the server and give plain messages', () => {
  const s = mk(fakeServer());
  s.setLookups({ area: [{ id: 'area-t1' }] });
  assert.equal(s.validate('area_reading', { area_id: 'area-t1', min_c: '21.47', max_c: '24' }).ok, true);
  const e = s.validate('area_reading', { area_id: 'area-zz', min_c: '25', max_c: '20', spot_c: '1.234', mitigation_note: '=SUM(A1)' }).errors;
  assert.match(e.area_id, /Not found/);
  assert.match(e.min_c, /lowest cannot be higher/);
  assert.match(e.spot_c, /2 decimals/);
  assert.match(e.mitigation_note, /do not start with/);
  const none = mk(fakeServer());
  assert.match(none.validate('area_reading', { area_id: 'area-t1', min_c: '1', max_c: '2' }).errors.area_id, /list is not loaded/);
});

test('submit sends one POST as plain text with the code in the body, never in the address', async () => {
  const srv = fakeServer();
  const s = mk(srv, { scriptUrl: GOOD_URL });
  await s.checkStatus(); s.setLookups({ area: [{ id: 'area-t1' }] }); s.setCode('SECRETCODE1');
  const r = await s.submit('area_reading', { area_id: 'area-t1', min_c: '21.47', max_c: '24.10' });
  assert.equal(r.ok, true);
  assert.equal(r.status, 'queued');
  assert.match(r.message, /waiting for Lisa/);
  const post = srv.calls.find((c) => c.init.method === 'POST');
  assert.ok(!post.url.includes('SECRETCODE1'));
  assert.equal(post.init.headers['Content-Type'], 'text/plain;charset=utf-8');
  const body = JSON.parse(post.init.body);
  assert.equal(body.code, 'SECRETCODE1');
  assert.equal(body.table, 'area_reading');
  assert.equal(body.action, 'add');
  assert.match(body.request_id, /^r-/);
});

test('a refusal from the script comes back with its field messages', async () => {
  const srv = fakeServer({ reply: { ok: false, code: 'INVALID', message: 'Some details need fixing', fields: { min_c: 'No.' } } });
  const s = mk(srv, { scriptUrl: GOOD_URL });
  await s.checkStatus(); s.setLookups({ area: [{ id: 'area-t1' }] }); s.setCode('X');
  const r = await s.submit('area_reading', { area_id: 'area-t1', min_c: '21', max_c: '22' });
  assert.equal(r.ok, false); assert.equal(r.code, 'INVALID'); assert.equal(r.fields.min_c, 'No.');
});

test('a network failure is honest and a retry reuses the same request id', async () => {
  const srv = fakeServer();
  const s = mk(srv, { scriptUrl: GOOD_URL });
  await s.checkStatus(); s.setLookups({ area: [{ id: 'area-t1' }] }); s.setCode('X');
  srv.state.fail = true;
  const a = await s.submit('area_reading', { area_id: 'area-t1', min_c: '21', max_c: '22' }, { requestId: 'r-fixed-0001' });
  assert.equal(a.code, 'NETWORK');
  assert.match(a.message, /not confirmed as saved/);
  assert.equal(a.requestId, 'r-fixed-0001');
  srv.state.fail = false;
  await s.submit('area_reading', { area_id: 'area-t1', min_c: '21', max_c: '22' }, { requestId: 'r-fixed-0001' });
  const posts = srv.calls.filter((c) => c.init.method === 'POST').map((c) => JSON.parse(c.init.body).request_id);
  assert.deepEqual(posts, ['r-fixed-0001', 'r-fixed-0001']);
});

test('no staff code, bad fields: nothing is sent', async () => {
  const srv = fakeServer();
  const s = mk(srv, { scriptUrl: GOOD_URL });
  await s.checkStatus(); s.setLookups({ area: [{ id: 'area-t1' }] });
  assert.equal((await s.submit('area_reading', { area_id: 'area-t1', min_c: '1', max_c: '2' })).code, 'NO_CODE');
  s.setCode('X');
  assert.equal((await s.submit('area_reading', { area_id: 'area-t1', min_c: 'x', max_c: '2' })).code, 'INVALID');
  assert.equal(srv.calls.filter((c) => c.init.method === 'POST').length, 0);
});

test('a correction carries the id it corrects and a reason', async () => {
  const srv = fakeServer();
  const s = mk(srv, { scriptUrl: GOOD_URL });
  await s.checkStatus(); s.setLookups({ area: [{ id: 'area-t1' }] }); s.setCode('X');
  await s.submit('area_reading', { area_id: 'area-t1', min_c: '20', max_c: '21' }, { action: 'correct', correctsId: 'rdg-1', reason: 'typo' });
  const body = JSON.parse(srv.calls.find((c) => c.init.method === 'POST').init.body);
  assert.equal(body.action, 'correct'); assert.equal(body.corrects_id, 'rdg-1'); assert.equal(body.reason, 'typo');
});

test('config file in Drive: only a clean, single, switched-on file with a real Script URL turns saving on', async () => {
  const run = async (list, cfg) => {
    const f = async (url) => (url.includes('alt=media') ? { json: async () => cfg } : { json: async () => ({ files: list }) });
    const s = BLDSave.create({ fetch: f, localStorage: null, sessionStorage: null });
    const r = await s.loadConfigFromDrive('tok', 'FOLDER', undefined);
    return { r, set: s.getScriptUrlSet() };
  };
  assert.deepEqual(await run([], {}), { r: { ok: false, message: 'No save config file in the folder, so saving stays off.' }, set: false });
  assert.equal((await run([{ id: 'a' }, { id: 'b' }], {})).set, false);
  assert.equal((await run([{ id: 'a' }], { saving: 'off', scriptUrl: GOOD_URL })).set, false);
  assert.equal((await run([{ id: 'a' }], { saving: 'on', scriptUrl: 'https://evil.example/exec' })).set, false);
  assert.equal((await run([{ id: 'a' }], { saving: 'on', scriptUrl: GOOD_URL })).set, true);
});

// ------------------------------------------------------------------ bands
const BANDS = BLDBands.parseBands([
  { id: 'tb-u4', band: 'under four weeks', age_from_days: '0', age_to_days: '28', min_temp: '26.00', max_temp: '28.00' },
  { id: 'tb-o4', band: 'four weeks and over', age_from_days: '29', age_to_days: '', min_temp: '10.00', max_temp: '26.00' }
]);
const ACTIONS = BLDBands.parseActions([
  { direction: 'below', threshold_c: '10.00', action: 'EMERGENCY' }, { direction: 'above', threshold_c: '25.00', action: 'shade' },
  { direction: 'above', threshold_c: '26.00', action: 'fans' }, { direction: 'above', threshold_c: '28.00', action: 'hose' }
]);

test('bands: the youngest dog sets the band; no dogs or no dates is said plainly', () => {
  assert.equal(BLDBands.ageDays('2026-10-01', '2026-10-15'), 14);
  const b = BLDBands.bandFor([{ id: 'a', dob: '2020-01-01' }, { id: 'p', dob: '2026-10-01' }], '2026-10-15', BANDS);
  assert.equal(b.band.id, 'tb-u4'); assert.equal(b.dogId, 'p'); assert.equal(b.days, 14);
  assert.equal(BLDBands.bandFor([{ id: 'a', dob: '2020-01-01' }], '2026-10-15', BANDS).band.id, 'tb-o4');
  assert.match(BLDBands.bandFor([], '2026-10-15', BANDS).reason, /room unknown/);
  assert.match(BLDBands.bandFor([{ id: 'x', dob: '' }], '2026-10-15', BANDS).reason, /no date of birth/);
});

test('bands: verdicts and the action ladder', () => {
  const adult = BANDS[1];
  assert.equal(BLDBands.verdict('21.47', adult), 'ok');
  assert.equal(BLDBands.verdict('9.99', adult), 'low');
  assert.equal(BLDBands.verdict('26.01', adult), 'high');
  assert.equal(BLDBands.verdict('', adult), '');
  assert.equal(BLDBands.verdict('20', null), '');
  assert.equal(BLDBands.actionFor('9', ACTIONS), 'EMERGENCY');
  assert.equal(BLDBands.actionFor('26.5', ACTIONS), 'fans');   // highest rung reached
  assert.equal(BLDBands.actionFor('28.5', ACTIONS), 'hose');
  assert.equal(BLDBands.actionFor('20', ACTIONS), '');
});

// ------------------------------------------------------------------ screens (DOM)
// jsdom is a required dev dependency: these screen tests must run, never be skipped. (`npm install` first.)
const { JSDOM } = require('jsdom');
const domTest = test;

function page() {
  const dom = new JSDOM('<!doctype html><body><div id="h"></div></body>');
  return { doc: dom.window.document, host: dom.window.document.getElementById('h') };
}

domTest('temperature screen: saving off disables every Save button and says why', async () => {
  global.BLDBands = BLDBands;
  const Screens = require(CODE + '/screens/screens.js');
  const { doc, host } = page();
  const save = mk(fakeServer());
  Screens.temperatureEntry(host, { save, document: doc, areas: [{ id: 'area-t1', label: 'T1' }, { id: 'area-t2', label: 'T2' }] });
  assert.match(host.querySelector('.bs-banner').textContent, /Saving is off/);
  const btns = host.querySelectorAll('.bs-btn');
  assert.equal(btns.length, 2);
  btns.forEach((b) => assert.equal(b.disabled, true));
});

domTest('temperature screen: honest empty state when no rooms are loaded', () => {
  const Screens = require(CODE + '/screens/screens.js');
  const { doc, host } = page();
  Screens.temperatureEntry(host, { save: mk(fakeServer()), document: doc, areas: [] });
  assert.match(host.querySelector('.bs-empty').textContent, /No rooms are loaded/);
  assert.equal(host.querySelectorAll('.bs-btn').length, 0);
});

domTest('temperature screen: save, show the result, offer a correction; out-of-band asks what was done', async () => {
  global.BLDBands = BLDBands;
  const Screens = require(CODE + '/screens/screens.js');
  const { doc, host } = page();
  const srv = fakeServer({ reply: { ok: true, result: { status: 'queued', id: 'rdg-test-9', pending_id: 'pnd-9' } } });
  const save = mk(srv, { scriptUrl: GOOD_URL });
  await save.checkStatus(); save.setLookups({ area: [{ id: 'area-t1' }] }); save.setCode('CODE');
  const adult = BLDBands.bandFor([{ id: 'a', dob: '2020-01-01' }], '2026-10-15', BANDS);
  Screens.temperatureEntry(host, {
    save, document: doc, areas: [{ id: 'area-t1', label: 'T1' }],
    bandForArea: () => adult, actionFor: (v) => BLDBands.actionFor(v, ACTIONS)
  });
  const card = host.querySelector('[data-area="area-t1"]');
  const [minIn, maxIn] = card.querySelectorAll('.bs-pair .bs-in');
  const btn = card.querySelector('.bs-btn');
  assert.equal(btn.disabled, false);
  assert.match(card.querySelector('.bs-band').textContent, /Band: four weeks and over, 10.00 to 26.00/);

  minIn.value = '21.47'; maxIn.value = '27.5';
  maxIn.dispatchEvent(new (doc.defaultView.Event)('input'));
  const noteField = [...card.querySelectorAll('.bs-field')].find((f) => /What was done/.test(f.textContent));
  assert.equal(noteField.hidden, false);
  assert.match(card.querySelector('.bs-band').textContent, /above the band - fans/);
  btn.click(); // no note yet
  assert.match(card.textContent, /Say what was done about it/);
  assert.equal(srv.calls.filter((c) => c.init.method === 'POST').length, 0);

  noteField.querySelector('input').value = 'fans on, doors open';
  btn.click();
  await new Promise((r) => setTimeout(r, 20));
  const post = JSON.parse(srv.calls.find((c) => c.init.method === 'POST').init.body);
  assert.equal(post.fields.mitigation_note, 'fans on, doors open');
  assert.match(card.querySelector('.bs-result').textContent, /waiting for Lisa to approve/);
  assert.match(card.querySelector('.bs-link').textContent, /send a correction/i);
  assert.equal(minIn.value, ''); // cleared after a successful send
});

domTest('staff screen: empty state, then a working form that always says it waits for approval', async () => {
  const Screens = require(CODE + '/screens/screens.js');
  let { doc, host } = page();
  Screens.staffInput(host, { save: mk(fakeServer()), document: doc, people: [] });
  assert.match(host.querySelector('.bs-empty').textContent, /No people are loaded/);

  ({ doc, host } = page());
  const srv = fakeServer({ tables: [{ key: 'staff', file: 'BLD-staff.csv', on: true, mode: 'pending' }], proposed: [], reply: { ok: true, result: { status: 'queued', id: 'stf-1', pending_id: 'p' } } });
  const save = mk(srv, { scriptUrl: GOOD_URL });
  await save.checkStatus(); save.setLookups({ person: [{ id: 'per-1' }] }); save.setCode('C');
  Screens.staffInput(host, { save, document: doc, people: [{ id: 'per-1', label: 'Pat Tester' }] });
  const [sel, emp] = host.querySelectorAll('select');
  sel.value = 'per-1'; emp.value = 'part_time';
  const [role, started] = [host.querySelector('input[type=text]'), host.querySelector('input[type=date]')];
  role.value = 'Kennel assistant'; started.value = '2026-09-01';
  host.querySelector('.bs-btn').click();
  await new Promise((r) => setTimeout(r, 20));
  assert.match(host.querySelector('.bs-result').textContent, /waiting for Lisa/);
});

domTest('Board drop-in: opens the temperature screen from tables the Board already loaded; empty occupancy says "room unknown"', () => {
  global.BLDBands = BLDBands;
  const Board = require(CODE + '/wired/board-dropin.js');
  const { doc, host } = page();
  const T = {
    'BLD-area.csv': [{ id: 'area-t1', code: 'T1', grouping: 'T house', group_sort: '1' }],
    'BLD-subject.csv': [{ id: 'sub-a', name: 'A', dob: '2020-01-01' }],
    'BLD-occupancy.csv': [{ subject_id: 'sub-a', area_id: '', moved_out: '' }], // blank area_id, like most live rows
    'BLD-person.csv': [], 'BLD-temperature_band.csv': [], 'BLD-temperature_action.csv': []
  };
  const board = Board.create({ tables: T, today: '2026-10-15', document: doc, save: mk(fakeServer()) });
  board.open('temp', host);
  assert.match(host.querySelector('.bs-band').textContent, /room unknown/);
  assert.equal(board.lookups.roomsWithDogs, 0);
  const h2 = new JSDOM('<div id="s"></div>'); // staff with no people: honest empty state
  const b2 = Board.create({ tables: T, document: h2.window.document, save: mk(fakeServer()) });
  b2.open('staff', h2.window.document.getElementById('s'));
  assert.match(h2.window.document.querySelector('.bs-empty').textContent, /No people are loaded/);
});

// ------------------------------------------------------------------ Bloodline wiring (the screens as they run inside the Bloodline page)
const fs = require('node:fs');
const path = require('node:path');
const read = (p) => fs.readFileSync(path.join(CODE, p), 'utf8');

/** A Bloodline-like page: its own palette variables, a #main, and the wiring scripts loaded as the patch loads them. */
function bloodlinePage(fakeFetch) {
  const dom = new JSDOM('<!doctype html><html><head></head><body><main id="main"></main></body></html>',
    { runScripts: 'outside-only', url: 'https://ljoyrose.github.io/dashboard/bloodline/' });
  const w = dom.window;
  if (fakeFetch) w.fetch = fakeFetch;
  ['client/bands.js', 'client/bld-save.js', 'client/drive-lookups.js', 'screens/screens.js', 'wired/bloodline-wire.js']
    .forEach((f) => w.eval(read(f)));
  // what Bloodline's render() does for these two stages, per the patch
  w.show = (stage) => {
    w.document.getElementById('main').innerHTML = stage === 'entertemp' ? w.BLDWire.pageTemp() : w.BLDWire.pageStaff();
    w.BLDWire.mount(stage);
  };
  return w;
}
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

domTest('Bloodline: "Enter temperatures" opens with saving OFF and an honest "no rooms" message', () => {
  const w = bloodlinePage();
  w.show('entertemp');
  const d = w.document;
  assert.match(d.querySelector('h2').textContent, /Enter temperatures/);
  assert.match(d.querySelector('.bs-banner').textContent, /Saving is off/);
  assert.match(d.querySelector('.bs-empty').textContent, /No rooms are loaded/);
  assert.equal(d.querySelectorAll('.bs-btn[aria-disabled]').length, 0); // no room cards, so nothing to press
});

domTest('Bloodline: "Staff input" opens with saving OFF and an honest "no people" message', () => {
  const w = bloodlinePage();
  w.show('staffin');
  assert.match(w.document.querySelector('.bs-banner').textContent, /Saving is off/);
  assert.match(w.document.querySelector('.bs-empty').textContent, /No people are loaded/);
});

domTest('Bloodline: once rooms are provided, each room has a Save button that stays disabled while saving is off', () => {
  const w = bloodlinePage();
  w.show('entertemp');
  w.BLDWire.provide({
    areas: [{ id: 'area-t1', label: 'T1', group: 'Test house' }, { id: 'area-t2', label: 'T2', group: 'Test house' }],
    people: [], subjects: [], bandForArea: () => ({ reason: 'room unknown: nobody is recorded in this room' }), actionFor: () => ''
  });
  const cards = w.document.querySelectorAll('.bs-card[data-area]');
  assert.equal(cards.length, 2);
  cards.forEach((c) => {
    assert.equal(c.querySelector('.bs-btn').disabled, true);
    assert.match(c.querySelector('.bs-band').textContent, /room unknown/);
  });
});

domTest('Bloodline: pasting a wrong address is refused; a right one turns saving on for the screen (pending mode) and a save goes through', async () => {
  const calls = [];
  const fetchFake = async (url, init = {}) => {
    calls.push({ url, init });
    if (!init.method || init.method === 'GET') return { json: async () => ({ ok: true, version: '1.0.0', saveEnabled: true, tables: [{ key: 'area_reading', file: 'BLD-area_reading.csv', on: true, mode: 'pending' }], proposed: ['round_event', 'staff'] }) };
    return { json: async () => ({ ok: true, result: { status: 'queued', id: 'rdg-test-7', pending_id: 'pnd-7' } }) };
  };
  const w = bloodlinePage(fetchFake);
  w.show('entertemp');
  w.BLDWire.provide({ areas: [{ id: 'area-t1', label: 'T1' }], people: [], subjects: [], bandForArea: null, actionFor: null });
  const d = w.document;
  d.querySelector('#bw-url').value = 'https://evil.example/exec';
  d.querySelector('#bw-on').click();
  assert.match(d.querySelector('#bw-msg').textContent, /does not look like a Script URL/);
  assert.equal(calls.length, 0);

  d.querySelector('#bw-url').value = 'https://script.google.com/macros/s/AKfycbxTESTTEST/exec';
  d.querySelector('#bw-on').click();
  await tick();
  assert.match(d.querySelector('.bs-banner').textContent, /waits for Lisa to approve/);
  const card = d.querySelector('.bs-card[data-area="area-t1"]');
  assert.equal(card.querySelector('.bs-btn').disabled, false);

  d.querySelector('input[type=password]').value = 'CODE123456';
  d.querySelector('input[type=password]').dispatchEvent(new w.Event('input'));
  const [mn, mx] = card.querySelectorAll('.bs-pair .bs-in');
  mn.value = '21.47'; mx.value = '24.10';
  card.querySelector('.bs-btn').click();
  await tick();
  assert.match(card.querySelector('.bs-result').textContent, /waiting for Lisa to approve/);
  const post = calls.find((c) => c.init.method === 'POST');
  const body = JSON.parse(post.init.body);
  assert.equal(body.table, 'area_reading');
  assert.equal(body.fields.min_c, '21.47');
  assert.equal(body.code, 'CODE123456');
  assert.ok(!post.url.includes('CODE123456'));
});

domTest('Bloodline patch: only ADDS lines (two stages, the scripts, one mount call); touches nothing of Lisa\'s page', () => {
  const patch = read('wired/bloodline-wiring.patch');
  const body = patch.split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
  const removed = body.filter((l) => l.startsWith('-'));
  const added = body.filter((l) => l.startsWith('+'));
  // the only removed line is the one PAGES line, re-added with two extra entries in front
  assert.equal(removed.length, 1);
  assert.match(removed[0], /var PAGES=\{relations:pageRelations/);
  assert.ok(added.some((l) => /\['entertemp','Enter temperatures'/.test(l)));
  assert.ok(added.some((l) => /\['staffin','Staff input'/.test(l)));
  assert.ok(added.some((l) => /BLDWire\.mount\(CUR\)/.test(l)));
  assert.ok(added.some((l) => /var PAGES=\{entertemp:/.test(l) && l.includes('relations:pageRelations')));
  assert.equal(added.filter((l) => /<script src=/.test(l)).length, 5);
});
