// Printed QRs open the staff page on this site (or a configured https address), never a fixed host.
// A qr.base_url rule row in force wins. Invented rows only.
const { test, expect } = require('../support/test');

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };

async function open(page, rules) {
  const tables = {
    area: [{ id: 'ar-a', code: 'Room A' }], requirement: [], subject_status: [], litter: [],
    subject: [{ id: 'd1', name: 'Pretend One', sex: 'Female' }],
    occupancy: [{ subject_id: 'd1', area_id: 'ar-a', moved_in: '2026-10-01' }],
    area_access: [], area_capacity: [], breeding_rule: rules || [],
    qr_tag: [{ tag: 'AAAAAAAA', kind: 'subject', ref_id: 'd1', active: 'true' }, { tag: 'EEEEEEEE', kind: 'area', ref_id: 'ar-a', active: 'true' }]
  };
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[JSON.parse(route.request().postData()).table] || [] } } });
  });
  // record what every QR holds: the drawer is wrapped as soon as it loads
  await page.addInitScript(([c, u]) => {
    localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u);
    window.__qr = [];
    let real;
    Object.defineProperty(window, 'BLDQr', { configurable: true, get() { return real; },
      set(v) { real = Object.assign({}, v, { svg: (text, label) => { window.__qr.push(text); return v.svg(text, label); } }); } });
  }, ['FAKE-OWNER', SCRIPT]);
  await page.goto('cdhub/staff/print/');
}

const STAFF = 'https://ljoyrose.github.io/dashboard/cdhub/staff/';

test('printed QRs use the staff page when no rule is set', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Dog cards' }).click();
  await expect(page.locator('.dcard')).toHaveCount(1);
  await page.getByRole('button', { name: 'Room cards' }).click();
  await expect(page.locator('.rcard')).toHaveCount(1);
  await page.getByRole('button', { name: 'Phone set-up QR' }).click();
  const qr = await page.evaluate(() => window.__qr);
  expect(qr).toContain(STAFF + '#s/AAAAAAAA');
  expect(qr).toContain(STAFF + '#s/EEEEEEEE');
  expect(qr.some((t) => t.indexOf(STAFF + '#setup=') === 0)).toBe(true);
  expect(qr.filter((t) => /pages\.dev/.test(t) || /127\.0\.0\.1/.test(t) || t.indexOf('/print/') >= 0)).toEqual([]);
  expect(await page.locator('.sheet').innerText()).not.toMatch(/https?:|www\./);
});

test('a configured staff address does not replace the staff page', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { DASH_CONFIG.cdhub.publicStaffBase = 'https://example.test/staff/'; });
  await page.getByRole('button', { name: 'Dog cards' }).click();
  await expect(page.locator('.dcard')).toHaveCount(1);
  expect(await page.evaluate(() => window.__qr)).toEqual([STAFF + '#s/AAAAAAAA']);
});

test('the qr.base_url rule in force wins over the staff page', async ({ page }) => {
  await open(page, [
    { rule_key: 'qr.base_url', value: 'https://example.org/old/', from_date: '2026-01-01', to_date: '2026-02-01', source: 'Pretend' },
    { rule_key: 'qr.base_url', value: 'https://example.org/now/', from_date: '2026-03-01', source: 'Pretend' }]);
  await page.getByRole('button', { name: 'Dog cards' }).click();
  await expect(page.locator('.dcard')).toHaveCount(1);
  expect(await page.evaluate(() => window.__qr)).toEqual(['https://example.org/now/#s/AAAAAAAA']);
});
