// Home: the Projects tile shows 3 numbers read from the Projects Hub Sheet (INDEX tab), and still opens the hub
// when they cannot be read. Rows are invented (tests/fixtures/projects-hub-index.json): Stuck 3, Waiting 2, Running 2.
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');

const INDEX = /^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\/[^/]+\/values\/INDEX\?/;
// The Projects Hub Sheet's ID, from config.js (the other hub tiles read their own Sheets too, so calls are told apart by Sheet).
const PH_SHEET = (require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'config.js'), 'utf8').match(/projectsHub:\s*\{\s*sheetId:\s*'([^']+)'/) || [])[1];
const TILE = '#hubTiles .hubtile[data-hub="projects"]';

async function signIn(page) {
  await page.goto('./');
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
}

test.describe('Home: Projects tile numbers', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.skip(!IDS.projectsHub, 'config.js has no Projects Hub address');

  test('first tile: briefcase, name, Stuck · Waiting · Running from the hub Sheet, read only', async ({ page }) => {
    const calls = [];
    page.on('request', (r) => { if (/sheets\.googleapis\.com/.test(r.url())) calls.push({ method: r.method(), url: r.url(), auth: /^Bearer \S+/.test(r.headers().authorization || '') }); });
    await signIn(page);
    const tile = page.locator(TILE);
    await expect(page.locator('#hubTiles .hubtile').first()).toHaveAttribute('data-hub', 'projects');
    const go = tile.locator('a.hgo');
    await expect(go).toHaveAttribute('href', IDS.projectsHub);
    await expect(go).toHaveAttribute('target', '_blank');
    await expect(go).toHaveText('Projects');
    await expect(go.locator('svg use')).toHaveAttribute('href', '#i-briefcase');
    const nums = tile.locator('a.hk');
    await expect(nums).toHaveText(['3Stuck', '2Waiting', '2Running']);
    for (const a of await nums.all()) { await expect(a).toHaveAttribute('href', IDS.projectsHub); await expect(a).toHaveAttribute('target', '_blank'); }
    await expect(nums.nth(0).locator('b.need')).toHaveCount(1); // Stuck above 0 = rose
    await expect(tile.locator('b.need')).toHaveCount(1);
    // Only GET reads, each with the sign-in token; the Projects Hub Sheet is read only at its INDEX tab.
    expect(PH_SHEET).toBeTruthy();
    const ph = calls.filter((c) => c.url.includes('/spreadsheets/' + PH_SHEET + '/'));
    expect(ph.length).toBeGreaterThan(0);
    for (const c of calls) { expect(c.method).toBe('GET'); expect(c.auth).toBe(true); }
    for (const c of ph) expect(c.url).toMatch(INDEX);
    // Multi-colour line on the left, full height: placed exactly like every other tile's house line (over the 1px card border).
    const edge = (el) => { const s = getComputedStyle(el, '::before'); return { bg: s.backgroundImage, top: s.top, bottom: s.bottom }; };
    const line = await tile.evaluate(edge);
    const web = await page.locator('#hubTiles .hubtile[data-hub="web"]').evaluate(edge);
    expect(line.bg).toMatch(/linear-gradient/);
    expect([line.top, line.bottom]).toEqual([web.top, web.bottom]);
    expect(['0px', '-1px']).toContain(line.top);
    expect(line.bottom).toBe(line.top);
    // Phone: tap-sized, nothing sticks out sideways.
    const box = await tile.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(48);
    for (const a of await nums.all()) expect((await a.boundingBox()).height).toBeGreaterThanOrEqual(24);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('Stuck is not rose at 0', async ({ page }) => {
    await page.route(INDEX, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: [
      ['number', 'kind', 'owner_tag', 'status_u45', 'project_status'],
      ['0300', 'project', 'Yell', 'LIVE', 'Running'],
    ] }) }));
    await signIn(page);
    const tile = page.locator(TILE);
    await expect(tile.locator('a.hk')).toHaveText(['0Stuck', '0Waiting', '1Running']);
    await expect(tile.locator('b.need')).toHaveCount(0);
  });

  test('read fails: the tile still shows, still opens the hub, numbers show a dash', async ({ page, allowedConsole }) => {
    allowedConsole.push(/403|Failed to load resource/);
    await page.route(INDEX, (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { code: 403, message: 'The caller does not have permission', status: 'PERMISSION_DENIED' } }) }));
    await signIn(page);
    const tile = page.locator(TILE);
    await expect(tile).toBeVisible();
    await expect(tile.locator('a.hgo')).toHaveAttribute('href', IDS.projectsHub);
    await expect(tile.locator('.hks')).toHaveAttribute('data-ph', 'failed');
    await expect(tile.locator('a.hk b')).toHaveText(['–', '–', '–']);
    for (const a of await tile.locator('a.hk').all()) await expect(a).toHaveAttribute('href', IDS.projectsHub);
    await expect(tile.locator('a.hgo')).toHaveAttribute('title', /could not be read/);
  });
});
