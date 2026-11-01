// JOB 34b (Marketplace): states not yet proved by marketplace.spec.js, job34-marketplace-states, house-look or tests/phone.
// A save that Google refuses (500, expired sign-in), a link opened while signed out, a card whose detail is not JSON,
// a slow Refresh, the 5-minute re-read, and the Insights pages with an empty list. Pretend Google and Sheets only.
const { test, expect, go, sheets, SHEETS } = require('../fixtures/job34/load');

const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const GO = [['GO|1', 'go', 'Treats', 'Sample biscuits', JSON.stringify({ price: '£12.00' }), ago(5)]];

async function book(page, rows) {
  let reads = 0;
  const writes = [];
  page.on('request', (req) => {
    if (!SHEETS.test(req.url())) return;
    if (req.method() === 'PUT') writes.push(decodeURIComponent(req.url()));
    // Count the Marketplace list read only; the Fish Treats cards (Cards!A2:L, G7) are read on the same timer.
    else if (/!A2:L$/.test(decodeURIComponent(req.url())) && !/\/Cards!A2:L$/.test(decodeURIComponent(req.url()))) reads += 1;
  });
  await sheets(page, (url) => /!A2:L$/.test(url) ? { values: rows } : { values: [(rows[Number((/!A(\d+)/.exec(url) || [0, 2])[1]) - 2] || [])] });
  return { writes, reads: () => reads };
}
async function open(page, hash = '#/me') {
  await page.goto('marketplace/' + hash);
  await page.locator('#view [data-action="signin"]').click();
  await expect(page.locator('#readAt')).toContainText(/^Read \d/);
}
// Every PUT (a save) gets this answer; reads still come from the pretend sheet.
async function refuseSaves(page, status, message = 'Sample failure') {
  await page.route(SHEETS, (route) => route.request().method() === 'PUT'
    ? route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { code: status, message } }) })
    : route.fallback());
}

test.describe('Marketplace (JOB 34b): states', () => {
  test('a save Google refuses (500): says Not saved in plain words, the button comes back, the card stays', async ({ page, allowedConsole }) => {
    allowedConsole.push(/status of 500/);
    await book(page, GO);
    await refuseSaves(page, 500, 'Backend error');
    await open(page, '#/decide');
    await page.locator('#view [data-ans="GO|1"][data-v="Yes"]').click();
    await expect(page.locator('#banner')).toHaveText('Not saved: Google said 500: Backend error');
    const yes = page.locator('#view [data-ans="GO|1"][data-v="Yes"]');
    await expect(yes).toHaveText('Go');
    await expect(yes).toBeEnabled();
    await expect(page.locator('#view .needs')).toHaveText('Decide: 1');
    await expect(page.locator('#view')).not.toContainText('Just done');
  });

  test('a save after the sign-in expired (401): back to the sign-in card, says sign in again, nothing counted as saved', async ({ page, allowedConsole }) => {
    allowedConsole.push(/status of 401/);
    await book(page, GO);
    await refuseSaves(page, 401);
    await open(page, '#/decide');
    await page.locator('#view [data-ans="GO|1"][data-v="Yes"]').click();
    await expect(page.locator('#banner')).toContainText('Not saved: Sign-in expired. Sign in again.');
    await expect(page.locator('#view h2')).toHaveText('Sign in to see what needs you');
    await expect(page.locator('#tabs')).toBeHidden();
    await expect(page.locator('#signin')).toHaveText('Sign in');
  });

  test('a link opened while signed out (#/insights): sign-in card only, no tabs; after signing in it opens Insights', async ({ page }) => {
    await book(page, GO);
    await page.goto('marketplace/#/insights');
    await expect(page.locator('#view h2')).toHaveText('Sign in to see what needs you');
    await expect(page.locator('#tabs')).toBeHidden();
    await expect(page.locator('#refresh')).toBeHidden();
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#view a.tile', { hasText: 'Stock low' })).toBeVisible();
    await expect(page.locator('#tabs a[data-nav="insights"]')).toHaveAttribute('aria-current', 'page');
  });

  test('a card whose detail is not JSON still shows its title and buttons, with no page error', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await book(page, [['GO|9', 'go', 'Treats', 'Sample broken detail', '{not json', ago(5)], ['MSG|9', 'message', 'Clothes', 'Sample question', '', ago(5)]]);
    await open(page, '#/decide');
    await expect(page.locator('#view')).toContainText('Sample broken detail');
    await expect(page.locator('#view [data-ans="GO|9"][data-v="Yes"]')).toBeVisible();
    await go(page, 'reply');
    await expect(page.locator('#view')).toContainText('Sample question');
    await expect(page.locator('#view [data-ans="MSG|9"]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a slow Refresh keeps the cards on screen while it reads, then updates the read time', async ({ page }) => {
    await book(page, GO);
    await open(page, '#/decide');
    await page.evaluate(() => { document.getElementById('readAt').textContent = 'Read 00:00'; });
    await page.route(SHEETS, async (route) => { await new Promise((r) => setTimeout(r, 1500)); return route.fallback(); });
    await page.locator('#refresh').click();
    await page.waitForTimeout(400);
    await expect(page.locator('#view')).toContainText('Sample biscuits');
    await expect(page.locator('#readAt')).toHaveText('Read 00:00');
    await expect(page.locator('#readAt')).not.toHaveText('Read 00:00', { timeout: 6000 });
    await expect(page.locator('#banner')).toBeHidden();
  });

  test('the list is read again every 5 minutes while signed in, and not at all after Sign out', async ({ page }) => {
    await page.clock.install();
    const b = await book(page, GO);
    await open(page, '#/me');
    const first = b.reads();
    await page.clock.runFor(5 * 60000 + 1000);
    await expect.poll(() => b.reads()).toBe(first + 1);
    await page.locator('#signin').click();
    await page.clock.runFor(10 * 60000 + 1000);
    await page.waitForTimeout(200);
    expect(b.reads()).toBe(first + 1);
  });

  test('empty list: Insights shows zero tiles; Stock, Temu and Suppliers each say in plain words why they are empty', async ({ page }) => {
    await book(page, []);
    await open(page, '#/insights');
    await expect(page.locator('#view a.tile .v')).toHaveText(['0', '0', '0']);
    await expect(page.locator('#view .acts a.btn', { hasText: 'Suppliers' })).toHaveCount(0);
    for (const [v, words] of [
      ['stock', 'The stock list appears after the engine update is pasted and set up.'],
      ['temu', 'Nothing to buy'],
      ['suppliers', 'Suppliers appear after engine v11 is pasted and set up.'],
    ]) {
      await go(page, v);
      await expect(page.locator('#view')).toContainText(words);
      await expect(page.locator('#tabs a[data-nav="insights"]')).toHaveAttribute('aria-current', 'page');
    }
  });
});
