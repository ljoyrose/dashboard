// "Needs you today" on the home Map: one short list (at most 7) of what needs Lisa, from data already read.
const { test, expect, buildWorld } = require('../support/test');
const { IDS } = require('../support/world');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};

test.describe('Needs you today', () => {
  test('signed out there is no panel; signed in it comes straight after Key projects on the Map', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#needsToday')).toHaveCount(0);
    await signIn(page);
    const panel = page.locator('#needsToday');
    await expect(panel).toBeVisible();
    await expect(panel.locator('h3')).toHaveText('Needs you today');
    const order = await page.locator('#view > *').evaluateAll((els) => els.map((e) => e.id));
    expect(order.slice(0, 2)).toEqual(['key-projects', 'needsToday']);
  });

  test('shows at most 7 rows, overdue (red) first, each row a link, and the tab title carries the count @regression', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const rows = page.locator('#needsToday li');
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(7);
    const kinds = await rows.evaluateAll((ls) => ls.map((l) => l.className));
    const rank = { 'n-risk': 0, 'n-fin': 1, 'n-ops': 2, 'n-bin': 3 };
    for (let i = 1; i < kinds.length; i++) expect(rank[kinds[i]]).toBeGreaterThanOrEqual(rank[kinds[i - 1]]);
    for (let i = 0; i < n; i++) await expect(rows.nth(i).locator('a')).toHaveAttribute('href', /.+/);
    const total = Number((await page.locator('#needsToday .cardhead .mtag').textContent()).match(/\d+/)[0]);
    await expect(page).toHaveTitle(new RegExp('^\\(' + total + '\\) Map'));
    if (total > 7) await expect(page.locator('#needsToday')).toContainText('And ' + (total - 7) + ' more.');
  });

  test('a failed read shows up as a red row, so a broken read is never silent', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 403/);
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal' };
    await page.goto('./');
    await page.locator('#signInBtn').click();
    await expect(page.locator('#needsToday li.n-risk').first()).toContainText('Access refused by Google', { timeout: 10_000 });
  });

  test('after the Bin is read, files ready to bin are one row that opens the Bin', async ({ page, guard }) => {
    const w = guard.world;
    w.file('zz-ready-n', 'ZZ_DELETE_ready-for-needs.txt', 'invented', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
    w.byId(IDS.ledger).content = 'file_id\nzz-ready-n\n';
    await page.goto('./#/bin');
    await signIn(page);
    await expect(page.locator('[data-bin-list="ready"]')).toContainText('ZZ_DELETE_ready-for-needs.txt');
    await page.locator('nav.main a[data-nav="map"]').click();
    const row = page.locator('#needsToday li.n-bin');
    await expect(row).toContainText('1 file is ready to bin');
    await expect(row.locator('a')).toHaveAttribute('href', '#/bin');
  });

  test('a different Google account sees no money rows', async ({ page, guard }) => {
    guard.world.email = buildWorld({ email: 'someone.else@example.test' }).email;
    await page.goto('./');
    await signIn(page);
    await expect(page.locator('#needsToday a[href^="money/"]')).toHaveCount(0);
  });
});
