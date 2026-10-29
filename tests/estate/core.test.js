// Web Estate Hub pure logic. Run: node --test tests/estate/core.test.js
// Every name here is invented (example.com / example.org / .test style). No estate row lives in this repo.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../estate/core.js');

test('parseCSV keeps commas, quotes and new lines inside quoted cells and drops the start marker', () => {
  const rows = E.parseCSV('﻿key,note\r\na,"one, two"\nb,"say ""hi""\nnext line"\n');
  assert.deepEqual(rows, [['key', 'note'], ['a', 'one, two'], ['b', 'say "hi"\nnext line']]);
  assert.deepEqual(E.toObjects(rows)[0], { key: 'a', note: 'one, two' });
});

test('normaliseTarget accepts http, https and bare domains and gives one canonical key', () => {
  const a = E.normaliseTarget('https://WWW.Example.com/shop/');
  const b = E.normaliseTarget('example.com/shop');
  const c = E.normaliseTarget('http://example.com:8080/shop');
  assert.equal(a.ok && b.ok && c.ok, true);
  assert.equal(a.key, 'example.com/shop');
  assert.equal(b.key, a.key);
  assert.equal(c.key, a.key);
  assert.equal(a.host, 'www.example.com');
  assert.equal(b.url, 'https://example.com/shop');
  assert.equal(E.normaliseTarget('funnels.example.org').key, 'funnels.example.org');
});

test('normaliseTarget refuses anything that is not http, https or a bare domain', () => {
  for (const bad of ['ftp://example.com', 'javascript:alert(1)', 'mailto:a@example.com', 'file:///etc/passwd',
    'data:text/html,hi', '', '   ', 'not a domain', 'https://user:pw@example.com', 'localhost', '//example.com',
    'https://exa_mple.com', '<script>']) {
    assert.equal(E.normaliseTarget(bad).ok, false, bad);
  }
});

test('mergeRows: two rows with the same domain never both survive', () => {
  const rows = [
    { url_or_domain: 'https://www.example.com/', kind: 'site', platform: 'Shopify', source: 'seed' },
    { url_or_domain: 'example.com', kind: '', dns_host: 'Cloudflare', domain_expires: '2027-01-02', source: 'domains' },
    { url_or_domain: 'EXAMPLE.com', source: 'seed' },
    { url_or_domain: 'https://pages.example.org/offer', kind: 'funnel', source: 'seed' },
    { url_or_domain: 'https://pages.example.org/other', kind: 'funnel', source: 'seed' }
  ];
  const out = E.mergeRows(rows);
  const keys = out.rows.map((r) => r.key);
  assert.equal(new Set(keys).size, keys.length, 'a domain survived the merge twice');
  assert.equal(out.rows.filter((r) => r.key === 'example.com').length, 1);
  assert.equal(out.duplicates, 2);
  const site = out.rows.find((r) => r.key === 'example.com');
  assert.equal(site.platform, 'Shopify');
  assert.equal(site.kind, 'site', 'an empty value never overwrites a filled one');
  assert.equal(site.dns_host, 'Cloudflare', 'blanks are filled from the later row');
  assert.equal(site.source, 'seed + domains');
  assert.equal(out.rows.length, 3, 'different funnel paths stay separate rows');
});

test('mergeRows: a DNS zone on a site\'s domain stays its own row; two zones on one domain do not', () => {
  const out = E.mergeRows([
    { key: 'S1', kind: 'site', url_or_domain: 'https://www.example.net' },
    { key: 'Z1', kind: 'dns-zone', url_or_domain: 'example.net', dns_host: 'Cloudflare' },
    { key: 'Z2', kind: 'dns-zone', url_or_domain: 'EXAMPLE.net.' }
  ]);
  assert.deepEqual(out.rows.map((r) => r.key), ['example.net', 'dns-zone:example.net']);
  assert.equal(out.duplicates, 1);
});

test('mergeRows: rows with no address keep their own key and never fold together', () => {
  const out = E.mergeRows([
    { key: 'F01', kind: 'funnel', url_or_domain: '' },
    { key: 'F02', kind: 'funnel', url_or_domain: '' },
    { key: 'A01', kind: 'app' },
    { key: 'F01', kind: 'funnel', platform: 'ExampleFunnels' }
  ]);
  assert.deepEqual(out.rows.map((r) => r.key), ['F01', 'F02', 'A01']);
  assert.equal(out.duplicates, 1, 'the same key twice is one row');
  assert.equal(out.rows[0].platform, 'ExampleFunnels');
});

test('classifyDnsHost names the host from name servers', () => {
  assert.equal(E.classifyDnsHost(['ada.ns.cloudflare.com.', 'bob.ns.cloudflare.com']), 'Cloudflare');
  assert.equal(E.classifyDnsHost(['ns01.domaincontrol.com', 'ns02.domaincontrol.com']), 'GoDaddy');
  assert.equal(E.classifyDnsHost(['ns-1.awsdns-01.org']), 'AWS Route 53');
  assert.equal(E.classifyDnsHost(['dns1.registrar-servers.com']), 'Namecheap');
  assert.equal(E.classifyDnsHost(['ns1.example.test']), 'other (example.test)');
  assert.equal(E.classifyDnsHost(['ada.ns.cloudflare.com', 'ns1.domaincontrol.com']), 'mixed: Cloudflare, GoDaddy');
  assert.equal(E.classifyDnsHost([]), 'not checked');
});

test('readTags finds GA4, Tag Manager and Meta pixel ids in page source, and app notes', () => {
  const html = `<html><head>
    <meta name="google-site-verification" content="invented-token">
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-TEST12345"></script>
    <script>gtag('config', 'G-TEST12345'); gtag('config','G-OTHER6789');</script>
    <script>(function(w,d,s,l,i){})(window,document,'script','dataLayer','GTM-ABC1234');</script>
    <script>fbq('init', '1234567890123');</script>
    <noscript><img src="https://www.facebook.com/tr?id=1234567890123&ev=PageView"></noscript>
    <script id="web-pixels-manager-setup">/* google_and_youtube */</script>
  </head></html>`;
  const t = E.readTags(html);
  assert.deepEqual(t.ga4, ['G-TEST12345', 'G-OTHER6789']);
  assert.deepEqual(t.gtm, ['GTM-ABC1234']);
  assert.deepEqual(t.meta, ['1234567890123']);
  assert.deepEqual(t.loadedBy, ['Shopify web pixels', 'Google & YouTube app']);
  assert.deepEqual(t.verify, ['google']);
});

test('no tag in page source is "not found in page source", never "none"', () => {
  const t = E.readTags('<html><body>plain page</body></html>');
  assert.deepEqual([t.ga4, t.gtm, t.meta], [[], [], []]);
  assert.equal(E.tagWord(t.ga4, true), 'not found in page source');
  assert.equal(E.tagWord(['G-TEST12345'], true), 'found (1)');
  assert.equal(E.tagWord([], false), 'not checked');
  assert.doesNotMatch(E.tagWord([], true), /none/i);
});
