// Chip and occupancy saves must write the file the folder listing already found
// (the same names the page reads). A missing name, a doubled name, or a failed
// read stops the save. Pretend Drive only. Invented rows. No real file ids.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');

const SHEET = 'application/vnd.google-apps.spreadsheet';
const CHIP = 'BLD-microchip.csv';
const OCC = 'BLD-occupancy.csv';
const CHIP_HEADER = 'id,subject_id,chip_number,source\n';
const ROOT = path.resolve(__dirname, '..', '..');

const live = (world, name) => world.files.find((f) => f.name === name && !f.trashed && (f.parents || []).includes(IDS.bld));

async function signIn(page) {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#livepill')).not.toHaveText('signed out');
}

function watchWrites(page, bag) {
  return Promise.all([
    page.route(/https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\/[^/]+\/values\/A1:append/, (route) => {
      bag.push({ kind: 'sheet', url: route.request().url(), body: route.request().postData() || '' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"updates":{"updatedRows":1}}' });
    }),
    page.route(/https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\/[^?]+/, (route) => {
      bag.push({ kind: 'upload', url: route.request().url(), body: route.request().postData() || '' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"ok"}' });
    }),
  ]);
}

function plantSentinels(page) {
  return page.evaluate(() => {
    window.DASH_CONFIG.cdhub.microchipFileId = 'SENTINEL-CHIP';
    window.DASH_CONFIG.cdhub.occupancyFileId = 'SENTINEL-OCC';
  });
}

function runSave(page, which) {
  return page.evaluate(async (which) => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    if (which === 'chip') await saveChip('sub-test-dog-1', 'sub-test-dog-1', '123456789012345', btn);
    else await saveArea('sub-test-dog-1', 'sub-test-dog-1', 'area-1', btn);
    return { text: btn.textContent, disabled: btn.disabled };
  }, which);
}

test('saveChip and saveArea write the folder file and refuse when it is missing @regression', async ({ page, guard }) => {
  const pageSrc = fs.readFileSync(path.join(ROOT, 'cdhub/index.html'), 'utf8');
  const configSrc = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');
  expect(pageSrc + configSrc).not.toMatch(/microchipFileId|occupancyFileId/);

  const occ = live(guard.world, OCC);
  occ.mimeType = SHEET;
  occ.content = 'id,subject_id,area_id,source\n';
  guard.world.file('bld-chip-live', CHIP, CHIP_HEADER, { parents: [IDS.bld], driveId: 'drv-alpha1', mimeType: SHEET });

  const writes = [];
  await watchWrites(page, writes);
  await page.goto('cdhub/');
  await signIn(page);
  await expect(page.locator('#livepill')).toContainText('live');
  await plantSentinels(page);

  const chipMark = guard.world.calls.length;
  const chip = await runSave(page, 'chip');
  expect(chip).toEqual({ text: 'saved ✓', disabled: true });
  expect(writes).toHaveLength(1);
  expect(writes[0].kind).toBe('sheet');
  expect(writes[0].url).toContain('/spreadsheets/bld-chip-live/values/A1:append');
  expect(writes[0].url).not.toContain('SENTINEL');
  expect(JSON.parse(writes[0].body).values).toEqual([['mc-test-dog-1', 'sub-test-dog-1', '123456789012345', 'dashboard']]);
  const chipReads = guard.world.calls.slice(chipMark).filter((c) => c.path.indexOf('/files/bld-chip-live') === 0);
  expect(chipReads.some((c) => c.path === '/files/bld-chip-live/export')).toBe(true);
  expect(chipReads.some((c) => /alt=media/.test(c.url))).toBe(false);

  const areaMark = guard.world.calls.length;
  const area = await runSave(page, 'area');
  expect(area).toEqual({ text: 'saved ✓', disabled: true });
  expect(writes).toHaveLength(2);
  expect(writes[1].kind).toBe('sheet');
  expect(writes[1].url).toContain('/spreadsheets/' + occ.id + '/values/A1:append');
  expect(writes[1].url).not.toContain('SENTINEL');
  expect(JSON.parse(writes[1].body).values).toEqual([['occ-test-dog-1', 'sub-test-dog-1', 'area-1', 'dashboard']]);
  const areaReads = guard.world.calls.slice(areaMark).filter((c) => c.path.indexOf('/files/' + occ.id) === 0);
  expect(areaReads.some((c) => c.path === '/files/' + occ.id + '/export')).toBe(true);
  expect(areaReads.some((c) => /alt=media/.test(c.url))).toBe(false);

  const n = writes.length;
  const missing = await page.evaluate(async () => {
    window._driveFiles = window._driveFiles.filter((f) => f.name !== 'BLD-microchip.csv' && f.name !== 'BLD-occupancy.csv');
    const chipBtn = document.createElement('button');
    const areaBtn = document.createElement('button');
    await saveChip('sub-test-dog-1', 'sub-test-dog-1', '123456789012345', chipBtn);
    await saveArea('sub-test-dog-1', 'sub-test-dog-1', 'area-9', areaBtn);
    return {
      chip: chipBtn.textContent,
      area: areaBtn.textContent,
      chipOn: chipBtn.disabled,
      areaOn: areaBtn.disabled,
    };
  });
  expect(missing.chip).toBe('Not saved: the microchip list is not in the folder.');
  expect(missing.area).toBe('Not saved: the occupancy list is not in the folder.');
  expect(missing.chipOn).toBe(false);
  expect(missing.areaOn).toBe(false);
  expect(writes).toHaveLength(n);
});

test('two copies of a list are not a save', async ({ page, guard }) => {
  const occ = live(guard.world, OCC);
  guard.world.file('bld-occ-twin', OCC, occ.content, { parents: occ.parents.slice(), driveId: occ.driveId, mimeType: SHEET });
  const writes = [];
  await watchWrites(page, writes);
  await page.goto('cdhub/');
  await signIn(page);
  await expect(page.locator('#livepill')).toHaveText('duplicate file titles');
  await plantSentinels(page);
  const area = await runSave(page, 'area');
  expect(area.text).toBe('Not saved: more than one occupancy list is in the folder.');
  expect(area.disabled).toBe(false);
  expect(writes).toEqual([]);
});

test('a listed file that cannot be read is not written', async ({ page, guard }) => {
  guard.world.file('bld-chip-live', CHIP, CHIP_HEADER, { parents: [IDS.bld], driveId: 'drv-alpha1', mimeType: SHEET });
  const writes = [];
  await watchWrites(page, writes);
  await page.goto('cdhub/');
  await signIn(page);
  guard.world.files = guard.world.files.filter((f) => f.id !== 'bld-chip-live');
  await plantSentinels(page);
  const chip = await runSave(page, 'chip');
  expect(chip.text).toBe('Not saved: the microchip list could not be read.');
  expect(chip.disabled).toBe(false);
  expect(writes).toEqual([]);
});

test('a csv occupancy file is updated at the id the folder listed', async ({ page, guard }) => {
  const occ = live(guard.world, OCC);
  expect(occ.mimeType).toBe('text/csv');
  const writes = [];
  await watchWrites(page, writes);
  await page.goto('cdhub/');
  await signIn(page);
  await plantSentinels(page);
  const mark = guard.world.calls.length;
  const area = await runSave(page, 'area');
  expect(area).toEqual({ text: 'saved ✓', disabled: true });
  expect(writes).toHaveLength(1);
  expect(writes[0].kind).toBe('upload');
  expect(writes[0].url).toContain('/files/' + encodeURIComponent(occ.id) + '?uploadType=multipart');
  expect(writes[0].url).not.toContain('SENTINEL');
  expect(writes[0].body).toContain('sub-test-dog-1,area-1,,');
  const reads = guard.world.calls.slice(mark).filter((c) => c.path === '/files/' + occ.id);
  expect(reads.some((c) => /alt=media/.test(c.url))).toBe(true);
  expect(guard.world.calls.slice(mark).some((c) => c.path === '/files/' + occ.id + '/export')).toBe(false);
});

test('a sheet update that is refused is not tried again on another id', async ({ page, guard }) => {
  guard.world.file('bld-chip-live', CHIP, CHIP_HEADER, { parents: [IDS.bld], driveId: 'drv-alpha1', mimeType: SHEET });
  const writes = [];
  await page.route(/https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\/[^/]+\/values\/A1:append/, (route) => {
    writes.push(route.request().url());
    return route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":{"code":403,"message":"refused"}}' });
  });
  await page.goto('cdhub/');
  await signIn(page);
  await plantSentinels(page);
  const chip = await runSave(page, 'chip');
  expect(chip.text).toBe('Not saved: the microchip list could not be updated.');
  expect(chip.disabled).toBe(false);
  expect(writes).toEqual(['https://sheets.googleapis.com/v4/spreadsheets/bld-chip-live/values/A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS']);
});
