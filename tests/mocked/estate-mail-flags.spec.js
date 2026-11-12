// Web Estate DNS and mail flags on the page. Pretend Google; every domain is invented
// (example, example.net, example.org, example.co.uk, other.test). The sheet answers are mocked.
// Nothing in this test writes DNS, a registrar or a mailbox.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const F = require('../fixtures/estate/rows.js');

const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
const day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const HEADER = F.HEADER.concat(['mx', 'forward_chain', 'nameservers', 'nameservers_previous', 'registrar']);
const ROWS = [
  { key: 'red.example', kind: 'site', company: 'Sample Co', url_or_domain: 'https://red.example', live_status: 'live', ssl_expires: day(5), spf: 'pass', dkim: 'found', dmarc: 'reject', mx: 'Google Workspace', registrar: 'Example Registrar', nameservers: 'ns1.example.net', nameservers_previous: 'ns1.other.test' },
  { key: 'amber.example', kind: 'site', company: 'Sample Co', url_or_domain: 'https://amber.example', live_status: 'live', ssl_expires: day(20), spf: 'broken', dkim: 'not found', dmarc: 'weak', mx: 'Google Workspace' },
  { key: 'nomx.example', kind: 'email-domain', company: 'Sample Co', url_or_domain: 'nomx.example', mx: 'none', spf: 'pass', dmarc: 'reject' },
  { key: 'fwd.example', kind: 'email-domain', company: 'Sample Co', url_or_domain: 'fwd.example', mx: 'Namecheap email forwarding', forward_chain: 'forward.example.net → box.example.org → inbox.example.com', spf: 'pass', dmarc: 'reject' },
  { key: 'unk.example', kind: 'email-domain', company: 'Sample Co', url_or_domain: 'unk.example', mx: 'Namecheap email forwarding', spf: 'pass', dmarc: 'reject' },
  { key: 'okmx.example', kind: 'email-domain', company: 'Sample Co', url_or_domain: 'okmx.example', mx: 'Microsoft 365', spf: 'pass', dkim: 'not found', dmarc: 'none', forward_chain: 'forward.example.net → inbox.example.com' },
];

const chip = (row, name) => row.locator('.badge', { hasText: new RegExp('^' + name) });

test('DNS and mail flags show on the property and in Needs a look', async ({ page }) => {
  const methods = [];
  await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'") }));
  await page.route(/^https:\/\/sheets\.googleapis\.com\//, (route) => {
    methods.push(route.request().method());
    const url = decodeURIComponent(route.request().url());
    if (!/\/values\//.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sheets: [{ properties: { title: 'Properties' } }] }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: F.values(HEADER, ROWS) }) });
  });
  await page.goto('estate/#/all');
  await page.locator('#view [data-action="signin"]').click();

  const red = page.locator('.prop[data-key="red.example"]');
  await expect(red.locator('[data-expiry="SSL"]')).toHaveClass(/no/);
  await expect(red.locator('[data-expiry="SSL"]')).toHaveAttribute('data-days', '5');
  const amber = page.locator('.prop[data-key="amber.example"]');
  await expect(amber.locator('[data-expiry="SSL"]')).toHaveClass(/soon/);
  await expect(amber.locator('[data-expiry="SSL"]')).toHaveAttribute('data-days', '20');
  await expect(amber.locator('[data-expiry="SSL"]')).not.toHaveClass(/\bno\b/);

  await expect(chip(amber, 'SPF')).toHaveClass(/no/);
  await expect(chip(amber, 'DKIM')).toHaveClass(/no/);
  await expect(chip(amber, 'DMARC')).toContainText('weak');
  await expect(chip(page.locator('.prop[data-key="nomx.example"]'), 'MX')).toContainText('none');
  await expect(chip(page.locator('.prop[data-key="okmx.example"]'), 'MX')).toContainText('present · Microsoft 365');
  await expect(chip(page.locator('.prop[data-key="okmx.example"]'), 'MX')).not.toHaveClass(/\bno\b/);
  await expect(chip(page.locator('.prop[data-key="okmx.example"]'), 'Forward')).toContainText('1 hop');
  await expect(chip(page.locator('.prop[data-key="okmx.example"]'), 'Forward')).not.toHaveClass(/\bno\b/);
  await expect(chip(page.locator('.prop[data-key="fwd.example"]'), 'Forward')).toContainText('2 hops');
  await expect(chip(page.locator('.prop[data-key="fwd.example"]'), 'Forward')).toHaveClass(/no/);
  await expect(chip(page.locator('.prop[data-key="unk.example"]'), 'Forward')).toContainText('target unknown, needs registrar export');
  await expect(chip(red, 'Registrar')).toContainText('Example Registrar');
  await expect(chip(red, 'Nameservers')).toContainText('ns1.example.net');
  await expect(chip(red, 'Nameservers')).toHaveClass(/no/);

  await page.locator('nav.tabs a[data-nav="look"]').click();
  const card = page.locator('[data-card="alerts"]');
  await expect(card.locator('[data-akey="red.example"][data-alert="ssl"]')).toHaveAttribute('data-level', 'red');
  await expect(card.locator('[data-akey="amber.example"][data-alert="ssl"]')).toHaveAttribute('data-level', 'amber');
  await expect(card.locator('[data-akey="amber.example"][data-alert="dmarc"]')).toContainText('DMARC weak');
  await expect(card.locator('[data-akey="amber.example"][data-alert="spf"]')).toContainText('SPF broken');
  await expect(card.locator('[data-akey="amber.example"][data-alert="dkim"]')).toContainText('DKIM missing');
  await expect(card.locator('[data-akey="nomx.example"][data-alert="mx"]')).toContainText('no MX');
  await expect(card.locator('[data-akey="fwd.example"][data-alert="forward"]')).toContainText('2 hops');
  await expect(card.locator('[data-akey="unk.example"][data-alert="forward"]')).toContainText('target unknown, needs registrar export');
  await expect(card.locator('[data-akey="red.example"][data-alert="ns"]')).toContainText('nameservers changed from ns1.other.test');
  await expect(card.locator('[data-akey="okmx.example"]')).toHaveCount(0);
  expect(methods.every((m) => m === 'GET')).toBe(true);
});
