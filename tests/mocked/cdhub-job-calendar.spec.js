// Daily records calendars on Compliance (Lisa 17 Nov 2026: "make a calendar view which will help the user, simple to use
// and log all done so staff or user say done then it shows as green"). Invented rows only.
const { tabClick } = require('../support/tabs');
const { test, expect, HUBS, IDS } = require('../fixtures/job34/load');

const addTable = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-jcal-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};
const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
const TYPE_H = 'id,tenant_id,type_key,label,target,active,effective_from,source,every_days,group,includes,sop,site_scope';
const LOG_H = 'id,tenant_id,check_type_id,area_id,subject_id,item,amount,outcome,happened_at,note,taken_at,taken_by,corrects_id,photo,how_recorded';
const london = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

test('Compliance opens with a calendar per daily job; yesterday done is green; Done today saves one whole-site record and turns today green', async ({ page, guard }) => {
  const today = london(new Date()), yest = london(new Date(Date.now() - 86400000));
  addTable(guard.world, 'BLD-check_type.csv', csv(TYPE_H, [
    'j1,t,food_bowls,Pretend bowls washed,none,true,2020-01-01,,1,,,Cleaning,one_line',
    'j2,t,whole_site_clean,Pretend site cleaned,none,true,2020-01-01,,1,,daily_clean,Cleaning,one_line'
  ]));
  addTable(guard.world, 'BLD-check_log.csv', csv(LOG_H, [
    `l1,t,j1,,,,,ok,,,${yest}T09:00:00Z,Pretend Staff,,,site_tap`
  ]));
  await HUBS.cdhub.open(page, guard);
  await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
  await tabClick(page, '#nav button[data-go="compliance"]');
  const cal = page.locator('#jobCals');
  await expect(cal).toBeVisible();
  await expect(cal.locator('.jcal')).toHaveCount(2);
  const bowls = cal.locator('[data-jcal="food_bowls"]');
  if (yest.slice(0, 7) === today.slice(0, 7)) await expect(bowls.locator(`[data-day="${yest}"]`)).toHaveClass(/\bdone\b/);
  await expect(bowls.locator(`[data-day="${today}"]`)).toHaveClass(/\bdue\b/);
  await expect(cal.locator('[data-jcal="whole_site_clean"] .jd.missed')).toHaveCount(0);   // never recorded: not tracked, not "missed"

  await page.evaluate(() => { window.__sent = []; window.sinkSend = async (b) => { window.__sent.push(b); return { ok: true, result: { status: 'saved', id: 'chk-1', ids: ['chk-1'], at: new Date().toISOString(), who: 'Pretend Owner' } }; }; });
  await bowls.locator('[data-jcal-done="food_bowls"]').click();
  await expect(page.locator('[data-jcal="food_bowls"]').locator(`[data-day="${today}"]`)).toHaveClass(/\bdone\b/);
  await expect(page.locator('[data-jcal="food_bowls"] [data-jcal-done]')).toHaveCount(0);
  await expect(page.locator('[data-jcal="food_bowls"]')).toContainText('Done today');
  const sent = await page.evaluate(() => window.__sent);
  expect(sent).toEqual([{ table: 'check_log', action: 'add_site', fields: { check_type_id: 'j1', outcome: 'ok', how_recorded: 'site_tap' } }]);
});

// Lisa 17 Nov 2026: "Board is hard to find" and "I need to print areas and dogs": one tap each from Main.
test('Main has The Board and Print cards', async ({ page, guard }) => {
  await HUBS.cdhub.open(page, guard);
  await expect(page.locator('[data-open-board]')).toHaveAttribute('href', './staff/');
  await expect(page.locator('[data-open-print]')).toHaveAttribute('href', './staff/print/');
});

