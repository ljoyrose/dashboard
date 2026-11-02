// JOB 34 (group A): Drives pages: paging, empty and missing drives, the picker's way back, Drive check downloads.
// Pretend Google and Drive only. Every row and file is invented.
const { test, expect } = require('../fixtures/job34/load');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};

test.describe('Drives: shared drive pages', () => {
  test('a drive with more than 7 items pages: "Page 2 ›" opens page 2 and "‹ Page 1" comes back', async ({ page }) => {
    await page.goto('./#/drives/shared/drv-alpha1');
    await signIn(page);
    const view = page.locator('#view');
    await expect(view.locator('.pager .count')).toContainText(/^Page 1 of \d+ · \d+ items$/);
    const first = await view.locator('ul.files li .fname').first().textContent();
    await view.locator('.pager a', { hasText: 'Page 2 ›' }).click();
    await expect(page).toHaveURL(/#\/drives\/shared\/drv-alpha1\/p2$/);
    await expect(view.locator('.pager .count')).toContainText(/^Page 2 of/);
    await expect(view.locator('ul.files li .fname').first()).not.toHaveText(first);
    await expect(page.locator('#hereTitle')).toHaveText('Shared drives · Test Drive Alpha');
    await view.locator('.pager a', { hasText: '‹ Page 1' }).click();
    await expect(page).toHaveURL(/#\/drives\/shared\/drv-alpha1\/p1$/);
    await expect(view.locator('ul.files li .fname').first()).toHaveText(first);
  });

  test('a page number past the end shows the last page, not an empty list', async ({ page }) => {
    await page.goto('./#/drives/shared/drv-alpha1/p99');
    await signIn(page);
    await expect(page.locator('#view .pager .count')).toContainText(/^Page (\d+) of \1 ·/);
    await expect(page.locator('#view ul.files li').first()).toBeVisible();
  });

  test('a drive id that is not one of the shared drives says so instead of a blank page', async ({ page }) => {
    await page.goto('./#/drives/shared/drv-FAKE-missing');
    await signIn(page);
    await expect(page.locator('#view')).toContainText('Read failed: Folder not found or no access.');
    await expect(page.locator('#view .cardhead .state')).toHaveText('Read failed');
  });

  test('an empty folder says "Folder is empty." and Up one level returns to the drive', async ({ page, guard }) => {
    guard.world.folder('fld-SAMPLE-empty', 'Sample Empty Folder', { parents: ['drv-alpha1'], driveId: 'drv-alpha1' });
    await page.goto('./#/drives/shared/drv-alpha1/fld-SAMPLE-empty');
    await signIn(page);
    await expect(page.locator('#view')).toContainText('Folder is empty.');
    await expect(page.locator('#view .cardhead h3')).toHaveText('Sample Empty Folder');
    await page.locator('#view .crumbs a', { hasText: 'Up one level' }).click();
    await expect(page).toHaveURL(/#\/drives\/shared\/drv-alpha1$/);
  });

  test('the picker\'s "All shared drives · recent" goes back to the recent list', async ({ page }) => {
    await page.goto('./#/drives/shared/drv-bravo2');
    await signIn(page);
    await expect(page.locator('#hereTitle')).toHaveText('Shared drives · Test Drive Bravo');
    await page.locator('#drivePicker').selectOption({ label: 'All shared drives · recent' });
    await expect(page).toHaveURL(/#\/drives\/shared$/);
    await expect(page.locator('#view h3', { hasText: 'Recent in shared drives' })).toBeVisible();
    await expect(page.locator('#view .stat', { hasText: 'Shared drives' }).locator('.num')).toHaveText('3');
  });

  test('an account with no shared drives: Drives and Bin say so in plain words', async ({ page, guard }) => {
    guard.world.drives = [];
    await page.goto('./#/drives/shared');
    await signIn(page);
    await expect(page.locator('#view')).toContainText('No shared drives found for this account.');
    await page.locator('#mainNav a[data-nav="bin"]').click();
    await expect(page.locator('#binCard')).toContainText('No shared drives found for this account.');
  });
});

test.describe('Drives: Drive check download lists', () => {
  test('both download buttons stay off before a check; after it, "only on this drive" saves a CSV of those files', async ({ page }) => {
    await page.addInitScript(() => {
      const text = 'z'.repeat(2500);
      const file = { kind: 'file', name: 'sample-only-here.bin', getFile: async () => new File([text], 'sample-only-here.bin', { lastModified: 1700000000000 }), move: async () => {} };
      const root = { kind: 'directory', name: 'PRETEND-STICK-SAMPLE', entries: async function* () { yield ['sample-only-here.bin', file]; } };
      window.showDirectoryPicker = async () => root;
    });
    await page.goto('./#/drives/usb');
    await signIn(page);
    const only = page.locator('[data-action="usbcsv"][data-which="only"]');
    const match = page.locator('[data-action="usbcsv"][data-which="match"]');
    await expect(only).toBeDisabled();
    await expect(match).toBeDisabled();
    await page.locator('[data-action="usbscan"]').click();
    await expect(page.locator('#view')).toContainText(/Finished/);
    await expect(match).toBeDisabled();
    await expect(only).toBeEnabled();
    const [dl] = await Promise.all([page.waitForEvent('download'), only.click()]);
    expect(dl.suggestedFilename()).toBe('only-on-this-drive.csv');
    const body = require('fs').readFileSync(await dl.path(), 'utf8');
    expect(body).toBe('path,size\n"sample-only-here.bin",2500\n');
  });
});
