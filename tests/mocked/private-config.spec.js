// Private settings loader (config.js, bottom block) in the browser, on the pretend Drive.
// After Google sign-in the page looks for ONE trusted file called DASH_CONFIG.json. Not there, broken, slow, shared in
// by someone else, or no sign-in = the settings written in config.js, exactly as before. Every id and value is invented.
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');

const NAME = 'DASH_CONFIG.json';
const KEPT = 'ljr-dash-private-config';
const RUNLOG = 'private-runlog-folder-test';
const GOOD = { home: { runLogFolderId: RUNLOG }, cdhub: { folderName: 'Invented / private folder name' }, cleanup: { excludedDrives: [{ id: 'private-never-read-test', name: 'Invented never-read drive' }] } };
const MINE = { parents: [], driveId: null, mimeType: 'application/json' };
const A = { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain' };

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const status = (page) => page.evaluate(() => window.DashConfigLoader.status());
const settled = async (page, want) => { await expect.poll(async () => (await status(page)).state).toBe(want); return status(page); };
const settings = (page) => page.evaluate(() => JSON.stringify(window.DASH_CONFIG));
const lookups = (world) => world.calls.filter((c) => c.path === '/files' && c.query.includes(NAME)).length;
const reads = (world, id) => world.calls.filter((c) => c.path === '/files/' + id && /alt=media/.test(c.url)).length;
// Changes the privateConfig block the page is served (the real config.js ships enabled, in dry run).
const serve = (page, change) => page.route('**/config.js', async (route) => {
  const res = await route.fetch();
  const body = change(await res.text());
  await route.fulfill({ status: 200, contentType: 'text/javascript', body });
});
const swap = (text, from, to) => { if (!text.includes(from)) throw new Error('config.js no longer has: ' + from); return text.replace(from, to); };
const live = (page) => serve(page, (t) => swap(t, 'dryRun: true,\n      fileName', 'dryRun: false,\n      fileName'));
const countLoads = (page) => { const n = { loads: 0 }; page.on('load', () => { n.loads++; }); return n; };

test.describe('Private settings file: found or not, the page stays safe', () => {
  test('signed out: nothing is looked for and nothing changes', async ({ page, guard }) => {
    guard.world.file('cfg-1', NAME, JSON.stringify(GOOD), MINE);
    await page.goto('./');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    const before = await settings(page);
    const st = await page.evaluate(() => window.DashConfigLoader.ready);
    expect(st.state).toBe('signed-out');
    expect(guard.world.calls.length).toBe(0); // not one Drive call before sign-in
    expect(await settings(page)).toBe(before);
  });

  test('no file on Drive: one look after sign-in, then the page runs on config.js as before', async ({ page, guard }) => {
    await page.goto('./');
    const before = await settings(page);
    await signIn(page);
    const st = await settled(page, 'absent');
    expect(st).toMatchObject({ found: 0, values: 0, wouldChange: 0, inUse: 0, pendingReload: false });
    expect(lookups(guard.world)).toBe(1);
    expect(await settings(page)).toBe(before);
    // Nothing is kept in the browser for it: the sign-in is still the only thing stored.
    expect(await page.evaluate(() => ({ local: Object.keys(localStorage), session: sessionStorage.length }))).toEqual({ local: ['ljr-dash-auth'], session: 0 });
    // One look per page load, however many times the sign-in is refreshed on the page.
    await page.evaluate(() => { const a = window.DashAuth.valid(); window.DashAuth.save(a.access_token, a.expires_at, a.scope); });
    await page.evaluate(() => window.DashConfigLoader.refresh());
    expect(lookups(guard.world)).toBe(1);
    await page.reload();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    expect((await settled(page, 'absent')).found).toBe(0);
    expect(lookups(guard.world)).toBe(2);
  });

  test('file found, dry run (as shipped): it is checked and counted, and nothing changes', async ({ page, guard }) => {
    guard.world.file('cfg-1', NAME, JSON.stringify(Object.assign({ clientId: 'made-up', food: { live: true } }, GOOD)), MINE);
    const n = countLoads(page);
    await page.goto('./');
    const before = await settings(page);
    await signIn(page);
    const st = await settled(page, 'checked');
    expect(st).toMatchObject({ dryRun: true, found: 1, values: 2, drives: 1, wouldChange: 3, inUse: 0, pendingReload: false });
    expect(st.skipped).toEqual([{ path: 'clientId', why: 'never changed from Drive' }, { path: 'food.live', why: 'never changed from Drive' }]);
    expect(JSON.stringify(st)).not.toContain(RUNLOG); // counts and setting names only, never a value
    expect(await settings(page)).toBe(before);
    expect(reads(guard.world, 'cfg-1')).toBe(1);
    // Nothing is kept in the browser in dry run.
    expect(await page.evaluate((k) => localStorage.getItem(k), KEPT)).toBeNull();
    expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
    expect(n.loads).toBe(1); // no reload
  });

  test('broken file: not JSON, or not a settings object, changes nothing', async ({ page, guard }) => {
    guard.world.file('cfg-1', NAME, '{ "home": { "runLogFolderId": ', MINE);
    await page.goto('./');
    const before = await settings(page);
    await signIn(page);
    expect(await settled(page, 'unreadable')).toMatchObject({ values: 0, wouldChange: 0, inUse: 0 });
    expect(await settings(page)).toBe(before);
    guard.world.byId('cfg-1').content = '["a list, not settings"]';
    expect((await page.evaluate(() => window.DashConfigLoader.refresh(true))).state).toBe('unreadable');
    expect(await settings(page)).toBe(before);
  });

  test('slow Drive: the look is given up after the wait, and the page carries on with config.js', async ({ page, guard }) => {
    guard.world.file('cfg-1', NAME, JSON.stringify(GOOD), MINE);
    await serve(page, (t) => swap(t, "fileName: 'DASH_CONFIG.json'", "fileName: 'DASH_CONFIG.json', timeoutMs: 300"));
    await page.route(/\/drive\/v3\/files\?q=name[^&]*DASH_CONFIG/, async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      try { await route.fallback(); } catch (e) { /* the page gave up waiting */ }
    });
    await page.goto('./');
    const before = await settings(page);
    await signIn(page); // the page's own reads are not held up by the look
    expect(await settled(page, 'slow')).toMatchObject({ values: 0, inUse: 0 });
    expect(await settings(page)).toBe(before);
    expect(reads(guard.world, 'cfg-1')).toBe(0);
  });

  test('a file shared in by someone else is ignored and never opened', async ({ page, guard }) => {
    guard.world.file('cfg-theirs', NAME, JSON.stringify(GOOD), MINE);
    guard.world.byId('cfg-theirs').mine = false;
    await page.goto('./');
    const before = await settings(page);
    await signIn(page);
    expect(await settled(page, 'untrusted')).toMatchObject({ found: 1, values: 0, inUse: 0 });
    expect(reads(guard.world, 'cfg-theirs')).toBe(0);
    expect(await settings(page)).toBe(before);
  });

  test('a shared-drive file counts only when Google limits that drive to its own domain', async ({ page, guard }) => {
    // drv-alpha1 has no such limit: a file there is not trusted, whoever put it there.
    guard.world.file('cfg-open', NAME, JSON.stringify(GOOD), { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'application/json' });
    await page.goto('./');
    await signIn(page);
    expect((await settled(page, 'untrusted')).found).toBe(1);
    expect(reads(guard.world, 'cfg-open')).toBe(0);
    // The same file in a domain-only shared drive is trusted.
    guard.world.byId('cfg-open').trashed = true;
    guard.world.addDrive('drv-domain-only', 'Invented domain-only drive');
    guard.world.drives[guard.world.drives.length - 1].restrictions = { domainUsersOnly: true };
    guard.world.file('cfg-domain', NAME, JSON.stringify(GOOD), { parents: ['drv-domain-only'], driveId: 'drv-domain-only', mimeType: 'application/json' });
    expect(await page.evaluate(() => window.DashConfigLoader.refresh(true))).toMatchObject({ state: 'checked', found: 1, values: 2, drives: 1 });
    expect(reads(guard.world, 'cfg-domain')).toBe(1);
  });

  test('two trusted files: neither is used', async ({ page, guard }) => {
    guard.world.file('cfg-1', NAME, JSON.stringify(GOOD), MINE).file('cfg-2', NAME, JSON.stringify(GOOD), MINE);
    await page.goto('./');
    const before = await settings(page);
    await signIn(page);
    expect((await settled(page, 'ambiguous')).found).toBe(2);
    expect(reads(guard.world, 'cfg-1') + reads(guard.world, 'cfg-2')).toBe(0);
    expect(await settings(page)).toBe(before);
  });

  test('switched off in config.js: never looks', async ({ page, guard }) => {
    guard.world.file('cfg-1', NAME, JSON.stringify(GOOD), MINE);
    await serve(page, (t) => swap(t, 'enabled: true,\n      dryRun', 'enabled: false,\n      dryRun'));
    await page.goto('./');
    await signIn(page);
    expect((await page.evaluate(() => window.DashConfigLoader.refresh(true))).state).toBe('off');
    expect(lookups(guard.world)).toBe(0);
  });
});

