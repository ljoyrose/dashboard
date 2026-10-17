// The home page, Money Hub and CD Hub used to each keep a sign-in that died on the next page.
const { test, expect } = require('../support/test');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#mainNav')).toBeVisible();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};

test.describe('Shared sign-in', () => {
  test('one sign-in is shared, and an expired token does ask again @regression', async ({ page }) => {
    await page.goto('./');
    await signIn(page);

    await page.goto('money/');
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await expect(page.locator('#signInBtn')).toBeHidden();
    expect(await page.evaluate(() => window.__GIS_CALLS.request)).toBe(0);

    await page.locator('a.back').click();
    await expect(page).toHaveTitle(/Lisa Dashboard|Map/);
    await expect(page.locator('#signInBtn')).toBeHidden();
    await expect(page.locator('#mainNav')).toBeVisible();
    expect(await page.evaluate(() => window.__GIS_CALLS.request)).toBe(0);

    await page.goto('cdhub/');
    await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
    await expect(page.locator('#signinbtn')).toHaveCount(0);
    expect(await page.evaluate(() => window.__GIS_CALLS.request)).toBe(0);

    await page.evaluate(() => {
      const data = JSON.parse(sessionStorage.getItem(window.DashAuth.KEY));
      data.expires_at = Date.now() - 1000;
      sessionStorage.setItem(window.DashAuth.KEY, JSON.stringify(data));
    });

    await page.goto('money/');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await expect(page.locator('#signInBtn')).toContainText('Sign in with Google');
    await expect.poll(() => page.evaluate(() => window.__GIS_LAST_REQUEST && window.__GIS_LAST_REQUEST.prompt)).toBe('');
    await expect(page.locator('#view')).not.toContainText('£');

    await page.goto('./');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await expect(page.locator('#mainNav')).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.__GIS_LAST_REQUEST && window.__GIS_LAST_REQUEST.prompt)).toBe('');

    await page.goto('cdhub/');
    await expect(page.locator('#signinbtn')).toBeEnabled();
    await expect(page.locator('#signinbtn')).toContainText('Sign in with Google');
    await expect.poll(() => page.evaluate(() => window.__GIS_LAST_REQUEST && window.__GIS_LAST_REQUEST.prompt)).toBe('');
  });
});
