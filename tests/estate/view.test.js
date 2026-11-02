// What the estate page shows: status words, counts, order and filters. Run: node --test tests/estate/view.test.js
// Rows are invented (tests/fixtures/estate/rows.js). Today is pinned so expiry days never drift.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../estate/core.js');
const F = require('../fixtures/estate/rows.js');
const TODAY = '2026-10-29';
const rows = () => E.rowsFromValues(F.values()).rows;

test('dates: ISO and UK forms, days until, and no guessing', () => {
  assert.equal(E.daysUntil('2026-11-28', TODAY), 30);
  assert.equal(E.daysUntil('28/11/2026', TODAY), 30);
  assert.equal(E.daysUntil('2026-10-28T23:00', TODAY), -1);
  assert.equal(E.daysUntil('next year', TODAY), null);
  assert.equal(E.daysUntil('', TODAY), null);
  assert.equal(E.daysUntil('2026-10-30', new Date(Date.UTC(2026, 9, 29, 22))), 1);
});

test('status words: live, down, blocked, parked, not checked; only live_status decides (a flag never does)', () => {
  const s = (v) => E.statusOf({ live_status: v });
  assert.equal(s('live'), 'live');
  assert.equal(s('200'), 'live');
  assert.equal(s('down'), 'down');
  assert.equal(s('TLS fail'), 'down');
  assert.equal(s('503'), 'down');
  assert.equal(s('no answer'), 'down');
  assert.equal(s('blocked to scripts'), 'blocked');
  assert.equal(s('403'), 'blocked');
  assert.equal(s('parked'), 'parked');
  assert.equal(s(''), 'not checked');
  assert.equal(E.statusOf({ live_status: '', flag: 'live mode on' }), 'not checked');
});

test('email faults: two SPF records is a fault; DKIM "not found" is not "missing"', () => {
  assert.deepEqual(E.emailProblems({ spf: 'two records', dkim: 'not found', dmarc: 'missing' }), ['two SPF records', 'DMARC missing']);
  assert.deepEqual(E.emailProblems({ spf: 'pass', dkim: 'found', dmarc: 'none' }), []);
  assert.deepEqual(E.emailProblems({ spf: 'missing', dkim: 'missing' }), ['SPF missing', 'DKIM missing']);
});

test('counts match the fixture', () => {
  assert.deepEqual(E.summarise(rows(), TODAY), { total: 7, live: 2, down: 1, blocked: 1, parked: 0, notChecked: 3, expiring: 1, emailFailing: 1 });
});

test('a down row shows above a live row; expiring next, soonest first; groups with trouble come first', () => {
  const g = E.groupRows(rows(), TODAY);
  assert.equal(g[0].name, 'Sample Co · Sample Brand');
  assert.deepEqual(g[0].rows.map((r) => r.key), ['funnels.example.net', 'example.com']);
  assert.equal(g[1].name, 'Sample Co · Other Brand', 'the shop expiring in 33 days comes next');
  const soon = E.groupRows([{ key: 'b', kind: 'site', company: 'X', ssl_expires: '2026-12-20' }, { key: 'a', kind: 'site', company: 'X', live_status: 'live' }, { key: 'c', kind: 'site', company: 'X', domain_expires: '2026-11-05' }], TODAY);
  assert.deepEqual(soon[0].rows.map((r) => r.key), ['c', 'b', 'a']);
});

test('filters round-trip through the URL hash and narrow the rows', () => {
  const f = E.parseFilters('#/home?company=Sample%20Co&kind=site&nonsense=1');
  assert.deepEqual(f, { company: 'Sample Co', kind: 'site' });
  assert.equal(E.filterHash('home', f), '#/home?company=Sample%20Co&kind=site');
  assert.deepEqual(E.applyFilters(rows(), f).map((r) => r.key), ['example.com']);
  assert.deepEqual(E.applyFilters(rows(), { flag: 'any' }).map((r) => r.key), ['funnels.example.net']);
  assert.equal(E.applyFilters(rows(), { flag: 'none' }).length, 6);
  assert.deepEqual(E.choices(rows(), 'platform'), ['ClickFunnels', 'Sample builder', 'Shopify', 'Webwave']);
});
