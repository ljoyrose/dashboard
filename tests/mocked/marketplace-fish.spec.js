// G7 (30 Oct 2026): Fish Treats postage to-dos from the GA Hub's Cards tab show in the Marketplace hub's Do now > Post,
// Posted writes only that Cards row's 4 answer cells, and the GA Hub's home no longer shows them. Pretend Google only;
// every order, store and row here is invented. No address, name or contact is on a card.
const { test, expect } = require('../support/test');
const SHEETS = /^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\//;
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();
const fishCard = (no, units, courier, extra = {}) => ['PACK-' + no, 'pack', 'Orders', (courier ? 'Post order #' : 'Decide how to post order #') + no + ': ' + units + ' Fish Treat units',
  JSON.stringify(Object.assign({ kind: 'fish', order: no, units, courier, decide: !courier, with_food: false, store: 'example-store', why: courier ? courier + '. Nothing goes to GA.' : 'You decide (OR029).', red: !courier }, extra)), ago(5)];
const FOOD = [
  ['LOWPROFIT-9001', 'profit', 'Orders', 'Order #9001: profit £7.00 (under £8)', JSON.stringify({ red: true }), ago(5)],
  fishCard('9701', 1, 'Parcel2Go'), fishCard('9702', 2, 'Parcel2Go', { with_food: true }), fishCard('9703', 3, 'InPost'), fishCard('9704', 4, 'InPost', { with_food: true }),
  fishCard('9705', 5, '', { with_food: true, why: '5 units with food (OR028): add the GA box of 16 to the GA order if it fits in the box, or post them yourself.' }),
  fishCard('9706', 5, ''), fishCard('9707', 6, ''),
  ['PACK-9708', 'pack', 'Orders', 'Post order #9708: 1 Fish Treat unit', JSON.stringify({ kind: 'fish', order: '9708', units: 1, courier: 'Parcel2Go' }), ago(60), 'Posted', '', ago(60), 'x@example.test', ago(40), 'engine'],
];
const MKT = [['MKT-2', 'post', 'Towels & textiles', 'Sample bath sheet', JSON.stringify({ courier: 'InPost', shelf: 'C1', post_by: '2026-10-27' }), ago(5)]];

async function sheets(page) {
  const writes = [], reads = [];
  await page.route(/googleapis\.com\/drive\/v3\/files\/[\w-]+\?alt=media/, (route) => route.fulfill({ status: 200, contentType: 'text/csv', body: 'listing_id,image_url\n' }));
  await page.route(SHEETS, async (route) => {
    const req = route.request(), url = decodeURIComponent(req.url()), food = /\/values\/Cards!/.test(url), rows = food ? FOOD : MKT;
    reads.push(url);
    if (req.method() === 'PUT') { writes.push({ url, range: /values\/([^?]+)/.exec(url)[1], body: JSON.parse(req.postData()) }); return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); }
    if (/values:batchGet/.test(url)) {
      const ranges = new URL(req.url()).searchParams.getAll('ranges');
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ valueRanges: ranges.map((r) => ({ range: r, values: /^Cards!/.test(r) ? FOOD : [] })) }) });
    }
    if (/!A2:L$/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: rows }) });
    const n = Number(/!A(\d+)/.exec(url)[1]);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: [(rows[n - 2] || []).slice()] }) });
  });
  return { writes, reads };
}
async function open(page, hash) {
  await page.goto('marketplace/' + (hash || '#/do'));
  await page.locator('#view [data-action="signin"]').click();
  await expect(page.locator('#view .needs').first()).toBeVisible();
}

test.describe('Marketplace hub: Fish Treats postage to-dos (G7)', () => {
  test('every fish order is one Post to-do: 1-2 Parcel2Go, 3-4 InPost, 5+ a decision; counted in Do now', async ({ page }) => {
    await sheets(page); await open(page);
    for (const no of ['9701', '9702', '9703', '9704', '9705', '9706', '9707']) await expect(page.locator('#view [data-ans="PACK-' + no + '"]')).toHaveCount(1);
    await expect(page.locator('#view [data-ans="PACK-9708"]')).toHaveCount(0);   // already applied: gone
    await expect(page.locator('#view [data-ans="LOWPROFIT-9001"]')).toHaveCount(0);   // only PACK- cards come across
    await expect(page.locator('#n-do')).toHaveText('8');   // 7 fish + 1 Marketplace post
    const card = (no) => page.locator('#view .card').filter({ has: page.locator('[data-ans="PACK-' + no + '"]') });
    await expect(card('9701')).toContainText('Parcel2Go'); await expect(card('9702')).toContainText('the food goes to GA');
    await expect(card('9703')).toContainText('InPost'); await expect(card('9704')).toContainText('InPost');
    await expect(card('9705')).toContainText('Decide how to post'); await expect(card('9705')).toContainText('if it fits');
    await expect(card('9706')).toContainText('Decide how to post'); await expect(card('9707')).toContainText('6 Fish Treat units');
    for (const no of ['9701', '9705']) await expect(card(no).locator('[data-v="Posted"]')).toHaveText('Posted');   // no Found step: Lisa packs these herself
    await expect(card('9701').locator('a.btn', { hasText: 'Open the order in Shopify' })).toHaveAttribute('href', 'https://admin.shopify.com/store/example-store/orders?query=9701');
  });

  test('Posted writes only that Food Cards row\'s 4 answer cells (G:J), never the Marketplace tab; Undo clears them', async ({ page, guard }) => {
    const s = await sheets(page); await open(page);
    await page.locator('[data-ans="PACK-9703"]').click();
    await expect.poll(() => s.writes.length).toBe(1);
    expect(s.writes[0].range).toBe('Cards!G5:J5');
    expect(s.writes[0].url).toContain('/spreadsheets/' + await page.evaluate(() => window.DASH_CONFIG.food.bookId) + '/');
    const [v] = s.writes[0].body.values;
    expect(v[0]).toBe('Posted'); expect(v[3]).toBe(guard.world.email);
    expect(s.writes.some((w) => /Marketplace!/.test(w.range))).toBe(false);
    await page.locator('.justdone summary').click();   // Do now keeps Just done folded
    await page.locator('.justdone [data-undo="PACK-9703"]').click();
    await expect.poll(() => s.writes.length).toBe(2);
    expect(s.writes[1].range).toBe('Cards!G5:J5'); expect(s.writes[1].body.values[0][0]).toBe('');
  });

  test('a Marketplace post still writes the Marketplace tab', async ({ page }) => {
    const s = await sheets(page); await open(page);
    await page.locator('[data-ans="MKT-2"]').first().click();
    await expect.poll(() => s.writes.length).toBe(1);
    expect(s.writes[0].range).toBe('Marketplace!G2:J2');
  });

  test('the GA Hub home no longer shows the fish to-dos (told once, in the Marketplace hub)', async ({ page }) => {
    await sheets(page);
    await page.goto('food/#/home');
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#view')).toContainText('profit');
    await expect(page.locator('#view')).not.toContainText('Fish Treat unit');
  });
});
