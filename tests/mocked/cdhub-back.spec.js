// Back works the same everywhere (Lisa 15 Nov 2026: "navigating through and back is not easy in this app").
const { test, expect } = require('../support/test');

const signIn = async (page) => {
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};

test.describe('CD Hub Back', () => {
  test.use({ viewport: { width: 390, height: 600 } });

  test('into a record and back: the phone Back and "← Back to" both return to the same place and scroll @regression', async ({ page }) => {
    await signIn(page);
    await page.evaluate(() => go('dogs'));
    await expect(page).toHaveURL(/#\/dogs$/);
    await expect(page.locator('#rows')).toBeVisible();   // Dogs loads its scripts on first open: wait for the list, not the wait card
    await page.evaluate(() => window.scrollTo(0, 500));
    const y = await page.evaluate(() => window.scrollY);
    expect(y).toBeGreaterThan(100);
    // Into a record (as a tap does)
    await page.evaluate(() => { go('areas/area-2'); focusView(); });
    await expect(page).toHaveURL(/#\/areas\/area-2$/);
    const back = page.locator('#main .hback');
    await expect(back).toHaveText('← Back to Dogs');
    await back.click();
    await expect(page).toHaveURL(/#\/dogs$/);
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(Math.round(y));
    // The phone's own Back does the same
    await page.evaluate(() => { go('areas/area-2'); });
    await page.goBack();
    await expect(page).toHaveURL(/#\/dogs$/);
    await expect.poll(() => page.evaluate(() => Math.round(window.scrollY))).toBe(Math.round(y));
  });

  test('every move between views is a real Back step', async ({ page }) => {
    await signIn(page);
    await page.evaluate(() => go('dogs'));
    await page.evaluate(() => go('litters'));
    await page.evaluate(() => go('areas'));
    await page.goBack();
    await expect(page).toHaveURL(/#\/litters$/);
    await page.goBack();
    await expect(page).toHaveURL(/#\/dogs$/);
  });

  test('a record opened cold from a link shows a way back to its list', async ({ page }) => {
    await signIn(page);
    await page.goto('cdhub/#/areas/area-2');
    await page.reload();
    await expect(page.locator('[data-focus="room"]')).toContainText('Test Cabin B');
    const back = page.locator('#main a.hback');
    await expect(back).toHaveText('← Areas');
    await back.click();
    await expect(page).toHaveURL(/#\/areas$/);
  });

  test('an SOP link keeps its address, so it can be shared and opened again', async ({ page }) => {
    await signIn(page);
    await page.evaluate(() => go('sops'));
    await page.evaluate(() => go('sops/' + encodeURIComponent('Microchip Audit')));
    await expect(page).toHaveURL(/#\/sops\/Microchip%20Audit$/);
    await expect(page.locator('#main .hback')).toHaveText('← Back to SOPs');
  });

  test('one header on every page: Home on the left, Back in the top bar once there is somewhere to go back to', async ({ page }) => {
    await signIn(page);
    const hb = page.locator('header #hubBack');
    await expect(page.locator('header #backHome')).toBeVisible();
    await expect(hb).toBeHidden();                                   // opened cold: nowhere to go back to
    await page.evaluate(() => go('dogs'));
    await expect(hb).toBeVisible();
    await expect(hb).toHaveAttribute('aria-label', 'Back (Main)');
    await page.evaluate(() => { go('areas/area-2'); focusView(); });
    await expect(hb).toHaveAttribute('aria-label', 'Back (Dogs)');
    await expect(hb).toHaveAttribute('title', 'Back to Dogs');
    const box = await hb.boundingBox();
    expect(Math.round(box.height)).toBe(44);                          // the house icon button
    await hb.click();
    await expect(page).toHaveURL(/#\/dogs$/);
    await expect(hb).toHaveAttribute('aria-label', 'Back (Main)');
    await hb.click();
    await expect(page).toHaveURL(/#\/map$|\/cdhub\/$/);
  });

  test('the temps page opened from the hub has Back to CD Hub; opened cold it has none', async ({ page }) => {
    await page.route(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export\?/, (route) => route.fulfill({ status: 200, contentType: 'text/csv', body: 'date,time,room,temp\n' }));
    await signIn(page);
    await page.evaluate(() => go('round'));
    await page.locator('#chips a.hchip', { hasText: 'Temps' }).click();
    await expect(page).toHaveURL(/history\.html/);
    const hb = page.locator('header #hubBack');
    await expect(hb).toBeVisible();
    await expect(hb).toHaveAttribute('aria-label', 'Back (CD Hub)');
    await hb.click();
    await expect(page).toHaveURL(/#\/round$/);
    await page.goto('cdhub/history.html');
    await expect(page.locator('header #hubBack')).toBeHidden();
  });
});
