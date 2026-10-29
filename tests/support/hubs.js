// One way to open every hub signed in with invented sample data, for checks that run the same rules across all hubs
// (tests/mocked/house-look.spec.js). Pretend Google, Drive and Sheets only; every row below is invented.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { expect } = require('@playwright/test');
const { settle } = require('./settle');

const ROOT = path.resolve(__dirname, '..', '..');
const SHEETS = /^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\//;
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

// Pretend Sheets for the two sheet-backed hubs (GA Hub, Marketplace): reads answer from the rows, writes answer {}.
async function sheets(page, answer) {
  await page.route(/googleapis\.com\/drive\/v3\/files\/[\w-]+\?alt=media/, (route) => route.fulfill({ status: 200, contentType: 'text/csv', body: 'listing_id,image_url\n' }));
  await page.route(/i\.ebayimg\.com/, (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' }));
  await page.route(SHEETS, (route) => {
    const req = route.request();
    if (req.method() === 'PUT') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(decodeURIComponent(req.url()))) });
  });
}

function marketRows() {
  return [
    ['RM|1', 'remove', 'Clothes', 'Sample jacket with a long title', JSON.stringify({ platform: 'Vinted', price: '£18.00', url: 'https://www.vinted.co.uk/items/1', sold: 'Sold on eBay 14:02', owner: 'CY' }), ago(5)],
    ['PO|1', 'post', 'Clothes', 'Sample jumper', JSON.stringify({ platform: 'ebay', parcel_id: 'L-07', courier: 'Evri', shelf: 'B2', post_by: day(-1), price: '£22.00' }), ago(5)],
    ['PO|2', 'post', 'Collars & accessories', 'Sample lead', JSON.stringify({ platform: 'vinted', parcel_id: 'L-08', courier: 'InPost', shelf: 'A1', post_by: day(0), price: '£9.00' }), ago(5)],
    ['PO|3', 'post', 'Blades & grooming', 'Sample blade', JSON.stringify({ platform: 'ebay', parcel_id: 'L-09', courier: 'Royal Mail', shelf: 'C3', post_by: day(5), price: '£14.00' }), ago(5)],
    ['RS|1', 'restock', 'Health & supplements', 'Sample shampoo 500ml', JSON.stringify({ url: 'https://www.temu.com/sample-g-1.html', last_cost: '£4.10', sell_through_30: 2, profit_per_unit: '£7.69', qty_to_target: 6 }), ago(5)],
    ['GO|1', 'go', 'Treats', 'Sample treats', JSON.stringify({ price: '£12.00' }), ago(30)],
    ['MSG|1', 'message', 'Clothes', 'Question about: sample jumper', JSON.stringify({ platform: 'eBay', url: 'https://www.ebay.co.uk/cnt/ViewMessage' }), ago(12)],
  ];
}
function foodBook() {
  return {
    cards: [
      ['PRICE-AAA0012KZPSXZZZ-32.000', 'price', 'Products', 'Sample Doodle 12kg: GA price up £31.20 → £32.00', JSON.stringify({ why: 'Shop £65.00 → £66.00', red: true }), ago(30)],
      ['LOWPROFIT-9001', 'profit', 'Orders', 'Order #9001: profit £8.00 (under £15)', JSON.stringify({ red: true }), ago(20)],
      ['PL-1', 'pricelist', 'Products', 'New GA price list: sample', JSON.stringify({ files: ['FILE123456789012345678901'] }), ago(10)],
    ],
    orders: [['order_no', 'source', 'brand', 'supplier', 'status', 's_no', 'si_no', 'boxes', 'ga_goods', 'ga_delivery', 'ga_vat', 'ga_total', 'sale_ex_vat_est', 'profit_est', 'shipped_date', 'invoice_date', 'due_date', 'paid', 'notes', 'updated_at', 'tracking', 'order_type', 'sale_inc_vat', 'customer_orders', 'placed_at', 'shop_lines', 'check'],
      ['9001', 'Shopify', 'DDF', 'GA', 'Invoiced', 'S1000001', 'SI-1000001', '1', '31.20', '10.82', '8.40', '50.42', '52.50', '8.17', '', '', '', '', '', '', '', 'Subscription (PayWhirl)', '63.00', '22', '2026-10-22T09:00:00Z', '[]', 'Matched'],
      ['9003', 'Shopify', 'DDF', 'GA', 'Placed', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'One-off (Online Store)', '70.00', '3', '2026-10-20T09:00:00Z', '[]', 'Not at GA']],
    invoices: [['si_no', 'invoice_date', 's_no', 'order_no', 'goods', 'delivery', 'vat', 'total', 'due_date', 'paid_date', 'fy', 'vat_quarter', 'file_id'],
      ['SI-1000001', '2026-10-25', 'S1000001', '9001', '31.20', '10.82', '8.40', '50.42', day(2), '', 'FY2026-27', '2026-Q4', 'FILE000000000000000000001'],
      ['SI-1000002', '2026-09-25', 'S1000002', '9002', '130.67', '0', '26.14', '156.81', day(-3), '', 'FY2026-27', '2026-Q3', '']],
    products: [['tla', 'full_ga_code', 'range', 'species', 'life_stage', 'recipe', 'pack', 'pack_kg', 'ga_price_ex_vat_portal_oct26', 'ga_price_ex_vat_list_aug25', 'price_change', 'list_vat_flag', 'in_portal', 'in_price_list', 'chicken_in_name', 'grain', 'ddf_status', 'ddf_name', 'barcode', 'kibble', 'protein_pct', 'fresh_meat_pct', 'shopify', 'shopify_price_inc_vat', 'subscription_price_inc_vat', 'clickfunnels_price_inc_vat', 'puppyclassroom_price_inc_vat', 'profit_ex_vat_1bag_1box'],
      ['AAA', 'AAA0012KZPSXZZZ', 'Grain Free', 'Dog', 'Adult', 'GF Sample Fish', '12kg', '12', '31.20', '31.20', '', 'WD*', 'Y', 'Y', 'N', 'Grain free', 'ON SALE (Shopify)', 'Sample Doodle', '', '', '', '', 'Y', '65', '63', '', '', '8.17'],
      ['BBB', '', 'Grain Free', 'Dog', 'Adult', 'GF Sample Rabbit', '6kg', '6', '21.97', '21.97', '', 'WD*', 'Y', 'Y', 'N', 'Grain free', 'DDF-ELIGIBLE: check data sheet, then list', '', '', '', '', '', 'N', '', '', '', '', '']],
    settings: [['key', 'value', 'note'], ['MIN_PROFIT', '15', ''], ['GA_ACCOUNT_CODE', 'XYZ', ''], ['GA_PHONE_ORDERS', '01632 960123', ''], ['GA_PORTAL', 'https://partners.example.test', ''], ['GA_PAYMENT', 'Direct debit', '']],
  };
}

