// Find and sort on every list (Lisa 15 Nov 2026: easy to get to anything, at any number of records). Dogs, Litters, SOPs and
// Assocs had them; Areas and Do get them here, using the one shared sort (BLDSort). Invented rows only.
const { test, expect } = require('../support/test');

const signIn = async (page) => {
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};

test.describe('CD Hub: find and sort on Areas and Do', () => {
  test('Areas: search hides the cabins that do not match and says how many; A to Z is one list by code; the words survive a redraw', async ({ page }) => {
    await signIn(page);
    await page.evaluate(() => go('areas'));
    const cards = page.locator('[data-find-of="areas"] [data-room]');
    const all = await cards.count();
    expect(all).toBeGreaterThan(1);
    const box = page.locator('[data-find-in="areas"]');
    await box.fill('cabin b');
    await expect(page.locator('[data-find-of="areas"] [data-room]:visible')).toHaveCount(1);
    await expect(page.locator('[data-find-of="areas"] [data-room]:visible')).toContainText('Test Cabin B');
    await expect(page.locator('[data-find-count="areas"]')).toHaveText('1 of ' + all);
    // Sort A to Z keeps the words and the hiding
    await page.locator('[data-find-sort="areas"]').selectOption('name');
    await expect(page.locator('[data-find-in="areas"]')).toHaveValue('cabin b');
    await expect(page.locator('[data-find-of="areas"] [data-room]:visible')).toHaveCount(1);
    await expect(page.locator('[data-find-sort="areas"]')).toBeFocused();
    await page.locator('[data-find-in="areas"]').fill('');
    await expect(page.locator('[data-find-of="areas"] [data-room]:visible')).toHaveCount(all);
    await expect(page.locator('[data-find-count="areas"]')).toHaveText('');
    const codes = await page.locator('[data-find-of="areas"] [data-room] h4').evaluateAll((els) => els.map((e) => e.firstChild.textContent.trim().toLowerCase()));
    expect(codes).toEqual([...codes].sort((a, b) => a.localeCompare(b)));
  });

  test('Do: search finds a to-do across the groups and hides empty groups; the sort offers only what the list holds', async ({ page }) => {
    await signIn(page);
    await page.evaluate(() => go('work'));
    await expect(page.locator('[data-find-sort="work"] option')).toHaveText(['Sort: A to Z', 'Sort: As on file']);
    await page.locator('[data-find-in="work"]').fill('waiting on Claude');
    await expect(page.locator('[data-find-of="work"] tr[data-find]:visible')).toHaveCount(1);
    await expect(page.locator('[data-find-of="work"] tr[data-find]:visible')).toContainText('Sample item waiting on Claude');
    await expect(page.locator('[data-find-of="work"] [data-find-group]:visible')).toHaveCount(1);
    await expect(page.locator('[data-find-count="work"]')).toHaveText('1 of 2');   // finished items are not listed (17 Nov 2026)
  });
});
