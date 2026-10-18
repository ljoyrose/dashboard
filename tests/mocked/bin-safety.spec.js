// Bin safety, against the pretend Drive only. Fake ids, never a real file.
// A row can be ticked and moved only when its name starts ZZ_DELETE_, its id is in the
// delete ledger (or a pending AA_DELETE-LEDGER-ROWS_ slip), and nothing about it is RR_.
// Select all and Move act only on rows that are both on screen and allowed.
// E02 money rollback files are held even when ticked, visible, or on a ledger row.
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

  test('an RR_ item deep inside a ZZ_DELETE_ folder keeps the whole folder out of the bin, even with Select all @regression', async ({ page, guard }) => {
    const w = guard.world;
    w.folder('zzd-outer', 'ZZ_DELETE_outer-folder', A);
    w.folder('zzd-mid', 'middle', { parents: ['zzd-outer'], driveId: 'drv-alpha1' });
    w.folder('zzd-deep', 'deeper', { parents: ['zzd-mid'], driveId: 'drv-alpha1' });
    w.file('rr-deep', 'RR_keep-forever.txt', 'invented', { parents: ['zzd-deep'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
    w.folder('zzd-outer2', 'ZZ_DELETE_second-folder', A);
    w.file('rr-mid-name', 'notes RR_v2.txt', 'invented', { parents: ['zzd-outer2'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
    w.file('zz-ok', 'ZZ_DELETE_fine.txt', 'invented', A);
    ledger(w, ['zzd-outer', 'zzd-outer2', 'zz-ok']);
    page.on('dialog', (d) => d.accept());
    await page.goto('./#/bin');
    await signIn(page);
    const view = page.locator('#view');
    for (const name of ['ZZ_DELETE_outer-folder', 'ZZ_DELETE_second-folder']) {
      const row = view.locator('li', { hasText: name });
      await expect(row).toContainText('Folder holds an RR_ item, left alone.');
      await expect(row.locator('input')).toBeDisabled();
    }
    await expect(view.locator('[data-bin-list="ready"]')).not.toContainText('ZZ_DELETE_outer-folder');
    await page.locator('[data-action="selectall"][data-group="bin"]').click();
    await expect(page.locator('[data-action="sweep"]')).toContainText('Move selected (1)');
    await page.locator('[data-action="sweep"]').click();
    await page.locator('[data-action="sweep"]').click();
    await expect.poll(() => w.byId('zz-ok').trashed).toBe(true);
    expect(patched(w)).toEqual(['zz-ok']);
    for (const id of ['zzd-outer', 'zzd-outer2', 'rr-deep', 'rr-mid-name']) expect(w.byId(id).trashed, id).toBeFalsy();
  });

  test('a ZZ_DELETE_ item anywhere below an RR_ folder is left alone, even with a ledger row @regression', async ({ page, guard }) => {
    const w = guard.world;
    w.folder('rr-top', 'RR_top-archive', A);
    w.folder('rr-top-sub', 'plain-sub', { parents: ['rr-top'], driveId: 'drv-alpha1' });
    w.file('zz-two-down', 'ZZ_DELETE_two-levels-down.txt', 'invented', { parents: ['rr-top-sub'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
    w.folder('rr-midname', 'Old RR_photos', A);
    w.folder('zz-fold-in-rr', 'ZZ_DELETE_folder-in-archive', { parents: ['rr-midname'], driveId: 'drv-alpha1' });
    w.file('zz-ok', 'ZZ_DELETE_fine.txt', 'invented', A);
    ledger(w, ['zz-two-down', 'zz-fold-in-rr', 'zz-ok']);
    page.on('dialog', (d) => d.accept());
    await page.goto('./#/bin');
    await signIn(page);
    const view = page.locator('#view');
    for (const name of ['ZZ_DELETE_two-levels-down.txt', 'ZZ_DELETE_folder-in-archive']) {
      const row = view.locator('li', { hasText: name });
      await expect(row).toContainText('Inside an RR_ archive folder, left alone.');
      await expect(row.locator('input')).toBeDisabled();
    }
    await page.locator('li', { hasText: 'ZZ_DELETE_fine.txt' }).locator('input').check();
    await page.locator('[data-action="sweep"]').click();
    await page.locator('[data-action="sweep"]').click();
    await expect.poll(() => w.byId('zz-ok').trashed).toBe(true);
    expect(patched(w)).toEqual(['zz-ok']);
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

  test('a ledger that starts with a COUNT note line above the header is still read @regression', async ({ page, guard }) => {
    const w = guard.world;
    w.file('zz-ready', 'ZZ_DELETE_ready.txt', 'invented', A);
    w.byId(IDS.ledger).content = '"COUNT: 1 rows. 2026-10-18-1228 sample note, with a comma"\ndate,old_name,file_id,merged_into,agent\n2026-10-18-1200,ready.txt,zz-ready,,sample\n';
    await page.goto('./#/bin');
    await signIn(page);
    await expect(page.locator('[data-bin-list="ready"]')).toContainText('ZZ_DELETE_ready.txt');
    await expect(page.locator('#view')).not.toContainText('The delete ledger could not be read');
  });

  test('a ledger whose first lines are not a note plus a file_id header still bins nothing', async ({ page, guard }) => {
    const w = guard.world;
    w.file('zz-ready', 'ZZ_DELETE_ready.txt', 'invented', A);
    w.byId(IDS.ledger).content = 'some other note\nsecond note\nfile_id\nzz-ready\n';
    await page.goto('./#/bin');
    await signIn(page);
    await expect(page.locator('#view')).toContainText('The delete ledger could not be read. Nothing will be binned.');
    await expect(page.locator('[data-action="sweep"]')).toBeDisabled();
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

  test('money rollback files (E02) are held by folder id, and a same-named folder is still binned', async ({ page, guard }) => {
    const w = guard.world;
    const LABEL = 'Held: money rollback (E02), do not touch until FIX 6 is confirmed';
    // The other folder that is also titled "4 - Ops". This id is not excluded.
    const OTHER_OPS = '1M7sJssW6ZGsNk2IbDLAffmYD6sSOEloz';
    const ops = { parents: [IDS.moneyFolders.ops], driveId: IDS.moneyDrive, mimeType: 'text/plain' };
    const index = { parents: [IDS.moneyFolders.index], driveId: IDS.moneyDrive, mimeType: 'text/plain' };
    w.file('e02-sup', 'ZZ_SUPERSEDED_2026-01_DO-NOT-USE__MON-REGISTER.csv', 'invented', A);
    w.file('e02-log', 'ZZ_SUPERSEDED_oldCHECK-LOG.csv', 'invented', A);
    w.file('e02-ops', 'MON-ENGINE-ops-hold.csv', 'invented', ops);
    w.file('e02-index-file', 'MON-ENGINE-index-hold.csv', 'invented', index);
    w.file('e02-ledger', 'ZZ_DELETE_MON-ENGINE-ledger.txt', 'invented', ops);
    w.folder(OTHER_OPS, '4 - Ops', A);
    w.file('zz-other-ops', 'ZZ_DELETE_other-ops.txt', 'invented', { parents: [OTHER_OPS], driveId: 'drv-alpha1', mimeType: 'text/plain' });
    w.folder('fake-index', '0.1 - Index', A);
    w.file('zz-fake-index', 'ZZ_DELETE_fake-index.txt', 'invented', { parents: ['fake-index'], driveId: 'drv-alpha1', mimeType: 'text/plain' });
    w.file('zz-ok', 'ZZ_DELETE_ordinary.txt', 'invented', A);
    ledger(w, ['e02-sup', 'e02-log', 'e02-ops', 'e02-index-file', 'e02-ledger', 'zz-other-ops', 'zz-fake-index', 'zz-ok']);
    page.on('dialog', (d) => d.accept());
    await page.goto('./#/bin');
    await signIn(page);
    const view = page.locator('#view');
    const held = view.locator('[data-bin-list="e02"]');
    const ready = view.locator('[data-bin-list="ready"]');
    await expect(held).toContainText(LABEL);
    for (const name of [
      'ZZ_SUPERSEDED_2026-01_DO-NOT-USE__MON-REGISTER.csv',
      'ZZ_SUPERSEDED_oldCHECK-LOG.csv',
      'MON-ENGINE-ops-hold.csv',
      'MON-ENGINE-index-hold.csv',
      'ZZ_DELETE_MON-ENGINE-ledger.txt',
    ]) {
      const row = held.locator('li', { hasText: name });
      await expect(row).toContainText(LABEL);
      await expect(row.locator('input')).toBeDisabled();
    }
    await expect(held.getByText('CHECK-LOG.csv', { exact: true })).toBeVisible();
    await expect(held).not.toContainText('ZZ_DELETE_other-ops.txt');
    await expect(held).not.toContainText('ZZ_DELETE_fake-index.txt');
    await expect(view.locator('[data-bin-list="rename"]')).not.toContainText('ZZ_SUPERSEDED_2026-01_DO-NOT-USE__MON-REGISTER.csv');
    await expect(view.locator('[data-bin-list="rename"]')).not.toContainText('ZZ_SUPERSEDED_oldCHECK-LOG.csv');
    for (const name of ['ZZ_DELETE_ordinary.txt', 'ZZ_DELETE_other-ops.txt', 'ZZ_DELETE_fake-index.txt']) {
      await expect(ready).toContainText(name);
    }
    await expect(ready).not.toContainText('ZZ_DELETE_MON-ENGINE-ledger.txt');
    await page.locator('[data-action="selectall"][data-group="bin"]').click();
    await expect(page.locator('[data-action="sweep"]')).toContainText('Move selected (3)');
    for (const name of ['MON-ENGINE-ops-hold.csv', 'MON-ENGINE-index-hold.csv', 'ZZ_DELETE_MON-ENGINE-ledger.txt']) {
      await expect(held.locator('li', { hasText: name }).locator('input')).not.toBeChecked();
    }
    await page.locator('[data-action="sweep"]').click();
    await page.locator('[data-action="sweep"]').click();
    await expect.poll(() => w.byId('zz-ok').trashed).toBe(true);
    expect(w.byId('zz-other-ops').trashed).toBe(true);
    expect(w.byId('zz-fake-index').trashed).toBe(true);
    for (const id of ['e02-sup', 'e02-log', 'e02-ops', 'e02-index-file', 'e02-ledger']) {
      expect(w.byId(id).trashed, id + ' must stay put').toBeFalsy();
    }
    const moved = patched(w);
    for (const id of ['zz-ok', 'zz-other-ops', 'zz-fake-index']) expect(moved).toContain(id);
    for (const id of ['e02-sup', 'e02-log', 'e02-ops', 'e02-index-file', 'e02-ledger']) {
      expect(moved, id + ' must not be trashed').not.toContain(id);
    }
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
