// Web Estate Add box (30 Oct 2026): one request file per Add, "queued" shown, anything that is not http, https or a
// bare domain refused with nothing sent. Pretend Google only; every address is invented.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const F = require('../fixtures/estate/rows.js');

const UPLOAD = /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files/;
const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');

async function setUp(page, ids = true) {
  const uploads = [];
  await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript',
    body: ids ? CONFIG.replace(/estate: \{\s*sheetId: '',\s*requestsFolderId: ''/, "estate: {\n      sheetId: 'SHEET_TEST',\n      requestsFolderId: 'REQ_FOLDER_TEST'") : CONFIG }));
  await page.route(/^https:\/\/sheets\.googleapis\.com\//, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: F.values() }) }));
  await page.route(UPLOAD, (route) => { uploads.push(route.request().postData()); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"NEWFILE"}' }); });
  await page.goto('estate/#/home');
  await page.locator('#view [data-action="signin"]').click();
  await page.locator('summary[data-action="addtoggle"]').click();
  return uploads;
}

test.describe('Web Estate Add', () => {
  test('ACCEPT: Add writes exactly one request with the invented address and shows queued', async ({ page }) => {
    const uploads = await setUp(page);
    await page.locator('[data-add="input"]').fill('https://new-site.example.org/');
    await page.locator('[data-add="company"]').fill('Sample Co');
    await page.locator('[data-add="client"]').fill('Client A');
    await page.locator('[data-action="add"]').click();
    await expect(page.locator('#addMsg')).toContainText('Queued: new-site.example.org');
    expect(uploads.length).toBe(1);
    const body = uploads[0];
    expect(body).toContain('"parents":["REQ_FOLDER_TEST"]');
    expect(body).toMatch(/"name":"estate-add-\d+\.json"/);
    const json = JSON.parse(body.split('Content-Type: application/json\r\n\r\n')[1].split('\r\n--')[0]);
    expect(json).toMatchObject({ kind: 'estate-add', source: 'Add', company: 'Sample Co', client: 'Client A', row_kind: 'site' });
    expect(json.target.url).toBe('https://new-site.example.org/');
    await expect(page.locator('[data-add="input"]')).toHaveValue('');
  });

  test('anything that is not http, https or a bare domain is refused and nothing is sent', async ({ page }) => {
    const uploads = await setUp(page);
    await page.locator('[data-add="company"]').fill('Sample Co');
    for (const bad of ['ftp://example.com', 'javascript:alert(1)', 'mailto:a@example.com', 'file:///etc/passwd', 'https://user:pw@example.com', 'not a domain']) {
      await page.locator('[data-add="input"]').fill(bad);
      await page.locator('[data-action="add"]').click();
      await expect(page.locator('#addMsg')).toContainText('Not added');
    }
    expect(uploads).toEqual([]);
  });

  test('a bare domain is accepted; a blank company is refused', async ({ page }) => {
    const uploads = await setUp(page);
    await page.locator('[data-add="input"]').fill('example.net');
    await page.locator('[data-action="add"]').click();
    await expect(page.locator('#addMsg')).toContainText('Not added');
    await page.locator('[data-add="company"]').fill('Sample Co');
    await page.locator('[data-action="add"]').click();
    await expect(page.locator('#addMsg')).toContainText('Queued: example.net');
    expect(uploads.length).toBe(1);
  });

  test('not set up: Add explains and sends nothing', async ({ page }) => {
    const uploads = await setUp(page, false);
    await page.locator('[data-add="input"]').fill('https://example.com');
    await page.locator('[data-add="company"]').fill('Example Co');
    await page.locator('[data-action="add"]').click();
    await expect(page.locator('#addMsg')).toContainText('Example only: nothing was sent');
    expect(uploads).toEqual([]);
  });
});
