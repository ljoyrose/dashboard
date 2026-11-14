// Jobs on Compliance, SOP cards, dog cards and room cards. Invented rows only.
const { tabClick } = require('../support/tabs');
const { test, expect, HUBS, IDS } = require('../fixtures/job34/load');

const tab = async (page, id) => {
  await tabClick(page, `#nav button[data-go="${id}"]`);
  await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
};
const addTable = (world, name, content) => world.file('bld-jobs-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });

const TYPE_H = 'id,tenant_id,type_key,label,target,active,effective_from,source,every_days,group,includes,sop';
const LOG_H = 'id,tenant_id,check_type_id,area_id,subject_id,item,amount,outcome,happened_at,note,taken_at,taken_by,corrects_id,photo,how_recorded';
const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const TYPES = csv(TYPE_H, [
  't1,t,nails,Pretend nails,dog,true,2026-01-01,Condition X,28,Grooming,,Care Check',
  't2,t,clean,Pretend clean,area,true,2026-01-01,,1,,,Cleaning',
  't3,t,bowls,Pretend bowls,none,true,2026-01-01,Condition Y,1,,,Cleaning'
]);

test.describe('CD Hub: jobs', () => {
  test('the manifest check warns only when a table has fewer rows than listed', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
    const msg = (live, listed, copy) => page.evaluate(([l, r, c]) => {
      LOAD.rowCounts = { pretend: l }; LOAD.copy = !!c; CD.manifest = [{ file: 'BLD-pretend.csv', table: 'pretend', rows: r }];
      const x = checks().filter((k) => k.k === 'tables')[0]; LOAD.copy = false; return x;
    }, [live, listed, copy]);
    expect((await msg(12, '10')).msg).not.toContain('fewer rows');
    const fewer = await msg(9, '10');
    expect(fewer.ok).toBe(false);
    expect(fewer.msg).toContain('1 tables have fewer rows than the manifest: pretend');
    // the copy on this device can be older than the manifest: no warning while it shows
    const onCopy = await msg(9, '10', true);
    expect(onCopy.ok).toBe(true);
    expect(onCopy.msg).toBe('Checking tables\u2026');
  });

  test('the manifest check counts the live read, not the rows on screen', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok' && !LOAD.copy);
    const x = await page.evaluate(() => {
      const n = LOAD.rowCounts.subject;
      CD.counts.subject = 0;   // what a copy or half read would show
      CD.manifest = [{ file: 'BLD-subject.csv', table: 'subject', rows: String(n) }];
      return checks().filter((k) => k.k === 'tables')[0];
    });
    expect(x.wait).toBeFalsy();
    expect(x.msg).not.toContain('fewer rows');
  });

  test('no job files yet: the page still loads and says so', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    await expect(page.locator('#compJobs')).toContainText('No job rows yet');
  });

  test('Compliance: sections fold and stay folded; jobs run best to worst, done then due then late; counts open the SOP', async ({ page, guard }) => {
    addTable(guard.world, 'BLD-check_type.csv', TYPES);
    addTable(guard.world, 'BLD-check_log.csv', csv(LOG_H, [
      'l1,t,t1,,sub-test-dog-1,,,ok,2026-01-05T09:00:00Z,,2026-01-05T09:00:00Z,Staff A,,,scanned'
    ]));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    await expect(page.locator('#compJobs table').first().locator('thead th')).toHaveText(['SOP', 'job', 'done', 'due', 'late', 'last']);
    const late = await page.locator('#compJobs tr[data-job]').evaluateAll((rs) => rs.map((r) => +(r.querySelector('td[data-n="late"]').textContent) || 0));
    expect(late).toEqual(late.slice().sort((a, b) => a - b));
    const link = page.locator('#compJobs tr[data-job="nails"] td[data-n="late"] a');
    await expect(link).toHaveAttribute('href', '#/sops/Care%20Check');
    for (const id of ['compProblems', 'compRooms', 'compJobs', 'compRules', 'compAdd']) await expect(page.locator('#' + id + ' details.compfold')).toHaveAttribute('open', '');
    await page.locator('#compRules details.compfold > summary').click();
    await expect(page.locator('#compRules details.compfold')).not.toHaveAttribute('open', '');
    await tab(page, 'dogs');
    await tab(page, 'compliance');
    await expect(page.locator('#compRules details.compfold')).not.toHaveAttribute('open', '');
    await expect(page.locator('#compJobs details.compfold')).toHaveAttribute('open', '');
    await link.click();
    await expect(page).toHaveURL(/#\/sops\/Care%20Check$/);
    await expect(page.locator('#nav button[data-go="sops"]')).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => SOP.open)).toBe('Care Check');
  });

  test('Compliance shows late, due and source; dog card shows its history in plain words', async ({ page, guard }) => {
    addTable(guard.world, 'BLD-check_type.csv', TYPES);
    addTable(guard.world, 'BLD-check_log.csv', csv(LOG_H, [
      'l1,t,t1,,sub-test-dog-1,,,ok,2026-01-05T09:00:00Z,,2026-01-05T09:00:00Z,Staff A,,,scanned',
      'l2,t,t1,,sub-test-dog-1,,,concern,2026-01-06T09:00:00Z,pretend note,2026-01-06T09:00:00Z,Staff A,,,tapped'
    ]));
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    const row = page.locator('#compJobs tr[data-job="nails"]');
    await expect(row).toContainText('Care Check');
    await expect(row).toContainText('Pretend nails');
    await expect(page.locator('#compJobs tr[data-source="Condition X"]')).toBeVisible();
    await expect(page.locator('#compJobs tr[data-source=""]')).toContainText('No source entered');
    await tab(page, 'dogs');
    const hist = page.locator('[data-history="sub-test-dog-1"]');
    await expect(hist).toContainText('2 job records');
    // job history sits behind More on the dog card (layout A, Lisa 12 Nov 2026)
    await page.locator('#rows article.dc', { has: hist }).locator('details.more > summary').click();
    await hist.locator('summary').click();
    await expect(hist).toContainText('opened from tag');
    await expect(hist).toContainText('pretend note');
    await expect(hist).toContainText('6 Jan 2026');   // owner date: "2 Mar 2026"
    await expect(hist).not.toContainText(/verified|attended/i);
    expect(await page.evaluate(() => BLDJobsView.sopHtml(jobsV(), 'Care Check'))).toContain('Pretend nails');
    expect(await page.evaluate(() => BLDJobsView.sopHtml(jobsV(), 'Nothing here'))).toBe('');
    await tab(page, 'areas');
    await expect(page.locator('[data-history]').first()).toContainText('no job records');
  });
});
