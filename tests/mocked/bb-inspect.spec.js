// Breed Better inspector page (spec S10), laid out to the owner's inspector design (13 Nov 2026).
// Fake script id and fake code only; invented test dogs. The inspector sees Pass / Unverified / Fail on the must-pass checks
// (owner's answer, 13 Nov 2026) when the script sends a must-pass summary; never points, the target, ranking or notes.
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

async function route(page, opts, data) {
  data = data || DATA;
  const asked = [];
  await page.route(SCRIPT, (r) => {
    if (r.request().method() === 'GET') return r.fulfill({ headers: CORS, json: { saveEnabled: false, readEnabled: true, tables: [], version: 'test' } });
    const b = JSON.parse(r.request().postData());
    asked.push(b.table);
    if (opts && opts.ended) return r.fulfill({ headers: CORS, json: { ok: false, code: 'BAD_CODE', message: 'ended' } });
    const t = data[b.table];
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
  await expect(page.locator('.ins-facts')).toHaveText('female · DOB 2 Mar 2022');
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
  await expect(page.locator('#screen')).toContainText('Not shared on this link: Microchip, Status, Fit to Breed, Litters.');
});

test('S10 a broken link says it is not complete', async ({ page }) => {
  await page.goto('cdhub/staff/inspect/#c=FAKEINSPECTCODEX');
  await expect(page.locator('#screen')).toContainText('This link is not complete.');
});

// ---- the owner's inspector design: must-pass words, litters against the limit, chip last 4, A to Z; never points
const FULL = {
  subject: { fields: ['id', 'name', 'sex', 'dob'], rows: [
    { id: 'sub-test-dog-2', name: 'Test Dog B', sex: 'male', dob: '2023-01-09' },
    { id: 'sub-test-dog-1', name: 'Test Dog A', sex: 'female', dob: '2021-03-02' }] },
  microchip: { fields: ['subject_id', 'chip_number'], rows: [{ subject_id: 'sub-test-dog-1', chip_number: '0000' }, { subject_id: 'sub-test-dog-2', chip_number: '1111' }] },
  health_screen: { fields: ['id', 'subject_id', 'test', 'grade', 'tested_on'], rows: [
    { id: 'h1', subject_id: 'sub-test-dog-1', test: 'hips', grade: 'Good', tested_on: '2022-06-14' },
    { id: 'h2', subject_id: 'sub-test-dog-2', test: 'hips', grade: 'Excellent', tested_on: '2024-02-20' }] },
  fit_to_breed: { fields: ['id', 'subject_id', 'outcome', 'assessed_on', 'valid_until'], rows: [{ id: 'f1', subject_id: 'sub-test-dog-1', outcome: 'Fit', assessed_on: '2026-10-03', valid_until: '2027-10-03' }] },
  litter: { fields: ['id', 'dam_subject_id', 'dob'], rows: [
    { id: 'l1', dam_subject_id: 'sub-test-dog-1', dob: '2026-03-02' }, { id: 'l2', dam_subject_id: 'sub-test-dog-1', dob: '2024-05-01' }, { id: 'l3', dam_subject_id: 'sub-test-dog-1', dob: '2023-04-01' }] },
  breeding_rule: { fields: ['rule_key', 'value', 'effective_from'], rows: [{ rule_key: 'max_litters_per_dam', value: '6', effective_from: '2020-01-01' }] },
  must_pass: { fields: ['subject_id', 'label', 'outcome', 'answer', 'date', 'due_date', 'evidence_table', 'evidence_id', 'points'], rows: [
    { subject_id: 'sub-test-dog-1', label: 'Hips X-ray', outcome: 'pass', answer: 'Good', date: '2022-06-14', evidence_table: 'BLD-health_screen', evidence_id: 'h1', points: '15' },
    { subject_id: 'sub-test-dog-1', label: 'Fit to Breed', outcome: 'pass', answer: 'Fit', date: '2026-10-03', due_date: '2027-10-03', points: '25' },
    { subject_id: 'sub-test-dog-2', label: 'Hips X-ray', outcome: 'pass', answer: 'Excellent', date: '2024-02-20' },
    { subject_id: 'sub-test-dog-2', label: 'Fit to Breed', outcome: 'unverified' }] }
};

test('S10 inspector layout: A to Z, chip last 4, must-pass words per line and per dog, litters x of the rule limit; never points', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-13T10:00:00Z'));
  await route(page, {}, FULL);
  await page.goto(LINK);
  await expect(page.locator('.ins-dog h2')).toHaveText(['Test Dog A', 'Test Dog B']);
  const a = page.locator('.ins-dog').nth(0), b = page.locator('.ins-dog').nth(1);
  await expect(a.locator('.ins-facts')).toHaveText('female · DOB 2 Mar 2021 · Chip \u2022\u2022\u2022\u20220000');
  await expect(a.locator('.ins-head .ins-v')).toHaveText('Pass');
  await expect(b.locator('.ins-head .ins-v')).toHaveText('Unverified');
  await expect(a.locator('.ins-check', { hasText: 'Hips X-ray' })).toContainText('Good · 14 Jun 2022');
  await expect(a.locator('.ins-check', { hasText: 'Fit to Breed' })).toContainText('due 3 Oct 2027');
  await expect(b.locator('.ins-check', { hasText: 'Fit to Breed' }).locator('.ins-v')).toHaveText('Unverified');
  await expect(b.locator('.ins-check', { hasText: 'Fit to Breed' })).toContainText('No record yet');
  const lit = a.locator('.ins-check', { hasText: 'Litters' });
  await expect(lit).toContainText('3 of 6');
  await expect(lit).toContainText('Last 2 Mar 2026 · 1 in last 12 months');
  // Open folds the shared record in place; nothing on the page can change anything
  await a.locator('.ins-check', { hasText: 'Hips X-ray' }).locator('summary', { hasText: 'Open' }).click();
  await expect(a.locator('.ins-check', { hasText: 'Hips X-ray' }).locator('.ins-row')).toContainText('Grade Good');
  await expect(page.locator('button, input, form, select, textarea')).toHaveCount(0);
  // inspectors never see points, the target, Below target or ranking
  await expect(page.locator('#screen')).not.toContainText(/points|target|Below target|rank/i);
  await expect(page.locator('#screen')).not.toContainText('Unproven');
});

test('S10 without a must-pass summary the inspector sees the records only, with no verdict words', async ({ page }) => {
  const plain = Object.assign({}, FULL); delete plain.must_pass;
  await route(page, {}, plain);
  await page.goto(LINK);
  await expect(page.locator('.ins-dog')).toHaveCount(2);
  await expect(page.locator('.ins-v')).toHaveCount(0);
  await expect(page.locator('.ins-dog').nth(0).locator('.ins-check', { hasText: 'Hips' })).toContainText('Good · 14 Jun 2022');
  await expect(page.locator('#screen')).not.toContainText(/Not shared on this link:.*(Must pass|Breeding)/);
});
