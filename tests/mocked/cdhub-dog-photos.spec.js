// Dogs cards: a photo from the subject `photo` cell, the paw when there is none or it will not load,
// and Take photo / Upload photo. Invented dogs only. The save script is pretend; no folder id is in this file.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, HUBS } = require('../fixtures/job34/load');

const SINK = 'https://script.google.com/macros/s/PRETENDSCRIPT/exec';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const SUBJECT = csv('id,tenant_id,name,sex,dob,kind,neuter_status,photo', [
  'sub-x1,t,Pretend One,Female,2021-01-01,Breeding Female,entire,https://drive.google.com/file/d/drv-photo-pretend/view',
  'sub-x2,t,Pretend Two,Male,2022-01-01,Stud,entire,',
  'sub-x3,t,Pretend Three,Female,2020-06-01,Breeding Female,entire,drv-photo-bad'
]);
const STATUS = csv('id,tenant_id,subject_id,state', [
  's1,t,sub-x1,Active',
  's2,t,sub-x2,Active',
  's3,t,sub-x3,Active'
]);

function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
}

function card(page, name) {
  return page.locator('#rows article.dc', { hasText: name });
}

async function openDogs(page, guard) {
  const w = guard.world;
  put(w, 'BLD-subject.csv', SUBJECT);
  put(w, 'BLD-subject_status.csv', STATUS);
  w.file('drv-photo-pretend', 'pretend.png', '', { mimeType: 'image/png' });
  w.byId('drv-photo-pretend').thumbnailLink = 'https://example.com/pretend-dog.png';
  w.file('drv-photo-bad', 'bad.png', 'not-a-picture', { mimeType: 'text/plain' });
  await HUBS.cdhub.open(page, guard);
  await page.evaluate(() => go('dogs'));
  await expect(page.locator('#rows article.dc')).toHaveCount(3);
}

test.describe('CD Hub dog photos', () => {
  test('a Drive photo is shown, an empty cell keeps the paw, and a picture that will not load returns to the paw', async ({ page, guard }) => {
    await openDogs(page, guard);
    const shown = card(page, 'Pretend One');
    await expect(shown.locator('img.dogphoto')).toBeVisible();
    await expect(shown.locator('img.dogphoto')).toHaveAttribute('src', 'https://example.com/pretend-dog.png');
    await expect(shown.locator('img.dogphoto')).toHaveAttribute('data-photo-id', 'drv-photo-pretend');
    await expect(shown.locator('[data-paw]')).toBeHidden();

    const empty = card(page, 'Pretend Two');
    await expect(empty.locator('img.dogphoto')).toHaveCount(0);
    await expect(empty.locator('[data-paw]')).toBeVisible();

    const broken = card(page, 'Pretend Three');
    await expect(broken.locator('[data-paw]')).toBeVisible();
    await expect(broken.locator('img.dogphoto')).toBeHidden();
  });

  test('each card has Take photo (camera) and Upload photo (library or files), both accepting images (Lisa, 13 Nov 2026)', async ({ page, guard }) => {
    await openDogs(page, guard);
    const shown = card(page, 'Pretend One');
    const empty = card(page, 'Pretend Two');
    for (const c of [shown, empty]) {
      await expect(c.locator('label.dogphoto-btn')).toHaveText(['Take photo', 'Upload photo']);
      const take = c.locator('input[data-photo-src="camera"]');
      const up = c.locator('input[data-photo-src="upload"]');
      await expect(take).toHaveAttribute('accept', 'image/*');
      await expect(up).toHaveAttribute('accept', 'image/*');
      // Take photo opens the camera on a phone; Upload photo has no capture, so it offers the library and files
      await expect(take).toHaveAttribute('capture', 'environment');
      expect(await up.getAttribute('capture')).toBeNull();
    }
    await expect(empty.locator('.dogphoto-btns')).toHaveAttribute('aria-label', 'Add a photo of Pretend Two');
    await expect(shown.locator('.dogphoto-btns')).toHaveAttribute('aria-label', 'Change the photo of Pretend One');
    const chooser = page.waitForEvent('filechooser');
    await empty.locator('label[data-photo-upload]').click();
    const opened = await chooser;
    expect(await opened.element().getAttribute('accept')).toBe('image/*');
    expect(await opened.element().getAttribute('data-dog-photo')).toBe('sub-x2');
  });

  test('a successful upload sends the picture for that dog and the card keeps the new file id', async ({ page, guard }) => {
    await openDogs(page, guard);
    const w = guard.world;
    w.file('drv-photo-new', 'new.png', '', { mimeType: 'image/png' });
    w.byId('drv-photo-new').thumbnailLink = 'https://example.com/pretend-dog-new.png';
    let body = null;
    await page.route(SINK, async (route) => {
      body = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', subject_id: 'sub-x2', file_id: 'drv-photo-new' } }) });
    });
    await page.evaluate((url) => {
      localStorage.setItem('cdhub.sink.url', url);
      localStorage.setItem('cdhub.sink.code', 'pretend-code');
    }, SINK);
    const png = path.join(os.tmpdir(), 'pretend-dog-photo.png');
    fs.writeFileSync(png, PNG);
    await card(page, 'Pretend Two').locator('input[data-photo-src="upload"]').setInputFiles(png);
    await page.locator('[data-crop-use]').click();
    await expect(card(page, 'Pretend Two').locator('img.dogphoto')).toHaveAttribute('data-photo-id', 'drv-photo-new');
    expect(body.action).toBe('dog_photo');
    expect(body.fields.subject_id).toBe('sub-x2');
    expect(body.fields.mime).toBe('image/jpeg');
    expect(body.fields.image_base64.length).toBeGreaterThan(20);
    expect(JSON.stringify(body)).not.toContain('FOLDER');
    await expect(card(page, 'Pretend One').locator('img.dogphoto')).toHaveAttribute('data-photo-id', 'drv-photo-pretend');
    await expect(card(page, 'Pretend Two').locator('.nm')).toHaveText('Pretend Two');
  });

  test('a failed upload says so on the card and leaves the card as it was', async ({ page, guard }) => {
    await openDogs(page, guard);
    await page.route(SINK, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'NOT_CONFIGURED', message: 'Dog photos are not set up yet.' }) });
    });
    await page.evaluate((url) => {
      localStorage.setItem('cdhub.sink.url', url);
      localStorage.setItem('cdhub.sink.code', 'pretend-code');
    }, SINK);
    const png = path.join(os.tmpdir(), 'pretend-dog-photo.png');
    fs.writeFileSync(png, PNG);
    const two = card(page, 'Pretend Two');
    await two.locator('input[data-photo-src="upload"]').setInputFiles(png);
    await page.locator('[data-crop-use]').click();
    await expect(two.locator('[data-photo-msg]')).toHaveText('Dog photos are not set up yet.');
    await expect(two.locator('img.dogphoto')).toHaveCount(0);
    await expect(two.locator('[data-paw]')).toBeVisible();
    await expect(two.locator('.nm')).toHaveText('Pretend Two');
    await expect(two.locator('label.dogphoto-btn')).toHaveText(['Take photo', 'Upload photo']);
    await expect(two.locator('input[data-dog-photo]').first()).toBeEnabled();
  });
});
