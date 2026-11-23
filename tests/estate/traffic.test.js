// Web Estate traffic this month (13 Nov 2026). Run: node --test tests/estate/traffic.test.js
// Every key, source and number here is invented.
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../../estate/traffic.js');

const NOW = new Date('2026-11-13T10:00:00Z');
const site = (o) => Object.assign({ key: 'example.com', kind: 'site' }, o || {});
const row = (o) => Object.assign({ key: 'example.com', source: 'Example CDN', period: '2026-11', updated_uk: '13/11/2026 08:00' }, o || {});

test('level: amber from 80%, red from 95%, ok below, none without a percentage', () => {
  assert.equal(T.level(0), 'ok');
  assert.equal(T.level(79), 'ok');
  assert.equal(T.level(80), 'amber');
  assert.equal(T.level(94), 'amber');
  assert.equal(T.level(95), 'red');
  assert.equal(T.level(96), 'red');
  assert.equal(T.level(null), 'none');
});

test('0%: connected, ok, zero is a real zero', () => {
  const t = T.trafficFor(site(), [row({ visits: '0', used_gb: '0', quota_gb: '10' })], NOW);
  assert.equal(t.connected, true);
  assert.equal(t.pct, 0);
  assert.equal(t.level, 'ok');
  assert.equal(t.use_word, '0.0 GB of 10 GB (0%)');
  assert.equal(t.visits_word, '0');
});

test('80%: amber, with number, % and period', () => {
  const t = T.trafficFor(site(), [row({ visits: '1,860', used_gb: '8.0', quota_gb: '10 GB' })], NOW);
  assert.equal(t.pct, 80);
  assert.equal(t.level, 'amber');
  assert.equal(t.use_word, '8.0 GB of 10 GB (80%)');
  assert.equal(t.visits_word, '1,860');
  assert.equal(t.period_word, 'Nov 2026');
  assert.equal(t.current, true);
  assert.equal(t.stale, false);
  assert.equal(t.source, 'Example CDN');
});

test('96%: red', () => {
  const t = T.trafficFor(site(), [row({ used_gb: '9.6', quota_gb: '10' })], NOW);
  assert.equal(t.pct, 96);
  assert.equal(t.level, 'red');
  assert.equal(t.visits_word, 'not reported');
});

test('not connected: no row, or a row with neither visits nor used_gb; never shows 0', () => {
  for (const tab of [[], [row({ visits: '', used_gb: '' })], [{ key: 'other.example', visits: '5' }]]) {
    const t = T.trafficFor(site({ dns_host: 'Cloudflare' }), tab, NOW);
    assert.equal(t.connected, false);
    assert.equal(t.word, 'stats not connected');
    assert.equal(t.setup.property, 'ESTATE_CF_TOKEN');
  }
});

test('setup steps follow the host; a host with no API gets the typed route and no Script Property', () => {
  assert.equal(T.setupFor(site({ dns_host: 'other (siteground.net)' })).id, 'siteground');
  assert.equal(T.setupFor(site({ dns_host: 'other (siteground.net)' })).property, '');
  assert.equal(T.setupFor(site({ platform: 'Shopify' })).property, 'ESTATE_SHOPIFY_TOKENS');
  assert.equal(T.setupFor(site({ ga4: 'found (1)' })).property, 'ESTATE_GA4_PROPERTIES');
  assert.equal(T.setupFor(site({ platform: 'Unknown builder' })).id, 'other');
  for (const s of T.SETUPS.concat(T.GENERIC)) {
    assert.ok(s.steps.length >= 2);
    assert.ok(!/upgrade|buy|pro plan/i.test(s.steps.join(' ')), 'no upgrade prompt in ' + s.id);
  }
});

test('units: MB and TB convert to GB; text is null', () => {
  assert.equal(T.gb('512 MB'), 0.5);
  assert.equal(T.gb('1 TB'), 1024);
  assert.equal(T.gb('lots'), null);
  assert.equal(T.count('n/a'), null);
});

test('period: old month is flagged; stale after 2 days', () => {
  const t = T.trafficFor(site(), [row({ used_gb: '1', quota_gb: '10', period: 'Oct 2026', updated_uk: '01/11/2026 09:00' })], NOW);
  assert.equal(t.period, '2026-10');
  assert.equal(t.current, false);
  assert.equal(t.stale, true);
  assert.equal(T.periodKey('11/2026'), '2026-11');
  assert.equal(T.periodKey('soon'), '');
});

test('only web properties get a traffic line; summary counts each state', () => {
  const rows = [site({ key: 'a.example' }), site({ key: 'b.example', kind: 'shop' }), site({ key: 'c.example', kind: 'app' }), site({ key: 'd.example', kind: 'funnel' }),
    { key: 'email-domain:a.example', kind: 'email-domain' }, { key: 'dns-zone:a.example', kind: 'dns-zone' }];
  const tab = [row({ key: 'a.example', used_gb: '8', quota_gb: '10' }), row({ key: 'b.example', used_gb: '0', quota_gb: '10' }), row({ key: 'c.example', used_gb: '9.6', quota_gb: '10' })];
  assert.deepEqual(T.summary(rows, tab, NOW), { sites: 4, connected: 3, notConnected: 1, amber: 1, red: 1 });
});

test('header check fails closed without key or a number column', () => {
  assert.equal(T.checkHeader(['key', 'visits']).ok, true);
  assert.equal(T.checkHeader(['site', 'visits']).ok, false);
  assert.equal(T.checkHeader(['key', 'source']).ok, false);
});
