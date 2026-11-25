// The section's view chips sit at the top with every one in sight on a phone: they wrap, never scroll sideways
// (the owner 15-16 Nov 2026: "Records still goes to Dogs then needs scroll"). Pretend Google and Drive only.
const { test, expect } = require('../support/test');

test.use({ viewport: { width: 390, height: 800 } });

test('phone: every Records chip is on screen at the top, no sideways scroll @regression', async ({ page }) => {
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  await page.evaluate(() => go('dogs'));
  const row = page.locator('.hchips');
  await expect(row).toBeVisible();
  const chips = row.locator('.hchip');
  expect(await chips.count()).toBeGreaterThan(3);
  expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const vw = await page.evaluate(() => window.innerWidth);
  for (const b of await chips.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ l: r.left, r: r.right, t: r.top })))) {
    expect(b.l).toBeGreaterThanOrEqual(0);
    expect(b.r).toBeLessThanOrEqual(vw);
    expect(b.t).toBeLessThan(250);
  }
});
