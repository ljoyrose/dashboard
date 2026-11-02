// JOB 34b (Marketplace): phone width and keyboard reach on the screens tests/phone and job34-marketplace-states do not
// visit (packing, label sheet, drop-off code window, Stock, Temu, Suppliers, a section list), the phone's one Filter
// button, and doing the main jobs with the keyboard alone. Pretend Google and Sheets only; every row is invented.
const { test, expect, go, sheets, sideScroll, SHEETS } = require('../fixtures/job34/load');

const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const ROWS = [
  ['PO|1', 'post', 'Clothes', 'Sample jumper with a long title that wraps onto a second line on a phone', JSON.stringify({ platform: 'ebay', parcel_id: 'L-07', courier: 'InPost', shelf: 'B2', post_by: '2026-10-20', found: true, qr: 'VN-SAMPLE-LONGCODE-0001' }), ago(5)],
  ['PO|2', 'post', 'Clothes', 'Sample lead', JSON.stringify({ platform: 'vinted', owner: 'CY', parcel_id: 'L-08', courier: 'Evri', shelf: 'A1' }), ago(5)],
  ['RM|1', 'remove', 'Clothes', 'Sample cap', JSON.stringify({ platform: 'Vinted', url: 'https://www.vinted.co.uk/items/2' }), ago(5)],
  ['RM|2', 'remove', 'Clothes', 'Sample bow', JSON.stringify({ platform: 'eBay', url: 'https://www.ebay.co.uk/itm/123456' }), ago(5)],
  ['GO|1', 'go', 'Treats', 'Sample biscuits', JSON.stringify({ price: '£12.00' }), ago(5)],
  ['ST|1', 'stock', 'Clothes', 'Sample collar', JSON.stringify({ item_sku: 'SKU-SAMPLE-1', have: 1, low: true, listings: 1, shelf: 'A1' }), ago(5)],
  ['RS|1', 'restock', 'Treats', 'Sample chews', JSON.stringify({ url: 'https://www.temu.com/sample-g-2.html', last_cost: '£2.00', buy: 4, buy_now: true }), ago(5)],
  ['SP|1', 'suppliers', '', 'Sample Supplies Ltd', JSON.stringify({ account_no: 'AC-0001', phone: '01632 960000', min_order: 100 }), ago(5)],
  ['KPI', 'kpi', '', 'Numbers', JSON.stringify({ tiles: [{ key: 'sold', label: 'Sold this month', value: 4, arrow: 'up' }], byCategory: [{ category: 'Clothes', sold: 4, profit_p: 10000 }] }), ago(5)],
  ['RD|1', 'round', 'Clothes', 'Sample harness', JSON.stringify({ shelf: 'A1', expected: 2, item_sku: 'SKU-SAMPLE-2' }), ago(5)],
];

