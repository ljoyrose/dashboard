// Shop and funnel logic (Stages 7 and 8). Run: node --test tests/estate/shop.test.js
// Every row and page here is invented. Today is pinned so expiry days never drift.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../estate/core.js');
const S = require('../../estate/shop.js');
const F = require('../fixtures/estate/rows.js');
const TODAY = '2026-10-29';

// An invented page carrying invented ids and a platform app marker.
const PAGE = '<html><script>gtag("config","G-ABC1234XYZ");gtag("config","G-QQQ9999RRR");</script>' +
  '<script src="https://example.com/gtm.js?id=GTM-AB12CD3"></script>' +
  '<script>fbq("init","123456789012345");</script>' +
  '<script>var app = "google_and_youtube"; var p = "web-pixels-manager";</script></html>';
const ID_RE = /G-[A-Z0-9]{4,}|GTM-[A-Z0-9]{3,}|\d{6,}/i;

test('tagSummary: words and counts only, never an id', () => {
  const t = S.tagSummary(E.readTags(PAGE), true);
  assert.equal(t.ga4, 'found (2)');
  assert.equal(t.gtm, 'found (1)');
  assert.equal(t.meta_pixel, 'found (1)');
  assert.equal(t.loaded_by, 'loaded by Shopify web pixels and Google & YouTube app');
  assert.doesNotMatch(JSON.stringify(t), ID_RE);
});

test('tagSummary: empty page is "not found in page source", unchecked is "not checked", never "none"', () => {
  const empty = S.tagSummary(E.readTags('<html></html>'), true);
  assert.deepEqual(empty, { ga4: 'not found in page source', gtm: 'not found in page source', meta_pixel: 'not found in page source', loaded_by: '' });
  const un = S.tagSummary(null, false);
  assert.deepEqual(un, { ga4: 'not checked', gtm: 'not checked', meta_pixel: 'not checked', loaded_by: 'not checked' });
  assert.doesNotMatch(JSON.stringify([empty, un]), /\bnone\b/);
});

// The first test shop's required fields, on an invented row.
const GOOD = {
  key: 'shop.example.org', kind: 'shop', platform: 'Shopify', live_status: 'live', ga4: 'found (1)',
  source: 'seed + Google & YouTube app', target_country: 'GB', merchant_center: 'linked (per Lisa, not machine-checked)',
  ssl_expires: '2027-02-01', dmarc: 'missing'
};

test('firstTestRowCheck: a complete invented row passes', () => {
  assert.deepEqual(S.firstTestRowCheck(GOOD, TODAY), []);
  const viaNote = Object.assign({}, GOOD, { target_country: '', access_note: 'feed country GB' });
  assert.deepEqual(S.firstTestRowCheck(viaNote, TODAY), []);
});

test('firstTestRowCheck: flags each blank field', () => {
  for (const f of ['live_status', 'ga4', 'source', 'target_country', 'merchant_center', 'ssl_expires', 'dmarc']) {
    const row = Object.assign({}, GOOD, { [f]: '' });
    assert.deepEqual(S.firstTestRowCheck(row, TODAY), [f], 'blank ' + f);
  }
  assert.deepEqual(S.firstTestRowCheck({}, TODAY),
    ['live_status', 'ga4', 'source', 'target_country', 'merchant_center', 'ssl_expires', 'dmarc']);
});

test('firstTestRowCheck: flags failed values, not only blanks', () => {
  const bad = Object.assign({}, GOOD, { live_status: 'down', ga4: 'not found in page source', ssl_expires: '2026-10-01', dmarc: 'pass', merchant_center: 'linked' });
  assert.deepEqual(S.firstTestRowCheck(bad, TODAY), ['live_status', 'ga4', 'merchant_center', 'ssl_expires', 'dmarc']);
});

test('shopCard: missing feed shows "not reported", never "ok" or 0', () => {
  const shop = F.ROWS.find((r) => r.kind === 'shop');
  const c = S.shopCard(shop, null);
  assert.equal(c.platform, 'Shopify');
  for (const k of ['plan', 'currency', 'products', 'channels', 'feed', 'merchant_center']) assert.equal(c[k], 'not reported', k);
  const vals = Object.values(c);
  assert.ok(!vals.includes('ok'));
  assert.ok(!vals.includes(0) && !vals.includes('0'));
});

test('shopCard: report words pass through; gaps inside a report stay "not reported"', () => {
  const c = S.shopCard({ platform: 'Shopify' }, { feed_status: 'approved with warnings', merchant_center_status: 'linked', products: 12, channels: ['Online Store', 'Google & YouTube'] });
  assert.equal(c.feed, 'approved with warnings');
  assert.equal(c.merchant_center, 'linked');
  assert.equal(c.products, '12');
  assert.equal(c.channels, 'Online Store, Google & YouTube');
  assert.equal(c.plan, 'not reported');
  assert.equal(S.shopCard({}, { feed_status: '', channels: [] }).feed, 'not reported');
  assert.equal(S.shopCard({}, { channels: [] }).channels, 'not reported');
});

test('funnelsByWorkspace: groups ClickFunnels rows only, workspace from access_note or brand', () => {
  const rows = F.ROWS.concat([
    { key: 'f2', platform: 'ClickFunnels', live_status: 'live', access_note: 'workspace: Invented Space; editor role', brand: 'X' },
    { key: 'f3', platform: 'clickfunnels', live_status: 'live', access_note: 'workspace: Invented Space' },
    { key: 'f4', platform: 'ClickFunnels', live_status: '' , brand: 'Sample Brand' }
  ]);
  assert.deepEqual(S.funnelsByWorkspace(rows), [
    { workspace: 'Invented Space', count: 2, live: 2, down: 0 },
    { workspace: 'Sample Brand', count: 2, live: 0, down: 1 }
  ]);
  assert.deepEqual(S.funnelsByWorkspace([]), []);
});
