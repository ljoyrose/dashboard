// Print: dog photos with the CD Hub Google sign-in (the owner 22 Nov 2026: "no photo on any card"). Chrome blocks Google's
// cookies on other sites, so the plain drive.google.com/thumbnail address fails on the live page. With the hub's saved
// sign-in the print page asks Drive for the file's thumbnail link (with the sign-in), as the hub does; if that picture
// fails it fetches the photo itself. Fake token, fake file ids and a 1x1 picture only.
const { test, expect } = require('../fixtures/job34/load');

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const TOKEN = 'fake-owner-token-photo';

async function open(page, { thumbOk }) {
  const tables = {
    area: [{ id: 'ar-a', code: 'Room A' }], requirement: [], area_access: [], area_capacity: [], litter: [], breeding_rule: [], weight: [], microchip: [], check_type: [],
    subject: [{ id: 'd1', name: 'Pretend Bramble', sex: 'Female' }],
    occupancy: [{ subject_id: 'd1', area_id: 'ar-a', moved_in: '2026-01-01' }],
    qr_tag: [{ tag: 'AAAA2222', kind: 'subject', ref_id: 'd1', active: 'true' }],
    files: [{ id: 'fil-1', kind: 'photo', drive_file_id: 'FAKEphotoFile1' }],
    links: [{ id: 'lnk-1', from_table: 'subjects', from_id: 'd1', to_table: 'files', to_id: 'fil-1', role: 'main', from_date: '2026-01-01', to_date: '' }]
  };
  const seen = { meta: [], bytes: [], cookieThumb: 0 };
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[JSON.parse(route.request().postData()).table] || [], role: 'OWNER' } } });
  });
  await page.route(/^https:\/\/drive\.google\.com\/thumbnail/, (route) => { seen.cookieThumb++; return route.fulfill({ status: 403, body: '' }); });   // what Chrome now does
  await page.route(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/FAKEphotoFile1\?fields=thumbnailLink/, (route) => {
    seen.meta.push(route.request().headers().authorization || '');
    return route.fulfill({ headers: CORS, json: { thumbnailLink: 'https://lh3.googleusercontent.com/FAKEthumb=s220' } });
  });
  await page.route(/^https:\/\/lh3\.googleusercontent\.com\//, (route) => route.fulfill(thumbOk ? { contentType: 'image/png', body: PNG } : { status: 403, body: '' }));
  await page.route(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/FAKEphotoFile1\?alt=media/, (route) => {
    seen.bytes.push(route.request().headers().authorization || '');
    return route.fulfill({ headers: CORS, contentType: 'image/png', body: PNG });
  });
  await page.addInitScript(([c, u, t]) => {
    localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u);
    localStorage.setItem('ljr-dash-auth', JSON.stringify({ access_token: t, expires_at: Date.now() + 1800000, scope: 'https://www.googleapis.com/auth/drive.readonly' }));
  }, ['FAKE-OWNER', SCRIPT, TOKEN]);
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Dog cards' }).click();
  return seen;
}
const photo = (page) => page.locator('.dcard[data-dog="d1"] [data-k="photo"] img');
const loaded = (page) => expect.poll(() => photo(page).evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);

test('signed in to CD Hub: the photo comes from the Drive thumbnail link, asked for with the sign-in, never the cookie address @regression @live', async ({ page }) => {
  const seen = await open(page, { thumbOk: true });
  await expect(photo(page)).toHaveAttribute('src', 'https://lh3.googleusercontent.com/FAKEthumb=s800');   // print size, not the 220px list size
  await loaded(page);
  expect(seen.meta).toEqual(['Bearer ' + TOKEN]);
  expect(seen.cookieThumb, 'the cookie-only address is not used when signed in').toBe(0);
  await expect(page.locator('.dcard[data-dog="d1"] [data-k="photo"]')).not.toContainText('Photo');
});

test.describe('thumbnail refused', () => {
  test.use({ allowedConsole: [/Failed to load resource: the server responded with a status of 403/] });   // the refused thumbnail, on purpose
  test('signed in, thumbnail picture refused: the photo itself is fetched with the sign-in and shown', async ({ page }) => {
  const seen = await open(page, { thumbOk: false });
  await expect(photo(page)).toHaveAttribute('src', /^blob:/);
  await loaded(page);
  expect(seen.bytes).toEqual(['Bearer ' + TOKEN]);
  expect(seen.cookieThumb).toBe(0);
});
});
