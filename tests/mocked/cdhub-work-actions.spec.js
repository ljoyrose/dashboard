// Outstanding: Done, Reassign, Snooze on every waiting row (the owner 19 Nov 2026: "nothing to reassign or say done to take it off").
// Each tap adds one dated BLD-requirement row pointing at the work row; BLD-WORK is never changed. Invented rows only.
const { test: base, expect } = require('../support/test');
const { buildWorld, IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

const SINK = 'https://script.google.com/macros/s/PRETENDSCRIPT/exec';
const todayLondon = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const plus = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const WORK = [
  'id,raised_on,raised_by,area,item,status,blocked_on,owner,evidence,note',
  'W901,2026-11-01,Lisa,areas,Pretend screws in a door,BLOCKED,Lisa to fit,Lisa,,',
  'W902,2026-11-01,Lisa,dogs,Pretend colour ruling,BLOCKED,Lisa to rule,Lisa,,',
  'W903,2026-11-01,Lisa,health,Pretend grouped checks,OPEN,,Claude,,',
  'W904,2026-11-01,Lisa,areas,Pretend measured rooms,BLOCKED,Lisa to measure,Lisa,,',
].join('\n') + '\n';
const REQ_HEAD = 'id,tenant_id,need_type,target_table,target_id,from_date,to_date,source,set_by,set_on';

const setTable = (d, id, name, content) => {
  const f = d.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else d.file(id, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};
const withRows = (req, rules) => base.extend({ world: async ({}, use) => {
  const d = buildWorld();
  setTable(d, 'wk-work', 'BLD-WORK.csv', WORK);
  if (req) {
    const f = d.files.find((x) => x.name === 'BLD-requirement.csv');
    const body = req.join('\n') + '\n';
    if (f) { f.content = f.content.replace(/\n?$/, '\n') + body; f.size = String(f.content.length); }
    else setTable(d, 'wk-req', 'BLD-requirement.csv', REQ_HEAD + '\n' + body);
  }
  if (rules) {
    const f = d.files.find((x) => x.name === 'BLD-breeding_rule.csv');
    if (f) { f.content = f.content.replace(/\n?$/, '\n') + rules.join('\n') + '\n'; f.size = String(f.content.length); }
  }
  use(d);
} });

async function openWork(page, opts = {}) {
  const sent = [];
  await page.route(SINK, async (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    sent.push(b);
    if (opts.fail) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, code: 'BUSY_FOR_GOOD', message: 'Pretend failure' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id: 'req-new-' + sent.length } }) });
  });
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  if (opts.saving !== false) await page.evaluate((url) => { localStorage.setItem('cdhub.sink.url', url); localStorage.setItem('cdhub.sink.code', 'pretend-code'); }, SINK);
  await page.goto('cdhub/#/work');
  await expect(page.locator('#work-W901')).toBeVisible();
  return sent;
}

const plain = withRows();
plain('every waiting row has Done, Reassign and Snooze', async ({ page }) => {
  await openWork(page);
  for (const id of ['W901', 'W902', 'W903', 'W904']) {
    const row = page.locator('#work-' + id);
    await expect(row.locator('[data-wk-done]')).toHaveText('Done');
    await expect(row.locator('[data-wk-open^="re:"]')).toHaveText('Reassign');
    await expect(row.locator('[data-wk-open^="sn:"]')).toHaveText('Snooze');
  }
});

plain('Done saves one dated row, ticks, and the row leaves Waiting on you', async ({ page }) => {
  const sent = await openWork(page);
  await page.locator('#work-W901 [data-wk-done]').click();
  await expect(page.locator('[data-saved="good"]').first()).toContainText(/^Saved \d\d:\d\d\. W901: done\.$/);
  expect(sent).toHaveLength(1);
  expect(sent[0].table).toBe('requirement');
  expect(sent[0].action).toBe('add');
  expect(sent[0].fields).toEqual({ need_type: 'work.done', from_date: todayLondon(), source: 'Marked done on Outstanding', target_table: 'work', target_id: 'W901' });
  await expect(page.locator('#work-W901')).toHaveCount(0);
  await expect(page.locator('[data-wk-note]')).toContainText('W901: done.');
  await expect(page.locator('[data-work-sum]')).toContainText('Waiting on you 2');
});

plain('Reassign offers the starting list, moves the row and says who it waits on', async ({ page }) => {
  const sent = await openWork(page);
  await page.locator('#work-W902 [data-wk-open^="re:"]').click();
  const opts = page.locator('#work-W902 [data-wk-to]');
  await expect(opts).toHaveText(['Claude', 'Staff']);   // not the current owner
  await page.locator('#work-W902 [data-wk-to="Staff"]').click();
  expect(sent[0].fields).toMatchObject({ need_type: 'work.owner.Staff', target_table: 'work', target_id: 'W902', from_date: todayLondon() });
  const row = page.locator('#work-W902');
  await expect(row).toBeVisible();
  await expect(row).toContainText('Waiting on Staff');
  await expect(row.locator('xpath=ancestor::div[@data-find-group]//h4')).toContainText('Waiting on me');
});

