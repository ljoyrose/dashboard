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
});
