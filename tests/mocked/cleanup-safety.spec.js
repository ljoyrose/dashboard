// Extra safety for the clean-up tools: kept-copy proof, folder contents, zero-byte,
// odd prefixes, re-check before bin, resume, shortcuts, and sign-in expiry.
// Every write stays inside the pretend Drive or the pretend plugged-in drive.
const crypto = require('crypto');
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');

const PCP = 'ZZ_DELETE_DRIVE_';
const USB = 'ZZ_DELETE_LOCAL_';
const A = { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain' };
const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const ledger = (world, ids) => { world.byId(IDS.ledger).content = 'file_id\n' + ids.join('\n') + '\n'; };
const writes = (world) => world.calls.filter((c) => c.method !== 'GET');
const patched = (world) => world.calls.filter((c) => c.method === 'PATCH').map((c) => c.path.replace('/files/', '')).sort();
const askForWriteThen = async (page, action) => {
  await page.locator(`[data-action="${action}"]`).click();
  await expect.poll(() => page.evaluate(() => window.__GIS_CALLS.request)).toBeGreaterThan(1);
};
const notMine = (world, id) => { world.byId(id).mine = false; };

test('a shared copy counts only when it is a live kept file', async ({ page, guard }) => {
  const w = guard.world;
  const mine = { parents: ['my-root'], driveId: null, mimeType: 'application/pdf' };
  const shared = { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'application/pdf' };
  const pair = (sid, sname, mid, mname, md5, size, extra) => {
    w.file(sid, sname, 'x', Object.assign({ md5Checksum: md5, size: size }, extra || shared));
    notMine(w, sid);
    w.file(mid, mname, 'x', Object.assign({ md5Checksum: md5, size: size }, mine));
  };
  pair('sh-real', 'kept.pdf', 'me-real', 'kept.pdf', 'md5-real', 111);
  pair('sh-zz', 'ZZ_kept.pdf', 'me-zz', 'not-kept-zz.pdf', 'md5-zz', 112);
  pair('sh-sp', 'zz kept.pdf', 'me-sp', 'not-kept-space.pdf', 'md5-sp', 113);
  pair('sh-hy', 'ZZ-kept.pdf', 'me-hy', 'not-kept-hyphen.pdf', 'md5-hy', 114);
  w.folder('zz-hold', 'ZZ_holding', A);
  pair('sh-in', 'inside-zz.pdf', 'me-in', 'not-kept-inside.pdf', 'md5-in', 115, { parents: ['zz-hold'], driveId: 'drv-alpha1', mimeType: 'application/pdf' });
  w.folder('aa-hold', 'AA_HOLD_box', A);
  pair('sh-aa', 'inside-hold.pdf', 'me-aa', 'not-kept-hold.pdf', 'md5-aa', 116, { parents: ['aa-hold'], driveId: 'drv-alpha1', mimeType: 'application/pdf' });
  pair('sh-cut', 'cut.pdf', 'me-cut', 'not-kept-shortcut.pdf', 'md5-cut', 117, { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'application/vnd.google-apps.shortcut' });
  w.file('sh-doc', 'notes-doc', '', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'application/vnd.google-apps.document', size: '' });
  notMine(w, 'sh-doc');
  w.file('me-zero', 'empty-personal.pdf', '', Object.assign({ md5Checksum: 'md5-zero', size: 0 }, mine));
  await page.goto('./#/drives/work');
  await signIn(page);
  await page.locator('[data-action="pcpscan"]').click();
  const view = page.locator('#view');
  await expect(view).toContainText(/Finished/);
  await expect(view.locator('[data-pcp-list="work"]')).toContainText('kept.pdf');
  for (const name of ['not-kept-zz.pdf', 'not-kept-space.pdf', 'not-kept-hyphen.pdf', 'not-kept-inside.pdf', 'not-kept-hold.pdf', 'not-kept-shortcut.pdf', 'empty-personal.pdf']) {
    await expect(view.locator('[data-pcp-list="work"]')).not.toContainText(name);
  }
  const counts = view.locator('[data-pcp-counts]');
  await expect(counts).toContainText('UNSURE (zero-byte)');
  await expect(counts).toContainText('shortcuts');
  await expect(counts).toContainText('Google files not used as proof');
  await expect(view.locator('p.note').filter({ hasText: 'already in a shared drive' })).toHaveText(/^1 personal files/);
});

