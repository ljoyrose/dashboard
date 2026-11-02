// Web Estate "Shops & ads" tab (30 Oct 2026): a card per shop with product count, channels and feed from the private
// Shops tab; "not reported" when there is no report; ClickFunnels funnels by workspace. Pretend Google; invented rows.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const F = require('../fixtures/estate/rows.js');

const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');

// tabs: { Properties: values, Shops: values | null (missing tab) }
async function open(page, tabs, hash) {
  const seen = [];
  await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'") }));
  await page.route(/^https:\/\/sheets\.googleapis\.com\//, (route) => {
    const url = decodeURIComponent(route.request().url());
    if (!/\/values\//.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sheets: Object.keys(tabs).filter((t) => tabs[t]).map((title) => ({ properties: { title } })) }) });
    const tab = /\/values\/([^?]+)/.exec(url)[1];
    seen.push({ method: route.request().method(), tab });
    const v = tabs[tab];
    if (!v) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { message: 'Unable to parse range: ' + tab } }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: v }) });
  });
  await page.goto('estate/' + (hash || '#/shops'));
  await page.locator('#view [data-action="signin"]').click();
  return seen;
}

test.describe('Web Estate shops', () => {
  test('ACCEPT: an invented shop shows product count, channels and feed status from the Shops tab', async ({ page }) => {
    const seen = await open(page, { Properties: F.values(), Shops: [['key', 'plan', 'currency', 'products', 'channels', 'feed_status', 'merchant_center_status'], ['shop.example.org', 'Basic', 'GBP', '42', 'Online Store, Google & YouTube', 'active', 'linked']] });
    const card = page.locator('[data-shop="shop.example.org"]');
    await expect(card.locator('[data-f="Products"]')).toContainText('42');
    await expect(card.locator('[data-f="Channels"]')).toContainText('Online Store, Google & YouTube');
    await expect(card.locator('[data-f="Feed"]')).toContainText('active');
    await expect(card.locator('[data-f="Plan"]')).toContainText('Basic');
    await expect(card.locator('[data-f="Currency"]')).toContainText('GBP');
    expect(seen.every((s) => s.method === 'GET')).toBe(true);
    expect(seen.map((s) => s.tab).sort()).toEqual(['Properties', 'Shops']);
  });

  test('ACCEPT: with no report the feed shows "not reported", never "ok"', async ({ page }) => {
    await open(page, { Properties: F.values() });
    const card = page.locator('[data-shop="shop.example.org"]');
    await expect(card.locator('[data-f="Feed"]')).toContainText('not reported');
    await expect(card.locator('[data-f="Merchant Center"]')).toContainText('not reported');
    await expect(card.locator('[data-f="Products"]')).toContainText('not reported');
    await expect(card).not.toContainText(/\bok\b/i);
  });

  test('ClickFunnels funnels are grouped by workspace with live and down counts', async ({ page }) => {
    await open(page, { Properties: F.values() });
    const funnels = page.locator('[data-card="funnels"] .prop');
    await expect(funnels).toHaveCount(1);
    await expect(funnels.first()).toContainText('1 funnel');
    await expect(funnels.first().locator('.badge.no')).toContainText('1');
  });
});
