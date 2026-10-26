// One search box on every page, opened with / or the Search button. Results are grouped by where they came from.
const { test, expect } = require('../support/test');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};

test.describe('Search', () => {
  test('home: / opens search; it finds Drive file names per shared drive and Money to-dos, each a link @regression', async ({ page, guard }) => {
    guard.world.file('srch-1', 'Clover vaccination plan.txt', 'invented', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
    await page.goto('./');
    await signIn(page);
    await page.keyboard.press('/');
    const box = page.locator('#dashSearchBox');
    await expect(box).toBeFocused();
    await box.fill('clover');
    const dlg = page.locator('#dashSearch');
    await expect(dlg.locator('[data-search-group="Drive · Test Drive Alpha"]')).toContainText('Clover vaccination plan.txt');
    await box.fill('sample task ready');
    await expect(dlg.locator('[data-search-group="Money to-dos"] a', { hasText: 'Sample task ready now' })).toHaveAttribute('href', 'money/#/register/R001');
    await expect(page.locator('#dashSearchStatus')).toContainText(/\d+ results? for "sample task ready"/);
    // Drive search stays inside the shared drives (never My Drive) and only reads
    const calls = guard.world.calls.filter((c) => /name contains 'clover'/.test(c.query));
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) { expect(c.method).toBe('GET'); expect(c.url).toContain('corpora=drive'); }
  });

  test('a quote in the search words cannot break the Drive query', async ({ page, guard }) => {
    await page.goto('./');
    await signIn(page);
    await page.locator('[data-search-open]').click();
    await page.locator('#dashSearchBox').fill("lisa's");
    await expect(page.locator('#dashSearchStatus')).toContainText(/for "lisa's"/);
    const c = guard.world.calls.find((x) => /name contains/.test(x.query));
    expect(c.query).toContain("name contains 'lisa\\'s'");
  });

  test('Money Hub: finds to-dos and dates already read, without asking Drive again', async ({ page, guard }) => {
    await page.goto('money/');
    await signIn(page);
    const before = guard.world.calls.length;
    await page.keyboard.press('/');
    await page.locator('#dashSearchBox').fill('filing');
    await expect(page.locator('[data-search-group="Dates"]')).toContainText('Sample overdue filing');
    expect(guard.world.calls.length).toBe(before);
  });

  test('CD Hub: finding a dog opens Dogs filtered to that dog', async ({ page }) => {
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
    await page.locator('[data-search-open]').click();
    await page.locator('#dashSearchBox').fill('test');
    const first = page.locator('[data-search-group="CD Hub dogs"] a').first();
    await expect(first).toBeVisible();
    const dog = await first.textContent();
    await first.click();
    await expect(page.locator('#dashSearch')).toBeHidden();
    await expect(page.locator('#nav button[data-go="dogs"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#q')).toHaveValue(dog);
  });

  test('signed out, search stays hidden behind the sign-in and asks Drive nothing', async ({ page, guard }) => {
    await page.goto('./');
    await page.keyboard.press('/');
    await expect(page.locator('#dashSearchBox')).not.toBeVisible();
    expect(guard.world.calls.filter((c) => /name contains/.test(c.query))).toEqual([]);
  });
});
