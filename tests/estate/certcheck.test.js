// Stage 14: two-source certificate check. Run: node --test tests/estate/certcheck.test.js
// Hosts, issuers and log ids are invented (example.com style). Now is pinned so days never drift.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../../estate/certcheck.js');
const NOW = '2026-11-12T09:00:00';

const cert = (id, names, from, to, issuer) => ({
  issuer_name: issuer || 'C=XX, O=Example Trust, CN=Example CA R1',
  common_name: names.split('\n')[0],
  name_value: names,
  id: id,
  not_before: from,
  not_after: to,
});
const LOG = [
  cert(1001, 'shop.example.com', '2026-01-01T00:00:00', '2026-04-01T00:00:00'), // expired
  cert(1002, 'shop.example.com\nwww.shop.example.com', '2026-10-01T00:00:00', '2026-12-30T00:00:00'),
  cert(1003, 'shop.example.com\nwww.shop.example.com', '2026-10-01T00:00:00', '2026-12-30T00:00:00'), // precert twin
  cert(1004, '*.example.com\nexample.com', '2026-09-15T00:00:00', '2027-01-13T23:59:59'),
  cert(1005, 'other.example.org', '2026-10-01T00:00:00', '2027-06-01T00:00:00'),
  cert(1006, 'shop.example.com', '2026-12-01T00:00:00', '2027-03-01T00:00:00'), // not valid yet
];

test('VERSION is exported', () => {
  assert.match(C.VERSION, /^\d+\.\d+\.\d+$/);
});

test('fromCrtSh: latest currently-valid not_after for a covered host', () => {
  // shop.example.com is covered by 1002/1003 and by the wildcard 1004; 1004 ends later.
  assert.equal(C.fromCrtSh(LOG, 'shop.example.com', NOW), '2027-01-13');
  assert.equal(C.fromCrtSh(LOG, 'example.com', NOW), '2027-01-13');
  assert.equal(C.fromCrtSh(LOG, 'www.shop.example.com', NOW), '2026-12-30');
  assert.equal(C.fromCrtSh(LOG, 'other.example.org', NOW), '2027-06-01');
  assert.equal(C.fromCrtSh(LOG, 'missing.example.net', NOW), null);
});

test('fromCrtSh accepts the raw JSON text and a URL-ish host', () => {
  assert.equal(C.fromCrtSh(JSON.stringify(LOG), 'https://shop.example.com/path', NOW), '2027-01-13');
});

test('wildcard covers exactly one label, never the bare domain or two labels', () => {
  assert.equal(C.nameCovers('*.example.com', 'a.example.com'), true);
  assert.equal(C.nameCovers('*.example.com', 'example.com'), false);
  assert.equal(C.nameCovers('*.example.com', 'a.b.example.com'), false);
  assert.equal(C.nameCovers('*.example.com', 'badexample.com'), false);
  assert.equal(C.nameCovers('SHOP.Example.com.', 'shop.example.com'), true);
  const onlyWild = [cert(2001, '*.example.com', '2026-10-01', '2027-02-02')];
  assert.equal(C.fromCrtSh(onlyWild, 'a.b.example.com', NOW), null);
  assert.equal(C.fromCrtSh(onlyWild, 'example.com', NOW), null);
  assert.equal(C.fromCrtSh(onlyWild, 'blog.example.com', NOW), '2027-02-02');
});

test('expired and not-yet-valid certificates are ignored; precertificate twins count once', () => {
  const list = [cert(3001, 'old.example.com', '2025-01-01', '2026-11-11T23:00:00')];
  assert.equal(C.fromCrtSh(list, 'old.example.com', NOW), null, 'FAIL: expired certificate used');
  assert.equal(C.logCerts(LOG, 'www.shop.example.com', NOW).length, 1, 'FAIL: precertificate counted twice');
  assert.ok(!C.logCerts(LOG, 'shop.example.com', NOW).some((c) => c.id === 1006 || c.id === 1001));
});

test('garbage input never throws and gives null', () => {
  [undefined, null, '', 'not json', '{"a":', '[1,2,"x",null]', 42, {}, [{ name_value: 7, not_after: {} }],
    [{ name_value: 'g.example.com', not_after: 'soon' }]].forEach((bad) => {
    assert.equal(C.fromCrtSh(bad, 'g.example.com', NOW), null);
  });
  assert.equal(C.fromCrtSh(LOG, '', NOW), null);
  assert.equal(C.fromCrtSh(LOG, null, NOW), null);
});

test('compare: equal dates agree', () => {
  const r = C.compare('2027-01-13', '2027-01-13');
  assert.equal(r.result, 'agree');
  assert.equal(r.live, '2027-01-13');
  assert.equal(r.log, '2027-01-13');
  assert.match(r.text, /agree/);
});

test('compare: one day apart agrees by default; two days disagree; tolerance is adjustable', () => {
  assert.equal(C.compare('2027-01-13', '2027-01-14').result, 'agree');
  assert.equal(C.compare('13/01/2027', '2027-01-14T10:00:00').result, 'agree', 'mixed date forms');
  assert.equal(C.compare('2027-01-13', '2027-01-15').result, 'disagree');
  assert.equal(C.compare('2027-01-13', '2027-01-15', { toleranceDays: 2 }).result, 'agree');
  assert.equal(C.compare('2027-01-13', '2027-01-14', { toleranceDays: 0 }).result, 'disagree');
});

