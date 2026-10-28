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
    orders: [['order_no', 'source', 'brand', 'supplier', 'status', 's_no', 'si_no', 'boxes', 'ga_goods', 'ga_delivery', 'ga_vat', 'ga_total', 'sale_ex_vat_est', 'profit_est', 'shipped_date', 'invoice_date', 'due_date', 'paid', 'notes', 'updated_at', 'tracking', 'order_type', 'sale_inc_vat', 'customer_orders', 'placed_at', 'shop_lines', 'check'],
      ['9001', 'Shopify', 'DDF', 'GA', 'Invoiced', 'S1000001', 'SI-1000001', '1', '31.20', '10.82', '8.40', '50.42', '52.50', '8.17', '', '', '', '', '', '', 'https://www.dpd.co.uk/service/tracking?postcode=AA11AA&sendersRef=S1000001', 'Subscription (PayWhirl)', '63.00', '22', '2026-10-22T09:00:00Z', '[]', 'Matched'],
      ['9002', 'Shopify', 'DDF', 'GA', 'Invoiced', 'S1000002', 'SI-1000002', '2', '111.06', '19.61', '26.14', '156.81', '183.34', '47.22', '', '', '', '', '', '', '', '', '', '', '', '', 'Items differ'],
      ['9003', 'Shopify', 'DDF', 'GA', 'Placed', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'One-off (Online Store)', '70.00', '3', '2026-10-20T09:00:00Z', '[]', 'Not at GA'],
      ['9005', 'Shopify', 'DDF', 'GA', 'At GA', 'S1000005', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'One-off (Online Store)', '70.00', '2', '2026-10-26T08:00:00Z', '[]', 'At GA'],
      ['9004', 'Shopify', 'DDF', 'GA', 'Placed', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'One-off (Online Store)', '55.00', '1', '2026-10-26T09:00:00Z', '[]', 'Waiting for GA']],
    invoices: [['si_no', 'invoice_date', 's_no', 'order_no', 'goods', 'delivery', 'vat', 'total', 'due_date', 'paid_date', 'fy', 'vat_quarter', 'file_id'],
      ['SI-1000001', '2026-10-25', 'S1000001', '9001', '31.20', '10.82', '8.40', '50.42', '2026-12-06', '', 'FY2026-27', '2026-Q4', 'FILE000000000000000000001'],
      ['SI-1000002', '2026-10-25', 'S1000002', '9002', '130.67', '0', '26.14', '156.81', '2026-12-06', '2026-12-06', 'FY2026-27', '2026-Q4', '']],
    products: [['tla', 'full_ga_code', 'range', 'species', 'life_stage', 'recipe', 'pack', 'pack_kg', 'ga_price_ex_vat_portal_oct26', 'ga_price_ex_vat_list_aug25', 'price_change', 'list_vat_flag', 'in_portal', 'in_price_list', 'chicken_in_name', 'grain', 'ddf_status', 'ddf_name', 'barcode', 'kibble', 'protein_pct', 'fresh_meat_pct', 'shopify', 'shopify_price_inc_vat', 'subscription_price_inc_vat', 'clickfunnels_price_inc_vat', 'puppyclassroom_price_inc_vat', 'profit_ex_vat_1bag_1box'],
      ['AAA', 'AAA0012KZPSXZZZ', 'Grain Free', 'Dog', 'Adult', 'GF Sample Fish', '12kg', '12', '31.20', '31.20', '', 'WD*', 'Y', 'Y', 'N', 'Grain free', 'ON SALE (Shopify)', 'Sample Doodle', '', '', '', '', 'Y', '65', '63', '', '', '8.17'],
      ['BBB', '', 'Grain Free', 'Dog', 'Adult', 'GF Sample Rabbit', '6kg', '6', '21.97', '21.97', '', 'WD*', 'Y', 'Y', 'N', 'Grain free', 'DDF-ELIGIBLE: check data sheet, then list', '', '', '', '', '', 'N', '', '', '', '', ''],
      ['CCC', '', 'Connoisseur Cat', 'Cat', 'Adult', 'Sample Cat Fish', '5kg', '5', '22.55', '', '', '', 'Y', 'N', 'N', 'CHECK', 'CAT range', '', '', '', '', '', 'N', '', '', '', '', '']],
    settings: [['key', 'value', 'note'], ['MIN_PROFIT', '15', ''], ['GA_ACCOUNT_CODE', 'XYZ', ''], ['GA_PHONE_ORDERS', '01234 567890', ''], ['GA_PORTAL', 'https://partners.example.test', ''], ['GA_PAYMENT', 'Direct debit', ''], ['SHOPIFY_STORE', 'samplestore', ''], ['GA_ORDER_TO', 'orders@example.test', ''], ['GA_XML_CONTACT', 'Sample Person, sample.person@example.test', '']],
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
      { values: b.cards }, { values: b.orders }, { values: b.invoices }, { values: [['COUNT: sample']].concat(b.products).slice(1) }, { values: b.settings }, { values: b.statements || [['statement_date', 'total_outstanding']] }, { values: b.dds || [['date', 'amount']] }, { values: b.codes || [['kind', 'code', 'name']] }] }) });
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
    await expect(page.locator('#view .row')).toHaveCount(5);
    await expect(page.locator('#view .row').first()).toContainText('#9005');
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

  test('Orders: subscription or one-off, where from, and Track (DPD) / Shopify buttons; the low-profit card shows the same', async ({ page }) => {
    await sheets(page, book());
    await open(page, '#/orders');
    const row = page.locator('#view .row', { hasText: '#9001' });
    await expect(row).toContainText('🔁 Subscription (PayWhirl) · Shopify · DDF · customer\'s 22nd order');
    await expect(row.locator('a', { hasText: 'Track' })).toHaveAttribute('href', 'https://www.dpd.co.uk/service/tracking?postcode=AA11AA&sendersRef=S1000001');
    await expect(row.locator('a', { hasText: 'Shopify' })).toHaveAttribute('href', 'https://admin.shopify.com/store/samplestore/orders?query=9001');
    await expect(page.locator('#view .row', { hasText: '#9002' }).locator('a', { hasText: 'Track' })).toHaveCount(0);   // no tracking link yet
    await page.goto('food/#/home');
    await page.locator('#view .more').click();
    await expect(page.locator('#view .card', { hasText: 'Order #9001' })).toContainText('Subscription (PayWhirl)');
  });

  test('Products: grouped by range with a count, picture badges (who for, grain, chicken, meat, protein), a data sheet link when there is one', async ({ page }) => {
    const b = book(); b.products[0].push('margin_pct_of_net', 'data_sheet_url'); b.products[1].push('', 'https://example.test/sheet.pdf');
    b.products[2][14] = 'Y'; b.products[2][20] = '0.28'; b.products[2][21] = '60';
    await sheets(page, b);
    await open(page, '#/products');
    await page.locator('[data-filter="all"]').click();
    await expect(page.locator('#view .grp')).toHaveText(['Grain Free · 2', 'Connoisseur Cat · 1']);
    const rabbit = page.locator('#view .row', { hasText: 'GF Sample Rabbit' });
    await expect(rabbit.locator('.badge')).toHaveText(['🐶 Adult', '🌾🚫 Grain free', '🐔 Chicken', '🥩 60% meat', '💪 28% protein']);
    await expect(rabbit.locator('.badge.no')).toHaveText('🐔 Chicken');
    await expect(page.locator('#view .row', { hasText: 'Sample Cat Fish' }).locator('.badge')).toHaveText(['🐱 Adult', '🌾 Grain: check']);
    await expect(page.locator('#view .row', { hasText: 'Sample Doodle' }).locator('a', { hasText: 'Data sheet' })).toHaveAttribute('href', 'https://example.test/sheet.pdf');
  });

  test('spacing: tiles, cards and headings in the view never touch (same 14px gap as the main column)', async ({ page }) => {
    await sheets(page, book());
    await open(page);
    const gap = await page.evaluate(() => { const t = document.querySelector('#view .tiles').getBoundingClientRect(), c = document.querySelector('#view > .card').getBoundingClientRect(); return c.top - t.bottom; });
    expect(gap).toBeGreaterThanOrEqual(12);
  });

  test('order check: every order shows if it reached GA; Home counts the ones not at GA (late in red); filters; a missing order card has a Portal button', async ({ page }) => {
    const b = book(); b.cards.push(['MISSING-9003', 'check', 'Orders', 'Order #9003: not shipped by GA', JSON.stringify({ red: true }), ago(5)]);
    await sheets(page, b);
    await open(page);
    await expect(page.locator('#view a.tile[href="#/orders?check"]')).toContainText('2 (1 late)');
    await expect(page.locator('#view a.tile[href="#/orders?check"] .v')).toHaveClass(/red/);
    await page.locator('#view .more').click();
    const card = page.locator('#view .card', { hasText: 'Order #9003' });
    await expect(card.locator('a', { hasText: 'GA Portal' })).toHaveAttribute('href', 'https://partners.example.test');
    await page.goto('food/#/orders');
    await expect(page.locator('#view .row', { hasText: '#9001' }).locator('.badge')).toHaveText('✅ Matched with GA');
    await expect(page.locator('#view .row', { hasText: '#9002' }).locator('.badge.no')).toHaveText('⚠️ GA sent different items');
    await expect(page.locator('#view .row', { hasText: '#9003' }).locator('.badge.no')).toHaveText('❌ Not at GA: check the Portal');
    await expect(page.locator('#view .row', { hasText: '#9005' }).locator('.badge')).toHaveText('📥 At GA (confirmed)');
    await page.locator('[data-ofilter="check"]').click();
    await expect(page.locator('#view .row')).toHaveCount(2);   // the two red ones
    await page.locator('[data-ofilter="ga"]').click();
    await expect(page.locator('#view .row')).toHaveCount(2);   // waiting + late
    await page.locator('[data-ofilter="sub"]').click();
    await expect(page.locator('#view .row')).toHaveCount(1);
  });

  test('order codes: a partner shows by name (or its type), a resend shows as a replacement, and the GA tab lists the codes to type on the Portal', async ({ page }) => {
    const b = book();
    b.orders[0].push('tracking_sent', 'partner'); b.orders[1].push('', 'B07');
    b.orders.push(['9001-R1', 'Shopify', 'DDF', 'GA', 'Shipped', 'S1000009', '', '1', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Replacement']);
    b.codes = [['kind', 'code', 'name', 'discount_codes', 'notes', 'active'], ['brand', 'DDF', 'Designer Dog Foods', '', '', 'Y'], ['channel', 'CF', 'ClickFunnels', '', '', 'Y'],
      ['partner_type', 'B', 'Breeder or breeder club', '', '', 'Y'], ['partner_type', 'R', 'Reseller', '', '', 'Y'], ['partner', 'R01', 'Sample Pet Shop', '', '', 'Y'], ['channel', 'ZZ', 'Old shop', '', '', 'N']];
    await sheets(page, b);
    await open(page, '#/orders');
    await expect(page.locator('#view .row', { hasText: '#9001 ' }).first()).toContainText('🤝 Breeder or breeder club 07');
    await expect(page.locator('#view .row', { hasText: '#9001-R1' }).locator('.badge')).toHaveText('🔁 Replacement, sent again');
    await page.goto('food/#/ga');
    const codes = page.locator('#view .card', { hasText: 'BRAND-CODE-NUMBER' });
    await expect(codes).toContainText('DDF Designer Dog Foods');
    await expect(codes).toContainText('Customers see this reference');
    await expect(codes).toContainText('R01 Sample Pet Shop');
    await expect(codes).not.toContainText('Old shop');   // inactive codes are hidden
  });

  test('a "Send to GA?" card: Send writes only the 4 answer cells with the answer "Send"', async ({ page }) => {
    const b = book(); b.cards = [['SEND-9100', 'send', 'Orders', 'Send order #9100 to GA?', JSON.stringify({ why: '1 x AAA0012KZPSXZZZ' }), ago(5)]];
    const writes = await sheets(page, b);
    await open(page);
    await expect(page.locator('#view > .card h2')).toHaveText('Send order #9100 to GA?');
    await page.locator('#view > .card button[data-v="Send"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].range).toBe('Cards!G2:J2');
    expect(writes[0].body.values[0][0]).toBe('Send');
  });

  test('Invoices: the newest GA direct debit from the bank shows as a tile (with its date)', async ({ page }) => {
    const b = book(); b.dds = [['date', 'amount', 'bank_ref', 'invoices_paid'], ['2026-10-07', '529.37', 'GA PETFOOD DDL', ''], ['2026-10-14', '512.46', 'GA PETFOOD DDL', 'SI-1000001']];
    await sheets(page, b);
    await open(page, '#/invoices');
    await expect(page.locator('#view .tiles')).toContainText('Last GA direct debit 14/10/2026');
    await expect(page.locator('#view .tiles')).toContainText('£512.46');
    await expect(page.locator('#view .tiles')).toContainText('£1041.83');   // both are in this financial year
  });

  test('GA tab: account code has Copy, phone numbers are tap-to-call', async ({ page }) => {
    await sheets(page, book());
    await open(page, '#/ga');
    await expect(page.locator('#view button[data-copy="XYZ"]')).toBeVisible();
    await expect(page.locator('#view a[href="tel:01234567890"]')).toBeVisible();
    await expect(page.locator('#view a[href="mailto:orders@example.test"]')).toBeVisible();
    await expect(page.locator('#view .row', { hasText: 'XML contact' }).locator('a[href="mailto:sample.person@example.test"]')).toBeVisible();
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


// A computed colour as [r, g, b, a] (0-255), from rgb()/rgba() or color(srgb ...).
function rgbOf(s) { const m = /\(srgb ([^)]+)\)|\(([^)]+)\)/.exec(s), v = (m[1] || m[2]).split(/[ ,/]+/).filter(Boolean).map(Number), k = m[1] ? 255 : 1; return [v[0] * k, v[1] * k, v[2] * k, v[3] === undefined ? 1 : v[3]]; }
// A pale tint: opaque, not plain white/black, light in light mode and dark in dark mode (mixed into the card), never a solid colour.
function isTint(s, scheme) { const c = rgbOf(s), avg = (c[0] + c[1] + c[2]) / 3; if (c[3] < 0.5) return false;
  if (Math.min(c[0], c[1], c[2]) >= 252) return false;   // white
  return scheme === 'dark' ? avg > 20 && avg < 110 : avg > 200 && avg < 252; }
// House look (LINKS-COMFORT-BRIEF v3 + Lisa's control rules, 28 Oct 2026), checked by computed style in the browser.
// audit() walks every visible element and returns plain-English problems; each test below asserts its own kind.
const TABS = ['home', 'orders', 'invoices', 'products', 'ga'];
function audit() {
  const rgb = (s) => { let m = /^rgba?\(([^)]+)\)/.exec(s); if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] === undefined ? 1 : p[3]]; }
    m = /^color\(srgb ([^)]+)\)/.exec(s); if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] === undefined ? 1 : p[3]]; } return null; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => { for (let a = el; a; a = a.parentElement) { const c = rgb(getComputedStyle(a).backgroundColor); if (c && c[3] > 0.5) return c; } return [255, 255, 255, 1]; };
  const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && el.className.baseVal === undefined ? '.' + String(el.className).trim().split(/\s+/).join('.') : '') + ' "' + (el.textContent || '').trim().slice(0, 24) + '"';
  const seen = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); if (r.width <= 1 || r.height <= 1 || s.visibility !== 'visible' || s.display === 'none') return false; for (let a = el; a && a !== document.body; a = a.parentElement) { const ar = a.getBoundingClientRect(); if (ar.width <= 1 || ar.height <= 1) return false; } return true; };
  const out = { small: [], weight: [], upper: [], colour: [], radius: [], line: [], text: [], ring: [] };
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg') || /^(SCRIPT|STYLE)$/.test(el.tagName) || !seen(el)) continue;
    const s = getComputedStyle(el), own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own) {
      if (parseFloat(s.fontSize) < 13) out.small.push(name(el) + ' ' + s.fontSize);
      if (!['400', '600'].includes(s.fontWeight)) out.weight.push(name(el) + ' ' + s.fontWeight);
      if (s.textTransform === 'uppercase') out.upper.push(name(el));
      const c = rgb(s.color); if (c && Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) > 40) out.colour.push(name(el) + ' ' + s.color);
      const btn = el.closest('button, .btn'); if (!(btn && btn.disabled)) { const r = ratio(c, bgOf(el)); if (r < 4.5) out.text.push(name(el) + ' ' + r.toFixed(2)); }
    }
    const bw = ['Top', 'Right', 'Bottom', 'Left'].map((k) => parseFloat(s['border' + k + 'Width']) || 0);
    if (Math.max(...bw) > 1) out.line.push(name(el) + ' ' + bw.join('/'));
    const rad = s.borderTopLeftRadius;
    const pill = el.matches('.cnt, nav.tabs .n');   // count pills: 22px high with full round ends (11px)
    if (rad !== '0px' && !(rad === '12px' && !pill) && !(rad === '11px' && pill) && !(rad === '50%' && el.classList.contains('dot'))) out.radius.push(name(el) + ' ' + rad);
    // Rings on things you press or read as a pill: 3:1 against what they sit on.
    if (el.matches('button:not([disabled]), .btn, .chip, .more, a.tile, input, .badge, .datep, .cnt, nav.tabs .n, .stamp, .row .amt.red, .row .amt.good') && bw[0] === 1) {
      const r = ratio(rgb(s.borderTopColor), bgOf(el.parentElement)); if (r < 3) out.ring.push(name(el) + ' ' + r.toFixed(2));
    }
  }
  return out;
}