plain('Snooze hides the row until its date; Cancel closes the choice without saving', async ({ page }) => {
  const sent = await openWork(page);
  await page.locator('#work-W904 [data-wk-open^="sn:"]').click();
  await expect(page.locator('#work-W904 [data-wk-days]')).toHaveText(['1 day', '7 days', '30 days']);
  await page.locator('#work-W904 [data-wk-open=""]').click();
  await expect(page.locator('#work-W904 [data-wk-days]')).toHaveCount(0);
  expect(sent).toHaveLength(0);
  await page.locator('#work-W904 [data-wk-open^="sn:"]').click();
  await page.locator('#work-W904 [data-wk-days="7"]').click();
  expect(sent[0].fields).toMatchObject({ need_type: 'work.snooze', from_date: todayLondon(), to_date: plus(todayLondon(), 7) });
  const row = page.locator('#work-W904');
  await expect(row.locator('xpath=ancestor::div[@data-find-group]//h4')).toContainText('Snoozed');
});

const withActions = withRows([
  `req-a,ten-x,work.done,work,W901,2026-11-12,,Pretend done,sc-aaaaaa,2026-11-12T10:00:00Z`,
  `req-b,ten-x,work.snooze,work,W902,2020-01-01,2020-01-08,Pretend old snooze,sc-aaaaaa,2020-01-01T10:00:00Z`,
  `req-c,ten-x,work.snooze,work,W904,2026-01-01,2099-01-01,Pretend long snooze,sc-aaaaaa,2026-01-01T10:00:00Z`,
], ['r-wk,ten-x,work.snooze.days,2|14,2020-01-01,Owner setting,,2020-01-01T00:00:00Z,sc-aaaaaa,,']);
withActions('rows already done stay off; an ended snooze is back; the owner setting decides the snooze choices', async ({ page }) => {
  await page.route(SINK, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"result":{"status":"saved","id":"x"}}' }));
  await page.goto('cdhub/');
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  await page.evaluate((url) => { localStorage.setItem('cdhub.sink.url', url); localStorage.setItem('cdhub.sink.code', 'pretend-code'); }, SINK);
  await page.goto('cdhub/#/work');
  await expect(page.locator('#work-W902')).toBeVisible();
  await expect(page.locator('#work-W901')).toHaveCount(0);   // done on 12 Nov: off the lists
  await expect(page.locator('#work-W904')).toContainText('Back 1 Jan 2099');
  await page.locator('#work-W902 [data-wk-open^="sn:"]').click();
  await expect(page.locator('#work-W902 [data-wk-days]')).toHaveText(['2 days', '14 days']);
});

plain('without saving set up, the row says how to act instead of offering dead buttons', async ({ page }) => {
  await openWork(page, { saving: false });
  await expect(page.locator('#work-W901 [data-wk-done]')).toHaveCount(0);
  await expect(page.locator('#work-W901')).toContainText('set up saving on this device first');
});

plain('a failed save says so and the row stays', async ({ page }) => {
  await page.unroute(SINK).catch(() => {});
  await openWork(page, { fail: true });
  await page.locator('#work-W901 [data-wk-done]').click();
  await expect(page.locator('#work-W901 [data-saved="bad"]')).toHaveText('Not saved: Pretend failure. Nothing changed; try again.');
  await expect(page.locator('#work-W901')).toBeVisible();
});

// Photo after Done (shared helper staff/lib/evidence-photo.js): the done row is saved first, then a photo may join it as evidence.
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
plain('Done on Outstanding offers a photo under the done note; a chosen one is linked to the saved row @regression', async ({ page }) => {
  const sent = await openWork(page);
  await page.locator('#work-W901 [data-wk-done]').click();
  await expect(page.locator('#work-W901')).toHaveCount(0);
  const offer = page.locator('[data-done-photo="work"] [data-ev-photo]');
  await expect(offer).toContainText('Add photo');
  expect(sent).toHaveLength(1);   // the done row is saved before any photo
  await offer.locator('input[type=file]').setInputFiles({ name: 'screws.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') });
  await expect(offer).toContainText('Photo kept');
  expect(sent.map((b) => b.action)).toEqual(['add', 'file_add', 'link_add']);
  expect(sent[2].fields).toMatchObject({ from_table: 'requirement', from_id: 'req-new-1', role: 'evidence', to_table: 'files', to_id: 'req-new-2' });
});

withRows(null, ['r-np,ten-x,job.done_photo.work,no,2020-01-01,Owner setting,,2020-01-01T00:00:00Z,sc-aaaaaa,,'])('with job.done_photo.work = no, Done offers no photo', async ({ page }) => {
  const sent = await openWork(page);
  await page.locator('#work-W901 [data-wk-done]').click();
  await expect(page.locator('[data-wk-note="W901"]')).toContainText('W901: done.');
  await expect(page.locator('[data-ev-photo]')).toHaveCount(0);
  expect(sent).toHaveLength(1);
});
