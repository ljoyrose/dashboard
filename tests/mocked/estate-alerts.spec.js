// Web Estate alerts (30 Oct 2026): down, SSL or domain inside 30 days, DMARC missing and two SPF records are listed on
// "Needs a look"; shown only, never written anywhere by the page. Pretend Google; invented rows.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const F = require('../fixtures/estate/rows.js');

const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
const day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const ROWS = F.ROWS.concat([
  { key: 'soon.example.test', kind: 'site', company: 'Sample Co', url_or_domain: 'https://soon.example.test', live_status: 'live', ssl_expires: day(20) },
  { key: 'later.example.test', kind: 'site', company: 'Sample Co', url_or_domain: 'https://later.example.test', live_status: 'live', ssl_expires: day(45) },
]);

test('ACCEPT: Needs a look lists an SSL certificate expiring inside 30 days, the down row, DMARC missing and two SPF records', async ({ page }) => {
  const methods = [];
  await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'") }));
  await page.route(/^https:\/\/sheets\.googleapis\.com\//, (route) => {
    methods.push(route.request().method());
    const url = decodeURIComponent(route.request().url());
    if (!/\/values\//.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sheets: [{ properties: { title: 'Properties' } }] }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: F.values(F.HEADER, ROWS) }) });
  });
  await page.goto('estate/#/look');
  await page.locator('#view [data-action="signin"]').click();
  const card = page.locator('[data-card="alerts"]');
  await expect(card.locator('[data-akey="soon.example.test"][data-alert="ssl"]')).toBeVisible();
  await expect(card.locator('[data-akey="later.example.test"]')).toHaveCount(0);
  await expect(card.locator('[data-akey="funnels.example.net"][data-alert="down"]')).toBeVisible();
  await expect(card.locator('[data-alert="dmarc"]')).toHaveCount(1);
  await expect(card.locator('[data-alert="spf"]')).toHaveCount(1);
  expect(methods.every((m) => m === 'GET')).toBe(true);
});
