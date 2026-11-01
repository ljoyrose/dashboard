// JOB 34 (group A): home page views, states and keyboard paths no other spec checks.
// Pretend Google and Drive only. Every row is invented.
const { test, expect, sideScroll } = require('../fixtures/job34/load');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const OLD = '2025-01-01T09:00:00.000Z';

test.describe('Home: views and states', () => {
  test('slow Drive: the header says "Reading…" and Needs you shows "…" until the reads land', async ({ page }) => {
    let release;
    const held = new Promise((r) => { release = r; });
    await page.route(/^https:\/\/www\.googleapis\.com\/drive\/v3\/drives/, async (route) => { await held; return route.fallback(); });
    await page.goto('./');
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toHaveText('Reading…');
    await expect(page.locator('#homeTop .needsline')).toHaveText('Needs you: …');
    release();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await expect(page.locator('#homeTop .needsline')).not.toContainText('…');
  });

  test('the browser tab title names every view', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const want = [['bin', 'Bin'], ['changes', 'Changes'], ['drives', 'Drives'], ['drives/shared', 'Shared drives'], ['drives/readfirst', 'Read first'],
      ['drives/work', 'Work My Drive'], ['drives/personal-drive', 'Personal Drive'], ['drives/usb', 'Drive check'], ['map', 'Dashboard']];
    for (const [h, name] of want) {
      await page.evaluate((x) => { location.hash = '#/' + x; }, h);
      await expect(page).toHaveTitle(new RegExp('^(\\(\\d+\\) )?' + name + ' · Lisa Dashboard$'));
    }
  });

  test('tapping the tab you are already on draws it again and goes back to the top', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await page.goto('./#/bin');
    await signIn(page);
    await expect(page.locator('#sweepCard')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 400));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.locator('#mainNav a[data-nav="bin"]').click();
    await expect(page).toHaveURL(/#\/bin$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(page.locator('#hereTitle')).toHaveText('Bin');
  });

  test('keyboard: Tab reaches every bottom tab and the header buttons, and Enter opens a tab', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    const reached = new Set();
    for (let i = 0; i < 120 && reached.size < 6; i++) {
      await page.keyboard.press('Tab');
      const k = await page.evaluate(() => { const a = document.activeElement; return a ? (a.getAttribute('data-nav') || a.id || '') : ''; });
      if (['map', 'drives', 'bin', 'changes', 'refreshBtn', 'signOutBtn'].includes(k)) reached.add(k);
    }
    expect([...reached].sort()).toEqual(['bin', 'changes', 'drives', 'map', 'refreshBtn', 'signOutBtn']);
    await page.locator('#mainNav a[data-nav="changes"]').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/changes/);
    await expect(page.locator('#hereTitle')).toHaveText('Changes · Recent');
    await expect(page.locator('#hereTitle')).toBeFocused();
  });

  test('Changes with nothing recent: Last 24h and Last 7 days say so in plain words', async ({ page, guard }) => {
    for (const id of ['cf-f1', 'cf-f2']) guard.world.byId(id).modifiedTime = OLD;
    await page.goto('./#/changes/24h');
    await signIn(page);
    await expect(page.locator('#view')).toContainText('No changes in last 24h.');
    await expect(page.locator('#view .state')).toHaveText('Empty');
    await page.locator('#view .subnav a', { hasText: 'Last 7 days' }).click();
    await expect(page.locator('#view')).toContainText('No changes in last 7 days.');
    await page.locator('#view .subnav a', { hasText: 'Recent' }).click();
    await expect(page.locator('#view')).toContainText('cf-notes-recent.txt');
  });

  test('Changes Totals counts the sample Cf folder: files, folders, levels', async ({ page }) => {
    await page.goto('./#/changes/totals');
    await signIn(page);
    const stat = (label) => page.locator('#view .stat', { hasText: label }).locator('.num');
    await expect(stat('Files')).toHaveText('2');
    await expect(stat('Folders')).toHaveText(/^[12]$/);
    await expect(stat('Drive requests')).toHaveText(/^\d+$/);
  });

  test('Read first with an empty folder says "Folder is empty." and marks the card Empty', async ({ page, guard }) => {
    guard.world.files = guard.world.files.filter((f) => !['rf-1', 'rf-2'].includes(f.id));
    await page.goto('./#/drives/readfirst');
    await signIn(page);
    await expect(page.locator('#view')).toContainText('Folder is empty.');
    await expect(page.locator('#view')).toContainText('0 items in folder.');
    await expect(page.locator('#view .cardhead .state')).toHaveText('Empty');
  });

  test('Drive reads refused: the header says "A read failed" and Refresh tries again and recovers', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/Failed to load resource: the server responded with a status of 403/);
    await page.goto('./');
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal' };
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toHaveText('A read failed');
    guard.world.failWith = null;
    await page.locator('#refreshBtn').click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
  });
});

test.describe('Home: phone 390px on the Drives sub-pages', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('no sideways scroll on Shared drives (and one drive), Read first, Work My Drive, Personal Drive, Drive check and Totals', async ({ page }) => {
    await page.goto('./');
    await signIn(page);
    for (const h of ['drives/shared', 'drives/shared/drv-alpha1', 'drives/shared/drv-alpha1/p2', 'drives/readfirst', 'drives/work', 'drives/personal-drive', 'drives/usb', 'changes/totals', 'changes/7d']) {
      await page.evaluate((x) => { location.hash = '#/' + x; }, h);
      await expect(page.locator('#view')).toHaveAttribute('data-route', '#/' + h);
      await page.waitForTimeout(100);
      expect(await sideScroll(page), h + ' scrolls sideways at 390px').toBe(false);
    }
  });
});
