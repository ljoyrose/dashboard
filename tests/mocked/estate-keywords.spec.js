// Web Estate keywords and ads (30 Oct 2026): manual rows from the private Keywords tab; "not connected" for every
// source with no rows; a zero or blank position is never shown as a real position. Pretend Google; invented rows.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const F = require('../fixtures/estate/rows.js');

const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');

async function open(page, tabs) {
  await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'") }));
  await page.route(/^https:\/\/sheets\.googleapis\.com\//, (route) => {
    const url = decodeURIComponent(route.request().url());
    if (!/\/values\//.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sheets: Object.keys(tabs).map((title) => ({ properties: { title } })) }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: tabs[/\/values\/([^?]+)/.exec(url)[1]] }) });
  });
  await page.goto('estate/#/shops');
  await page.locator('#view [data-action="signin"]').click();
}

test.describe('Web Estate keywords and ads', () => {
  test('ACCEPT: every source with no rows says "not connected" and no position is shown', async ({ page }) => {
    await open(page, { Properties: F.values() });
    for (const s of ['Semrush', 'Search Console', 'Google Ads']) await expect(page.locator(`[data-source="${s}"]`)).toContainText('not connected');
    await expect(page.locator('[data-kw]')).toHaveCount(0);
    await expect(page.locator('[data-card="keywords"]')).not.toContainText(/\b0\b/);
  });

  test('ACCEPT: manual rows show real positions best first; a 0 or blank position is "no position", never 0', async ({ page }) => {
    await open(page, { Properties: F.values(), Keywords: [['key', 'source', 'keyword', 'position'], ['example.com', 'Semrush', 'sample words', '7'], ['example.com', 'Semrush', 'other words', '2'], ['example.com', 'Semrush', 'zero words', '0']] });
    const sem = page.locator('[data-source="Semrush"]');
    await expect(sem.locator('[data-kw]')).toHaveCount(3);
    await expect(sem.locator('[data-kw]').nth(0)).toContainText('2other words');
    await expect(sem.locator('[data-kw]').nth(1)).toContainText('7sample words');
    await expect(sem.locator('[data-kw]').nth(2)).toContainText('no position');
    await expect(sem.locator('[data-kw]', { hasText: /^0/ })).toHaveCount(0);
    await expect(page.locator('[data-source="Search Console"]')).toContainText('not connected');
  });

  test('ads accounts are listed from ads-account rows', async ({ page }) => {
    await open(page, { Properties: F.values() });
    await expect(page.locator('[data-card="ads"] .prop')).toHaveCount(1);
    await expect(page.locator('[data-card="ads"]')).toContainText('client-b.example');
  });
});
