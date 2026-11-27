// Print page in owner mode (Google sign-in, no staff code): the access token runs out mid-visit. The page must say the
// sign-in ran out, not "Enter your staff code.", send nothing without a sign-in, and work again once the sign-in is
// renewed in another tab (the token is read from browser storage at each button press). Fake token and fake data only.
const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const AUTH = 'ljr-dash-auth';
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

test('owner sign-in runs out mid-visit: thermometer cards say the sign-in ran out, send nothing, and work after a renewal @regression', async ({ page }) => {
  const tables = { area: [{ id: 'area-t1', code: 'T1' }], requirement: [], area_capacity: [], area_access: [], check_type: [], breeding_rule: [],
    qr_tag: [{ tag: 'AAAA3333', kind: 'thermometer', ref_id: 'thm-1', active: 'true' }, { tag: 'BBBB3333', kind: 'area', ref_id: 'area-t1', active: 'true' }],
    thermometer: [{ id: 'thm-1', name: 'Hall', area_id: 'area-t1' }] };
  const sent = [];
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    sent.push(b);
    return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[b.table] || [], role: 'OWNER' } } });
  });
  await page.addInitScript(([u, k, s]) => {
    if (!sessionStorage.getItem('test.started')) {   // first load only: later steps change the sign-in by hand
      sessionStorage.setItem('test.started', '1');
      localStorage.setItem(k, JSON.stringify({ access_token: 'fake-owner-token-0003', expires_at: Date.now() + 1800000, scope: s }));
      localStorage.setItem('cdhub.sink.url', u);
    }
  }, [SCRIPT, AUTH, SCOPE]);
  await page.goto('cdhub/staff/print/');

  await page.getByRole('button', { name: 'Room cards' }).click();
  await expect(page.locator('p.msg')).toContainText('cards ready');

  // the hour is up
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify({ access_token: 'fake-owner-token-0003', expires_at: Date.now() - 1000, scope: s })), [AUTH, SCOPE]);
  const before = sent.length;
  await page.getByRole('button', { name: 'Thermometer cards' }).click();
  const msg = page.locator('p.msg');
  await expect(msg).toContainText('Google sign-in has run out');
  await expect(msg).not.toContainText('Enter your staff code');
  expect(sent.length, 'nothing is sent without a sign-in').toBe(before);

  // CD Hub in another tab signs in again
  await page.evaluate(([k, s]) => localStorage.setItem(k, JSON.stringify({ access_token: 'fake-owner-token-0004', expires_at: Date.now() + 1800000, scope: s })), [AUTH, SCOPE]);
  await page.getByRole('button', { name: 'Thermometer cards' }).click();
  await expect(page.locator('.qcard b')).toHaveText(['Hall']);
  const after = sent.slice(before);
  expect(after.length).toBeGreaterThan(0);
  for (const b of after) { expect(b.google_token).toBe('fake-owner-token-0004'); expect(b.code).toBe(''); }
});