test.describe('Private settings file in use (dryRun switched off)', () => {
  test('first sign-in: the page reloads once, then runs on the private values end to end', async ({ page, guard }) => {
    const world = guard.world;
    world.file('cfg-1', NAME, JSON.stringify(GOOD), MINE);
    // A run log in the PRIVATE folder: config.js ships that folder id empty, so a row on screen proves the value was used.
    world.file('zz-ready', 'ZZ_DELETE_ready.txt', 'invented', A);
    world.byId(IDS.ledger).content = 'file_id\nzz-ready\n';
    world.file('private-runlog-test', 'RUN-LOG.csv', 'date_uk,job,place,mode,found,changed,ledger_rows_added,errors,result,lesson\n' +
      new Date(Date.now() - 3600e3).toISOString() + ',bin-engine,Test Drive Alpha,dry,12,0,3,0,ok,Invented lesson\n', { parents: [RUNLOG], driveId: 'drv-alpha1', mimeType: 'text/csv' });
    await live(page);
    const n = countLoads(page);
    await page.goto('./#/bin');
    expect(JSON.parse(await settings(page)).home.runLogFolderId).toBe(''); // as written in config.js
    await page.locator('#signInBtn').click();
    await expect.poll(() => n.loads).toBe(2); // one reload, on its own
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/); // still signed in after the reload
    const cfg = JSON.parse(await settings(page));
    expect(cfg.home.runLogFolderId).toBe(RUNLOG);
    expect(cfg.cdhub.folderName).toBe('Invented / private folder name');
    expect(cfg.excludedDrives).toContain('private-never-read-test');
    expect(cfg.excludedDrives).toContain(IDS.excludedDrive); // the built-in never-read drive is still there
    expect(await status(page)).toMatchObject({ state: 'in-use', dryRun: false, values: 2, drives: 1, inUse: 3, pendingReload: false });
    await expect(page.locator('#sweepCard [title="ZZ_DELETE_ready.txt"]')).toHaveCount(1);
    await page.locator('#logCard > summary').click();
    await expect(page.locator('#runLog [data-run]')).toHaveCount(1);
    await expect(page.locator('#runLog')).toContainText('Invented lesson');
    // No second reload, and no second look inside 15 minutes.
    await page.waitForTimeout(400);
    expect(n.loads).toBe(2);
    expect(lookups(world)).toBe(1);
  });

  test('the rails hold in use too: sign-in id, permissions, API addresses and switches stay as written', async ({ page, guard }) => {
    guard.world.file('cfg-1', NAME, JSON.stringify({
      clientId: 'made-up', scopes: { read: 'made-up' }, urls: { files: 'https://docs.google.com/made-up' },
      personalBin: { dryRun: false }, food: { live: true }, privateConfig: { enabled: false }, home: { runLogFolderId: RUNLOG },
    }), MINE);
    await live(page);
    const n = countLoads(page);
    await page.goto('./');
    const before = JSON.parse(await settings(page));
    await page.locator('#signInBtn').click();
    await expect.poll(() => n.loads).toBe(2);
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    const after = JSON.parse(await settings(page));
    expect(after.home.runLogFolderId).toBe(RUNLOG);
    after.home.runLogFolderId = '';
    expect(after).toEqual(before); // the one allowed value is the only difference
  });

  test('never reloads under someone who is typing or tapping: the new values wait for the next page load', async ({ page, guard }) => {
    guard.world.file('cfg-1', NAME, JSON.stringify(GOOD), MINE);
    await live(page);
    await page.route(/\/drive\/v3\/files\/cfg-1\?alt=media/, async (route) => { await new Promise((r) => setTimeout(r, 700)); await route.fallback(); });
    const n = countLoads(page);
    await page.goto('./');
    const before = await settings(page);
    await signIn(page);
    await page.keyboard.press('Shift'); // someone is using the page while the file is still being read
    const st = await settled(page, 'in-use');
    expect(st.pendingReload).toBe(true);
    expect(n.loads).toBe(1);
    expect(await settings(page)).toBe(before); // this page carries on unchanged
    await page.reload(); // the next load starts with the private values
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    expect(JSON.parse(await settings(page)).home.runLogFolderId).toBe(RUNLOG);
    expect(n.loads).toBe(2);
  });

  test('a later broken or missing answer keeps what was in use; signing out forgets it', async ({ page, guard }) => {
    guard.world.file('cfg-1', NAME, JSON.stringify(GOOD), MINE);
    await live(page);
    const n = countLoads(page);
    await page.goto('./');
    await page.locator('#signInBtn').click();
    await expect.poll(() => n.loads).toBe(2);
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    guard.world.byId('cfg-1').content = 'not json any more';
    expect(await page.evaluate(() => window.DashConfigLoader.refresh(true))).toMatchObject({ state: 'in-use', pendingReload: false });
    expect(JSON.parse(await settings(page)).home.runLogFolderId).toBe(RUNLOG);
    expect(JSON.parse(await page.evaluate((k) => localStorage.getItem(k), KEPT)).values.home.runLogFolderId).toBe(RUNLOG);
    await page.evaluate(() => window.DashAuth.clear()); // what the page's Sign out button calls
    expect(await page.evaluate((k) => localStorage.getItem(k), KEPT)).toBeNull();
    expect(n.loads).toBe(2);
  });

  test('values kept in the browser are checked again on every load: a tampered store cannot get past the rails', async ({ page, guard }) => {
    await live(page);
    await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ at: Date.now(), values: { clientId: 'made-up', food: { live: true }, urls: { files: 'https://docs.google.com/made-up' }, home: { runLogFolderId: 'kept-folder-test' } } })), KEPT);
    await page.goto('./');
    const cfg = JSON.parse(await settings(page));
    expect(cfg.home.runLogFolderId).toBe('kept-folder-test');
    expect(cfg.clientId).toBe(IDS.clientId);
    expect(cfg.food.live).toBe(false);
    expect(cfg.urls.files).toBe('https://www.googleapis.com/drive/v3/files');
    expect(guard.world.calls.length).toBe(0);
  });
});
