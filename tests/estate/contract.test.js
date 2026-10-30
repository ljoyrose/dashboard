// RR_WEB-ESTATE data contract and reader. Run: node --test tests/estate/contract.test.js
// Rows are invented (tests/fixtures/estate/rows.js). Pretend Google only: no network.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../estate/core.js');
const R = require('../../estate/reader.js');
const F = require('../fixtures/estate/rows.js');

test('the fixture header is exactly the contract, in order', () => {
  assert.deepEqual(F.HEADER, E.COLUMNS);
  assert.equal(E.COLUMNS.length, 27);
  assert.deepEqual(E.KINDS, ['site', 'funnel', 'shop', 'app', 'dns-zone', 'email-domain', 'ads-account']);
  assert.ok(F.ROWS.every((r) => E.KINDS.includes(r.kind)), 'every fixture row uses a contract kind');
  assert.deepEqual([...new Set(F.ROWS.map((r) => r.kind))].sort(), E.KINDS.slice().sort(), 'the fixture covers every kind');
});

test('a good sheet gives every row, checked', () => {
  const out = E.rowsFromValues(F.values());
  assert.equal(out.ok, true);
  assert.equal(out.rows.length, F.ROWS.length);
  assert.equal(out.skipped, 0);
  assert.equal(out.rows[2].live_status, 'down');
});

test('ACCEPT: every required column, when missing, fails closed with no rows', () => {
  for (const col of E.COLUMNS) {
    const header = F.HEADER.filter((c) => c !== col);
    const out = E.rowsFromValues(F.values(header));
    assert.equal(out.ok, false, `missing ${col} must fail`);
    assert.equal(out.rows.length, 0, `missing ${col} must show no rows`);
    assert.match(out.problems.join(' '), new RegExp(col));
  }
});

test('ACCEPT: every required column, when renamed, fails closed and is reported as a rename', () => {
  for (const col of E.COLUMNS) {
    const renamed = col === 'owner_role' ? 'owner role' : col + '_old';
    const header = F.HEADER.map((c) => (c === col ? renamed : c));
    const rows = F.ROWS.map((r) => { const o = { ...r }; o[renamed] = o[col]; delete o[col]; return o; });
    const out = E.rowsFromValues(F.values(header, rows));
    assert.equal(out.ok, false, `renamed ${col} must fail`);
    assert.equal(out.rows.length, 0);
    assert.match(out.problems[0], /renamed\?/);
  }
});

test('header case and spaces do not matter; extra columns are reported but harmless; a column named twice fails', () => {
  const loud = F.HEADER.map((c) => ' ' + c.toUpperCase() + ' ');
  assert.equal(E.rowsFromValues(F.values(loud).map((r, i) => (i ? r : loud))).ok, true);
  const extra = E.rowsFromValues(F.values(F.HEADER.concat('notes')));
  assert.equal(extra.ok, true);
  assert.deepEqual(extra.extra, ['notes']);
  const twice = E.checkHeader(F.HEADER.concat('flag'));
  assert.equal(twice.ok, false);
  assert.match(twice.problems.join(' '), /named twice: flag/);
});

test('rows with no key or an unknown kind are left out and counted, never guessed', () => {
  const rows = F.ROWS.concat([{ kind: 'site', url_or_domain: 'nokey.example.com' }, { key: 'x.example.com', kind: 'website' }]);
  const out = E.rowsFromValues(F.values(F.HEADER, rows));
  assert.equal(out.ok, true);
  assert.equal(out.rows.length, F.ROWS.length);
  assert.equal(out.skipped, 2);
  assert.match(out.problems.join(' '), /1 row with no key/);
  assert.match(out.problems.join(' '), /1 row with an unknown kind/);
});

test('an empty sheet fails closed', () => {
  for (const v of [[], [[]], [['', '']], undefined]) assert.equal(E.rowsFromValues(v).ok, false);
});

// Pretend fetch: records the URL and headers, answers with the given status and body.
function fakeFetch(status, body, seen) {
  return (url, init) => { seen && seen.push({ url, init }); return Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }); };
}

