// Marketplace "Product ideas" page (MKT-IDEAS stage 2). Pretend Google only; every row is invented (SAMPLE).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');

const FIX = path.join(__dirname, '..', 'fixtures', 'marketplace');
const SHEETS = /^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\//;
const DETAIL = JSON.parse(fs.readFileSync(path.join(FIX, 'MKT-IDEA-DETAIL.json'), 'utf8'));
const FOLDER = 'FAKE-IDEAS-FOLDER-0000';
const row = (id, title, d, ans) => ['IDEA|' + id, 'idea', 'Ideas', title, JSON.stringify(d), '2026-11-02T15:30:00Z', ans || '', '', '', '', '', ''];
const rowsFor = () => [
  row('IDEA-SAMPLE-1', 'SAMPLE pet brush', DETAIL),
  row('IDEA-SAMPLE-2', 'SAMPLE digital guide', { kind: 'idea', v: 1, status: 'new', gate: 0, verdict: '', intake: { note: 'SAMPLE' } }),
  row('IDEA-SAMPLE-3', 'SAMPLE dropped thing', { kind: 'idea', v: 1, status: 'dropped', gate: 0, verdict: 'no', dropped_reason: 'SAMPLE too thin', intake: {} }),
];
// Pretend Sheets + pretend Drive. Records every sheet write and every file upload. Config gets the invented idea folder.
async function world(page, rows, opts = {}) {
  const out = { writes: [], uploads: [] };
  await page.route('**/config.js', async (route) => {
    const res = await route.fetch(); const body = await res.text();
    await route.fulfill({ response: res, body: body + (opts.noFolder ? '' : `\nwindow.DASH_CONFIG.marketplace.ideasRequestsFolderId='${FOLDER}';`) });
  });
  await page.route(/googleapis\.com\/drive\/v3\/files\/[\w-]+\?alt=media/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: 'listing_id,image_url\n' }));
  await page.route(/googleapis\.com\/upload\/drive\/v3\/files/, async (route) => {
    out.uploads.push(route.request().postData());
    if (opts.uploadFails) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"message":"boom"}}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"FAKE-FILE-0000"}' });
  });
  await page.route(/googleapis\.com\/drive\/v3\/about/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"user":{"emailAddress":"sample@example.com"}}' }));
  await page.route(SHEETS, async (route) => {
    const req = route.request(), url = decodeURIComponent(req.url());
    if (req.method() === 'PUT') { out.writes.push({ range: /values\/([^?]+)/.exec(url)[1], body: JSON.parse(req.postData()) }); return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }); }
    if (opts.loadFails) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":{"message":"down"}}' });
    if (/!A2:L$/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: rows }) });
    const n = Number(/!A(\d+)/.exec(url)[1]);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: [(rows[n - 2] || []).slice()] }) });
  });
  return out;
}
async function open(page, hash) {
  await page.goto('marketplace/' + (hash || '#/ideas'));
  await page.locator('#view [data-action="signin"]').click();
  await expect(page.locator('#tabs')).toBeVisible();
}

