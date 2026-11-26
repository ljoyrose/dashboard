const { test, expect } = require('../support/test');

test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const TAG = 'ABCD2345';

function baseTables(over) {
  return Object.assign({
    area: [{ id: 'area-1', code: 'R1' }],
    subject: [{ id: 'sub-1', name: 'A1' }],
    occupancy: [],
    subject_status: [],
    requirement: [{ id: 'req-1', need_type: 'reading.temperature', target_table: 'thermometer', target_id: 'thm-1', from_date: '2020-01-01', to_date: '' }],
    qr_tag: [{ tag: 'THERMO23', kind: 'thermometer', ref_id: 'thm-1', active: 'true' }],
    thermometer: [{ id: 'thm-1', name: 'T1', area_id: 'area-1' }],
    temperature_band: [],
    area_reading: [],
    area_link: [],
    breeding_rule: [],
    check_type: [],
    check_log: []
  }, over || {});
}

async function setup(page, over) {
  const data = baseTables(over);
  const reads = [];
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'area_reading', on: true, mode: 'direct' }, { key: 'check_log', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData() || '{}');
    if (String(b.action).indexOf('read') === 0) {
      reads.push(b.table);
      if (b.table && !Object.prototype.hasOwnProperty.call(data, b.table)) return route.fulfill({ headers: CORS, json: { ok: false, code: 'NOT_ALLOWED', message: 'off' } });
      return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: data[b.table] || [], role: 'STAFF' } } });
    }
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'row-1' } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-CODE-1', SCRIPT]);
  return reads;
}

test('a read that never answers shows try again within the read timeout', async ({ page }) => {
  test.setTimeout(40000);
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    return new Promise(function () {});
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-CODE-1', SCRIPT]);
  const started = Date.now();
  await page.goto('cdhub/staff/#scan');
  await expect(page.getByText('Could not load. Check signal.')).toBeVisible({ timeout: 25000 });
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(25000);
});

test('a thermometer scan opens temps with few reads', async ({ page }) => {
  const reads = await setup(page);
  await page.goto('cdhub/staff/#s/THERMO23');
  await expect(page).toHaveURL(/#m\/temperature$/);
  await expect(page.locator('.tg-row')).toBeVisible();
  const t = await page.evaluate(() => JSON.parse(localStorage.getItem('bld.temp.thermometer')));
  expect(t.thermometerId).toBe('thm-1');
  expect(reads.length).toBeLessThanOrEqual(12);
  expect(reads.filter((x) => x === 'qr_tag').length).toBe(1);
  expect(reads.filter((x) => x === 'check_log').length).toBe(0);
});

async function camera(page, deny) {
  await page.addInitScript((blocked) => {
    navigator.mediaDevices.getUserMedia = async () => {
      if (blocked) { const e = new Error('denied'); e.name = 'NotAllowedError'; throw e; }
      const canvas = document.createElement('canvas');
      canvas.width = 8;
      canvas.height = 8;
      return canvas.captureStream(5);
    };
    window.__codes = [];
    window.BarcodeDetector = class {
      detect() { return Promise.resolve((window.__codes || []).map((rawValue) => ({ rawValue }))); }
    };
  }, !!deny);
}

test('the scan tab routes a tag from the camera', async ({ page }) => {
  await setup(page);
  await camera(page, false);
  await page.goto('cdhub/staff/#scan');
  await expect(page.getByLabel('Camera')).toBeVisible();
  await page.evaluate((tag) => { window.__codes = ['https://example.test/staff/#s/' + tag]; }, TAG);
  await expect(page).toHaveURL(new RegExp('#s/' + TAG));
});

test('the scan tab rejects a foreign address', async ({ page }) => {
  await setup(page);
  await camera(page, false);
  await page.goto('cdhub/staff/#scan');
  await expect(page.getByLabel('Camera')).toBeVisible();
  await page.evaluate(() => { window.__codes = ['https://foreign.example/go']; });
  await expect(page.getByText('That code is not for this page.')).toBeVisible();
  await expect(page).toHaveURL(/#scan$/);
});

test('the scan tab says when the camera is blocked', async ({ page }) => {
  await setup(page);
  await camera(page, true);
  await page.goto('cdhub/staff/#scan');
  await expect(page.getByText('Camera is blocked for this page.')).toBeVisible();
  await expect(page.getByLabel('Type the code')).toBeVisible();
});
