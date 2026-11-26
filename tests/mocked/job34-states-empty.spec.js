const { test, expect, HUBS, buildWorld, go, SHEETS, fixture } = require('../fixtures/job34/load');
const H = fixture('states', 'hubs.json');
const FOLDER = 'application/vnd.google-apps.folder';

test.describe.configure({ timeout: 60_000 });
test.use({ world: async ({}, use) => { const w = buildWorld(); w.files = w.files.filter((f) => f.mimeType === FOLDER); await use(w); } });

for (const hub of Object.keys(HUBS)) {
  test(`${hub}: empty Drive and empty sheets show a friendly empty state on every view, no crash`, async ({ page, allowedConsole }) => {
    if (hub === 'home') allowedConsole.push(/Failed to load resource: the server responded with a status of 404/);
    await page.route(SHEETS, (r) => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(/:batchGet/.test(r.request().url()) ? { valueRanges: Array.from({ length: 8 }, () => ({})) } : {}) }));
    await page.goto(H[hub].url);
    await expect(page.locator(H[hub].signIn).first()).toBeEnabled();
    await page.locator(H[hub].signIn).first().click();
    await expect(page.locator('html')).not.toHaveClass(/dash-locked/);
    await expect(page.locator('body'), `${hub}: no friendly empty wording`).toContainText(new RegExp(H[hub].empty), { timeout: 15_000 });
    for (const v of HUBS[hub].views) {
      await go(page, v);
      const body = (await page.locator('body').innerText()).trim();
      expect(body.length, `${hub} #/${v} is blank when empty`).toBeGreaterThan(20);
      expect(body, `${hub} #/${v} prints a raw error`).not.toMatch(/undefined|NaN|\[object Object\]|TypeError/);
    }
  });
}

