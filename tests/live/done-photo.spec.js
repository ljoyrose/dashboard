// Live, signed out: the shared photo helper is served and loaded by the staff page and the CD Hub.
// A real save needs sign-in, so the live check proves the code is there; the mocked suite proves it works.
const { test, expect } = require('@playwright/test');

test.skip(!process.env.LIVE_SMOKE, 'Live check is off. Run with LIVE_SMOKE=1 to turn it on.');

test('the photo-after-Done helper is live and loaded by the staff page and the CD Hub @live', async ({ page, request }) => {
  const res = await request.get('cdhub/staff/lib/evidence-photo.js?cb=' + Date.now(), { headers: { 'Cache-Control': 'no-cache' } });
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('BLDEvidencePhoto');
  for (const url of ['cdhub/staff/', 'cdhub/']) {
    await page.goto(url);
    await expect.poll(() => page.evaluate(() => !!(window.BLDEvidencePhoto && window.BLDEvidencePhoto.offer && window.BLDEvidencePhoto.doneOn))).toBe(true);
  }
});
