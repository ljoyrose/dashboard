// Dog card photo (Lisa, 13 Nov 2026): a bigger photo; Take photo (camera) or Upload photo on any device; edit
// (brightness, contrast) and crop before save; the page still shrinks to 800 x 800 within 350,000 characters (#500).
// Invented dog and invented pictures only; the save script is pretend; the camera is a pretend canvas camera.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('../fixtures/job34/load');
const { openOneDog, recordSaves, bigPhoto, jpegSize } = require('../support/dog-photo-world');

/** A flat mid-grey JPEG (invented), so a brightness change shows plainly in the saved pixels. */
async function greyPhoto(page, w = 1200, h = 900) {
  const b64 = await page.evaluate(([w, h]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    const u = c.toDataURL('image/jpeg', 0.95); return u.slice(u.indexOf(',') + 1);
  }, [w, h]);
  const file = path.join(os.tmpdir(), `pretend-grey-photo-${w}x${h}.jpg`);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  return file;
}

/** A pretend camera: getUserMedia answers with a moving canvas (invented picture), and every track is kept in
 *  window.__tracks so a test can check the camera was turned off. No real camera, no browser flags. */
async function fakeCamera(page) {
  await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 640; c.height = 480;
    const g = c.getContext('2d'); let t = 0;
    setInterval(() => { t++; g.fillStyle = '#5a7'; g.fillRect(0, 0, 640, 480); g.fillStyle = '#fff'; g.fillRect(100 + (t % 50), 120, 200, 200); }, 40);
    window.__tracks = [];
    navigator.mediaDevices.getUserMedia = () => { const s = c.captureStream(25); window.__tracks.push(...s.getTracks()); return Promise.resolve(s); };
  });
}

/** Mean of the red channel at the centre of a saved JPEG. */
async function centreLevel(page, b64) {
  return page.evaluate((b) => new Promise((res) => {
    const i = new Image();
    i.onload = () => { const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
      const d = g.getImageData(c.width / 2 - 10, c.height / 2 - 10, 20, 20).data; let s = 0; for (let k = 0; k < d.length; k += 4) s += d[k]; res(s / (d.length / 4)); };
    i.src = 'data:image/jpeg;base64,' + b;
  }), b64);
}

test.describe('CD Hub dog card photo: bigger, edit before save', () => {
  test('the photo on the dog card is at least 120 x 120 on a laptop', async ({ page, guard }) => {
    await openOneDog(page, guard);
    const box = await page.locator('#rows article.dc .ph').boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(120);
    expect(Math.abs(box.width - box.height)).toBeLessThan(1);
    // the two buttons sit under the photo, each as wide as it
    for (const b of await page.locator('#rows article.dc label.dogphoto-btn').all()) {
      const bb = await b.boundingBox();
      expect(Math.abs(bb.width - box.width)).toBeLessThan(2);
    }
  });

  test('brightness and contrast change the saved picture; Reset puts them back; the size line shows the shrink', async ({ page, guard }) => {
    await openOneDog(page, guard);
    const bodies = await recordSaves(page);
    const grey = await greyPhoto(page);
    const input = page.locator('#rows article.dc input[data-photo-src="upload"]');
    const dlg = page.locator('.pcrop[role="dialog"]');

    // 1: no edit
    await input.setInputFiles(grey);
    await expect(dlg.locator('h3')).toHaveText('Crop and edit the photo');
    await expect(dlg.locator('[data-crop-size]')).toHaveText(/^Saves as 800 × 800, about \d+ KB \(picture was \d+(\.\d)? (KB|MB)\)$/);
    await dlg.locator('[data-crop-use]').click();
    await expect.poll(() => bodies.length).toBe(1);

    // 2: brighter
    await expect(input).toBeEnabled();
    await input.setInputFiles(grey);
    await dlg.locator('[data-crop-bright]').fill('40');
    await dlg.locator('[data-crop-use]').click();
    await expect.poll(() => bodies.length).toBe(2);

    // 3: brighter, then Reset: back to the plain picture
    await expect(input).toBeEnabled();
    await input.setInputFiles(grey);
    await dlg.locator('[data-crop-bright]').fill('40');
    await dlg.locator('[data-crop-contrast]').fill('30');
    await dlg.locator('[data-crop-reset]').click();
    await expect(dlg.locator('[data-crop-bright]')).toHaveValue('0');
    await expect(dlg.locator('[data-crop-contrast]')).toHaveValue('0');
    await dlg.locator('[data-crop-use]').click();
    await expect.poll(() => bodies.length).toBe(3);

    const [plain, bright, reset] = await Promise.all(bodies.map((b) => centreLevel(page, b.fields.image_base64)));
    expect(Math.abs(plain - 128)).toBeLessThan(6);
    expect(bright - plain, 'brightness +40 lifts the saved pixels').toBeGreaterThan(80);
    expect(Math.abs(reset - plain)).toBeLessThan(3);
    for (const b of bodies) {
      expect(b.fields.image_base64.length).toBeLessThanOrEqual(350000);
      expect(await jpegSize(page, b.fields.image_base64)).toEqual([800, 800]);
    }
  });

  test('a busy picture still saves within the limit after an edit (the #500 shrink is kept)', async ({ page, guard }) => {
    await openOneDog(page, guard);
    const bodies = await recordSaves(page);
    const big = await bigPhoto(page);
    await page.locator('#rows article.dc input[data-photo-src="upload"]').setInputFiles(big.file);
    const dlg = page.locator('.pcrop[role="dialog"]');
    await dlg.locator('[data-crop-contrast]').fill('50');
    await dlg.locator('[data-crop-zoom]').fill('1.5');
    await dlg.locator('[data-crop-use]').click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0].fields.image_base64.length).toBeLessThanOrEqual(350000);
    expect(await jpegSize(page, bodies[0].fields.image_base64)).toEqual([800, 800]);
  });
});

