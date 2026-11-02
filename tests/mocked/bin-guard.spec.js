// Bin guard: the 00 CHECK list on the Bin page, against the pretend Drive only. Fake ids, never a real file.
// The page only READS 00 CHECK. ZZ_DELETE and Refer to AI open the guard's own Google page (domain-only web app)
// with the ticked ids; the page itself never changes Drive for these buttons.
const { test, expect } = require('../support/test');

const ctx = { window: {} };
require('vm').runInNewContext(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'config.js'), 'utf8'), ctx);
const BG = ctx.window.DASH_CONFIG.binGuard;
const URL_OK = 'https://script.google.com/a/macros/puppyclassroom.com/s/AKfyFAKE-test-id_1/exec';

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#mainNav')).toBeVisible();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const IN = { parents: [BG.checkFolderId], driveId: 'drv-alpha1', mimeType: 'text/plain' };
const fill = (w) => {
  w.folder(BG.homeFolderId, '*00 Current (sample)', { parents: ['drv-alpha1'], driveId: 'drv-alpha1' });
  w.folder(BG.checkFolderId, '00 CHECK (sample)', { parents: [BG.homeFolderId], driveId: 'drv-alpha1' });
  w.file('chk-a', 'back-from-bin-a.txt', 'invented', IN);
  w.file('chk-b', 'back-from-bin-b.txt', 'invented', IN);
  w.file('chk-rr', 'RR_sample-archive-note.txt', 'invented', IN);
};
const writes = (w) => w.calls.filter((c) => c.method !== 'GET');

test.describe('Bin page: 00 CHECK (bin guard)', () => {
  test('lists 00 CHECK; Select all skips RR_; buttons stay off until the web app is set up', async ({ page, guard }) => {
    const w = guard.world; fill(w);
    await page.goto('./#/bin');
    await signIn(page);
    const card = page.locator('#checkCard');
    await expect(card).toContainText('back-from-bin-a.txt');
    await expect(card).toContainText('RR_sample-archive-note.txt');
    // Stage 5: a protected row has no tick box at all, and with no web app there are no buttons to press, only "Waiting for the tidy bot".
    await expect(card.locator('li', { hasText: 'RR_sample-archive-note.txt' }).locator('input')).toHaveCount(0);
    await expect(card.locator('li', { hasText: 'RR_sample-archive-note.txt' })).toHaveAttribute('title', /RR_/);
    await expect(card.locator('[data-check-nourl]')).toBeVisible();
    await expect(card.locator('[data-check-nourl]')).toContainText('Waiting for the tidy bot');
    await expect(card.locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(card.locator('[data-action="checkzz"]')).toHaveCount(0);
    await expect(card.locator('[data-action="checkai"]')).toHaveCount(0);
    expect(writes(w)).toEqual([]);
  });

  test('with the web app address file present, ZZ_DELETE opens the guard page with only the ticked ids; Drive is not changed', async ({ page, context, guard }) => {
    const w = guard.world; fill(w);
    w.file('bg-url', BG.webAppFile, JSON.stringify({ url: URL_OK }), { parents: [BG.homeFolderId], driveId: 'drv-alpha1', mimeType: 'application/json' });
    const opened = [];
    await context.route(/^https:\/\/script\.google\.com\//, (route) => { opened.push(route.request().url()); return route.fulfill({ status: 200, contentType: 'text/html', body: '<title>stub</title>' }); });
    await page.goto('./#/bin');
    await signIn(page);
    const card = page.locator('#checkCard');
    await expect(card.locator('[data-check-nourl]')).toHaveCount(0);
    await card.locator('[data-action="selectall"][data-group="check"]').click();
    await expect(card.locator('[data-action="checkzz"]')).toContainText('Approve binning (2)');
    await expect(card.locator('li', { hasText: 'RR_sample-archive-note.txt' }).locator('input')).toHaveCount(0);
    await card.locator('[data-action="clearpick"][data-group="check"]').click();
    await expect(card.locator('[data-action="checkai"]')).toContainText('Ask the AI to sort: tick a file first');
    await card.locator('li', { hasText: 'back-from-bin-b.txt' }).locator('input').check();
    const btn = card.locator('[data-action="checkzz"]');
    await expect(btn).toBeEnabled();
    const popup = page.waitForEvent('popup');
    await btn.click();
    await (await popup).waitForLoadState();
    expect(opened.length).toBe(1);
    const u = new URL(opened[0]);
    expect(u.origin + u.pathname).toBe(URL_OK);
    expect(u.searchParams.get('action')).toBe('zzdelete');
    expect(u.searchParams.get('ids')).toBe('chk-b');
    await expect(page.locator('#logCard [data-check-sent]')).toContainText('1 item (Approve binning)');
    expect(writes(w)).toEqual([]);
    expect(w.byId('chk-b').trashed).toBeFalsy();
  });

  test('a web app address that is not a script.google.com /exec link is ignored', async ({ page, guard }) => {
    const w = guard.world; fill(w);
    w.file('bg-url', BG.webAppFile, JSON.stringify({ url: 'https://evil.example.test/exec' }), { parents: [BG.homeFolderId], driveId: 'drv-alpha1', mimeType: 'application/json' });
    await page.goto('./#/bin');
    await signIn(page);
    const card = page.locator('#checkCard');
    await expect(card.locator('[data-check-nourl]')).toBeVisible();
    await expect(card.locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(card.locator('[data-action="checkai"]')).toHaveCount(0);
  });
});
