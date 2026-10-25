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
  // The listings file (second photo on "Same item?" cards): empty unless a test gives one.
  await page.route(/googleapis\.com\/drive\/v3\/files\/[\w-]+\?alt=media/, (route) => route.fulfill({ status: 200, contentType: 'text/csv', body: 'listing_id,image_url\n' }));
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
    await expect(page.locator('#view > .card h2')).toHaveText('Remove from other sites');
    await expect(page.locator('#view > .card a.btn')).toHaveText('Open on Vinted');
    await expect(page.locator('#n-do')).toHaveText('2');   // Do now = remove + post
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

  test('any marketplace: Remove names the site, a Go card says why, a double sale lists the steps in order', async ({ page }) => {
    const rows = [
      ['RM|L1', 'remove', 'Blades & grooming', 'Sample blade on eBay', JSON.stringify({ price: '£24.00', platform: 'eBay', url: 'https://www.ebay.co.uk/itm/1', sold: 'sold on etsy 16:42' }), ago(5)],
      ['RACE|S1', 'remove', 'Blades & grooming', 'Double sale: Sample blade', JSON.stringify({ sold: 'Sold twice. Keep the Etsy sale.', steps: ['1. Message the Vinted buyer first: "Sorry"', '2. Then cancel the Vinted order V-1 in the Vinted app (in the chat).'] }), ago(5)],
      ['GO|L8|2026-10-25', 'go', 'Blades & grooming', 'Sample blade on Depop', JSON.stringify({ why: 'back in stock after cancel: relist on Depop by hand, then tap Go', listing_id: 'L8', platform: 'depop' }), ago(5)],
    ];
    await sheets(page, rows);
    await open(page, '#/remove');
    await page.locator('[data-action="all"]').click();
    await expect(page.locator('#view a', { hasText: 'Open on eBay' })).toHaveAttribute('href', 'https://www.ebay.co.uk/itm/1');
    await expect(page.locator('#view ol.steps li')).toHaveText(['Message the Vinted buyer first: "Sorry"', 'Then cancel the Vinted order V-1 in the Vinted app (in the chat).']);
    await page.goto('marketplace/#/go');
    await expect(page.locator('#view')).toContainText('relist on Depop by hand, then tap Go');
  });
  test('privacy policy page: public (no sign-in, no scripts), names the contact, says buyer details are not stored, tokens.css colours only', async ({ page }) => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'marketplace', 'privacy.html'), 'utf8');
    expect(src).not.toMatch(/<script/i);
    expect(src).toContain('<meta name="robots" content="noindex, nofollow">');   // opens by link, never listed by search engines
    expect(src.replace(/<!--[\s\S]*?-->/g, '')).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    await page.goto('marketplace/privacy.html');
    await expect(page.locator('h1')).toHaveText('Privacy policy');
    await expect(page.locator('a[href="mailto:lisa@puppyclassroom.com"]').first()).toBeVisible();
    await expect(page.locator('main')).toContainText('does not store buyer names');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
  test('Check your list: one Yes/No question per card, says it changes only the list, Yes writes the 4 answer cells', async ({ page }) => {
    const rows = [['LINK|L9|L7', 'check', 'Health & supplements', 'Sample bottle on Vinted', JSON.stringify({ kind: 'link', platform: 'Vinted', url: 'https://www.vinted.co.uk/items/1', why: 'Same item as on eBay: "Sample bottle"? Yes links them, so a sale on one clears the other.' }), ago(5)]];
    const writes = await sheets(page, rows);
    await open(page, '#/check');
    await expect(page.locator('#view .needs')).toHaveText('Check your list: 1');
    await expect(page.locator('#view')).toContainText('Same item as on eBay: "Sample bottle"?');
    await expect(page.locator('#n-decide')).toHaveText('1');
    await expect(page.locator('#view a', { hasText: 'Open on Vinted' })).toHaveAttribute('href', 'https://www.vinted.co.uk/items/1');
    await page.locator('[data-ans="LINK|L9|L7"][data-v="Yes"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].range).toBe('Marketplace!G2:J2'); expect(writes[0].body.values[0][0]).toBe('Yes');
  });
  test('every card can show the item photo: an eBay picture or a Drive photo; any other address is ignored', async ({ page }) => {
    await page.route(/i\.ebayimg\.com|drive\.google\.com\/thumbnail/, (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' }));
    const rows = [
      ['RM|L1', 'remove', 'Clothes', 'Sample jumper', JSON.stringify({ platform: 'eBay', photo: 'https://i.ebayimg.com/images/g/ABC/s-l300.jpg' }), ago(5)],
      ['RM|L2', 'remove', 'Clothes', 'Sample coat', JSON.stringify({ platform: 'Vinted', photo: '1AbCdEfGhIjKlMnOpQrStUvWxYz' }), ago(5)],
      ['RM|L3', 'remove', 'Clothes', 'Sample hat', JSON.stringify({ platform: 'Vinted', photo: 'https://evil.example/x.jpg' }), ago(5)],
    ];
    await sheets(page, rows);
    await open(page, '#/remove');
    await page.locator('[data-action="all"]').click();
    await expect(page.locator('#view .item img[src^="https://i.ebayimg.com/images/g/ABC/"]')).toHaveCount(1);
    await expect(page.locator('#view .item img[src*="drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOpQrStUvWxYz"]')).toHaveCount(1);
    await expect(page.locator('#view img[src*="evil.example"]')).toHaveCount(0);
  });
  test('V2 tabs: Home shows Do now / Decide / Reply counts; old links still open and light up their tab', async ({ page }) => {
    const rows = [
      ['RM|L1', 'remove', 'Clothes', 'Sample jumper', JSON.stringify({ platform: 'eBay' }), ago(5)],
      ['LINK|L2|L3', 'check', 'Clothes', 'Sample coat', JSON.stringify({ platform: 'Vinted', why: 'Same item?' }), ago(5)],
      ['GO|L4', 'go', 'Clothes', 'Sample hat', JSON.stringify({ platform: 'eBay' }), ago(5)],
      ['MSG|ebay|m1', 'message', 'Clothes', 'eBay message: Sample jumper', JSON.stringify({ platform: 'eBay' }), ago(5)],
    ];
    await sheets(page, rows);
    await open(page);
    await expect(page.locator('#tabs a')).toHaveText([/Home/, /Do now/, /Decide/, /Reply/, /Insights/]);
    await expect(page.locator('#view a.tile')).toHaveText([/1\s*Do now/, /2\s*Decide/, /1\s*Reply/]);
    await expect(page.locator('#n-decide')).toHaveText('2');
    await page.locator('#tabs a[data-nav="decide"]').click();
    await expect(page.locator('#view .needs')).toHaveText('Decide: 2');
    await expect(page.locator('#view > .card')).toHaveCount(1);               // one question at a time
    await expect(page.locator('#view .more')).toHaveText('1 of 2 · show all');
    await page.goto('marketplace/#/check');
    await expect(page.locator('#tabs a[data-nav="decide"]')).toHaveAttribute('aria-current', 'page');
    await page.goto('marketplace/#/numbers');
    await expect(page.locator('#tabs a[data-nav="insights"]')).toHaveAttribute('aria-current', 'page');
  });

  test('person chips: hidden until a card has another owner; picking CY shows only CY\'s cards and is remembered', async ({ page }) => {
    const rows = [
      ['RM|L1', 'remove', 'Clothes', 'Lisa jumper', JSON.stringify({ platform: 'eBay' }), ago(5)],
      ['RM|L2', 'remove', 'Clothes', 'CY dress', JSON.stringify({ platform: 'Vinted', owner: 'CY' }), ago(5)],
    ];
    await sheets(page, rows);
    await open(page, '#/do');
    await expect(page.locator('#people')).toBeVisible();
    await expect(page.locator('#view .needs')).toHaveText('Do now: 2');
    await page.locator('[data-who="CY"]').click();
    await expect(page.locator('[data-who="CY"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#view .needs')).toHaveText('Do now: 1');
    await expect(page.locator('#view')).toContainText('CY dress');
    await expect(page.locator('#view')).not.toContainText('Lisa jumper');
    await page.reload();
    await expect(page.locator('[data-who="CY"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-site="eBay"]').click();                         // site chips narrow it further
    await expect(page.locator('#view .needs')).toHaveText('Do now: 0');
  });

  test('packing mode: parcels in shelf order with parcel numbers; Found writes "Found", a found parcel shows its drop-off code and Posted', async ({ page }) => {
    const rows = [
      ['POST|2', 'post', 'Clothes', 'Sample coat', JSON.stringify({ shelf: 'C3', courier: 'Evri', post_by: 'Tue' }), ago(5)],
      ['POST|1', 'post', 'Clothes', 'Sample lead', JSON.stringify({ shelf: 'A1', courier: 'InPost', post_by: 'Mon', found: true, qr: 'VN-55210' }), ago(5)],
    ];
    const writes = await sheets(page, rows);
    await open(page, '#/do');
    await page.locator('[data-action="pack"]').click();
    await expect(page.locator('#view .packbar')).toContainText('Packing · 1 of 2');
    await expect(page.locator('#view .parcel')).toHaveText('#1');
    await expect(page.locator('#view')).toContainText('Sample lead');          // shelf A1 before C3
    await expect(page.locator('#view .dropcode .code')).toHaveText('VN-55210');
    await expect(page.locator('#view [data-v="Posted"]')).toBeVisible();
    await page.locator('[data-action="nextpack"]').click();
    await expect(page.locator('#view .parcel')).toHaveText('#2');
    await page.locator('[data-ans="POST|2"][data-v="Found"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].range).toBe('Marketplace!G2:J2'); expect(writes[0].body.values[0][0]).toBe('Found');
    await page.locator('[data-action="stoppack"]').click();
    await expect(page.locator('#view .needs')).toContainText('Do now');
  });

  test('label sheet: parcels grouped by courier with their numbers; says plainly when the PDF is not made yet', async ({ page }) => {
    const rows = [
      ['POST|1', 'post', 'Clothes', 'Sample lead', JSON.stringify({ shelf: 'A1', courier: 'InPost' }), ago(5)],
      ['POST|2', 'post', 'Clothes', 'Sample coat', JSON.stringify({ shelf: 'B2', courier: 'Evri' }), ago(5)],
      ['POST|3', 'post', 'Clothes', 'Sample boots', JSON.stringify({ shelf: 'C3', courier: 'Evri' }), ago(5)],
    ];
    await sheets(page, rows);
    await open(page, '#/do');
    await page.locator('[data-action="sheet"]').click();
    await expect(page.locator('#view .grp')).toHaveText(['Evri · 2 parcels', 'InPost · 1 parcel']);
    await expect(page.locator('#view .card .parcel')).toHaveText(['#2', '#3', '#1']);
    await expect(page.locator('#view')).toContainText('The printable PDF is not made yet');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
  test('"Same item?" card shows both photos side by side, big, each opening full size; the eBay photo comes from the listings file', async ({ page }) => {
    await page.route(/i\.ebayimg\.com|drive\.google\.com\/thumbnail/, (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' }));
    const csv = 'COUNT: 2 rows held\nlisting_id,item_sku,platform,title,image_url\nL0020,,Vinted,"Rascal watch, green case",\nL0156,,eBay,"Linus and Lucy watch, green case",https://i.ebayimg.com/images/g/LpsA/s-l300.jpg\n';
    const rows = [['LINK|L0020|L0156', 'check', 'Other', 'Rascal watch', JSON.stringify({ kind: 'link', platform: 'Vinted', photo: '1AbCdEfGhIjKlMnOpQrStUvWxYz', why: 'Same item as on eBay?' }), ago(5)]];
    await sheets(page, rows);
    await page.route(/googleapis\.com\/drive\/v3\/files\/1JkewFinU42nKX7JDEwRHZY0I-FKdBhdW\?alt=media/, (route) => route.fulfill({ status: 200, contentType: 'text/csv', body: csv }));
    await open(page, '#/decide');
    await expect(page.locator('#view .pair figure')).toHaveCount(2);
    await expect(page.locator('#view .pair figcaption')).toHaveText(['Vinted · L0020', 'eBay · L0156']);
    await expect(page.locator('#view .pair img[src*="drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOpQrStUvWxYz&sz=w600"]')).toHaveCount(1);
    await expect(page.locator('#view .pair img[src="https://i.ebayimg.com/images/g/LpsA/s-l500.jpg"]')).toHaveCount(1);
    await expect(page.locator('#view .pair a').nth(1)).toHaveAttribute('href', 'https://i.ebayimg.com/images/g/LpsA/s-l1600.jpg');
    await page.setViewportSize({ width: 390, height: 844 });
    const box = await page.locator('#view .pair img').first().boundingBox();
    expect(box.width).toBeGreaterThan(140);                                     // big enough to read "7F" against "10"
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
