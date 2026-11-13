// TidyUp Apps stage 3: the Personal Drive page as a trash-only bin. Pretend Drive only; every name and id is invented.
// Look-only until "Allow personal bin actions"; live since 13 Nov 2026 (dry run still tested); a file can be binned only if it starts
// ZZ_DELETE_DRIVE_ and has a ledger row with surface 'drive-personal'; each move re-checks the file live, then trashes only.
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');

const PCP = 'ZZ_DELETE_DRIVE_';
const PERSONAL_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly';
const FULL_SCOPE = 'https://www.googleapis.com/auth/drive';
const BIN_TOKEN = 'Bearer FAKE-PERSONAL-BIN-TOKEN';
const mine = { parents: ['my-root'], driveId: null, mimeType: 'application/pdf' };

function world(w) {
  const shared = { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'application/pdf' };
  w.file('sh-a', 'example-a.pdf', 'x', { ...shared, md5Checksum: 'md5-aaa', size: 100 });
  w.byId('sh-a').mine = false;
  w.file('me-a', 'example-a.pdf', 'x', { ...mine, md5Checksum: 'md5-aaa', size: 100 });
  w.file('me-only', 'only-mine.pdf', 'y', { ...mine, md5Checksum: 'md5-zzz', size: 300 });
  // Marked files: one logged for the personal surface, one logged for another surface, one not logged.
  w.file('me-ok', PCP + 'example-ok.pdf', 'x', { ...mine, md5Checksum: 'md5-ok1', size: 10 });
  w.file('me-other', PCP + 'example-other.pdf', 'x', { ...mine, md5Checksum: 'md5-ot1', size: 11 });
  w.file('me-nolog', PCP + 'example-nolog.pdf', 'x', { ...mine, md5Checksum: 'md5-no1', size: 12 });
  w.byId(IDS.ledger).content = 'date,old_name,file_id,merged_into,agent,surface\n' +
    '2026-11-01,example-ok.pdf,me-ok,sh-ok,sample,drive-personal\n' +
    '2026-11-01,example-other.pdf,me-other,sh-ot,sample,drive\n';
}
const writes = (w) => w.calls.filter((c) => c.method !== 'GET');
const setDry = (page, dry) => page.route('**/config.js', async (route) => {
  const res = await route.fetch();
  await route.fulfill({ response: res, body: (await res.text()) + '\nwindow.DASH_CONFIG.personalBin.dryRun = ' + dry + ';' });
});
const live = (page) => setDry(page, false);
// Ledger slips the Rename step uploads (multipart POST); answered here, recorded for the test.
function catchUploads(page) {
  const uploads = [];
  page.route(/googleapis\.com\/upload\/drive\/v3\/files/, async (route) => {
    uploads.push({ body: route.request().postData(), auth: route.request().headers().authorization });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"FAKE-UPLOAD-0001","name":"x"}' });
  });
  return uploads;
}
async function open(page, { allow = true, scan = false } = {}) {
  await page.goto('./#/drives/personal-drive');
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
  await page.locator('#view [data-action="psignin"]').click();
  await expect(page.locator('#view [data-action="pcpscan"][data-slot="personal"]')).toBeVisible();
  if (scan) {
    await page.locator('#view [data-action="pcpscan"][data-slot="personal"]').click();
    await expect(page.locator('#view')).toContainText(/Finished/);
  }
  if (allow) {
    await page.locator('#view [data-action="pbinallow"]').click();
    await expect(page.locator('[data-q-list="ready"]')).not.toContainText('Reading');
  }
}
const view = (page) => page.locator('#view');