test('a drive is excluded by its configured name as well as its id', async ({ page, guard }) => {
  const w = guard.world;
  w.addDrive('drv-name-excluded', 'Karen - SHARED');
  w.file('sh-k', 'only-there.pdf', 'x', { parents: ['drv-name-excluded'], driveId: 'drv-name-excluded', mimeType: 'application/pdf', md5Checksum: 'md5-k', size: 120 });
  notMine(w, 'sh-k');
  w.file('me-k', 'only-there.pdf', 'x', { parents: ['my-root'], driveId: null, mimeType: 'application/pdf', md5Checksum: 'md5-k', size: 120 });
  await page.goto('./#/drives/work');
  await signIn(page);
  await page.locator('[data-action="pcpscan"]').click();
  const view = page.locator('#view');
  await expect(view).toContainText(/Finished/);
  await expect(view.locator('p.note').filter({ hasText: 'already in a shared drive' })).toHaveText(/^0 personal files/);
  await expect(page.locator('body')).not.toContainText(/Karen|karen-/);
  expect(w.calls.filter((c) => c.url.includes('drv-name-excluded'))).toEqual([]);
});

test('a personal folder is binned only when every item inside is junk or marked', async ({ page, guard }) => {
  const w = guard.world;
  const mine = { parents: ['my-root'], driveId: null };
  w.folder('pf-bad', PCP + 'mixed', mine);
  w.file('pf-bad-child', 'notes.txt', 'hello', { parents: ['pf-bad'], driveId: null, mimeType: 'text/plain' });
  w.folder('pf-ok', PCP + 'junk', mine);
  w.file('pf-pyc', 'cache.pyc', '', { parents: ['pf-ok'], driveId: null, mimeType: 'application/octet-stream', size: 0 });
  w.file('pf-lock', 'db.lock', 'x', { parents: ['pf-ok'], driveId: null, mimeType: 'application/octet-stream' });
  w.file('pf-tilde', '~$doc.docx', 'x', { parents: ['pf-ok'], driveId: null, mimeType: 'application/octet-stream' });
  w.folder('pf-other', PCP + 'shared-inside', mine);
  w.file('pf-theirs', 'theirs.txt', 'x', { parents: ['pf-other'], driveId: null, mimeType: 'text/plain' });
  notMine(w, 'pf-theirs');
  w.file('pf-zero', PCP + 'empty.pdf', '', Object.assign({ mimeType: 'application/pdf', size: 0 }, mine));
  w.file('pf-odd', 'zz_delete_drive_notes.pdf', 'x', Object.assign({ mimeType: 'application/pdf' }, mine));
  ledger(w, ['pf-bad', 'pf-ok', 'pf-other', 'pf-zero', 'pf-odd']);
  page.on('dialog', (d) => d.accept());
  await page.goto('./#/bin');
  await signIn(page);
  const view = page.locator('#view');
  await expect(view.locator('li', { hasText: PCP + 'mixed' })).toContainText('not verified or junk');
  await expect(view.locator('li', { hasText: PCP + 'shared-inside' })).toContainText('owned by someone else');
  await expect(view.locator('li', { hasText: PCP + 'empty.pdf' })).toContainText('UNSURE');
  await expect(view.locator('li', { hasText: 'zz_delete_drive_notes.pdf' })).toContainText('Odd prefix');
  for (const name of [PCP + 'mixed', PCP + 'shared-inside', PCP + 'empty.pdf', 'zz_delete_drive_notes.pdf']) {
    await expect(view.locator('li', { hasText: name }).locator('input')).toBeDisabled();
  }
  await expect(view.locator('[data-pcp-dry]')).toContainText('Dry run:');
  await page.locator('[data-action="selectall"][data-group="pcpbin"]').click();
  await expect(page.locator('[data-action="pcpbin"]')).toContainText('Move selected (1)');
  await askForWriteThen(page, 'pcpbin');
  await page.locator('[data-action="pcpbin"]').click();
  await expect(view).toContainText('Found 1, moved 1 to the bin');
  expect(w.byId('pf-ok').trashed).toBe(true);
  for (const id of ['pf-bad', 'pf-bad-child', 'pf-pyc', 'pf-other', 'pf-theirs', 'pf-zero', 'pf-odd']) expect(w.byId(id).trashed, id).toBeFalsy();
  expect(patched(w)).toEqual(['pf-ok']);
});

