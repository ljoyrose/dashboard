// Private set-up QR on the staff page. Fake code and fake save address only: a real code never goes near a test.
const { test, expect } = require('../support/test');

// The temperature module is optional and not on main yet, so its file answers 404.
test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CODE = 'FAKE-CODE-1';
const CORS = { 'access-control-allow-origin': '*' };
const empty = { rows: [], tables: { area: [], subject: [], occupancy: [], subject_status: [], qr_tag: [], litter: [] } };

async function fakeScript(page, good) {
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    return route.fulfill({ headers: CORS, json: good ? { ok: true, result: empty } : { ok: false, code: 'BAD_CODE', message: 'no' } });
  });
}
const stored = (page) => page.evaluate(() => [localStorage.getItem('bld.device.code'), localStorage.getItem('bld.scriptUrl')]);

test('a good private QR sets the phone up and leaves no code in the address', async ({ page }) => {
  await fakeScript(page, true);
  await page.goto('cdhub/staff/#join=' + encodeURIComponent(CODE) + '&url=' + SCRIPT);
  await expect(page.getByRole('heading', { name: 'The Board' })).toBeVisible();
  expect(page.url()).not.toContain(CODE);
  expect(page.url()).not.toContain('join=');
  expect(await stored(page)).toEqual([CODE, SCRIPT]);
  await expect(page.locator('a[data-link="checks"]')).toHaveAttribute('href', '../checks/');
});

test('a refused code is not remembered', async ({ page }) => {
  await fakeScript(page, false);
  await page.goto('cdhub/staff/#join=' + encodeURIComponent(CODE) + '&url=' + SCRIPT);
  await expect(page.getByText('That code was not accepted')).toBeVisible();
  expect(page.url()).not.toContain(CODE);
  expect((await stored(page))[0]).toBeNull();
});

test('the print page draws the QR on screen only and keeps nothing', async ({ page }) => {
  await fakeScript(page, true);
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
  const sent = [];
  page.on('request', (r) => { if (r.postData()) sent.push(r.postData()); sent.push(r.url()); });
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Private set-up QR' }).click();
  const box = page.locator('[data-private]');
  await expect(box).toHaveClass(/noprint/);
  await expect(box).toContainText('Do not screenshot');
  await box.getByLabel('Their staff code').fill(CODE);
  await box.getByRole('button', { name: 'Show QR' }).click();
  await expect(box.locator('svg')).toBeVisible();
  await expect(box.getByLabel('Their staff code')).toHaveValue('');
  expect(sent.join(' ')).not.toContain(CODE);
  expect(await page.evaluate((c) => JSON.stringify(Object.assign({}, localStorage, sessionStorage)).includes(c), CODE)).toBe(false);
  await box.getByRole('button', { name: 'Remove QR' }).click();
  await expect(box.locator('svg')).toHaveCount(0);
});