test.describe('GA Hub house look', () => {
  for (const look of ['warm', 'cool']) for (const scheme of ['light', 'dark']) {
    test(`${look} ${scheme}: nothing under 13px, weights 400/600 only, one 12px radius (circles only for dots), 1px lines, no uppercase, no coloured words, text 4.5:1 and rings 3:1`, async ({ page }) => {
      await page.addInitScript((bg) => localStorage.setItem('dash-look', JSON.stringify({ bg })), look);
      await page.emulateMedia({ colorScheme: scheme });
      await sheets(page, book());
      await open(page);
      await expect(page.locator('html')).toHaveClass(look === 'cool' ? /look-cool/ : /^(?!.*look-cool)/);
      for (const tab of TABS) {
        await page.goto('food/#/' + tab);
        await expect(page.locator(`nav.tabs a[data-nav="${tab}"]`)).toHaveAttribute('aria-current', 'page');
        if (tab === 'products') await page.locator('[data-filter="all"]').click();
        const a = await page.evaluate(audit);
        for (const k of Object.keys(a)) expect(a[k], `${look} ${scheme} #/${tab}: ${k}`).toEqual([]);
      }
    });
  }

  test('Cool clear: the page and the frame take the cool family; Warm clear is the default', async ({ page }) => {
    await sheets(page, book());
    await open(page);
    const warm = await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.querySelector('header')).backgroundColor]);
    await page.evaluate(() => localStorage.setItem('dash-look', JSON.stringify({ bg: 'cool' })));
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/look-cool/);
    const cool = await page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.querySelector('header')).backgroundColor]);
    const blue = (s) => { const p = /\(srgb ([^)]+)\)|\(([^)]+)\)/.exec(s); const v = (p[1] || p[2]).split(/[ ,]+/).map(Number); return v[2] - v[0]; };
    expect(blue(warm[0])).toBeLessThan(0); expect(blue(warm[1])).toBeLessThan(0.0001);   // warm: red over blue
    expect(blue(cool[0])).toBeGreaterThan(0); expect(blue(cool[1])).toBeGreaterThan(0);  // cool: blue over red
  });

  test('controls: every one rests on the same clear 1px line (never ink), 12px corners, 14px/600, 36px tall; hover = 1px line inside + a pale tint (ink + muted tint when neutral) and nothing moves', async ({ page }) => {
    await sheets(page, book());
    await open(page);
    for (const tab of ['home', 'orders', 'products', 'ga']) {
      await page.goto('food/#/' + tab);
      await expect(page.locator(`nav.tabs a[data-nav="${tab}"]`)).toHaveAttribute('aria-current', 'page');
      const ctls = page.locator('#view button:visible, #view a.btn:visible, #view .chip:visible, #view a.tile:visible');
      const n = await ctls.count();
      expect(n).toBeGreaterThan(0);
      const ink = await page.evaluate(() => getComputedStyle(document.body).color);
      const lines = new Set();
      for (let i = 0; i < n; i++) {
        const el = ctls.nth(i);
        const st = await el.evaluate((e) => { const s = getComputedStyle(e); return { w: s.borderTopWidth, c: s.borderTopColor, r: s.borderTopLeftRadius, fs: s.fontSize, fw: s.fontWeight, h: e.getBoundingClientRect().height, tile: e.classList.contains('tile'), pressed: e.getAttribute('aria-pressed') === 'true' }; });
        expect(st.w).toBe('1px'); expect(st.r).toBe('12px'); expect(st.c).not.toBe(ink); expect(st.h).toBeGreaterThanOrEqual(36);
        if (!st.tile) { expect(st.fs).toBe('14px'); expect(st.fw).toBe('600'); }
        lines.add(st.c);
        await el.scrollIntoViewIfNeeded();
        const before = await el.boundingBox();
        await el.hover();
        const hv = await el.evaluate((e) => { const s = getComputedStyle(e); return { ow: s.outlineWidth, os: s.outlineStyle, oo: s.outlineOffset, oc: s.outlineColor, bw: s.borderTopWidth, coloured: e.matches('.yes, .no'), bg: s.backgroundColor, card: getComputedStyle(e.closest('.card, #view')).backgroundColor }; });
        expect({ ow: hv.ow, os: hv.os, oo: hv.oo, bw: hv.bw }).toEqual({ ow: '1px', os: 'solid', oo: '-1px', bw: '1px' });
        if (hv.coloured) expect(hv.oc).not.toBe(ink); else expect(hv.oc).toBe(ink);
        expect(isTint(hv.bg, 'light'), `${tab}: hover fill ${hv.bg}`).toBe(true);
        const after = await el.boundingBox();
        expect(after).toEqual(before);
      }
      expect([...lines], `#/${tab}: one control line`).toHaveLength(1);
    }
  });

  test('read-only pills (counts, badges, date pills, amounts) have no hover; the bottom tabs have no ring, only the colour bar widens', async ({ page }) => {
    const b = book(); b.invoices[1][8] = '2026-01-01';   // an unpaid invoice that is long overdue
    await sheets(page, b);
    await open(page, '#/invoices');
    const pill = page.locator('#view .datep').first();
    await expect(pill).toHaveClass(/late/);
    await pill.hover();
    expect(await pill.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('none');
    await page.goto('food/#/orders');
    for (const sel of ['#view .badge', '#view .amt.red', 'nav.tabs .n.need']) {
      const el = page.locator(sel).first();
      await el.hover();
      expect(await el.evaluate((e) => getComputedStyle(e).outlineStyle), sel).toBe('none');
    }
    const tab = page.locator('nav.tabs a[data-nav="invoices"]');
    const before = await tab.boundingBox();
    await tab.hover();
    await expect.poll(() => tab.locator('.bar').evaluate((e) => e.getBoundingClientRect().width)).toBe(40);
    expect(await tab.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe('none');
    expect(await page.locator('nav.tabs a[aria-current="page"]').evaluate((e) => getComputedStyle(e).outlineStyle), 'current tab').toBe('none');
    expect(await tab.boundingBox()).toEqual(before);
  });

  for (const scheme of ['light', 'dark']) {
    test(`${scheme}: meaning-coloured controls (Apply, Not now) keep their OWN colour on hover: own-colour 1px line inside + a pale tint, never ink (tabs are exempt)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await sheets(page, book());
      await open(page);
      const ink = await page.evaluate(() => getComputedStyle(document.body).color);
      const look = (el) => el.evaluate((e) => { const s = getComputedStyle(e), own = s.getPropertyValue('--mc').trim();
        const probe = document.createElement('i'); probe.style.color = own; e.appendChild(probe); const oc = getComputedStyle(probe).color; probe.remove();
        return { ow: s.outlineWidth, os: s.outlineStyle, oo: s.outlineOffset, oc: s.outlineColor, own: oc, bg: s.backgroundColor }; });
      const check = (l, what) => {
        expect({ ow: l.ow, os: l.os, oo: l.oo }, what).toEqual({ ow: '1px', os: 'solid', oo: '-1px' });
        expect(l.oc, what + ': line is not ink').not.toBe(ink);
        expect(l.oc, what + ': line is its own colour').toBe(l.own);
        expect(l.bg, what + ': not a solid fill of its colour').not.toBe(l.oc);
        expect(isTint(l.bg, scheme), `${what}: fill ${l.bg} is a pale tint`).toBe(true);
      };
      for (const v of ['Apply', 'Not now']) {
        const b = page.locator(`#view > .card button[data-v="${v}"]`);
        await b.hover(); check(await look(b), v);
      }
    });
  }

  test('count pills are one fixed size: 30 x 22px for 1 and 2 digits, centred, round ends', async ({ page }) => {
    const b = book(); for (let i = 0; i < 10; i++) b.cards.push(['CHK-' + i, 'check', 'Orders', 'Sample check ' + i, '{}', ago(1)]);
    await sheets(page, b);
    await open(page, '#/products');
    await page.locator('[data-filter="all"]').click();
    const measure = () => page.evaluate(() => [...document.querySelectorAll('.cnt, nav.tabs .n')].filter((e) => e.getBoundingClientRect().width > 1).map((e) => {
      const r = e.getBoundingClientRect(), s = getComputedStyle(e); return [e.textContent, r.width, r.height, s.borderTopLeftRadius, s.justifyContent, s.lineHeight, e.scrollWidth <= e.clientWidth]; }));
    let sizes = await measure();
    expect(sizes.map((x) => x[0]).sort()).toEqual(['1', '13', '2', '2']);   // product groups 2 and 1, Home 13 (two digits), Orders 2
    for (const x of sizes) expect(x.slice(1), 'count ' + x[0]).toEqual([30, 22, '11px', 'center', '20px', true]);
    // The same with a wider fallback font (as on a machine without Lexend): the box stays exactly 30 x 22 and two digits still fit.
    await page.addStyleTag({ content: '.cnt, nav.tabs .n { font-family: "DejaVu Sans", Verdana, sans-serif !important; }' });
    sizes = await measure();
    for (const x of sizes) expect(x.slice(1), 'wide font, count ' + x[0]).toEqual([30, 22, '11px', 'center', '20px', true]);
  });

  for (const look of ['warm', 'cool']) {
    test(`${look} clear: the control line is 3:1 or better on the page and on a card (light mode, where it is faintest)`, async ({ page }) => {
      await page.addInitScript((bg) => localStorage.setItem('dash-look', JSON.stringify({ bg })), look);
      await page.emulateMedia({ colorScheme: 'light' });
      await sheets(page, book());
      await open(page);
      const r = await page.evaluate(() => {
        const probe = (v) => { const d = document.createElement('i'); d.style.color = 'var(' + v + ')'; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
        const rgb = (s) => { const m = /\(srgb ([^)]+)\)|\(([^)]+)\)/.exec(s), v = (m[1] || m[2]).split(/[ ,/]+/).filter(Boolean).map(Number), k = m[1] ? 255 : 1; return [v[0] * k, v[1] * k, v[2] * k]; };
        const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
        const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
        const ctl = rgb(probe('--ctl'));
        return { page: ratio(ctl, rgb(probe('--bg'))), card: ratio(ctl, rgb(probe('--surface'))), btn: getComputedStyle(document.querySelector('#view .btn')).borderTopColor === probe('--ctl') };
      });
      expect(r.page).toBeGreaterThanOrEqual(3);
      expect(r.card).toBeGreaterThanOrEqual(3);
      expect(r.btn).toBe(true);
    });
  }

  test('count pills: only 3+ digits grow past 30px', async ({ page }) => {
    const b = book(); for (let i = 0; i < 120; i++) b.cards.push(['CHK-' + i, 'check', 'Orders', 'Sample check ' + i, '{}', ago(1)]);
    await sheets(page, b);
    await open(page);
    await expect(page.locator('#n-home')).toHaveText('123');
    await expect(page.locator('#n-home')).toHaveClass(/wide/);
    await expect(page.locator('#n-orders')).not.toHaveClass(/wide/);
    const w = await page.locator('#n-home').evaluate((e) => [e.getBoundingClientRect().width, e.scrollWidth <= e.clientWidth]);
    expect(w[0]).toBeGreaterThan(30); expect(w[1]).toBe(true);
  });

  test('no solid colour fills: counts, badges, date pills, amounts and the chosen filter are rings or light tints', async ({ page }) => {
    const b = book(); b.invoices[1][8] = '2026-01-01';
    await sheets(page, b);
    await open(page, '#/orders');
    await page.locator('[data-ofilter="check"]').click();
    const fills = async () => page.evaluate(() => [...document.querySelectorAll('.cnt, nav.tabs .n, .badge, .datep, .amt, .chip[aria-pressed="true"], .tile .v, .stamp')].filter((e) => e.getBoundingClientRect().width > 1).map((e) => {
      const s = getComputedStyle(e).backgroundColor, m = /\(srgb ([^)]+)\)|\(([^)]+)\)/.exec(s), v = (m[1] || m[2]).split(/[ ,/]+/).filter(Boolean).map(Number), k = m[1] ? 255 : 1;
      const [r, g, bl] = [v[0] * k, v[1] * k, v[2] * k], a = v[3] === undefined ? 1 : v[3];
      return { el: e.className + ' ' + e.textContent.trim().slice(0, 20), a, light: (r + g + bl) / 3 };
    }).filter((x) => x.a > 0 && x.light < 200));   // a fill that is not a light tint
    expect(await fills()).toEqual([]);
    await page.goto('food/#/invoices');
    expect(await fills()).toEqual([]);
    await page.goto('food/#/home');
    expect(await fills()).toEqual([]);
  });

  test('Home: the first card is the Next card (1px ink edge, "Next:" name line), tab counts are rose rings, the payment date pill shows how close it is', async ({ page }) => {
    const b = book(); const soon = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10); b.invoices[1][8] = soon;
    await sheets(page, b);
    await open(page);
    const next = page.locator('#view > .card.next');
    await expect(next).toHaveCount(1);
    await expect(next.locator('.bline')).toHaveText('Next: GA price changed');
    expect(await next.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe(await page.evaluate(() => getComputedStyle(document.body).color));
    await expect(page.locator('#view .needs .cnt.need')).toHaveText('3');
    await expect(page.locator('#n-orders')).toHaveText('2');   // Items differ + Not at GA
    const tile = page.locator('#view a.tile', { hasText: 'Next GA payment due' });
    await expect(tile.locator('.datep')).toHaveText('in 3 days');
    await expect(tile.locator('.datep')).toHaveClass(/soon/);
  });

  test('friendly empty states: nothing to answer shows a green-ring tick, unless an order never reached GA (then that is the Next card)', async ({ page }) => {
    const b = book(); b.cards = [];
    await sheets(page, b);
    await open(page);
    await expect(page.locator('#view .needs .cnt.ok')).toHaveText('0');
    await expect(page.locator('#view > .card.next')).toContainText('1 order is not at GA');
    await expect(page.locator('#view > .card.next a.btn')).toHaveAttribute('href', '#/orders?check');
    const c = book(); c.cards = []; c.orders = c.orders.filter((o, i) => i === 0 || o[26] !== 'Not at GA');
    await page.unroute(SHEETS);
    await sheets(page, c);
    await page.locator('#refresh').click();
    await expect(page.locator('#view .empty')).toContainText('Nothing needs you');
    await page.goto('food/#/orders');
    await page.locator('[data-ofilter="low"]').click();
    await page.locator('[data-ofilter="sub"]').click();
    await page.locator('[data-ofilter="ga"]').click();
    await expect(page.locator('#view .row')).toHaveCount(1);   // only the one waiting
    await page.goto('food/#/products');
    await page.locator('[data-find]').fill('nothing like this');
    await expect(page.locator('#view .empty')).toContainText('No products match');
  });

  test('a phone (390px): no sideways scroll on any tab, every control is 44px tall, tab counts sit beside the icon', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await sheets(page, book());
    await open(page);
    for (const tab of TABS) {
      await page.goto('food/#/' + tab);
      await expect(page.locator(`nav.tabs a[data-nav="${tab}"]`)).toHaveAttribute('aria-current', 'page');
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over, '#/' + tab).toBeLessThanOrEqual(0);
      const short = await page.evaluate(() => [...document.querySelectorAll('#view button, #view a.btn, #view .chip, header .btn')].filter((e) => e.getBoundingClientRect().width > 1 && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim()));
      expect(short, '#/' + tab).toEqual([]);
    }
    expect(await page.locator('#n-home').evaluate((e) => getComputedStyle(e).position)).toBe('static');
  });
});
