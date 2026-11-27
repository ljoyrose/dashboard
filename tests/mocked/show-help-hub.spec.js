// Show help on the CD Hub (the owner 18 Nov 2026): the Look menu's Help row turns help lines on; off by default; data lines stay.
const { test, expect, HUBS } = require('../fixtures/job34/load');

test('hub: Compliance help lines hidden by default; Look → Show help shows them; Hidden hides them again', async ({ page, guard }) => {
  await HUBS.cdhub.open(page, guard);
  await page.evaluate(() => go('compliance'));
  const help = page.locator('#main .help').first();
  await expect(help).toHaveCount(1);
  await expect(help).toBeHidden();
  await expect(page.locator('#main p.mut:not(.help)').first()).toBeVisible();   // data and empty-state lines are not help
  await page.locator('#houseLookBtn').click();
  await page.getByRole('button', { name: 'Show help' }).click();
  await expect(help).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dash-look')).help)).toBe('on');
  await page.getByRole('button', { name: 'Hidden' }).click();
  await expect(help).toBeHidden();
});
