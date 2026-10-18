// Money: forecast chart per entity (F5) and deadlines worked out from UK rules (F6), each marked
// "check with accountant". Today is pinned to 10 Mar 2026 by the test setup.
const { test, expect } = require('../support/test');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const SUBJECTS_WITH_DATES = 'CURRENT: 3 rows held 2026-03-09\nid,kind,entity,name,drive_id,status,year_end,vat_quarter_end\n' +
  'S001,entity,TESTCO,Test Co Ltd,fx-folder-testco,live,03-31,02-28\nS002,entity,TESTPERS,Test Personal,fx-folder-testpers,live,,\nS003,entity,OLDCO,Old Co Ltd,fx-folder-oldco,retired,12-31,\n';

test.describe('Money: forecast chart', () => {
  test('an entity page draws the forecast line with a £0 line and a plain-words label', async ({ page }) => {
    await page.goto('money/#/e/TESTCO');
    await signIn(page);
    const svg = page.locator('svg[data-chart="forecast"]');
    await expect(svg).toBeVisible();
    await expect(svg).toHaveAttribute('role', 'img');
    await expect(svg).toHaveAttribute('aria-label', /Forecast for TESTCO: £12,000 on 10 Mar, lowest £6,000 on 10 May \(the last day shown\)\. Stays above zero/);
    await expect(svg.locator('.zero')).toHaveCount(1);
    await expect(svg.locator('circle.dry')).toHaveCount(0);
  });

  test('a forecast that goes below zero marks the runs-dry date in red @regression', async ({ page, guard }) => {
    guard.world.files.find((f) => f.id === 'l-co-FORECAST.csv').content = 'CURRENT: 4 rows held 2026-03-09\ndate,projected_balance\n2026-03-10,3000\n2026-03-25,800\n2026-04-02,-450\n2026-05-10,-1200\n';
    await page.goto('money/#/e/TESTCO');
    await signIn(page);
    const svg = page.locator('svg[data-chart="forecast"]');
    await expect(svg.locator('circle.dry')).toHaveAttribute('data-dry', '2026-04-02');
    await expect(svg).toContainText('Runs dry 2 Apr');
    await expect(svg).toHaveAttribute('aria-label', /Goes below zero on 2 Apr/);
  });
});

test.describe('Money: deadlines worked out from rules', () => {
  test('a personal entity gets Self Assessment dates, every row says check with accountant', async ({ page }) => {
    await page.goto('money/#/dates');
    await signIn(page);
    const card = page.locator('[data-rules="all"]');
    await expect(card).toContainText('Worked out from the rules');
    await expect(card).toContainText('Self Assessment: 2nd payment on account');
    await expect(card).toContainText('31 Jul');
    // 31 Jan 2027 is the deadline for the 2025-26 tax year (ended 5 Apr 2026)
    await expect(card).toContainText('Self Assessment: online return and balancing payment for the 2025-26 tax year');
    await expect(card).toContainText('not tax advice');
    const rows = card.locator('li');
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) await expect(rows.nth(i)).toContainText('check with accountant');
  });

  test('with year_end and vat_quarter_end set, company and VAT dates follow the rules', async ({ page, guard }) => {
    guard.world.files.find((f) => f.name === 'MON-SUBJECTS.csv').content = SUBJECTS_WITH_DATES;
    await page.goto('money/#/e/TESTCO');
    await signIn(page);
    const card = page.locator('[data-rules="TESTCO"]');
    const all = card.locator('[data-action="showall"]');
    if (await all.count()) await all.click();
    // year to 31 Mar 2026: accounts 31 Dec 2026, CT payment 1 Jan 2027, CT600 31 Mar 2027
    await expect(card.locator('li', { hasText: 'Company accounts to Companies House (year to 2026-03-31)' })).toContainText('31 Dec');
    await expect(card.locator('li', { hasText: 'Corporation Tax payment (year to 2026-03-31)' })).toContainText('1 Jan 2027');
    await expect(card.locator('li', { hasText: 'Corporation Tax return CT600 (year to 2026-03-31)' })).toContainText('31 Mar 2027');
    // VAT quarter to 31 May 2026 (from 02-28, stepping 3 months keeps month ends): due 7 Jul 2026
    await expect(card.locator('li', { hasText: 'VAT return and payment (quarter to 2026-05-31)' })).toContainText('7 Jul');
    // a retired entity gets nothing
    await page.goto('money/#/dates');
    await expect(page.locator('[data-rules="all"]')).not.toContainText('OLDCO');
  });

  test('a date already in MON-DATES for the same entity is not repeated', async ({ page, guard }) => {
    const dates = guard.world.files.find((f) => f.name === 'MON-DATES.csv');
    dates.content = dates.content.trimEnd() + '\nD099,SA payment on account,TESTPERS,2026-07-31,open,Lisa\n';
    await page.goto('money/#/dates');
    await signIn(page);
    await expect(page.locator('[data-rules="all"]')).not.toContainText('Self Assessment: 2nd payment on account');
  });
});
