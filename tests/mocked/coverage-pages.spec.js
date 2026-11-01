// Stage 9 done-test: Dropbox, iCloud and Mac are look-only Drives sub-menu pages. Each opens with one purpose line,
// lights its own pill, has no bin, move or rename button, and says "No report yet" (neutral) until its engine
// writes a dry-run report. Any action stays in Bin.
const { test, expect } = require('../support/test');
const { IDS, FIX } = require('../support/world');
const fs = require('fs');
const path = require('path');

const PAGES = [
  ['Dropbox', 'drives/dropbox', 'dropbox'],
  ['iCloud', 'drives/icloud', 'icloud'],
  ['Mac', 'drives/mac', 'mac'],
];
// Same names as config.js home.coverageReports.
const REPORTS = { icloud: 'ICLOUD-REPORT.json', mac: 'MAC-REPORT.json' };
const ACTIONS = ['pcpmark', 'pcpbin', 'selectall', 'clearpick', 'sweep', 'usbmark', 'pcpscan', 'usbscan'];

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#mainNav')).toBeVisible();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};

const lookOnly = async (view) => {
  for (const a of ACTIONS) await expect(view.locator(`[data-action="${a}"]`)).toHaveCount(0);
  await expect(view.locator('button')).toHaveCount(0);
  await expect(view.locator('.btn.danger')).toHaveCount(0);
  await expect(view.locator('input[type="checkbox"]')).toHaveCount(0);
  // The only button-styled link is "← Dashboard".
  await expect(view.locator('a.btn')).toHaveCount(1);
  await expect(view.locator('a.btn')).toHaveText('← Dashboard');
  await expect(view.locator('a.btn, button')).not.toHaveText(/\b(bin|move|rename|delete)\b/i);
};

test.describe('Stage 9: Dropbox, iCloud and Mac pages (look only)', () => {
  for (const [label, route, view] of PAGES) {
    test(`#/${route}: one purpose line, its pill current, look only, "No report yet" with no report`, async ({ page, guard }) => {
      await page.goto('./#/drives');
      await signIn(page);
      await page.locator('#view nav.subnav a', { hasText: new RegExp(`^${label}$`) }).click();
      await expect(page).toHaveURL(new RegExp(`#/${route}$`));
      const v = page.locator('#view');
      await expect(v).toHaveAttribute('data-view', view);
      await expect(page.locator('#hereTitle')).toHaveText(label);
      await expect(page.locator('#mainNav a[data-nav="drives"]')).toHaveAttribute('aria-current', 'page');
      const current = v.locator('nav.subnav a[aria-current="page"]');
      await expect(current).toHaveCount(1);
      await expect(current).toHaveText(label);
      await expect(v.locator('[data-purpose]')).toHaveCount(1);
      await expect(v.locator('[data-purpose]')).not.toBeEmpty();
      const card = v.locator('#coverageCard');
      await expect(card.locator('[data-no-report]')).toHaveText('No report yet.');
      await expect(card).not.toHaveClass(/\bfailed\b/);
      await expect(card.locator('.note.fail')).toHaveCount(0);
      await expect(card.locator('[data-bin-pointer]')).toHaveText('Anything to tidy is done in Bin.');
      await expect(v.locator('a[href="#/bin"]')).toHaveCount(0); // Bin keeps its one way in (the tab)
      await lookOnly(v);
      expect(guard.world.calls.filter((c) => c.method !== 'GET')).toEqual([]);
    });
  }

  test('Dropbox shows the same totals the Bin Dropbox fold reads, and nothing else changes', async ({ page, guard }) => {
    const totals = fs.readFileSync(path.join(FIX, 'dropbox/DROPBOX-TOTALS.json'), 'utf8');
    guard.world.file('dbx-totals', IDS.dbxName, totals, { parents: [IDS.dbx], driveId: null, mimeType: 'application/json' });
    await page.goto('./#/drives/dropbox');
    await signIn(page);
    const card = page.locator('#coverageCard');
    await expect(card).toContainText('Marked to delete: 12 files (3.5 GB).');
    await expect(card).toContainText('Duplicates found: 40 files, 9.25 GB wasted.');
    await expect(card).toContainText('(not finished)');
    await expect(card).toContainText('Nothing was renamed or moved.');
    await expect(card.locator('[data-no-report]')).toHaveCount(0);
    await lookOnly(page.locator('#view'));
    // The delete steps stay in Bin.
    await page.locator('#mainNav a[data-nav="bin"]').click();
    await expect(page.locator('#dropboxCard')).toContainText('Waiting to delete: 12 files (3.5 GB)');
    expect(guard.world.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });

  for (const [label, route, view] of PAGES.slice(1)) {
    test(`${label} shows its dry-run report counts when the engine has written one`, async ({ page, guard }) => {
      const name = REPORTS[view];
      const report = JSON.stringify({ generated: '2026-03-09T07:00:00Z', complete: true, files: 1200, gb: 45.5, duplicate_files: 30, wasted_gb: 2.25 });
      guard.world.file(view + '-report', name, report, { parents: [IDS.dbx], driveId: null, mimeType: 'application/json' });
      await page.goto('./#/' + route);
      await signIn(page);
      const card = page.locator('#coverageCard');
      await expect(card).toContainText('Looked at: 1,200 files (45.5 GB).');
      await expect(card).toContainText('Exact copies found: 30 files, 2.25 GB.');
      await expect(card).toContainText('Nothing was renamed or moved.');
      await expect(card.locator('[data-no-report]')).toHaveCount(0);
      await lookOnly(page.locator('#view'));
      expect(guard.world.calls.filter((c) => c.method !== 'GET')).toEqual([]);
    });
  }
});
