// Room card size icons stay coloured on screen and in print, and the square metres come from the device copy when the live row omits them.
const { test, expect } = require('../support/test');

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const GREY = 'rgb(87, 80, 74)';

const tables = {
  area: [{ id: 'r01', code: 'R01' }],
  area_access: [{ area_id: 'r01', access_type: 'limited', from_date: '2020-01-01' }],
  area_capacity: [
    { area_id: 'r01', access_type: 'limited', size_band: 'small', max_dogs: '1', from_date: '2020-01-01' },
    { area_id: 'r01', access_type: 'limited', size_band: 'medium', max_dogs: '2', from_date: '2020-01-01' },
    { area_id: 'r01', access_type: 'limited', size_band: 'large', max_dogs: '1', from_date: '2020-01-01' }
  ],
  qr_tag: [{ tag: 'ROOM0001', kind: 'area', ref_id: 'r01', active: 'true' }]
};

test('room card dog icons stay coloured and the room size prints from the device copy @regression', async ({ page }) => {
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'qr_tag', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    if (b.action === 'read') return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[b.table] || [], role: 'OWNER' } } });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'x' } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
  await page.goto('cdhub/staff/print/');
  await page.evaluate(async () => {
    await new Promise((res, rej) => {
      const r = indexedDB.open('cdhub-owner-copy', 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('copy')) r.result.createObjectStore('copy'); };
      r.onerror = () => rej(r.error);
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction('copy', 'readwrite');
        tx.objectStore('copy').put({ tables: { 'BLD-area.csv': [{ id: 'r01', code: 'R01', area_value: '16.3', area_unit_id: 'u-m2' }] } }, 'last');
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = () => rej(tx.error);
      };
    });
  });
  await page.getByRole('button', { name: 'Room cards', exact: true }).click();
  await expect(page.locator('.rcard')).toHaveCount(1);
  await expect(page.locator('.rcard')).toContainText('16.3 m²');
  const colours = await page.locator('.szrow').evaluateAll((rows) => rows.map((row) => {
    const svg = row.querySelector('svg');
    const path = row.querySelector('svg path');
    const s = svg ? getComputedStyle(svg) : null;
    const p = path ? getComputedStyle(path) : null;
    return { size: row.getAttribute('data-size'), fill: p && p.fill, adjust: s && s.printColorAdjust };
  }));
  expect(colours.map((c) => c.size)).toEqual(['small', 'medium', 'large']);
  expect(colours.map((c) => c.fill)).toEqual(['rgb(182, 106, 17)', 'rgb(66, 140, 70)', 'rgb(15, 130, 188)']);
  expect(colours.every((c) => c.fill !== GREY && c.adjust === 'exact')).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.rcard')).toContainText('16.3 m²');
  const printed = await page.locator('.szrow svg').evaluateAll((els) => els.map((el) => {
    const s = getComputedStyle(el);
    return { fill: getComputedStyle(el.querySelector('path')).fill, adjust: s.printColorAdjust };
  }));
  expect(printed.map((c) => c.fill)).toEqual(['rgb(182, 106, 17)', 'rgb(66, 140, 70)', 'rgb(66, 140, 70)', 'rgb(15, 130, 188)']);
  expect(printed.every((c) => c.fill !== GREY && c.adjust === 'exact')).toBe(true);
  const shown = await page.locator('.rcard [data-k="area"] dd').evaluate((el) => {
    const s = getComputedStyle(el);
    return { text: el.textContent, display: s.display, visibility: s.visibility };
  });
  expect(shown.text).toBe('16.3 m²');
  expect(shown.display).not.toBe('none');
  expect(shown.visibility).toBe('visible');
  const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) || []).length).toBeGreaterThan(0);
});
