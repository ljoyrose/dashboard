// JOB 34 (group A): the Bin page "Needs you now" jumps, drive buttons, drive filter, empty bins and a failed read.
// Follows the TidyUp stage 5 page (#135): the old index strip and Permission card are gone; bin-page.spec.js
// covers section order and the Bin these button, so this file does not repeat them.
// Pretend Google and Drive only. Every drive and file is invented.
const { test, expect } = require('../fixtures/job34/load');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const openBin = async (page) => {
  await page.goto('./#/bin');
  await signIn(page);
  await expect(page.locator('#binCard summary .state').first()).not.toContainText('Reading');
};

test.describe('Bin: index and sections', () => {
  test('Needs you now: each count button opens its section and puts the keyboard on that section\'s title', async ({ page }) => {
    await openBin(page);
    const jumps = page.locator('#needsNow [data-action="foldjump"]');
    await expect(jumps).toHaveCount(3);
    const keys = await jumps.evaluateAll((els) => els.map((e) => e.getAttribute('data-key')));
    expect(keys.slice(0, 2)).toEqual(['sweep', 'check']);
    for (const key of keys) {
      // Close it first, so the button has something to do.
      await page.evaluate((k) => { const d = document.querySelector('[data-fold="' + k + '"]'); if (d) d.open = false; }, key);
      await page.locator(`#needsNow [data-action="foldjump"][data-key="${key}"]`).click();
      const fold = page.locator(`details[data-fold="${key}"]`);
      await expect(fold, key + ' opens').toHaveAttribute('open', '');
      await expect(fold.locator('summary').first(), key + ' title has focus').toBeFocused();
    }
  });

  test('a drive button in Already in the bin opens that drive\'s bin and lists what was binned', async ({ page }) => {
    await openBin(page);
    await page.locator('#binCard > summary').click();
    const btn = page.locator('#binCard [data-action="foldjump"][data-key="bin-drv-alpha1"]');
    await expect(btn).toContainText('Test Drive Alpha');
    await btn.click();
    const sec = page.locator('details[data-fold="bin-drv-alpha1"]');
    await expect(sec).toHaveAttribute('open', '');
    await expect(sec).toContainText('sample-already-binned.txt');
    await expect(sec).toContainText('Binned');
  });

  test('more than 6 shared drives: a find box appears and narrows the drive buttons by name', async ({ page, guard }) => {
    for (let i = 1; i <= 6; i++) {
      const id = 'drv-SAMPLE-' + i;
      guard.world.addDrive(id, 'Sample Drive ' + (i % 2 ? 'Odd ' : 'Even ') + i);
      guard.world.file('trash-SAMPLE-' + i, 'binned-sample-' + i + '.txt', 'invented', { parents: [id], driveId: id, mimeType: 'text/plain', trashed: true, trashedTime: '2026-03-08T09:00:00.000Z' });
    }
    await openBin(page);
    await page.locator('#binCard > summary').click();
    const box = page.locator('#binFilter');
    await expect(box).toHaveAttribute('placeholder', /Find a shared drive \(9\)/);
    const buttons = page.locator('#binCard .index [data-action="foldjump"]');
    await expect(buttons).toHaveCount(7);
    await box.fill('even');
    const shown = page.locator('#binCard .index [data-action="foldjump"]:not(.hidden-by-filter)');
    await expect(shown).toHaveCount(3);
    await expect(shown.first()).toContainText('Even');
    await box.fill('');
    await expect(shown).toHaveCount(7);
  });

  test('every bin empty: says so, and groups the drives under "have an empty bin"', async ({ page, guard }) => {
    const b = guard.world.byId('bin-1');
    b.trashed = false;
    await openBin(page);
    await page.locator('#binCard > summary').click();
    await expect(page.locator('#binCard')).toContainText('Every shared drive has an empty bin.');
    await expect(page.locator('#binCard')).toContainText('3 shared drives have an empty bin');
    await expect(page.locator('#binCard [data-action="foldjump"]')).toHaveCount(0);
  });

  test('Drive refuses the Bin read: the sections say "Read failed" and nothing can be ticked or moved', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/Failed to load resource: the server responded with a status of 403/);
    await page.goto('./');
    await signIn(page);
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal' };
    await page.locator('#mainNav a[data-nav="bin"]').click();
    await expect(page.locator('#sweepCard')).toContainText('Read failed: Access refused by Google.');
    await expect(page.locator('#binCard')).toContainText('Read failed');
    await expect(page.locator('#view input[data-pick-group="bin"]')).toHaveCount(0);
    await expect(page.locator('#view [data-action="sweep"]')).toHaveCount(0);
  });
});
