// Dog photo crop on a phone (Lisa, 12 Nov 2026): the crop fits the screen, a finger drag moves the picture, the
// buttons are phone-sized, and Use photo sends a square JPEG within the limit. Invented dog, pretend save script.
const { test, expect } = require('../support/test');
const { openOneDog, recordSaves, bigPhoto, jpegSize } = require('../support/dog-photo-world');

async function touchDrag(page, x, y, dx) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * i / 5, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test.describe('Phone: dog photo crop', () => {
  test('fits the screen, drags by touch, and Use photo sends 800 x 800 within 350,000 characters', async ({ page, guard }) => {
    await openOneDog(page, guard);
    const bodies = await recordSaves(page);
    const big = await bigPhoto(page, 2400, 1600);
    const input = page.locator('#rows article.dc input[type="file"]');

    // first: no drag
    await input.setInputFiles(big.file);
    const dlg = page.locator('.pcrop[role="dialog"]');
    await expect(dlg).toBeVisible();
    const view = await dlg.locator('[data-crop-view]').boundingBox();
    expect(view.x).toBeGreaterThanOrEqual(0);
    expect(view.x + view.width).toBeLessThanOrEqual(390);
    const use = await dlg.locator('[data-crop-use]').boundingBox();
    expect(use.height).toBeGreaterThanOrEqual(44);
    await dlg.locator('[data-crop-use]').tap();
    await expect.poll(() => bodies.length).toBe(1);

    // second: the same picture dragged sideways by a finger gives a different crop
    await expect(input).toBeEnabled();
    await input.setInputFiles(big.file);
    await expect(dlg).toBeVisible();
    const v2 = await dlg.locator('[data-crop-view]').boundingBox();
    await touchDrag(page, v2.x + v2.width / 2, v2.y + v2.height / 2, -100);
    // click, not tap: the raw touch drag above uses its own DevTools session, which leaves Playwright's tap state behind
    await dlg.locator('[data-crop-use]').click();
    await expect.poll(() => bodies.length).toBe(2);

    for (const b of bodies) {
      expect(b.fields.image_base64.length).toBeLessThanOrEqual(350000);
      expect(await jpegSize(page, b.fields.image_base64)).toEqual([800, 800]);
    }
    expect(bodies[1].fields.image_base64).not.toBe(bodies[0].fields.image_base64);
  });
});
