// JOB 34b: Home (the root dashboard) gap tests. Only checks no other spec already proves:
// keyboard use of the Bin jump buttons, the shared-drive finder at phone width, the Drives pager, the "All shared drives" picker option,
// keyboard use of those controls, empty / error / slow / signed-out states per view, and phone width with many drives.
// Pretend Google and Drive only (tests/support). Every name below is invented (APP-A style, example.test).
const { test, expect, sideScroll, slow, DRIVE } = require('../fixtures/job34/load');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const iso = (ms) => new Date(Date.now() + ms).toISOString();

/** Add `n` invented shared drives, each with one file in its bin. */
function manyBins(world, n, long = false) {
  for (let i = 1; i <= n; i++) {
    const id = 'drv-app' + i;
    const name = long ? 'APP-' + String.fromCharCode(64 + i) + ' shared drive with a deliberately very long invented name for wrapping' : 'APP-' + String.fromCharCode(64 + i) + ' drive';
    world.addDrive(id, name);
    world.file('trash-app' + i, 'sample-binned-' + i + '.txt', 'invented', { parents: [id], driveId: id, mimeType: 'text/plain', trashed: true, trashedTime: iso(-3600e3) });
  }
}

test.describe('Home (job34b): Bin controls', () => {
  // The index-strip, drive-button and drive-finder clicks are proven by tests/mocked/job34-bin-index.spec.js on main.
  // What no spec proves is keyboard-only use of the Bin's jump buttons.
  test('keyboard: Tab reaches a "Needs you now" button and a drive button, Enter opens each section with focus on its title', async ({ page, guard }) => {
    manyBins(guard.world, 2);
    await page.goto('./#/bin');
    await signIn(page);
    await expect(page.locator('#binCard > summary .state')).toHaveText(/^Read \d/); // the Bin's own reads have landed
    const tabTo = async (sel) => {
      for (let i = 0; i < 120; i++) {
        await page.keyboard.press('Tab');
        if (await page.evaluate((s) => !!document.activeElement && document.activeElement.matches(s), sel)) return true;
      }
      return false;
    };
    await page.evaluate(() => { const d = document.querySelector('[data-fold="check"]'); if (d) d.open = false; });
    expect(await tabTo('#needsNow [data-action="foldjump"][data-key="check"]'), 'Tab reaches the "items to check" button').toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.locator('details[data-fold="check"]')).toHaveAttribute('open', '');
    await expect(page.locator('details[data-fold="check"] > summary')).toBeFocused();
    // Already in the bin is folded shut by design: open it from the keyboard, then Tab to a drive button.
    await page.locator('#binCard > summary').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#binCard')).toHaveAttribute('open', '');
    expect(await tabTo('#binCard [data-action="foldjump"][data-key="bin-drv-app2"]'), 'Tab reaches the APP-B drive button').toBe(true);
    await page.keyboard.press('Enter');
    const sec = page.locator('details[data-fold="bin-drv-app2"]');
    await expect(sec).toHaveAttribute('open', '');
    await expect(sec).toContainText('sample-binned-2.txt');
    await expect(sec.locator(':scope > summary')).toBeFocused();
  });
});

