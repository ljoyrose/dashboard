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
    proposed: ['occupancy_check', 'staff'],
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
  assert.match(r.message, /approvals queue/);
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

domTest('temperature screen: save, show the result, no staff correction path, "Wrong entry? Tell the owner"; out-of-band asks what was done', async () => {
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
  assert.match(card.querySelector('.bs-result').textContent, /approvals queue/);
  assert.equal(card.querySelector('.bs-link'), null);                                        // no "send a correction" for staff
  assert.equal([...host.querySelectorAll('button')].some((b) => /correction/i.test(b.textContent)), false);
  assert.match(card.querySelector('.bs-wrong').textContent, /Wrong entry\? Tell the owner \u2013 she can fix it\./);
  assert.match(host.querySelector('.bs-sub').textContent, /Wrong entry\? Tell the owner \u2013 she can fix it\./);
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
  assert.match(host.querySelector('.bs-result').textContent, /approvals queue/);
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
  // load exactly the scripts the patch adds to Bloodline, in the order it adds them
  read('wired/bloodline-wiring.patch').split('\n').filter((l) => /^\+<script src="/.test(l))
    .map((l) => /src="([^"]+)"/.exec(l)[1]).forEach((f) => w.eval(read(f)));
  // what Bloodline's render() does for these stages, per the patch
  w.show = (stage) => {
    const pages = { confirm: w.BLDWire.pageConfirm, entertemp: w.BLDWire.pageTemp, staffin: w.BLDWire.pageStaff };
    w.document.getElementById('main').innerHTML = pages[stage]();
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
    if (!init.method || init.method === 'GET') return { json: async () => ({ ok: true, version: '1.0.0', saveEnabled: true, tables: [{ key: 'area_reading', file: 'BLD-area_reading.csv', on: true, mode: 'pending' }], proposed: ['occupancy_check', 'staff'] }) };
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
  assert.match(d.querySelector('.bs-banner').textContent, /approvals queue until Lisa approves/);
  const card = d.querySelector('.bs-card[data-area="area-t1"]');
  assert.equal(card.querySelector('.bs-btn').disabled, false);

  d.querySelector('input[type=password]').value = 'CODE123456';
  d.querySelector('input[type=password]').dispatchEvent(new w.Event('input'));
  const [mn, mx] = card.querySelectorAll('.bs-pair .bs-in');
  mn.value = '21.47'; mx.value = '24.10';
  card.querySelector('.bs-btn').click();
  await tick();
  assert.match(card.querySelector('.bs-result').textContent, /approvals queue/);
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
  assert.ok(added.some((l) => /var PAGES=\{confirm:.*entertemp:.*staffin:/.test(l) && l.includes('relations:pageRelations')));
  assert.equal(added.filter((l) => /<script src=/.test(l)).length, 6);   // + client/occupancy.js
  assert.ok(added.some((l) => /\['confirm','Where is everyone\?'/.test(l)));
  assert.ok(added.some((l) => /var PAGES=\{confirm:/.test(l) && l.includes('relations:pageRelations')));
});

// ================================================================== daily location check (Where is everyone?)
const BLDOcc = require(CODE + '/client/occupancy.js');
const BLDLook = require(CODE + '/client/drive-lookups.js');
const fxc = require('./fixtures');

/** FAKE tables parsed from the same fake CSVs the script tests use. */
function fakeTables() {
  const files = fxc.csvFiles(), out = {};
  Object.keys(files).forEach((n) => { out[n] = BLDLook.parseCsv(files[n]); });
  return out;
}

test('daily list: dogs on site with their last recorded room; sold, collected, family-owned and unknown dogs are handled honestly', () => {
  const T = fakeTables();
  const d = BLDOcc.dailyList({ area: T['BLD-area.csv'], subject: T['BLD-subject.csv'], subject_status: T['BLD-subject_status.csv'], occupancy: T['BLD-occupancy.csv'] });
  const byId = {}; d.dogs.forEach((x) => { byId[x.id] = x; });
  assert.deepEqual(d.dogs.map((x) => x.id).sort(), ['sub-test-a', 'sub-test-b']);        // C sold, D owned_by_family, E has no row and no status
  assert.equal(d.skipped, 1);                                                             // E is counted, not guessed
  assert.equal(byId['sub-test-a'].areaId, 'area-t2');                                     // latest moved_in beats the earlier t1 row
  assert.equal(byId['sub-test-a'].areaLabel, 'T2');
  assert.equal(byId['sub-test-b'].areaId, 'area-t1');                                     // an undated legacy row still gives a room
  // a dog with no occupancy row but a status of Active is listed with "room not recorded"
  const T2 = { area: T['BLD-area.csv'], subject: T['BLD-subject.csv'], occupancy: T['BLD-occupancy.csv'], subject_status: T['BLD-subject_status.csv'].concat([{ subject_id: 'sub-test-e', state: 'Active' }]) };
  const d2 = BLDOcc.dailyList(T2);
  assert.equal(d2.dogs[0].id, 'sub-test-e');                                              // unknown rooms come first
  assert.equal(d2.dogs[0].known, false);
  // a status of Sold or Collected removes a dog even if its occupancy row says nothing
  const T3 = { area: T2.area, subject: T2.subject, occupancy: T2.occupancy, subject_status: [{ subject_id: 'sub-test-a', state: 'Collected' }, { subject_id: 'sub-test-b', state: 'sold' }] };
  assert.equal(BLDOcc.dailyList(T3).dogs.length, 0);
  // moving a dog (a NEW row with a later moved_in) changes where it is; the old rows are never consulted again
  const moved = T2.occupancy.concat([{ subject_id: 'sub-test-b', area_id: 'area-t3-1', moved_in: '2026-10-15' }]);
  assert.equal(BLDOcc.latestRow(moved, 'sub-test-b').area_id, 'area-t3-1');
  assert.equal(BLDOcc.latestRow(moved, 'sub-test-nobody'), null);
});

test('the same rule in the browser and in the script: latest moved_in, undated rows lowest, ties go to the later row', () => {
  const rows = [
    { subject_id: 'x', area_id: 'a', moved_in: '2026-10-05' },
    { subject_id: 'x', area_id: 'b', moved_in: '' },
    { subject_id: 'x', area_id: 'c', moved_in: '2026-10-05' },
    { subject_id: 'y', area_id: 'a', moved_in: '' },
    { subject_id: 'y', area_id: 'b', moved_in: '' }
  ];
  assert.equal(BLDOcc.latestRow(rows, 'x').area_id, 'c');
  assert.equal(BLDOcc.latestRow(rows, 'y').area_id, 'b');
});

/** A fake Apps Script web app that understands status, saves and reads. */
function scriptFake(over = {}) {
  const calls = [];
  const st = Object.assign({
    saveEnabled: true, readEnabled: true,
    tables: [{ key: 'area_reading', file: 'BLD-area_reading.csv', on: true, mode: 'direct' }, { key: 'occupancy', file: 'BLD-occupancy.csv', on: true, mode: 'pending' }, { key: 'occupancy_check', file: 'BLD-occupancy_check.csv', on: true, mode: 'direct' }],
    proposed: ['staff'],
    reads: null, saveReply: { ok: true, result: { status: 'queued', id: 'occ-test-1', pending_id: 'pnd-1' } }
  }, over);
  const T = fakeTables();
  const rd = {
    area: T['BLD-area.csv'].map((a) => ({ id: a.id, code: a.code, grouping: a.grouping, group_sort: a.group_sort })),
    subject: T['BLD-subject.csv'].map((s) => ({ id: s.id, name: s.name, dob: s.dob })),
    occupancy: T['BLD-occupancy.csv'].map((o) => ({ subject_id: o.subject_id, area_id: o.area_id, off_site_kind: o.off_site_kind, moved_in: o.moved_in, classification: o.classification })),
    subject_status: T['BLD-subject_status.csv'].map((x) => ({ subject_id: x.subject_id, state: x.state }))
  };
  const f = async (url, init = {}) => {
    calls.push({ url, init });
    if (st.fail) throw new Error('offline');
    if (!init.method || init.method === 'GET') return { json: async () => ({ ok: true, version: '1.1.0', saveEnabled: st.saveEnabled, readEnabled: st.readEnabled, tables: st.tables, proposed: st.proposed }) };
    const b = JSON.parse(init.body);
    if (b.action === 'read') {
      if (st.reads && st.reads[b.table]) return { json: async () => st.reads[b.table] };
      if (!rd[b.table]) return { json: async () => ({ ok: false, code: 'NOT_ALLOWED', message: 'Lisa has not allowed your role to see this list.' }) };
      return { json: async () => ({ ok: true, result: { table: b.table, fields: Object.keys(rd[b.table][0] || {}), rows: rd[b.table], count: rd[b.table].length, scope: 'all rows' } }) };
    }
    return { json: async () => st.saveReply };
  };
  return { f, calls, st, posts: () => calls.filter((c) => c.init.method === 'POST').map((c) => JSON.parse(c.init.body)) };
}
const mkSave = (srv, extra = {}) => BLDSave.create(Object.assign({ fetch: srv.f, localStorage: null, sessionStorage: null, scriptUrl: GOOD_URL }, extra));

test('read: needs the Script URL, the switch and a code; the code goes in the body never the address; a bad code returns no rows', async () => {
  const none = BLDSave.create({ fetch: scriptFake().f, localStorage: null, sessionStorage: null });
  assert.equal((await none.read('area')).code, 'READ_OFF');                       // no Script URL: nothing is even sent
  const srv = scriptFake({ readEnabled: false });
  const s = mkSave(srv); await s.checkStatus(); s.setCode('SECRETCODE1');
  assert.equal((await s.read('area')).code, 'READ_OFF');                          // the script says reading is off
  assert.equal(srv.posts().length, 0);
  const srv2 = scriptFake();
  const s2 = mkSave(srv2); await s2.checkStatus();
  assert.equal((await s2.read('area')).code, 'NO_CODE');
  s2.setCode('SECRETCODE1');
  const r = await s2.read('area');
  assert.equal(r.ok, true); assert.equal(r.count, 3);
  const post = srv2.calls.find((c) => c.init.method === 'POST');
  assert.ok(!post.url.includes('SECRETCODE1'));
  assert.deepEqual(JSON.parse(post.init.body), { v: 1, action: 'read', code: 'SECRETCODE1', table: 'area' });
  const srv3 = scriptFake({ reads: { area: { ok: false, code: 'BAD_CODE', message: 'That staff code was not recognised.' } } });
  const s3 = mkSave(srv3); await s3.checkStatus(); s3.setCode('WRONG');
  const bad = await s3.read('area');
  assert.equal(bad.ok, false); assert.equal(bad.rows, undefined); assert.equal(bad.code, 'BAD_CODE');
  srv3.st.fail = true;
  assert.equal((await s3.read('area')).code, 'NETWORK');
});

test('readMany: area, subject and occupancy are required; subject_status may be missing or not allowed', async () => {
  const srv = scriptFake({ reads: { subject_status: { ok: false, code: 'NOT_ALLOWED', message: 'no' } } });
  const s = mkSave(srv); await s.checkStatus(); s.setCode('C');
  const ok = await s.readMany(['area', 'subject', 'occupancy', 'subject_status']);
  assert.equal(ok.ok, true); assert.deepEqual(ok.tables.subject_status, []);
  const srv2 = scriptFake({ reads: { occupancy: { ok: false, code: 'NOT_ALLOWED', message: 'Lisa has not allowed your role to see this list.' } } });
  const s2 = mkSave(srv2); await s2.checkStatus(); s2.setCode('C');
  const no = await s2.readMany(['area', 'subject', 'occupancy', 'subject_status']);
  assert.equal(no.ok, false); assert.match(no.message, /not allowed/);
});

test('banners for the live occupancy list, the daily check log and the still-proposed staff roster', async () => {
  const srv = scriptFake();
  const s = mkSave(srv); await s.checkStatus();
  assert.equal(s.banner('occupancy').kind, 'pending');
  assert.match(s.banner('occupancy').text, /approvals queue until Lisa approves/);
  assert.equal(s.banner('occupancy_check').canSave, true);                          // on the allow-list now, straight in
  assert.equal(s.banner('occupancy_check').kind, 'on');
  assert.equal(s.banner('staff').canSave, false);                                      // still only a proposal
  assert.match(s.banner('staff').text, /only a proposal/);
  srv.st.tables[1].on = false; await s.checkStatus();
  assert.equal(s.banner('occupancy').canSave, false);                              // its own switch, off
  assert.match(s.banner('occupancy').text, /not switched on/);
});

const DOGS = [
  { id: 'sub-test-a', label: 'Test A', areaId: 'area-t2', areaLabel: 'T2', known: true },
  { id: 'sub-test-b', label: 'Test B', areaId: 'area-t1', areaLabel: 'T1', known: true },
  { id: 'sub-test-e', label: 'Test E', areaId: '', areaLabel: '', known: false },
  { id: 'sub-test-f', label: 'Test F', areaId: 'area-t1', areaLabel: 'T1', known: true, away: true }
];
const ROOMS = [{ id: 'area-t1', label: 'T1', group: 'T - Test house' }, { id: 'area-t2', label: 'T2', group: 'T - Test house' }, { id: 'area-t3-1', label: 'T3.1', group: 'T - Test cabins' }];
const lookups = (save, dogs) => save.setLookups({ area: ROOMS, subject: (dogs || DOGS).map((d) => ({ id: d.id })) });
const checkPosts = (srv) => srv.posts().filter((x) => x.table === 'occupancy_check');
const restBtn = (host) => host.querySelector('.bs-rest');

domTest('location check: saving off disables every tap and says why; no dogs shows an honest empty state', async () => {
  const Screens = require(CODE + '/screens/screens.js');
  let { doc, host } = page();
  Screens.locationConfirm(host, { save: BLDSave.create({ fetch: scriptFake().f, localStorage: null, sessionStorage: null }), dogs: DOGS, areas: ROOMS, document: doc });
  assert.match(host.querySelector('.bs-banner').textContent, /Saving is off/);
  host.querySelectorAll('button').forEach((b) => assert.equal(b.disabled, true, b.textContent));
  assert.match(host.querySelector('.bs-prog-t').textContent, /0 of 3 dogs done \(1 away\)/);
  ({ doc, host } = page());
  Screens.locationConfirm(host, { save: BLDSave.create({ fetch: scriptFake().f, localStorage: null, sessionStorage: null }), dogs: [], areas: ROOMS, document: doc });
  assert.match(host.querySelector('.bs-empty').textContent, /No dogs are loaded/);
});

domTest('location check: each dog shows its last room, pre-filled; only a Moved tap per dog; an unknown room goes straight to picking; Away dogs have no buttons', async () => {
  const Screens = require(CODE + '/screens/screens.js');
  const { doc, host } = page();
  const srv = scriptFake(); const save = mkSave(srv); await save.checkStatus(); lookups(save); save.setCode('CODE');
  Screens.locationConfirm(host, { save, dogs: DOGS, areas: ROOMS, document: doc });
  const a = host.querySelector('[data-dog="sub-test-a"]'), e = host.querySelector('[data-dog="sub-test-e"]'), f = host.querySelector('[data-dog="sub-test-f"]');
  assert.match(a.querySelector('.bs-dog-was').textContent, /Last recorded: T2/);
  assert.equal(a.querySelector('.bs-yes'), null);                                          // no per-dog "Same" any more
  assert.match(a.querySelector('.bs-no').textContent, /Moved/);
  assert.equal(a.querySelector('.bs-no').disabled, false);
  assert.equal(a.querySelector('.bs-move').hidden, true);                                  // the room picker opens on Moved
  assert.deepEqual([...a.querySelectorAll('select option')].map((o) => o.value), ['', 'area-t1', 'area-t3-1']);   // its own room is not offered
  assert.match(e.querySelector('.bs-dog-was').textContent, /Room not recorded yet/);
  assert.equal(e.querySelector('.bs-no').hidden, true);
  assert.equal(e.querySelector('.bs-move').hidden, false);                                 // goes straight to picking a room
  // Away: shown, keeps its room, no buttons, not counted as something to do
  assert.ok(f.className.includes('bs-away'));
  assert.match(f.textContent, /Away/); assert.match(f.textContent, /keeps its room: T1/);
  assert.equal(f.querySelectorAll('button').length, 0);
  assert.match(host.querySelector('.bs-away-h').textContent, /not asked to move/);
  // exactly ONE confirm button, with the count of dogs it will confirm (a and b; not e, not the away dog)
  assert.equal(host.querySelectorAll('.bs-rest').length, 1);
  assert.match(restBtn(host).textContent, /All the rest unmoved \(2\)/);
});

domTest('location check: "All the rest unmoved" sends ONE entry listing every dog that did not move; not the unknown-room dog, not the Away dog', async () => {
  const Screens = require(CODE + '/screens/screens.js');
  const { doc, host } = page();
  const srv = scriptFake({ saveReply: { ok: true, result: { status: 'saved', id: 'chk-1' } } });
  const save = mkSave(srv); await save.checkStatus(); lookups(save); save.setCode('CODE');
  Screens.locationConfirm(host, { save, dogs: DOGS, areas: ROOMS, document: doc });
  assert.equal(restBtn(host).disabled, false);
  restBtn(host).click();
  await new Promise((r) => setTimeout(r, 30));
  const p = srv.posts();
  assert.equal(p.length, 1);
  assert.equal(p[0].table, 'occupancy_check');
  assert.equal(p[0].action, 'add');
  assert.deepEqual(p[0].fields, { dog_ids: ['sub-test-a', 'sub-test-b'], moved_count: 0 });   // no date, no name: the script sets those
  assert.match(host.querySelector('.bs-sticky .bs-result').textContent, /Confirmed 2 dogs unmoved\. 1 dog\(s\) still have no room recorded/);
  assert.ok(host.querySelector('[data-dog="sub-test-a"]').className.includes('bs-done'));
  assert.equal(host.querySelector('[data-dog="sub-test-f"]').className.includes('bs-done'), false);   // the Away dog is not "done"
  assert.equal(restBtn(host).disabled, true);                                              // cannot be sent twice
  assert.equal(host.querySelector('[data-dog="sub-test-a"] .bs-no').disabled, true);
});

domTest('location check: a Moved dog is saved as a move (dog + room only) and is left out of the unmoved list; moved_count says how many', async () => {
  const Screens = require(CODE + '/screens/screens.js');
  const { doc, host } = page();
  const srv = scriptFake({ saveReply: { ok: true, result: { status: 'queued', id: 'occ-test-1', pending_id: 'pnd-1' } } });
  const save = mkSave(srv); await save.checkStatus(); lookups(save); save.setCode('CODE');
  Screens.locationConfirm(host, { save, dogs: DOGS, areas: ROOMS, document: doc });
  const b = host.querySelector('[data-dog="sub-test-b"]');
  b.querySelector('.bs-no').click();
  assert.equal(b.querySelector('.bs-move').hidden, false);
  b.querySelector('.bs-btn').click();                                                      // no room picked yet
  assert.match(b.querySelector('.bs-err').textContent, /Pick the new room first/);
  assert.equal(srv.posts().length, 0);
  const sel = b.querySelector('select'); sel.value = 'area-t3-1'; sel.dispatchEvent(new (doc.defaultView.Event)('input'));
  b.querySelector('.bs-btn').click();
  await new Promise((r) => setTimeout(r, 30));
  const occ = srv.posts().filter((x) => x.table === 'occupancy');
  assert.equal(occ.length, 1);
  assert.deepEqual(occ[0].fields, { subject_id: 'sub-test-b', area_id: 'area-t3-1' });     // no dates, no moved_out, no file name
  assert.equal(occ[0].action, 'add');
  assert.match(b.querySelector('.bs-result').textContent, /Move to T3\.1 sent.*approvals queue/);
  assert.match(host.querySelector('.bs-prog-t').textContent, /1 of 3 dogs done/);
  assert.match(restBtn(host).textContent, /All the rest unmoved \(1\)/);
  srv.st.saveReply = { ok: true, result: { status: 'saved', id: 'chk-1' } };
  restBtn(host).click();
  await new Promise((r) => setTimeout(r, 30));
  const chk = checkPosts(srv);
  assert.equal(chk.length, 1);
  assert.deepEqual(chk[0].fields, { dog_ids: ['sub-test-a'], moved_count: 1 });            // b moved, so it is not "unmoved"
  assert.match(host.querySelector('.bs-sticky .bs-result').textContent, /Confirmed 1 dog unmoved, 1 moved/);
});

domTest('location check: 150 dogs - the movers are picked, then ONE tap sends ONE entry with all the others', async () => {
  const Screens = require(CODE + '/screens/screens.js');
  const { doc, host } = page();
  const many = Array.from({ length: 150 }, (_, i) => ({ id: 'sub-bulk-' + String(i + 1).padStart(4, '0'), label: 'Bulk ' + (i + 1), areaId: i % 2 ? 'area-t1' : 'area-t2', areaLabel: i % 2 ? 'T1' : 'T2', known: true }));
  const srv = scriptFake({ saveReply: { ok: true, result: { status: 'saved', id: 'x-1' } } });
  const save = mkSave(srv); await save.checkStatus(); lookups(save, many); save.setCode('CODE');
  Screens.locationConfirm(host, { save, dogs: many, areas: ROOMS, document: doc });
  assert.equal(host.querySelectorAll('.bs-dog').length, 150);
  assert.match(restBtn(host).textContent, /\(150\)/);
  for (const id of ['sub-bulk-0003', 'sub-bulk-0100']) {                                  // two movers
    const c = host.querySelector('[data-dog="' + id + '"]');
    c.querySelector('.bs-no').click();
    const sel = c.querySelector('select'); sel.value = 'area-t3-1'; sel.dispatchEvent(new (doc.defaultView.Event)('input'));
    c.querySelector('.bs-btn').click();
    await new Promise((r) => setTimeout(r, 15));
  }
  assert.match(restBtn(host).textContent, /\(148\)/);
  restBtn(host).click();
  await new Promise((r) => setTimeout(r, 30));
  const chk = checkPosts(srv);
  assert.equal(chk.length, 1);                                                             // ONE entry
  assert.equal(chk[0].fields.dog_ids.length, 148);
  assert.equal(chk[0].fields.moved_count, 2);
  assert.equal(chk[0].fields.dog_ids.includes('sub-bulk-0003'), false);
  assert.equal(chk[0].fields.dog_ids.includes('sub-bulk-0100'), false);
  assert.equal(srv.posts().filter((x) => x.table === 'occupancy').length, 2);
});

domTest('location check: if the daily log is switched off the button says so and nothing is sent; a network failure keeps the same request id', async () => {
  const Screens = require(CODE + '/screens/screens.js');
  let { doc, host } = page();
  const srv = scriptFake(); srv.st.tables = srv.st.tables.filter((t) => t.key !== 'occupancy_check'); srv.st.proposed = ['staff', 'occupancy_check'];
  let save = mkSave(srv); await save.checkStatus(); lookups(save); save.setCode('CODE');
  Screens.locationConfirm(host, { save, dogs: DOGS, areas: ROOMS, document: doc });
  assert.equal(restBtn(host).disabled, true);
  assert.match(host.querySelector('.bs-sticky .bs-result').textContent, /only a proposal|not switched on/);
  assert.equal(srv.posts().length, 0);
  // network failure then retry
  ({ doc, host } = page());
  const srv2 = scriptFake({ saveReply: { ok: true, result: { status: 'saved', id: 'chk-1' } } });
  save = mkSave(srv2); await save.checkStatus(); lookups(save); save.setCode('CODE');
  Screens.locationConfirm(host, { save, dogs: DOGS, areas: ROOMS, document: doc });
  srv2.st.fail = true;
  restBtn(host).click();
  await new Promise((r) => setTimeout(r, 30));
  assert.match(host.querySelector('.bs-sticky .bs-result').textContent, /not confirmed as saved/);
  assert.equal(restBtn(host).disabled, false);
  srv2.st.fail = false;
  restBtn(host).click();
  await new Promise((r) => setTimeout(r, 30));
  const ids = [...new Set(srv2.calls.filter((c) => c.init.method === 'POST').map((c) => JSON.parse(c.init.body).request_id))];
  assert.equal(ids.length, 1);                                                             // same request id, so the script cannot save twice
});

domTest('location check: a refused move shows the script\'s plain message and can be tried again', async () => {
  const Screens = require(CODE + '/screens/screens.js');
  const { doc, host } = page();
  const srv = scriptFake({ saveReply: { ok: false, code: 'INVALID', message: 'Some details need fixing', fields: { area_id: 'That dog is already recorded in that room, so it has not moved.' } } });
  const save = mkSave(srv); await save.checkStatus(); lookups(save); save.setCode('CODE');
  Screens.locationConfirm(host, { save, dogs: DOGS, areas: ROOMS, document: doc });
  const b = host.querySelector('[data-dog="sub-test-b"]');
  b.querySelector('.bs-no').click();
  const sel = b.querySelector('select'); sel.value = 'area-t2'; sel.dispatchEvent(new (doc.defaultView.Event)('input'));
  b.querySelector('.bs-btn').click();
  await new Promise((r) => setTimeout(r, 30));
  assert.match(b.querySelector('.bs-err').textContent, /has not moved/);
  assert.equal(b.className.includes('bs-done'), false);
  assert.equal(b.querySelector('.bs-btn').disabled, false);
  assert.match(restBtn(host).textContent, /\(2\)/);                                        // a refused move does not take the dog out of the list
});

domTest('away and gone dogs in the daily list (browser side): off_site_temp is Away and keeps its room; deceased, sold, family, collected are dropped', () => {
  const T = fakeTables();
  const subj = T['BLD-subject.csv'].concat([{ id: 'sub-v', name: 'Vet Dog' }, { id: 'sub-g', name: 'Gone Dog' }, { id: 'sub-h', name: 'Dead Dog' }, { id: 'sub-r', name: 'Row Dead' }]);
  const status = T['BLD-subject_status.csv'].concat([{ subject_id: 'sub-v', state: 'off_site_temp' }, { subject_id: 'sub-g', state: 'Active' }, { subject_id: 'sub-h', state: 'deceased' }, { subject_id: 'sub-r', state: 'Active' }]);
  const occ = T['BLD-occupancy.csv'].concat([
    { id: 'o1', subject_id: 'sub-v', area_id: 'area-t1', moved_in: '2026-10-01' },
    { id: 'o2', subject_id: 'sub-g', area_id: 'area-t1', moved_in: '2026-10-01' }, { id: 'o3', subject_id: 'sub-g', off_site_kind: 'deceased', moved_in: '2026-10-09' },
    { id: 'o4', subject_id: 'sub-r', area_id: 'area-t2', moved_in: '2026-10-01' }, { id: 'o5', subject_id: 'sub-r', classification: 'Deceased', moved_in: '2026-10-09' }
  ]);
  const d = BLDOcc.dailyList({ area: T['BLD-area.csv'], subject: subj, subject_status: status, occupancy: occ });
  const ids = d.dogs.map((x) => x.id).sort();
  assert.deepEqual(ids, ['sub-test-a', 'sub-test-b', 'sub-v']);                           // sub-h, sub-g, sub-r (deceased) and sold/family/collected are gone
  const v = d.dogs.filter((x) => x.id === 'sub-v')[0];
  assert.equal(v.away, true); assert.equal(v.areaId, 'area-t1'); assert.equal(v.known, true);   // keeps its room
  assert.equal(d.dogs[d.dogs.length - 1].id, 'sub-v');                                    // Away dogs are listed last
  assert.equal(d.dogs.filter((x) => x.away).length, 1);
  // an Away dog still counts in its room for the temperature band
  const lk = BLDLook.fromTables(Object.assign({}, T, { 'BLD-subject.csv': subj, 'BLD-subject_status.csv': status, 'BLD-occupancy.csv': occ }), '2026-10-15');
  assert.ok(lk.dogs.some((x) => x.away));
});

domTest('location check look: The Board\'s fonts and tokens are in the stylesheet, scoped to this screen', () => {
  const css = read('screens/bld-save.css');
  assert.match(css, /Bricolage Grotesque/); assert.match(css, /Figtree/);
  assert.match(css, /\.bs\.bs-board\{/);
  assert.match(css, /--bs-accent:#e39a2d/);                       // the Board's amber
  assert.match(css, /min-height:60px/);                          // big yes/no taps
  assert.match(css, /prefers-color-scheme:dark/);
});

domTest('Bloodline: "Where is everyone?" opens OFF with an honest "no dogs" message and loads the Board fonts once', () => {
  const w = bloodlinePage();
  w.show('confirm');
  const d = w.document;
  assert.match(d.querySelector('h2').textContent, /Where is everyone/);
  assert.match(d.querySelector('.bs-banner').textContent, /Saving is off/);
  assert.match(d.querySelector('.bs-empty').textContent, /No dogs are loaded/);
  assert.equal(d.querySelectorAll('#bld-fonts').length, 1);
  assert.match(d.getElementById('bld-fonts').href, /Bricolage\+Grotesque.*Figtree/);
  w.show('confirm');
  assert.equal(d.querySelectorAll('#bld-fonts').length, 1);
});

domTest('Bloodline: with the Drive route, dogs appear pre-filled from their latest occupancy row and taps stay disabled while saving is off', () => {
  const w = bloodlinePage();
  w.show('confirm');
  const T = fakeTables();
  w.BLDWire.provide(w.BLDLookups.fromTables(T, '2026-10-15'));
  const d = w.document;
  assert.equal(d.querySelectorAll('.bs-dog').length, 2);
  assert.match(d.querySelector('[data-dog="sub-test-a"] .bs-dog-was').textContent, /Last recorded: T2/);
  d.querySelectorAll('.bs-dog button, .bs-rest').forEach((b) => assert.equal(b.disabled, true));
});

domTest('Bloodline: staff load the dogs with their personal code, no Google sign-in; only the allowed lists are asked for', async () => {
  const srv = scriptFake();
  const w = bloodlinePage(srv.f);
  w.show('confirm');
  const d = w.document;
  d.querySelector('#bw-url').value = GOOD_URL;
  d.querySelector('#bw-on').click();
  await tick();
  const code = d.querySelector('input[type=password]');
  code.value = 'STAFFCODE12'; code.dispatchEvent(new w.Event('input'));
  const load = [...d.querySelectorAll('.bs-btn')].find((b) => /Load the dogs/.test(b.textContent));
  assert.ok(load, 'a Load button is offered when no dogs are loaded');
  load.click();
  await tick(60);
  const reads = srv.posts().filter((p) => p.action === 'read');
  assert.deepEqual(reads.map((p) => p.table), ['area', 'subject', 'occupancy', 'subject_status']);
  reads.forEach((p) => assert.equal(p.code, 'STAFFCODE12'));
  srv.calls.forEach((c) => assert.ok(!c.url.includes('STAFFCODE12')));
  assert.equal(d.querySelectorAll('.bs-dog').length, 2);
  assert.match(d.querySelector('[data-dog="sub-test-b"] .bs-dog-was').textContent, /Last recorded: T1/);
  assert.equal(d.querySelector('[data-dog="sub-test-a"] .bs-no').disabled, false);    // occupancy is switched on in this fake script
  assert.match(d.querySelector('.bs-rest').textContent, /All the rest unmoved \(2\)/);
  assert.equal(d.querySelector('.bs-rest').disabled, false);
});

test('rooms and bands: after a move the dog is in its NEW room only (the old row is never closed, so it must not count)', () => {
  const T = fakeTables();
  T['BLD-temperature_band.csv'] = [{ id: 'b1', band: 'four weeks and over', age_from_days: '29', age_to_days: '', min_temp: '10.00', max_temp: '26.00' }];
  const before = BLDLook.fromTables(T, '2026-10-15');
  assert.equal(before.bandForArea('area-t2').dogId, 'sub-test-a');                      // Test A is in T2 (latest row)
  assert.equal(before.bandForArea('area-t1').dogId, 'sub-test-b');                      // T1 has Test B (undated legacy row)
  T['BLD-occupancy.csv'] = T['BLD-occupancy.csv'].concat([{ id: 'occ-n', subject_id: 'sub-test-a', area_id: 'area-t3-1', moved_in: '2026-10-15', moved_out: '' }]);
  const after = BLDLook.fromTables(T, '2026-10-15');
  assert.equal(after.bandForArea('area-t3-1').dogId, 'sub-test-a');
  assert.match(after.bandForArea('area-t2').reason, /room unknown/);                      // no longer counted in T2
  assert.equal(after.roomsWithDogs, 2);                                                   // T1 (Test B) and T3.1 (Test A)
});

test('Bloodline patch: no escaped-newline text anywhere, and `git apply --check` accepts it on the page it was made for', () => {
  const { execFileSync } = require('node:child_process');
  const os = require('node:os');
  const patch = read('wired/bloodline-wiring.patch');
  // 1. real text, not escaped text: no literal backslash-n / backslash-t / backslash-r pairs (the original page's own
  //    \uXXXX escapes appear only on unchanged context lines, where they must stay exactly as they are)
  assert.equal(/\\[ntr]/.test(patch), false, 'a literal \\n, \\t or \\r in the patch');
  assert.equal(patch.includes('\r'), false);
  patch.split('\n').filter((l) => /^\+/.test(l) && !/^\+\+\+/.test(l)).forEach((l) => assert.equal(/\\u[0-9a-fA-F]{4}/.test(l), false, 'an added line carries an escape: ' + l));
  // 2. rebuild the page the patch expects (every context and removed line at its line number, filler elsewhere) and ask git
  const lines = [], hunks = patch.split('\n').reduce((acc, l) => { const m = /^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/.exec(l); if (m) acc.push({ start: +m[1], body: [] }); else if (acc.length && /^[ -]/.test(l) && !/^---/.test(l)) acc[acc.length - 1].body.push(l.slice(1)); return acc; }, []);
  assert.equal(hunks.length, 4);
  hunks.forEach((h) => { h.body.forEach((t, i) => { lines[h.start - 1 + i] = t; }); });
  for (let i = 0; i < lines.length; i++) if (lines[i] === undefined) lines[i] = 'filler line ' + (i + 1);
  const dir = fsx.mkdtempSync(pathx.join(os.tmpdir(), 'patchchk-'));
  try {
    execFileSync('git', ['init', '-q', dir]);
    fsx.writeFileSync(pathx.join(dir, 'index.html'), lines.join('\n') + '\n');
    fsx.writeFileSync(pathx.join(dir, 'p.patch'), patch);
    execFileSync('git', ['-C', dir, 'apply', '--check', 'p.patch']);          // throws (non-zero exit) if it does not apply
    execFileSync('git', ['-C', dir, 'apply', 'p.patch']);
    const after = fsx.readFileSync(pathx.join(dir, 'index.html'), 'utf8');
    assert.equal((after.match(/<script src="/g) || []).length, 7);           // bld-schema.js (context) + the six added
    assert.match(after, /BLDWire\.mount\(CUR\)/);
  } finally { fsx.rmSync(dir, { recursive: true, force: true }); }
});
