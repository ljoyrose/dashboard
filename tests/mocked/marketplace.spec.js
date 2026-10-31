// Marketplace page (24 Oct 2026): Needs-you count, one main card, taps write only the 4 answer cells, Undo, Stock round,
// colours only from tokens.css, phone width. Pretend Google only; the sheet rows below are invented.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('../support/test');

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8'), ctx);
const CFG = ctx.window.DASH_CONFIG; // the listings id and Lisa's address come from config.js (the only place the privacy allow-list permits them)
const reEsc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LISTINGS = new RegExp('googleapis\\.com/drive/v3/files/' + reEsc(CFG.marketplace.listingsFileId) + '\\?alt=media');

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
    // Every colour name used comes from the page itself or from the two shared files (tokens.css numbers, house.css names).
    const shared = fs.readFileSync(path.join(__dirname, '..', '..', 'tokens.css'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', '..', 'house.css'), 'utf8');
    expect(SRC).toContain('<link rel="stylesheet" href="../house.css">');
    for (const v of css.match(/var\(--[\w-]+/g) || []) {
      const name = v.slice(4);
      expect(/^--ljr-/.test(name) || new RegExp(name + '\\s*:').test(css) || new RegExp(name + '\\s*:').test(shared), name).toBe(true);
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
  test('public pages hold no email address: no "@" address, no login_hint, no authuser (Stage 0A, D1 = B) @regression', async () => {
    for (const f of ['index.html', 'privacy.html']) {
      const src = fs.readFileSync(path.join(__dirname, '..', '..', 'marketplace', f), 'utf8');
      expect(src, f).not.toMatch(/[A-Za-z0-9._+-]+(@|%40)[A-Za-z0-9-]+\.[A-Za-z]{2,}/);
      expect(src, f).not.toMatch(/login_hint|authuser/);   // mailto addresses are caught by the line above
    }
  });
  test('signed out, signed in on every tab, and the privacy page: no email address in the shown text or any link @regression', async ({ page }) => {
    const ADDR = /[A-Za-z0-9._+-]+(@|%40)[A-Za-z0-9-]+\.[A-Za-z]{2,}/;
    const shown = () => page.evaluate(() => document.body.innerText + '\n' + [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).join('\n'));
    await sheets(page, sampleRows());
    await page.goto('marketplace/#/me');
    expect(await shown(), 'signed out').not.toMatch(ADDR);
    await open(page, '#/me');
    for (const tab of ['#/me', '#/do', '#/decide', '#/reply', '#/insights']) {
      await page.goto('marketplace/' + tab);
      await expect(page.locator('#view')).toBeVisible();
      expect(await shown(), tab).not.toMatch(ADDR);
    }
    await page.goto('marketplace/privacy.html');
    expect(await shown(), 'privacy').not.toMatch(ADDR);
  });
  test('privacy policy page: public (no sign-in, no scripts), names the contact, says buyer details are not stored, tokens.css colours only', async ({ page }) => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'marketplace', 'privacy.html'), 'utf8');
    expect(src).not.toMatch(/<script/i);
    expect(src).toContain('<meta name="robots" content="noindex, nofollow">');   // opens by link, never listed by search engines
    expect(src.replace(/<!--[\s\S]*?-->/g, '')).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    await page.goto('marketplace/privacy.html');
    await expect(page.locator('h1')).toHaveText('Privacy policy');
    await expect(page.locator('main a', { hasText: 'contact page on the website' }).first()).toBeVisible();
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
  test('every card says when it was last updated: the engine\'s updated_at, else when the card was made (UK time)', async ({ page }) => {
    const rows = [['NEW|ebay|1', 'check', '', 'Sample fairy book', JSON.stringify({ kind: 'new', platform: 'eBay', url: 'https://www.ebay.co.uk/itm/1', price: '£2.75', qty: 1, updated_at: '2026-10-28T09:05:00Z' }), '2026-10-27T11:12:59Z'],
      ['NEW|ebay|2', 'check', '', 'Sample socks', JSON.stringify({ kind: 'new', platform: 'eBay', url: 'https://www.ebay.co.uk/itm/2', price: '£9.25', qty: 1 }), '2026-10-27T11:12:59Z']];
    await sheets(page, rows);
    await open(page, '#/check');
    await page.locator('#view', { hasText: 'show all' }).getByText('show all').click().catch(() => {});
    await expect(page.locator('#view')).toContainText('Updated Wed 28 Oct, 09:05');
    await expect(page.locator('#view')).toContainText('Updated Tue 27 Oct, 11:12');
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
    await expect(page.locator('#view .needs3 a.tile')).toHaveText([/1\s*Do now/, /2\s*Decide/, /1\s*Reply/]);
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

  test('Numbers: a tile whose profit is only partly known shows the engine\'s words ("from 1 of 2 sales", "?"), money tiles still show £', async ({ page }) => {
    const k = { tiles: [{ key: 'profit_p', label: 'Profit this month', value: '£8.40 from 1 of 2 sales', arrow: 'flat' }, { key: 'takings_p', label: 'Takings this month', value: 3820, arrow: 'up' },
      { key: 'avg_profit_p', label: 'Profit per item', value: '?', arrow: 'flat' }], byCategory: [] };
    await sheets(page, [['KPI', 'kpi', '', 'Numbers', JSON.stringify(k), ago(5)]]);
    await open(page, '#/numbers');
    await expect(page.locator('#view .tile')).toHaveCount(3);
    await expect(page.locator('#view .tile').nth(0)).toContainText('£8.40 from 1 of 2 sales');
    await expect(page.locator('#view .tile').nth(1)).toContainText('£38.20');
    await expect(page.locator('#view .tile').nth(2)).toContainText('?');
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
    const csv = 'COUNT: 2 rows held\nlisting_id,item_sku,platform,platform_item_id,url,title,image_url\nL0020,,Vinted,7001,https://www.vinted.co.uk/items/7001,"Rascal watch, green case",\nL0156,,eBay,226000000156,,"Linus and Lucy watch, green case",https://i.ebayimg.com/images/g/LpsA/s-l300.jpg\n';
    const rows = [['LINK|L0020|L0156', 'check', 'Other', 'Rascal watch', JSON.stringify({ kind: 'link', platform: 'Vinted', photo: '1AbCdEfGhIjKlMnOpQrStUvWxYz', why: 'Same item as on eBay?' }), ago(5)]];
    await sheets(page, rows);
    await page.route(LISTINGS, (route) => route.fulfill({ status: 200, contentType: 'text/csv', body: csv }));
    await open(page, '#/decide');
    await expect(page.locator('#view .pair figure')).toHaveCount(2);
    await expect(page.locator('#view .pair figcaption')).toHaveText(['Vinted · L0020', 'eBay · L0156']);
    await expect(page.locator('#view .pair img[src*="drive.google.com/thumbnail?id=1AbCdEfGhIjKlMnOpQrStUvWxYz&sz=w600"]')).toHaveCount(1);
    await expect(page.locator('#view .pair img[src="https://i.ebayimg.com/images/g/LpsA/s-l500.jpg"]')).toHaveCount(1);
    await expect(page.locator('#view .pair figure').nth(1).locator('a').first()).toHaveAttribute('href', 'https://i.ebayimg.com/images/g/LpsA/s-l1600.jpg');
    await expect(page.locator('#view .pair a.btn')).toHaveText(['Open on Vinted', 'Open on eBay']);                 // the listings themselves, not the pictures
    await expect(page.locator('#view .pair a.btn').nth(0)).toHaveAttribute('href', 'https://www.vinted.co.uk/items/7001');
    await expect(page.locator('#view .pair a.btn').nth(1)).toHaveAttribute('href', 'https://www.ebay.co.uk/itm/226000000156');
    await page.setViewportSize({ width: 390, height: 844 });
    const box = await page.locator('#view .pair img').first().boundingBox();
    expect(box.width).toBeGreaterThan(140);                                     // big enough to read "7F" against "10"
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
  test('"Same item?" card naming a listing added after the page read the list: Refresh reads the list again and the eBay photo and button appear', async ({ page }) => {
    await page.clock.install();
    await page.route(/i\.ebayimg\.com|drive\.google\.com\/thumbnail/, (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' }));
    const head = 'COUNT: 2 rows held\nlisting_id,item_sku,platform,platform_item_id,url,title,image_url\nL0033,,Vinted,8960468971,https://www.vinted.co.uk/items/8960468971,Socks,\n';
    let csv = head, reads = 0;
    const rows = [['LINK|L0033|L0225', 'check', 'Clothes', 'Socks', JSON.stringify({ kind: 'link', platform: 'Vinted', why: 'Same item as on eBay?' }), ago(5)]];
    await sheets(page, rows);
    await page.route(LISTINGS, (route) => { reads++; route.fulfill({ status: 200, contentType: 'text/csv', body: csv }); });
    await open(page, '#/decide');
    await expect(page.locator('#view .pair figure').nth(1)).toContainText('No photo');
    csv = head + 'L0225,,ebay,318328514007,https://www.ebay.co.uk/itm/318328514007,5 Pairs Sheer Socks,https://i.ebayimg.com/images/g/BqQA/s-l300.jpg\n';
    await page.clock.fastForward(61000);
    await page.locator('#refresh').click();
    await expect(page.locator('#view .pair img[src="https://i.ebayimg.com/images/g/BqQA/s-l500.jpg"]')).toHaveCount(1);
    await expect(page.locator('#view .pair a.btn').nth(1)).toHaveAttribute('href', 'https://www.ebay.co.uk/itm/318328514007');
    expect(reads).toBe(2);
  });
  test('"Same item?" Yes with a total: the quantity goes in the note as "qty 4"; blank stays blank; not a number is refused', async ({ page }) => {
    const rows = [['LINK|L0018|L0155', 'check', 'Other', 'Olaf watch', JSON.stringify({ kind: 'link', platform: 'Vinted', why: 'Same item as on eBay?' }), ago(5)],
                  ['LINK|L0020|L0156', 'check', 'Other', 'Rascal watch', JSON.stringify({ kind: 'link', platform: 'Vinted', why: 'Same item?' }), ago(5)]];
    const writes = await sheets(page, rows);
    await open(page, '#/check');
    await page.locator('[data-action="all"]').click();
    await page.locator('[data-qty="LINK|L0018|L0155"]').fill('two');
    await page.locator('[data-ans="LINK|L0018|L0155"][data-v="Yes"]').click();
    await expect(page.locator('#banner')).toContainText('Type a number');
    await page.locator('[data-qty="LINK|L0018|L0155"]').fill('4');
    await page.locator('[data-ans="LINK|L0018|L0155"][data-v="Yes"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.values[0].slice(0, 2)).toEqual(['Yes', 'qty 4']);
    await page.locator('[data-ans="LINK|L0020|L0156"][data-v="No"]').click();
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[1].body.values[0].slice(0, 2)).toEqual(['No', '']);
  });

  test('Stock page: have / on order / min per code; Low and No-count chips; search; Count, Ordered and Settings each write one answer', async ({ page }) => {
    const rows = [
      ['ST|CASE-BLUE', 'stock', 'Other', 'Blue roll case', JSON.stringify({ item_sku: 'CASE-BLUE', have: 1, on_order: 0, min: 2, reorder: 6, low: true, url: 'https://www.temu.com/blue-roll-case-g-123.html', buy_at: '£1.00', price_now: '£0.95', buy_now: true, listings: 1 }), ago(5)],
      ['ST|SKU-0050', 'stock', 'Other', 'Olaf reverse watch', JSON.stringify({ item_sku: 'SKU-0050', have: '', unknown: true, on_order: 0, min: '', listings: 2 }), ago(5)],
      ['ST|SKU-0060', 'stock', 'Clothes', 'Grey jumper', JSON.stringify({ item_sku: 'SKU-0060', have: 3, on_order: 0, min: '', listings: 1 }), ago(5)],
    ];
    const writes = await sheets(page, rows);
    await open(page, '#/insights');
    await expect(page.locator('#view a.tile[href="#/stock"]')).toContainText('1');
    await page.locator('#view a.tile[href="#/stock"]').click();
    await expect(page.locator('#view .stockrow')).toHaveCount(3);
    await expect(page.locator('#tabs a[data-nav="insights"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#view .verdict.go')).toHaveText('Buy now: at or below your £1.00');
    await page.locator('[data-sfilter="unknown"]').click();
    await expect(page.locator('#view .stockrow')).toHaveCount(1);
    await page.locator('[data-sfilter="all"]').click();
    await page.locator('[data-find]').fill('jumper');
    await expect(page.locator('#view .stockrow:visible')).toHaveCount(1);
    await page.locator('[data-find]').fill('');
    await page.locator('[data-op="Count"][data-opkey="ST|SKU-0050"]').click();
    await expect(page.locator('#banner')).toContainText('Type how many first');
    await page.locator('[data-opin="ST|SKU-0050"]').fill('4');
    await page.locator('[data-op="Count"][data-opkey="ST|SKU-0050"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].range).toBe('Marketplace!G3:J3'); expect(writes[0].body.values[0][0]).toBe('Count 4');
    await page.locator('.stockrow', { hasText: 'Blue roll case' }).locator('details:not(.madeof) > summary').click();
    await page.locator('[data-setin="ST|CASE-BLUE"]').fill('min 2, reorder 6, buy at 1.20');
    await page.locator('[data-set="ST|CASE-BLUE"]').click();
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[1].body.values[0].slice(0, 2)).toEqual(['Set', 'min 2, reorder 6, buy at 1.20']);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('Temu order list: buy-now items first with the exact link and price; Wait when above the buy-at price; coupons with Copy code; Ordered writes "Ordered 6"', async ({ page }) => {
    const rows = [
      ['RS|SKU-1', 'restock', 'Other', 'Wait item', JSON.stringify({ item_sku: 'SKU-1', have: 0, on_order: 0, min_stock: 2, buy: 4, last_cost: '£1.10', buy_at: '£1.00', price_now: '£1.25', buy_now: false, url: 'https://www.temu.com/a-g-1.html' }), ago(5)],
      ['RS|SKU-2', 'restock', 'Other', 'Buy item', JSON.stringify({ item_sku: 'SKU-2', have: 1, on_order: 0, min_stock: 2, buy: 6, last_cost: '£1.05', buy_at: '£1.00', price_now: '£0.95', buy_now: true, url: 'https://www.temu.com/b-g-2.html' }), ago(5)],
      ['CP|30% off|SAVE30|2026-10-25', 'temu', 'Other', 'Temu 30% off · code SAVE30', JSON.stringify({ kind: 'coupon', off: '30% off', code: 'SAVE30', min_spend: '£20.00', expires: '2026-11-02' }), ago(5)],
    ];
    const writes = await sheets(page, rows);
    await open(page, '#/temu');
    await expect(page.locator('#view .needs')).toHaveText('Temu order list: 2');
    await expect(page.locator('#view .card .item .t').first()).toContainText('Buy item');
    await expect(page.locator('#view .verdict.go')).toHaveText('Buy now: at or below your £1.00');
    await expect(page.locator('#view .verdict.wait')).toHaveText('Wait: £1.25 is above your £1.00');
    await expect(page.locator('#view a', { hasText: 'Open on Temu' }).first()).toHaveAttribute('href', 'https://www.temu.com/b-g-2.html');
    await expect(page.locator('#view')).toContainText('About £10.70');
    await expect(page.locator('[data-copycode="SAVE30"]')).toBeVisible();
    await expect(page.locator('#view')).toContainText('orders over £20.00 · ends 2026-11-02');
    await page.locator('[data-opin="RS|SKU-2"]').fill('6');
    await page.locator('[data-op="Ordered"][data-opkey="RS|SKU-2"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].range).toBe('Marketplace!G3:J3'); expect(writes[0].body.values[0][0]).toBe('Ordered 6');
  });
  test('engine v11 New product? card: both VAT profit lines (headline bold, warning red), best and runner-up, the order gap; Yes writes the quantity', async ({ page }) => {
    const np = { kind: 'newprod', code: 'H1', supplier: 'Sample Supplier', lines: ['Buy £10.00 + VAT £2.00 (20%) = £12.00 from Sample Supplier (delivered)', 'Sell £24.99 (VAT inside £4.17) · after fees and postage £18.24',
      '▶ Not VAT-registered: profit £6.24 (input VAT £2.00 is a cost)', 'VAT-registered: profit £4.07 (pay £4.17 output VAT, reclaim £2.00)', '⚠ Loses money if VAT-registered'],
      best: 'Sample Supplier £12.00 inc VAT', runner_up: 'Other £12.50', moq: '1', case_cost: '£72.00 for 6', gap: 'Below the £100.00 minimum: add £88.00', sell_basis: 'RRP (not yet checked against eBay sold prices)' };
    const rows = [['NP|Sample Supplier|h1', 'newprod', 'Other', 'Sample harness (4 sizes/colours)', JSON.stringify(np), ago(5)]];
    const writes = await sheets(page, rows);
    await open(page, '#/decide');
    await expect(page.locator('#view .grp').first()).toHaveText('New product?');
    await expect(page.locator('#view ul.money li.head')).toHaveText('▶ Not VAT-registered: profit £6.24 (input VAT £2.00 is a cost)');
    await expect(page.locator('#view ul.money li.red')).toHaveText('⚠ Loses money if VAT-registered');
    await expect(page.locator('#view ul.money li')).toHaveCount(5);
    await expect(page.locator('#view')).toContainText('Below the £100.00 minimum: add £88.00');
    await expect(page.locator('#view .fact', { hasText: 'Runner-up' })).toContainText('Other £12.50');
    await page.locator('[data-note="NP|Sample Supplier|h1"]').fill('6');
    await page.locator('[data-ans="NP|Sample Supplier|h1"][data-v="Yes"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].range).toBe('Marketplace!G2:J2'); expect(writes[0].body.values[0].slice(0, 2)).toEqual(['Yes', '6']);
  });

  test('engine v11 supplier cards: terms questions need text before Save; a price list behind a link opens it and the 6 TRADE folder; a receipt shows unmatched lines in red', async ({ page }) => {
    const rows = [
      ['SUP|Sample Wholesale|min_order,phone', 'supplier', '', 'Sample Wholesale: 2 things to fill in', JSON.stringify({ kind: 'terms', supplier: 'Sample Wholesale', asks: [{ field: 'min_order', ask: 'Minimum order £ (ex VAT)? 0 if none' }, { field: 'phone', ask: 'Their phone number?' }], example: 'min 100, phone 01234 567890' }), ago(5)],
      ['LINK|m8', 'supplier', '', 'New Sample Supplier price list: download it', JSON.stringify({ kind: 'link', url: 'https://files.example/s/abc', folder: 'https://drive.google.com/drive/folders/TRADEFOLDERID', why: 'Open the link, download the file, then drop it in 6 TRADE.' }), ago(5)],
      ['RC|J1', 'receipt', '', 'Add to stock? Sample Wholesale 2026-10-25', JSON.stringify({ kind: 'receipt', lines: [{ title: 'Sample ball', qty: '6', unit_cost: '2.10', sku: 'SKU-9' }, { title: 'Mystery line', qty: '2', unit_cost: '1.00', sku: '' }] }), ago(5)],
      ['javascript-link', 'supplier', '', 'Bad link', JSON.stringify({ kind: 'link', url: 'javascript:alert(1)' }), ago(5)],
    ];
    const writes = await sheets(page, rows);
    await open(page, '#/decide');
    await page.locator('[data-action="all"]').click();
    const terms = page.locator('.card', { hasText: '2 things to fill in' });
    await expect(terms.locator('ul.asks li')).toHaveCount(2);
    await terms.locator('[data-v="Set"]').click();
    await expect(page.locator('#banner')).toContainText('Type what to change first');
    expect(writes).toEqual([]);
    await terms.locator('[data-note]').fill('min 50, phone 0113 000 0000');
    await terms.locator('[data-v="Set"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.values[0].slice(0, 2)).toEqual(['Set', 'min 50, phone 0113 000 0000']);
    const link = page.locator('.card', { hasText: 'download it' });
    await expect(link.locator('a', { hasText: 'Open the link' })).toHaveAttribute('href', 'https://files.example/s/abc');
    await expect(link.locator('a', { hasText: 'Open 6 TRADE' })).toHaveAttribute('href', 'https://drive.google.com/drive/folders/TRADEFOLDERID');
    await expect(page.locator('.card', { hasText: 'Bad link' }).locator('a', { hasText: 'Open the link' })).toHaveCount(0);   // only https links
    const rc = page.locator('.card', { hasText: 'Add to stock?' });
    await expect(rc.locator('.why.red')).toHaveText('2 × £1.00 · not matched to a product');
    await expect(rc.locator('.why:not(.red)')).toHaveText('6 × £2.10 · SKU-9');
  });

  test('engine v11 Suppliers page: account number copies, phone calls, terms, order list with the gap, missing terms in red; Settings writes Set + note', async ({ page }) => {
    const sd = { kind: 'supplier', supplier: 'Sample Supplier', account_no: 'AB-123', phone: '01234 567890', order_email: 'orders@supplier.example', min_order: '100', free_over: '300', delivery: '15',
      prices: 386, list_date: '2026-02-01', stale: true, order: [{ code: 'H1', title: 'Sample harness', qty: '4' }], basket: '£46.00', gap: 'Below the £100.00 minimum: add £54.00', missing: ['Their phone number?'] };
    const rows = [['SUPP|Sample Supplier', 'suppliers', '', 'Sample Supplier', JSON.stringify(sd), ago(5)]];
    const writes = await sheets(page, rows);
    await open(page, '#/insights');
    await page.locator('#view a', { hasText: 'Suppliers (1)' }).click();
    await expect(page.locator('#view .needs')).toHaveText('Suppliers');
    await expect(page.locator('#tabs a[data-nav="insights"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-copycode="AB-123"]')).toHaveText('Account AB-123');
    await expect(page.locator('#view a', { hasText: 'Call 01234 567890' })).toHaveAttribute('href', 'tel:01234567890');
    await expect(page.locator('#view a', { hasText: 'Email orders' })).toHaveAttribute('href', 'mailto:orders@supplier.example');
    await expect(page.locator('#view .fact', { hasText: 'Free from' })).toContainText('£300');
    await expect(page.locator('#view .verdict.wait')).toContainText('over 60 days old');
    await expect(page.locator('#view')).toContainText('Below the £100.00 minimum: add £54.00');
    await expect(page.locator('#view .what.red')).toHaveText('Missing: Their phone number?');
    await page.locator('#view summary').click();
    await page.locator('[data-note="SUPP|Sample Supplier"]').fill('free over 250');
    await page.locator('[data-ans="SUPP|Sample Supplier"][data-v="Set"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.values[0].slice(0, 2)).toEqual(['Set', 'free over 250']);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('engine v11: Brands to source offers Find and a ready email; VAT card shows the line; a job the AI could not do is in Do now', async ({ page }) => {
    const rows = [
      ['LEARN|puppystim', 'learn', '', 'Puppystim: get a trade price?', JSON.stringify({ kind: 'find', brand: 'Puppystim', titles: ['Calming spray'], ask: { mailto: 'mailto:?subject=Trade%20account%20enquiry%3A%20Puppystim&body=Hello' } }), ago(5)],
      ['VAT|75', 'vat', '', 'VAT: 77% of the £90,000 threshold', JSON.stringify({ kind: 'vat', line: 'Sales last 12 months: £70000.00 of £90000.00 (77%)', why: 'Tell your accountant.' }), ago(5)],
      ['JOB|J2', 'job', '', 'Receipt: type the lines (code, qty, cost)', JSON.stringify({ kind: 'job', file_ids: 'FILEID12345678901234567' }), ago(5)],
    ];
    const writes = await sheets(page, rows);
    await open(page, '#/decide');
    await page.locator('[data-action="all"]').click();
    await expect(page.locator('#view a', { hasText: 'Write the email' })).toHaveAttribute('href', /^mailto:\?subject=Trade%20account%20enquiry/);
    await expect(page.locator('#view .verdict.wait')).toHaveText('Sales last 12 months: £70000.00 of £90000.00 (77%)');
    await page.locator('[data-ans="LEARN|puppystim"][data-v="Find"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.values[0][0]).toBe('Find');
    await page.goto('marketplace/#/do');
    await expect(page.locator('#view')).toContainText('Receipt: type the lines');
    await expect(page.locator('#view a', { hasText: 'Open file' })).toHaveAttribute('href', 'https://drive.google.com/file/d/FILEID12345678901234567/view');
  });

  test('engine v11 Send offer: price, price after the % off and profit left; the % box refuses under 5; Send writes the % in the note', async ({ page }) => {
    const od = { kind: 'offer', listing_id: '110000000007', pct: 10, price: '£12.99', after: '£11.69', profit_left: '£4.20', url: 'https://www.ebay.co.uk/itm/110000000007', why: 'Buyers are watching this. Send them 10% off (£11.69)?' };
    const rows = [['OFFER|110000000007|2026-10-26', 'offer', 'Health & supplements', 'Sample shampoo 500ml', JSON.stringify(od), ago(5)]];
    const writes = await sheets(page, rows);
    await open(page, '#/decide');
    await expect(page.locator('#view .grp').first()).toHaveText('Send offer');
    await expect(page.locator('#view .fact', { hasText: 'After 10% off' })).toContainText('£11.69');
    await expect(page.locator('#view .fact', { hasText: 'Profit left' })).toContainText('£4.20');
    await expect(page.locator('#view a', { hasText: 'Open on eBay' })).toHaveAttribute('href', 'https://www.ebay.co.uk/itm/110000000007');
    await page.locator('[data-note="OFFER|110000000007|2026-10-26"]').fill('3');
    await page.locator('[data-v="Send"]').click();
    await expect(page.locator('#banner')).toContainText('between 5 and 90');
    expect(writes).toEqual([]);
    await page.locator('[data-note="OFFER|110000000007|2026-10-26"]').fill('15');
    await page.locator('[data-v="Send"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.values[0].slice(0, 2)).toEqual(['Send', 'pct=15']);
  });

  test('engine v11.1 offers: "always for this item" saves the % and min profit; min profit takes £ or %; Offer terms card agrees once', async ({ page }) => {
    const od = { kind: 'offer', listing_id: '110000000007', pct: 5, price: '£12.99', after: '£12.34', profit_left: '£4.20', min_profit: '£3', rule: 'Default 5%', url: 'https://www.ebay.co.uk/itm/110000000007' };
    const td = { kind: 'terms', listing_id: '110000000009', pct: 5, price: '£80.00', url: 'https://www.ebay.co.uk/itm/110000000009' };
    const rows = [['OFFER|110000000007|2026-10-27', 'offer', 'Health & supplements', 'Sample shampoo 500ml', JSON.stringify(od), ago(5)],
      ['TERMS|110000000009', 'offer', 'Books', 'Offer terms: Sample first edition', JSON.stringify(td), ago(4)]];
    const writes = await sheets(page, rows);
    await open(page, '#/decide');
    await page.locator('[data-action="all"]').click();
    await expect(page.locator('#view')).toContainText('Default 5%');
    await page.locator('[data-min="OFFER|110000000007|2026-10-27"]').fill('lots');
    await page.locator('[data-ans="OFFER|110000000007|2026-10-27"][data-v="Always"]').click();
    await expect(page.locator('#banner')).toContainText('£20');
    expect(writes).toEqual([]);
    await page.locator('[data-note="OFFER|110000000007|2026-10-27"]').fill('8');
    await page.locator('[data-min="OFFER|110000000007|2026-10-27"]').fill('25%');
    await page.locator('[data-ans="OFFER|110000000007|2026-10-27"][data-v="Always"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.values[0].slice(0, 2)).toEqual(['Always', 'pct=8;min=25%']);
    await expect(page.locator('[data-ans="TERMS|110000000009"][data-v="Always"]')).toHaveText('Agree: automatic');
    await page.locator('[data-min="TERMS|110000000009"]').fill('£20');
    await page.locator('[data-ans="TERMS|110000000009"][data-v="Always"]').click();
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[1].body.values[0].slice(0, 2)).toEqual(['Always', 'min=£20']);
  });

  test('answered cards leave the list at once and wait in "Just done" (with Undo) at the bottom', async ({ page }) => {
    const rows = [['LINK|L1|L2', 'check', 'Other', 'Sample golf balls', JSON.stringify({ kind: 'missing', platform: 'eBay', why: 'Live on eBay but missing from your list. Add it?' }), ago(5)],
      ['LINK|L3|L4', 'check', 'Other', 'Sample watch', JSON.stringify({ kind: 'missing', platform: 'eBay', why: 'Live on eBay but missing from your list. Add it?' }), ago(4)]];
    rows[0].push('Yes', '', new Date().toISOString(), 'sample@example.com');
    await sheets(page, rows);
    await open(page, '#/decide');
    await expect(page.locator('#view .card .t').first()).toContainText('Sample watch');
    await expect(page.locator('.justdone summary')).toHaveText('Just done · 1 (Undo for 10 minutes)');
    await page.locator('.justdone summary').click();
    await expect(page.locator('.justdone [data-undo="LINK|L1|L2"]')).toBeVisible();
  });

  test('engine v11.1 postage: cards say who pays in words; a free-postage loss card has Fix on eBay / I fixed it / Leave it; a tapped button shows Saving…', async ({ page }) => {
    const ld = { kind: 'postage_loss', item_id: '318329017011', price: '£2.50', postage: 'seller', post_est: '£3.20', left: '-£1.02', platform: 'eBay', url: 'https://www.ebay.co.uk/itm/318329017011', revise: 'https://www.ebay.co.uk/sl/list?mode=ReviseItem&itemId=318329017011', why: 'FREE postage: you pay about £3.20. At £2.50 you keep -£1.02: a LOSS.' };
    const td = { kind: 'postage_title', item_id: '318237542881', price: '£2.00', postage: 'buyer', buyer_post: '£2.89', platform: 'eBay', url: 'https://www.ebay.co.uk/itm/318237542881', revise: 'https://www.ebay.co.uk/sl/list?mode=ReviseItem&itemId=318237542881', why: 'The title says FREE postage but the buyer is charged £2.89.' };
    const rows = [['PCHK|318329017011|loss|2026-10', 'check', 'Books', 'Sample fairy book - FREE Shipping', JSON.stringify(ld), ago(5)], ['PCHK|318237542881|title|2026-10', 'check', 'Books', 'Sample animals book Free Post', JSON.stringify(td), ago(4)]];
    const writes = await sheets(page, rows);
    await open(page, '#/decide');
    await page.locator('[data-action="all"]').click();
    await expect(page.locator('.m.post.seller')).toHaveText('FREE postage: you pay about £3.20');
    await expect(page.locator('.m.post.buyer')).toHaveText('Buyer pays postage £2.89');
    await expect(page.locator('a[href*="itemId=318329017011"]', { hasText: 'Fix on eBay' })).toHaveCount(1);
    await page.locator('[data-ans="PCHK|318329017011|loss|2026-10"][data-v="Done"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.values[0][0]).toBe('Done');
  });

  test('engine v11.1 post cards: courier band with parcel number and where to take it; Posted needs the number on the parcel; Which parcel? cards stay out of packing', async ({ page }) => {
    const rows = [['PO|vinted|vt-1', 'post', 'Blades & grooming', 'Sample blade', JSON.stringify({ platform: 'vinted', parcel_id: 'L-07', courier: 'Evri', found: true, qr: 'H00IAA0000000001', label_expiry: '2026-11-02 09:00', post_by: '2026-10-29' }), ago(5)],
      ['PO|ebay|11-1', 'post', 'Books', 'Sample CD', JSON.stringify({ platform: 'ebay', parcel_id: 'L-08', courier: '', post_by: '2026-10-23' }), ago(5)],
      ['WP|vinted|JJD1', 'post', 'Other', 'Which parcel? InPost label', JSON.stringify({ kind: 'which_parcel', courier: 'InPost', tracking: 'JJD1', why: 'A label or QR arrived that matches no parcel card.' }), ago(5)]];
    const writes = await sheets(page, rows);
    await open(page, '#/do');
    const band = page.locator('.cband').first();
    await expect(band).toContainText('L-07'); await expect(band.locator('.cn')).toHaveText('Evri'); await expect(band).toContainText('Take to: Evri ParcelShop');
    await expect(page.locator('#view')).toContainText('Label valid until 2026-11-02 09:00');
    await expect(page.locator('.cband', { hasText: 'L-08' }).locator('.cn')).toHaveText('Postage not bought yet');
    await page.locator('[data-pid="PO|vinted|vt-1"]').fill('L-08');
    await page.locator('[data-ans="PO|vinted|vt-1"][data-v="Posted"]').click();
    await expect(page.locator('#banner')).toContainText('wrong parcel');
    expect(writes).toEqual([]);
    await page.locator('[data-pid="PO|vinted|vt-1"]').fill('l-07');
    await page.locator('[data-ans="PO|vinted|vt-1"][data-v="Posted"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.values[0][0]).toBe('Posted');
    await expect(page.locator('[data-ans="WP|vinted|JJD1"][data-v="Done"]')).toHaveText('Sorted it');
    await expect(page.locator('[data-action="pack"]')).toHaveText('Start packing (1)');
  });

  test('Stock "Made of": add an existing part, add a new part with a count, and paste a supplier link; each writes one Set answer', async ({ page }) => {
    const rows = [
      ['ST|SKU-0050', 'stock', 'Other', 'Olaf reverse watch', JSON.stringify({ item_sku: 'SKU-0050', have: 2, on_order: 0, min: '', listings: 2 }), ago(5)],
      ['ST|CASE-BLUE', 'stock', 'Other', 'Blue roll case', JSON.stringify({ item_sku: 'CASE-BLUE', have: 3, on_order: 0, min: '', listings: 0, url: 'https://www.temu.com/x.html', supplier: 'Temu' }), ago(5)]];
    const writes = await sheets(page, rows);
    await open(page, '#/stock');
    const watch = page.locator('.stockrow[data-text*="olaf"]');
    await expect(watch).toContainText('Buy more from'); await expect(watch).toContainText('not set yet');
    await expect(page.locator('.stockrow[data-text*="blue roll"] a', { hasText: 'Open on Temu' })).toHaveAttribute('target', '_blank');
    await watch.locator('summary', { hasText: 'Made of' }).click();
    await expect(watch.locator('.madeof')).toContainText('Just itself (1 of SKU-0050)');
    await watch.locator('[data-partpick]').fill('CASE-BLUE');
    await watch.locator('[data-partadd]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.values[0].slice(0, 2)).toEqual(['Set', 'made of SKU-0050 + CASE-BLUE']);
  });
  test('Stock "Made of": a new part and a supplier link each write one Set answer; a bad code is refused', async ({ page }) => {
    const writes = await sheets(page, [['ST|SKU-0050', 'stock', 'Other', 'Olaf reverse watch', JSON.stringify({ item_sku: 'SKU-0050', have: 2, on_order: 0, min: '', listings: 2 }), ago(5)]]);
    await open(page, '#/stock');
    const watch = page.locator('.stockrow');
    await watch.locator('summary', { hasText: 'Made of' }).click();
    await watch.locator('[data-partpick]').fill('NOPE-1'); await watch.locator('[data-partadd]').click();
    await expect(page.locator('#banner')).toContainText('pick a code'); expect(writes.length).toBe(0);
    await watch.locator('[data-newpart]').fill('green watch case'); await watch.locator('[data-newqty]').fill('3');
    await watch.locator('[data-partnew]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.values[0].slice(0, 2)).toEqual(['Set', 'new part: green watch case, 3']);
  });
  test('Stock "Buy more from": pasting a supplier link writes Set + link', async ({ page }) => {
    const writes = await sheets(page, [['ST|SKU-0050', 'stock', 'Other', 'Olaf reverse watch', JSON.stringify({ item_sku: 'SKU-0050', have: 2, on_order: 0, min: '', listings: 2 }), ago(5)]]);
    await open(page, '#/stock');
    await page.locator('[data-supin]').fill('https://www.amazon.co.uk/dp/B01');
    await page.locator('[data-sup]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.values[0].slice(0, 2)).toEqual(['Set', 'link https://www.amazon.co.uk/dp/B01']);
  });
  test('v11.5 cards explain themselves: sold where and when with steps and the eBay order link; Which parcel? says it is not a sale; Add it shows eBay count, the likely match and Same item; Home shows Orders; every card has its owner badge', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = [['PO|ebay|12-9', 'post', 'Blades & grooming', 'Sample case', JSON.stringify({ platform: 'ebay', order_id: '12-9', parcel_id: 'L-02', courier: 'Unknown', owner: 'CY', sold_at: today, price: '£9.99' }), ago(5)],
      ['WP|vinted|JJD9', 'post', 'Other', 'Which parcel? InPost label', JSON.stringify({ kind: 'which_parcel', courier: 'InPost', tracking: 'JJD9', qr: '123', email_url: 'https://mail.google.com/mail/u/#all/abc' }), ago(5)],
      ['NEW|ebay|999', 'check', 'Other', 'Sample bottle', JSON.stringify({ kind: 'new', item_id: '999', qty: 3, price: '£23.37', url: 'https://www.ebay.co.uk/itm/999', maybe_sku: 'SKU-0049', maybe_title: 'Sample crate bottle', maybe_where: 'Vinted · L0049', why: 'It looks like an item you already have' }), ago(5)]];
    const writes = await sheets(page, rows);
    await open(page, '#/me');
    await expect(page.locator('#view')).toContainText('Orders');
    await expect(page.locator('#view .tiles:not(.needs3) a.tile').first()).toContainText('1');
    await page.evaluate(() => { location.hash = '#/do'; });
    const card = page.locator('.card', { hasText: 'Sample case' });
    await expect(card).toContainText('Sold on eBay'); await expect(card).toContainText('Buy postage on the eBay order');
    await expect(card.locator('a', { hasText: 'Open the order on eBay' })).toHaveAttribute('href', /orderid=12-9/);
    await expect(card.locator('a', { hasText: 'Open the order on eBay' })).toHaveAttribute('target', '_blank');
    await expect(card.locator('.ava')).toHaveText('CY');
    const wp = page.locator('.card', { hasText: 'Which parcel?' });
    await expect(wp).toContainText('Not a new sale'); await expect(wp.locator('a', { hasText: 'Open the email' })).toHaveAttribute('target', '_blank');
    await page.evaluate(() => { location.hash = '#/decide'; });
    const nw = page.locator('.card', { hasText: 'Sample bottle' });
    await expect(nw).toContainText('eBay says for sale'); await expect(nw).toContainText('Looks like: Sample crate bottle');
    await nw.locator('[data-qty]').fill('9');
    await nw.locator('[data-v="Same"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.values[0][0]).toBe('Same'); expect(writes[0].body.values[0][1]).toBe('qty 9');
  });

  test('engine v11.9 What did it cost? card: sold count, last price, source link; Save needs a £ number; Own item and Don\'t know write one answer each', async ({ page }) => {
    const d = { kind: 'cost', item_sku: 'SKU-9', listing_id: 'L9', platform: 'eBay', url: 'https://www.ebay.co.uk/itm/110000000009', price: '£12.00', times_sold: 3, last_price: '£11.00', why: 'Sold 3 times but we do not know what it cost you, so its profit is unknown.' };
    const rows = [['CST|SKU-9', 'cost', 'Other', 'Sample clipper blade', JSON.stringify(d), ago(5)], ['CST|SKU-8', 'cost', 'Other', 'Sample brush', JSON.stringify(Object.assign({}, d, { item_sku: 'SKU-8', times_sold: 0 })), ago(4)],
      ['CST|SKU-7', 'cost', 'Other', 'Sample comb', JSON.stringify(Object.assign({}, d, { item_sku: 'SKU-7' })), ago(3)]];
    const writes = await sheets(page, rows);
    await open(page, '#/decide');
    await page.locator('[data-action="all"]').click();
    const card = page.locator('.card', { hasText: 'Sample clipper blade' });
    await expect(page.locator('#view .grp', { hasText: 'What did it cost?' })).toHaveCount(1);
    await expect(card.locator('.facts')).toContainText('Sold3 times');
    await expect(card.locator('.facts')).toContainText('Last sold at£11.00');
    await expect(card.locator('a[href="https://www.ebay.co.uk/itm/110000000009"]')).toHaveAttribute('target', '_blank');
    await expect(page.locator('.card', { hasText: 'Sample brush' }).locator('.facts')).toContainText('Soldnot yet');
    await card.locator('[data-v="Save"]').click();
    await expect(page.locator('#banner')).toContainText('Type what you paid for one');
    expect(writes.length).toBe(0);
    await card.locator('[data-note="CST|SKU-9"]').fill('£4.5');
    await card.locator('[data-v="Save"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.values[0].slice(0, 2)).toEqual(['Save', '4.5']);
    await page.locator('.card', { hasText: 'Sample brush' }).locator('[data-v="Own"]').click();
    await expect.poll(() => writes.length).toBe(2);
    expect(writes[1].body.values[0][0]).toBe('Own');
    await page.locator('.card', { hasText: 'Sample comb' }).locator('[data-v="Unknown"]').click();
    await expect.poll(() => writes.length).toBe(3);
    expect(writes[2].body.values[0][0]).toBe('Unknown');
  });
  test('engine v11.9 eBay account type card on Numbers: fees and profit both ways, help link, one tap writes Business; never counted as needing you', async ({ page }) => {
    const d = { kind: 'seller_type', now: 'private', other: 'business', line: 'Last 30 days, 2 eBay sales: eBay fees £1.21 as private, £6.17 as business (£4.96 more).', profit_line: 'Profit before postage (1 of 2 sales with a known cost): £10.00 as private, £5.83 as business.', url: 'https://www.ebay.co.uk/help/selling/fees-credits-invoices/selling-fees?id=4822', why: 'Tapping Business changes only these sums; change the account on eBay first.' };
    const writes = await sheets(page, [['SW|ebay_seller_type', 'switch', '', 'eBay account type: private', JSON.stringify(d), ago(5)], ...sampleRows()]);
    await open(page, '#/numbers');
    const card = page.locator('#seller-type');
    await expect(card.locator('h2')).toHaveText('eBay account type: private');
    await expect(card).toContainText('£6.17 as business (£4.96 more)');
    await expect(card).toContainText('£5.83 as business');
    await expect(card.locator('a[href*="id=4822"]')).toHaveAttribute('target', '_blank');
    await card.locator('[data-v="Business"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].body.values[0][0]).toBe('Business');
    await page.goto('marketplace/#/me'); await expect(page.locator('#view .needs')).toHaveText('Needs you: 2');
  });
  test('the last button on a long page can always be scrolled clear of the bottom tab bar @regression', async ({ page }) => {
    const rows = Array.from({ length: 12 }, (_, i) => ['RM|L' + i, 'remove', 'Clothes', 'Sample item ' + i, JSON.stringify({ platform: 'Vinted' }), ago(5)]);
    await sheets(page, rows);
    await open(page, '#/do');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = await page.locator('#view .card').last().boundingBox(), bar = await page.locator('#tabs').boundingBox();
    expect(last.y + last.height).toBeLessThanOrEqual(bar.y);
  });
});

// House look (LINKS-COMFORT-BRIEF v3 + Lisa's extra rules, 28 Oct 2026), checked by computed style in the browser.
// Invented rows only: no buyer names, no real listings.
function lookRows() {
  const day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
  return [
    ['RM|1', 'remove', 'Clothes', 'Sample jacket with a very long title that has to wrap onto a second line and then stop with an ellipsis', JSON.stringify({ platform: 'Vinted', price: '£18.00', url: 'https://www.vinted.co.uk/items/1', sold: 'Sold on eBay 14:02', owner: 'CY' }), ago(5)],
    ['PO|1', 'post', 'Clothes', 'Sample jumper', JSON.stringify({ platform: 'ebay', parcel_id: 'L-07', courier: 'Evri', shelf: 'B2', post_by: day(-1), price: '£22.00' }), ago(5)],
    ['PO|2', 'post', 'Collars & accessories', 'Sample lead', JSON.stringify({ platform: 'vinted', parcel_id: 'L-08', courier: 'InPost', shelf: 'A1', post_by: day(0), price: '£9.00' }), ago(5)],
    ['PO|3', 'post', 'Blades & grooming', 'Sample blade', JSON.stringify({ platform: 'ebay', parcel_id: 'L-09', courier: 'Royal Mail', shelf: 'C3', post_by: day(5), price: '£14.00', photo: 'https://i.ebayimg.com/images/g/ABC/s-l140.jpg' }), ago(5)],
    ['GO|1', 'go', 'Treats', 'Sample treats', JSON.stringify({ price: '£12.00' }), ago(30)],
    ['MSG|1', 'message', 'Clothes', 'Question about: sample jumper', JSON.stringify({ platform: 'eBay', url: 'https://www.ebay.co.uk/cnt/ViewMessage' }), ago(12)],
  ];
}
async function lookSheets(page) {
  await page.route(/i\.ebayimg\.com/, (route) => route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>' }));
  return sheets(page, lookRows());
}
// Runs in the page: every rule that can be read from computed style. Returns a list of plain-word problems.
function auditLook() {
  const out = [];
  const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility === 'visible' && s.display !== 'none'; };
  const rgb = (c) => { const m = /color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)/.exec(c); if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] === undefined ? 1 : +m[4]];
    const n = (c.match(/[\d.]+/g) || []).map(Number); return [n[0], n[1], n[2], n[3] === undefined ? 1 : n[3]]; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c[3] > 0.5) return c; } return rgb(getComputedStyle(document.body).backgroundColor); };
  const name = (el) => (el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + [...el.classList].join('.')) + ' "' + (el.textContent || '').trim().slice(0, 30) + '"';
  const phone = innerWidth <= 544;
  const same = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 4;
  // Text: nothing under 13px, weights 400/600 only, contrast 4.5:1 on its own background.
  for (const el of document.querySelectorAll('body *')) {
    if (!vis(el) || /^(SCRIPT|STYLE|I|svg)$/i.test(el.tagName) || el.closest('.qr')) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const s = getComputedStyle(el);
    if (parseFloat(s.fontSize) < 13) out.push(`text under 13px: ${name(el)} ${s.fontSize}`);
    if (!['400', '600'].includes(s.fontWeight)) out.push(`weight ${s.fontWeight}: ${name(el)}`);
    if (s.textTransform === 'uppercase') out.push(`uppercase: ${name(el)}`);
    if (s.fontStyle === 'italic') out.push(`italic: ${name(el)}`);
    const r = ratio(rgb(s.color), bgOf(el));
    if (r < 4.5 && !el.disabled && !el.closest('[disabled]')) out.push(`text contrast ${r.toFixed(2)}: ${name(el)}`);
  }
  // Things you press: one clear 1px line, 12px corners, 14px/600 words, 36px (44px on a phone); never ink at rest.
  const ink = rgb(getComputedStyle(document.body).color);
  const press = [...document.querySelectorAll('#view button, #view a.btn, #view a.tile, #view .chip, #view .more, #people .chip, header .btn')].filter(vis);
  const lines = new Set();
  for (const el of press) {
    const s = getComputedStyle(el), box = el.getBoundingClientRect();
    if (s.borderTopWidth !== '1px') out.push(`pressable edge ${s.borderTopWidth}: ${name(el)}`);
    if (s.borderTopLeftRadius !== '12px') out.push(`pressable corner ${s.borderTopLeftRadius}: ${name(el)}`);
    if (!el.closest('header') && !el.classList.contains('tile')) { if (s.fontSize !== '14px' || s.fontWeight !== '600') out.push(`pressable words ${s.fontSize}/${s.fontWeight}: ${name(el)}`); }
    if (box.height < (phone ? 44 : 36) - 0.5) out.push(`pressable ${box.height}px high: ${name(el)}`);
    const edge = rgb(s.borderTopColor);
    // Yes / No rest on their own colour line (Lisa's approved picture, 28 Oct); everything else on the one control line.
    if (!el.closest('header')) { if (!el.matches('.btn.yes, .btn.no')) lines.add(edge.slice(0, 3).map(Math.round).join(',')); if (same(edge, ink)) out.push(`pressable starts out ink: ${name(el)}`); }
    // The resting line is 3:1 on what is behind it AND on the page itself (the brief; Lisa's 8A7F70 warm / 7A8692 cool).
    const behind = [bgOf(el.parentElement)].concat(el.closest('header') ? [] : [rgb(getComputedStyle(document.body).backgroundColor)]);
    for (const b of behind) if (ratio(edge, b) < 3) out.push(`pressable edge ${ratio(edge, b).toFixed(2)}:1, under 3:1: ${name(el)}`);
    const bg = rgb(s.backgroundColor); if (!el.closest('header') && bg[3] > 0.5 && !matchMedia('(prefers-color-scheme: dark)').matches && lum(bg) < 0.6) out.push(`solid fill on ${name(el)}`);
  }
  if (lines.size > 1) out.push(`pressables rest on ${lines.size} different lines: ${[...lines].join(' | ')}`);
  // Read-only markers: counts, date pills, parcel numbers: never a solid colour fill (tints only).
  for (const el of [...document.querySelectorAll('.cnt, nav.tabs .n, .date, .pid, .needs3 .v, .ava, .okring, .stamp, .readat')].filter(vis)) {
    const bg = rgb(getComputedStyle(el).backgroundColor), page = bgOf(el.parentElement);
    if (bg[3] > 0.5 && ratio(bg, page) > 1.6) out.push(`solid fill on marker ${name(el)}`);
  }
  // Counts: one fixed size (30 x 22, radius 11) so 1 and 2 digits match.
  for (const el of [...document.querySelectorAll('.cnt, nav.tabs .n')].filter(vis)) {
    const s = getComputedStyle(el), b = el.getBoundingClientRect();
    if (Math.round(b.height) !== 22 || (el.textContent.length < 3 && Math.round(b.width) !== 30) || s.borderTopLeftRadius !== '11px') out.push(`count pill ${Math.round(b.width)}x${Math.round(b.height)} r${s.borderTopLeftRadius}: ${name(el)}`);
  }
  // One radius: 12px on everything with corners; circles only for status dots and initial rings; counts 11px.
  for (const el of [...document.querySelectorAll('body *')].filter(vis)) {
    const r = getComputedStyle(el).borderTopLeftRadius; if (r === '0px') continue;
    if (el.matches('.sdot, .cdot, .ava, .okring, .h1dot, .top h1 .dot')) { if (r !== '50%' && parseFloat(r) < 4) out.push(`dot not round: ${name(el)}`); continue; }
    if (el.matches('.cnt, nav.tabs .n')) continue;
    if (el.matches('nav.tabs .bar')) continue;   // the 4px colour bar above a tab label
    if (r !== '12px') out.push(`radius ${r}: ${name(el)}`);
  }
  // Thumbnails: one size, 44 x 44.
  for (const el of [...document.querySelectorAll('.item > img, .item > .ph, .prow > img, .prow > .ph, .row > img, .row > .ph')].filter(vis)) {
    const b = el.getBoundingClientRect(); if (Math.round(b.width) !== 44 || Math.round(b.height) !== 44) out.push(`thumbnail ${b.width}x${b.height}: ${name(el)}`);
  }
  // Titles wrap to 2 lines, then ellipsis.
  for (const el of [...document.querySelectorAll('#view .ttl')].filter(vis)) { const s = getComputedStyle(el); if (s.webkitLineClamp !== '2' || s.overflow !== 'hidden') out.push(`title not clamped: ${name(el)}`); }
  return out;
}

test.describe('Marketplace house look', () => {
  for (const scheme of ['light', 'dark']) {
    for (const [w, h] of [[1280, 900], [390, 844]]) {
      test(`${scheme} ${w}px: text 13px+ at 400/600 with 4.5:1, pressables on one clear 1px line at 12px, counts one size, no solid fills, 44px thumbnails`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.setViewportSize({ width: w, height: h });
        await lookSheets(page);
        await open(page);
        for (const hash of ['#/me', '#/do', '#/decide', '#/reply', '#/insights']) {
          await page.evaluate((x) => { location.hash = x; }, hash);
          await expect(page.locator('#view .needs, #view .tiles').first()).toBeVisible();
          expect(await page.evaluate(auditLook), `${scheme} ${w} ${hash}`).toEqual([]);
          const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
          expect(sw[0], `${hash}: page wider than the screen`).toBeLessThanOrEqual(sw[1]);
        }
      });
    }
  }

  // HOUSE HOVER RULE (Lisa 28 Oct): neutral = 1px ink line inside + muted tint; meaning-coloured = a line + tint of ITS colour,
  // never ink. Selected = hover. Nothing moves; read-only pills have no hover.
  const hoverLook = (el) => el.evaluate((e) => {
    const c = getComputedStyle(e), probe = (v) => { const s = document.createElement('span'); s.style.color = v; e.appendChild(s); const x = getComputedStyle(s).color; s.remove(); return x; };
    return { style: c.outlineStyle, width: c.outlineWidth, offset: c.outlineOffset, line: c.outlineColor, bg: c.backgroundColor,
      ink: probe('var(--ink)'), ok: probe('var(--ok)'), need: probe('var(--need)'), tc: probe('var(--tc)'), surface: getComputedStyle(document.querySelector('#view .card') || document.body).backgroundColor };
  });
  const chan = (c) => { const m = /color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)/.exec(c); return m ? [m[1] * 255, m[2] * 255, m[3] * 255] : (c.match(/[\d.]+/g) || []).slice(0, 3).map(Number); };
  test('hover: neutral controls get a 1px ink line inside + a muted tint; nothing moves or resizes; read-only pills have no hover', async ({ page }) => {
    await lookSheets(page);
    await open(page, '#/do');
    for (const sel of ['#view a.btn[href*="vinted"]', '#view [data-action="pack"]', '#view .chip[data-site]:not([aria-pressed="true"])']) {
      const el = page.locator(sel).first();
      const before = await el.boundingBox(), rest = await hoverLook(el);
      await el.hover();
      const h = await hoverLook(el);
      expect([h.style, h.width, h.offset], sel).toEqual(['solid', '1px', '-1px']);
      expect(h.line, `${sel}: neutral hover line is ink`).toBe(h.ink);
      expect(h.bg, `${sel}: a muted tint appears`).not.toBe(rest.bg);
      expect(await el.boundingBox(), `${sel} moved or resized on hover`).toEqual(before);
    }
    // Selected looks the same as hover.
    const sel = await hoverLook(page.locator('#view .chip[data-site][aria-pressed="true"]'));
    expect([sel.style, sel.width, sel.offset, sel.line === sel.ink]).toEqual(['solid', '1px', '-1px', true]);
    for (const s of ['#view .cnt', '#view .date', '#view .pid']) {
      const el = page.locator(s).first();
      await el.hover();
      expect(await el.evaluate((e) => getComputedStyle(e).outlineStyle), s).toBe('none');
    }
  });

  test('hover: meaning-coloured controls keep their OWN colour (line + pale tint of it, never ink): green Yes, rose No', async ({ page }) => {
    await lookSheets(page);
    await open(page, '#/decide');
    for (const [s, key, lean] of [['[data-ans="GO|1"][data-v="Yes"]', 'ok', 'green'], ['[data-ans="GO|1"][data-v="No"]', 'need', 'red']]) {
      const el = page.locator(s), before = await el.boundingBox(), rest = await hoverLook(el);
      await el.hover();
      const h = await hoverLook(el);
      expect([h.style, h.width, h.offset], s).toEqual(['solid', '1px', '-1px']);
      expect(h.line, `${s}: line keeps its colour`).toBe(h[key]);
      expect(h.line, `${s}: never ink`).not.toBe(h.ink);
      expect(h.bg, `${s}: a tint appears`).not.toBe(rest.bg);
      const [r, g] = chan(h.bg);
      if (lean === 'green') expect(g, `${s}: tint is green`).toBeGreaterThan(r); else expect(r, `${s}: tint is rose`).toBeGreaterThan(g);
      expect(await el.boundingBox(), `${s} moved`).toEqual(before);
    }
  });

  test('bottom tabs are exempt: no ring or tint on hover or when selected; the colour bar widens and nothing moves', async ({ page }) => {
    await lookSheets(page);
    await open(page, '#/decide');
    const tab = page.locator('#tabs a[data-nav="reply"]'), box = await tab.boundingBox();
    const w0 = await tab.locator('.bar').evaluate((e) => e.getBoundingClientRect().width), rest = await hoverLook(tab);
    await tab.hover();
    await expect.poll(() => tab.locator('.bar').evaluate((e) => e.getBoundingClientRect().width)).toBeGreaterThan(w0);
    const h = await hoverLook(tab);
    expect(h.style).toBe('none');
    expect(h.bg, 'no tint on a tab').toBe(rest.bg);
    expect(await tab.boundingBox()).toEqual(box);
    const cur = page.locator('#tabs a[aria-current="page"]'), c = await hoverLook(cur);
    expect(c.style).toBe('none'); expect(c.bg).toBe(rest.bg);
    expect(await cur.locator('.bar').evaluate((e) => e.getBoundingClientRect().width)).toBeGreaterThan(w0);
  });

  test('count pills are one exact box (30 x 22) for 1 and 2 digits even in a wider fallback font; only 3+ digits grow', async ({ page }) => {
    const many = Array.from({ length: 88 }, (_, i) => ['GO|' + i, 'go', 'Treats', 'Sample ' + i, '{}', ago(5)]).concat(Array.from({ length: 120 }, (_, i) => ['RM|' + i, 'remove', 'Clothes', 'Sample ' + i, '{}', ago(5)]));
    await sheets(page, many.concat([['MSG|1', 'message', 'Clothes', 'Sample question', '{}', ago(5)]]));
    await open(page);
    await page.addStyleTag({ content: '* { font-family: "DejaVu Sans", Verdana, sans-serif !important; letter-spacing: .04em !important; }' });   // wider than Lexend
    const box = (sel) => page.locator(sel).evaluate((e) => { const b = e.getBoundingClientRect(); return [Math.round(b.width * 100) / 100, Math.round(b.height * 100) / 100]; });
    expect(await box('#n-reply')).toEqual([30, 22]);    // 1 digit
    expect(await box('#n-decide')).toEqual([30, 22]);   // 2 digits
    const wide = await box('#n-do');                    // 3 digits grow
    expect(wide[1]).toBe(22); expect(wide[0]).toBeGreaterThan(30);
  });

  test('spacing: 12px between cards (Lisa chose 12px), 16px under a header line before its first card', async ({ page }) => {
    await lookSheets(page);
    await open(page, '#/do');
    const gaps = await page.evaluate(() => {
      const kids = [...document.querySelectorAll('#view > *')].filter((e) => e.offsetParent);
      const out = { cards: [], head: [] };
      for (let i = 1; i < kids.length; i++) {
        const a = kids[i - 1], b = kids[i], g = Math.round(b.getBoundingClientRect().top - a.getBoundingClientRect().bottom);
        if (a.matches('.card') && b.matches('.card')) out.cards.push(g);
        if (a.matches('.ghead') && b.matches('.card')) out.head.push(g);
      }
      return out;
    });
    expect(gaps.cards.length).toBeGreaterThan(0); expect(gaps.head.length).toBeGreaterThan(0);
    expect([...new Set(gaps.cards)]).toEqual([12]);
    expect([...new Set(gaps.head)]).toEqual([16]);
  });

  test('keyboard focus is a 2px ink ring', async ({ page }) => {
    await lookSheets(page);
    await open(page);
    await page.locator('[data-ans="RM|1"]').focus();
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    const s = await page.evaluate(() => { const c = getComputedStyle(document.activeElement); return [c.outlineStyle, c.outlineWidth, c.outlineColor === getComputedStyle(document.body).color]; });
    expect(s).toEqual(['solid', '2px', true]);
  });

  test('date pills: plain 1px ring at rest; late = rose ring + tint, today or tomorrow = amber ring + tint; words say it too', async ({ page }) => {
    await lookSheets(page);
    await open(page);
    const pills = page.locator('#view .plist .date');
    await expect(pills).toHaveCount(3);
    await expect(pills.nth(0)).toContainText('late'); await expect(pills.nth(0)).toHaveClass(/late/);
    await expect(pills.nth(1)).toContainText('today'); await expect(pills.nth(1)).toHaveClass(/soon/);
    await expect(pills.nth(2)).not.toHaveClass(/late|soon/);
    const look = await pills.evaluateAll((els) => els.map((e) => { const s = getComputedStyle(e); return [s.borderTopWidth, s.borderTopColor, s.backgroundColor]; }));
    expect(look.map((l) => l[0])).toEqual(['1px', '1px', '1px']);
    expect(look[0][1]).not.toBe(look[2][1]); expect(look[1][1]).not.toBe(look[2][1]); expect(look[0][1]).not.toBe(look[1][1]);
    expect(look[2][2]).toBe('rgba(0, 0, 0, 0)');   // the plain one has no tint
  });

  test('Home: a Next card with a 1px ink edge, a "To post" list (late first, at most 7) and Start packing that opens packing mode', async ({ page }) => {
    await lookSheets(page);
    await open(page);
    const next = page.locator('#view > .card.next');
    await expect(next).toHaveCount(1);
    await expect(next.locator('.nextlab')).toHaveText('Next');
    expect(await next.evaluate((e) => getComputedStyle(e).borderTopColor === getComputedStyle(document.body).color)).toBe(true);
    await expect(page.locator('#view .ghead', { hasText: 'To post' }).locator('.cnt.need')).toHaveText('3');
    await expect(page.locator('#view .plist .ttl')).toHaveText(['Sample jumper', 'Sample lead', 'Sample blade']);
    await expect(page.locator('#view .plist img')).toHaveCount(1);          // the real photo where there is one
    await expect(page.locator('#view .plist .ph .ti-shirt')).toHaveCount(1); // else a line icon of the item type
    await page.locator('#view [data-gopack]').click();
    await expect(page.locator('#view .packbar')).toContainText('Packing · 1 of 3');
    await expect(page.locator('#tabs a[data-nav="do"]')).toHaveAttribute('aria-current', 'page');
    await page.locator('[data-action="stoppack"]').click();
    await expect(page.locator('#view .needs')).toHaveText('Do now: 4');
    await expect(page).toHaveURL(/#\/do$/);
  });

  test('empty tabs say so in plain words with a small green-ring check; the header says when the list was read', async ({ page }) => {
    await sheets(page, []);
    await open(page);
    await expect(page.locator('#readAt')).toHaveText(/^Read \d\d:\d\d$/);
    for (const [hash, words] of [['#/me', 'Nothing needs you'], ['#/do', 'Nothing waiting'], ['#/decide', 'All decided'], ['#/reply', 'No one is waiting for a reply']]) {
      await page.evaluate((x) => { location.hash = x; }, hash);
      const e = page.locator('#view .card.empty');
      await expect(e.locator('h2')).toHaveText(words);
      await expect(e.locator('.okring')).toHaveText('✓');
      const ok = await e.locator('.okring').evaluate((x) => { const s = getComputedStyle(x); return [s.borderTopWidth, s.borderTopLeftRadius]; });
      expect(ok).toEqual(['1px', '50%']);
    }
    await page.locator('#signin').click();
    await expect(page.locator('#readAt')).toBeHidden();
  });

  test('frame: dark top bar and dark bottom tab bar, never black; Warm clear greys are warm and Cool clear greys are cool, light and dark', async ({ page }) => {
    await lookSheets(page);
    for (const scheme of ['light', 'dark']) {
      for (const look of ['warm', 'cool']) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.evaluate((lk) => { try { localStorage.setItem('dash-look', JSON.stringify({ bg: lk })); } catch (e) {} }, look).catch(() => {});
        if (scheme === 'light' && look === 'warm') await open(page);
        else { await page.reload(); await expect(page.locator('#view .needs')).toBeVisible(); }
        const c = await page.evaluate(() => {
          const rgb = (x) => { const m = /color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)/.exec(x); return m ? [m[1] * 255, m[2] * 255, m[3] * 255] : (x.match(/[\d.]+/g) || []).slice(0, 3).map(Number); };
          const g = (sel, p) => rgb(getComputedStyle(document.querySelector(sel))[p]);
          return { cool: document.documentElement.classList.contains('look-cool'), head: g('header', 'backgroundColor'), foot: g('#tabs', 'backgroundColor'), page: g('body', 'backgroundColor'),
            line: g('#view .card', 'borderTopColor'), muted: g('#view .hint', 'color'), ctl: g('#view .btn', 'borderTopColor') };
        });
        expect(c.cool, `${scheme} ${look}`).toBe(look === 'cool');
        const L = (v) => 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
        expect(Math.max(...c.head), 'top bar is never black').toBeGreaterThan(30);
        expect(L(c.head), 'top bar is dark').toBeLessThan(80);
        expect(L(c.foot), 'bottom bar one step lighter than the top bar').toBeGreaterThan(L(c.head));
        for (const k of ['page', 'line', 'muted', 'ctl']) {
          if (look === 'cool') expect(c[k][2], `${scheme} cool ${k} ${c[k]}`).toBeGreaterThanOrEqual(c[k][0]);
          else expect(c[k][0], `${scheme} warm ${k} ${c[k]}`).toBeGreaterThanOrEqual(c[k][2]);
        }
      }
    }
  });
});
