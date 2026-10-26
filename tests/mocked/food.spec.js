// GA Hub page (26 Oct 2026): Needs-you count, one main card, taps write only the 4 answer cells, Undo, tiles, Orders,
// Invoices, Products filters and search, GA details. Pretend Google only; every row below is invented.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'food', 'index.html'), 'utf8');
const SHEETS = /^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\//;
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();

function book() {
  return {
    cards: [
      ['PRICE-AAA0012KZPSXZZZ-32.000', 'price', 'Products', 'Sample Doodle 12kg: GA price up £31.20 → £32.00', JSON.stringify({ why: 'Shop £65.00 → £66.00', red: true }), ago(30)],
      ['LOWPROFIT-9001', 'profit', 'Orders', 'Order #9001: profit £8.00 (under £15)', JSON.stringify({ red: true }), ago(20)],
      ['PL-1', 'pricelist', 'Products', 'New GA price list: sample', JSON.stringify({ files: ['FILE123456789012345678901'] }), ago(10)],
      ['DONE-1', 'check', 'Invoices', 'Already handled', '{}', ago(90), 'Done', '', ago(80), 'sample@example.test', ago(60), 'engine'],
    ],
    orders: [['order_no', 'source', 'brand', 'supplier', 'status', 's_no', 'si_no', 'boxes', 'ga_goods', 'ga_delivery', 'ga_vat', 'ga_total', 'sale_ex_vat_est', 'profit_est'],
      ['9001', 'Shopify', 'DDF', 'GA', 'Invoiced', 'S1000001', 'SI-1000001', '1', '31.20', '10.82', '8.40', '50.42', '52.50', '8.17'],
      ['9002', 'Shopify', 'DDF', 'GA', 'Invoiced', 'S1000002', 'SI-1000002', '2', '111.06', '19.61', '26.14', '156.81', '183.34', '47.22']],
    invoices: [['si_no', 'invoice_date', 's_no', 'order_no', 'goods', 'delivery', 'vat', 'total', 'due_date', 'paid_date', 'fy', 'vat_quarter', 'file_id'],
      ['SI-1000001', '2026-10-25', 'S1000001', '9001', '31.20', '10.82', '8.40', '50.42', '2026-12-06', '', 'FY2026-27', '2026-Q4', 'FILE000000000000000000001'],
      ['SI-1000002', '2026-10-25', 'S1000002', '9002', '130.67', '0', '26.14', '156.81', '2026-12-06', '2026-12-06', 'FY2026-27', '2026-Q4', '']],
    products: [['tla', 'full_ga_code', 'range', 'species', 'life_stage', 'recipe', 'pack', 'pack_kg', 'ga_price_ex_vat_portal_oct26', 'ga_price_ex_vat_list_aug25', 'price_change', 'list_vat_flag', 'in_portal', 'in_price_list', 'chicken_in_name', 'grain', 'ddf_status', 'ddf_name', 'barcode', 'kibble', 'protein_pct', 'fresh_meat_pct', 'shopify', 'shopify_price_inc_vat', 'subscription_price_inc_vat', 'clickfunnels_price_inc_vat', 'puppyclassroom_price_inc_vat', 'profit_ex_vat_1bag_1box'],
      ['AAA', 'AAA0012KZPSXZZZ', 'Grain Free', 'Dog', 'Adult', 'GF Sample Fish', '12kg', '12', '31.20', '31.20', '', 'WD*', 'Y', 'Y', 'N', 'Grain free', 'ON SALE (Shopify)', 'Sample Doodle', '', '', '', '', 'Y', '65', '63', '', '', '8.17'],
      ['BBB', '', 'Grain Free', 'Dog', 'Adult', 'GF Sample Rabbit', '6kg', '6', '21.97', '21.97', '', 'WD*', 'Y', 'Y', 'N', 'Grain free', 'DDF-ELIGIBLE: check data sheet, then list', '', '', '', '', '', 'N', '', '', '', '', ''],
      ['CCC', '', 'Connoisseur Cat', 'Cat', 'Adult', 'Sample Cat Fish', '5kg', '5', '22.55', '', '', '', 'Y', 'N', 'N', 'CHECK', 'CAT range', '', '', '', '', '', 'N', '', '', '', '', '']],
    settings: [['key', 'value', 'note'], ['MIN_PROFIT', '15', ''], ['GA_ACCOUNT_CODE', 'XYZ', ''], ['GA_PHONE_ORDERS', '01234 567890', ''], ['GA_PORTAL', 'https://partners.example.test', ''], ['GA_PAYMENT', 'Direct debit', '']],
  };
}
// Pretend Sheets: batchGet returns the five tabs, single-row reads return the card row, every PUT is recorded.
async function sheets(page, b, opts = {}) {
  const writes = [];
  await page.route(SHEETS, async (route) => {
    const req = route.request(), url = decodeURIComponent(req.url());
    if (req.method() === 'PUT') {
      writes.push({ range: /values\/([^?]+)/.exec(url)[1], body: JSON.parse(req.postData()) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    if (/:batchGet/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valueRanges: [
      { values: b.cards }, { values: b.orders }, { values: b.invoices }, { values: [['COUNT: sample']].concat(b.products).slice(1) }, { values: b.settings }, { values: b.statements || [['statement_date', 'total_outstanding']] }] }) });
    const n = Number(/Cards!A(\d+)/.exec(url)[1]), row = (b.cards[n - 2] || []).slice();
    if (opts.moved) row[0] = 'SOMETHING-ELSE';
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: [row] }) });
  });
  return writes;
}
async function open(page, hash) {
  await page.goto('food/' + (hash || '#/home'));
  await page.locator('#view [data-action="signin"]').click();
  await expect(page.locator('#view .needs')).toBeVisible();
}

