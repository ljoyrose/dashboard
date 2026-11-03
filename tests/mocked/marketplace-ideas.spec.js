// Marketplace "Product ideas" page (MKT-IDEAS stage 2). Pretend Google only; every row is invented (SAMPLE).
const { test, expect } = require('../support/test');
const { DETAIL, FOLDER, row, rowsFor, world, open } = require('../support/mkt-ideas-world');

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

test.describe('Marketplace ideas: empty, error and edge states', () => {
  test('no ideas at all: says so and offers Add idea; the nav shows no count', async ({ page }) => {
    await world(page, []); await open(page);
    await expect(page.locator('#view')).toContainText('No ideas yet');
    await expect(page.getByRole('link', { name: 'Add idea' })).toBeVisible();
    await expect(page.locator('#n-newstock')).toHaveText('');
  });
  test('a filter with nothing in it says "Nothing here", not "No ideas yet"', async ({ page }) => {
    await world(page, rowsFor()); await open(page);
    await page.locator('[data-ifilter="go"]').click();
    await expect(page.locator('#view')).toContainText('Nothing here');
  });
  test('the sheet cannot be read: a plain banner, no crash', async ({ page, allowedConsole }) => {
    allowedConsole.push(/status of 500/);
    await world(page, rowsFor(), { loadFails: true }); await page.goto('marketplace/#/ideas');
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('#banner')).toContainText('Could not load');
  });
  test('a sent idea with no card yet: waits quietly, then warns after 30 minutes; once the card exists it is not shown twice', async ({ page }) => {
    await world(page, [row('IDEA-SAMPLE-9', 'SAMPLE arrived', DETAIL)]);
    await page.addInitScript(() => localStorage.setItem('mkt.ideas.sent', JSON.stringify([
      { id: 'IDEA-SAMPLE-8', name: 'SAMPLE just sent', t: Date.now() - 60000, dry: false },
      { id: 'IDEA-SAMPLE-7', name: 'SAMPLE long wait', t: Date.now() - 40 * 60000, dry: false },
      { id: 'IDEA-SAMPLE-9', name: 'SAMPLE arrived', t: Date.now() - 20 * 60000, dry: false }])));
    await open(page);
    await expect(page.locator('#view')).toContainText('The card shows in about 10 minutes.');
    await expect(page.locator('#view')).toContainText('no card yet. The engine may be off');
    await expect(page.locator('#view .card', { hasText: 'SAMPLE arrived' })).toHaveCount(1);   // the real card only, not a "sent" note as well
  });
  test('a card the engine wrote badly shows a problem note, not a blank page', async ({ page }) => {
    await world(page, [row('IDEA-SAMPLE-1', 'SAMPLE broken', { kind: 'idea', v: 1, status: 'new', gate: 9, verdict: '', intake: {} })]);
    await open(page, '#/idea/IDEA-SAMPLE-1');
    await expect(page.locator('#view')).toContainText('This card has problems (gate)');
  });
  test('a dropped idea shows why', async ({ page }) => {
    await world(page, rowsFor()); await open(page, '#/idea/IDEA-SAMPLE-3');
    await expect(page.locator('#view')).toContainText('Dropped: SAMPLE too thin');
  });
});

test.describe('Marketplace ideas: answers, undo, keyboard', () => {
  test('Maybe writes only the 4 answer cells', async ({ page }) => {
    const w = await world(page, rowsFor()); await open(page, '#/idea/IDEA-SAMPLE-1');
    await page.getByRole('button', { name: 'Maybe' }).click();
    await expect.poll(() => w.writes.length).toBe(1);
    expect(w.writes[0].range).toBe('Marketplace!G2:J2'); expect(w.writes[0].body.values[0][0]).toBe('Maybe'); expect(w.uploads).toHaveLength(0);
  });
  test('an answered idea shows the answer with Undo; Undo clears the 4 cells; once the engine applied it there is no Undo', async ({ page }) => {
    const answered = row('IDEA-SAMPLE-1', 'SAMPLE pet brush', DETAIL, 'Go'), applied = row('IDEA-SAMPLE-2', 'SAMPLE done', DETAIL, 'Maybe');
    applied[10] = '2026-11-02T16:00:00Z'; applied[11] = 'engine';
    const w = await world(page, [answered, applied]); await open(page, '#/idea/IDEA-SAMPLE-1');
    await expect(page.locator('#view')).toContainText('Your answer: Go');
    await expect(page.getByRole('button', { name: 'Move to New stock' })).toHaveCount(0);   // cannot be sent twice
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => w.writes.length).toBe(1);
    expect(w.writes[0].body.values[0].slice(0, 4)).toEqual(['', '', '', '']);
    await page.goto('marketplace/#/idea/IDEA-SAMPLE-2');
    await expect(page.locator('#view')).toContainText('Your answer: Maybe');
    await expect(page.getByRole('button', { name: 'Undo' })).toHaveCount(0);
  });
  test('Add idea by keyboard only: every box has a label, Tab reaches Send, Enter on Send sends once', async ({ page }) => {
    const w = await world(page, rowsFor()); await open(page, '#/ideas/add');
    for (const label of ['Name (needed)', 'Barcode', 'Link', 'Price you saw', 'Where you saw it', 'Photo link', 'Who of yours might buy it', 'Note']) await expect(page.getByLabel(label, { exact: true })).toBeVisible();
    await page.getByLabel('Name (needed)', { exact: true }).fill('SAMPLE keys');
    await page.getByLabel('Note', { exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Send' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/ideas$/);
    expect(w.uploads).toHaveLength(1);
  });
  test('a double tap on Send writes ONE request', async ({ page }) => {
    const w = await world(page, rowsFor()); await open(page, '#/ideas/add');
    await page.locator('#if-name').fill('SAMPLE twice');
    await page.getByRole('button', { name: 'Send' }).dblclick();
    await expect(page).toHaveURL(/#\/ideas$/);
    expect(w.uploads).toHaveLength(1);
  });
  test('typing survives a refresh of the list in the background (cursor stays in the box)', async ({ page }) => {
    await world(page, rowsFor()); await open(page, '#/ideas/add');
    await page.locator('#if-name').fill('SAMPLE typing');
    await page.getByRole('button', { name: 'Refresh' }).first().click().catch(() => {});
    await page.evaluate(() => document.querySelector('[data-action="refresh"]') && document.querySelector('[data-action="refresh"]').click());
    await expect(page.locator('#if-name')).toHaveValue('SAMPLE typing');
  });
  test('error text is tied to its box for screen readers', async ({ page }) => {
    await world(page, rowsFor()); await open(page, '#/ideas/add');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('#if-name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#if-name')).toHaveAttribute('aria-describedby', 'if-name-e');
    await page.locator('#if-name').fill('x');
    await expect(page.locator('#if-name-e')).toHaveCount(0);   // typing clears the message
  });
});