test('zero-byte and odd-prefix shared files are reported and Select all does not bin them', async ({ page, guard }) => {
  const w = guard.world;
  const dialogs = [];
  page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });
  w.file('zz-ready', 'ZZ_DELETE_ready.txt', 'invented', A);
  w.file('zz-zero', 'ZZ_DELETE_empty.txt', '', Object.assign({ size: 0 }, A));
  w.file('zz-odd', 'zz_delete_lower.txt', 'invented', A);
  ledger(w, ['zz-ready', 'zz-zero', 'zz-odd']);
  await page.goto('./#/bin');
  await signIn(page);
  const view = page.locator('#view');
  await expect(view.locator('[data-bin-list="unsure"]')).toContainText('ZZ_DELETE_empty.txt');
  await expect(view.locator('[data-bin-list="rename"]')).toContainText('zz_delete_lower.txt');
  await expect(view.locator('[data-bin-list="rename"]')).toContainText('Odd prefix');
  await expect(view.locator('li', { hasText: 'ZZ_DELETE_empty.txt' }).locator('input')).toBeDisabled();
  await expect(view.locator('li', { hasText: 'zz_delete_lower.txt' }).locator('input')).toBeDisabled();
  await expect(view.locator('[data-bin-dry]')).toContainText('Dry run:');
  await page.locator('[data-action="selectall"][data-group="bin"]').click();
  await expect(page.locator('[data-action="sweep"]')).toContainText('Move selected (1)');
  await page.locator('[data-action="sweep"]').click();
  await page.locator('[data-action="sweep"]').click();
  await expect.poll(() => dialogs.length).toBe(1);
  expect(dialogs[0]).toMatch(/Dry run:/);
  expect(dialogs[0]).toMatch(/Trash only/);
  expect(dialogs[0]).toMatch(/Nothing is deleted for good/);
  await expect.poll(() => w.byId('zz-ready').trashed).toBe(true);
  expect(w.byId('zz-zero').trashed).toBeFalsy();
  expect(w.byId('zz-odd').trashed).toBeFalsy();
  expect(patched(w)).toEqual(['zz-ready']);
});

test('a shared folder of only junk is binned, and the junk inside is left where it is', async ({ page, guard }) => {
  const w = guard.world;
  page.on('dialog', (d) => d.accept());
  w.folder('zz-junk', 'ZZ_DELETE_junk-folder', A);
  w.file('j-pyc', 'cache.pyc', '', { parents: ['zz-junk'], driveId: 'drv-alpha1', mimeType: 'application/octet-stream', size: 0 });
  w.file('j-lock', 'db.lock', 'x', { parents: ['zz-junk'], driveId: 'drv-alpha1', mimeType: 'application/octet-stream' });
  ledger(w, ['zz-junk']);
  await page.goto('./#/bin');
  await signIn(page);
  await expect(page.locator('[data-bin-list="ready"]')).toContainText('ZZ_DELETE_junk-folder');
  await page.locator('li', { hasText: 'ZZ_DELETE_junk-folder' }).locator('input').check();
  await page.locator('[data-action="sweep"]').click();
  await page.locator('[data-action="sweep"]').click();
  await expect.poll(() => w.byId('zz-junk').trashed).toBe(true);
  expect(w.byId('j-pyc').trashed).toBeFalsy();
  expect(w.byId('j-lock').trashed).toBeFalsy();
  expect(patched(w)).toEqual(['zz-junk']);
});

test('a file that changed after it was listed is not binned', async ({ page, guard }) => {
  const w = guard.world;
  page.on('dialog', (d) => d.accept());
  w.file('zz-change', 'ZZ_DELETE_change.txt', 'invented', A);
  ledger(w, ['zz-change']);
  await page.goto('./#/bin');
  await signIn(page);
  await expect(page.locator('[data-bin-list="ready"]')).toContainText('ZZ_DELETE_change.txt');
  w.byId('zz-change').modifiedTime = '2026-04-01T00:00:00.000Z';
  await page.locator('li', { hasText: 'ZZ_DELETE_change.txt' }).locator('input').check();
  await page.locator('[data-action="sweep"]').click();
  await page.locator('[data-action="sweep"]').click();
  await expect(page.locator('#sweepResults')).toContainText('changed since it was listed');
  expect(w.byId('zz-change').trashed).toBeFalsy();
  expect(patched(w)).toEqual([]);
});

