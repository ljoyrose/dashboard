// TidyUp stage 7 done-test (dashboard half): the Bin page Log reads RUN-LOG.csv.
// Last 7 days of runs, newest first, in UK time; lessons listed; "No runs logged yet" when the file is
// absent, unreadable or not set up; a failed read never breaks or blocks the Bin page.
// Pretend Drive only; every id below is made up. config.js ships the folder id empty, so the tests set one.
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');

const FOLDER = 'runlog-folder-test';
const LOG_ID = 'runlog-file-test';
const DAY = 86400000;
const A = { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain' };

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
// Point the page at a pretend RUN-LOG folder (the real config.js keeps a placeholder).
const withFolder = (page) => page.route('**/config.js', async (route) => {
  const res = await route.fetch();
  const body = (await res.text()) + "\nwindow.DASH_CONFIG.home.runLogFolderId = '" + FOLDER + "';\n";
  await route.fulfill({ status: 200, contentType: 'text/javascript', body });
});
const addLog = (world, text, mimeType = 'text/csv') => world.file(LOG_ID, 'RUN-LOG.csv', text, { parents: [FOLDER], driveId: 'drv-alpha1', mimeType });
const ready = (world) => {
  world.file('zz-ready', 'ZZ_DELETE_ready.txt', 'invented', A);
  world.byId(IDS.ledger).content = 'file_id\nzz-ready\n';
};
const openLog = async (page) => {
  await page.goto('./#/bin');
  await signIn(page);
  await expect(page.locator('#sweepCard [title="ZZ_DELETE_ready.txt"]')).toHaveCount(1);
  await page.locator('#logCard > summary').click();
  await expect(page.locator('#logCard')).toHaveJSProperty('open', true);
  return page.locator('#runLog');
};
// UK wall-clock HH:MM for a moment, worked out here (not by the page).
const ukHm = (ms) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));
const ukNaive = (ms) => { // "YYYY-MM-DD HH:MM" as a UK clock shows it (no offset in the cell)
  const p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
  return p.year + '-' + p.month + '-' + p.day + ' ' + p.hour + ':' + p.minute;
};
const at = (ms) => new Date(Math.floor(ms / 60000) * 60000);

