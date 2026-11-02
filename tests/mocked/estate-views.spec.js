// Web Estate Access tab and client view (30 Oct 2026): role names only, never a login; a client view shows one
// client's rows with no other client, no other company and no internal note. Pretend Google; invented rows.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const F = require('../fixtures/estate/rows.js');

const CONFIG = fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8');
const ROWS = F.ROWS.concat([
  { key: 'a2.example.test', kind: 'site', company: 'Second Ltd', client: 'Client A', owner_role: 'builder', url_or_domain: 'https://a2.example.test', live_status: 'live', access_note: 'owner: someone@example.com; editor: Pat', flag: 'INTERNAL-ONLY-FLAG', source: 'manual' },
  { key: 'b2.example.test', kind: 'site', company: 'Third Ltd', client: 'Client B', url_or_domain: 'https://b2.example.test', live_status: 'down', access_note: 'manager: Sam' },
]);

async function open(page, hash) {
  await page.route(/\/config\.js$/, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: CONFIG.replace(/estate: \{\s*sheetId: ''/, "estate: {\n      sheetId: 'SHEET_TEST'") }));
  await page.route(/^https:\/\/sheets\.googleapis\.com\//, (route) => {
    const url = decodeURIComponent(route.request().url());
    if (!/\/values\//.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ sheets: [{ properties: { title: 'Properties' } }] }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: F.values(F.HEADER, ROWS) }) });
  });
  await page.goto('estate/' + hash);
  await page.locator('#view [data-action="signin"]').click();
}

test.describe('Web Estate access and client view', () => {
  test('ACCEPT: the client view of Client A shows no row of Client B and no internal note', async ({ page }) => {
    await open(page, '#/client?client=Client%20A');
    await expect(page.locator('[data-client-view="Client A"]')).toBeVisible();
    const keys = await page.locator('.prop').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')).sort());
    expect(keys).toEqual(['a2.example.test', 'app.example.test']);
    const text = await page.locator('#view').innerText();
    for (const leak of ['Client B', 'b2.example.test', 'Third Ltd', 'Sample Co', 'INTERNAL-ONLY-FLAG', 'someone@', 'Pat', 'manual']) expect(text, leak).not.toContain(leak);
    await expect(page.locator('#tabs')).toBeHidden();
    await expect(page.locator('select[data-filter]')).toHaveCount(0);
  });

  test('Access shows role names only and hides anything that looks like a login', async ({ page }) => {
    await open(page, '#/access');
    const a2 = page.locator('[data-access="a2.example.test"]');
    await expect(a2).toContainText('you: builder');
    await expect(a2).toContainText('editor');
    await expect(a2).toContainText('1 hidden');
    await expect(page.locator('#view')).not.toContainText('someone@');
    await expect(page.locator('[data-card="clients"] a')).toHaveCount(2);
    await page.locator('[data-card="clients"] a', { hasText: 'Client B' }).click();
    await expect(page).toHaveURL(/#\/client\?client=Client%20B$/);
    await expect(page.locator('.prop')).toHaveCount(2); // b2 and the invented Client B ads account
  });
});
