// JOB 34 (group D): Marketplace gaps not proved by marketplace.spec.js, house-look or phone.spec.js.
// Sign out, unknown address, load errors in plain words, an expired sign-in, Refresh after a failure, a slow read,
// the drop-off QR window, label sheet Close, the Stock round (shelves, tick, Round saved, no round open),
// Numbers tile breakdown, phone width on Round and Numbers, keyboard reach. Pretend Google and Sheets only; every row invented.
const { test, expect, HUBS, go, sheets, sideScroll, tabWalk, SHEETS } = require('../fixtures/job34/load');

const ago = (min) => new Date(Date.now() - min * 60000).toISOString();

// Pretend Sheets answering from `rows`; returns the list of writes (range + values).
async function book(page, rows) {
  const writes = [];
  page.on('request', (req) => {
    if (SHEETS.test(req.url()) && req.method() === 'PUT') writes.push({ range: decodeURIComponent(req.url()).replace(/^.*\/values\/|\?.*$/g, ''), values: JSON.parse(req.postData()).values[0] });
  });
  await sheets(page, (url) => /!A2:L$/.test(url) ? { values: rows } : { values: [(rows[Number((/!A(\d+)/.exec(url) || [0, 2])[1]) - 2] || [])] });
  return writes;
}
async function open(page, hash = '#/me') {
  await page.goto('marketplace/' + hash);
  await page.locator('#view [data-action="signin"]').click();
  await expect(page.locator('#readAt')).toContainText(/^Read \d/);
}
const ROUND = [
  ['RD|1', 'round', 'Clothes', 'Sample collar', JSON.stringify({ shelf: 'A1', expected: 3, item_sku: 'SKU-SAMPLE-1' }), ago(5)],
  ['RD|2', 'round', 'Clothes', 'Sample harness', JSON.stringify({ shelf: 'B2', expected: 2, item_sku: 'SKU-SAMPLE-2' }), ago(5)],
];

