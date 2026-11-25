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

// Lisa 22 Nov 2026: "can it also have the photos as then we would click and show image as we will for diary entries".
test('tapping a day on a calendar opens who and when, and its diary photo; tapping again closes it', async ({ page, guard }) => {
  const yest = london(new Date(Date.now() - 86400000));
  addTable(guard.world, 'BLD-check_type.csv', csv(TYPE_H, ['j1,t,food_bowls,Pretend bowls washed,none,true,2020-01-01,,1,,,Cleaning,one_line']));
  addTable(guard.world, 'BLD-check_log.csv', csv(LOG_H, [`l1,t,j1,,,,,ok,,From the diary,${yest}T09:00:00Z,Pretend Staff,,,paper`]));
  addTable(guard.world, 'BLD-files.csv', csv('id,tenant_id,kind,drive_file_id,url,mime,name,size_bytes,taken_on,sha256,source,set_by,set_on,created_at,updated_at',
    ['f1,t,upload,1FAKEDIARYPAGEIDFORTESTS000000aa,,image/jpeg,diary-page.jpg,1,,,,o,,,']));
  addTable(guard.world, 'BLD-links.csv', csv('id,tenant_id,from_table,from_id,role,to_table,to_id,from_date,to_date,set_by,set_at',
    [`k1,t,check_log,l1,evidence,files,f1,${yest},,o,`]));
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.route(/\/drive\/v3\/files\/1FAKEDIARYPAGEIDFORTESTS000000aa\?alt=media/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await HUBS.cdhub.open(page, guard);
  await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
  await tabClick(page, '#nav button[data-go="compliance"]');
  if (yest.slice(0, 7) !== london(new Date()).slice(0, 7)) await page.locator('#jobCals [data-jcal-month]').first().click();
  const day = page.locator(`[data-jcal="food_bowls"] [data-jcal-day="${yest}"]`);
  await expect(day).toHaveClass(/\bph\b/);
  await day.click();
  const detail = page.locator(`[data-jcal="food_bowls"] [data-jcal-detail="${yest}"]`);
  await expect(detail).toContainText('Pretend Staff');
  await expect(detail).toContainText('From the diary');
  await expect(detail.locator('[data-jcal-photo]')).toHaveAttribute('href', 'https://drive.google.com/file/d/1FAKEDIARYPAGEIDFORTESTS000000aa/view');
  await expect(detail.locator('[data-jcal-photo] img')).toHaveAttribute('alt', 'evidence: diary-page.jpg');
  await expect(detail.locator('[data-jcal-photo] img')).toHaveAttribute('src', /^blob:/);   // read with the sign-in, never a public Google address
  await page.locator(`[data-jcal="food_bowls"] [data-jcal-day="${yest}"]`).click();
  await expect(page.locator('[data-jcal-detail]')).toHaveCount(0);
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

// Lisa 22 Nov 2026: "add a cancel function to the import". Cancel clears the checked file (nothing saved); during an
// import it reads Stop, and rows not yet sent are not sent.
test('Import: Cancel clears the file with nothing saved; Stop during an import leaves the unsent rows unsent', async ({ page, guard }) => {
  const day = (n) => london(new Date(Date.now() - n * 86400000));
  addTable(guard.world, 'BLD-check_type.csv', csv(TYPE_H, ['j1,t,food_bowls,Pretend bowls washed,none,true,2020-01-01,,1,,,Cleaning,one_line']));
  addTable(guard.world, 'BLD-check_log.csv', csv(LOG_H, []));
  await HUBS.cdhub.open(page, guard);
  await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
  await tabClick(page, '#nav button[data-go="compliance"]');
  await page.locator('[data-jcal-import]').click();
  const file = `Csv,,,\ndate,job,outcome,note\n${day(2)},food_bowls,done,\n${day(3)},food_bowls,done,\n${day(4)},food_bowls,done,\n`;
  await page.locator('[data-jcal-file]').setInputFiles({ name: 'records.csv', mimeType: 'text/csv', buffer: Buffer.from(file) });
  await expect(page.locator('[data-jcal-imp-count]')).toContainText('3 of 3 rows ready');   // the title line is not a row
  await page.evaluate(() => { window.__sent = []; window.sinkSend = async (b) => { window.__sent.push(b); return { ok: true, result: { status: 'saved', id: 'x' } }; }; });
  await page.locator('[data-jcal-import-cancel]').click();
  await expect(page.locator('[data-jcal-cancelled]')).toContainText('Nothing was saved');
  await expect(page.locator('[data-jcal-import-go]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__sent.length)).toBe(0);
  // choose the file again; this time Import, then Stop after the first row
  await page.locator('[data-jcal-file]').setInputFiles({ name: 'records.csv', mimeType: 'text/csv', buffer: Buffer.from(file) });
  await expect(page.locator('[data-jcal-imp-count]')).toContainText('3 of 3 rows ready');
  await page.evaluate(() => { window.__sent = []; let n = 0; window.sinkSend = (b) => { window.__sent.push(b); n++; return new Promise((r) => { window.__release = () => r({ ok: true, result: { status: 'saved', id: 's' + n } }); }); }; });
  await page.locator('[data-jcal-import-go]').click();
  await expect(page.locator('[data-jcal-import-cancel]')).toHaveText('Stop');
  await page.locator('[data-jcal-import-cancel]').click();
  await page.evaluate(() => window.__release());
  await expect(page.locator('[data-jcal-imp-done]')).toHaveText('Imported 1 of 3. Stopped: the other 2 were not sent.');
  expect(await page.evaluate(() => window.__sent.length)).toBe(1);
});
// Lisa 23 Nov 2026 (phone screenshot: "Make it clearer between part done (orange) and missed (red)". Missed is a red
// frame with a small cross, part done an orange frame on a light orange fill; the key shows all three the same way.
test('daily records: done, part done and missed look different (not by colour alone), the key matches, and the cross reads in light and dark @regression', async ({ page, guard }) => {
  addTable(guard.world, 'BLD-check_type.csv', csv(TYPE_H, ['j1,t,food_bowls,Pretend bowls washed,none,true,2020-01-01,,1,,,Cleaning,one_line']));
  addTable(guard.world, 'BLD-check_log.csv', csv(LOG_H, [`l1,t,j1,,,,,ok,,,${london(new Date(Date.now() - 3 * 86400000))}T09:00:00Z,Pretend Staff,,,site_tap`]));
  await HUBS.cdhub.open(page, guard);
  await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
  await tabClick(page, '#nav button[data-go="compliance"]');
  const key = page.locator('#jobCals .jcal-key');
  await expect(key.locator('[data-jcal-legend]')).toHaveCount(3);
  await expect(key).toContainText('done');
  await expect(key).toContainText('part done');
  await expect(key).toContainText('missed');
  const lum = (rgb) => { const c = rgb.match(/\d+/g).slice(0, 3).map((v) => { v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  for (const scheme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: scheme });
    const look = await key.evaluate((k) => {
      const s = (n) => getComputedStyle(k.querySelector('[data-jcal-legend="' + n + '"]'));
      const a = getComputedStyle(k.querySelector('[data-jcal-legend="missed"]'), '::after');
      const card = getComputedStyle(k.closest('.card') || document.body).backgroundColor;
      return { part: { frame: s('part').boxShadow, fill: s('part').backgroundColor }, missed: { frame: s('missed').boxShadow, fill: s('missed').backgroundColor, mark: a.content, markColour: a.color }, done: s('done').backgroundColor, card: card };
    });
    expect(look.missed.mark).toBe('"✕"');                          // missed has its own mark, so it never relies on colour
    expect(look.part.frame).not.toBe(look.missed.frame);           // different frame colours
    expect(look.part.fill).not.toBe(look.missed.fill);             // part done has a fill, missed has none
    expect(look.done).not.toBe(look.part.fill);
    const [l1, l2] = [lum(look.missed.markColour), lum(look.card)].sort((x, y) => y - x);
    expect((l1 + 0.05) / (l2 + 0.05), scheme + ' cross contrast').toBeGreaterThanOrEqual(4.5);
  }
  // a real missed day in the month carries the class (and so the cross)
  await expect(page.locator('#jobCals [data-jcal="food_bowls"] .jd.missed').first()).toBeVisible();
  // done days are green, not the grey button fill (Lisa: the ticks were grey)
  const doneBg = await page.locator('#jobCals button.jd.done').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(doneBg.replace(/\s/g, '')).toMatch(/81,173,87/);
});