test('compare: disagree text shows both dates', () => {
  const r = C.compare('2026-12-01', '2027-03-01');
  assert.equal(r.result, 'disagree');
  assert.match(r.text, /2026-12-01/);
  assert.match(r.text, /2027-03-01/);
  assert.match(r.text, /90 days apart/);
});

test('compare: one source only, and none', () => {
  assert.deepEqual(C.compare('2027-01-13', '').result, 'live only');
  assert.deepEqual(C.compare(null, '2027-01-13').result, 'log only');
  assert.deepEqual(C.compare('', null).result, 'none');
  assert.deepEqual(C.compare('rubbish', 'also rubbish').result, 'none');
  assert.match(C.compare('', '2027-01-13', { liveReason: 'live read rejected: egress gateway certificate' }).text, /egress gateway/);
});

test('chip: disagree is amber "Cert sources disagree"; agree ok; one source info; none grey', () => {
  assert.deepEqual(C.chip('disagree'), { label: 'Cert sources disagree', level: 'amber' });
  assert.equal(C.chip('agree').level, 'ok');
  assert.equal(C.chip('live only').level, 'info');
  assert.equal(C.chip('log only').level, 'info');
  assert.equal(C.chip('none').level, 'grey');
  assert.equal(C.chip(C.compare('2026-12-01', '2027-03-01')).label, 'Cert sources disagree');
  assert.equal(C.chip('nonsense').level, 'grey');
});

test('isGatewayCert: egress gateway issuer, or fresh ~30-day certificate, is a gateway cert', () => {
  assert.equal(C.isGatewayCert({ issuer: 'CN=Egress Gateway Example Issuing CA', notBefore: '2026-06-01', notAfter: '2026-12-01' }), true);
  assert.equal(C.isGatewayCert({ issuer: 'CN=Example Internal Issuing CA', notBefore: '2026-11-12T08:59:00', notAfter: '2026-12-12T08:59:00' }, NOW), true);
  assert.equal(C.isGatewayCert({ issuer: 'CN=Example CA R1', notBefore: '2026-10-01', notAfter: '2026-12-30' }, NOW), false, '90-day public cert');
  assert.equal(C.isGatewayCert({ issuer: 'CN=Example CA R1', notBefore: '2026-09-01', notAfter: '2026-09-30' }, NOW), false, 'short but not fresh');
  assert.equal(C.isGatewayCert(null), false);
  assert.equal(C.isGatewayCert('x'), false);
});

test('liveFromRow: gateway or cloud-session read is treated as absent with a reason', () => {
  const gw = C.liveFromRow({ key: 'a.example.com', ssl_expires: '2026-12-12', ssl_issuer: 'Egress Gateway Example Issuing CA' }, NOW);
  assert.equal(gw.date, null);
  assert.match(gw.reason, /egress gateway/);
  const cloud = C.liveFromRow({ key: 'a.example.com', ssl_expires: '2027-01-13', ssl_source: 'cloud session' }, NOW);
  assert.equal(cloud.date, null);
  assert.match(cloud.reason, /cloud session/);
  const ok = C.liveFromRow({ key: 'a.example.com', ssl_expires: '2027-01-13', ssl_issuer: 'CN=Example CA R1', ssl_source: 'apps script' }, NOW);
  assert.deepEqual(ok, { date: '2027-01-13', reason: '' });
  assert.equal(C.liveFromRow({ key: 'a.example.com' }, NOW).date, null);
});

test('checkRows: per-row results keyed by row.key', () => {
  const rows = [
    { key: 'shop.example.com', url_or_domain: 'https://shop.example.com', ssl_expires: '2027-01-14' },
    { key: 'www.shop.example.com', ssl_expires: '2027-03-01' },
    { key: 'site:blog', url_or_domain: 'blog.example.com', ssl_expires: '2027-01-13' },
    { key: 'gw.example.com', ssl_expires: '2026-12-12', ssl_issuer: 'Egress Gateway Example Issuing CA' },
    { key: 'none.example.net' },
    { url_or_domain: 'nokey.example.com' },
  ];
  const crt = {
    'shop.example.com': LOG,
    'www.shop.example.com': JSON.stringify(LOG),
    'gw.example.com': [cert(4001, 'gw.example.com', '2026-10-01', '2026-12-28')],
    'none.example.net': 'garbage',
  };
  const out = C.checkRows(rows, crt, NOW);
  assert.deepEqual(Object.keys(out).sort(), ['gw.example.com', 'none.example.net', 'shop.example.com', 'site:blog', 'www.shop.example.com']);
  assert.equal(out['shop.example.com'].result, 'agree');
  assert.equal(out['shop.example.com'].chip.level, 'ok');
  assert.equal(out['www.shop.example.com'].result, 'disagree');
  assert.deepEqual(out['www.shop.example.com'].chip, { label: 'Cert sources disagree', level: 'amber' });
  assert.equal(out['site:blog'].result, 'live only', 'no log handed in for blog');
  assert.equal(out['gw.example.com'].result, 'log only');
  assert.equal(out['gw.example.com'].log, '2026-12-28');
  assert.match(out['gw.example.com'].liveReason, /egress gateway/);
  assert.match(out['gw.example.com'].text, /egress gateway/);
  assert.equal(out['none.example.net'].result, 'none');
  assert.equal(out['none.example.net'].chip.level, 'grey');
  assert.deepEqual(C.checkRows(null, null, NOW), {});
});
