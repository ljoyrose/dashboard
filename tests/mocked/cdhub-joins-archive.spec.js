// Joins A (Lisa 17 Nov 2026): records of dogs moved to the archive are history, not broken joins. Invented rows only.
const { test, expect } = require('../support/test');

test('a vaccination or parent pointing at an archived dog resolves; a truly missing dog is still reported', async ({ page }) => {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  const r = await page.evaluate(() => {
    const keep = Object.assign({}, T);
    T['BLD-subject.csv'] = [{ id: 'sub-here', name: 'Here', sire_id: 'sub-old-sire', dam_id: '' }];
    T['BLD-subject-Archive.csv'] = [{ id: 'sub-old-sire', name: 'Old sire' }, { id: 'sub-old-dog', name: 'Old dog' }];
    T['BLD-vaccination.csv'] = [{ id: 'vac-1', subject_id: 'sub-old-dog' }, { id: 'vac-2', subject_id: 'sub-nowhere' }];
    const withArchive = refAudit();
    delete T['BLD-subject-Archive.csv'];
    const without = refAudit();
    Object.keys(T).forEach((k) => delete T[k]); Object.assign(T, keep);
    return { withArchive, without };
  });
  expect(r.withArchive.archived).toBe(2);
  expect(r.withArchive.bad.join(' ')).toContain('sub-nowhere');
  expect(r.withArchive.bad.join(' ')).not.toContain('sub-old');
  expect(r.without.bad.join(' ')).toContain('sub-old');
});

test('the archive is read after the first screen and is optional (absent is not a missing-file fault)', async ({ page }) => {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  const r = await page.evaluate(() => ({ want: WANT.indexOf('BLD-subject-Archive.csv') >= 0, later: !!LATER['BLD-subject-Archive.csv'], optional: !!OPTIONAL_FILES['BLD-subject-Archive.csv'] }));
  expect(r).toEqual({ want: true, later: true, optional: true });
});
