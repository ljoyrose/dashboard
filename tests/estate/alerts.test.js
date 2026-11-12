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

test('certificate red tier: 7 days or less is red, 8 to 30 stays amber', () => {
  const list = A.alerts([
    { key: 'd0.example', ssl_expires: '2026-10-29' },
    { key: 'd7.example', ssl_expires: '2026-11-05' },
    { key: 'd8.example', ssl_expires: '2026-11-06' },
  ], TODAY);
  assert.deepEqual(list.map((a) => a.level), ['red', 'red', 'amber']);
  assert.match(list[0].text, /expires today/);
  assert.match(list[1].text, /expires in 7 days/);
  assert.equal(list[1].kind, 'ssl');
  assert.match(list[2].text, /expires in 8 days/);
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

test('mail flags: weak DMARC, broken SPF, missing Google DKIM, no MX, forward hops, unknown target', () => {
  const list = A.alerts([
    { key: 'weak.example', dmarc: 'weak', spf: 'pass' },
    { key: 'broken.example', spf: 'broken', dmarc: 'reject' },
    { key: 'dkim.example', spf: 'pass', dkim: 'not found', dmarc: 'reject', mx: 'Google Workspace' },
    { key: 'nomx.example', mx: 'none', spf: 'pass', dmarc: 'reject' },
    { key: 'fwd.example', mx: 'ImprovMX', forward_chain: 'forward.example.net → box.example.org → inbox.example.com', spf: 'pass', dmarc: 'reject' },
    { key: 'unk.example', mx: 'Namecheap email forwarding', spf: 'pass', dmarc: 'reject' },
    { key: 'one.example', mx: 'ForwardEmail', forward_chain: 'forward.example.net → inbox.example.com', spf: 'pass', dmarc: 'reject' },
    { key: 'ms.example', mx: 'Microsoft 365', dkim: 'not found', spf: 'pass', dmarc: 'reject' },
  ], TODAY);
  const text = (key) => list.filter((a) => a.key === key).map((a) => a.text).join(' | ');
  assert.match(text('weak.example'), /DMARC weak/);
  assert.match(text('broken.example'), /SPF broken/);
  assert.match(text('dkim.example'), /DKIM missing/);
  assert.match(text('nomx.example'), /no MX/);
  assert.match(text('fwd.example'), /2 hops/);
  assert.match(text('unk.example'), /target unknown, needs registrar export/);
  assert.equal(list.filter((a) => a.key === 'one.example').length, 0, 'one hop is shown on the row, not alerted');
  assert.equal(list.filter((a) => a.key === 'ms.example').length, 0, 'DKIM not found is not a fault off Google Workspace');
  list.forEach((a) => assert.equal(a.level, 'amber'));
});

test('nameservers changed only when a previous value is available', () => {
  const now = [{ key: 'example.com', nameservers: 'ns1.example.net' }];
  assert.deepEqual(A.alerts(now, TODAY), []);
  assert.deepEqual(A.alerts(now, TODAY, [{ key: 'example.com', nameservers: '' }]), []);
  assert.deepEqual(A.alerts(now, TODAY, [{ key: 'example.com', nameservers: 'ns1.example.net.' }]), []);
  const changed = A.alerts(now, TODAY, [{ key: 'example.com', nameservers: 'ns1.other.test' }]);
  assert.equal(changed[0].kind, 'ns');
  assert.equal(changed[0].level, 'amber');
  assert.match(changed[0].text, /nameservers changed from ns1.other.test/);
  const onRow = A.alerts([{ key: 'example.co.uk', nameservers: 'ns1.example.co.uk', nameservers_previous: 'ns9.example.org' }], TODAY);
  assert.equal(onRow[0].kind, 'ns');
  assert.match(onRow[0].text, /ns9.example.org/);
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
