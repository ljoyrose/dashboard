// OPTIONAL. Opens the three real web addresses, signed out, and checks they are up.
// Never signs in. Skipped unless LIVE_SMOKE=1 (see TESTS.md). In CI this runs as a separate,
// non-blocking job, so a GitHub Pages hiccup cannot turn the main result red.
const { test, expect } = require('@playwright/test');

test.skip(!process.env.LIVE_SMOKE, 'Live check is off. Run with LIVE_SMOKE=1 to turn it on.');

const PAGES = [
  ['Main dashboard', '', /Lisa Dashboard|Map/, '#signInBtn'],
  ['CD Hub', 'cdhub/', /CD Hub/, '#main'],
  ['Money Hub', 'money/', /Money Hub/, '#signInBtn'],
];

for (const [name, url, title, selector] of PAGES) {
  test(`${name} is up and shows its sign-in screen`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const res = await page.goto(url);
    expect(res.status()).toBe(200);
    await expect(page).toHaveTitle(title);
    await expect(page.locator(selector)).toBeVisible();
    expect(errors).toEqual([]);
  });
}