test.describe('GA Hub page', () => {
  test('signed out: only a sign-in button, no tabs; signed in: "Needs you: 3", tiles, and one main card (price change first)', async ({ page }) => {
    await sheets(page, book());
    await page.goto('food/');
    await expect(page.locator('#view')).toContainText('Sign in to see the GA Hub');
    await expect(page.locator('#tabs')).toBeHidden();
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#tabs')).toBeVisible();
    await expect(page.locator('#view .needs')).toHaveText('Needs you: 3');
    await expect(page.locator('#n-home')).toHaveText('3');
    await expect(page.locator('#view > .card')).toHaveCount(1);
    await expect(page.locator('#view > .card h2')).toContainText('GA price up');
    await expect(page.locator('#view .tile').first()).toContainText('£50.42');   // owed: the unpaid invoice only
    await expect(page.locator('#view .tiles')).toContainText('06/12/2026');
    await expect(page.locator('#stamp')).toHaveText('TEST');
  });

  test('Apply writes ONLY the 4 answer cells of that row (answer, note, when, who), then Undo clears them', async ({ page }) => {
    const writes = await sheets(page, book());
    await open(page);
    await page.locator('#view > .card button[data-v="Apply"]').click();
    await expect(page.locator('#view .sent')).toContainText('Apply');
    expect(writes).toHaveLength(1);
    expect(writes[0].range).toBe('Cards!G2:J2');
    expect(writes[0].body.values[0][0]).toBe('Apply');
    expect(writes[0].body.values[0][1]).toBe('');
    await page.locator('#view [data-undo]').click();
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[1].body.values[0]).toEqual(['', '', '', '']);
  });

  test('a moved row is not overwritten: the old values go back and the page says refresh', async ({ page }) => {
    const writes = await sheets(page, book(), { moved: true });
    await open(page);
    await page.locator('#view > .card button[data-v="Apply"]').click();
    await expect(page.locator('#banner')).toContainText('the list changed');
    expect(writes).toHaveLength(0);
  });

  test('Orders shows each order with its profit, red when under the minimum', async ({ page }) => {
    await sheets(page, book());
    await open(page, '#/orders');
    await expect(page.locator('#view .row')).toHaveCount(2);
    await expect(page.locator('#view .row').first()).toContainText('#9002');
    await expect(page.locator('#view .row .amt.red')).toHaveText('£8.17');
    await expect(page.locator('nav.tabs a[data-nav="orders"]')).toHaveAttribute('aria-current', 'page');
  });

  test('a GA statement on file: its balance is the Owed figure on Home and the first tile on Invoices', async ({ page }) => {
    const b = book(); b.statements = [['statement_date', 'total_outstanding', 'file_id'], ['2026-10-19', '1234.56', '']];
    await sheets(page, b);
    await open(page);
    await expect(page.locator('#view .tile').first()).toContainText('£1234.56');
    await expect(page.locator('#view .tile').first()).toContainText('statement 19/10/2026');
    await page.goto('food/#/invoices');
    await expect(page.locator('#view .tile').first()).toContainText('GA statement 19/10/2026');
  });

  test('Invoices: owed, unpaid count, the year totals, and a PDF link to Drive', async ({ page }) => {
    await sheets(page, book());
    await open(page, '#/invoices');
    await expect(page.locator('#view .tile').nth(0)).toContainText('£50.42');
    await expect(page.locator('#view .tile').nth(1)).toContainText('1');
    await expect(page.locator('#view .tiles')).toContainText('Direct debit');
    await expect(page.locator('#view a[aria-label="Open SI-1000001"]')).toHaveAttribute('href', 'https://drive.google.com/file/d/FILE000000000000000000001/view');
  });

  test('Products: filter chips and search', async ({ page }) => {
    await sheets(page, book());
    await open(page, '#/products');
    await expect(page.locator('#view .row')).toHaveCount(1);   // On sale
    await expect(page.locator('#view .row')).toContainText('Sample Doodle');
    await page.locator('[data-filter="eligible"]').click();
    await expect(page.locator('#view .row')).toContainText('GF Sample Rabbit');
    await page.locator('[data-filter="all"]').click();
    await expect(page.locator('#view .row')).toHaveCount(3);
    await page.locator('[data-find]').fill('cat');
    await expect(page.locator('#view .row')).toHaveCount(1);
    await expect(page.locator('[data-find]')).toBeFocused();
  });

  test('GA tab: account code has Copy, phone numbers are tap-to-call', async ({ page }) => {
    await sheets(page, book());
    await open(page, '#/ga');
    await expect(page.locator('#view button[data-copy="XYZ"]')).toBeVisible();
    await expect(page.locator('#view a[href="tel:01234567890"]')).toBeVisible();
  });

  test('colours come only from tokens.css, and the page fits a phone with no sideways scroll', async ({ page }) => {
    const style = /<style>([\s\S]*?)<\/style>/.exec(SRC)[1];
    expect(style).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    await page.setViewportSize({ width: 360, height: 780 });
    await sheets(page, book());
    await open(page, '#/products');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over).toBeLessThanOrEqual(0);
  });
});
