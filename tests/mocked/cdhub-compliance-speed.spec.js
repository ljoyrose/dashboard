// Compliance speed (the owner 22 Nov 2026: "opens very slowly, unusable").
// - Every file is read through ONE queue (READ_AT_ONCE at a time): the later files start while first-screen files are still reading.
// - A file whose Drive modifiedTime is unchanged since the last read on this device is not read again (the folder list is always live).
// - Compliance shows a read up to 5 minutes old at once, always with "As of <time>" and Refresh; older waits for the live read.
const { test, expect } = require('../support/test');

const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};
const fullRead = async (page) => {
  await page.waitForFunction(() => window.LOAD && LOAD.state === 'ok' && LOAD.later === 'ok' && !LOAD.copy && !READING);
  await expect.poll(() => page.evaluate(async () => !!((await copyGet()) || {}).mod)).toBe(true);
};
// every Drive file read (not the folder list): name, start and end in ms
async function watchReads(page, world, delay) {
  const reads = [];
  let lists = 0;
  const t0 = Date.now();
  await page.route((u) => u.hostname === 'www.googleapis.com' && u.pathname.startsWith('/drive/v3/files'), async (route) => {
    const u = new URL(route.request().url());
    const m = /\/files\/([^/]+)/.exec(u.pathname);
    if (!m) { lists++; return route.fallback(); }
    const f = world.files.find((x) => x.id === decodeURIComponent(m[1]));
    const r = { name: f ? f.name : m[1], s: Date.now() - t0, e: 0 };
    reads.push(r);
    if (delay) await new Promise((res) => setTimeout(res, delay));
    r.e = Date.now() - t0;
    return route.fallback();
  });
  return { reads, lists: () => lists };
}
const openCompliance = (page) => page.evaluate(() => { location.hash = '#/compliance'; });

test.describe('CD Hub: Compliance speed', () => {
  test('reads run in parallel: later files start before the first-screen files have all finished', async ({ page, guard }) => {
    const w = await watchReads(page, guard.world, 120);
    await page.goto('cdhub/');
    await signIn(page);
    await page.waitForFunction(() => LOAD.later === 'ok' && !READING);
    const later = await page.evaluate(() => WANT.filter((t) => LATER[t]));
    const first = w.reads.filter((r) => !later.includes(r.name)), late = w.reads.filter((r) => later.includes(r.name));
    expect(first.length).toBeGreaterThan(3);
    expect(late.length).toBeGreaterThan(3);
    const firstEnd = Math.max(...first.map((r) => r.e)), lateStart = Math.min(...late.map((r) => r.s));
    expect(lateStart).toBeLessThan(firstEnd);   // one queue, not two waves
    // at most READ_AT_ONCE under way at once, and more than one
    let peak = 0;
    for (const r of w.reads) peak = Math.max(peak, w.reads.filter((x) => x.s <= r.s && x.e > r.s).length);
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(10);
  });

  test('second open uses the kept read: Compliance shows at once with "As of", unchanged files are not read again', async ({ page, guard }) => {
    await page.goto('cdhub/#/compliance');
    await signIn(page);
    await fullRead(page);
    await expect(page.locator('#compAsOf')).toHaveAttribute('data-state', 'live');
    // hold the folder list so the reopened page is still on the kept read
    let held = true; const waiting = [];
    await page.route((u) => u.hostname === 'www.googleapis.com' && u.pathname === '/drive/v3/files', async (route) => {
      if (held) { waiting.push(route); return; }
      return route.fallback();
    });
    const w = await watchReads(page, guard.world, 0);
    await page.reload();
    await expect(page.locator('#compAsAt')).toBeVisible();
    await expect(page.locator('#cdWait')).toHaveCount(0);
    const asOf = page.locator('#compAsOf');
    await expect(asOf).toHaveAttribute('data-state', 'copy');
    await expect(asOf).toContainText(/^As of \d\d:\d\d \(the copy on this device\)/);
    await expect(asOf.getByRole('button', { name: 'Refresh' })).toBeVisible();
    held = false; await Promise.all(waiting.splice(0).map((r) => r.fallback().catch(() => {})));
    await expect(asOf).toHaveAttribute('data-state', 'live');
    await expect(asOf).toContainText(/^As of \d\d:\d\d · live/);
    await page.waitForFunction(() => !READING);
    expect(w.reads.map((r) => r.name)).toEqual([]);   // nothing changed in Drive: no file read again
  });

  test('a file changed in Drive is read again; the others are not', async ({ page, guard }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await fullRead(page);
    const f = guard.world.files.find((x) => x.name === 'BLD-area_reading.csv');
    f.content = f.content + '\n';
    const w = await watchReads(page, guard.world, 0);
    await page.locator('header button[data-reload]').click();
    await page.waitForFunction(() => !READING && !LOAD.copy);
    expect(w.reads.map((r) => r.name)).toEqual(['BLD-area_reading.csv']);
  });

  test('Refresh on Compliance reads again and keeps the "As of" line', async ({ page, guard }) => {
    await page.goto('cdhub/#/compliance');
    await signIn(page);
    await fullRead(page);
    const w = await watchReads(page, guard.world, 0);
    await page.locator('#compAsOf [data-comp-refresh]').click();
    await page.waitForFunction(() => !READING && !LOAD.copy);
    expect(w.lists()).toBeGreaterThan(0);
    await expect(page.locator('#compAsOf')).toHaveAttribute('data-state', 'live');
    await expect(page.locator('#compAsAt')).toBeVisible();
  });

  test('a read over 5 minutes old is not shown on Compliance: it is read again first', async ({ page, guard }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await fullRead(page);
    let held = true; const waiting = [];
    await page.route((u) => u.hostname === 'www.googleapis.com' && u.pathname === '/drive/v3/files', async (route) => {
      if (held) { waiting.push(route); return; }
      return route.fallback();
    });
    await page.evaluate(() => { LOAD.storedAt = new Date(Date.now() - 6 * 60000).toISOString(); });
    await openCompliance(page);
    await expect(page.locator('#cdWait')).toContainText('Reading the live records');
    await expect(page.locator('#main')).not.toContainText('What was true on');
    held = false; await Promise.all(waiting.splice(0).map((r) => r.fallback().catch(() => {})));
    await expect(page.locator('#compAsOf')).toHaveAttribute('data-state', 'live');
  });

  test('Sign out forgets the kept file texts in memory too', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await fullRead(page);
    expect(await page.evaluate(() => Object.keys(READ_TXT).length)).toBeGreaterThan(5);
    await page.locator('header button[data-signout]').click();
    await expect(page.locator('#main')).toContainText('Sign in to see the tables');
    expect(await page.evaluate(() => Object.keys(READ_TXT).length + Object.keys(READ_MOD).length)).toBe(0);
  });
});