test.describe('Home (job34b): Drives controls', () => {
  test('Drives Recent with more than seven files: "Page 2 ›" opens page 2, "‹ Page 1" comes back, and the count line follows', async ({ page, guard }) => {
    for (let i = 1; i <= 9; i++) guard.world.file('app-many-' + i, 'APP-A sample file ' + i + '.txt', 'invented', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain', modifiedTime: iso(-i * 60e3) });
    await page.goto('./#/drives/shared');
    await signIn(page);
    const pager = page.locator('#view .pager').first();
    await expect(pager.locator('.count')).toContainText(/^Page 1 of \d+ · \d+ items$/);
    await pager.getByRole('link', { name: /Page 2/ }).click();
    await expect(page).toHaveURL(/#\/drives\/shared\/p2$/);
    await expect(page.locator('#view .pager .count').first()).toContainText(/^Page 2 of /);
    await page.locator('#view .pager').first().getByRole('link', { name: /Page 1/ }).click();
    await expect(page).toHaveURL(/#\/drives\/shared\/p1$/);
    await expect(page.locator('#view .pager .count').first()).toContainText(/^Page 1 of /);
  });

  test('Drive picker: "All shared drives · recent" takes you from one drive back to the recent list', async ({ page }) => {
    await page.goto('./#/drives/shared/drv-alpha1');
    await signIn(page);
    await expect(page.locator('#drivePicker')).toHaveValue('drv-alpha1');
    await page.locator('#drivePicker').selectOption({ label: 'All shared drives · recent' });
    await expect(page).toHaveURL(/#\/drives\/shared$/);
    await expect(page.locator('#view')).toContainText('Recent in shared drives');
  });

  test('keyboard: the drive picker is reached by Tab and changes drive with the arrow keys', async ({ page }) => {
    await page.goto('./#/drives/shared');
    await signIn(page);
    let hit = false;
    for (let i = 0; i < 60 && !hit; i++) {
      await page.keyboard.press('Tab');
      hit = await page.evaluate(() => document.activeElement && document.activeElement.id === 'drivePicker');
    }
    expect(hit, 'Tab reaches the drive picker').toBe(true);
    await page.keyboard.press('ArrowDown');
    await expect(page).toHaveURL(/#\/drives\/shared\/drv-/);
  });
});

test.describe('Home (job34b): empty, error, slow and signed-out states', () => {
  // "No shared drives" on Drives and Bin is proven by tests/mocked/job34-drives-pages.spec.js on main.
  test('no file in any bin: the Bin says "Every shared drive has an empty bin."', async ({ page, guard }) => {
    guard.world.files = guard.world.files.filter((f) => !f.trashed);
    await page.goto('./#/bin');
    await signIn(page);
    await expect(page.locator('#binCard')).toContainText('Every shared drive has an empty bin.');
  });

  // DECISION NEEDED: when the shared-drive list cannot be read, should the Bin cards say "Read failed" (like every
  // other card) instead of "Not read yet"? Today the Bin never starts its read, so its cards look untouched.
  // OWNER: Lisa (Home hub). BY 2026-11-17
  test.fixme('J34b-F01 Drive answers 500 on the Bin: the Bin cards say "Read failed", not "Not read yet"', async ({ page, guard, allowedConsole }) => {
    test.setTimeout(60_000);
    allowedConsole.push(/Failed to load resource: the server responded with a status of 500/);
    guard.world.failWith = { status: 500, reason: 'backendError', message: 'Sample failure' };
    await page.goto('./#/bin');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    // A 500 is retried (about 1 s, 2 s, then 4 s) before the page gives up, so allow for the retries.
    await expect(page.locator('#readStamp')).toHaveText('A read failed', { timeout: 30_000 });
    await expect(page.locator('#binCard > summary .state')).toHaveText('Read failed');
    await expect(page.locator('#binCard .note.fail')).toContainText(/^Read failed: /);
  });

  test('Drive answers 500 on Changes and Drives Recent: each card is marked "Read failed" with a plain note', async ({ page, guard, allowedConsole }) => {
    test.setTimeout(60_000);
    allowedConsole.push(/Failed to load resource: the server responded with a status of 500/);
    guard.world.failWith = { status: 500, reason: 'backendError', message: 'Sample failure' };
    await page.goto('./#/changes');
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toHaveText('A read failed', { timeout: 30_000 });
    for (const h of ['changes', 'changes/24h', 'drives/shared']) {
      await page.evaluate((x) => { location.hash = '#/' + x; }, h);
      await expect(page.locator('#view .cardhead .state').first(), h).toHaveText('Read failed');
      await expect(page.locator('#view .note.fail').first(), h).toContainText(/^Read failed: /);
    }
  });

  test('slow Drive (3 s) on a deep link to the Bin: the cards say "Reading…" first, then land with no errors', async ({ page }) => {
    test.setTimeout(150_000);
    await slow(page, DRIVE, 3000);
    await page.goto('./#/bin');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    // While Drive is slow nothing claims to be read: the header says Reading… and the bin card is not yet marked read.
    await expect(page.locator('#readStamp')).toHaveText('Reading…');
    await expect(page.locator('#binCard > summary .state')).toHaveText(/^(Reading…|Not read yet)$/);
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/, { timeout: 100_000 });
    // The Bin is read after the main reads land, so it is still slow here; it must still finish.
    await expect(page.locator('#binCard > summary .state')).toHaveText(/^Read \d/, { timeout: 100_000 });
    // Ready to bin (the sweep) must land too, not stay on Reading… or turn to Read failed.
    await expect(page.locator('#sweepCard > summary .state')).toHaveText(/^(Read \d|Empty)/, { timeout: 100_000 });
    await expect(page.locator('#view .note.fail')).toHaveCount(0);
  });

  test('signed out, deep links to Bin, Changes Totals and one shared drive show only the sign-in and ask Drive for no files', async ({ page, guard }) => {
    for (const h of ['#/bin', '#/changes/totals', '#/drives/shared/drv-alpha1', '#/drives/usb']) {
      await page.goto('./' + h);
      await expect(page.locator('#signInBtn')).toBeEnabled();
      await expect(page.locator('html')).toHaveClass(/dash-locked/);
      await expect(page.locator('#mainNav')).not.toBeVisible();
      await expect(page.locator('#sweepCard, #binCard, #drivePicker, .stat')).toHaveCount(0);
    }
    expect(guard.world.calls.filter((c) => c.path.startsWith('/files') || c.path.startsWith('/drives'))).toEqual([]);
  });
});

test.describe('Home (job34b): phone 390px with many shared drives', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('the Bin with eight long-named shared drives and the finder box does not scroll sideways, even with a drive open', async ({ page, guard }) => {
    manyBins(guard.world, 8, true);
    await page.goto('./#/bin');
    await signIn(page);
    // Already in the bin is folded shut by design; the finder lives inside it.
    await page.locator('#binCard > summary').click();
    await expect(page.getByRole('searchbox', { name: 'Find a shared drive' })).toBeVisible();
    expect(await sideScroll(page), 'Bin scrolls sideways at 390px').toBe(false);
    await page.locator('[data-action="foldjump"][data-key="bin-drv-app8"]').click();
    await expect(page.locator('details[data-fold="bin-drv-app8"]')).toHaveAttribute('open', '');
    expect(await sideScroll(page), 'Bin with a drive open scrolls sideways at 390px').toBe(false);
  });

  test('Drives with many shared drives: the picker and pager fit at 390px', async ({ page, guard }) => {
    manyBins(guard.world, 8, true);
    for (let i = 1; i <= 9; i++) guard.world.file('app-ph-' + i, 'APP-B invented file with a long name number ' + i + '.txt', 'invented', { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain', modifiedTime: iso(-i * 60e3) });
    await page.goto('./#/drives/shared');
    await signIn(page);
    await expect(page.locator('#view .pager').first()).toBeVisible();
    expect(await sideScroll(page), 'Drives scrolls sideways at 390px').toBe(false);
  });
});
