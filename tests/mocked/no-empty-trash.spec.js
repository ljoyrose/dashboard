// Hard rule: trash only, never empty the bin.
// Moving a file into the bin is allowed. Permanently deleting a shared-drive bin is not.
// That old action was a DELETE to Drive's /trash endpoint (files.emptyTrash).
const { test, expect } = require('../support/test');
const { test: fileTest } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// Words that must not come back in a page. Matched exactly, so "an empty bin"
// (a bin with nothing in it) and the Dropbox "open Deleted files" link are left alone.
const PHRASES = ['emptyTrash', 'Empty bin'];

function pageSources() {
  const out = fs.readdirSync(ROOT).filter((name) => name.endsWith('.html'));
  for (const dir of ['cdhub', 'money']) {
    const abs = path.join(ROOT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const child of fs.readdirSync(abs)) {
      if (/\.(html|js)$/.test(child)) out.push(path.posix.join(dir, child));
    }
  }
  return out.sort();
}

// The removed call looked like: apiCall('DELETE', API + '/trash?driveId=' + ...)
function deleteTrashSnippets(text) {
  return text.match(/DELETE[\s\S]{0,180}\/trash\b|\/trash\b[\s\S]{0,180}DELETE/g) || [];
}

function sourceHits(text) {
  const hits = PHRASES.filter((phrase) => text.includes(phrase));
  if (deleteTrashSnippets(text).length) hits.push('DELETE /trash');
  return hits;
}

function isTrashDelete(method, urlOrPath) {
  if (method !== 'DELETE') return false;
  let pathname = urlOrPath;
  try { pathname = new URL(urlOrPath).pathname; } catch (e) { /* already a path */ }
  return /\/trash\/?$/.test(pathname);
}

fileTest('source files have no empty-bin wording and no DELETE to a /trash endpoint', () => {
  const files = pageSources();
  expect(files).toEqual(['cdhub/index.html', 'index.html', 'money/core.js', 'money/index.html']);
  const bad = [];
  for (const file of files) {
    const hits = sourceHits(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    if (hits.length) bad.push(`${file}: ${hits.join(', ')}`);
  }
  expect(bad).toEqual([]);
});

test('every page loads with no DELETE to a /trash endpoint, and its source has no emptyTrash or Empty bin', async ({ page, guard }) => {
  test.setTimeout(90_000);
  const deletes = [];
  page.on('request', (req) => {
    if (isTrashDelete(req.method(), req.url())) deletes.push(req.method() + ' ' + req.url());
  });

  async function assertClean(label, served) {
    const hits = sourceHits(served == null ? await page.content() : served);
    expect(hits, label).toEqual([]);
    expect(deletes, label).toEqual([]);
    const fromDrive = guard.world.calls.filter((c) => isTrashDelete(c.method, c.path));
    expect(fromDrive, label).toEqual([]);
  }

  async function open(url, label) {
    const res = await page.goto(url);
    expect(res.status(), label).toBeLessThan(400);
    await assertClean(label, await res.text());
    await assertClean(label + ' (rendered)');
  }

  // Main dashboard. Sections stay on this page, so they are opened without a reload.
  await open('./', 'Main dashboard');
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
  const mainSections = ['#/map', '#/readfirst', '#/drive', '#/drive/drv-alpha1', '#/personal', '#/usb', '#/bin', '#/changes', '#/changes/24h', '#/changes/7d', '#/changes/totals'];
  for (const hash of mainSections) {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await expect(page.locator('#view')).toHaveAttribute('data-route', hash);
    await assertClean('Main dashboard ' + hash);
  }
  // The bin list is where the old button lived. Open one shared drive's bin.
  await page.evaluate(() => { location.hash = '#/bin'; });
  const binJump = page.locator('[data-action="foldjump"][data-key="bin-drv-alpha1"]');
  await expect(binJump).toBeVisible();
  await binJump.click();
  await expect(page.locator('[data-fold="bin-drv-alpha1"]')).toHaveJSProperty('open', true);
  await assertClean('Main dashboard bin list');

  // CD Hub, all ten sections. The home-page sign-in is already valid here.
  await open('cdhub/', 'CD Hub');
  const cdSignIn = page.locator('#signinbtn');
  if (await cdSignIn.count()) {
    await expect(cdSignIn).toBeEnabled();
    await cdSignIn.click();
  }
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  for (const id of ['map', 'work', 'shape', 'today', 'round', 'dogs', 'areas', 'litters', 'vet', 'buyers']) {
    await page.locator(`#nav button[data-go="${id}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#/${id}$`));
    await assertClean('CD Hub ' + id);
  }

  // Money Hub, all six sections, plus an entity page and a to-do page.
  // The same sign-in is still valid, so the button is not shown again.
  await open('money/', 'Money Hub');
  const moneySignIn = page.locator('#signInBtn');
  if (await moneySignIn.isVisible()) {
    await expect(moneySignIn).toBeEnabled();
    await moneySignIn.click();
  }
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
  for (const hash of ['#/now', '#/money', '#/dates', '#/todo', '#/todo/others', '#/accountant', '#/control', '#/e/TESTCO', '#/register/R001']) {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await expect(page.locator('#view')).toBeVisible();
    await assertClean('Money Hub ' + hash);
  }

  // Shared money code, loaded by the dashboard tile and by Money Hub.
  const core = await page.goto('money/core.js');
  expect(core.status()).toBe(200);
  await assertClean('money/core.js', await core.text());
  expect(deletes).toEqual([]);
});
