// Studio › Tools › Owned tools (30 Oct 2026): the list of tools Lisa owns, read from the Owned Tools tab of her Drive sheet.
// Read only after Google sign-in; no tool data is written in the repo. Pretend Google only; the rows are the invented
// sample in tests/fixtures/owned-tools.json (answered by tests/support/test.js).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, expect } = require('../support/test');

const ROOT = path.resolve(__dirname, '..', '..');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8'), ctx);
const OT = ctx.window.DASH_CONFIG.studio.ownedTools;
const SAMPLE = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'owned-tools.json'), 'utf8')).values;
const SHEETS = /^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\//;

async function signIn(page, hash) {
  await page.goto('studio/' + hash);
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#enginePill')).toBeVisible();
}

test('config.js names the sheet and the OWNED_TOOLS tab for the Owned tools list', () => {
  expect(OT && OT.sheetId).toBeTruthy();
  expect(OT.tab).toBe('OWNED_TOOLS');
});

test('signed out: the Tools page shows only the sign-in card and never reads the sheet', async ({ page, guard }) => {
  await page.goto('studio/#/tools');
  await expect(page.locator('#view [data-action="signin"]')).toBeVisible();
  await page.waitForTimeout(400);
  await expect(page.locator('[data-owned]')).toHaveCount(0);
  expect(guard.ownedCalls).toEqual([]);
});

test('signed in: Tools reads the Owned Tools tab once, with the sign-in token, and shows each tool with tier, rights, use and verdict', async ({ page, guard }) => {
  await signIn(page, '#/tools');
  const card = page.locator('[data-owned="ok"]');
  await expect(card).toBeVisible();
  expect(guard.ownedCalls.length).toBe(1);
  expect(guard.ownedCalls[0].auth).toBe(true);
  expect(decodeURIComponent(guard.ownedCalls[0].url)).toContain('/values/OWNED_TOOLS!A1:E');
  const rows = card.locator('[data-ownedtool]');
  await expect(rows).toHaveCount(SAMPLE.length - 1);
  const first = card.locator('[data-ownedtool="Example Writer"]');
  await expect(first).toContainText('Drafts blog posts');
  await expect(first.locator('[data-tier]')).toHaveText('Tier 2 · 2 codes (2 redeemed)');
  await expect(first.locator('[data-agency]')).toHaveText('Yes - agency use allowed');
  await expect(first.locator('[data-verdict]')).toHaveText('KEEP');
  // The Tools search finds owned tools too.
  await page.locator('input[data-lq="tools"]').fill('snapper');
  await expect(card.locator('[data-ownedtool]')).toHaveCount(1);
  await expect(card.locator('[data-ownedtool="Sample Snapper"]')).toBeVisible();
  // Another page and back: no second read until Refresh.
  await page.evaluate(() => { location.hash = '#/me'; });
  await page.evaluate(() => { location.hash = '#/tools'; });
  await expect(page.locator('[data-owned="ok"]')).toBeVisible();
  expect(guard.ownedCalls.length).toBe(1);
});

test('signed in, then signed out: the owned tools disappear and nothing is read again', async ({ page, guard }) => {
  await signIn(page, '#/tools');
  await expect(page.locator('[data-ownedtool]').first()).toBeVisible();
  await page.evaluate(() => document.getElementById('signOutBtn').click());
  await expect(page.locator('#view [data-action="signin"]')).toBeVisible();
  await expect(page.locator('[data-ownedtool]')).toHaveCount(0);
  const n = guard.ownedCalls.length;
  await page.waitForTimeout(300);
  expect(guard.ownedCalls.length).toBe(n);
});

test('the rows come from the sheet only: an empty tab shows an empty list', async ({ page }) => {
  await page.route(SHEETS, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: [SAMPLE[0]] }) }));
  await signIn(page, '#/tools');
  await expect(page.locator('[data-owned="ok"]')).toBeVisible();
  await expect(page.locator('[data-ownedtool]')).toHaveCount(0);
  await expect(page.locator('[data-owned="ok"]')).toContainText('No match.');
});

test('a sheet that cannot be opened says so calmly and the rest of Tools still works', async ({ page, allowedConsole }) => {
  allowedConsole.push(/status of 403/);
  await page.route(SHEETS, (route) => route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":{"code":403}}' }));
  await signIn(page, '#/tools');
  await expect(page.locator('[data-owned="err"]')).toContainText('Could not read the Owned Tools tab: No access');
  await expect(page.locator('[data-gaps]')).toBeVisible();
});

test('public repo: no tool data is hard-coded and the sheet id lives only in config.js', () => {
  const SKIP = /(^|\/)(\.git|node_modules|test-results|playwright-report)(\/|$)/;
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name), rel = path.relative(ROOT, p);
    if (SKIP.test(rel)) return [];
    return e.isDirectory() ? walk(p) : [rel];
  });
  const files = walk(ROOT).filter((f) => /\.(html|js|md|csv|json|yml|yaml|txt)$/.test(f) && f !== 'package-lock.json');
  expect(files.filter((f) => f !== 'config.js' && fs.readFileSync(path.join(ROOT, f), 'utf8').includes(OT.sheetId)), 'sheet id outside config.js').toEqual([]);
  const page = fs.readFileSync(path.join(ROOT, 'studio', 'index.html'), 'utf8');
  // The page reads the id from config and builds rows only from the Sheets answer.
  expect(page).toMatch(/ST\.ownedTools/);
  expect(page).toMatch(/OT\.rows = v\.slice\(1\)/);
  // No sample tool, tier or code text written into the page.
  for (const r of SAMPLE.slice(1)) for (const cell of r.slice(0, 4).filter((c) => c.length > 8)) expect(page, 'page holds owned-tool text: ' + cell).not.toContain(cell);
  expect(page, 'no code counts written into the page').not.toMatch(/\d+ codes? \(/);
  // The read sits behind the sign-in check.
  const fn = page.slice(page.indexOf('function loadOwned()'), page.indexOf('function ownedCard()'));
  expect(fn).toMatch(/if \(!signedIn \|\| !accessToken[^)]*\) return;/);
  expect(fn.indexOf('signedIn')).toBeLessThan(fn.indexOf('sheets.googleapis.com'));
});
