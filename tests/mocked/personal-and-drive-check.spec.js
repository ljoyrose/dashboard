// PC-Personal (rename, then bin) and Drive check (rename on a plugged-in drive).
// These are the pages with the most "blast radius": they rename and bin real files.
// Here every write goes to something that only exists in memory:
//   - PC-Personal writes go to the pretend Drive (tests/support/fake-drive.js).
//   - Drive check writes go to a pretend plugged-in drive made inside the page (nothing on any disk).
// Real Drive and real disks are never reachable: outside addresses are blocked and a test fails if one is tried.
const crypto = require('crypto');
const { test, expect } = require('../support/test');

const PCP = 'ZZ_DELETE_DRIVE_';
const USB = 'ZZ_DELETE_LOCAL_';

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#mainNav')).toBeVisible();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};

// ---------------------------------------------------------------- PC-Personal
function personalWorld(world) {
  const shared = { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'application/pdf' };
  const mine = { parents: ['my-root'], driveId: null, mimeType: 'application/pdf' };
  // Two personal files that also exist (same checksum + size) in a shared drive: these are the matches.
  world.file('sh-a', 'invoice-a.pdf', 'x', { ...shared, md5Checksum: 'md5-aaa', size: 100 });
  world.file('sh-b', 'invoice-b.pdf', 'x', { ...shared, md5Checksum: 'md5-bbb', size: 200 });
  ['sh-a', 'sh-b'].forEach((id) => { world.byId(id).mine = false; }); // shared-drive files are not owned by the signed-in person
  world.file('me-a', 'invoice-a.pdf', 'x', { ...mine, md5Checksum: 'md5-aaa', size: 100 });
  world.file('me-b', 'invoice-b.pdf', 'x', { ...mine, md5Checksum: 'md5-bbb', size: 200 });
  // A personal file that is NOT in a shared drive: must never be renamed.
  world.file('me-only', 'only-mine.pdf', 'y', { ...mine, md5Checksum: 'md5-zzz', size: 300 });
  // A personal file already marked: the scan skips it (and the bin step is what picks it up).
  world.file('me-marked', PCP + 'older.pdf', 'x', { ...mine, md5Checksum: 'md5-aaa', size: 100 });
}
const writes = (world) => world.calls.filter((c) => c.method !== 'GET');
const askForWriteThen = async (page, action) => {
  await page.locator(`[data-action="${action}"]`).click(); // first click only asks for the extra (pretend) permission
  await expect.poll(() => page.evaluate(() => window.__GIS_CALLS.request)).toBeGreaterThan(1);
};

