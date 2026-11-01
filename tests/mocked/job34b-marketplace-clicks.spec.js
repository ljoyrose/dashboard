// JOB 34b (Marketplace): buttons and links not yet proved by marketplace.spec.js, job34-marketplace-states,
// house-look or tests/phone. Home tiles and the Orders strip, Insights tiles, packing Skip / All packed, old section
// links with Show all, the Vinted card (Copy text, Done with a link), Numbers before the first weekly review, and every
// outside link opening in a new tab. Pretend Google and Sheets only; every row is invented.
const { test, expect, HUBS, go, sheets, SHEETS } = require('../fixtures/job34/load');

const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const today = () => new Date().toISOString();

// Pretend Sheets answering from `rows`; returns the list of writes (range + values).
async function book(page, rows) {
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
async function lit(page, tab) {
  await expect(page.locator(`#tabs a[data-nav="${tab}"]`)).toHaveAttribute('aria-current', 'page');
}

test.describe('Marketplace (JOB 34b): every button and link does what it says', () => {
  test('Home: the Do now / Decide / Reply tiles open their tabs; the Orders tiles and the Latest link open Do now', async ({ page }) => {
    await HUBS.marketplace.open(page);
    for (const [key, name] of [['do', 'Do now'], ['decide', 'Decide'], ['reply', 'Reply']]) {
      await go(page, 'me');
      await page.locator('#view .needs3 a.tile', { hasText: name }).click();
      await expect(page).toHaveURL(new RegExp(`#/${key}$`));
      await lit(page, key);
      await expect(page.locator('#view .needs')).toContainText(name + ':');
    }
    for (const label of ['New today', 'Last 7 days', 'To post']) {
      await go(page, 'me');
      await page.locator('#view a.tile', { hasText: label }).click();
      await expect(page).toHaveURL(/#\/do$/);
      await lit(page, 'do');
    }
    await go(page, 'me');
    await expect(page.locator('#view .hint', { hasText: 'Latest:' })).toBeVisible();
    await page.locator('#view .hint', { hasText: 'Latest:' }).locator('a').click();
    await expect(page).toHaveURL(/#\/do$/);
  });

  test('Home Orders strip: counts today\'s and this week\'s parcels and their money; late ones are named', async ({ page }) => {
    await book(page, [
      ['PO|1', 'post', 'Clothes', 'Sample scarf', JSON.stringify({ platform: 'ebay', shelf: 'A1', price: '£20.00', sold_at: today(), red: true }), ago(5)],
      ['PO|2', 'post', 'Clothes', 'Sample hat', JSON.stringify({ platform: 'vinted', shelf: 'A2', price: '£10.00', sold_at: ago(3 * 1440) }), ago(5)],
    ]);
    await open(page);
    await expect(page.locator('#view a.tile', { hasText: 'New today' }).locator('.v')).toHaveText('1');
    await expect(page.locator('#view a.tile', { hasText: 'Last 7 days' })).toContainText('2Last 7 days · £30.00');
    await expect(page.locator('#view a.tile', { hasText: 'To post' })).toContainText('1 late');
    await expect(page.locator('#view .hint', { hasText: 'Latest:' })).toContainText('Sample scarf · eBay');
  });

  test('Insights: Stock low, Temu to buy, the Stock round tile and button, and Suppliers each open their page and keep Insights lit', async ({ page }) => {
    await book(page, [
      ['ST|1', 'stock', 'Clothes', 'Sample collar', JSON.stringify({ item_sku: 'SKU-SAMPLE-1', have: 1, low: true, listings: 1 }), ago(5)],
      ['RS|1', 'restock', 'Treats', 'Sample chews', JSON.stringify({ url: 'https://www.temu.com/sample-g-2.html', last_cost: '£2.00' }), ago(5)],
      ['SP|1', 'suppliers', '', 'Sample Supplies Ltd', JSON.stringify({ min_order: 100 }), ago(5)],
    ]);
    await open(page, '#/insights');
    await expect(page.locator('#view a.tile', { hasText: 'Stock low' }).locator('.v')).toHaveText('1');
    for (const [sel, hash, words] of [
      [page.locator('#view a.tile', { hasText: 'Stock low' }), 'stock', 'Stock'],
      [page.locator('#view a.tile', { hasText: 'Temu to buy' }), 'temu', 'Temu order list: 1'],
      [page.locator('#view a.tile', { hasText: 'Stock round' }), 'round', 'Stock round'],
      [page.locator('#view .acts a.btn', { hasText: 'Suppliers (1)' }), 'suppliers', 'Suppliers'],
      [page.locator('#view .acts a.btn', { hasText: /^Stock round$/ }), 'round', 'Stock round'],
    ]) {
      await go(page, 'insights');
      await sel.click();
      await expect(page).toHaveURL(new RegExp(`#/${hash}$`));
      await expect(page.locator('#view .needs').first()).toContainText(words);
      await lit(page, 'insights');
    }
  });

  test('packing: Skip for now moves to the next parcel and wraps round to the first; after Found it says Next parcel', async ({ page }) => {
    const writes = await book(page, [
      ['PO|1', 'post', 'Clothes', 'Sample mitt', JSON.stringify({ shelf: 'A1', courier: 'Evri' }), ago(5)],
      ['PO|2', 'post', 'Clothes', 'Sample brush', JSON.stringify({ shelf: 'B1', courier: 'Evri' }), ago(5)],
    ]);
    await open(page, '#/do');
    await page.locator('#view [data-action="pack"]').click();
    await expect(page.locator('#view .packbar')).toContainText('Packing · 1 of 2');
    await expect(page.locator('#view [data-action="nextpack"]')).toHaveText('Skip for now');
    await page.locator('#view [data-action="nextpack"]').click();
    await expect(page.locator('#view .packbar')).toContainText('Packing · 2 of 2');
    await expect(page.locator('#view')).toContainText('Sample brush');
    await page.locator('#view [data-action="nextpack"]').click();
    await expect(page.locator('#view .packbar')).toContainText('Packing · 1 of 2');
    await page.locator('#view [data-ans="PO|1"][data-v="Found"]').click();
    await expect.poll(() => writes.length).toBe(1);
    await expect(page.locator('#view [data-action="nextpack"]')).toHaveText('Next parcel');
    await expect(page.locator('#view')).toContainText('The drop-off code shows here after the engine’s next run.');
  });

  // FIX-REQUEST J34b-F40 (marketplace/index.html:858 nextpack wraps on posts().length, but pagePack at :744-746 lists fewer parcels).
  // DECISION NEEDED: fix the page (wrap on the packing list's own length) or accept. OWNER: Marketplace owner. BY 2026-11-06
  test.fixme('J34b-F40 packing: Skip for now still wraps to the first parcel when an older parcel was already marked Posted', async ({ page }) => {
    await book(page, [
      ['PO|0', 'post', 'Clothes', 'Sample old parcel', JSON.stringify({ shelf: 'A0', courier: 'Evri' }), ago(60), 'Posted', '', ago(30), 'sample@example.test'],
      ['PO|1', 'post', 'Clothes', 'Sample mitt', JSON.stringify({ shelf: 'A1', courier: 'Evri' }), ago(5)],
      ['PO|2', 'post', 'Clothes', 'Sample brush', JSON.stringify({ shelf: 'B1', courier: 'Evri' }), ago(5)],
    ]);
    await open(page, '#/do');
    await page.locator('#view [data-action="pack"]').click();
    await expect(page.locator('#view .packbar')).toContainText('Packing · 1 of 2');
    await page.locator('#view [data-action="nextpack"]').click();
    await expect(page.locator('#view .packbar')).toContainText('Packing · 2 of 2');
    await page.locator('#view [data-action="nextpack"]').click();
    // Today the button does nothing here: pack.i becomes 2 (< 3 posts), and pagePack clamps it back to the last parcel.
    await expect(page.locator('#view .packbar')).toContainText('Packing · 1 of 2');
  });

  test('packing with nothing left: All packed, and Back to Do now goes back to the list', async ({ page }) => {
    await book(page, []);
    await open(page, '#/do?pack');
    await expect(page.locator('#view .card.empty h2')).toHaveText('All packed');
    await page.locator('#view [data-action="stoppack"]', { hasText: 'Back to Do now' }).click();
    await expect(page).toHaveURL(/#\/do$/);
    await expect(page.locator('#view .needs')).toHaveText('Do now: 0');
  });

  test('old section link #/remove: one card at a time, Show all opens every card, Show one at a time folds back; an empty one says Nothing here', async ({ page }) => {
    await book(page, [
      ['RM|1', 'remove', 'Clothes', 'Sample cap', JSON.stringify({ platform: 'Vinted', url: 'https://www.vinted.co.uk/items/2' }), ago(5)],
      ['RM|2', 'remove', 'Clothes', 'Sample bow', JSON.stringify({ platform: 'Vinted', url: 'https://www.vinted.co.uk/items/3' }), ago(5)],
    ]);
    await open(page, '#/remove');
    await lit(page, 'do');
    await expect(page.locator('#view .card')).toHaveCount(1);
    await page.locator('#view [data-action="all"]').click();
    await expect(page.locator('#view [data-action="all"]')).toHaveText('Show one at a time');
    await expect(page.locator('#view .card')).toHaveCount(2);
    await page.locator('#view [data-action="all"]').click();
    await expect(page.locator('#view [data-action="all"]')).toHaveText('Show all 2');
    await expect(page.locator('#view .card')).toHaveCount(1);
    await go(page, 'message');
    await lit(page, 'reply');
    await expect(page.locator('#view .card.empty h2')).toHaveText('Nothing here');
  });

  test('Vinted card: Copy text copies the listing words and says Copied; Done writes Done with the pasted link', async ({ page }) => {
    await page.addInitScript(() => { window.__copied = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } }); });
    const writes = await book(page, [['VT|1', 'vinted', 'Clothes', 'Sample fleece', JSON.stringify({ text: 'Sample fleece, size M, as new.' }), ago(5)]]);
    await open(page, '#/do');
    await page.locator('#view [data-copy="VT|1"]').click();
    await expect(page.locator('#view [data-copy="VT|1"]')).toHaveText('Copied');
    expect(await page.evaluate(() => window.__copied)).toEqual(['Sample fleece, size M, as new.']);
    const vinted = page.locator('#view a.btn', { hasText: 'Open Vinted' });
    await expect(vinted).toHaveAttribute('href', 'https://www.vinted.co.uk/items/new');
    await expect(vinted).toHaveAttribute('target', '_blank');
    await page.locator('#view [data-link="VT|1"]').fill('https://www.vinted.co.uk/items/4');
    await page.locator('#view [data-ans="VT|1"][data-v="Done"]').click();
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0]).toEqual({ range: 'Marketplace!G2:J2', values: ['Done', 'https://www.vinted.co.uk/items/4', expect.any(String), expect.any(String)] });
  });

  test('Numbers before the first weekly review: says when it fills, no tiles', async ({ page }) => {
    await book(page, []);
    await open(page, '#/numbers');
    await lit(page, 'insights');
    await expect(page.locator('#view')).toContainText('The weekly review fills this on Monday.');
    await expect(page.locator('#view [data-tile]')).toHaveCount(0);
  });

  test('every outside link on Home, Do now, Decide, Reply and Insights opens in a new tab with rel=noopener and an https address', async ({ page }) => {
    await HUBS.marketplace.open(page);
    const bad = [];
    for (const v of ['me', 'do', 'decide', 'reply', 'insights']) {
      await go(page, v);
      if (await page.locator('#view [data-action="all"]').count()) await page.locator('#view [data-action="all"]').click();
      const links = await page.locator('#view a[href^="http"]').evaluateAll((as) => as.map((a) => [a.textContent.trim(), a.getAttribute('href'), a.target, a.rel]));
      for (const [name, href, target, rel] of links) if (!/^https:\/\//.test(href) || target !== '_blank' || !/noopener/.test(rel)) bad.push(`${v}: ${name} ${href} ${target} ${rel}`);
    }
    expect(bad).toEqual([]);
  });
});
