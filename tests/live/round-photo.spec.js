// Live, signed out: the CD Hub page carries the Round photo offer and the shared photo helper.
// A real save needs sign-in, so the live check proves the code is there; the mocked suite proves it works.
const { test, expect } = require('@playwright/test');

test.skip(!process.env.LIVE_SMOKE, 'Live check is off. Run with LIVE_SMOKE=1 to turn it on.');

test('the Round photo offer is live on the CD Hub @live', async ({ page }) => {
  await page.goto('cdhub/');
  await expect.poll(() => page.evaluate(() => typeof window.roundPhoto === 'function' && !!(window.BLDEvidencePhoto && window.BLDEvidencePhoto.offer))).toBe(true);
});
