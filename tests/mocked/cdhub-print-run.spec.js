const { test, expect } = require('../support/test');

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };

test('t-cdhub-print-run-spec-1', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  let held = false;
  const sent = [];
  const tables = {
    area: [{ id: 'r01', code: 'R01' }],
    subject: [{ id: 'd01', name: 'Dog A' }],
    occupancy: [{ subject_id: 'd01', area_id: 'r01', moved_in: '2026-01-01' }],
    litter: [{ id: 'l01', dam_subject_id: 'd01', born_on: '2026-01-02' }],
    requirement: [],
    thermometer: Array.from({ length: 24 }, function (_, n) {
      var id = 't' + String(n + 1).padStart(2, '0');
      return { id: id, name: id.toUpperCase() };
    }),
    qr_tag: [{ tag: 'LIT10001', kind: 'litter', ref_id: 'l01', active: 'true' }]
  };
  await page.route(SCRIPT, async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'qr_tag', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    if (b.action === 'read') return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[b.table] || [], role: 'USER' } } });
    if (b.table === 'qr_tag' && !held) { held = true; await gate; }
    sent.push(b);
    if (b.table === 'qr_tag') tables.qr_tag.push({ ...b.fields, active: 'true' });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'qrt-' + sent.length } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-USER', SCRIPT]);
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Thermometer cards' }).click();
  await expect(page.locator('.msg')).toHaveText('Making code 1 of 24...');
  await page.getByRole('button', { name: 'Litter cards' }).click();
  await expect(page.locator('.msg')).toHaveText('1 cards ready. Use your browser’s Print.');
  await expect(page.locator('.dcard.lcard')).toHaveCount(1);
  release();
  await expect(page.locator('.msg')).toHaveText('1 cards ready. Use your browser’s Print.');
  let steady = 0;
  await expect.poll(() => {
    const n = sent.filter((b) => b.fields && b.fields.kind === 'thermometer').length;
    steady = n === 1 ? steady + 1 : 0;
    return n === 1 && steady > 3 ? 1 : n;
  }).toBe(1);
  expect(sent.filter((b) => b.fields && b.fields.kind === 'litter')).toEqual([]);
  await expect(page.locator('.qcard')).toHaveCount(0);
});