test('reader: not set up and signed out send nothing', async () => {
  const seen = [];
  const a = await R.read({ sheetId: '', token: 't', fetch: fakeFetch(200, {}, seen) });
  const b = await R.read({ sheetId: 'SHEET', token: '', fetch: fakeFetch(200, {}, seen) });
  assert.equal(a.state, 'not-set-up');
  assert.equal(b.state, 'signed-out');
  assert.equal(seen.length, 0);
});

test('reader: one read-only GET of the Properties tab with the sign-in token', async () => {
  const seen = [];
  const out = await R.read({ sheetId: 'SHEET', token: 'tok', fetch: fakeFetch(200, { values: F.values() }, seen) });
  assert.equal(out.state, 'ok');
  assert.equal(out.rows.length, F.ROWS.length);
  assert.equal(seen.length, 1);
  assert.match(seen[0].url, /^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\/SHEET\/values\/Properties\?/);
  assert.equal(seen[0].init.headers.Authorization, 'Bearer tok');
  assert.equal(seen[0].init.method, undefined, 'a GET, never a write');
});

test('reader: a renamed column in the live sheet shows no rows', async () => {
  const header = F.HEADER.map((c) => (c === 'dmarc' ? 'dmarc_policy' : c));
  const out = await R.read({ sheetId: 'SHEET', token: 'tok', fetch: fakeFetch(200, { values: F.values(header) }) });
  assert.equal(out.state, 'bad-columns');
  assert.equal(out.rows.length, 0);
  assert.match(out.problems[0], /missing dmarc; found dmarc_policy/);
});

test('reader: Google errors become plain words and never throw', async () => {
  const cases = [[401, '', /sign-in expired/], [403, 'The caller does not have permission', /cannot open/], [400, 'Unable to parse range: Properties', /no "Properties" tab/], [404, '', /not found/], [500, 'boom', /Google said 500/]];
  for (const [status, message, re] of cases) {
    const out = await R.read({ sheetId: 'SHEET', token: 'tok', fetch: fakeFetch(status, { error: { message } }) });
    assert.equal(out.state, 'error');
    assert.match(out.problems[0], re);
  }
  const net = await R.read({ sheetId: 'SHEET', token: 'tok', fetch: () => Promise.reject(new Error('offline')) });
  assert.equal(net.state, 'error');
  assert.match(net.problems[0], /offline/);
});

test('reader: an optional tab reads as plain rows; a missing tab is "missing", not an error', async () => {
  const seen = [];
  const ok = await R.readTab({ sheetId: 'SHEET', token: 'tok', fetch: fakeFetch(200, { values: [['key', 'plan'], ['shop.example.org', 'Basic'], ['', '']] }, seen) }, 'Shops');
  assert.deepEqual(ok, { ok: true, rows: [{ key: 'shop.example.org', plan: 'Basic' }], missing: false });
  assert.match(seen[0].url, /values\/Shops\?/);
  const gone = await R.readTab({ sheetId: 'SHEET', token: 'tok', fetch: fakeFetch(400, { error: { message: 'Unable to parse range: Shops' } }) }, 'Shops');
  assert.deepEqual(gone, { ok: true, rows: [], missing: true });
  const no = await R.readTab({ sheetId: 'SHEET', token: 'tok', fetch: fakeFetch(403, { error: { message: 'The caller does not have permission' } }) }, 'Shops');
  assert.equal(no.ok, false);
  assert.equal((await R.readTab({ sheetId: '', token: 'tok', fetch: fakeFetch(200, {}) }, 'Shops')).ok, false);
});

test('reader: tabs lists the sheet tab names and never throws', async () => {
  const seen = [];
  assert.deepEqual(await R.tabs({ sheetId: 'SHEET', token: 'tok', fetch: fakeFetch(200, { sheets: [{ properties: { title: 'Properties' } }, { properties: { title: 'Shops' } }] }, seen) }), ['Properties', 'Shops']);
  assert.match(seen[0].url, /spreadsheets\/SHEET\?fields=sheets\.properties\.title$/);
  assert.deepEqual(await R.tabs({ sheetId: 'SHEET', token: 'tok', fetch: fakeFetch(403, {}) }), []);
  assert.deepEqual(await R.tabs({ sheetId: 'SHEET', token: 'tok', fetch: () => Promise.reject(new Error('offline')) }), []);
});
