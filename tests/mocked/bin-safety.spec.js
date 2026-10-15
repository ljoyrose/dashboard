// Bin safety: the two rules that stop an archive (RR_) from being binned by accident.
//   1. A ZZ_ folder that holds an RR_ item anywhere inside is left alone (a folder goes to the bin WITH its contents).
//   2. A ZZ_ item sitting inside an RR_ folder is left alone.
// Only ZZ_ items with no RR_ anywhere near them are moved. All against the pretend Drive.
const { test, expect } = require('../support/test');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#mainNav')).toBeVisible();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const A = { driveId: 'drv-alpha1' };

test.describe('Main dashboard: Bin never takes an RR_ archive with it', () => {
  test.beforeEach(({ guard }) => {
    const w = guard.world;
    // 1. a ZZ_ folder with an RR_ file two levels down: must be left alone
    w.folder('zz-fold-bad', 'ZZ_old-folder-with-archive', { parents: ['drv-alpha1'], ...A });
    w.folder('zz-fold-bad-sub', 'inner', { parents: ['zz-fold-bad'], ...A });
    w.file('rr-inside', 'RR_keep-me.txt', 'invented', { parents: ['zz-fold-bad-sub'], ...A, mimeType: 'text/plain' });
    // 2. a ZZ_ folder with nothing precious inside: fine to move
    w.folder('zz-fold-ok', 'ZZ_clean-folder', { parents: ['drv-alpha1'], ...A });
    w.file('plain-inside', 'plain-note.txt', 'invented', { parents: ['zz-fold-ok'], ...A, mimeType: 'text/plain' });
    // 3. a ZZ_ file inside an RR_ folder: must be left alone
    w.folder('rr-fold', 'RR_archive-folder', { parents: ['drv-alpha1'], ...A });
    w.file('zz-in-rr', 'ZZ_in-archive.txt', 'invented', { parents: ['rr-fold'], ...A, mimeType: 'text/plain' });
  });

  test('the Bin page says why each protected item is left alone', async ({ page }) => {
    await page.goto('./#/bin');
    await signIn(page);
    const view = page.locator('#view');
    await expect(view).toContainText('ZZ_old-folder-with-archive');
    await expect(view).toContainText('Folder holds an RR_ item, left alone.');
    await expect(view).toContainText('ZZ_in-archive.txt');
    await expect(view).toContainText('Inside an RR_ archive folder, left alone.');
  });

  test('sweeping moves only the safe ZZ_ items; nothing near an RR_ item is touched', async ({ page, guard }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('./#/bin');
    await signIn(page);
    await page.locator('[data-action="sweep"]').click(); // first click asks for the extra (pretend) permission
    await expect.poll(() => page.evaluate(() => window.__GIS_CALLS.request)).toBeGreaterThan(1);
    await page.locator('[data-action="sweep"]').click();
    await expect.poll(() => guard.world.byId('zz-1').trashed).toBe(true);
    await expect.poll(() => guard.world.byId('zz-fold-ok').trashed).toBe(true);
    for (const id of ['zz-fold-bad', 'zz-fold-bad-sub', 'rr-inside', 'rr-fold', 'zz-in-rr', 'rr-1']) {
      expect(guard.world.byId(id).trashed, id + ' must not be binned').toBeFalsy();
    }
    const patched = guard.world.calls.filter((c) => c.method === 'PATCH').map((c) => c.path.replace('/files/', '')).sort();
    expect(patched).toEqual(['zz-1', 'zz-2', 'zz-fold-ok']);
  });
});
