// Puppy Enquiries Hub page (JOB 13 Stage 13). Example mode (no sheet id in config.js): the invented rows from
// enquiries/examples.js, nothing sent. Pretend Google only.
const { test, expect } = require('../support/test');

test.describe('Enquiries page @enquiries', () => {
  // Signed in with the pretend Google (the house gate locks every hub until then); the sign-in is kept for later page loads.
  test.beforeEach(async ({ page }) => {
    await page.goto('enquiries/');
    await page.locator('#view [data-action="signin"]').click();
    await expect(page.locator('[data-count="hot"]')).toBeVisible();
  });

  test('ACCEPT: the counts match the fixture and a hot row shows above a cool row', async ({ page }) => {
    const n = (id) => page.locator(`[data-count="${id}"] .v`);
    await expect(n('newToday')).toHaveText('3');
    await expect(n('hot')).toHaveText('2');
    await expect(n('calls48')).toHaveText('1');
    await expect(n('followupsDue')).toHaveText('1');
    await expect(n('openPups')).toHaveText('2');
    await page.goto('enquiries/#/list');
    const refs = await page.locator('#view a.erow b').allTextContents();
    expect(refs.indexOf('E-0004')).toBeLessThan(refs.indexOf('E-0002'));
    expect(refs.slice(0, 2)).toEqual(['E-0004', 'E-0001']);
    await expect(page.locator('#stamp')).toHaveText('EXAMPLE');
    await expect(page.locator('a[data-back-home]')).toHaveText('← Dashboard');
  });

  test('ACCEPT: the copy box copies the draft', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#view a.erow[data-enq]').filter({ hasText: 'E-0004' }).first().click();
    const draft = await page.locator('#draftText').inputValue();
    expect(draft).toContain('https://doc.labradoodles.co.uk/');
    await page.locator('[data-copy]').click();
    await expect(page.locator('[data-copy]')).toHaveText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(draft);
  });

  test('signed out: only the sign-in card shows, no example row', async ({ page }) => {
    await page.locator('#signin').click();
    await expect(page.locator('#view [data-action="signin"]')).toBeVisible();
    await expect(page.locator('#view a.erow')).toHaveCount(0);
  });

  test('a do-not-contact person: red chip, no reply box, no actions', async ({ page }) => {
    await page.goto('enquiries/#/e/K-a000000000000005');
    await expect(page.locator('[data-dnc]')).toHaveText('Do not contact');
    await expect(page.locator('#draftText')).toHaveCount(0);
    await expect(page.locator('[data-act]')).toHaveCount(0);
  });

  test('Stage 9: an invented call tomorrow shows a prep card with the fitting pup; "call held" moves the stage and makes one after-call draft', async ({ page }) => {
    const prep = page.locator('[data-prep="K-a000000000000001"]');
    await expect(prep).toContainText('Call tomorrow 11:00');
    await expect(prep.locator('[data-pups]')).toHaveText('L-EX1-1');
    await prep.locator('[data-act="call-held"]').click();
    await expect(page.locator('#banner')).toContainText('nothing was sent');
    await expect(page.locator('[data-prep]')).toHaveCount(0);
    await expect(page.locator('[data-count="calls48"] .v')).toHaveText('0');
    await page.locator('a.erow[data-enq="K-a000000000000001"]').first().click();
    await expect(page.locator('[data-stage]')).toHaveText('call-held');
    await expect(page.locator('[data-card="draft"] .hint')).toContainText('after-call');
    await expect(page.locator('#draftText')).toHaveCount(1);
    await expect(page.locator('[data-act="call-held"]')).toHaveCount(0);
  });

  test('filters are kept in the URL hash and survive a reload', async ({ page }) => {
    await page.goto('enquiries/#/list');
    await page.locator('select[data-filter="band"]').selectOption('hot');
    await expect(page).toHaveURL(/#\/list\?band=hot$/);
    await page.locator('select[data-filter="source"]').selectOption('Website');
    await expect(page).toHaveURL(/#\/list\?source=Website&band=hot$/);
    await page.reload();
    await expect(page.locator('#view a.erow b')).toHaveText(['E-0004']);
    await expect(page.locator('select[data-filter="band"]')).toHaveValue('hot');
  });

  test('cards: Today, New, Hot, waiting list by litter, deposits, sale; Add by hand sends nothing in example mode', async ({ page }) => {
    for (const c of ['today', 'new', 'hot', 'waiting', 'deposits', 'sale']) await expect(page.locator(`[data-card="${c}"]`)).toBeVisible();
    await expect(page.locator('[data-card="waiting"]')).toContainText('open pup, no offer');
    await expect(page.locator('[data-card="sale"]')).toContainText('price on request');
    await page.locator('[data-add]').click();
    await page.locator('#addChannel').selectOption('whatsapp');
    await page.locator('#addText').fill('Invented message: hoping for a puppy next spring.');
    await page.locator('[data-action="add"]').click();
    await expect(page.locator('#banner')).toContainText('nothing was sent');
  });

  test('the page never shows a COI value or the word hypoallergenic without low-shedding', async ({ page }) => {
    for (const h of ['#/home', '#/today', '#/list', '#/litters', '#/add', '#/e/K-a000000000000001', '#/e/K-a000000000000004']) {
      await page.goto('enquiries/' + h);
      const t = await page.locator('#view').innerText();
      expect(t).not.toMatch(/\bCOI\b/);
      if (/hypo-?allergenic/i.test(t)) expect(t).toMatch(/low[- ]shedding/i);
    }
  });
  test('Stage 14: the Results card shows this month and opens every month since the history', async ({ page }) => {
    const card = page.locator('[data-card="results"]');
    await expect(card).toContainText('enquiries');
    await card.locator('a[href="#/results"]').click();
    await expect(page.locator('[data-card="results-all"]')).toBeVisible();
    // The invented HubSpot history month: 10 enquiries, 6 calls booked = 60%, 4 held of 6 = 67%.
    const mar = page.locator('[data-results-month="2026-03"]');
    await expect(mar.locator('tr[data-step="calls_booked"] [data-rate]')).toHaveText('60%');
    await expect(mar.locator('tr[data-step="calls_held"] [data-rate]')).toHaveText('67%');
    await expect(mar.locator('tr[data-step="dep10"] [data-rate]')).toHaveText('5');
    await expect(mar.locator('[data-source="hubspot-legacy"]')).toBeVisible();
    await expect(page.locator('[data-adult-sale]')).toHaveText('1');
    await expect(page.locator('nav.tabs a[aria-current="page"]')).toHaveAttribute('data-nav', 'home');
  });

  test('ACCEPT Stage 14: a month with no data shows "no data", never 0%', async ({ page }) => {
    await page.goto('enquiries/#/results');
    const june = page.locator('[data-results-month="2026-06"]');
    await expect(june).toContainText('no data');
    const rates = await june.locator('[data-rate]').allTextContents();
    expect(rates.length).toBeGreaterThan(6);
    for (const r of rates) expect(r.trim(), 'an empty month never shows a percentage').toBe('no data');
    await expect(june).not.toContainText('0%');
  });
});
