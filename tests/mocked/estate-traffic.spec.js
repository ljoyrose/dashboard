// Web Estate traffic this month (13 Nov 2026): every site row shows use against quota (number, % and bar), visits, period,
// source and last updated, or "stats not connected" with the Lisa-only step. Amber from 80%, red from 95%, no upgrade prompt.
// Pretend Google; every key and number is invented. Runs at desktop size and at 360px.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const F = require('../fixtures/estate/rows.js');

const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
const NOW = new Date();
const MONTH = NOW.toISOString().slice(0, 7);
const STAMP = NOW.toLocaleString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
const TRAFFIC = [['key', 'source', 'period', 'visits', 'used_gb', 'quota_gb', 'updated_uk', 'note'],
  ['example.com', 'Invented CDN', MONTH, '1860', '8.0', '10', STAMP, ''],
  ['shop.example.org', 'Invented analytics', MONTH, '0', '0', '10', STAMP, ''],
  ['app.example.test', 'Invented CDN', MONTH, '5120', '9.6', '10', STAMP, '']];

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
  await page.goto('estate/' + (hash || '#/all'));
  await page.locator('#view [data-action="signin"]').click();
  return seen;
}

for (const size of [{ name: 'desktop', vp: { width: 1280, height: 900 } }, { name: '360px', vp: { width: 360, height: 780 } }]) {
  test.describe('Web Estate traffic · ' + size.name, () => {
    test.use({ viewport: size.vp });

    test('ACCEPT: 80% amber, 0% ok, 96% red, and "not connected" with the Lisa-only step', async ({ page }) => {
      const seen = await open(page, { Properties: F.values(), Traffic: TRAFFIC });
      const amber = page.locator('[data-traffic="example.com"]');
      await expect(amber).toHaveAttribute('data-level', 'amber');
      await expect(amber.locator('[data-tr="use"]')).toContainText('8.0 GB of 10 GB (80%)');
      await expect(amber.locator('[data-tr="use"]')).toHaveClass(/soon/);
      await expect(amber.locator('.tbar')).toHaveAttribute('aria-label', '80% of the monthly quota used');
      await expect(amber.locator('[data-tr="visits"]')).toContainText('1,860');
      await expect(amber.locator('[data-tr="meta"]')).toContainText('Invented CDN');
      await expect(amber.locator('[data-tr="meta"]')).toContainText('updated ' + STAMP);

      const zero = page.locator('[data-traffic="shop.example.org"]');
      await expect(zero).toHaveAttribute('data-level', 'ok');
      await expect(zero.locator('[data-tr="use"]')).toContainText('(0%)');

      const red = page.locator('[data-traffic="app.example.test"]');
      await expect(red).toHaveAttribute('data-level', 'red');
      await expect(red.locator('[data-tr="use"]')).toHaveClass(/\bno\b/);
      await expect(red.locator('[data-tr="use"]')).toContainText('(96%)');

      const none = page.locator('[data-traffic="funnels.example.net"]');
      await expect(none.locator('[data-tr="none"]')).toContainText('stats not connected');
      await none.locator('details summary').click();
      await expect(none.locator('[data-tr-steps] li').first()).toBeVisible();
      await expect(none.locator('.lisa')).toContainText('Lisa-only step');

      // Every web property has a traffic line; DNS zones, email domains and ads accounts do not.
      await expect(page.locator('[data-traffic]')).toHaveCount(4);
      await expect(page.locator('.prop[data-key="email-domain:example.com"] [data-traffic]')).toHaveCount(0);
      // Free plan stays free: no upgrade words or buttons anywhere.
      await expect(page.locator('#view')).not.toContainText(/upgrade|buy more|go pro/i);
      // Read only.
      expect(seen.every((s) => s.method === 'GET')).toBe(true);
      expect(seen.map((s) => s.tab)).toContain('Traffic');
      // No sideways scroll.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test('details fold shows period, visits, used, quota, %, last updated and source', async ({ page }) => {
      await open(page, { Properties: F.values(), Traffic: TRAFFIC });
      const row = page.locator('[data-traffic="example.com"]');
      await row.locator('details summary').click();
      const dl = row.locator('details dl');
      for (const t of ['Period', 'Visits', 'Used', 'Quota', 'Used %', 'Last updated', 'Source']) await expect(dl).toContainText(t);
      await expect(dl).toContainText('80% · 80% or more of quota');
      await expect(dl).toContainText('10 GB a month');
    });

    test('no Traffic tab: every site says "stats not connected", never 0', async ({ page }) => {
      await open(page, { Properties: F.values() });
      await expect(page.locator('[data-traffic] [data-tr="none"]')).toHaveCount(4);
      await expect(page.locator('[data-tr="use"]')).toHaveCount(0);
    });

    test('a renamed key column fails closed: not connected, with the reason', async ({ page }) => {
      const bad = [['site', 'visits', 'used_gb', 'quota_gb']].concat(TRAFFIC.slice(1).map((r) => [r[0], r[3], r[4], r[5]]));
      await open(page, { Properties: F.values(), Traffic: bad });
      await expect(page.locator('[data-traffic] [data-tr="none"]')).toHaveCount(4);
      const row = page.locator('[data-traffic="example.com"]');
      await row.locator('details summary').click();
      await expect(row.locator('details dl')).toContainText('Traffic tab has no key column');
    });
  });
}

test('signed out: no traffic numbers on screen', async ({ page }) => {
  await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'") }));
  await page.goto('estate/#/all');
  await expect(page.locator('#view [data-action="signin"]')).toBeVisible();
  await expect(page.locator('[data-traffic]')).toHaveCount(0);
});