test('a file already in the bin is not patched again', async ({ page, guard }) => {
  const w = guard.world;
  page.on('dialog', (d) => d.accept());
  w.file('zz-gone', 'ZZ_DELETE_gone.txt', 'invented', A);
  ledger(w, ['zz-gone']);
  await page.goto('./#/bin');
  await signIn(page);
  await expect(page.locator('[data-bin-list="ready"]')).toContainText('ZZ_DELETE_gone.txt');
  w.byId('zz-gone').trashed = true;
  await page.locator('li', { hasText: 'ZZ_DELETE_gone.txt' }).locator('input').check();
  await page.locator('[data-action="sweep"]').click();
  await page.locator('[data-action="sweep"]').click();
  await expect(page.locator('#sweepResults')).toContainText('already in the bin');
  expect(patched(w)).toEqual([]);
});

test('a personal file owned by someone else is not binned', async ({ page, guard }) => {
  const w = guard.world;
  page.on('dialog', (d) => d.accept());
  w.file('me-marked', PCP + 'older.pdf', 'x', { parents: ['my-root'], driveId: null, mimeType: 'application/pdf' });
  ledger(w, ['me-marked']);
  await page.goto('./#/bin');
  await signIn(page);
  await expect(page.locator('#view')).toContainText(PCP + 'older.pdf');
  notMine(w, 'me-marked');
  await page.locator('[data-action="selectall"][data-group="pcpbin"]').click();
  await askForWriteThen(page, 'pcpbin');
  await page.locator('[data-action="pcpbin"]').click();
  await expect(page.locator('#view')).toContainText('owned by someone else');
  await expect(page.locator('#view')).toContainText('skipped');
  expect(w.byId('me-marked').trashed).toBeFalsy();
  expect(patched(w)).toEqual([]);
});

test('a shared drive that cannot be read is skipped, and Continue reads it', async ({ page, guard, allowedConsole }) => {
  allowedConsole.push(/status of 403/);
  const w = guard.world;
  const shared = { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'application/pdf' };
  const mine = { parents: ['my-root'], driveId: null, mimeType: 'application/pdf' };
  w.file('sh-a', 'invoice-a.pdf', 'x', Object.assign({ md5Checksum: 'md5-aaa', size: 100 }, shared));
  w.file('sh-b', 'invoice-b.pdf', 'x', Object.assign({ md5Checksum: 'md5-bbb', size: 200 }, shared));
  notMine(w, 'sh-a'); notMine(w, 'sh-b');
  w.file('me-a', 'invoice-a.pdf', 'x', Object.assign({ md5Checksum: 'md5-aaa', size: 100 }, mine));
  w.file('me-b', 'invoice-b.pdf', 'x', Object.assign({ md5Checksum: 'md5-bbb', size: 200 }, mine));
  await page.goto('./#/drives/work');
  await signIn(page);
  w.failFor = 'corpora=drive';
  w.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal' };
  await page.locator('[data-action="pcpscan"]').click();
  const view = page.locator('#view');
  await expect(view).toContainText('could not be read and were not used as proof');
  await expect(view).toContainText('0 personal files');
  await expect(page.locator('[data-action="pcpresume"]')).toBeVisible();
  w.failFor = null;
  w.failWith = null;
  await page.locator('[data-action="pcpresume"]').click();
  await expect(view).toContainText('2 personal files');
  await expect(view.locator('[data-pcp-list="work"]')).toContainText('invoice-a.pdf');
  await expect(view.locator('[data-pcp-list="work"]')).toContainText('invoice-b.pdf');
});

function installPretendDrive(page, files) {
  return page.addInitScript((tree) => {
    const mk = (name, text, path) => ({
      kind: 'file', name,
      getFile: async () => new File([text], name, { lastModified: 1700000000000 }),
      move: async () => {},
    });
    const dir = (name, entries) => ({ kind: 'directory', name, entries: async function* () { for (const e of entries) yield [e.name, e]; } });
    const root = [];
    Object.entries(tree).forEach(([p, text]) => root.push(mk(p, text, p)));
    window.showDirectoryPicker = async () => dir('PRETEND-STICK', root);
  }, files);
}