function studioConfig() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8'), ctx);
  return ctx.window.DASH_CONFIG.studio;
}

// Each hub: where it lives, how to sign in with sample data, and every view to look at (all reachable by address).
const HUBS = {
  home: {
    url: './', views: ['map', 'drive', 'bin', 'changes', 'more', 'personal', 'usb', 'readfirst'],
    async open(page) {
      await page.goto('./');
      await expect(page.locator('#signInBtn')).toBeEnabled();
      await page.locator('#signInBtn').click();
      await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    },
  },
  money: {
    url: 'money/', views: ['now', 'money', 'dates', 'todo', 'todo/others', 'accountant', 'control', 'e/TESTCO', 'register/R001'],
    async open(page) {
      await page.goto('money/');
      await expect(page.locator('#signInBtn')).toBeEnabled();
      await page.locator('#signInBtn').click();
      await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    },
  },
  cdhub: {
    url: 'cdhub/', views: ['map', 'work', 'shape', 'today', 'round', 'dogs', 'areas', 'litters', 'vet', 'buyers'],
    async open(page) {
      await page.goto('cdhub/');
      await expect(page.locator('#signinbtn')).toBeEnabled();
      await page.locator('#signinbtn').click();
      await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
    },
  },
  food: {
    url: 'food/', views: ['home', 'orders', 'invoices', 'products', 'ga'],
    async open(page) {
      const b = foodBook();
      await sheets(page, (url) => /:batchGet/.test(url)
        ? { valueRanges: [{ values: b.cards }, { values: b.orders }, { values: b.invoices }, { values: b.products }, { values: b.settings }, { values: [['statement_date', 'total_outstanding']] }, { values: [['date', 'amount']] }, { values: [['kind', 'code', 'name']] }] }
        : { values: [(b.cards[Number((/Cards!A(\d+)/.exec(url) || [0, 2])[1]) - 2] || [])] });
      await page.goto('food/#/home');
      await page.locator('#view [data-action="signin"]').click();
      await expect(page.locator('#view .needs')).toBeVisible();
    },
  },
  marketplace: {
    url: 'marketplace/', views: ['me', 'do', 'decide', 'reply', 'insights', 'round', 'stock', 'temu', 'suppliers'],
    async open(page) {
      const rows = marketRows();
      await sheets(page, (url) => /!A2:L$/.test(url) ? { values: rows } : { values: [(rows[Number((/!A(\d+)/.exec(url) || [0, 2])[1]) - 2] || [])] });
      await page.goto('marketplace/#/me');
      await page.locator('#view [data-action="signin"]').click();
      await expect(page.locator('#view .needs')).toBeVisible();
    },
  },
  factory: {
    url: 'factory/', views: ['rooms', 'me', 'decide', 'do', 'docs', 'today', 'room/rig', 'app/links', 'health', 'all', 'new'],
    async open(page, guard) {
      const { build } = require('../fixtures/factory/state');
      const logs = require('./world').IDS.factoryLogs;
      const st = build(Date.now());
      st.lists.work[1].due = Date.now() + 864e5;
      guard.world.folder(logs, 'AF logs (sample)');
      guard.world.file('af-state-sample', 'af-state.json', JSON.stringify(st), { parents: [logs], mimeType: 'application/json' });
      await page.goto('factory/#/rooms');
      await expect(page.locator('#signInBtn')).toBeEnabled();
      await page.locator('#signInBtn').click();
      await expect(page.locator('#appPick')).toBeVisible();
    },
  },
  studio: {
    url: 'studio/', views: ['me', 'decide', 'do', 'line', 'ideas', 'assets', 'review', 'brands', 'library', 'kits', 'tools', 'new'],
    async open(page, guard) {
      const { build } = require('../fixtures/studio/state');
      const ST = studioConfig();
      const now = new Date('2026-10-28T10:10:00');
      await page.clock.setFixedTime(now);
      guard.world.folder(ST.logsFolderId, 'Studio logs (sample)');
      guard.world.file('studio-state-sample', ST.stateFile, JSON.stringify(build(now.getTime())), { parents: [ST.logsFolderId], mimeType: 'application/json' });
      await page.goto('studio/#/me');
      await expect(page.locator('#signInBtn')).toBeEnabled();
      await page.locator('#signInBtn').click();
      await expect(page.locator('#enginePill')).toBeVisible();
    },
  },
};

// Look as Studio's Look menu saves it (one JSON in localStorage 'dash-look', read by every hub), set before the page loads.
async function setLook(page, { bg = 'warm', mode = 'device', scheme = 'light' } = {}) {
  await page.emulateMedia({ colorScheme: scheme });
  await page.addInitScript((o) => { try { localStorage.setItem('dash-look', JSON.stringify(o)); } catch (e) {} }, { bg, mode, sel: 'line' });
}

// Move to a view by its address and wait until the page has drawn it.
async function go(page, view) {
  await page.evaluate((v) => { location.hash = '#/' + v; }, view);
  await page.waitForTimeout(50);
  await page.waitForFunction(() => document.querySelector('main, #view') && !document.querySelector('.loading:not(.hidden)'), null, { timeout: 5000 }).catch(() => {});
  await settle(page.locator('body'));
}


module.exports = { HUBS, setLook, go, settle, sheets };
