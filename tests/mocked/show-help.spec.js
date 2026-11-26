// Show help (the owner 18 Nov 2026, demo de-clutter): help and explanation lines are hidden, not deleted, until the person turns on
// Show help. Off by default. The hub's switch is in the Look menu; the staff page's is on This phone. One class on the page.
const { test, expect } = require('../support/test');
const HUB = require('../fixtures/job34/load');

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
async function staff(page) {
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: [], tables: {} } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-CODE-1', SCRIPT]);
}

test('staff page: help lines are hidden by default, Show help brings them back and is kept on this phone', async ({ page }) => {
  await staff(page);
  await page.goto('cdhub/staff/#device');
  const line = page.locator('p.help').first();
  await expect(line).toHaveCount(1);                 // still on the page: hidden, not deleted
  await expect(line).toBeHidden();
  const sw = page.getByRole('switch', { name: 'Show help' });
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(line).toBeVisible();
  await page.reload();
  await expect(page.locator('p.help').first()).toBeVisible();
  await page.getByRole('switch', { name: 'Show help' }).click();
  await expect(page.locator('p.help').first()).toBeHidden();
});