test('Drive check ignores a kept copy that is marked or sitting in a marked folder', async ({ page, guard }) => {
  const w = guard.world;
  const bytes = (ch, n) => ch.repeat(n);
  const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
  const localZz = bytes('a', 2048);
  const localHold = bytes('b', 2048);
  const localOk = bytes('c', 2048);
  const localOdd = bytes('d', 2048);
  w.folder('usb-zz', 'ZZ_holding', A);
  w.file('usb-zz-copy', 'ZZ_local-zz.bin', 'x', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'application/octet-stream', md5Checksum: md5(localZz), size: localZz.length });
  w.file('usb-hold-copy', 'inside-hold.bin', 'x', { parents: ['usb-zz'], driveId: 'drv-alpha1', mimeType: 'application/octet-stream', md5Checksum: md5(localHold), size: localHold.length });
  w.file('usb-ok-copy', 'kept-local.bin', 'x', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'application/octet-stream', md5Checksum: md5(localOk), size: localOk.length });
  await installPretendDrive(page, {
    'local-zz.bin': localZz,
    'local-hold.bin': localHold,
    'local-ok.bin': localOk,
    'empty.bin': '',
    'zz_delete_local_odd.bin': localOdd,
    [USB + 'done.bin']: localOk,
  });
  await page.goto('./#/drives/usb');
  await signIn(page);
  await page.locator('[data-action="usbscan"]').click();
  const view = page.locator('#view');
  await expect(view).toContainText(/Finished/);
  await expect(view).toContainText('are NOT in a shared drive');
  await expect(view.locator('[data-bin-list="usb"]')).toContainText('local-ok.bin');
  await expect(view.locator('[data-bin-list="usb"]')).not.toContainText('local-zz.bin');
  await expect(view.locator('[data-bin-list="usb"]')).not.toContainText('local-hold.bin');
  await expect(view.locator('[data-usb-counts]')).toContainText('1 UNSURE (zero-byte)');
  await expect(view.locator('[data-usb-counts]')).toContainText('1 already marked');
  await expect(view.locator('[data-bin-list="usb-odd"]')).toContainText('zz_delete_local_odd.bin');
  expect(writes(w)).toEqual([]);
});

test('Drive check says when a shared drive could not be read, and Continue finishes the check', async ({ page, guard, allowedConsole }) => {
  allowedConsole.push(/status of 403/);
  const w = guard.world;
  const text = 'm'.repeat(2048);
  const sum = crypto.createHash('md5').update(text).digest('hex');
  w.file('usb-sh', 'copy.bin', 'x', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'application/octet-stream', md5Checksum: sum, size: text.length });
  await installPretendDrive(page, { 'match.bin': text });
  await page.goto('./#/drives/usb');
  await signIn(page);
  w.failFor = 'corpora=drive';
  w.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal' };
  await page.locator('[data-action="usbscan"]').click();
  const view = page.locator('#view');
  await expect(view).toContainText(/Finished/);
  await expect(view).toContainText('were not found in the shared drives that could be read');
  await expect(view).not.toContainText('are NOT in a shared drive');
  await expect(page.locator('[data-action="usbcontinue"]')).toBeVisible();
  w.failFor = null;
  w.failWith = null;
  await page.locator('[data-action="usbcontinue"]').click();
  await expect(view.locator('p.note').filter({ hasText: 'are already in a shared drive' })).toHaveText(/^1 files/);
  await expect(view.locator('p.note').filter({ hasText: 'are NOT in a shared drive' })).toHaveText(/^0 files/);
  await expect(view.locator('[data-bin-list="usb"]')).toContainText('match.bin');
});

test('Changes names a shortcut and counts shortcuts and Google files', async ({ page, guard }) => {
  const w = guard.world;
  w.file('cf-cut', 'sample-shortcut', 'x', { parents: [IDS.cf], driveId: 'drv-alpha1', mimeType: 'application/vnd.google-apps.shortcut', size: 10 });
  w.file('cf-doc', 'sample-google-doc', '', { parents: [IDS.cf], driveId: 'drv-alpha1', mimeType: 'application/vnd.google-apps.document', size: '' });
  await page.goto('./#/changes');
  await signIn(page);
  await expect(page.locator('li', { hasText: 'sample-shortcut' })).toContainText('Shortcut');
  await page.goto('./#/changes/totals');
  await expect(page.locator('[data-cf-shortcuts]')).toContainText('Shortcuts');
  await expect(page.locator('[data-cf-native]')).toContainText('Google files');
});

test('a sign-in that expires during a personal scan is reported and stops the scan', async ({ page, guard, allowedConsole }) => {
  allowedConsole.push(/status of 401/);
  const w = guard.world;
  await page.goto('./#/drives/work');
  await signIn(page);
  w.failFor = 'corpora=drive';
  w.failWith = { status: 401, reason: 'authError', message: 'Invalid Credentials' };
  await page.locator('[data-action="pcpscan"]').click();
  await expect(page.locator('#banner')).toContainText('Sign-in expired');
  await expect(page.locator('#view')).toContainText('Sign-in expired');
  expect(patched(w)).toEqual([]);
});