test.describe('PC-Personal: rename and bin (mocked, writes only reach the pretend Drive)', () => {
  test.beforeEach(({ guard }) => personalWorld(guard.world));

  test('Rename: needs the extra permission, then a confirm; Cancel changes nothing', async ({ page, guard }) => {
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
    await page.goto('./#/personal');
    await signIn(page);
    await page.locator('[data-action="pcpscan"]').click();
    await expect(page.locator('#view')).toContainText(/Finished/);
    await askForWriteThen(page, 'pcpmark');
    await page.locator('[data-action="pcpmark"]').click();
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toMatch(new RegExp('Rename 2 personal files to start ' + PCP));
    expect(dialogs[0]).toMatch(/Nothing is deleted yet/);
    expect(writes(guard.world)).toEqual([]);
    expect(guard.world.byId('me-a').name).toBe('invoice-a.pdf');
  });

  test('Rename: confirming renames only the two matches, nothing else, and deletes nothing', async ({ page, guard }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('./#/personal');
    await signIn(page);
    await page.locator('[data-action="pcpscan"]').click();
    await expect(page.locator('#view')).toContainText(/Finished/);
    await askForWriteThen(page, 'pcpmark');
    await page.locator('[data-action="pcpmark"]').click();
    await expect(page.locator('#view')).toContainText('Renamed 2 to ' + PCP);
    expect(guard.world.byId('me-a').name).toBe(PCP + 'invoice-a.pdf');
    expect(guard.world.byId('me-b').name).toBe(PCP + 'invoice-b.pdf');
    // untouched
    expect(guard.world.byId('me-only').name).toBe('only-mine.pdf');
    expect(guard.world.byId('sh-a').name).toBe('invoice-a.pdf'); // the shared-drive copy is never changed
    expect(guard.world.byId('sh-b').name).toBe('invoice-b.pdf');
    // every write was a rename of one of the two matches. No deletes, no bin.
    const w = writes(guard.world);
    expect(w.map((c) => c.method)).toEqual(['PATCH', 'PATCH']);
    expect(w.map((c) => c.path).sort()).toEqual(['/files/me-a', '/files/me-b']);
    expect(guard.world.files.filter((f) => f.trashed && f.id !== 'bin-1').map((f) => f.id)).toEqual([]); // bin-1 was already binned before the test
  });

  test('Bin: finds only ZZ_DELETE_DRIVE_ files, asks first, and Cancel changes nothing', async ({ page, guard }) => {
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
    await page.goto('./#/personal');
    await signIn(page);
    await askForWriteThen(page, 'pcpbin');
    await page.locator('[data-action="pcpbin"]').click();
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toMatch(new RegExp('Move 1 personal files starting ' + PCP + ' to the bin'));
    await expect(page.locator('#view')).toContainText('Cancelled. Nothing binned.');
    expect(writes(guard.world)).toEqual([]);
    expect(guard.world.byId('me-marked').trashed).toBeFalsy();
  });

  test('Bin: confirming moves only the ZZ_DELETE_DRIVE_ file to the bin; ordinary files stay', async ({ page, guard }) => {
    page.on('dialog', (d) => d.accept());
    await page.goto('./#/personal');
    await signIn(page);
    await askForWriteThen(page, 'pcpbin');
    await page.locator('[data-action="pcpbin"]').click();
    await expect(page.locator('#view')).toContainText('Found 1, moved 1 to the bin');
    expect(guard.world.byId('me-marked').trashed).toBe(true);
    for (const id of ['me-a', 'me-b', 'me-only', 'sh-a', 'sh-b', 'rr-1']) expect(guard.world.byId(id).trashed, id).toBeFalsy();
    const w = writes(guard.world);
    expect(w.map((c) => c.method)).toEqual(['PATCH']); // a move to the bin, never a delete
  });

  test('a read-only sign-in never writes: scanning only reads', async ({ page, guard }) => {
    await page.goto('./#/personal');
    await signIn(page);
    await page.locator('[data-action="pcpscan"]').click();
    await expect(page.locator('#view')).toContainText(/Finished/);
    await expect(page.locator('#view')).toContainText('2 personal files');
    expect(writes(guard.world)).toEqual([]);
  });

  // DECIDED by Lisa (15 Oct 2026): keep this behaviour. Shared drives are the correct home and only one copy is needed,
  // so a personal RR_ file that is an exact copy of a shared-drive file IS renamed ZZ_DELETE_DRIVE_RR_... and later binned.
  // (This differs from the Bin page, which leaves RR_ items in shared drives alone. That is intended.)
  // This test pins the decision: if someone later makes PC-Personal skip RR_ files, it goes red and must be discussed first.
  test('Rename and bin: a personal RR_ file that matches a shared-drive copy IS renamed and then binned (decided, not a bug)', async ({ page, guard }) => {
    guard.world.file('me-rr', 'RR_archive.pdf', 'x', { parents: ['my-root'], driveId: null, mimeType: 'application/pdf', md5Checksum: 'md5-aaa', size: 100 });
    page.on('dialog', (d) => d.accept());
    await page.goto('./#/personal');
    await signIn(page);
    await page.locator('[data-action="pcpscan"]').click();
    await expect(page.locator('#view')).toContainText(/Finished/);
    await askForWriteThen(page, 'pcpmark');
    await page.locator('[data-action="pcpmark"]').click();
    await expect(page.locator('#view')).toContainText('Renamed 3 to ' + PCP);
    expect(guard.world.byId('me-rr').name).toBe(PCP + 'RR_archive.pdf');
    expect(guard.world.byId('sh-a').name).toBe('invoice-a.pdf'); // the shared copy it matched is untouched
    await page.locator('[data-action="pcpbin"]').click();
    await expect(page.locator('#view')).toContainText('moved 4 to the bin'); // 3 just renamed + the one already marked
    expect(guard.world.byId('me-rr').trashed).toBe(true);
    expect(guard.world.byId('sh-a').trashed).toBeFalsy();
  });
});