test.describe('Marketplace (JOB 34)', () => {
  test('Sign out in the header: back to the sign-in card; tabs, Refresh and the read time go', async ({ page }) => {
    await HUBS.marketplace.open(page);
    await expect(page.locator('#signin')).toHaveText('Sign out');
    await page.locator('#signin').click();
    await expect(page.locator('#view h2')).toHaveText('Sign in to see what needs you');
    await expect(page.locator('#tabs')).toBeHidden();
    await expect(page.locator('#refresh')).toBeHidden();
    await expect(page.locator('#readAt')).toHaveText('');
    await expect(page.locator('#signin')).toHaveText('Sign in');
  });

  test('an unknown address opens Home; the Marketplace title goes Home; ← Dashboard points at the main dashboard', async ({ page }) => {
    await HUBS.marketplace.open(page);
    await go(page, 'nope');
    await expect(page.locator('#view .card.next')).toBeVisible();
    await go(page, 'insights');
    await page.locator('header h1 a').click();
    await expect(page).toHaveURL(/#\/me$/);
    await expect(page.locator('#tabs a[data-nav="me"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#backHome')).toHaveAttribute('href', '../');
  });

  for (const [status, message, words] of [
    [500, 'Backend error', 'Could not load: Google said 500: Backend error'],
    [403, 'The caller does not have permission', 'cannot open the Open work sheet'],
    [403, 'Request had insufficient authentication scopes.', 'tick every box Google shows'],
  ]) {
    test(`a ${status} "${message}" when reading says what to do in plain words`, async ({ page, allowedConsole }) => {
      allowedConsole.push(new RegExp('status of ' + status)); // the browser logs the refused request; the banner is the handling
      await page.route(SHEETS, (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { code: status, message } }) }));
      await page.goto('marketplace/');
      await page.locator('#view [data-action="signin"]').click();
      await expect(page.locator('#banner')).toContainText(words);
    });
  }

  test('an expired sign-in (401) goes back to the sign-in card and says sign in again', async ({ page, allowedConsole }) => {
    allowedConsole.push(/status of 401/);
    await page.route(SHEETS, (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
    await page.goto('marketplace/');
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#banner')).toContainText('Sign-in expired. Sign in again.');
    await expect(page.locator('#view h2')).toHaveText('Sign in to see what needs you');
    await expect(page.locator('#tabs')).toBeHidden();
  });

  test('Refresh after a failed read: the banner goes and the cards come back', async ({ page, allowedConsole }) => {
    allowedConsole.push(/status of 500/);
    let broken = true;
    await HUBS.marketplace.open(page);
    await page.route(SHEETS, (route) => broken ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : route.fallback());
    await page.locator('#refresh').click();
    await expect(page.locator('#banner')).toContainText('Could not load');
    broken = false;
    await page.locator('#refresh').click();
    await expect(page.locator('#banner')).toBeHidden();
    await expect(page.locator('#view .card.next')).toBeVisible();
  });

  // FIX-REQUEST J34-F70 (marketplace/index.html:392-399, :929). DECISION NEEDED: fix the page (Marketplace owner) or accept. OWNER: Marketplace owner. BY 2026-11-06
  test.fixme('J34-F70 while the list is being read after sign-in, the page says it is reading (not the sign-in card again)', async ({ page }) => {
    await page.route(SHEETS, async (route) => { await new Promise((r) => setTimeout(r, 2500)); route.fulfill({ status: 200, contentType: 'application/json', body: '{"values":[]}' }); });
    await page.goto('marketplace/');
    await page.locator('#view [data-action="signin"]').click();
    await page.waitForTimeout(400);
    // Read once, mid-load: today the header says "Sign in" and the view is the sign-in card for the whole read.
    expect(await page.locator('#signin').textContent(), 'header button mid-read').toBe('Sign out');
    expect(await page.locator('#view').innerText(), 'view mid-read').not.toContain('Sign in to see what needs you');
  });

  test('a found parcel: Show QR opens the drop-off code window, Close shuts it', async ({ page }) => {
    await book(page, [['PO|1', 'post', 'Clothes', 'Sample jumper', JSON.stringify({ platform: 'ebay', parcel_id: 'L-07', courier: 'InPost', shelf: 'B2', found: true, qr: 'VN-SAMPLE-1' }), ago(5)]]);
    await open(page, '#/do');
    await expect(page.locator('#qr')).toBeHidden();
    await page.locator('#view [data-qr="PO|1"]').first().click();
    await expect(page.locator('#qr')).toBeVisible();
    await expect(page.locator('#qr .code')).toHaveText('VN-SAMPLE-1');
    await page.locator('#qr [data-action="closeqr"]').click();
    await expect(page.locator('#qr')).toBeHidden();
  });

  test('label sheet: Close goes back to the Do now list', async ({ page }) => {
    await HUBS.marketplace.open(page);
    await go(page, 'do');
    await page.locator('#view [data-action="sheet"]').click();
    await expect(page.locator('#view .packbar')).toContainText('Label sheet');
    await page.locator('#view [data-action="closesheet"]').click();
    await expect(page.locator('#view .packbar')).toHaveCount(0);
    await expect(page.locator('#view [data-action="sheet"]')).toBeVisible();
  });

  test('Stock round: Next shelf and Back move between shelves; ✓ saves "ok"; Finish says the round is saved', async ({ page }) => {
    const writes = await book(page, ROUND);
    await open(page, '#/round');
    await expect(page.locator('#view .needs')).toHaveText('Shelf A1');
    await expect(page.locator('#view [data-shelf="-1"]')).toHaveCount(0);
    await page.locator('#view [data-tick="RD|1"]').click();
    await expect(page.locator('#view .card.acc5')).toHaveCount(1);
    await page.locator('#view [data-shelf="1"]').click();
    await expect(page.locator('#view .needs')).toHaveText('Shelf B2');
    await expect(page.locator('#view [data-shelf="1"]')).toHaveCount(0);
    await page.locator('#view [data-shelf="-1"]').click();
    await expect(page.locator('#view .needs')).toHaveText('Shelf A1');
    await page.locator('#view [data-shelf="1"]').click();
    await page.locator('#view [data-action="finish"]').click();
    await expect(page.locator('#banner')).toContainText('Round saved. The engine applies it after 10 minutes.');
    expect(writes).toEqual([{ range: 'Marketplace!G2:J2', values: ['ok', '', expect.any(String), expect.any(String)] }]);
  });

  test('Stock round with no round open: says so, Open Stock and ← Insights go where they say', async ({ page }) => {
    await HUBS.marketplace.open(page);
    await go(page, 'round');
    await expect(page.locator('#view h2')).toHaveText('No round open');
    await page.locator('#view a', { hasText: 'Open Stock' }).click();
    await expect(page).toHaveURL(/#\/stock$/);
    await go(page, 'round');
    await page.locator('#view a', { hasText: 'Insights' }).click();
    await expect(page).toHaveURL(/#\/insights$/);
    await expect(page.locator('#tabs a[data-nav="insights"]')).toHaveAttribute('aria-current', 'page');
  });

  test('Numbers: tapping a tile opens its breakdown by category, tapping again closes it', async ({ page }) => {
    const k = { tiles: [{ key: 'sold', label: 'Sold this month', value: 4, arrow: 'up' }, { key: 'profit_p', label: 'Profit this month', value: 10000, arrow: 'flat' }],
      byCategory: [{ category: 'Clothes', sold: 3, profit_p: 7500 }, { category: 'Treats', sold: 1, profit_p: 2500 }] };
    await book(page, [['KPI', 'kpi', '', 'Numbers', JSON.stringify(k), ago(5)]]);
    await open(page, '#/numbers');
    await expect(page.locator('#view .card .row')).toHaveCount(0);
    await page.locator('#view [data-tile="sold"]').click();
    await expect(page.locator('#view .card .row')).toHaveText([/Clothes\s*3/, /Treats\s*1/]);
    await page.locator('#view [data-tile="profit_p"]').click();
    await expect(page.locator('#view .card .row')).toHaveText([/Clothes\s*£75\.00/, /Treats\s*£25\.00/]);
    await page.locator('#view [data-tile="profit_p"]').click();
    await expect(page.locator('#view .card .row')).toHaveCount(0);
  });

  test('phone 390px: Stock round and Numbers have no sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const k = { tiles: [{ key: 'sold', label: 'Sold this month', value: 4, arrow: 'up' }], byCategory: [{ category: 'Clothes', sold: 4, profit_p: 10000 }] };
    await book(page, [...ROUND, ['KPI', 'kpi', '', 'Numbers', JSON.stringify(k), ago(5)]]);
    await open(page, '#/round');
    expect(await sideScroll(page), 'round').toBe(false);
    await go(page, 'numbers');
    await page.locator('#view [data-tile="sold"]').click();
    expect(await sideScroll(page), 'numbers').toBe(false);
  });

  test('keyboard: Tab reaches Refresh, Sign out, ← Dashboard and all five tabs', async ({ page }) => {
    await HUBS.marketplace.open(page);
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    const seen = await tabWalk(page, 50);
    for (const name of ['Refresh', 'Sign out', 'Dashboard home', 'Home', 'Do now', 'Decide', 'Reply', 'Insights']) {
      expect(seen.some((s) => s === name || s.startsWith(name)), `Tab reaches ${name}: ${seen.join(' | ')}`).toBe(true);
    }
  });
});
