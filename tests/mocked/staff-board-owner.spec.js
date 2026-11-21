// Board A (Lisa 17 Nov 2026): an owner opens The Board with the same Google sign-in as CD Hub, no code.
// Pretend Google and a pretend save script only. The token, address and names here are invented.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const READ_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const result = { rows: [], tables: { area: [], subject: [], occupancy: [], subject_status: [] }, role: 'OWNER', name: 'Pat Example' };

async function signedIn(page, urlKept) {
  await page.addInitScript(([scope, url]) => {
    localStorage.setItem('ljr-dash-auth', JSON.stringify({ access_token: 'fake-owner-token-0001', expires_at: Date.now() + 1800000, scope }));
    if (url) localStorage.setItem('cdhub.sink.url', url);
  }, [READ_SCOPE, urlKept ? SCRIPT : '']);
}
async function fakeScript(page, answer) {
  const bodies = [];
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    bodies.push(JSON.parse(route.request().postData() || '{}'));
    return route.fulfill({ headers: CORS, json: answer() });
  });
  return bodies;
}

test('an owner signed in to CD Hub opens The Board with no code; reads carry the Google sign-in, not a code', async ({ page }) => {
  await signedIn(page, true);
  const bodies = await fakeScript(page, () => ({ ok: true, result }));
  await page.goto('cdhub/staff/');
  await expect(page.getByRole('heading', { name: 'The Board' })).toBeVisible();
  await expect(page.locator('#me')).toContainText('Welcome Pat Example · Owner');
  await expect(page.getByRole('button', { name: 'Use a staff code' })).toBeVisible();
  await expect(page.getByLabel('Your staff code')).toHaveCount(0);
  expect(bodies.length).toBeGreaterThan(0);
  for (const b of bodies) { expect(b.google_token).toBe('fake-owner-token-0001'); expect(b.code).toBe(''); }
  expect(await page.evaluate(() => localStorage.getItem('bld.device.code'))).toBeNull();
});

test('an owner with no save address on this phone: it is read from the hub folder, then The Board opens', async ({ page }) => {
  await signedIn(page, false);
  await fakeScript(page, () => ({ ok: true, result }));
  await page.route(/https:\/\/www\.googleapis\.com\/drive\/v3\/files\?/, (route) => route.fulfill({ headers: CORS, json: { files: [{ id: 'fake-file-1' }] } }));
  await page.route(/https:\/\/www\.googleapis\.com\/drive\/v3\/files\/fake-file-1\?alt=media/, (route) => route.fulfill({ headers: CORS, json: { url: SCRIPT } }));
  await page.goto('cdhub/staff/');
  await expect(page.getByRole('heading', { name: 'The Board' })).toBeVisible();
  await expect(page.locator('#me')).toContainText('Owner');
  expect(await page.evaluate(() => localStorage.getItem('bld.scriptUrl'))).toBe(SCRIPT);
});

// Storage tidy, stage 2 (owner 15 Nov 2026): the file may carry set_at and set_by (a role); only url is used. The address
// found is kept for CD Hub too (cdhub.save.url), unless CD Hub was switched off on this phone (new or old key).
for (const off of [null, 'cdhub.save.off', 'cdhub.sink.off']) {
  test(`an owner's address from the hub folder (with set_at and set_by) is ${off ? 'not shared while ' + off + ' is set' : 'kept for CD Hub too'}`, async ({ page }) => {
    await signedIn(page, false);
    if (off) await page.addInitScript((k) => localStorage.setItem(k, '1'), off);
    await fakeScript(page, () => ({ ok: true, result }));
    await page.route(/https:\/\/www\.googleapis\.com\/drive\/v3\/files\?/, (route) => route.fulfill({ headers: CORS, json: { files: [{ id: 'fake-file-1' }] } }));
    await page.route(/https:\/\/www\.googleapis\.com\/drive\/v3\/files\/fake-file-1\?alt=media/, (route) => route.fulfill({ headers: CORS, json: { url: SCRIPT, set_at: '2026-11-15', set_by: 'owner' } }));
    await page.goto('cdhub/staff/');
    await expect(page.getByRole('heading', { name: 'The Board' })).toBeVisible();
    await expect(page.locator('#me')).toContainText('Owner');
    expect(await page.evaluate(() => localStorage.getItem('bld.scriptUrl'))).toBe(SCRIPT);
    expect(await page.evaluate(() => localStorage.getItem('cdhub.save.url'))).toBe(off ? null : SCRIPT);
  });
}

test('a Google account the save script refuses drops to the staff code, with a plain reason', async ({ page }) => {
  await signedIn(page, true);
  await fakeScript(page, () => ({ ok: false, code: 'GOOGLE_NOT_OWNER', message: 'no' }));
  await page.goto('cdhub/staff/');
  await expect(page.getByText('This Google account is not on the owner list. Type your staff code.')).toBeVisible();
  await expect(page.getByLabel('Your staff code')).toBeVisible();
});

test('a staff phone sees the owner button, and a staff code typed in the set-up box is explained, not called a bad QR', async ({ page }) => {
  await page.goto('cdhub/staff/');
  await expect(page.getByRole('button', { name: 'Owner: sign in with Google' })).toBeVisible();
  await page.getByRole('button', { name: 'Type set-up code instead' }).click();
  await page.getByLabel('Set-up code').fill('ABCD2345678');
  await page.getByRole('button', { name: 'Use this code' }).click();
  await expect(page.getByText('That looks like a staff code.')).toBeVisible();
  await expect(page.getByText('That set-up QR was not right')).toHaveCount(0);
});
