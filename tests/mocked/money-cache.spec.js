// Money downloads only the files that changed since the last read (memory-only cache keyed by Drive's
// modifiedTime), and a whole refresh stays inside a fixed budget of Drive calls.
const { test, expect } = require('../support/test');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const downloads = (calls) => calls.filter((c) => /alt=media|\/export/.test(c.url)).length;
const reread = async (page, guard) => {
  const before = guard.world.calls.filter((c) => c.path === '/about').length;
  await page.locator('#refreshBtn').click();
  await expect.poll(() => guard.world.calls.filter((c) => c.path === '/about').length).toBe(before + 1);
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};

// Upper limits for one full read of the sample Money drive. If a change makes the page ask Drive for
// much more, this fails, so the extra calls are a decision and not an accident.
const FIRST_READ_MAX = 40; // today: 27 calls, 21 of them downloads
const REREAD_MAX = 8; // today: 6 (about + 4 folder lists + 1 ledger search), and no downloads

test.describe('Money: only changed files are downloaded again', () => {
  test('Reread with nothing changed downloads no file at all, and stays inside the Drive call budget @regression', async ({ page, guard }) => {
    await page.goto('money/');
    await signIn(page);
    const first = guard.world.calls.slice();
    expect(downloads(first)).toBeGreaterThan(5);
    expect(first.length, 'Drive calls on the first read').toBeLessThanOrEqual(FIRST_READ_MAX);

    const mark = guard.world.calls.length;
    await reread(page, guard);
    const second = guard.world.calls.slice(mark);
    if (process.env.MEASURE) console.log('BUDGET first', first.length, downloads(first), 'second', second.length);
    expect(downloads(second), 'files downloaded again with nothing changed').toBe(0);
    expect(second.length, 'Drive calls on a reread').toBeLessThanOrEqual(REREAD_MAX);
    await expect(page.locator('#view')).toContainText('£'); // figures still on screen, from the memory copy
  });

  test('a file whose modifiedTime changed is downloaded again, and only that one', async ({ page, guard }) => {
    await page.goto('money/#/money');
    await signIn(page);
    const f = guard.world.files.find((x) => x.name === 'BALANCES.csv');
    expect(f, 'sample BALANCES.csv').toBeTruthy();
    f.modifiedTime = new Date(Date.now() + 1000).toISOString();
    const mark = guard.world.calls.length;
    await reread(page, guard);
    const got = guard.world.calls.slice(mark).filter((c) => /alt=media|\/export/.test(c.url));
    expect(got.length).toBe(1);
    expect(got[0].path).toBe('/files/' + f.id);
  });

  test('signing out forgets the memory copy, so the next sign-in downloads everything again', async ({ page, guard }) => {
    await page.goto('money/');
    await signIn(page);
    const firstDownloads = downloads(guard.world.calls);
    await page.locator('#signOutBtn').click();
    await expect(page.locator('#readStamp')).toHaveText('Not signed in');
    const mark = guard.world.calls.length;
    await signIn(page);
    expect(downloads(guard.world.calls.slice(mark))).toBe(firstDownloads);
  });

  test('nothing from Drive is written to the browser storage', async ({ page }) => {
    await page.goto('money/');
    await signIn(page);
    await page.locator('#refreshBtn').click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
    const stored = await page.evaluate(() => JSON.stringify({ l: Object.keys(localStorage), s: Object.keys(sessionStorage).map((k) => [k, sessionStorage.getItem(k).length]) }));
    expect(stored).not.toMatch(/BALANCES|CASHFLOW|MON-/);
  });
});
