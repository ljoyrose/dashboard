const { test, expect } = require('../support/test');

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };

async function open(page, tables) {
  const sent = [];
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'qr_tag', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    if (b.action === 'read') return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[b.table] || [], role: 'USER' } } });
    sent.push(b);
    if (b.table === 'qr_tag') tables.qr_tag.push({ ...b.fields, active: 'true' });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'qrt-' + sent.length } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-USER', SCRIPT]);
  await page.goto('cdhub/staff/print/');
  return sent;
}

test('t-cdhub-print-site-card-spec-1', async ({ page }) => {
  const tables = {
    qr_tag: [
      { tag: 'SITE1111', kind: 'site', ref_id: 'site', active: 'true' },
      { tag: 'SITE1111', kind: 'site', ref_id: 'site', active: 'true' },
      { tag: 'SITE2222', kind: 'site', ref_id: 'site', active: 'true' }
    ]
  };
  const sent = await open(page, tables);
  await page.getByRole('button', { name: 'Full A4' }).click();
  await page.getByRole('button', { name: 'Whole-site code' }).click();
  await page.getByRole('button', { name: 'Whole-site code' }).click();
  await expect(page.locator('.sheet > .qcard')).toHaveCount(1);
  await expect(page.locator('.qcard small')).toHaveText('SITE1111');
  await expect(page.locator('.msg')).toHaveText('1 cards ready. Use your browser’s Print.');
  await expect(page.locator('.sheet')).toHaveClass(/\bper1\b/);
  expect(sent, 'a saved site code is not written again').toEqual([]);
  await page.emulateMedia({ media: 'print' });
  const columns = await page.locator('.sheet').evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  expect(columns.split(' ').filter(Boolean), 'Full A4 is one column').toHaveLength(1);
  await page.locator('.sheet').screenshot({ path: '/opt/cursor/artifacts/site-card.png' });
});

test('three presses while a site code is saving still leave one card', async ({ page }) => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const sent = [];
  const tables = { qr_tag: [] };
  await page.route(SCRIPT, async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'qr_tag', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    if (b.action === 'read') return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[b.table] || [], role: 'USER' } } });
    if (b.table === 'qr_tag') {
      await gate;
      sent.push(b);
      tables.qr_tag.push({ ...b.fields, active: 'true' });
      return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'qrt-1' } } });
    }
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'x' } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-USER', SCRIPT]);
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Full A4' }).click();
  await page.getByRole('button', { name: 'Whole-site code' }).click();
  await expect(page.locator('.msg')).toContainText('Making code');
  await page.getByRole('button', { name: 'Whole-site code' }).click();
  await page.getByRole('button', { name: 'Whole-site code' }).click();
  release();
  await expect(page.locator('.sheet > .qcard')).toHaveCount(1);
  await expect(page.locator('.msg')).toHaveText('1 cards ready. Use your browser’s Print.');
  expect(sent, 'one site code is saved').toHaveLength(1);
});

