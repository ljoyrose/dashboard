// Owner hub speed (Lisa 13 Nov 2026): first-screen tables are read first and the rest straight after;
// the owner's last full read is kept on this device and shown at once next time, marked "updated x min ago",
// wiped on Sign out, on "Signed out in another tab" and when Google refuses. Compliance never shows the copy.
const { test, expect } = require('../support/test');

const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};
// hold the Drive read of one file until release() is called
async function hold(page, world, name) {
  const f = world.files.find((x) => x.name === name);
  const waiting = [];
  let held = true;
  await page.route((u) => u.pathname.endsWith('/files/' + f.id), async (route) => {
    if (held) { waiting.push(route); return; }
    return route.fallback();
  });
  return { release: async () => { held = false; await Promise.all(waiting.splice(0).map((r) => r.fallback().catch(() => {}))); }, waiting };
}
async function hasCopy(page) { return page.evaluate(async () => !!(await copyGet())); }
async function fullRead(page) {
  await page.waitForFunction(() => window.LOAD && LOAD.state === 'ok' && LOAD.later === 'ok' && !LOAD.copy);
  await expect.poll(() => hasCopy(page)).toBe(true);
}

test.describe('CD Hub: owner speed', () => {
  test('the first screen shows before the later tables land; a page that needs them waits, then fills in', async ({ page, guard }) => {
    const h = await hold(page, guard.world, 'BLD-sale.csv');   // an enquiries table: read after the first screen
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('#livepill')).toContainText('live');
    expect(await page.evaluate(() => LOAD.later)).toBe('wait');
    await page.goto('cdhub/#/dogs');
    await expect(page.locator('#cdWait')).toContainText('Getting these records ready');
    await h.release();
    await expect(page.locator('#cdWait')).toHaveCount(0);
    await expect(page.locator('#main')).toContainText('Test Dog One');
  });

  test('later tables are fewer than half the reads before the first screen, and are still read 6 at a time', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    const n = await page.evaluate(() => ({ want: WANT.length, later: WANT.filter((t) => LATER[t]).length, at: READ_AT_ONCE }));
    expect(n.later).toBeGreaterThan(20);
    expect(n.at).toBe(6);
  });

  test('reopening shows the device copy at once, marked "updated", while the live read runs; Compliance waits for live rows', async ({ page, guard }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await fullRead(page);
    const h = await hold(page, guard.world, 'BLD-subject.csv');   // a first-screen table: the live read stays open
    await page.reload();
    await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
    await expect(page.locator('#boot')).toHaveCount(0);
    await expect(page.locator('#livepill')).toHaveText(/^updated (just now|\d+ min ago)$/);
    await openCompliance(page);
    await expect(page.locator('#cdWait')).toContainText('Reading the live records');
    await expect(page.locator('#main')).not.toContainText('What was true on');
    await h.release();
    await expect(page.locator('#livepill')).toContainText(/^live · read-only/);
    await expect(page.locator('#cdWait')).toHaveCount(0);
  });

  test('Sign out wipes the device copy', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await fullRead(page);
    await page.locator('header button[data-signout]').click();
    await expect(page.locator('#main')).toContainText('Sign in to see the tables');
    await expect.poll(() => hasCopy(page)).toBe(false);
  });

  test('"Signed out in another tab" wipes the device copy', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await fullRead(page);
    await page.evaluate(() => { localStorage.removeItem(window.DashAuth.KEY); window.dispatchEvent(new StorageEvent('storage', { key: window.DashAuth.KEY, newValue: null })); });
    await expect(page.locator('#main')).toContainText('Signed out in another tab');
    await expect.poll(() => hasCopy(page)).toBe(false);
  });

  test('Google refusing the folder wipes the copy and shows the error, not the copy', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 403/);
    await page.goto('cdhub/');
    await signIn(page);
    await fullRead(page);
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal' };
    await page.reload();
    await expect(page.locator('#main')).toContainText('Google refused access');
    await expect(page.locator('#main')).not.toContainText('Test Dog One');
    await expect.poll(() => hasCopy(page)).toBe(false);
  });

  test('a later table that cannot be read: the first screen stays, the page that needs it says so with Try again', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 403/);
    guard.world.failFor = guard.world.files.find((x) => x.name === 'BLD-sale.csv').id;
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal' };
    await page.goto('cdhub/');
    await signIn(page);
    await expect.poll(() => page.evaluate(() => LOAD.later)).toBe('err');
    await expect(page.locator('#livepill')).toContainText('live');
    await page.goto('cdhub/#/dogs');
    await expect(page.locator('#cdWait')).toContainText('These records could not be read');
    await expect(page.locator('#cdWait').getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});

async function openCompliance(page) {
  await page.evaluate(() => { location.hash = '#/compliance'; });
  await expect(page.locator('#nav [data-go="compliance"][aria-current="page"], #cdWait')).not.toHaveCount(0);
}
