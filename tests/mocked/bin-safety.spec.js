// Bin safety, against the pretend Drive only. Fake ids, never a real file.
// A row can be ticked and moved only when its name starts ZZ_DELETE_, its id is in the
// delete ledger (or a pending AA_DELETE-LEDGER-ROWS_ slip), and nothing about it is RR_.
// Select all and Move act only on rows that are both on screen and allowed.
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#mainNav')).toBeVisible();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const A = { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain' };
const ledger = (world, ids) => { world.byId(IDS.ledger).content = 'file_id\n' + ids.join('\n') + '\n'; };
const patched = (world) => world.calls.filter((c) => c.method === 'PATCH').map((c) => c.path.replace('/files/', '')).sort();

test.describe('Main dashboard: Bin never takes an RR_ archive with it', () => {
  test('the Bin page says why each protected item is left alone', async ({ page, guard }) => {
    const w = guard.world;
    w.folder('zz-fold-bad', 'ZZ_old-folder-with-archive', A);
    w.folder('zz-fold-bad-sub', 'inner', { parents: ['zz-fold-bad'], driveId: 'drv-alpha1' });
    w.file('rr-inside', 'RR_keep-me.txt', 'invented', { parents: ['zz-fold-bad-sub'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
    w.folder('rr-fold', 'RR_archive-folder', A);
    w.file('zz-in-rr', 'ZZ_DELETE_in-archive.txt', 'invented', { parents: ['rr-fold'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
    w.file('zz-rr-name', 'ZZ_DELETE_RR_notes.txt', 'invented', A);
    w.file('zz-held', 'ZZ_DELETE_needs-a-row.txt', 'invented', A);
    w.file('zz-sup', 'ZZ_SUPERSEDED_old.txt', 'invented', A);
    w.file('zz-mid', 'My ZZ_DELETE_ notes.txt', 'invented', A);
    ledger(w, ['zz-in-rr', 'zz-rr-name', 'zz-mid']);
    await page.goto('./#/bin');
    await signIn(page);
    const view = page.locator('#view');
    await expect(page.locator('#sweepCard h3')).toHaveText('Google Drive: ZZ_DELETE_ files ready to bin');
    await expect(view).toContainText('ZZ_SUPERSEDED_ is retired and is not a valid state');
    await expect(view).toContainText('ZZ_old-folder-with-archive');
    await expect(view).toContainText('Folder holds an RR_ item, left alone.');
    await expect(view).toContainText('ZZ_DELETE_in-archive.txt');
    await expect(view).toContainText('Inside an RR_ archive folder, left alone.');
    await expect(view.locator('[data-bin-list="leftout"]')).toContainText('ZZ_DELETE_RR_notes.txt');
    await expect(view).toContainText('Name contains RR_, left out.');
    await expect(view.locator('[data-bin-list="held"]')).toContainText('ZZ_DELETE_needs-a-row.txt');
    await expect(view).toContainText('No ledger row.');
    await expect(view.locator('[data-bin-list="rename"]')).toContainText('ZZ_SUPERSEDED_old.txt');
    await expect(view).toContainText('Rename needed');
    await expect(view).not.toContainText('My ZZ_DELETE_ notes.txt');
    for (const name of ['ZZ_old-folder-with-archive', 'ZZ_DELETE_in-archive.txt', 'ZZ_DELETE_RR_notes.txt', 'ZZ_DELETE_needs-a-row.txt', 'ZZ_SUPERSEDED_old.txt']) {
      await expect(view.locator('li', { hasText: name }).locator('input')).toBeDisabled();
    }
  });

  test('sweeping moves only a ticked ZZ_DELETE_ item that has a ledger row and no RR_ nearby', async ({ page, guard }) => {
    const w = guard.world;
    w.folder('zz-fold-bad', 'ZZ_DELETE_folder-with-archive', A);
    w.file('rr-inside', 'RR_keep-me.txt', 'invented', { parents: ['zz-fold-bad'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
    w.folder('zz-fold-ok', 'ZZ_DELETE_clean-folder', A);
    w.file('plain-inside', 'plain-note.txt', 'invented', { parents: ['zz-fold-ok'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
    w.folder('rr-fold', 'RR_archive-folder', A);
    w.file('zz-in-rr', 'ZZ_DELETE_in-archive.txt', 'invented', { parents: ['rr-fold'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
    w.file('zz-ready', 'ZZ_DELETE_ready.txt', 'invented', A);
    w.file('zz-other', 'ZZ_DELETE_other.txt', 'invented', A);
    ledger(w, ['zz-fold-ok', 'zz-fold-bad', 'zz-in-rr', 'zz-ready']);
    page.on('dialog', (d) => d.accept());
    await page.goto('./#/bin');
    await signIn(page);
    const view = page.locator('#view');
    await expect(view.locator('[data-bin-list="ready"]')).toContainText('ZZ_DELETE_ready.txt');
    await expect(view.locator('[data-bin-list="ready"]')).toContainText('ZZ_DELETE_clean-folder');
    await page.locator('li', { hasText: 'ZZ_DELETE_ready.txt' }).locator('input').check();
    await expect(page.locator('[data-action="sweep"]')).toContainText('Move selected (1)');
    await page.locator('[data-action="sweep"]').click();
    await page.locator('[data-action="sweep"]').click();
    await expect.poll(() => w.byId('zz-ready').trashed).toBe(true);
    for (const id of ['zz-fold-ok', 'zz-fold-bad', 'zz-other', 'zz-in-rr', 'zz-1', 'zz-2', 'rr-1', 'rr-inside', 'plain-inside']) {
      expect(w.byId(id).trashed, id + ' must not be binned').toBeFalsy();
    }
    expect(patched(w)).toEqual(['zz-ready']);
  });

  test('with nothing ticked, Select all and Clear only change the rows on screen', async ({ page, guard }) => {
    const w = guard.world;
    w.file('zz-a', 'ZZ_DELETE_alpha.txt', 'invented', A);
    w.file('zz-b', 'ZZ_DELETE_beta.txt', 'invented', A);
    w.file('zz-held', 'ZZ_DELETE_held.txt', 'invented', A);
    ledger(w, ['zz-a', 'zz-b']);
    await page.goto('./#/bin');
    await signIn(page);
    const sweep = page.locator('[data-action="sweep"]');
    await expect(sweep).toBeDisabled();
    await expect(sweep).toContainText('Move selected (0)');
    expect(patched(guard.world)).toEqual([]);
    await page.locator('[data-action="selectall"][data-group="bin"]').click();
    await expect(sweep).toContainText('Move selected (2)');
    await expect(page.locator('li', { hasText: 'ZZ_DELETE_held.txt' }).locator('input')).toBeDisabled();
    await expect(page.locator('li', { hasText: 'ZZ_DELETE_held.txt' }).locator('input')).not.toBeChecked();
    await page.locator('[data-action="clearpick"][data-group="bin"]').click();
    await expect(sweep).toContainText('Move selected (0)');
    await expect(sweep).toBeDisabled();
    expect(patched(guard.world)).toEqual([]);
  });

  test('if the delete ledger cannot be read, nothing is binned', async ({ page, guard }) => {
    const w = guard.world;
    w.file('zz-ready', 'ZZ_DELETE_ready.txt', 'invented', A);
    w.byId(IDS.ledger).content = 'not,a,ledger\n';
    await page.goto('./#/bin');
    await signIn(page);
    const view = page.locator('#view');
    await expect(view).toContainText('The delete ledger could not be read. Nothing will be binned.');
    await expect(page.locator('[data-action="sweep"]')).toBeDisabled();
    await expect(view.locator('li', { hasText: 'ZZ_DELETE_ready.txt' }).locator('input')).toBeDisabled();
    expect(w.byId('zz-ready').trashed).toBeFalsy();
  });

  test('a pending slip can allow one id, and a slip that cannot be read bins nothing', async ({ page, guard }) => {
    const w = guard.world;
    w.file('slip-1', 'ZZ_DELETE_from-slip.txt', 'invented', A);
    w.file('slip-rows', 'AA_DELETE-LEDGER-ROWS_extra.csv', 'file_id\nslip-1\n', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/csv' });
    await page.goto('./#/bin');
    await signIn(page);
    await expect(page.locator('[data-bin-list="ready"]')).toContainText('ZZ_DELETE_from-slip.txt');
    await page.locator('[data-action="selectall"][data-group="bin"]').click();
    await expect(page.locator('[data-action="sweep"]')).toContainText('Move selected (1)');
  });

  test('a slip with no file_id column bins nothing, even when the ledger itself is fine', async ({ page, guard }) => {
    const w = guard.world;
    w.file('zz-ready', 'ZZ_DELETE_ready.txt', 'invented', A);
    ledger(w, ['zz-ready']);
    w.file('bad-slip', 'AA_DELETE-LEDGER-ROWS_bad.csv', 'wrong_column\nzz-ready\n', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/csv' });
    await page.goto('./#/bin');
    await signIn(page);
    await expect(page.locator('#view')).toContainText('The delete ledger could not be read. Nothing will be binned.');
    await expect(page.locator('[data-action="sweep"]')).toBeDisabled();
    expect(w.byId('zz-ready').trashed).toBeFalsy();
  });

  test('Select all on a list of 52 with 50 shown moves only those 50 @regression', async ({ page, guard }) => {
    const w = guard.world;
    const ids = [];
    for (let i = 1; i <= 52; i++) {
      const id = 'cap-' + String(i).padStart(3, '0');
      ids.push(id);
      w.file(id, 'ZZ_DELETE_' + id + '.txt', 'invented', A);
    }
    ledger(w, ids);
    page.on('dialog', (d) => d.accept());
    await page.goto('./#/bin');
    await signIn(page);
    const ready = page.locator('[data-bin-list="ready"]');
    await expect(ready).toContainText('Showing 50 of 52');
    await expect(ready.locator('[data-action="showmore"]')).toBeVisible();
    await expect(ready.locator('[data-action="showall"]')).toBeVisible();
    await expect(ready.locator('li')).toHaveCount(50);
    await expect(ready).not.toContainText('ZZ_DELETE_cap-052.txt');
    await page.locator('[data-action="selectall"][data-group="bin"]').click();
    await expect(ready.locator('input:checked')).toHaveCount(50);
    await expect(page.locator('[data-action="sweep"]')).toContainText('Move selected (50)');
    await page.locator('[data-action="sweep"]').click();
    await page.locator('[data-action="sweep"]').click();
    await expect.poll(() => w.byId('cap-050').trashed).toBe(true);
    expect(w.byId('cap-051').trashed).toBeFalsy();
    expect(w.byId('cap-052').trashed).toBeFalsy();
    const moved = patched(w).filter((id) => id.indexOf('cap-') === 0);
    expect(moved).toHaveLength(50);
    expect(moved).not.toContain('cap-051');
    expect(moved).not.toContain('cap-052');
  });

  test('Show all then Select all can move every allowed row of the 52', async ({ page, guard }) => {
    const w = guard.world;
    const ids = [];
    for (let i = 1; i <= 52; i++) {
      const id = 'cap-' + String(i).padStart(3, '0');
      ids.push(id);
      w.file(id, 'ZZ_DELETE_' + id + '.txt', 'invented', A);
    }
    ledger(w, ids);
    page.on('dialog', (d) => d.accept());
    await page.goto('./#/bin');
    await signIn(page);
    const ready = page.locator('[data-bin-list="ready"]');
    await ready.locator('[data-action="showall"]').click();
    await expect(ready.locator('li')).toHaveCount(52);
    await expect(ready).toContainText('ZZ_DELETE_cap-052.txt');
    await expect(ready.locator('[data-action="showall"]')).toHaveCount(0);
    await page.locator('[data-action="selectall"][data-group="bin"]').click();
    await expect(ready.locator('input:checked')).toHaveCount(52);
    await expect(page.locator('[data-action="sweep"]')).toContainText('Move selected (52)');
    await page.locator('[data-action="sweep"]').click();
    await page.locator('[data-action="sweep"]').click();
    await expect.poll(() => w.byId('cap-052').trashed).toBe(true);
    expect(w.byId('cap-001').trashed).toBe(true);
    expect(patched(w).filter((id) => id.indexOf('cap-') === 0)).toHaveLength(52);
  });
});

test.describe('PC-Personal bin uses the same ledger gate', () => {
  test('only a ticked ZZ_DELETE_DRIVE_ file with a ledger row is binned, and RR_ stays put', async ({ page, guard }) => {
    const mine = { parents: ['my-root'], driveId: null, mimeType: 'application/pdf' };
    guard.world.file('me-ok', 'ZZ_DELETE_DRIVE_ok.pdf', 'x', mine);
    guard.world.file('me-held', 'ZZ_DELETE_DRIVE_held.pdf', 'x', mine);
    guard.world.file('me-rr', 'ZZ_DELETE_DRIVE_RR_copy.pdf', 'x', mine);
    ledger(guard.world, ['me-ok', 'me-rr']);
    page.on('dialog', (d) => d.accept());
    await page.goto('./#/personal');
    await signIn(page);
    const view = page.locator('#view');
    await expect(view).toContainText('ZZ_DELETE_DRIVE_ok.pdf');
    await expect(view).toContainText('No ledger row.');
    await expect(view).toContainText('Name contains RR_, left out.');
    await expect(view.locator('li', { hasText: 'ZZ_DELETE_DRIVE_held.pdf' }).locator('input')).toBeDisabled();
    await expect(view.locator('li', { hasText: 'ZZ_DELETE_DRIVE_RR_copy.pdf' }).locator('input')).toBeDisabled();
    await page.locator('[data-action="selectall"][data-group="pcpbin"]').click();
    await expect(page.locator('[data-action="pcpbin"]')).toContainText('Move selected (1)');
    await page.locator('[data-action="pcpbin"]').click();
    await page.locator('[data-action="pcpbin"]').click();
    await expect(view).toContainText('moved 1 to the bin');
    expect(guard.world.byId('me-ok').trashed).toBe(true);
    expect(guard.world.byId('me-held').trashed).toBeFalsy();
    expect(guard.world.byId('me-rr').trashed).toBeFalsy();
  });
});
