// Web Estate page (30 Oct 2026): counts at the top, one card per property grouped by company, brand and client,
// down and expiring first, filters kept in the URL hash, read only. Pretend Google only; every row is invented.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const E = require('../../estate/core.js');
const F = require('../fixtures/estate/rows.js');

const SHEETS = /^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\//;
const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');

// Serve config.js with an invented estate sheet id, so the page reads (pretend) Sheets instead of showing examples.
async function withSheet(page, values) {
  const seen = [];
  await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript',
    body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'") }));
  await page.route(SHEETS, (route) => {
    seen.push({ method: route.request().method(), url: decodeURIComponent(route.request().url()) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values }) });
  });
  return seen;
}
async function signIn(page, hash) {
  await page.goto('estate/' + (hash || '#/home'));
  await page.locator('#view [data-action="signin"]').click();
}
const count = (page, k) => page.locator(`.tile [data-count="${k}"]`);

test.describe('Web Estate page', () => {
  test('not set up: invented example rows, a plain note, and nothing read or sent', async ({ page }) => {
    const sheets = [];
    await page.route(SHEETS, (route) => { sheets.push(route.request().url()); return route.abort(); });
    await page.goto('estate/');
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#banner')).toContainText('Example rows');
    await expect(page.locator('.prop').first()).toHaveAttribute('data-status', 'down');
    await expect(page.locator('#stamp')).toHaveText('TEST');
    await expect(page.locator('[data-back-home]')).toHaveAttribute('href', '../');
    expect(sheets).toEqual([]);
  });

  test('ACCEPT: signed in, a DOWN row shows above a live row and the counts match the fixture', async ({ page }) => {
    const seen = await withSheet(page, F.values());
    await signIn(page);
    const props = page.locator('.prop');
    await expect(props).toHaveCount(F.ROWS.length);
    await expect(props.first()).toHaveAttribute('data-status', 'down');
    await expect(props.first()).toHaveAttribute('data-key', 'funnels.example.net');
    const first = page.locator('.card[data-group="Sample Co · Sample Brand"] .prop');
    await expect(first.nth(0)).toHaveAttribute('data-status', 'down');
    await expect(first.nth(1)).toHaveAttribute('data-status', 'live');
    const c = E.summarise(E.rowsFromValues(F.values()).rows, new Date());
    await expect(count(page, 'Live')).toHaveText(String(c.live));
    await expect(count(page, 'Down')).toHaveText(String(c.down));
    await expect(count(page, 'Blocked to scripts')).toHaveText(String(c.blocked));
    await expect(count(page, 'Not checked')).toHaveText(String(c.notChecked + c.parked));
    await expect(count(page, 'Expiring in 60 days')).toHaveText(String(c.expiring));
    await expect(count(page, 'Email checks failing')).toHaveText(String(c.emailFailing));
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((s) => s.method === 'GET'), 'read only: never a write').toBe(true);
    expect(seen[0].url).toMatch(/spreadsheets\/SHEET_TEST\/values\/Properties\?/);
  });

  test('email faults and expiry show as chips; DKIM "not found" is not shown as a fault', async ({ page }) => {
    await withSheet(page, F.values());
    await signIn(page);
    const mail = page.locator('.prop[data-key="email-domain:example.com"]');
    await expect(mail.locator('.badge.no', { hasText: 'two SPF records, DMARC missing' })).toBeVisible();
    await expect(mail.locator('.badge', { hasText: 'DKIM' })).not.toHaveClass(/\bno\b/);
  });

  test('a renamed column shows no rows and names the column', async ({ page }) => {
    await withSheet(page, F.values(F.HEADER.map((c) => (c === 'live_status' ? 'status' : c))));
    await signIn(page);
    await expect(page.locator('#banner')).toContainText('missing live_status; found status');
    await expect(page.locator('.prop')).toHaveCount(0);
  });

  test('filters are kept in the URL hash, survive a reload and narrow every tab', async ({ page }) => {
    await withSheet(page, F.values());
    await signIn(page);
    await page.locator('select[data-filter="kind"]').selectOption('shop');
    await expect(page).toHaveURL(/#\/home\?kind=shop$/);
    await expect(page.locator('.prop')).toHaveCount(1);
    await page.reload();
    await expect(page.locator('select[data-filter="kind"]')).toHaveValue('shop');
    await expect(page.locator('.prop')).toHaveCount(1);
    await expect(page.locator('nav.tabs a[data-nav="look"]')).toHaveAttribute('href', '#/look?kind=shop');
    await page.goto('estate/#/look?company=Second%20Ltd');
    await expect(page.locator('.prop')).toHaveCount(1);
    await expect(page.locator('.prop')).toHaveAttribute('data-key', 'app.example.test');
    await page.locator('[data-action="clear"]').click();
    await expect(page).toHaveURL(/#\/look$/);
  });

  test('Not checked tab lists only rows with no scan yet', async ({ page }) => {
    await withSheet(page, F.values());
    await signIn(page, '#/unchecked');
    const keys = await page.locator('.prop').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')).sort());
    expect(keys).toEqual(['ads-account:client-b.example', 'dns-zone:example.com', 'email-domain:example.com']);
  });
});