// ---------------------------------------------------------------- Drive check (pretend plugged-in drive)
const bytes = (ch, n) => ch.repeat(n);
const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
const FILES = {
  'match-one.bin': bytes('a', 2048),
  'sub/match-two.bin': bytes('b', 4096),
  'unique.bin': bytes('c', 3000), // not in any shared drive
  'tiny.txt': bytes('d', 100), // under 1 KB: ignored by the page
  '.DS_Store': bytes('e', 5000), // system file: skipped by the page
};

async function installPretendDrive(page, files) {
  await page.addInitScript((tree) => {
    window.__USB_MOVES = [];
    const mk = (name, text, path) => ({
      kind: 'file', name,
      getFile: async () => new File([text], name, { lastModified: 1700000000000 }),
      move: async (to) => { window.__USB_MOVES.push([path, to]); },
    });
    const dir = (name, entries) => ({ kind: 'directory', name, entries: async function* () { for (const e of entries) yield [e.name, e]; } });
    const root = [];
    const subs = {};
    Object.entries(tree).forEach(([p, text]) => {
      const parts = p.split('/');
      if (parts.length === 1) root.push(mk(parts[0], text, p));
      else (subs[parts[0]] = subs[parts[0]] || []).push(mk(parts[1], text, p));
    });
    Object.entries(subs).forEach(([n, es]) => root.push(dir(n, es)));
    window.showDirectoryPicker = async () => dir('PRETEND-STICK', root);
  }, files);
}
const sharedCopies = (world) => {
  for (const name of ['match-one.bin', 'sub/match-two.bin']) {
    const text = FILES[name];
    world.file('usb-sh-' + name, 'copy-of-' + name.replace('/', '-'), 'x', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', md5Checksum: md5(text), size: text.length, mimeType: 'application/octet-stream' });
  }
};

test.describe('Drive check: rename on a plugged-in drive (pretend drive in memory)', () => {
  test.beforeEach(async ({ page, guard }) => {
    sharedCopies(guard.world);
    await installPretendDrive(page, FILES);
  });
  const scan = async (page) => {
    await page.goto('./#/usb');
    await signIn(page);
    await page.locator('[data-action="usbscan"]').click();
    await expect(page.locator('#view')).toContainText(/Finished/);
  };

  test('scan finds the two files that are already in a shared drive and the one that is not', async ({ page, guard }) => {
    await scan(page);
    const view = page.locator('#view');
    await expect(view).toContainText('Drive: PRETEND-STICK');
    await expect(view).toContainText('2 files');
    await expect(view).toContainText('already in a shared drive');
    await expect(view).toContainText('1 files');
    await expect(view).toContainText('are NOT in a shared drive');
    await expect(view).toContainText('match-one.bin');
    await expect(view).toContainText('sub/match-two.bin');
    await expect(view).not.toContainText('unique.bin\n'); // the unique file is not offered for renaming
    expect(guard.world.calls.filter((c) => c.method !== 'GET')).toEqual([]); // only reads Drive
    expect(await page.evaluate(() => window.__USB_MOVES)).toEqual([]); // and renames nothing yet
  });

  test('Rename: Cancel at the confirm renames nothing', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
    await scan(page);
    await page.locator('[data-action="usbmark"]').click();
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toMatch(new RegExp('Rename 2 files on "PRETEND-STICK" to start ' + USB));
    expect(dialogs[0]).toMatch(/Nothing is deleted/);
    expect(await page.evaluate(() => window.__USB_MOVES)).toEqual([]);
  });

  test('Rename: confirming renames only the two matches, with the ZZ_DELETE_LOCAL_ prefix, and deletes nothing', async ({ page, guard }) => {
    page.on('dialog', (d) => d.accept());
    await scan(page);
    await page.locator('[data-action="usbmark"]').click();
    await expect(page.locator('#view')).toContainText('Renamed 2 to ' + USB);
    const moves = await page.evaluate(() => window.__USB_MOVES);
    expect(moves.sort()).toEqual([
      ['match-one.bin', USB + 'match-one.bin'],
      ['sub/match-two.bin', USB + 'match-two.bin'],
    ].sort());
    expect(guard.world.calls.filter((c) => c.method !== 'GET')).toEqual([]); // Drive was only read
  });
});
