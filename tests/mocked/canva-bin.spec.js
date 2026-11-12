// TidyUp Apps stage 1: the Bin page's Canva card. Pretend Drive only; every title and id below is invented.
// The page never calls Canva. It reads CANVA-BIN-STATE.json, writes ledger slips and CANVA-BIN-REQUEST_ files, and only
// with dryRun off and after a confirm.
const { test, expect } = require('../support/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', '..', 'config.js'), 'utf8'), ctx);
const CONF = ctx.window.DASH_CONFIG;

const CV = CONF.canvaBin;
const AT = { parents: [CV.folderId], driveId: 'drv-alpha1', mimeType: 'application/json' };
const T1 = '2026-10-01T10:00:00.000Z';
const T2 = '2026-10-02T11:30:00.000Z';
const item = (n, over) => Object.assign({ title: 'ZZ_DELETE_Example design ' + n, design_id: 'DAEXAMPLE000' + n, type: 'Presentation', pages: 1, last_modified: T1, folder: 'Example folder', ledger: '' }, over || {});
const state = (main, book) => JSON.stringify({ v: 1, accounts: {
  main: { generated: '2026-10-30T13:15:00.000Z', zz_bin_folder: null, items: main },
  book: { generated: '2026-10-30T13:15:00.000Z', zz_bin_folder: 'FAEXAMPLEBIN1', items: book || [] }
} });
const slipRow = (id, label, modified, pages) => `2026-10-30,"ZZ_DELETE_Example","${id}","Canva ZZ_BIN (bot move), then Canva trash by Lisa (30 days); check: modified=${modified}; pages=${pages}",dashboard Canva card,canva-${label}`;
const slip = (rows) => 'date,old_name,file_id,merged_into,agent,surface\n' + rows.join('\n') + '\n';

const setup = async (page, guard, { main, book, rows = [], dry = true } = {}) => {
  const w = guard.world;
  w.folder(CV.folderId, 'CHANGES (sample)', { parents: ['drv-alpha1'], driveId: 'drv-alpha1' });
  w.file('cv-state', CV.stateFile, state(main || [], book), AT);
  if (rows.length) w.file('cv-slip', 'AA_DELETE-LEDGER-ROWS_2026-10-30-1300_01.csv', slip(rows), { parents: [CV.folderId], driveId: 'drv-alpha1', mimeType: 'text/csv' });
  const uploads = [];
  if (!dry) await page.route('**/config.js', async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()) + '\nwindow.DASH_CONFIG.canvaBin.dryRun = false;' });
  });
  await page.route(/googleapis\.com\/upload\/drive\/v3\/files/, async (route) => {
    uploads.push(route.request().postData());
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"FAKE-UPLOAD-0001","name":"x"}' });
  });
  await page.goto('./#/bin');
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
  await page.locator('#needsNow [data-action="foldjump"][data-key="canva"]').click();
  await expect(page.locator('#canvaCard')).toHaveAttribute('open', '');
  await expect(page.locator('#canvaCard > summary .state')).toHaveClass(/st-ok|st-empty/);
  return uploads;
};
const card = (page) => page.locator('#canvaCard');
const row = (page, id) => card(page).locator('li[data-id="' + id + '"]');
const patchedOrPosted = (w) => w.calls.filter((c) => c.method !== 'GET');

