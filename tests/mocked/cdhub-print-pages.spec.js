// Each layout prints that many cards on a page, and the printed card keeps the on-screen fields.
const { test, expect } = require('../support/test');

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const N = 4;

function rows() {
  const area = [];
  const qr = [];
  const subject = [];
  const occupancy = [];
  const thermometer = [];
  const items = [];
  for (let i = 1; i <= N; i++) {
    const id = 'r0' + i;
    area.push({ id: id, code: 'R0' + i, area_value: '16.3', area_unit_id: 'u-m2' });
    qr.push({ tag: 'ROOM000' + i, kind: 'area', ref_id: id, active: 'true' });
    subject.push({ id: 'd0' + i, name: 'Dog ' + i, sex: 'Female', size_band: 'medium' });
    occupancy.push({ subject_id: 'd0' + i, area_id: 'r01', moved_in: '2026-01-01' });
    qr.push({ tag: 'DOG0000' + i, kind: 'subject', ref_id: 'd0' + i, active: 'true' });
    thermometer.push({ id: 't0' + i, name: 'Unit ' + i, area_id: id });
    qr.push({ tag: 'THM0000' + i, kind: 'thermometer', ref_id: 't0' + i, active: 'true' });
    items.push({ id: 'i0' + i, name: 'Item ' + i, item_no: String(i) });
    qr.push({ tag: 'ITEM000' + i, kind: 'item', ref_id: 'i0' + i, active: 'true' });
  }
  qr.push({ tag: 'LIT00001', kind: 'litter', ref_id: 'l01', active: 'true' });
  qr.push({ tag: 'SITE0001', kind: 'site', ref_id: 'site', active: 'true' });
  return {
    area: area, subject: subject, occupancy: occupancy, thermometer: thermometer, items: items, qr_tag: qr,
    litter: [{ id: 'l01', dam_subject_id: 'd01', born_on: '2026-01-02' }], requirement: []
  };
}

async function open(page) {
  const tables = rows();
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'qr_tag', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    if (b.action === 'read') return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[b.table] || [], role: 'OWNER' } } });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'x' } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
  await page.goto('cdhub/staff/print/');
}

function pdfPages(buf) {
  return (buf.toString('latin1').match(/\/Type\s*\/Page(?!s)/g) || []).length;
}

async function pdfOf(page) {
  const buf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: '0', right: '0', bottom: '0', left: '0' } });
  return { pages: pdfPages(buf), text: buf.toString('latin1') };
}

test('each layout prints that many cards a page, and the fields are on the page @regression', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('button', { name: 'Print', exact: true })).toBeVisible();
  await page.evaluate(() => { window.__printed = 0; window.print = function () { window.__printed += 1; }; });
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  expect(await page.evaluate(() => window.__printed)).toBe(1);

  const layouts = [['Full A4', 1], ['2 per A4', 2], ['4 per A4', 4]];
  const kinds = [
    ['Room cards', '.rcard', '16.3'],
    ['Dog cards', '.dcard[data-dog]', 'Medium'],
    ['Thermometer cards', '.qcard', 'Unit 1'],
    ['Item cards', '.icard', 'Item 1'],
    ['Litter cards', '.lcard', 'Litter of Dog 1'],
    ['Whole-site code', '.qcard', 'Whole site']
  ];
  for (const [type, sel, field] of kinds) {
    for (const [layout, per] of layouts) {
      await page.getByRole('button', { name: layout, exact: true }).click();
      await page.getByRole('button', { name: type, exact: true }).click();
      await expect(page.locator(sel)).toHaveCount(type === 'Litter cards' || type === 'Whole-site code' ? 1 : N);
      await expect(page.locator('.sheet')).toContainText(field);
      await page.emulateMedia({ media: 'print' });
      const shown = await page.locator(sel).evaluateAll((els) => els.map((el) => getComputedStyle(el).breakAfter));
      if (per === 1) expect(shown.slice(0, -1).every((v) => v === 'page'), type + ' ' + layout).toBe(true);
      const printed = await page.locator('.sheet').evaluate((el) => el.innerText);
      expect(printed, type + ' ' + layout).toContain(field);
      const pdf = await pdfOf(page);
      const cards = type === 'Litter cards' || type === 'Whole-site code' ? 1 : N;
      const want = Math.ceil(cards / per);
      expect(pdf.pages, type + ' ' + layout).toBe(want);
      await page.emulateMedia({ media: 'screen' });
    }
  }
});
