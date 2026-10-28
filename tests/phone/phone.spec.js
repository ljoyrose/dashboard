// PHONE SUBSET. Pixel-sized screen (390 x 844). Deliberately small: it does NOT repeat the desktop suite.
// For each of the three pages: it loads, the menu works, nothing unexpected in the browser's error log
// (the shared guard in tests/support/test.js does that on every test), and nothing scrolls sideways.
// Google sign-in and Drive are pretend here too.
const { test, expect } = require('../support/test');

// Sideways scroll = the page is wider than the screen. 1px of slack for rounding.
const noSidewaysScroll = async (page, where) => {
  const w = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, screen: window.innerWidth }));
  expect(w.doc, `${where}: page is ${w.doc}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
  expect(w.body, `${where}: body is ${w.body}px wide on a ${w.screen}px screen`).toBeLessThanOrEqual(w.screen + 1);
};

test.describe('Phone: Main dashboard', () => {
  test('loads, signs in, menu works, no sideways scroll', async ({ page }) => {
    expect((await page.goto('./')).status()).toBe(200);
    await noSidewaysScroll(page, 'signed out');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await noSidewaysScroll(page, 'Map');
    for (const [key, title] of [['drive', 'Drive'], ['bin', 'Bin'], ['changes', 'Changes · Recent'], ['map', 'Map']]) {
      await page.locator(`#mainNav a[data-nav="${key}"]`).click();
      await expect(page.locator('#hereTitle')).toHaveText(title);
      await noSidewaysScroll(page, title);
    }
  });
});

test.describe('Phone: CD Hub', () => {
  test('loads, signs in, menu works, no sideways scroll', async ({ page }) => {
    expect((await page.goto('cdhub/')).status()).toBe(200);
    await noSidewaysScroll(page, 'signed out');
    await expect(page.locator('#signinbtn')).toBeEnabled();
    await page.locator('#signinbtn').click();
    await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
    await noSidewaysScroll(page, 'first section');
    for (const id of ['dogs', 'litters', 'work', 'map']) {
      await page.locator(`#nav button[data-go="${id}"]`).click();
      await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
      await noSidewaysScroll(page, id);
    }
  });
});

test.describe('Phone: CD Hub menu', () => {
  test('every CD Hub section can be seen in the menu without scrolling sideways', async ({ page }) => {
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
    const off = await page.evaluate(() => Array.from(document.querySelectorAll('#nav button')).filter((b) => { const r = b.getBoundingClientRect(); return r.right > window.innerWidth + 1 || r.left < -1; }).map((b) => b.textContent));
    expect(off, 'menu buttons off the side of the screen').toEqual([]);
  });
});

test.describe('Phone: CD Hub house look', () => {
  test('every section: no sideways scroll, controls 44px tall, bottom tabs in two rows on screen, header uses one More menu', async ({ page }) => {
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
    for (const id of ['map', 'work', 'shape', 'today', 'round', 'dogs', 'areas', 'litters', 'vet', 'buyers']) {
      await page.locator(`#nav button[data-go="${id}"]`).click();
      await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
      await noSidewaysScroll(page, id);
      const short = await page.evaluate(() => [...document.querySelectorAll('#main button, #main select, #next button, header .btn, #nav button')].filter((e) => e.getBoundingClientRect().width > 1 && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim()));
      expect(short, id + ': controls under 44px').toEqual([]);
    }
    const rows = await page.evaluate(() => new Set([...document.querySelectorAll('#nav button[data-go]')].map((b) => Math.round(b.getBoundingClientRect().top))).size);
    expect(rows, 'bottom tabs: two rows').toBe(2);
    await expect(page.locator('#moreBtn')).toBeVisible();
    await expect(page.locator('#backHome')).toBeHidden();
  });
});