async function book(page, rows = ROWS) {
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
const focused = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('aria-label') || a.textContent || '').trim() : ''; });
// Press Tab until focus lands on `sel` (inside #view or #qr); fails if it never does.
async function tabTo(page, sel, max = 60) {
  for (let i = 0; i < max; i++) {
    if (await page.evaluate((s) => document.activeElement && document.activeElement.matches(s), sel)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Tab never reached ' + sel);
}

test.describe('Marketplace (JOB 34b): phone 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('no sideways scroll on packing, the label sheet, the drop-off code window, a section list, Stock, Temu, Suppliers and Numbers', async ({ page }) => {
    await book(page);
    await open(page, '#/do');
    const wide = [];
    const check = async (name) => { if (await sideScroll(page)) wide.push(name); };
    await page.locator('#view [data-action="pack"]').click();
    await expect(page.locator('#view .packbar')).toBeVisible();
    await check('packing');
    await page.locator('#view [data-action="nextpack"]').click();
    await page.locator('#view [data-qr="PO|1"]').click();
    await expect(page.locator('#qr')).toBeVisible();
    await check('drop-off code window');
    await page.locator('#qr [data-action="closeqr"]').click();
    await page.locator('#view [data-action="stoppack"]').click();
    await page.locator('#view [data-action="sheet"]').click();
    await expect(page.locator('#view .packbar')).toContainText('Label sheet');
    await check('label sheet');
    for (const v of ['remove', 'stock', 'temu', 'suppliers', 'numbers', 'insights']) {
      await go(page, v);
      if (await page.locator('#view [data-action="all"]').count()) await page.locator('#view [data-action="all"]').click();
      if (v === 'stock') await page.locator('#view details summary').first().click();
      await check(v);
    }
    expect(wide).toEqual([]);
  });

  test('the one Filter button at the top of the page opens and shuts the person and site chips, and counts the filters that are on', async ({ page }) => {
    await book(page);
    await open(page, '#/do');
    // The people row left the 56px top bar (Lisa's pick A): its Filter button sits at the top of the page, above the cards.
    await expect(page.locator('header .house-fbtn, header #people')).toHaveCount(0);
    const btn = page.locator('main .house-fbtn');
    await expect(btn).toBeVisible();
    expect((await btn.boundingBox()).y, 'top of the page').toBeLessThan((await page.locator('#view').boundingBox()).y);
    await expect(page.locator('#people')).toBeHidden();
    await expect(page.locator('#sitef')).toBeHidden();
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#people')).toBeVisible();
    await expect(page.locator('#sitef')).toBeVisible();
    await page.locator('[data-who="CY"]').click();
    await expect(page.locator('#whoN')).toHaveText('1');
    await expect(page.locator('#people')).toBeVisible();                 // stays open while the page redraws
    await page.locator('#sitef [data-site="Vinted"]').click();
    await expect(page.locator('#whoN')).toHaveText('2');
    await expect(page.locator('#view .needs')).toHaveText('Do now: 1');
    expect(await sideScroll(page), 'filters open').toBe(false);
    await btn.click();
    await expect(page.locator('#people')).toBeHidden();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('Marketplace (JOB 34b): keyboard only', () => {
  test('Decide: Tab reaches Go, Enter saves it; Tab reaches Undo in Just done, Enter clears the answer', async ({ page }) => {
    const writes = await book(page);
    await open(page, '#/decide');
    await page.locator('#view .needs').click();
    await tabTo(page, '[data-ans="GO|1"][data-v="Yes"]');
    await page.keyboard.press('Enter');
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].values[0]).toBe('Yes');
    await expect(page.locator('#view details.justdone')).toBeVisible();
    await page.locator('#view .needs').click();
    await tabTo(page, 'details.justdone > summary');
    await page.keyboard.press('Enter');
    await tabTo(page, '[data-undo="GO|1"]');
    await page.keyboard.press('Enter');
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[1].values).toEqual(['', '', '', '']);
  });

  test('drop-off code: Enter on Show QR opens the window; Tab reaches its Close and Enter shuts it', async ({ page }) => {
    await book(page);
    await open(page, '#/do');
    await page.locator('#view .needs').click();
    await tabTo(page, '[data-qr="PO|1"]');
    await page.keyboard.press('Enter');
    await expect(page.locator('#qr')).toBeVisible();
    await tabTo(page, '#qr [data-action="closeqr"]', 80);
    await page.keyboard.press('Enter');
    await expect(page.locator('#qr')).toBeHidden();
  });

  // FIX-REQUEST J34b-F41 (marketplace/index.html:902-903; #qr at :244 is role="dialog" but focus stays behind it).
  // DECISION NEEDED: fix the page (move focus to Close on open, Escape shuts, focus back to Show QR) or accept. OWNER: Marketplace owner. BY 2026-11-06
  test.fixme('J34b-F41 drop-off code window takes the keyboard: focus moves into it on open and Escape shuts it', async ({ page }) => {
    await book(page);
    await open(page, '#/do');
    await page.locator('#view .needs').click();
    await tabTo(page, '[data-qr="PO|1"]');
    await page.keyboard.press('Enter');
    await expect(page.locator('#qr')).toBeVisible();
    expect(await page.evaluate(() => !!document.activeElement.closest('#qr')), 'focus is in the window').toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#qr')).toBeHidden();
  });

  test('Numbers: Space on a tile opens its breakdown and Space again shuts it', async ({ page }) => {
    await book(page);
    await open(page, '#/numbers');
    await page.locator('#view .needs').click();
    await tabTo(page, '[data-tile="sold"]');
    await page.keyboard.press('Space');
    await expect(page.locator('#view .card .row')).toHaveText([/Clothes\s*4/]);
    await page.locator('#view [data-tile="sold"]').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#view .card .row')).toHaveCount(0);
  });

  test('Stock round: Tab reaches the ✓, the count box and Finish round, and the keyboard alone saves the round', async ({ page }) => {
    const writes = await book(page);
    await open(page, '#/round');
    await page.locator('#view .needs').click();
    await tabTo(page, '[data-tick="RD|1"]');
    expect(await focused(page)).toBe('Right');
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.getAttribute('data-count'))).toBe('RD|1');
    await page.locator('#view .needs').click();
    await tabTo(page, '[data-tick="RD|1"]');
    await page.keyboard.press('Enter');
    await tabTo(page, '[data-action="finish"]');
    await page.keyboard.press('Enter');
    await expect(page.locator('#banner')).toContainText('Round saved.');
    expect(writes.map((w) => w.values[0])).toEqual(['ok']);
  });
});