test.describe('Bin page Log reads RUN-LOG (stage 7)', () => {
  test('shows the last 7 days of runs, newest first, in UK time, with mode, counts, result and lessons', async ({ page, guard }) => {
    const now = Date.now();
    const t1 = at(now - 2 * 3600e3), t2 = at(now - 2 * DAY), t3 = at(now - 6 * DAY), old = at(now - 8 * DAY);
    ready(guard.world);
    addLog(guard.world, [
      'date_uk,job,place,mode,found,changed,ledger_rows_added,errors,result,lesson',
      t3.toISOString() + ',bin-guard,Test Drive Bravo,trash,4,4,0,1,partial,"Re-read before binning, twice"',
      old.toISOString() + ',old-engine,Test Drive Alpha,dry,9,0,0,0,ok,An old lesson',
      t1.toISOString() + ',bin-engine,Test Drive Alpha,dry,12,0,3,0,ok,Check the folder id first',
      ukNaive(t2.getTime()) + ',drive-sweep,Work My Drive,mark,5,5,5,0,,Check the folder id first',
      'not a date,broken-row,Test Drive Alpha,dry,1,0,0,0,ok,',
    ].join('\n') + '\n');
    await withFolder(page);
    const log = await openLog(page);
    const rows = log.locator('[data-run]');
    await expect(rows).toHaveCount(3);
    await expect(log).not.toContainText('old-engine');
    await expect(log).not.toContainText('broken-row');
    await expect(rows.nth(0)).toContainText('bin-engine');
    await expect(rows.nth(0)).toContainText('Dry run');
    await expect(rows.nth(0)).toContainText('Found 12 · changed 0 · logged 3 · errors 0. OK.');
    await expect(rows.nth(0)).toContainText(ukHm(t1));
    await expect(rows.nth(0)).toContainText(/\b(GMT|BST)\b/);
    await expect(rows.nth(1)).toContainText('drive-sweep');
    await expect(rows.nth(1)).toContainText('Live (mark)');
    await expect(rows.nth(1)).toContainText(ukHm(t2)); // no offset in the cell: read as UK time
    await expect(rows.nth(1).locator('.mtag')).toHaveText('Work My Drive');
    await expect(rows.nth(2)).toContainText('bin-guard');
    await expect(rows.nth(2)).toContainText('Live (trash)');
    await expect(rows.nth(2).locator('.res')).toHaveClass(/bad/);
    await expect(rows.nth(2)).toContainText('Partly done.');
    const lessons = log.locator('[data-lessons] li');
    await expect(lessons).toHaveText(['Check the folder id first', 'Re-read before binning, twice']);
    await expect(page.locator('#needsNow')).toContainText('0 problems');
    expect(guard.world.calls.filter((c) => c.method !== 'GET').map((c) => c.path)).toEqual([]); // read only
  });

  test('a Google Sheet named RUN-LOG.csv is read through export, the same way', async ({ page, guard }) => {
    ready(guard.world);
    addLog(guard.world, 'date_uk,engine,mode,found,changed,errors\n' + at(Date.now() - DAY).toISOString() + ',bin-engine,live,2,2,0\n', 'application/vnd.google-apps.spreadsheet');
    await withFolder(page);
    const log = await openLog(page);
    await expect(log.locator('[data-run]')).toHaveCount(1);
    await expect(log.locator('[data-run]')).toContainText('bin-engine · Live');
    await expect(log.locator('[data-run]')).toContainText('Found 2 · changed 2 · errors 0. OK.');
    await expect(log.locator('[data-lessons]')).toHaveCount(0);
  });

  test('no folder set up (the shipped placeholder): "No runs logged yet" and no Drive search for it', async ({ page, guard }) => {
    ready(guard.world);
    const log = await openLog(page);
    await expect(log.locator('[data-runlog-none]')).toHaveText('No runs logged yet.');
    expect(guard.world.calls.some((c) => /RUN-LOG/.test(c.query))).toBe(false);
  });

  test('folder set up but no file yet, or only old runs, or no date_uk column: "No runs logged yet"', async ({ page, guard }) => {
    ready(guard.world);
    await withFolder(page);
    let log = await openLog(page);
    await expect(log.locator('[data-runlog-none]')).toHaveText('No runs logged yet.');
    addLog(guard.world, 'date_uk,job\n' + new Date(Date.now() - 10 * DAY).toISOString() + ',bin-engine\n');
    await page.locator('#refreshBtn').click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    log = page.locator('#runLog');
    await expect(log.locator('[data-runlog-none]')).toHaveText('No runs logged yet.');
    guard.world.byId(LOG_ID).content = 'when,job\n' + new Date().toISOString() + ',bin-engine\n';
    await page.locator('#refreshBtn').click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    await expect(log.locator('[data-runlog-none]')).toHaveText('No runs logged yet.');
    await expect(log.locator('[data-run]')).toHaveCount(0);
  });

  test('a failed read does not break the Bin page: neutral text, no problem counted, Bin these still works', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 500/);
    ready(guard.world);
    addLog(guard.world, 'date_uk,job\n' + new Date().toISOString() + ',bin-engine\n');
    guard.world.failFor = LOG_ID;
    guard.world.failWith = { status: 500, reason: 'backendError' };
    await withFolder(page);
    const log = await openLog(page);
    // A 500 is retried 3 times with back-off (toolkit.js WAITS 1+2+4 s plus jitter) before the read counts as failed.
    await expect(log.locator('[data-runlog-none]')).toHaveText('No runs logged yet.', { timeout: 20000 });
    await expect(page.locator('#logCard .fail, #logCard .res.bad')).toHaveCount(0);
    await expect(page.locator('#needsNow')).toContainText('1 file ready for you to approve');
    await expect(page.locator('#needsNow')).toContainText('0 problems');
    expect(guard.world.calls.some((c) => c.path.includes(LOG_ID))).toBe(true); // it did try
    // The rest of the page still bins.
    page.on('dialog', (d) => d.accept());
    await page.locator('#sweepCard li:has([title="ZZ_DELETE_ready.txt"]) input').check();
    const btn = page.locator('#sweepCard [data-action="sweep"]');
    await btn.click();
    await expect.poll(() => page.evaluate(() => window.__GIS_CALLS.request)).toBeGreaterThan(1);
    await btn.click();
    await expect.poll(() => guard.world.byId('zz-ready').trashed).toBe(true);
  });
});
