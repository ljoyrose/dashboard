// Stage 11: alerts and suggested open-work rows. Run: node --test tests/estate/alerts.test.js
// Rows are invented (tests/fixtures/estate/rows.js). Today is pinned so days never drift.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../estate/core.js');
const A = require('../../estate/alerts.js');
const F = require('../fixtures/estate/rows.js');
const TODAY = '2026-10-29';
const rows = () => E.rowsFromValues(F.values()).rows;
const kinds = (list, key) => list.filter((a) => a.key === key).map((a) => a.kind);

test('certificate expiry: 29 and 30 days listed, 31 not, passed listed red', () => {
  const list = A.alerts([
    { key: 'd29.example', ssl_expires: '2026-11-27' },
    { key: 'd30.example', ssl_expires: '2026-11-28' },
    { key: 'd31.example', ssl_expires: '2026-11-29' },
    { key: 'gone.example', ssl_expires: '2026-10-20' },
  ], TODAY);
  assert.deepEqual(kinds(list, 'd29.example'), ['ssl'], 'FAIL: certificate 29 days out not listed');
  assert.deepEqual(kinds(list, 'd30.example'), ['ssl'], 'FAIL: certificate 30 days out not listed');
  assert.deepEqual(kinds(list, 'd31.example'), []);
  const gone = list.find((a) => a.key === 'gone.example');
  assert.ok(gone, 'FAIL: passed certificate not listed');
  assert.equal(gone.level, 'red');
  assert.match(gone.text, /passed 9 days ago/);
  assert.equal(list.find((a) => a.key === 'd30.example').level, 'amber');
});

test('domain expiry within 30 days or passed is listed', () => {
  const list = A.alerts([{ key: 'x.example', domain_expires: '05/11/2026' }, { key: 'y.example', domain_expires: '2027-01-01' }], TODAY);
  assert.deepEqual(list.map((a) => [a.key, a.kind, a.level]), [['x.example', 'domain', 'red']]);
});

test('fixture: down, two SPF records and DMARC missing are listed; red comes first', () => {
  const list = A.alerts(rows(), TODAY);
  assert.deepEqual(kinds(list, 'funnels.example.net'), ['down']);
  assert.deepEqual(kinds(list, 'email-domain:example.com').sort(), ['dmarc', 'spf']);
  assert.equal(list[0].level, 'red');
  assert.equal(kinds(list, 'shop.example.org').length, 0, '33 days is outside 30');
  list.forEach((a) => assert.ok(a.level === 'red' || a.level === 'amber'));
});

test('tag lost since last scan is listed; never-found or not-checked is not', () => {
  const prev = [{ key: 's.example', ga4: 'found (1)', gtm: 'not found in page source', meta_pixel: 'found (2)' }];
  const now = [{ key: 's.example', ga4: 'not found in page source', gtm: 'not found in page source', meta_pixel: 'not checked' }];
  const list = A.alerts(now, TODAY, prev);
  assert.deepEqual(list.map((a) => a.kind), ['tag-lost']);
  assert.match(list[0].text, /GA4 tag lost/);
  assert.deepEqual(A.alerts(now, TODAY), [], 'no previous scan, no tag alert');
});

test('openWorkRows: plain suggested rows, one per key and kind, never written', () => {
  const list = A.alerts(rows(), TODAY);
  const out = A.openWorkRows(list.concat(list), '29/10/2026');
  assert.equal(out.length, list.length);
  out.forEach((r) => {
    assert.deepEqual(Object.keys(r), ['title', 'area', 'priority', 'note', 'suggested_by']);
    assert.equal(r.area, 'Web Estate');
    assert.equal(r.suggested_by, 'estate engine');
    assert.match(r.note, /29\/10\/2026/);
  });
  assert.equal(out[0].priority, 'high');
  assert.equal(out[out.length - 1].priority, 'medium');
});
