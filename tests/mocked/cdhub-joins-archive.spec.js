// Joins A (the owner 17 Nov 2026): records of dogs moved to the archive are history, not broken joins. Invented rows only.
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

// the owner 17 Nov 2026 ("99 references remove error"): old litters live only in the paper books. Kept in BLD-litter-Archive,
// a vet visit pointing at one is history too; a litter in neither list is still reported.
test('a record pointing at an archived litter resolves; the litter archive is optional', async ({ page }) => {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  const r = await page.evaluate(() => {
    const keep = Object.assign({}, T);
    T['BLD-litter.csv'] = [{ id: 'lit-now' }];
    T['BLD-litter-Archive.csv'] = [{ id: 'lit-old' }];
    T['BLD-vet_visit.csv'] = [{ id: 'vv-1', litter_id: 'lit-old' }, { id: 'vv-2', litter_id: 'lit-now' }, { id: 'vv-3', litter_id: 'lit-gone' }];
    const a = refAudit();
    Object.keys(T).forEach((k) => delete T[k]); Object.assign(T, keep);
    return { a, optional: !!OPTIONAL_FILES['BLD-litter-Archive.csv'] && WANT.indexOf('BLD-litter-Archive.csv') >= 0 };
  });
  expect(r.a.archived).toBeGreaterThanOrEqual(1);
  expect(r.a.bad.join(' ')).toContain('lit-gone');
  expect(r.a.bad.join(' ')).not.toContain('lit-old');
  expect(r.optional).toBe(true);
});