// Lisa 22 Nov 2026 ("A"): import past daily records. The file is checked and shown first; one press saves the ready rows.
test('Import: a chosen file is checked row by row; Import saves only the ready rows, marked import, and the days turn green', async ({ page, guard }) => {
  const today = london(new Date()), d1 = london(new Date(Date.now() - 2 * 86400000)), d2 = london(new Date(Date.now() - 3 * 86400000));
  addTable(guard.world, 'BLD-check_type.csv', csv(TYPE_H, ['j1,t,food_bowls,Pretend bowls washed,none,true,2020-01-01,,1,,,Cleaning,one_line']));
  addTable(guard.world, 'BLD-check_log.csv', csv(LOG_H, []));
  await HUBS.cdhub.open(page, guard);
  await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
  await tabClick(page, '#nav button[data-go="compliance"]');
  await page.locator('[data-jcal-import]').click();
  await expect(page.locator('[data-jcal-template]')).toHaveAttribute('href', /^data:text\/csv/);
  const file = `date,job,outcome,note\n${d1},Pretend bowls washed,done,\n${d2},food_bowls,,from paper\n${d2},Nothing here,done,\n2999-01-01,food_bowls,done,\n`;
  await page.locator('[data-jcal-file]').setInputFiles({ name: 'records.csv', mimeType: 'text/csv', buffer: Buffer.from(file) });
  await expect(page.locator('[data-jcal-imp-count]')).toContainText('2 of 4 rows ready');
  await expect(page.locator('.jcal-imp-t tr[data-ok="0"]')).toHaveCount(2);
  await page.evaluate(() => { window.__sent = []; window.sinkSend = async (b) => { window.__sent.push(b); return { ok: true, result: { status: 'saved', id: 'imp-' + window.__sent.length, ids: ['imp-' + window.__sent.length], at: new Date().toISOString(), who: 'Pretend Owner' } }; }; });
  await page.locator('[data-jcal-import-go]').click();
  await expect(page.locator('[data-jcal-imp-done]')).toHaveText('Imported 2 of 2.');
  const sent = await page.evaluate(() => window.__sent);
  expect(sent.map((b) => b.fields)).toEqual([
    { check_type_id: 'j1', outcome: 'ok', how_recorded: 'import', happened_at: d1 + 'T12:00:00Z' },
    { check_type_id: 'j1', outcome: 'ok', how_recorded: 'import', happened_at: d2 + 'T12:00:00Z', note: 'from paper' }
  ]);
  if (d2.slice(0, 7) === today.slice(0, 7)) await expect(page.locator(`[data-jcal="food_bowls"] [data-day="${d2}"]`)).toHaveClass(/\bdone\b/);
});

// 22 Nov 2026 (live bug): the save script refuses a row more than 7 days old unless confirm_unusual is yes. Import sends it
// for past rows (the person reviewed them), and importing the same file again saves nothing twice.
test('Import: a 30-day-old row saves with the confirm; importing the same file again does not duplicate', async ({ page, guard }) => {
  const d30 = london(new Date(Date.now() - 30 * 86400000)), d1 = london(new Date(Date.now() - 86400000));
  addTable(guard.world, 'BLD-check_type.csv', csv(TYPE_H, ['j1,t,food_bowls,Pretend bowls washed,none,true,2020-01-01,,1,,,Cleaning,one_line']));
  addTable(guard.world, 'BLD-check_log.csv', csv(LOG_H, []));
  await HUBS.cdhub.open(page, guard);
  await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
  await tabClick(page, '#nav button[data-go="compliance"]');
  await page.evaluate(() => {   // like Validate.gs: older than 7 days and no confirm = "Save anyway?"
    window.__sent = [];
    window.sinkSend = async (b) => {
      window.__sent.push(b);
      if (Date.parse(b.fields.happened_at) < Date.now() - 168 * 3600000 && b.fields.confirm_unusual !== 'yes') return { ok: false, code: 'INVALID', fields: { happened_at: 'That is more than 7 days ago. Check the date, or save anyway.', confirm_unusual: 'Save anyway?' } };
      return { ok: true, result: { status: 'saved', id: 'imp-' + window.__sent.length, ids: ['imp-' + window.__sent.length], at: new Date().toISOString(), who: 'Pretend Owner' } };
    };
  });
  const file = Buffer.from(`date,job,outcome,note\n${d30},food_bowls,done,\n${d1},food_bowls,done,\n`);
  await page.locator('[data-jcal-import]').click();
  await page.locator('[data-jcal-file]').setInputFiles({ name: 'records.csv', mimeType: 'text/csv', buffer: file });
  await expect(page.locator('.jcal-imp-t tr[data-ok="1"]').first()).toContainText('past date: will be saved as imported');
  await page.locator('[data-jcal-import-go]').click();
  await expect(page.locator('[data-jcal-imp-done]')).toHaveText('Imported 2 of 2.');
  const sent = await page.evaluate(() => window.__sent.map((b) => b.fields));
  expect(sent[0]).toEqual({ check_type_id: 'j1', outcome: 'ok', how_recorded: 'import', happened_at: d30 + 'T12:00:00Z', confirm_unusual: 'yes' });
  expect(sent[1].confirm_unusual).toBeUndefined();
  // the same file again: both rows already recorded, nothing to import, nothing sent
  await page.locator('[data-jcal-import]').click();
  if (await page.locator('[data-jcal-imp]').isHidden()) await page.locator('[data-jcal-import]').click();
  await page.locator('[data-jcal-file]').setInputFiles({ name: 'records.csv', mimeType: 'text/csv', buffer: file });
  await expect(page.locator('[data-jcal-imp-count]')).toContainText('0 of 2 rows ready');
  await expect(page.locator('.jcal-imp-t tr[data-ok="0"]')).toHaveCount(2);
  await expect(page.locator('[data-jcal-import-go]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__sent.length)).toBe(2);
});
