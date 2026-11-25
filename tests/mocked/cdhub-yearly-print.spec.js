// Yearly print on Compliance: the shared A4 page, opened from the daily calendars and the checks register.
// Read only. Invented rows only.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('../support/test');
const { tabClick } = require('../support/tabs');
const { IDS } = require('../support/world');

const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};
const setFile = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-yp-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};
const TYPE = 'id,tenant_id,type_key,label,target,active,effective_from,every_days,site_scope\n'
  + 'ct-h,t,health_check_all,Health check,none,true,2026-01-01,1,per_dog\n'
  + 'ct-p,t,parasites,Parasites,dog,true,2026-01-01,90,\n'
  + 'ct-f,t,future_job,Future job,none,true,2026-01-01,1,\n';
const LOG = 'id,tenant_id,check_type_id,subject_id,outcome,happened_at,taken_by,note\n'
  + 'l1,t,ct-h,sub-test-dog-1,ok,2026-03-02T09:00:00Z,Sample Staff,\n'
  + 'l2,t,ct-p,sub-test-dog-1,ok,2026-02-11T09:00:00Z,Sample Staff,Spring dose\n';

test('Print / PDF on the daily calendars and the checks register opens Yearly print with those records ticked', async ({ page, guard }) => {
  setFile(guard.world, 'BLD-check_type.csv', TYPE);
  setFile(guard.world, 'BLD-check_log.csv', LOG);
  await page.goto('cdhub/');
  await signIn(page);
  await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
  await tabClick(page, '#nav button[data-go="compliance"]');
  await expect(page.locator('#jobCals [data-yp="cal"]')).toHaveText('Print / PDF');
  await expect(page.locator('#ckrYear')).toHaveText('Print / PDF');
  await page.locator('#jobCals [data-yp="cal"]').click();
  await expect(page.locator('h2').first()).toHaveText('Yearly print');
  await expect(page.locator('input[name="ypType"][value="check:health_check_all"]')).toBeChecked();
  await expect(page.locator('input[name="ypType"][value="check:parasites"]')).not.toBeChecked();
  await expect(page.locator('input[name="ypType"][value="medicines"]')).toBeVisible();
  await expect(page.locator('input[name="ypType"][value="fit_to_breed"]')).toBeVisible();
  await expect(page.locator('input[name="ypType"][value="microchip"]')).toBeVisible();
});

test('one month of health checks prints a grid, a sparse type prints a list, and CSV downloads nothing written', async ({ page, guard }) => {
  setFile(guard.world, 'BLD-check_type.csv', TYPE);
  setFile(guard.world, 'BLD-check_log.csv', LOG);
  await page.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
  await page.goto('cdhub/#/yearly');
  await signIn(page);
  await expect(page.locator('#ypMonth')).toBeVisible({ timeout: 20000 });
  await page.locator('#ypMonth').selectOption('2');
  await page.locator('#ypYear').selectOption('2026');
  await page.locator('input[name="ypType"][value="check:health_check_all"]').check();
  await page.locator('#ypPrint').click();
  await expect.poll(() => page.evaluate(() => window.__printed || 0)).toBe(1);
  const grid = page.locator('#ypReport [data-yp-page]');
  await expect(grid).toHaveAttribute('data-layout', 'dogs');
  await expect(grid).toHaveAttribute('data-month', '2026-03');
  await expect(grid).toContainText('Health check');
  await expect(grid.locator('[data-mark="tick"]')).toHaveCount(1);
  await page.evaluate(() => document.body.classList.remove('yp-printing'));

  await page.locator('input[name="ypType"][value="check:health_check_all"]').uncheck();
  await page.locator('input[name="ypType"][value="check:parasites"]').check();
  await page.locator('#ypMonth').selectOption('1');
  await page.locator('#ypPrint').click();
  await expect(page.locator('#ypReport [data-layout="list"]')).toContainText('Spring dose');
  await expect(page.locator('#ypReport [data-layout="list"]')).toContainText('February 2026');

  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#ypCsv').click()]);
  expect(dl.suggestedFilename()).toBe('yearly-parasites-2026-02.csv');
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  expect(csv).toContain('Parasites');
  expect(csv).toContain('2026-02-11');
  expect(csv).toContain('Spring dose');
});

