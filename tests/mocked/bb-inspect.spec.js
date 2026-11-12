// Breed Better inspector page (spec S10). Fake script id and fake code only; invented test dogs.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const ID = 'FAKE-TEST-ID-123';
const SCRIPT = 'https://script.google.com/macros/s/' + ID + '/exec';
const CORS = { 'access-control-allow-origin': '*' };
const LINK = 'cdhub/staff/inspect/#s=' + ID + '&c=FAKEINSPECTCODE';

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
    const t = DATA[b.table];
    if (!t) return r.fulfill({ headers: CORS, json: { ok: false, code: 'NOT_ALLOWED', message: 'no' } });
    return r.fulfill({ headers: CORS, json: { ok: true, result: Object.assign({ ends: '2026-11-19T17:00:00' }, t) } });
  });
  return asked;
}

test('S10 the link shows the shared dogs read-only, says when it ends, and never asks for scores', async ({ page }) => {
  const asked = await route(page);
  await page.goto(LINK);
  await expect(page.locator('.ins-dog h2')).toHaveText(['Test Dog One']);
  await expect(page.locator('.ins-ends')).toHaveText('Read only. This link ends 19 Nov 2026.');
  await expect(page.locator('.ins-facts')).toHaveText('Sex female · DOB 2 Mar 2022');
  await expect(page.locator('.ins-row')).toContainText('Tested on 5 Jan 2024');
  expect(asked.some((t) => /score/.test(t))).toBe(false);
  await expect(page.locator('button, input, form')).toHaveCount(0);
});

test('S10 the code is cleared from the address bar and never stored on the device', async ({ page }) => {
  await route(page);
  await page.goto(LINK);
  await expect(page.locator('.ins-dog')).toHaveCount(1);
  expect(page.url()).not.toContain('FAKEINSPECTCODE');
  const kept = await page.evaluate(() => JSON.stringify([Object.assign({}, localStorage), Object.assign({}, sessionStorage), document.cookie]));
  expect(kept).not.toContain('FAKEINSPECTCODE');
  expect(kept).not.toContain(ID);
});

test('S10 an ended or stopped link says so and shows nothing', async ({ page }) => {
  await route(page, { ended: true });
  await page.goto(LINK);
  await expect(page.locator('#screen')).toContainText('This link has ended.');
  await expect(page.locator('.ins-dog')).toHaveCount(0);
});

test('S10 a broken link says it is not complete', async ({ page }) => {
  await page.goto('cdhub/staff/inspect/#c=FAKEINSPECTCODE');
  await expect(page.locator('#screen')).toContainText('This link is not complete.');
});
