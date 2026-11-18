const { tabClick, tabTo } = require('../support/tabs');
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

// Record later sheet writes (the hub's pretend Sheets route still answers reads).
async function sheetWrites(page, opts = {}) {
  const writes = [];
  await page.route(SHEETS, (route) => {
    const req = route.request(), url = decodeURIComponent(req.url());
    if (req.method() !== 'PUT' && req.method() !== 'POST') return route.fallback();
    const raw = (/values\/([^?]+)/.exec(url) || [])[1] || '';
    writes.push({ method: req.method(), range: raw.replace(/:append$/, ''), body: JSON.parse(req.postData() || '{}') });
    if (opts.missingComments && req.method() === 'POST' && /Comments/.test(raw)) {
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 400, message: 'Unable to parse range: Comments!A:E' } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  return writes;
}

test.describe('GA Hub (JOB 34)', () => {
  test('Sign out in the header: back to the sign-in card, tabs and Refresh hidden, the button says Sign in again', async ({ page }) => {
    await HUBS.food.open(page);
    // Signed in, the one header button is the Sign out icon: named for screen readers, no words on screen (Lisa's pick A).
    await expect(page.locator('#signin')).toHaveAccessibleName('Sign out');
    await expect(page.locator('#signin')).toHaveText('');
    await page.locator('#signin').click();
    await expect(page.locator('#view h2')).toHaveText('Sign in to see the GA Hub');
    await expect(page.locator('#tabs')).toBeHidden();
    await expect(page.locator('#refresh')).toBeHidden();
    await expect(page.locator('#signin')).toHaveText('Sign in');
    await expect(page.locator('#signin')).toHaveAccessibleName('Sign in');
    await expect(page.locator('#n-home')).toHaveText('');
  });

  test('an unknown address opens Home; the GA Hub title goes Home; ← Dashboard points at the main dashboard', async ({ page }) => {
    await HUBS.food.open(page);
    await go(page, 'nope');
    await expect(page.locator('#view [data-hub-main="food"] [data-hm="needs"]')).toContainText('Needs you');
    await expect(page.locator('nav.tabs a[data-nav="home"]')).toHaveAttribute('aria-current', 'page');
    await go(page, 'ga');
    await page.locator('header h1 a').click();
    await expect(page).toHaveURL(/#\/home$/);
    await expect(page.locator('#view [data-hub-main="food"] [data-hm="needs"]')).toBeVisible();
    await expect(page.locator('#backHome')).toHaveAttribute('href', '../');
  });

  // Hub Mains (Lisa, 2 Nov): Main shows Next and at most 5 Needs you rows, never the answer cards; the cards with Apply live on
  // More > Do, one tap away from the Needs you heading. Moving to a tab and back draws the same short Main again.
  test('Main: Needs you holds at most 5 rows and no answer cards; its heading opens Do with every card; a tab and back keeps Main short', async ({ page }) => {
    await HUBS.food.open(page);
    const needs = page.locator('#view [data-hub-main="food"] [data-hm="needs"]');
    const rows = needs.locator('.hm-row');
    expect(await rows.count()).toBeGreaterThan(0);
    expect(await rows.count()).toBeLessThanOrEqual(5);
    await expect(page.locator('#view [data-ans]')).toHaveCount(0);
    await needs.locator('.hm-head h3 a').click();
    await expect(page).toHaveURL(/#\/do$/);
    await expect(page.locator('#view [data-ans]').first()).toBeVisible();
    await expect(page.locator('#view')).toContainText('Order #9001');
    await expect(page.locator('#view')).toContainText('New GA price list');
    await tabClick(page, 'nav.tabs a[data-nav="orders"]');
    await tabClick(page, 'nav.tabs a[data-nav="home"]');
    await expect(page.locator('#view [data-hub-main="food"]')).toBeVisible();
    await expect(page.locator('#view [data-ans]')).toHaveCount(0);
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
    await expect(page.locator('#view [data-hub-main="food"] [data-hm="needs"] .hm-head .cnt')).toHaveText('3');
  });

  // J34-F60 (fixed in food/index.html).
  test('J34-F60 a save Google refuses says "Not saved" and the button can be tapped again', async ({ page, allowedConsole }) => {
    allowedConsole.push(/status of 500/);
    await HUBS.food.open(page);
    await page.route(SHEETS, (route) => route.request().method() === 'PUT' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : route.fallback());
    await go(page, 'do'); // answer cards live on Do (Main holds no answer cards)
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

  // J34-F61 (fixed in food/index.html).
  test('J34-F61 while the workbook is being read after sign-in, the page says it is reading (not the sign-in card again)', async ({ page }) => {
    await page.route(SHEETS, async (route) => { await new Promise((r) => setTimeout(r, 2500)); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY8) }); });
    await signIn(page);
    await page.waitForTimeout(400);
    // Read once, mid-load (no waiting): today both still say "Sign in" for the whole read, inviting a second sign-in.
    expect(await page.locator('#signin').getAttribute('aria-label'), 'header button mid-read').toBe('Sign out');
    expect(await page.locator('#view').innerText(), 'view mid-read').not.toContain('Sign in to see the GA Hub');
  });

  test('an empty workbook: Orders, Invoices and Products each say so in plain words', async ({ page }) => {
    await page.route(SHEETS, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY8) }));
    await signIn(page);
    // Main says it once, in its own empty card (the 3 numbers stay below it).
    await expect(page.locator('#view [data-hub-main="food"] [data-hm="empty"]')).toContainText('Nothing needs you');
    await expect(page.locator('#view').getByText('Nothing needs you', { exact: true })).toHaveCount(1);
    for (const [view, words] of [['orders', 'No orders yet'], ['invoices', 'No GA invoices yet'], ['products', 'No products here']]) {
      await go(page, view);
      await expect(page.locator('#view .empty', { hasText: words }).first(), view).toBeVisible();
    }
  });

  // J34-F62 (fixed in food/index.html).
  test('J34-F62 an empty Settings tab: the GA tab says there are no GA details yet (not an empty box)', async ({ page }) => {
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
    await expect(page.locator('#view [data-hub-main="food"]')).toBeVisible();
    for (const [view, first, all, row] of [['orders', 30, 31, '#view .card .row'], ['invoices', 30, 31, '#view .card .row'], ['products', 40, 41, '#view .card .row']]) {
      await go(page, view);
      await expect(page.locator(row), view + ' first page').toHaveCount(first);
      await page.locator('#view [data-action="all"]').click();
      await expect(page.locator(row), view + ' all').toHaveCount(all);
      await expect(page.locator('#view [data-action="all"]')).toHaveCount(0);
    }
  });

  test('keyboard: Tab reaches Dashboard, Refresh, Look, Sign out and all five tabs', async ({ page }) => {
    await HUBS.food.open(page);
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    const seen = await tabWalk(page, 40);
    for (const name of ['Dashboard', 'Refresh', 'Look', 'Sign out', 'Main', 'Invoices', 'Orders', 'Products', 'More']) {
      expect(seen.some((s) => s === name || s.startsWith(name)), `Tab reaches ${name}: ${seen.join(' | ')}`).toBe(true);
    }
    // GA sits under More (Lisa's tab picks, 2 Nov): Tab to More, Enter, and it is in the menu.
    expect(await tabTo(page, 'nav.tabs a[data-nav="ga"]', 60), 'Tab reaches GA under More').toBe(true);
  });

  // Card notes (11 Nov 2026). Invented rows only. Who is the pretend signed-in account, never a name in this file.
  test('a note saved with the answer is written in column H (answer, note, time, who)', async ({ page }) => {
    let who = '';
    page.on('response', async (res) => {
      if (!/\/drive\/v3\/about/.test(res.url())) return;
      try { who = ((await res.json()).user || {}).emailAddress || who; } catch (e) { /* unread body */ }
    });
    await HUBS.food.open(page);
    const writes = await sheetWrites(page);
    await go(page, 'do');
    const card = page.locator('#view .card[data-key^="PRICE-"]');
    await card.locator('[data-note]').fill('Sample note');
    await card.locator('button[data-v="Apply"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].range).toBe('Cards!G2:J2');
    expect(writes[0].body.values[0][0]).toBe('Apply');
    expect(writes[0].body.values[0][1]).toBe('Sample note');
    expect(writes[0].body.values[0][2]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(writes[0].body.values[0][3]).toBe(who);
    expect(who).not.toBe('');
    expect(writes.some((w) => /Comments/.test(w.range))).toBe(false);
  });

  test('Save note with no answer appends one Comments row (at, key, title, text, by)', async ({ page }) => {
    let who = '';
    page.on('response', async (res) => {
      if (!/\/drive\/v3\/about/.test(res.url())) return;
      try { who = ((await res.json()).user || {}).emailAddress || who; } catch (e) { /* unread body */ }
    });
    await HUBS.food.open(page);
    const writes = await sheetWrites(page);
    await go(page, 'do');
    const card = page.locator('#view .card[data-key^="PRICE-"]');
    await card.locator('[data-note]').fill('Sample note');
    await card.locator('[data-savenote]').click();
    await expect(page.locator('#banner')).toContainText('Note saved');
    await expect.poll(() => writes.filter((w) => w.method === 'POST').length).toBe(1);
    const row = writes.find((w) => w.method === 'POST').body.values[0];
    expect(writes.find((w) => w.method === 'POST').range).toBe('Comments!A:E');
    expect(row[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(row[1]).toMatch(/^PRICE-/);
    expect(row[2]).toContain('GA price up');
    expect(row[3]).toBe('Sample note');
    expect(row[4]).toBe(who);
    expect(who).not.toBe('');
    expect(writes.some((w) => w.method === 'PUT')).toBe(false);
  });

  test('an empty note writes nothing', async ({ page }) => {
    await HUBS.food.open(page);
    const writes = await sheetWrites(page);
    await go(page, 'do');
    const card = page.locator('#view .card[data-key^="PRICE-"]');
    const save = card.locator('[data-savenote]');
    await expect(save).toBeDisabled();
    await card.locator('[data-note]').fill('   ');
    await expect(save).toBeDisabled();
    await save.click({ force: true });
    await page.waitForTimeout(150);
    expect(writes).toEqual([]);
    await card.locator('[data-note]').fill('');
    await card.locator('button[data-v="Apply"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.values[0][1]).toBe('');
    expect(writes.some((w) => /Comments/.test(w.range))).toBe(false);
  });

  test('a missing Comments tab shows the missing-tab notice and the page stays up', async ({ page, allowedConsole }) => {
    allowedConsole.push(/status of 400/);
    await HUBS.food.open(page);
    const writes = await sheetWrites(page, { missingComments: true });
    await go(page, 'do');
    const card = page.locator('#view .card[data-key^="PRICE-"]');
    await card.locator('[data-note]').fill('Sample note');
    await card.locator('[data-savenote]').click();
    await expect(page.locator('#banner')).toContainText('missing a tab');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-savenote]')).toBeEnabled();
    expect(writes.some((w) => w.method === 'PUT')).toBe(false);
  });
});
