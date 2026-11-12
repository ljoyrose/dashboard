// Temperature history indoor areas: BLD-area_reading.csv may be a Google Sheet.
// A spreadsheet is exported as CSV. A real CSV file is still read with alt=media.
// The outdoor readings sheet (config.js) keeps its own export addresses.
// Pretend Drive only. Every row here is invented. No real Drive file ids.
const { test, expect } = require('../support/test');

const SHEET = 'application/vnd.google-apps.spreadsheet';
const READ = 'https://www.googleapis.com/auth/drive.readonly';
const OUTDOOR = [
  'on_date,reading_kind,max_temp,min_temp,realfeel_max_temp,rain_value,cloud_cover_pct,wind_kmh',
  '2026-01-15,sample,12.0,4.0,11.0,0,40,8',
].join('\n');

const live = (world, name) => world.files.find((f) => f.name === name && !f.trashed);
const readsOf = (world, id) => world.calls.filter((c) => c.path === '/files/' + id || c.path === '/files/' + id + '/export');
const isExport = (c) => c.path.endsWith('/export') && /(?:\?|&)mimeType=text%2Fcsv(?:&|$)/.test(c.url);
const isMedia = (c) => c.path.indexOf('/export') === -1 && /(?:\?|&)alt=media(?:&|$)/.test(c.url);

// A trashed Sheet with the same title, and a ZZ_DELETE_ twin, must never be the file that is read.
function plantTwins(world) {
  const src = live(world, 'BLD-area_reading.csv');
  world.file('bld-reading-trashed', 'BLD-area_reading.csv',
    'id,area_id,taken_at,min_c,max_c\nrdg-x,area-x,2026-01-15T08:00,NOT-A-READING,NOT-A-READING\n',
    { parents: src.parents.slice(), driveId: src.driveId, mimeType: SHEET, trashed: true });
  world.file('bld-reading-zz', 'ZZ_DELETE_BLD-area_reading.csv',
    'id,area_id\nZZ-TWIN-NOT-READ,area-z\n',
    { parents: src.parents.slice(), driveId: src.driveId, mimeType: SHEET });
  const trashed = world.byId('bld-reading-trashed');
  world.files = [trashed].concat(world.files.filter((f) => f !== trashed));
}

