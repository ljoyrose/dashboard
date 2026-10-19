// Hard rule 14: Karen - SHARED is never listed, read, searched or binned, on any page.
const { test, expect } = require('../support/test');

const KAREN = '0AEf6v2sKb4FrUk9PVA';
const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};

test.describe('Excluded shared drive (Karen - SHARED, hard rule 14)', () => {
  test('is in config, never queried and never shown on Map, Drive, Bin, Changes, PC-Personal or search @regression', async ({ page, guard }) => {
    const w = guard.world;
    w.addDrive(KAREN, 'Karen - SHARED');
    w.folder('karen-f', 'Karen folder sample', { parents: [KAREN], driveId: KAREN });
    w.file('karen-1', 'karen-private-sample.txt', 'invented', { parents: [KAREN], driveId: KAREN, mimeType: 'text/plain' });
    w.file('karen-2', 'ZZ_DELETE_karen-sample.txt', 'invented', { parents: [KAREN], driveId: KAREN, mimeType: 'text/plain' });
    w.file('karen-3', 'karen-binned-sample.txt', 'invented', { parents: [KAREN], driveId: KAREN, mimeType: 'text/plain', trashed: true, trashedTime: '2026-03-08T10:00:00.000Z' });

    await page.goto('./');
    expect(await page.evaluate(() => window.DASH_CONFIG.excludedDrives)).toContain(KAREN);
    await signIn(page);
    for (const hash of ['#/map', '#/drive', '#/drive/' + KAREN, '#/bin', '#/changes', '#/changes/24h', '#/changes/7d']) {
      await page.goto('./' + hash);
      await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
      await page.waitForTimeout(300);
      await expect(page.locator('body')).not.toContainText(/Karen|karen-/);
    }
    await page.goto('./#/drive');
    await expect(page.locator('#drivePicker option[value="' + KAREN + '"]')).toHaveCount(0);

    // PC-Personal duplicate scan: compares with every shared drive except the excluded one.
    await page.goto('./#/personal');
    await page.locator('[data-action="pcpscan"]').click();
    await expect(page.locator('#view')).toContainText(/Finished|already in a shared drive|personal files/);
    await expect(page.locator('body')).not.toContainText(/Karen|karen-/);

    await page.keyboard.press('/');
    await page.locator('#dashSearchBox').fill('karen');
    await expect(page.locator('#dashSearchStatus')).toContainText(/for "karen"/);
    await expect(page.locator('#dashSearch')).not.toContainText(/karen-/i);

    const asked = w.calls.filter((c) => c.url.includes(KAREN) || /karen/i.test(c.query));
    expect(asked.filter((c) => !/name contains 'karen'/.test(c.query)), 'a Drive call named the excluded drive').toEqual([]);
    expect(w.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });
});
