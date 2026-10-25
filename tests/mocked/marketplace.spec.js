// Marketplace page (24 Oct 2026): Needs-you count, one main card, taps write only the 4 answer cells, Undo, Stock round,
// colours only from tokens.css, phone width. Pretend Google only; the sheet rows below are invented.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'marketplace', 'index.html'), 'utf8');
const SHEETS = /^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\//;
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();

function sampleRows() {
  return [
    ['MKT-1', 'remove', 'Blades & grooming', 'Sample blade 10, 1.5mm. New', JSON.stringify({ price: '£24.00', platform: 'Vinted', url: 'https://www.vinted.co.uk/items/1', sold: 'sold on eBay 16:42' }), ago(5)],
    ['MKT-2', 'post', 'Towels & textiles', 'Sample bath sheet', JSON.stringify({ courier: 'InPost', shelf: 'C1', post_by: '2026-10-27' }), ago(5)],
    ['MKT-3', 'restock', 'Health & supplements', 'Sample shampoo 500ml', JSON.stringify({ url: 'https://www.temu.com/sample-g-1.html', last_cost: '£4.10', sell_through_30: 2, profit_per_unit: '£7.69', qty_to_target: 6 }), ago(5)],
    ['MKT-4', 'round', 'Blades & grooming', 'Sample thinning comb', JSON.stringify({ shelf: 'B2', expected: 9, item_sku: 'SKU-4' }), ago(5)],
    ['MKT-5', 'go', 'Treats', 'Sample treats', JSON.stringify({ price: '£12.00' }), ago(30), 'Yes', '', ago(30), 'sample@example.com', ago(15), 'engine'],
  ];
}
// Pretend Sheets: answers reads from `rows`, records every write, and can swap a row's key to mimic a moved row.
async function sheets(page, rows, opts = {}) {
  const writes = [];
  await page.route(SHEETS, async (route) => {
    const req = route.request(), url = decodeURIComponent(req.url());
    if (req.method() === 'PUT') {
      writes.push({ range: /values\/([^?]+)/.exec(url)[1], body: JSON.parse(req.postData()) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    if (/!A2:L$/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: rows }) });
    const n = Number(/!A(\d+)/.exec(url)[1]), row = (rows[n - 2] || []).slice();
    if (opts.moved) row[0] = 'SOMETHING-ELSE';
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: [row] }) });
  });
  return writes;
}
async function open(page, hash) {
  await page.goto('marketplace/' + (hash || '#/me'));
  await page.locator('#view [data-action="signin"]').click();
  await expect(page.locator('#view .needs')).toBeVisible();
}

