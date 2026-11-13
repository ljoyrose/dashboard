// Dog photo crop and shrink (Lisa, 12 Nov 2026: "That request was too large" from a phone photo). After a picture is
// chosen a square crop opens; Use photo always sends an 800 x 800 JPEG of at most 350,000 base64 characters, never the
// original; Cancel sends nothing; a picture this browser cannot open gets a plain message. Invented dog, pretend script.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('../fixtures/job34/load');
const { openOneDog, recordSaves, bigPhoto, jpegSize } = require('../support/dog-photo-world');

test.describe('CD Hub dog photo: crop, then shrink', () => {
  test('the crop opens with Rotate, Cancel and Use photo; Use photo sends a square JPEG within the limit', async ({ page, guard }) => {
    await openOneDog(page, guard);
    const bodies = await recordSaves(page);
    const big = await bigPhoto(page);
    expect(big.b64len).toBeGreaterThan(350000);   // the original would have been too large
    await page.locator('#rows article.dc input[data-photo-src="upload"]').setInputFiles(big.file);
    const dlg = page.locator('.pcrop[role="dialog"]');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('h3')).toHaveText('Crop and edit the photo');
    await expect(dlg.locator('[data-crop-rotate]')).toHaveText('Rotate 90\u00b0');
    await expect(dlg.locator('[data-crop-cancel]')).toHaveText('Cancel');
    await expect(dlg.locator('[data-crop-use]')).toHaveText('Use photo');
    // square crop box
    const box = await dlg.locator('[data-crop-view]').boundingBox();
    expect(Math.abs(box.width - box.height)).toBeLessThan(2);
    // drag and zoom work without errors
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2, { steps: 4 }); await page.mouse.up();
    await dlg.locator('[data-crop-zoom]').fill('2');
    await dlg.locator('[data-crop-rotate]').click();
    await dlg.locator('[data-crop-use]').click();
    await expect(dlg).toHaveCount(0);
    await expect.poll(() => bodies.length).toBe(1);
    const f = bodies[0].fields;
    expect(bodies[0].action).toBe('dog_photo');
    expect(f.subject_id).toBe('sub-x2');
    expect(f.mime).toBe('image/jpeg');
    expect(f.image_base64.length).toBeLessThanOrEqual(350000);
    expect(f.image_base64.slice(0, 4)).toBe('/9j/');   // JPEG
    expect(await jpegSize(page, f.image_base64)).toEqual([800, 800]);
    await expect(page.locator('#rows article.dc img.dogphoto')).toHaveAttribute('data-photo-id', 'drv-photo-new');
  });

  test('Cancel closes the crop and sends nothing', async ({ page, guard }) => {
    await openOneDog(page, guard);
    const bodies = await recordSaves(page);
    const big = await bigPhoto(page, 1200, 900);
    await page.locator('#rows article.dc input[data-photo-src="upload"]').setInputFiles(big.file);
    await page.locator('[data-crop-cancel]').click();
    await expect(page.locator('.pcrop')).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(bodies.length).toBe(0);
    await expect(page.locator('#rows article.dc [data-photo-msg]')).toHaveText('');
    await expect(page.locator('#rows article.dc input[data-photo-src="upload"]')).toBeEnabled();
  });

  test('a picture this browser cannot open (HEIC) says so in plain words and sends nothing', async ({ page, guard }) => {
    await openOneDog(page, guard);
    const bodies = await recordSaves(page);
    const f = path.join(os.tmpdir(), 'pretend-photo.heic');
    fs.writeFileSync(f, Buffer.from('not really a heic picture'));
    await page.locator('#rows article.dc input[data-photo-src="upload"]').setInputFiles({ name: 'pretend-photo.heic', mimeType: 'image/heic', buffer: fs.readFileSync(f) });
    await expect(page.locator('#rows article.dc [data-photo-msg]')).toHaveText('That picture type can\u2019t be read here. Try a screenshot of it.');
    await expect(page.locator('.pcrop')).toHaveCount(0);
    expect(bodies.length).toBe(0);
  });
});