test.describe('Personal Drive bin (TidyUp Apps 3)', () => {
  test.beforeEach(({ guard }) => world(guard.world));

  test('signed in but not allowed: still look-only, with one separate Allow button; nothing written', async ({ page, guard }) => {
    await open(page, { allow: false, scan: true });
    await expect(view(page).locator('[data-action="pbinallow"]')).toHaveText('Allow personal bin actions');
    for (const a of ['qmark', 'qbin', 'pcpmark', 'sweep', 'selectall', 'clearpick']) await expect(view(page).locator(`[data-action="${a}"]`)).toHaveCount(0);
    await expect(view(page).locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(view(page).locator('[data-qbin-block]')).toHaveCount(0);
    expect(writes(guard.world)).toEqual([]);
  });

  test('Allow asks the personal client for the full Drive scope, incrementally, and keeps it in memory only', async ({ page }) => {
    await open(page, { allow: false });
    const before = await page.evaluate(() => window.__GIS_CALLS.request);
    await page.locator('#view [data-action="pbinallow"]').click();
    await expect.poll(() => page.evaluate(() => window.__GIS_CALLS.request)).toBe(before + 1);
    const req = await page.evaluate(() => window.__GIS_LAST_REQUEST);
    expect(req.scope.split(' ').sort()).toEqual([FULL_SCOPE, PERSONAL_SCOPE].sort());
    expect(req.include_granted_scopes).toBe(true);
    expect(await page.evaluate(() => window.__GIS_LAST_CONFIG.scope)).toBe(PERSONAL_SCOPE);
    await expect(view(page).locator('[data-qbin-block]')).toBeVisible();
    const stored = await page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage)) + document.cookie);
    expect(stored).not.toContain('FAKE-PERSONAL');
  });

  test('lazy-loaded: estate/pbin.js is fetched only after Allow personal bin actions, and once', async ({ page }) => {
    const got = [];
    page.on('request', (r) => { if (/estate\/pbin\.js/.test(r.url())) got.push(r.url()); });
    await page.goto('./#/bin');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await page.evaluate(() => { location.hash = '#/drives/personal-drive'; });
    await page.locator('#view [data-action="psignin"]').click();
    await expect(page.locator('#view [data-action="pbinallow"]')).toBeVisible();
    expect(got).toEqual([]);
    expect(await page.evaluate(() => typeof window.PBin)).toBe('undefined');
    await page.locator('#view [data-action="pbinallow"]').click();
    await expect(page.locator('[data-q-list="ready"]')).toBeVisible();
    expect(got.length).toBe(1);
  });

  test('config.js: the Personal Drive bin is live (Lisa, 13 Nov 2026)', async ({ page }) => {
    await page.goto('./#/drives/personal-drive');
    expect(await page.evaluate(() => window.DASH_CONFIG.personalBin.dryRun)).toBe(false);
  });

  test('dry run: lists what would go, no tick boxes, no bin button, nothing written', async ({ page, guard }) => {
    await setDry(page, true);
    await open(page, { scan: true });
    await expect(view(page).locator('[data-qbin-dry]')).toBeVisible();
    await expect(view(page).locator('[data-qbin-would]')).toHaveText('Dry run: 1 would go to the bin.');
    await expect(view(page).locator('[data-q-list="ready"] li[data-id="me-ok"]')).toBeVisible();
    await expect(view(page).locator('[data-q-list="rename"]')).toContainText('example-a.pdf');
    await expect(view(page).locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(view(page).locator('[data-action="qbin"], [data-action="qmark"]')).toHaveCount(0);
    expect(writes(guard.world)).toEqual([]);
  });

  test('only a ZZ_DELETE_DRIVE_ file with a drive-personal ledger row is ready; the rest wait', async ({ page }) => {
    await live(page);
    await open(page);
    const ready = view(page).locator('[data-q-list="ready"] > ul li');
    await expect(ready).toHaveCount(1);
    await expect(ready.first()).toHaveAttribute('data-id', 'me-ok');
    const held = view(page).locator('[data-q-list="held"]');
    await expect(held.locator('li[data-id="me-other"]')).toContainText('Waiting for the tidy bot to log it');
    await expect(held.locator('li[data-id="me-nolog"]')).toContainText('Waiting for the tidy bot to log it');
    await expect(view(page).locator('li[data-id="me-only"]')).toHaveCount(0);
    await expect(view(page).locator('input[type="checkbox"][disabled]')).toHaveCount(0);
  });

  test('Bin: Cancel changes nothing', async ({ page, guard }) => {
    await live(page);
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
    await open(page);
    await view(page).locator('[data-action="selectall"][data-group="qbin"]').click();
    await view(page).locator('[data-action="qbin"]').click();
    await expect.poll(() => dialogs.length).toBe(1);
    expect(dialogs[0]).toMatch(/^Bin 1 personal file\? It goes to your personal Drive bin and can be restored for 30 days\./);
    await expect(view(page).locator('[data-q-binned]')).toHaveText('Cancelled. Nothing binned.');
    expect(writes(guard.world)).toEqual([]);
  });

  test('Bin: confirm re-checks live, then trashes only that file with the opted-in token', async ({ page, guard }) => {
    await live(page);
    page.on('dialog', (d) => d.accept());
    await open(page);
    await view(page).locator('[data-action="selectall"][data-group="qbin"]').click();
    await expect(view(page).locator('[data-action="qbin"]')).toHaveText('Bin these (1)');
    const n = guard.world.calls.length;
    await view(page).locator('[data-action="qbin"]').click();
    await expect(view(page).locator('[data-q-binned]')).toContainText('Found 1, moved 1 to the bin');
    expect(guard.world.byId('me-ok').trashed).toBe(true);
    for (const id of ['me-other', 'me-nolog', 'me-a', 'me-only', 'sh-a']) expect(guard.world.byId(id).trashed, id).toBeFalsy();
    const w = writes(guard.world);
    expect(w.map((c) => [c.method, c.path, c.auth])).toEqual([['PATCH', '/files/me-ok', BIN_TOKEN]]);
    // The live re-check (GET of that file) happens before the move.
    const after = guard.world.calls.slice(n);
    const get = after.findIndex((c) => c.method === 'GET' && c.path === '/files/me-ok');
    const patch = after.findIndex((c) => c.method === 'PATCH');
    expect(get).toBeGreaterThanOrEqual(0);
    expect(get).toBeLessThan(patch);
  });

  test('Bin: a file that changed since it was listed (md5) is skipped, not moved', async ({ page, guard }) => {
    await live(page);
    page.on('dialog', (d) => d.accept());
    await open(page);
    await view(page).locator('[data-action="selectall"][data-group="qbin"]').click();
    guard.world.byId('me-ok').md5Checksum = 'md5-changed';
    await view(page).locator('[data-action="qbin"]').click();
    await expect(view(page).locator('[data-q-binned]')).toContainText('moved 0 to the bin, 1 skipped');
    await expect(view(page).locator('[data-q-binned] + ul')).toContainText('Skipped: changed since it was listed.');
    expect(guard.world.byId('me-ok').trashed).toBeFalsy();
    expect(writes(guard.world)).toEqual([]);
  });

  test('Bin: a file already in the bin is skipped', async ({ page, guard }) => {
    await live(page);
    page.on('dialog', (d) => d.accept());
    await open(page);
    await view(page).locator('[data-action="selectall"][data-group="qbin"]').click();
    guard.world.byId('me-ok').trashed = true;
    await view(page).locator('[data-action="qbin"]').click();
    await expect(view(page).locator('[data-q-binned] + ul')).toContainText('Skipped: already in the bin.');
    expect(writes(guard.world)).toEqual([]);
  });

  test('Rename: renames only the ticked exact copy, with the opted-in token, and adds it to the bin list', async ({ page, guard }) => {
    await live(page);
    const uploads = catchUploads(page);
    page.on('dialog', (d) => d.accept());
    await open(page, { scan: true });
    await view(page).locator('[data-action="selectall"][data-group="qmark"]').click();
    await expect(view(page).locator('[data-action="qmark"]')).toHaveText('Rename these (1)');
    await view(page).locator('[data-action="qmark"]').click(); // first press asks the work account for write access
    await expect.poll(() => page.evaluate(() => window.__GIS_CALLS.request)).toBeGreaterThan(2);
    await view(page).locator('[data-action="qmark"]').click();
    await expect(view(page).locator('[data-q-marked]')).toHaveText('Renamed 1.');
    await expect(view(page).locator('[data-q-logged]')).toHaveText('Added 1 to the bin list.');
    expect(uploads).toHaveLength(1);
    expect(uploads[0].auth).toBe('Bearer FAKE-TEST-TOKEN');
    expect(uploads[0].body).toMatch(/"name":"AA_DELETE-LEDGER-ROWS_\d{4}-\d{2}-\d{2}-\d{4}_01\.csv"/);
    const folder = await page.evaluate(() => window.DASH_CONFIG.canvaBin.folderId); // the CHANGES folder (ids live only in config.js)
    expect(uploads[0].body).toContain('"parents":["' + folder + '"]');
    expect(uploads[0].body).toMatch(/"\d{4}-\d{2}-\d{2}","example-a\.pdf","me-a","exact copy in a shared drive \(md5 \+ size checked live before rename\)","dashboard Personal Drive rename","drive-personal"/);
    expect(guard.world.byId('me-a').name).toBe(PCP + 'example-a.pdf');
    expect(guard.world.byId('sh-a').name).toBe('example-a.pdf');
    expect(guard.world.byId('me-only').name).toBe('only-mine.pdf');
    expect(writes(guard.world).map((c) => [c.method, c.path, c.auth])).toEqual([['PATCH', '/files/me-a', BIN_TOKEN]]);
  });

  test('signing out ends bin actions: the next personal sign-in is look-only again', async ({ page }) => {
    await live(page);
    await open(page);
    await expect(view(page).locator('[data-qbin-block]')).toBeVisible();
    await page.locator('#signOutBtn').click();
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await page.evaluate(() => { location.hash = '#/drives/personal-drive'; });
    await page.locator('#view [data-action="psignin"]').click();
    await expect(view(page).locator('[data-action="pbinallow"]')).toBeVisible();
    await expect(view(page).locator('[data-qbin-block]')).toHaveCount(0);
  });
});
