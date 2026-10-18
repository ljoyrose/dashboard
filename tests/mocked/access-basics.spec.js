// Basic keyboard and screen-reader help on all three pages (review part 2, G8). Pretend Google and Drive.
const { test, expect } = require('../support/test');

for (const [name, url, target] of [['Main dashboard', './', 'content'], ['Money Hub', 'money/', 'content'], ['CD Hub', 'cdhub/', 'main']]) {
  test(`${name}: the first Tab stop is "Skip to content", and it jumps to the content without changing the address`, async ({ page }) => {
    await page.goto(url);
    const before = await page.evaluate(() => location.hash);
    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip')).toBeFocused();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).toBe(target);
    expect(await page.evaluate(() => location.hash)).toBe(before);
  });
}

test('CD Hub: every dropdown and box on every section has a name a screen reader can say', async ({ page }) => {
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  for (const go of ['round', 'dogs', 'areas', 'litters', 'buyers']) {
    await page.locator(`#nav button[data-go="${go}"]`).click();
    const unnamed = await page.evaluate(() => Array.from(document.querySelectorAll('#main select, #main input:not([type=checkbox]):not([type=radio]):not([type=hidden])'))
      .filter((el) => !el.getAttribute('aria-label') && !(el.id && document.querySelector(`label[for="${el.id}"]`)) && !el.closest('label'))
      .map((el) => el.outerHTML.slice(0, 60)));
    expect(unnamed, go).toEqual([]);
  }
});
