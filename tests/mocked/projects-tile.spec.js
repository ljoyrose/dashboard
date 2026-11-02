// Home: the Projects tile shows 3 numbers read from the Projects Hub Sheet (INDEX tab), and still opens the hub
// when they cannot be read. Rows are invented (tests/fixtures/projects-hub-index.json): Stuck 3, Waiting 2, Running 2.
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');

const INDEX = /^https:\/\/sheets\.googleapis\.com\/v4\/spreadsheets\/[^/]+\/values\/INDEX\?/;

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
    const tile = page.locator('#key-projects a.keytile').first();
    await expect(tile).toHaveId('ph-tile');
    await expect(tile).toHaveAttribute('href', IDS.projectsHub);
    await expect(tile).toHaveAttribute('target', '_blank');
    await expect(tile.locator('.phname')).toHaveText('Projects');
    await expect(tile.locator('.phname svg use')).toHaveAttribute('href', '#i-briefcase');
    await expect(tile.locator('.phn')).toHaveText(['3Stuck', '2Waiting', '2Running']);
    await expect(tile.locator('.phn').nth(0)).toHaveClass(/need/); // Stuck above 0 = rose
    await expect(tile.locator('.phn.need')).toHaveCount(1);
    // Only GET reads, each with the sign-in token, only to the INDEX tab.
    expect(calls.length).toBeGreaterThan(0);
    for (const c of calls) { expect(c.method).toBe('GET'); expect(c.auth).toBe(true); expect(c.url).toMatch(INDEX); }
    // Multi-colour line on the left, full height.
    const line = await tile.evaluate((el) => { const s = getComputedStyle(el, '::before'); return { bg: s.backgroundImage, top: s.top, bottom: s.bottom }; });
    expect(line.bg).toMatch(/linear-gradient/);
    expect([line.top, line.bottom]).toEqual(['0px', '0px']);
    // Phone: tap-sized, nothing sticks out sideways.
    const box = await tile.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('Stuck is not rose at 0', async ({ page }) => {
    await page.route(INDEX, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ values: [
      ['number', 'kind', 'owner_tag', 'status_u45', 'project_status'],
      ['0300', 'project', 'Yell', 'LIVE', 'Running'],
    ] }) }));
    await signIn(page);
    const tile = page.locator('#ph-tile');
    await expect(tile.locator('.phn')).toHaveText(['0Stuck', '0Waiting', '1Running']);
    await expect(tile.locator('.phn.need')).toHaveCount(0);
  });

  test('read fails: the tile still shows, still opens the hub, numbers show a dash', async ({ page, allowedConsole }) => {
    allowedConsole.push(/403|Failed to load resource/);
    await page.route(INDEX, (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { code: 403, message: 'The caller does not have permission', status: 'PERMISSION_DENIED' } }) }));
    await signIn(page);
    const tile = page.locator('#ph-tile');
    await expect(tile).toBeVisible();
    await expect(tile).toHaveAttribute('href', IDS.projectsHub);
    await expect(tile.locator('.phnums')).toHaveAttribute('data-ph', 'failed');
    await expect(tile.locator('.phn b')).toHaveText(['–', '–', '–']);
    await expect(tile).toHaveAttribute('title', /could not be read/);
  });
});