test.describe('CD Hub dog card photo: Take photo on a laptop camera', () => {
  test('Take photo opens the camera in the page; Take photo then Use photo saves an 800 x 800 JPEG', async ({ page, guard }) => {
    await openOneDog(page, guard);
    const bodies = await recordSaves(page);
    await fakeCamera(page);
    let chooser = false;
    page.on('filechooser', () => { chooser = true; });
    await page.locator('#rows article.dc label[data-photo-take]').click();
    const cam = page.locator('.pcam[role="dialog"]');
    await expect(cam.locator('h3')).toHaveText('Take a photo');
    await expect.poll(() => cam.locator('video').evaluate((v) => v.videoWidth)).toBeGreaterThan(0);
    await cam.locator('[data-cam-take]').click();
    await expect(cam).toHaveCount(0);
    const dlg = page.locator('.pcrop[role="dialog"]:not(.pcam)');
    await expect(dlg.locator('h3')).toHaveText('Crop and edit the photo');
    await dlg.locator('[data-crop-use]').click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(chooser, 'no file picker on a laptop: the page camera opens instead').toBe(false);
    expect(bodies[0].fields.subject_id).toBe('sub-x2');
    expect(bodies[0].fields.image_base64.length).toBeLessThanOrEqual(350000);
    expect(await jpegSize(page, bodies[0].fields.image_base64)).toEqual([800, 800]);
  });

  test('Cancel on the camera closes it, turns the camera off and sends nothing', async ({ page, guard }) => {
    await openOneDog(page, guard);
    const bodies = await recordSaves(page);
    await fakeCamera(page);
    await page.locator('#rows article.dc label[data-photo-take]').click();
    const cam = page.locator('.pcam[role="dialog"]');
    await expect(cam).toBeVisible();
    await cam.locator('[data-cam-cancel]').click();
    await expect(cam).toHaveCount(0);
    expect(await page.evaluate(() => window.__tracks.length > 0 && window.__tracks.every((t) => t.readyState === 'ended'))).toBe(true);
    await page.waitForTimeout(300);
    expect(bodies.length).toBe(0);
    await expect(page.locator('#rows article.dc input[data-photo-src="camera"]')).toBeEnabled();
  });
});

test.describe('CD Hub dog card photo: no camera allowed', () => {
  test('a refused camera says what to do in plain words and sends nothing', async ({ page, guard }) => {
    await openOneDog(page, guard);
    const bodies = await recordSaves(page);
    await page.evaluate(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError')); });
    await page.locator('#rows article.dc label[data-photo-take]').click();
    await expect(page.locator('#rows article.dc [data-photo-msg]')).toHaveText('The camera could not be opened. Allow the camera, or use Upload photo.');
    await expect(page.locator('.pcam')).toHaveCount(0);
    expect(bodies.length).toBe(0);
  });
});
