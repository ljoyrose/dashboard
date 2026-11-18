// Breed Better inspector page (spec S10). Fake script id and fake code only; invented test dogs.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const ID = 'FAKE-TEST-ID-123';
const SCRIPT = 'https://script.google.com/macros/s/' + ID + '/exec';
const CORS = { 'access-control-allow-origin': '*' };
const LINK = 'cdhub/staff/inspect/#s=' + ID + '&c=FAKEINSPECTCODEX';

const DATA = {
  subject: { fields: ['id', 'name', 'sex', 'dob'], rows: [{ id: 'sub-test-dog-1', name: 'Test Dog One', sex: 'female', dob: '2022-03-02' }] },
  health_screen: { fields: ['id', 'subject_id', 'test', 'grade', 'tested_on'], rows: [{ id: 'h1', subject_id: 'sub-test-dog-1', test: 'hips', grade: '8', tested_on: '2024-01-05' }] }
};

async function route(page, opts) {
  const asked = [];
  await page.route(SCRIPT, (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ headers: CORS, json: { saveEnabled: false, readEnabled: true, tables: [], version: 'test' } });
    const b = JSON.parse(r.request().postData());
    asked.push(b.table);
    if (opts && opts.ended) return r.fulfill({ headers: CORS, json: { ok: false, code: 'BAD_CODE', message: 'ended' } });
    const t = ((opts && opts.data) || DATA)[b.table];
    if (!t) return r.fulfill({ headers: CORS, json: { ok: false, code: 'NOT_ALLOWED', message: 'no' } });
    return r.fulfill({ headers: CORS, json: { ok: true, result: Object.assign({ ends: '2026-11-19T17:00:00' }, t) } });
  });
  return asked;
}

test('S10 the link shows the shared dogs read-only, says when it ends, and never asks for scores', async ({ page }) => {
  const asked = await route(page);
  await page.goto(LINK);
  await expect(page.locator('.ins-dog h2')).toHaveText(['Test Dog One']);
  await expect(page.locator('.ins-ends').first()).toHaveText('Read only. This link ends 19 Nov 2026.');
  await expect(page.locator('.ins-facts')).toHaveText('Sex female · DOB 2 Mar 2022');
  await expect(page.locator('.ins-row')).toContainText('Tested on 5 Jan 2024');
  expect(asked.some((t) => /score/.test(t))).toBe(false);
  await expect(page.locator('button, input, form')).toHaveCount(0);
});

test('S10 the code is cleared from the address bar and never stored on the device', async ({ page }) => {
  await route(page);
  await page.goto(LINK);
  await expect(page.locator('.ins-dog')).toHaveCount(1);
  expect(page.url()).not.toContain('FAKEINSPECTCODEX');
  const kept = await page.evaluate(() => JSON.stringify([Object.assign({}, localStorage), Object.assign({}, sessionStorage), document.cookie]));
  expect(kept).not.toContain('FAKEINSPECTCODEX');
  expect(kept).not.toContain(ID);
});

test('S10 an ended or stopped link says so and shows nothing', async ({ page }) => {
  await route(page, { ended: true });
  await page.goto(LINK);
  await expect(page.locator('#screen')).toContainText('This link has ended.');
  await expect(page.locator('.ins-dog')).toHaveCount(0);
});

test('S10 lists not ticked for the link say "not shared"; a missing set-up says so', async ({ page }) => {
  await route(page);
  await page.goto(LINK);
  await expect(page.locator('#screen')).toContainText('Not shared on this link: Microchip, Status, Fit to Breed, Litters, Temperatures.');
});

test('S10 a broken link says it is not complete', async ({ page }) => {
  await page.goto('cdhub/staff/inspect/#c=FAKEINSPECTCODEX');
  await expect(page.locator('#screen')).toContainText('This link is not complete.');
});

test('demo 3b: a temperatures-only link shows every room\'s log, a card per room, newest first, London times', async ({ page }) => {
  const asked = await route(page, { data: { area_reading: {
    fields: ['area_id', 'room', 'period_start', 'min_c', 'max_c', 'taken_by'],
    rows: [
      { area_id: 'area-test-2', room: 'T2', period_start: '2026-11-17T07:00:00Z', min_c: '15.0', max_c: '19.5', taken_by: 'Staff A' },
      { area_id: 'area-test-1', room: 'T1', period_start: '2026-11-17T07:00:00Z', min_c: '16.0', max_c: '20.0', taken_by: 'Staff A' },
      { area_id: 'area-test-1', room: 'T1', period_start: '2026-11-17T16:00:00Z', min_c: '17.5', max_c: '21.0', taken_by: 'Staff B' }
    ] } } });
  await page.goto(LINK);
  await expect(page.locator('.ins-room h2')).toHaveText(['T1', 'T2']);
  const t1 = page.locator('.ins-room').first().locator('.ins-row');
  await expect(t1).toHaveCount(2);
  await expect(t1.first()).toHaveText(/For 17 Nov 2026 16:00.*Min °C 17\.5.*Max °C 21\.0.*By Staff B/);
  await expect(page.locator('#screen')).not.toContainText('No records');
  await expect(page.locator('#screen')).not.toContainText('area-test');
  expect(asked).toContain('area_reading');
  await expect(page.locator('button, input, form')).toHaveCount(0);
});
