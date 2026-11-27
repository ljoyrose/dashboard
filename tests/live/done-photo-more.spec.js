// Live, signed out: the CD Hub carries the photo-after-Done offer for Outstanding, Jobs-row ticks and SOP Record.
// A real save needs sign-in, so the live check proves the code is there; the mocked suite proves it works.
const { test, expect } = require('@playwright/test');

test.skip(!process.env.LIVE_SMOKE, 'Live check is off. Run with LIVE_SMOKE=1 to turn it on.');

test('the photo-after-Done offer for Outstanding, Jobs ticks and SOP Record is live on the CD Hub @live', async ({ page }) => {
  await page.goto('cdhub/');
  await expect.poll(() => page.evaluate(() => typeof window.hubDonePhoto === 'function'
    && !!(window.BLDEvidencePhoto && window.BLDEvidencePhoto.offer)
    && /donePhoto/.test(String(window.CDWork && window.CDWork.bind)))).toBe(true);
});
