// Printed QRs point at the public staff page (the owner 18 Nov 2026): the owner and Grace may print from the Cloudflare copy, which
// needs a Cloudflare sign-in, but staff, guests, vets and inspectors scan without one. The QR address comes from the owner's
// qr.base_url rule row (dated), else the starting default; never from the address of the page doing the printing.
// Invented rows only.
const { test, expect } = require('../support/test');

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const START = 'https://ljoyrose.github.io/dashboard/cdhub/staff/';

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

test('printed QRs open the public staff page, not the page they were printed from (e.g. a pages.dev copy)', async ({ page }) => {
  await open(page);
  const here = new URL(page.url()).origin;
  expect(here).not.toBe(new URL(START).origin);   // the test page is served from somewhere else, as the Cloudflare copy is
  await page.getByRole('button', { name: 'Dog cards' }).click();
  await expect(page.locator('.dcard')).toHaveCount(1);
  await page.getByRole('button', { name: 'Room cards' }).click();
  await expect(page.locator('.rcard')).toHaveCount(1);
  await page.getByRole('button', { name: 'Phone set-up QR' }).click();
  const qr = await page.evaluate(() => window.__qr);
  expect(qr).toContain(START + '#s/AAAAAAAA');
  expect(qr).toContain(START + '#s/EEEEEEEE');
  expect(qr.some((t) => t.indexOf(START + '#setup=') === 0)).toBe(true);
  expect(qr.filter((t) => t.indexOf(here) === 0)).toEqual([]);
  // no address is printed on the cards (the owner 13 Nov 2026): the address lives only inside the QR
  expect(await page.locator('.sheet').innerText()).not.toMatch(/https?:|www\./);
});

test('the owner\'s qr.base_url row in force wins; a future row, an ended row and a bad address do not', async ({ page }) => {
  await open(page, [
    { rule_key: 'qr.base_url', value: 'https://example.org/old/', from_date: '2026-01-01', to_date: '2026-02-01', source: 'Pretend' },
    { rule_key: 'qr.base_url', value: 'https://example.org/now/', from_date: '2026-03-01', source: 'Pretend' },
    { rule_key: 'qr.base_url', value: 'http://example.org/insecure/', from_date: '2026-04-01', source: 'Pretend' },
    { rule_key: 'qr.base_url', value: 'https://example.org/later/', from_date: '2999-01-01', source: 'Pretend' }]);
  await page.getByRole('button', { name: 'Dog cards' }).click();
  await expect(page.locator('.dcard')).toHaveCount(1);
  expect(await page.evaluate(() => window.__qr)).toEqual(['https://example.org/now/#s/AAAAAAAA']);
});