test('screenshots: a health-check month, a sparse month, and a medicines month', async ({ page }) => {
  const dir = '/opt/cursor/artifacts';
  fs.mkdirSync(dir, { recursive: true });
  await page.setViewportSize({ width: 1200, height: 860 });
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  await page.addScriptTag({ path: require('path').join(__dirname, '..', '..', 'cdhub', 'yearly-print.js') });
  await page.addScriptTag({ path: require('path').join(__dirname, '..', '..', 'cdhub', 'meds-register.js') });
  const shots = await page.evaluate(async () => {
    const Y = window.BLDYearlyPrint, R = window.BLDMedsRegister;
    const today = '2026-03-15';
    const types = [
      { id: 'ct-h', type_key: 'health_check_all', label: 'Health check', target: 'none', site_scope: 'per_dog', every_days: '1', effective_from: '2026-01-01' },
      { id: 'ct-p', type_key: 'parasites', label: 'Parasites', target: 'dog', every_days: '90', effective_from: '2026-01-01' }
    ];
    const dogs = [{ id: 'd1', name: 'Ada', dob: '2024-01-01', onSite: true }, { id: 'd2', name: 'Bob', dob: '2024-06-01', onSite: true }];
    const logs = [
      { id: 'l1', check_type_id: 'ct-h', subject_id: 'd1', outcome: 'ok', happened_at: '2026-03-02T09:00:00Z', taken_by: 'Sample Staff' },
      { id: 'l2', check_type_id: 'ct-h', subject_id: 'd2', outcome: 'part_done', happened_at: '2026-03-02T09:00:00Z', taken_by: 'Sample Staff', note: 'half the check' },
      { id: 'l3', check_type_id: 'ct-p', subject_id: 'd1', outcome: 'ok', happened_at: '2026-02-11T09:00:00Z', taken_by: 'Sample Staff', note: 'Spring dose' }
    ];
    const ctx = { today: today, kennel: 'Sample Kennel', printed: '15 Mar 2026', types: types, logs: logs, dogs: dogs, tables: {}, dogName: (id) => (dogs.find((d) => d.id === id) || {}).name || '' };
    const health = Y.build({ period: 'month', year: 2026, month: 2, ids: ['check:health_check_all'], today: today }, ctx).html;
    const sparse = Y.build({ period: 'month', year: 2026, month: 1, ids: ['check:parasites'], today: today }, ctx).html;
    const lines = R.build([{ id: 'dsp', subject_id: 'd1', given_on: '2026-03-04', product: 'Sample Wormer', dose_volume: '1 tablet', given_by: 'Sample Staff' }], { month: '2026-03', dog: () => ({ name: 'Ada', chip: '' }) });
    const meds = R.toHtml({ kennel: 'Sample Kennel', month: '2026-03', printed: '15 Mar 2026' }, lines);
    const wrap = (inner) => '<!doctype html><html><head><meta charset="utf-8"><style>' + Y.CSS + 'body{margin:0;background:#fff}#ypReport{display:block}</style></head><body><div id="ypReport">' + inner + '</div></body></html>';
    return { health: wrap(health), sparse: wrap(sparse), meds: meds.replace(/<script[\s\S]*?<\/script>/gi, '') };
  });
  for (const [name, html, sel] of [['health-check-month', shots.health, '.yp-page'], ['parasites-month', shots.sparse, '.yp-page'], ['medicines-month', shots.meds, '.meds-sheet']]) {
    await page.setContent(html, { waitUntil: 'load' });
    await page.locator(sel).first().screenshot({ path: path.join(dir, name + '.png') });
  }
  expect(fs.existsSync(path.join(dir, 'health-check-month.png'))).toBe(true);
});