test.describe('Bin: Canva card (TidyUp Apps 1)', () => {
  test('dry run (the default): lists both accounts, says how many would move, writes and moves nothing', async ({ page, guard }) => {
    const uploads = await setup(page, guard, { main: [item(1), item(2, { title: 'ZZ_Example rename only' })], book: [item(3)], rows: [slipRow('DAEXAMPLE0001', 'main', T1, 1)] });
    expect(CV.dryRun).toBe(true);
    await expect(card(page).locator('[data-canva-dry]')).toHaveText('Dry run: 1 would move to the bin folder. Nothing changes.');
    await expect(card(page).locator('[data-canva-account="main"]')).toContainText('ZZ_DELETE_Example design 1');
    await expect(card(page).locator('[data-canva-account="book"]')).toContainText('ZZ_DELETE_Example design 3');
    await expect(row(page, 'DAEXAMPLE0002')).toContainText('Name needs fixing by the tidy bot');
    await expect(card(page).locator('input[type="checkbox"]')).toHaveCount(0);
    await expect(card(page).locator('[data-action="canvamove"]')).toBeDisabled();
    await expect(card(page).locator('[data-action="canvalog"]')).toBeDisabled();
    await expect(card(page).locator('[data-action="canvamove"]')).toContainText('dry run');
    await expect(page.locator('#needsNow [data-key="canva"]')).toContainText('3 Canva designs marked');
    expect(uploads).toEqual([]);
    expect(patchedOrPosted(guard.world)).toEqual([]);
  });

  test('no ledger row = held (offered for logging only); a design whose modified time or pages changed = held', async ({ page, guard }) => {
    await setup(page, guard, { dry: false, main: [item(1), item(2, { last_modified: T2 }), item(4, { pages: 3 })], rows: [slipRow('DAEXAMPLE0002', 'main', T1, 1), slipRow('DAEXAMPLE0004', 'main', T1, 1)] });
    await expect(row(page, 'DAEXAMPLE0001')).toContainText('Not logged yet: tick it to log it');
    await expect(row(page, 'DAEXAMPLE0001').locator('input[data-pick-group="canvalog"]')).toHaveCount(1);
    for (const id of ['DAEXAMPLE0002', 'DAEXAMPLE0004']) {
      await expect(row(page, id)).toContainText('Changed since it was logged: held');
      await expect(row(page, id).locator('input')).toHaveCount(0);
    }
    await expect(card(page).locator('input[data-pick-group="canvamove"]')).toHaveCount(0);
  });

  test('Log these writes one slip with the ledger columns plus surface, and the check values the bot repeats', async ({ page, guard }) => {
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });
    const uploads = await setup(page, guard, { dry: false, main: [item(1, { pages: 2 })], book: [item(3)] });
    await row(page, 'DAEXAMPLE0001').locator('input').check();
    await row(page, 'DAEXAMPLE0003').locator('input').check();
    const btn = card(page).locator('[data-action="canvalog"]');
    await btn.click();
    await expect.poll(() => page.evaluate(() => window.__GIS_CALLS.request)).toBeGreaterThan(1);
    await btn.click();
    await expect.poll(() => uploads.length).toBe(1);
    expect(dialogs).toHaveLength(1);
    const body = uploads[0];
    expect(body).toMatch(/"name":"AA_DELETE-LEDGER-ROWS_\d{4}-\d{2}-\d{2}-\d{4}_01\.csv"/);
    expect(body).toContain('"parents":["' + CV.folderId + '"]');
    expect(body).toContain('date,old_name,file_id,merged_into,agent,surface');
    expect(body).toMatch(/"ZZ_DELETE_Example design 1","DAEXAMPLE0001","[^"]*check: modified=2026-10-01T10:00:00\.000Z; pages=2","dashboard Canva card","canva-main"/);
    expect(body).toContain('"DAEXAMPLE0003"');
    expect(body).toContain('"canva-book"');
    expect(body).not.toContain('CANVA-BIN-REQUEST_');
  });

  test('Move to the bin folder: request file only with dry run off, a ticked logged design and a confirm', async ({ page, guard }) => {
    const dialogs = [];
    let answer = false;
    page.on('dialog', async (d) => { dialogs.push(d.message()); if (answer) await d.accept(); else await d.dismiss(); });
    const uploads = await setup(page, guard, { dry: false, main: [item(1)], rows: [slipRow('DAEXAMPLE0001', 'main', T1, 1)] });
    const btn = card(page).locator('[data-action="canvamove"]');
    await expect(btn).toBeDisabled();
    await row(page, 'DAEXAMPLE0001').locator('input[data-pick-group="canvamove"]').check();
    await btn.click();
    await expect.poll(() => page.evaluate(() => window.__GIS_CALLS.request)).toBeGreaterThan(1);
    await btn.click();
    await expect.poll(() => dialogs.length).toBe(1);
    expect(uploads).toEqual([]); // cancelled: nothing sent
    answer = true;
    await btn.click();
    await expect.poll(() => uploads.length).toBe(1);
    const body = uploads[0];
    expect(body).toMatch(/"name":"CANVA-BIN-REQUEST_\d{4}-\d{2}-\d{2}-\d{4}\.json"/);
    const json = JSON.parse(body.split('\r\n\r\n')[2].split('\r\n--')[0]);
    expect(json).toMatchObject({ kind: 'CANVA-BIN-REQUEST', action: 'move to ZZ_BIN', account: 'main', items: [{ design_id: 'DAEXAMPLE0001', last_modified: T1, pages: 1 }] });
    await expect(card(page).locator('[data-canva-result]')).toContainText('Asked the tidy bot to move 1');
    expect(guard.world.calls.filter((c) => c.method === 'PATCH')).toEqual([]);
  });

  test('Step 2 links: the account bin folder when the bot has made one, else Canva Projects', async ({ page, guard }) => {
    await setup(page, guard, { main: [item(1)], book: [item(3)] });
    await expect(card(page).locator('[data-canva-trash="main"]')).toHaveAttribute('href', 'https://www.canva.com/projects');
    await expect(card(page).locator('[data-canva-trash="book"]')).toHaveAttribute('href', 'https://www.canva.com/folder/FAEXAMPLEBIN1');
    await expect(card(page).locator('[data-canva-trash="main"]')).toContainText('Step 2: Trash in Canva (main)');
    await expect(card(page)).toContainText('Canva Trash keeps them 30 days. Only you empty it.');
  });

  test('no state file yet: says nothing is waiting, and the card has no buttons to press', async ({ page, guard }) => {
    await setup(page, guard, {});
    guard.world.byId('cv-state').trashed = true;
    await page.locator('[data-action="refresh"]').first().click();
    await page.locator('#needsNow [data-action="foldjump"][data-key="canva"]').click();
    await expect(card(page)).toContainText('No Canva list published yet. Nothing is waiting.');
    await expect(card(page).locator('[data-action="canvamove"]')).toHaveCount(0);
  });
});