async function openHistory(page) {
  await page.addInitScript((scope) => {
    localStorage.setItem('ljr-dash-auth', JSON.stringify({
      access_token: 'FAKE-TEST-TOKEN',
      expires_at: Date.now() + 30 * 60 * 1000,
      scope: scope,
    }));
  }, READ);
  await page.route(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export\?/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/csv', body: OUTDOOR }));
  const seen = [];
  page.on('request', (req) => seen.push(req.url()));
  await page.goto('cdhub/history.html');
  await expect(page.locator('#livepill')).toHaveText('Up to date');
  return seen;
}

async function showRound(page) {
  await page.getByRole('button', { name: 'The round' }).click();
  await page.locator('#rdate').fill('2026-01-15');
  await page.locator('#rdate').dispatchEvent('change');
  await expect(page.locator('#view-d')).toContainText('Test Cabin A');
  await expect(page.locator('#view-d')).toContainText('8.5');
  await expect(page.locator('#view-d')).toContainText('28.5');
  await expect(page.locator('#view-d')).not.toContainText('8.50');
  await expect(page.locator('#view-d')).toContainText('Test Cabin B');
  await expect(page.locator('#view-d')).not.toContainText('NOT-A-READING');
  await expect(page.locator('#view-d')).not.toContainText('ZZ-TWIN-NOT-READ');
}

function expectListed(world, name) {
  const lists = world.calls.filter((c) => c.path === '/files' && c.query.includes("name='" + name + "'"));
  expect(lists.length).toBeGreaterThan(0);
  for (const c of lists) {
    expect(c.url).toContain('fields=files(id,name,mimeType)');
    expect(c.query).toContain('trashed=false');
  }
}

test.describe('Temperature history reads area files by mime type', () => {
  test('a Google Sheet titled BLD-area_reading.csv is exported as CSV; the rooms CSV stays alt=media', async ({ page, guard }) => {
    plantTwins(guard.world);
    const reading = live(guard.world, 'BLD-area_reading.csv');
    const rooms = live(guard.world, 'BLD-area.csv');
    reading.mimeType = SHEET;
    const seen = await openHistory(page);
    await showRound(page);

    expectListed(guard.world, 'BLD-area_reading.csv');
    expectListed(guard.world, 'BLD-area.csv');
    const sheetReads = readsOf(guard.world, reading.id);
    expect(sheetReads.filter(isExport)).toHaveLength(1);
    expect(sheetReads.filter(isMedia)).toHaveLength(0);
    const roomReads = readsOf(guard.world, rooms.id);
    expect(roomReads.filter(isMedia)).toHaveLength(1);
    expect(roomReads.filter(isExport)).toHaveLength(0);
    expect(readsOf(guard.world, 'bld-reading-trashed')).toEqual([]);
    expect(readsOf(guard.world, 'bld-reading-zz')).toEqual([]);

    const outdoor = await page.evaluate(() => ({
      exportUrl: EXPORT_URL,
      driveExport: DRIVE_EXPORT,
      sheet: window.DASH_CONFIG.cdhub.readingsSheetId,
    }));
    expect(outdoor.exportUrl).toBe('https://docs.google.com/spreadsheets/d/' + outdoor.sheet + '/export?format=csv&sheet=readings');
    expect(outdoor.driveExport).toBe('https://www.googleapis.com/drive/v3/files/' + outdoor.sheet + '/export?mimeType=text%2Fcsv');
    expect(seen.filter((u) => u.includes('/export?format=csv&sheet=readings'))).toHaveLength(1);
    expect(seen.some((u) => u.indexOf('/drive/v3/files/' + outdoor.sheet + '/export') !== -1)).toBe(false);
  });

  test('a plain text/csv BLD-area_reading.csv is read with alt=media, not export', async ({ page, guard }) => {
    plantTwins(guard.world);
    const reading = live(guard.world, 'BLD-area_reading.csv');
    expect(reading.mimeType).toBe('text/csv');
    await openHistory(page);
    await showRound(page);

    const sheetReads = readsOf(guard.world, reading.id);
    expect(sheetReads.filter(isMedia)).toHaveLength(1);
    expect(sheetReads.filter(isExport)).toHaveLength(0);
    expect(readsOf(guard.world, 'bld-reading-trashed').filter(isExport)).toHaveLength(0);
    expect(readsOf(guard.world, 'bld-reading-zz')).toEqual([]);
  });

  test('the history page keeps the house look', async ({ page }) => {
    await openHistory(page);
    const look = await page.evaluate(() => {
      const links = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href'));
      const header = document.querySelector('header.top');
      const home = header.querySelector('a.btn.house-ib');
      const hs = getComputedStyle(home);
      const box = home.getBoundingClientRect();
      return {
        links,
        houseHead: header.classList.contains('house-head'),
        title: document.querySelector('h1').textContent,
        font: getComputedStyle(document.body).fontFamily,
        radius: hs.borderTopLeftRadius,
        border: hs.borderTopWidth,
        w: box.width,
        h: box.height,
        headH: getComputedStyle(header).height,
        headToken: getComputedStyle(document.documentElement).getPropertyValue('--house-head').trim(),
        frame: getComputedStyle(header).backgroundColor,
      };
    });
    const tokens = look.links.indexOf('../tokens.css');
    const house = look.links.indexOf('../house.css');
    expect(tokens).toBeGreaterThan(-1);
    expect(house).toBeGreaterThan(tokens);
    expect(look.houseHead).toBe(true);
    expect(look.title).toBe('Temperatures');
    expect(look.title.toLowerCase().startsWith('outdoor')).toBe(false);
    expect(look.font.toLowerCase()).toContain('lexend');
    expect(look.radius).toBe('12px');
    expect(look.border).toBe('1px');
    expect(look.w).toBe(36);
    expect(look.h).toBe(36);
    expect(look.headH).toBe(look.headToken);
    expect(look.frame).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('year chips run current first, and a day detail does not show Source or the reading kind @regression', async ({ page }) => {
    await openHistory(page);
    const years = page.locator('.yr-btn');
    await expect(years).toHaveText(['2026', '2025', '2024']);
    await expect(years.first()).toHaveClass(/on/);
    await expect(page.locator('#view-a .mn').first()).toHaveText('Jan');
    await years.nth(2).click();
    await expect(years.nth(2)).toHaveClass(/on/);
    await expect(years.first()).not.toHaveClass(/on/);
    await years.first().click();
    await expect(years.first()).toHaveClass(/on/);
    await page.getByRole('button', { name: 'Heat map' }).click();
    await page.locator('button.dout[title*="15 Jan 2026"]').click();
    const drill = page.locator('#drill');
    await expect(drill).toBeVisible();
    await expect(drill.locator('#d-out')).toHaveText('12 / 4 °C, rain 0 mm');
    await expect(drill.locator('#d-src')).toHaveCount(0);
    await expect(drill.locator('#d-sub')).toHaveCount(0);
    await expect(drill).not.toContainText(/source/i);
    await expect(drill).not.toContainText(/\bactual/i);
    await expect(drill).not.toContainText('sample');
  });

  test('Archive opens its own page and does not read another sheet', async ({ page, guard }) => {
    await openHistory(page);
    const before = guard.world.calls.length;
    const extra = [];
    page.on('request', (req) => extra.push(req.url()));
    await page.getByRole('link', { name: 'Archive' }).click();
    await expect(page).toHaveURL(/\/history-archive\.html$/);
    await expect(page.locator('h1')).toHaveText('Temperature archive');
    await expect(page.locator('#main')).toContainText('Older years live on Archive.');
    await expect(page.locator('body')).not.toContainText(/source|actual/i);
    expect(extra.filter((u) => /spreadsheets|\/drive\/v3\//i.test(u))).toEqual([]);
    expect(guard.world.calls.length).toBe(before);
    await page.getByRole('link', { name: 'Temperatures', exact: true }).click();
    await expect(page).toHaveURL(/\/history\.html$/);
    await expect(page.locator('.yr-btn').first()).toHaveText('2026');
  });

  test('The round opens first with tiles, then a condensed °C table in BLD-area order (group_sort, then code; a retired room last, labelled)', async ({ page, guard }) => {
    const put = (name, content) => {
      const f = guard.world.files.find((x) => x.name === name);
      f.content = content;
      f.size = String(content.length);
    };
    put('BLD-area.csv', 'id,code,group_sort\narea-h2,H2,1\narea-h1,H1,1\narea-tr,3TR,3\narea-4,4A,4\narea-z,Test Cabin Z,\narea-old,3S.2-iso,3\narea-gone,H4,1\n');
    const a0 = live(guard.world, 'BLD-area.csv');
    guard.world.file('bld-req', 'BLD-requirement.csv', 'id,tenant_id,need_type,target_table,target_id,from_date,to_date,source,set_by,set_on\nreq-1,t,room.in_use,area,area-old,2025-01-01,2026-01-15,,,\nreq-2,t,room.in_use,area,area-gone,2025-01-01,2025-12-31,,,\n',
      { parents: a0.parents.slice(), driveId: a0.driveId, mimeType: 'text/csv' });
    put('BLD-area_reading.csv', [
      'id,area_id,taken_at,min_c,max_c',
      'a,area-h1,2026-01-15T08:00,8.24,14.0',
      'b,area-h2,2026-01-15T08:00,11.0,16.0',
      'c,area-tr,2026-01-15T18:00,20,28.55',
      'd,area-4,2026-01-15T08:00,12,18',
      'e,area-old,2026-01-15T08:00,12,18',
    ].join('\n') + '\n');
    await openHistory(page);
    await expect(page.locator('h1')).toHaveText('Temperatures');
    await expect(page).toHaveTitle(/^Temperatures/);
    await expect(page.locator('#main')).not.toContainText('Outdoor temperature history');
    await expect(page.locator('#main')).not.toContainText('Dinas');
    await expect(page.locator('#livepill')).not.toContainText(/day/);
    await expect(page.locator('.tab').first()).toHaveText('The round');
    await expect(page.locator('.tab').first()).toHaveClass(/on/);
    await expect(page.locator('#view-d')).toBeVisible();
    await page.locator('#rdate').fill('2026-01-15');
    await page.locator('#rdate').dispatchEvent('change');
    const round = page.locator('#view-d');
    // A room in use with no readings at all (Test Cabin Z) is still listed, and shows its missed slots (the audit).
    await expect(round.locator('.rtile .rn')).toHaveText(['H1', 'H2', '3TR', '4A', 'Test Cabin Z', '3S.2-iso (retired 15/01/26)']);
    await expect(round.locator('.rtile', { hasText: 'Test Cabin Z' })).toContainText('AM missed');
    await expect(round.locator('.rtile', { hasText: 'Test Cabin Z' })).toContainText('PM missed');
    await expect(round.locator('.rtable th')).toHaveText(['Room', 'AM min', 'AM max', 'PM min', 'PM max']);
    await expect(round.locator('.rtile').first()).toContainText('AM 8.2–14.0');
    await expect(round.locator('.rtile').first().locator('.warn').first()).toContainText('AM 8.2–14.0');
    await expect(round.locator('.rtile').first()).toContainText('PM missed');
    await expect(round).not.toContainText(/Submitted|In range|Out of range|\bOK\b/);
    const pad = await round.locator('.rtable td').first().evaluate((e) => parseFloat(getComputedStyle(e).paddingTop));
    expect(pad).toBeLessThanOrEqual(4);
    await expect(round.locator('h3').nth(0)).toHaveText('Indoors °C');
    await expect(round.locator('h3').nth(1)).toHaveText('Outside');
    const tileBox = await round.locator('.rtile').first().boundingBox();
    const tableBox = await round.locator('.rtable').boundingBox();
    expect(tileBox.y).toBeLessThan(tableBox.y);
    await expect(round).not.toContainText(/\bactual/i);
    await expect(round).not.toContainText(/source/i);
    await page.getByRole('button', { name: 'Month cards' }).click();
    await expect(page.locator('#view-c')).toContainText('outside');
    await expect(page.locator('#view-c')).toContainText('High');
    await expect(page.locator('#view-c')).toContainText('missed');
    await expect(page.locator('#view-c')).not.toContainText('cold days');
  });

  test('Lisa 11 Nov (A standard): a place is only due on days its need rows cover; never missed outside them', async ({ page, guard }) => {
    const put = (name, content) => {
      const f = guard.world.files.find((x) => x.name === name);
      f.content = content;
      f.size = String(content.length);
    };
    const area = live(guard.world, 'BLD-area.csv');
    put('BLD-area.csv', 'id,code,group_sort\narea-old,3A.2-3,2\narea-new,3A.1/2,2\narea-f,Field 1,9\n');
    guard.world.file('bld-thermo', 'BLD-thermometer.csv', 'id,tenant_id,name,area_id,made_at,made_by\nthm-1,t,3A.2/3,area-old,,\nthm-2,t,3A.1/2,area-new,,\n',
      { parents: area.parents.slice(), driveId: area.driveId, mimeType: 'text/csv' });
    guard.world.file('bld-req', 'BLD-requirement.csv', 'id,tenant_id,need_type,target_table,target_id,from_date,to_date,source,set_by,set_on\nr1,t,reading.temperature,thermometer,thm-1,2025-01-01,2026-01-15,,,\nr2,t,reading.temperature,thermometer,thm-2,2026-01-16,,,,\nr3,t,room.in_use,area,area-old,2025-01-01,2026-01-15,,,\n',
      { parents: area.parents.slice(), driveId: area.driveId, mimeType: 'text/csv' });
    put('BLD-area_reading.csv', 'id,area_id,taken_at,min_c,max_c\na,area-old,2026-01-15T08:00,12,18\n');
    await openHistory(page);
    const round = page.locator('#view-d');
    for (const [day, names] of [['2026-01-15', ['3A.2-3 (retired 15/01/26)']], ['2026-01-16', ['3A.1/2']]]) {
      await page.locator('#rdate').fill(day);
      await page.locator('#rdate').dispatchEvent('change');
      await expect(round.locator('.rtile .rn')).toHaveText(names);
    }
    await expect(round).not.toContainText('Field 1');
  });

  test('Lisa 11 Nov: an earlier reading typed on a later day shows on its own day (period_start), even for an ended thermometer', async ({ page, guard }) => {
    const put = (name, content) => {
      const f = guard.world.files.find((x) => x.name === name);
      f.content = content;
      f.size = String(content.length);
    };
    const area = live(guard.world, 'BLD-area.csv');
    put('BLD-area.csv', 'id,code,group_sort\narea-old,3A.2-3,2\narea-new,3A.1/2,2\n');
    guard.world.file('bld-thermo', 'BLD-thermometer.csv', 'id,tenant_id,name,area_id,made_at,made_by\nthm-1,t,3A.2/3,area-old,,\nthm-2,t,3A.1/2,area-new,,\n',
      { parents: area.parents.slice(), driveId: area.driveId, mimeType: 'text/csv' });
    guard.world.file('bld-req', 'BLD-requirement.csv', 'id,tenant_id,need_type,target_table,target_id,from_date,to_date,source,set_by,set_on\nr1,t,reading.temperature,thermometer,thm-1,2025-01-01,2026-01-11,,,\nr2,t,reading.temperature,thermometer,thm-2,2026-01-12,,,,\nr3,t,room.in_use,area,area-old,2025-01-01,2026-01-11,,,\n',
      { parents: area.parents.slice(), driveId: area.driveId, mimeType: 'text/csv' });
    put('BLD-area_reading.csv', 'id,area_id,taken_at,period_start,min_c,max_c,read_method,camera_value_changed\na,area-old,2026-01-12T09:00:00Z,2026-01-10T00:00:00+00:00,12.0,18.5,photo,\n');
    await openHistory(page);
    const round = page.locator('#view-d');
    await page.locator('#rdate').fill('2026-01-10');
    await page.locator('#rdate').dispatchEvent('change');
    await expect(round.locator('.rtile .rn')).toHaveText(['3A.2-3 (retired 11/01/26)']);
    await expect(round.locator('.rtile').first()).toContainText('18.5');
    await expect(page.locator('body')).not.toContainText(/camera|typed|photo/i);   // how a reading was taken is saved only (Lisa, 11 Nov)
    await page.locator('#rdate').fill('2026-01-12');
    await page.locator('#rdate').dispatchEvent('change');
    await expect(round.locator('.rtile .rn')).toHaveText(['3A.1/2']);
  });
});