test.describe('Marketplace ideas: list and card', () => {
  test('list shows open ideas with status, gate, verdict and next step; the nav counts the waiting ones', async ({ page }) => {
    await world(page, rowsFor()); await open(page);
    await expect(page.locator('#view .needs')).toHaveText('Ideas: 3');
    await expect(page.locator('#n-newstock')).toHaveText('3');
    await expect(page.locator('#view')).toContainText('SAMPLE pet brush');
    await expect(page.locator('#view')).toContainText('Screening · Gate 0 · Verdict Maybe · Ask SAMPLE wholesaler for a trade price');
    await expect(page.locator('#view')).toContainText('No verdict yet');
    await expect(page.locator('#view')).not.toContainText('SAMPLE dropped thing');
  });
  test('filter chips switch the list', async ({ page }) => {
    await world(page, rowsFor()); await open(page);
    await page.locator('[data-ifilter="dropped"]').click();
    await expect(page.locator('#view')).toContainText('SAMPLE dropped thing');
    await expect(page.locator('#view')).not.toContainText('SAMPLE pet brush');
  });
  test('New stock links to the ideas', async ({ page }) => {
    await world(page, rowsFor()); await open(page, '#/newstock');
    await page.getByRole('link', { name: /Product ideas 3/ }).click();
    await expect(page).toHaveURL(/#\/ideas$/);
  });
  test('card page shows every field and each gate section; verified and assumed are marked', async ({ page }) => {
    await world(page, rowsFor()); await open(page, '#/idea/IDEA-SAMPLE-1');
    const v = page.locator('#view');
    for (const t of ['SAMPLE pet brush', 'Gate 0 · Quick screen', 'Gate 1 · Research', 'Gate 2 · Test plan', 'Gate 3 · Launch and monitor', 'Biggest risks', 'SAMPLE risk one', 'Biggest unknowns', 'Stop rule', 'Stop if no trade price by 30 Nov', 'White label', 'Sells to people', 'I hold stock', 'Wholesaler', '4006381333931', '£4.50', 'SAMPLE shop', 'SAMPLE: puppy buyers', 'SAMPLE Wholesale Ltd', '£3.00', '£1.20', '(assumed)', 'SAMPLE: ask SAMPLE Wholesale Ltd for a price list', 'Not started. Only after a Go.']) await expect(v).toContainText(t);
    await expect(v.locator('li', { hasText: 'SAMPLE price seen £4.50' })).toContainText('Verified');
    await expect(v.locator('li', { hasText: 'Assumed: SAMPLE trade price' })).toContainText('Assumed');
    await expect(v.getByRole('link', { name: 'Open link' })).toHaveAttribute('href', 'https://example.invalid/sample-pet-brush');
  });
  test('card page: Open on board shows only for an Infinity link; empty says not made yet; a stray link is never shown', async ({ page }) => {
    await world(page, [row('IDEA-SAMPLE-1', 'SAMPLE has item', DETAIL), row('IDEA-SAMPLE-2', 'SAMPLE no item', { ...DETAIL, infinity_item: '' }), row('IDEA-SAMPLE-3', 'SAMPLE bad item', { ...DETAIL, infinity_item: 'https://evil.example/x' })]);
    await open(page, '#/idea/IDEA-SAMPLE-1');
    await expect(page.getByRole('link', { name: 'Open on board' })).toHaveAttribute('href', 'https://app.startinfinity.com/SAMPLE-BOARD/SAMPLE-ITEM');
    await expect(page.locator('#view')).not.toContainText('not made yet');
    for (const id of ['IDEA-SAMPLE-2', 'IDEA-SAMPLE-3']) {
      await page.goto('marketplace/#/idea/' + id);
      await expect(page.locator('#view')).toContainText('Board item: not made yet');
      await expect(page.getByRole('link', { name: 'Open on board' })).toHaveCount(0);
    }
  });
  test('the page never calls ClickUp, the Factory files or Infinity (the hub card is the master; only the engine talks to the board)', async ({ page }) => {
    const calls = []; page.on('request', (r) => calls.push(r.url()));
    await world(page, rowsFor()); await open(page, '#/idea/IDEA-SAMPLE-1');
    await page.goto('marketplace/#/ideas/add'); await page.locator('#if-name').fill('SAMPLE x');
    await page.getByRole('button', { name: 'Send' }).click(); await expect(page).toHaveURL(/#\/ideas$/);
    expect(calls.filter((u) => /clickup|startinfinity|af-state|af-bridge/i.test(u))).toEqual([]);
  });
  test('card page for a missing id says so', async ({ page }) => {
    await world(page, rowsFor()); await open(page, '#/idea/NOPE');
    await expect(page.locator('#view')).toContainText('Not found');
  });
});

test.describe('Marketplace ideas: Add idea form', () => {
  const fill = async (page, f) => { for (const [k, v] of Object.entries(f)) await page.locator('#if-' + k).fill(v); };
  test('empty name and bad barcode are refused before anything is sent', async ({ page }) => {
    const w = await world(page, rowsFor()); await open(page, '#/ideas/add');
    await fill(page, { barcode: '123', link: 'http://nope' });
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('#if-name-e')).toHaveText('Add a name');
    await expect(page.locator('#if-barcode-e')).toBeVisible(); await expect(page.locator('#if-link-e')).toBeVisible();
    await expect(page.locator('#if-name')).toBeFocused();
    expect(w.uploads).toHaveLength(0); expect(w.writes).toHaveLength(0);
  });
  test('a good form writes exactly ONE request file (test-marked) and nothing else', async ({ page }) => {
    const w = await world(page, rowsFor()); await open(page, '#/ideas/add');
    await fill(page, { name: 'SAMPLE new thing', barcode: '4006381333931', price_seen: '4.5', link: 'https://example.invalid/x' });
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page).toHaveURL(/#\/ideas$/);
    expect(w.uploads).toHaveLength(1); expect(w.writes).toHaveLength(0);
    const parts = w.uploads[0].split(/--mk\d+/); const meta = JSON.parse(parts[1].split('\r\n\r\n')[1]), body = JSON.parse(parts[2].split('\r\n\r\n')[1]);
    expect(meta.parents).toEqual([FOLDER]); expect(meta.name).toMatch(/^MKT-IDEA-REQ-IDEA-\d{8}-\d{4}-[a-z0-9]+\.json$/);
    expect(body).toMatchObject({ kind: 'mkt-idea', v: 1, dry_run: true, name: 'SAMPLE new thing', barcode: '4006381333931', price_seen: '£4.50' });
    await expect(page.locator('#view')).toContainText('Test only: nothing is made until this page is live.');
  });
  test('a failed send keeps the answers and says why', async ({ page, allowedConsole }) => {
    allowedConsole.push(/status of 500/);
    const w = await world(page, rowsFor(), { uploadFails: true }); await open(page, '#/ideas/add');
    await fill(page, { name: 'SAMPLE keep me' });
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('#view')).toContainText('Not sent:');
    await expect(page.locator('#if-name')).toHaveValue('SAMPLE keep me');
    expect(w.uploads).toHaveLength(1);
  });
  test('no folder in config.js: nothing is sent and it says so', async ({ page }) => {
    const w = await world(page, rowsFor(), { noFolder: true }); await open(page, '#/ideas/add');
    await fill(page, { name: 'SAMPLE x' });
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('#view')).toContainText('Not set up yet');
    expect(w.uploads).toHaveLength(0);
  });
});

