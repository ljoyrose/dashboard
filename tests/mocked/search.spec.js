const { test, expect } = require('../support/test');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};

test.describe('Search', () => {
  test('t-search-spec-1', async ({ page, guard }) => {
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
    const calls = guard.world.calls.filter((c) => /name contains 'clover'/.test(c.query));
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) { expect(c.method).toBe('GET'); expect(c.url).toContain('corpora=drive'); }
  });

  test('a quote in the search words cannot break the Drive query', async ({ page, guard }) => {
    await page.goto('./');
    await signIn(page);
    await page.locator('[data-search-open]').click();
    await page.locator('#dashSearchBox').fill("user's");
    await expect(page.locator('#dashSearchStatus')).toContainText(/for "user's"/);
    const c = guard.world.calls.find((x) => /name contains/.test(x.query));
    expect(c.query).toContain("name contains 'user\\'s'");
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
    const first = page.locator('[data-search-group="Dogs"] a').first();
    await expect(first).toBeVisible();
    const dog = await first.textContent();
    await first.click();
    await expect(page.locator('#dashSearch')).toBeHidden();
    await expect(page.locator('#nav button[data-go="dogs"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('#q')).toHaveValue(dog);
  });

  test('t-search-spec-2', async ({ page }) => {
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
    const box = page.locator('#dashSearchBox');
    await page.locator('[data-search-open]').click();
    await box.fill('litters');
    const view = page.locator('[data-search-group="Go to"] a', { hasText: 'Litters' });
    await expect(view).toBeVisible();
    await view.click();
    await expect(page).toHaveURL(/#\/litters$/);
    await expect(page.locator('#main h2').first()).toContainText('Litters');
    await page.locator('[data-search-open]').click();
    await box.fill('test cabin b');
    const area = page.locator('[data-search-group="Areas"] a', { hasText: 'Test Cabin B' });
    await expect(area).toBeVisible();
    await area.click();
    await expect(page).toHaveURL(/#\/areas\/area-2$/);
    await expect(page.locator('[data-focus="room"]')).toContainText('Test Cabin B');
    await page.locator('[data-search-open]').click();
    await box.fill('microchip audit');
    const sop = page.locator('[data-search-group="SOPs"] a', { hasText: 'Microchip Audit' });
    await expect(sop).toBeVisible();
    await sop.click();
    await expect(page).toHaveURL(/#\/sops/);
    await expect(page.locator('[data-sop="Microchip Audit"] [data-sop-open]')).toHaveAttribute('aria-expanded', 'true');
  });

  test('signed out, search stays hidden behind the sign-in and asks Drive nothing', async ({ page, guard }) => {
    await page.goto('./');
    await page.keyboard.press('/');
    await expect(page.locator('#dashSearchBox')).not.toBeVisible();
    expect(guard.world.calls.filter((c) => /name contains/.test(c.query))).toEqual([]);
  });
});

