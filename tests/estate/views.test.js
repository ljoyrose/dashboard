// Stage 10: access roles, the client view and the reseller report. Run: node --test tests/estate/views.test.js
// Rows are invented (tests/fixtures/estate/rows.js). Today is pinned so days never drift.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../estate/core.js');
const V = require('../../estate/views.js');
const F = require('../fixtures/estate/rows.js');
const TODAY = '2026-10-29';
const rows = () => E.rowsFromValues(F.values()).rows;

test('accessRows gives role names only and never an email, password or token', () => {
  const out = V.accessRows([
    { key: 'a.example', access_note: 'owner: Sam; manager: agency' },
    { key: 'b.example', access_note: 'admin: someone@example.com; editor: Pat; password: hunter2; token: abcd1234efgh5678ijkl' },
    { key: 'c.example', access_note: 'manager role' },
    { key: 'd.example', access_note: '' },
  ]);
  assert.deepEqual(out[0], { key: 'a.example', roles: ['owner', 'manager'], hidden: 0 });
  assert.deepEqual(out[1], { key: 'b.example', roles: ['editor'], hidden: 3 });
  assert.deepEqual(out[2].roles, ['manager role']);
  assert.deepEqual(out[3], { key: 'd.example', roles: [], hidden: 0 });
  const text = JSON.stringify(out);
  assert.ok(!/@/.test(text), 'no email address');
  assert.ok(!/hunter2|abcd1234|Sam|Pat/.test(text), 'no holder, password or token');
});

test('client view of Client A shows no Client B row, no blank-client row and no internal field', () => {
  const extra = rows().concat([
    { key: 'a2.example.test', kind: 'site', company: 'Second Ltd', client: 'Client A', access_note: 'owner: someone@example.com', flag: 'watch', source: 'manual', keywords_tracked: '3', internal_cost: '9', notes: 'private', note_x: 'x', reseller: 'Resell Co', reseller_fee_monthly: '10' },
    { key: 'a3.example.test', kind: 'site', company: 'Second Ltd', client: 'client a' },
  ]);
  const before = JSON.stringify(extra);
  const out = V.clientView(extra, 'Client A');
  assert.deepEqual(out.map((r) => r.key), ['app.example.test', 'a2.example.test']);
  out.forEach((r) => {
    assert.equal(r.client, 'Client A');
    Object.keys(r).forEach((c) => assert.ok(!/^(access_note|flag|source|keywords_tracked)$|^internal|^note|^reseller/.test(c), 'leaked ' + c));
  });
  assert.ok(!/Client B|someone@|Resell Co|private/.test(JSON.stringify(out)));
  assert.equal(JSON.stringify(extra), before, 'input not changed');
  assert.notEqual(out[0], extra.find((r) => r.key === 'app.example.test'), 'new objects');
  assert.deepEqual(V.clientView(extra, ''), [], 'a blank client never matches the blank-client rows');
});

test('reseller report: £ with 2 decimals, UK renewal date, days to go; no reseller means no row', () => {
  const out = V.resellerReport([
    { key: 'r1.example', url_or_domain: 'r1.example', reseller: 'Resell Co', reseller_fee_monthly: '1234.5', reseller_renewal: '2026-11-28' },
    { key: 'r2.example', reseller: 'Resell Co', reseller_fee_monthly: '£9', reseller_renewal: '01/10/2026' },
    { key: 'r3.example', reseller: 'Resell Co', reseller_fee_monthly: 'tbc', reseller_renewal: 'soon' },
    { key: 'n.example' },
  ], TODAY);
  assert.equal(out.length, 3);
  assert.deepEqual(out[0], { key: 'r1.example', url_or_domain: 'r1.example', reseller: 'Resell Co', fee_monthly: '£1,234.50', renewal: '28/11/2026', days_to_go: 30 });
  assert.equal(out[1].fee_monthly, '£9.00');
  assert.equal(out[1].renewal, '01/10/2026');
  assert.equal(out[1].days_to_go, -28);
  assert.equal(out[2].fee_monthly, '');
  assert.equal(out[2].days_to_go, null);
  assert.deepEqual(V.resellerReport(rows(), TODAY), [], 'the fixture has no reseller columns');
});