test.describe('Marketplace ideas: answers and the New stock hand-off', () => {
  const goDetail = () => ({ ...DETAIL, verdict: 'go', status: 'researching' });
  test('Move to New stock writes only the 4 answer cells, with to=newstock', async ({ page }) => {
    const w = await world(page, [row('IDEA-SAMPLE-1', 'SAMPLE pet brush', goDetail())]); await open(page, '#/idea/IDEA-SAMPLE-1');
    await page.getByRole('button', { name: 'Move to New stock' }).click();
    await expect.poll(() => w.writes.length).toBe(1);
    expect(w.writes[0].range).toMatch(/^Marketplace!G2:J2$/); expect(w.writes[0].body.values[0].slice(0, 2)).toEqual(['Go', 'to=newstock']);
    expect(w.uploads).toHaveLength(0);
  });
  test('Move to New stock is off until the idea has a price and a supplier', async ({ page }) => {
    const d = goDetail(); delete d.supplier; delete d.unit_inc_p;
    await world(page, [row('IDEA-SAMPLE-1', 'SAMPLE pet brush', d)]); await open(page, '#/idea/IDEA-SAMPLE-1');
    await expect(page.getByRole('button', { name: 'Move to New stock' })).toBeDisabled();
    await expect(page.locator('#view')).toContainText('still needs: unit_inc_p, supplier');
  });
  test('No needs a reason, then writes it', async ({ page }) => {
    const w = await world(page, rowsFor()); await open(page, '#/idea/IDEA-SAMPLE-1');
    await page.getByRole('button', { name: 'No', exact: true }).click();
    await expect(page.locator('#banner')).toContainText('Say why'); expect(w.writes).toHaveLength(0);
    await page.locator('#idea-note').fill('SAMPLE too thin');
    await page.getByRole('button', { name: 'No', exact: true }).click();
    await expect.poll(() => w.writes.length).toBe(1);
    expect(w.writes[0].body.values[0].slice(0, 2)).toEqual(['No', 'SAMPLE too thin']);
  });
});
