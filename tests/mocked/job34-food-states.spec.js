// JOB 34 (group D): GA Hub gaps not proved by food.spec.js, house-look or phone.spec.js.
// Sign out, unknown address, header links, "Show N more", Copy, load errors in plain words, an expired sign-in,
// a failed save, a slow read, keyboard reach. Pretend Google and Sheets only; every row is invented.
const { test, expect, HUBS, go, tabWalk, SHEETS } = require('../fixtures/job34/load');

const EMPTY8 = { valueRanges: [{ values: [] }, { values: [] }, { values: [] }, { values: [] }, { values: [] }, { values: [] }, { values: [] }, { values: [] }] };

// Sign in by hand (the Sheets route is set by the test first).
async function signIn(page) {
  await page.goto('food/#/home');
  await page.locator('#view [data-action="signin"]').click();
}

test.describe('GA Hub (JOB 34)', () => {
  test('Sign out in the header: back to the sign-in card, tabs and Refresh hidden, the button says Sign in again', async ({ page }) => {
    await HUBS.food.open(page);
    await expect(page.locator('#signin')).toHaveText('Sign out');
    await page.locator('#signin').click();
    await expect(page.locator('#view h2')).toHaveText('Sign in to see the GA Hub');
    await expect(page.locator('#tabs')).toBeHidden();
    await expect(page.locator('#refresh')).toBeHidden();
    await expect(page.locator('#signin')).toHaveText('Sign in');
    await expect(page.locator('#n-home')).toHaveText('');
  });

  test('an unknown address opens Home; the GA Hub title goes Home; ← Dashboard points at the main dashboard', async ({ page }) => {
    await HUBS.food.open(page);
    await go(page, 'nope');
    await expect(page.locator('#view .needs')).toContainText('Needs you');
    await expect(page.locator('nav.tabs a[data-nav="home"]')).toHaveAttribute('aria-current', 'page');
    await go(page, 'ga');
    await page.locator('header h1 a').click();
    await expect(page).toHaveURL(/#\/home$/);
    await expect(page.locator('#view .needs')).toBeVisible();
    await expect(page.locator('#backHome')).toHaveAttribute('href', '../');
  });

  test('Home: "Show 2 more" opens the other two cards; tapping a tab closes them again', async ({ page }) => {
    await HUBS.food.open(page);
    await expect(page.locator('#view .card h2')).toHaveCount(1);
    await page.locator('#view [data-action="all"]').click();
    await expect(page.locator('#view [data-ans]').first()).toBeVisible();
    await expect(page.locator('#view')).toContainText('Order #9001');
    await expect(page.locator('#view')).toContainText('New GA price list');
    await expect(page.locator('#view [data-action="all"]')).toHaveCount(0);
    await page.locator('nav.tabs a[data-nav="orders"]').click();
    await page.locator('nav.tabs a[data-nav="home"]').click();
    await expect(page.locator('#view [data-action="all"]')).toHaveText('Show 2 more');
  });

  test('GA tab: Copy puts the account code on the clipboard and says Copied', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await HUBS.food.open(page);
    await go(page, 'ga');
    const copy = page.locator('#view [data-copy]');
    await copy.click();
    await expect(copy).toHaveText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('XYZ');
  });

  for (const [status, message, words] of [
    [500, 'Backend error', 'Could not load: Google said 500: Backend error'],
    [403, 'The caller does not have permission', 'cannot open the RR_FOOD workbook'],
    [400, 'Unable to parse range: Codes!A1:Z', 'the RR_FOOD workbook is missing a tab'],
    [403, 'Request had insufficient authentication scopes.', 'tick every box Google shows'],
  ]) {
    test(`a ${status} "${message}" from Sheets says what to do in plain words`, async ({ page, allowedConsole }) => {
      allowedConsole.push(new RegExp('status of ' + status)); // the browser logs the refused request; the page's banner is the handling
      await page.route(SHEETS, (route) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: { code: status, message } }) }));
      await signIn(page);
      await expect(page.locator('#banner')).toContainText(words);
      await expect(page.locator('#banner')).toBeVisible();
    });
  }

  test('an expired sign-in (401) goes back to the sign-in card and says sign in again', async ({ page, allowedConsole }) => {
    allowedConsole.push(/status of 401/);
    await page.route(SHEETS, (route) => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
    await signIn(page);
    await expect(page.locator('#banner')).toContainText('Sign-in expired. Sign in again.');
    await expect(page.locator('#view h2')).toHaveText('Sign in to see the GA Hub');
    await expect(page.locator('#tabs')).toBeHidden();
  });

  test('Refresh after a failed read: the banner goes and the cards come in', async ({ page, allowedConsole }) => {
    allowedConsole.push(/status of 500/);
    let broken = true;
    await HUBS.food.open(page);
    await page.route(SHEETS, (route) => broken ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : route.fallback());
    await page.locator('#refresh').click();
    await expect(page.locator('#banner')).toContainText('Could not load');
    broken = false;
    await page.locator('#refresh').click();
    await expect(page.locator('#banner')).toBeHidden();
    await expect(page.locator('#view .needs')).toContainText('3');
  });

  // FIX-REQUEST J34-F60 (food/index.html:244, :439). DECISION NEEDED: fix the page (GA Hub owner) or accept. OWNER: GA Hub owner. BY 2026-11-06
  test.fixme('J34-F60 a save Google refuses says "Not saved" and the button can be tapped again', async ({ page, allowedConsole }) => {
    allowedConsole.push(/status of 500/);
    await HUBS.food.open(page);
    await page.route(SHEETS, (route) => route.request().method() === 'PUT' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : route.fallback());
    const apply = page.locator('#view [data-ans]').first();
    await apply.click();
    await expect(page.locator('#banner')).toContainText('Not saved: Google said 500');
    await expect(page.locator('#view [data-ans]').first()).toBeEnabled(); // today it stays disabled until the page is refreshed
  });

  test('a slow read never shows "Nothing needs you" before the workbook has answered', async ({ page }) => {
    await page.route(SHEETS, async (route) => { await new Promise((r) => setTimeout(r, 2500)); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY8) }); });
    await signIn(page);
    await page.waitForTimeout(400);
    await expect(page.locator('#view')).not.toContainText('Nothing needs you');
    await expect(page.locator('#view')).toContainText('Nothing needs you', { timeout: 6000 }); // the empty workbook, once read
  });

  // FIX-REQUEST J34-F61 (food/index.html:218-231, :456). DECISION NEEDED: fix the page (GA Hub owner) or accept. OWNER: GA Hub owner. BY 2026-11-06
  test.fixme('J34-F61 while the workbook is being read after sign-in, the page says it is reading (not the sign-in card again)', async ({ page }) => {
    await page.route(SHEETS, async (route) => { await new Promise((r) => setTimeout(r, 2500)); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY8) }); });
    await signIn(page);
    await page.waitForTimeout(400);
    // Read once, mid-load (no waiting): today both still say "Sign in" for the whole read, inviting a second sign-in.
    expect(await page.locator('#signin').textContent(), 'header button mid-read').toBe('Sign out');
    expect(await page.locator('#view').innerText(), 'view mid-read').not.toContain('Sign in to see the GA Hub');
  });

  test('an empty workbook: Orders, Invoices and Products each say so in plain words', async ({ page }) => {
    await page.route(SHEETS, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY8) }));
    await signIn(page);
    await expect(page.locator('#view .empty')).toContainText('Nothing needs you');
    for (const [view, words] of [['orders', 'No orders yet'], ['invoices', 'No GA invoices yet'], ['products', 'No products here']]) {
      await go(page, view);
      await expect(page.locator('#view .empty'), view).toContainText(words);
    }
  });

  // FIX-REQUEST J34-F62 (food/index.html:394-405). DECISION NEEDED: fix the page (GA Hub owner) or accept. OWNER: GA Hub owner. BY 2026-11-06
  test.fixme('J34-F62 an empty Settings tab: the GA tab says there are no GA details yet (not an empty box)', async ({ page }) => {
    await page.route(SHEETS, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY8) }));
    await signIn(page);
    await go(page, 'ga');
    // Today: "GA", the hint, then a bordered card with nothing in it.
    await expect(page.locator('#view .card').first()).not.toBeEmpty();
  });

  test('long lists: Orders and Invoices show 30, Products 40, then "Show all N" shows the rest', async ({ page }) => {
    const n = (k) => Array.from({ length: k }, (_, i) => i + 1);
    const orders = [['order_no', 'source', 'status', 'profit_est', 'check'], ...n(31).map((i) => [String(8000 + i), 'Shopify', 'Placed', '20.00', 'Matched'])];
    const invoices = [['si_no', 'invoice_date', 'order_no', 'total', 'due_date', 'paid_date', 'fy'], ...n(31).map((i) => ['SI-SAMPLE-' + i, '2026-09-' + String((i % 28) + 1).padStart(2, '0'), String(8000 + i), '100.00', '2026-10-01', '2026-10-01', 'FY2026-27'])];
    const products = [['tla', 'range', 'recipe', 'pack', 'ddf_status'], ...n(41).map((i) => ['S' + String(i).padStart(2, '0'), 'Sample range', 'Sample recipe ' + i, '12kg', 'ON SALE (Shopify)'])];
    const body = { valueRanges: [{ values: [] }, { values: orders }, { values: invoices }, { values: products }, { values: [] }, { values: [] }, { values: [] }, { values: [] }] };
    await page.route(SHEETS, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }));
    await signIn(page);
    await expect(page.locator('#view .needs')).toBeVisible();
    for (const [view, first, all, row] of [['orders', 30, 31, '#view .card .row'], ['invoices', 30, 31, '#view .card .row'], ['products', 40, 41, '#view .card .row']]) {
      await go(page, view);
      await expect(page.locator(row), view + ' first page').toHaveCount(first);
      await page.locator('#view [data-action="all"]').click();
      await expect(page.locator(row), view + ' all').toHaveCount(all);
      await expect(page.locator('#view [data-action="all"]')).toHaveCount(0);
    }
  });

  test('keyboard: Tab reaches Refresh, Sign out, ← Dashboard and all five tabs', async ({ page }) => {
    await HUBS.food.open(page);
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    const seen = await tabWalk(page, 40);
    for (const name of ['Refresh', 'Sign out', 'Dashboard home', 'Home', 'Orders', 'Invoices', 'Products', 'GA']) {
      expect(seen.some((s) => s === name || s.startsWith(name)), `Tab reaches ${name}: ${seen.join(' | ')}`).toBe(true);
    }
  });
});