test.describe('Phone: Marketplace', () => {
  test('loads, signs in, every tab works, no sideways scroll, every button 44px, tab counts in flow beside the icon', async ({ page }) => {
    const ago = new Date(Date.now() - 5 * 60000).toISOString();
    const rows = [
      ['RM|1', 'remove', 'Clothes', 'Sample jacket with a long title that wraps onto a second line on a phone screen', JSON.stringify({ platform: 'Vinted', price: '£18.00', url: 'https://www.vinted.co.uk/items/1', owner: 'CY' }), ago],
      ['PO|1', 'post', 'Clothes', 'Sample jumper', JSON.stringify({ platform: 'ebay', parcel_id: 'L-07', courier: 'Evri', shelf: 'B2', post_by: '2026-10-20' }), ago],
      ['GO|1', 'go', 'Treats', 'Sample treats', JSON.stringify({ price: '£12.00' }), ago],
    ];
    await page.route(/^https:\/\/sheets\.googleapis\.com\//, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: rows }) }));
    expect((await page.goto('marketplace/')).status()).toBe(200);
    await noSidewaysScroll(page, 'signed out');
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#view .needs')).toHaveText('Needs you: 3');
    for (const key of ['do', 'decide', 'reply', 'insights', 'me']) {
      await page.locator(`#tabs a[data-nav="${key}"]`).click();
      await expect(page.locator(`#tabs a[data-nav="${key}"]`)).toHaveAttribute('aria-current', 'page');
      await noSidewaysScroll(page, key);
      const small = await page.evaluate(() => [...document.querySelectorAll('#view button, #view a.btn, #view .chip, header .btn')].filter((b) => b.offsetParent).filter((b) => b.getBoundingClientRect().height < 44).map((b) => b.textContent.trim()));
      expect(small, `${key}: buttons under 44px`).toEqual([]);
    }
    const n = await page.locator('#n-do').boundingBox(), icon = await page.locator('#tabs a[data-nav="do"] .ti').boundingBox(), label = await page.locator('#tabs a[data-nav="do"] span:not(.bar):not(.n)').boundingBox();
    expect(Math.abs((n.y + n.height / 2) - (icon.y + icon.height / 2)), 'count sits on the icon line').toBeLessThan(6);
    expect(label.y, 'label has its own line below the count').toBeGreaterThanOrEqual(n.y + n.height - 1);
  });
});

test.describe('Phone: Money Hub', () => {
  test('loads, signs in, menu works, no sideways scroll', async ({ page }) => {
    expect((await page.goto('money/')).status()).toBe(200);
    await noSidewaysScroll(page, 'signed out');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await noSidewaysScroll(page, 'Now');
    for (const [key, title] of [['money', 'Money'], ['dates', 'Dates'], ['todo', 'To-do'], ['control', 'Control'], ['now', 'Now']]) {
      await page.locator(`nav.main a[data-nav="${key}"]`).click();
      await expect(page.locator('#hereTitle')).toHaveText(title);
      await noSidewaysScroll(page, title);
    }
  });
});

test.describe('Phone: GA Hub', () => {
  test('loads, signs in, every tab works, no sideways scroll, controls 44px tall', async ({ page }) => {
    // Pretend Sheets with one invented row per tab (no real orders or names).
    await page.route(/^https:\/\/sheets\.googleapis\.com\//, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valueRanges: [
      { values: [['PRICE-SAMPLE', 'price', 'Products', 'Sample price change', '{}', new Date().toISOString()]] },
      { values: [['order_no', 'source', 'status', 'check', 'profit_est'], ['9001', 'Shopify', 'Placed', 'Not at GA', '8']] },
      { values: [['si_no', 'invoice_date', 'order_no', 'total', 'due_date', 'paid_date'], ['SI-1', '2026-10-25', '9001', '50', '2026-12-06', '']] },
      { values: [['COUNT: sample'], ['tla', 'range', 'recipe', 'pack', 'ddf_status'], ['AAA', 'Sample range', 'Sample recipe', '12kg', 'ON SALE (Shopify)']].slice(1) },
      { values: [['key', 'value'], ['GA_ACCOUNT_CODE', 'XYZ']] }, { values: [] }, { values: [] }, { values: [] }] }) }));
    expect((await page.goto('food/')).status()).toBe(200);
    await noSidewaysScroll(page, 'signed out');
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#view .needs')).toBeVisible();
    for (const key of ['orders', 'invoices', 'products', 'ga', 'home']) {
      await page.locator(`nav.tabs a[data-nav="${key}"]`).click();
      await expect(page.locator(`nav.tabs a[data-nav="${key}"]`)).toHaveAttribute('aria-current', 'page');
      await noSidewaysScroll(page, key);
      const short = await page.evaluate(() => [...document.querySelectorAll('#view button, #view a.btn, #view .chip, header .btn')].filter((e) => e.getBoundingClientRect().width > 1 && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim()));
      expect(short, key + ': controls under 44px').toEqual([]);
    }
  });
});