test.describe('Marketplace page', () => {
  test('signed out it shows only a sign-in button; signed in: "Needs you: 2" and one main card, most urgent first', async ({ page }) => {
    await sheets(page, sampleRows());
    await page.goto('marketplace/');
    await expect(page.locator('#view')).toContainText('Sign in to see what needs you');
    await expect(page.locator('#view .needs')).toHaveCount(0);
    await expect(page.locator('#tabs')).toBeHidden();          // the menu stays behind the sign-in
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#tabs')).toBeVisible();
    await expect(page.locator('#view .needs')).toHaveText('Needs you: 2');
    await expect(page.locator('#view > .card')).toHaveCount(1);
    await expect(page.locator('#view > .card h2')).toHaveText('Remove from Vinted');
    await expect(page.locator('#n-remove')).toHaveText('1');
    await expect(page.locator('#stamp')).toHaveText('TEST');
  });

  test('a tap writes only the 4 answer cells (G:J) of that row, with Lisa\'s email; Undo clears them', async ({ page, guard }) => {
    const writes = await sheets(page, sampleRows());
    await open(page);
    await page.locator('[data-ans="MKT-1"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].range).toBe('Marketplace!G2:J2');
    const [v] = writes[0].body.values;
    expect(v[0]).toBe('Done'); expect(v[3]).toBe(guard.world.email); expect(Date.parse(v[2])).toBeGreaterThan(Date.now() - 60000);
    await expect(page.locator('#view')).toContainText('Just done');
    await page.locator('[data-undo="MKT-1"]').first().click();
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[1].range).toBe('Marketplace!G2:J2'); expect(writes[1].body.values).toEqual([['', '', '', '']]);
  });

  test('if the row moved since the page read it, nothing is written and Lisa is told to refresh', async ({ page }) => {
    const writes = await sheets(page, sampleRows(), { moved: true });
    await open(page);
    await page.locator('[data-ans="MKT-1"]').click();
    await expect(page.locator('#banner')).toContainText('Not saved');
    expect(writes).toEqual([]);
  });

  test('Restock: "Arrived" needs a number, then writes "Arrived 6"', async ({ page }) => {
    const writes = await sheets(page, sampleRows());
    await open(page, '#/restock');
    await page.locator('[data-arrive="MKT-3"]').click();
    await expect(page.locator('#banner')).toContainText('Type how many arrived');
    await page.locator('[data-arrived="MKT-3"]').fill('6');
    await page.locator('[data-arrive="MKT-3"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].range).toBe('Marketplace!G4:J4'); expect(writes[0].body.values[0][0]).toBe('Arrived 6');
  });

  test('Stock round: a wrong count turns red and asks for a reason; no reason, no save', async ({ page }) => {
    const writes = await sheets(page, sampleRows());
    await open(page, '#/round');
    await page.locator('[data-count="MKT-4"]').fill('8');
    await page.locator('[data-count="MKT-4"]').dispatchEvent('change');
    await expect(page.locator('#view .card.acc2')).toHaveCount(1);
    await expect(page.locator('[data-reason="MKT-4"]')).toHaveCount(4);
    await page.locator('[data-action="finish"]').click();
    await expect(page.locator('#banner')).toContainText('Pick a reason');
    expect(writes).toEqual([]);
    await page.locator('[data-reason="MKT-4"][data-v="lost"]').click();
    await page.locator('[data-action="finish"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.values[0][0]).toBe('8 lost');
  });

  test('colours come only from tokens.css: no colour is written in the page', async () => {
    const css = /<style>([\s\S]*?)<\/style>/.exec(SRC)[1];
    expect(SRC).toContain('<link rel="stylesheet" href="../tokens.css">');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(css).not.toMatch(/\b(rgba?|hsla?)\(/i);
    expect(css).not.toMatch(/:\s*(white|black|red|green|blue|grey|gray|orange|yellow|purple)\b/i);
    for (const v of css.match(/var\(--[\w-]+/g) || []) {
      const name = v.slice(4);
      expect(/^--ljr-/.test(name) || new RegExp(name + '\\s*:').test(css), name).toBe(true);
    }
  });

  test('phone width: nothing scrolls sideways and the main button is big', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await sheets(page, sampleRows());
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const box = await page.locator('[data-ans="MKT-1"]').boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('a Google refusal says what to do in plain words (Sheets switch off, missing tick-box)', async ({ page, allowedConsole }) => {
    allowedConsole.push(/status of 403/); // the browser logs the refused request itself; that is the point of this test
    await page.route(SHEETS, (route) => route.fulfill({ status: 403, contentType: 'application/json',
      body: JSON.stringify({ error: { code: 403, message: 'Google Sheets API has not been used in project 123 before or it is disabled.', status: 'PERMISSION_DENIED' } }) }));
    await page.goto('marketplace/');
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#banner')).toContainText('Google Sheets switch is off');
  });

  test('a buyer message is a ticket: counted in Needs you, opens the messages link, Done writes the answer cells', async ({ page }) => {
    const rows = [['MSG|ebay|m1', 'message', 'Blades & grooming', 'eBay message: Sample blade', JSON.stringify({ platform: 'eBay', url: 'https://www.ebay.co.uk/cnt/ViewMessage' }), ago(5)]];
    const writes = await sheets(page, rows);
    await open(page);
    await expect(page.locator('#view .needs')).toHaveText('Needs you: 1');
    await expect(page.locator('#view > .card h2')).toHaveText('Messages');
    await expect(page.locator('#view a', { hasText: 'Open messages' })).toHaveAttribute('href', 'https://www.ebay.co.uk/cnt/ViewMessage');
    await page.locator('[data-ans="MSG|ebay|m1"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].range).toBe('Marketplace!G2:J2'); expect(writes[0].body.values[0][0]).toBe('Done');
  });
});
