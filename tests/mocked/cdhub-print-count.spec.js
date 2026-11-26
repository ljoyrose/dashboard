const { test, expect } = require('../support/test');

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const LAYOUTS = ['Full A4', '2 per A4', '4 per A4'];

function tag(kind, ref, n) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push({ tag: (kind + ref + i).replace(/[^A-Z0-9]/gi, '').slice(0, 7).padEnd(7, 'X') + i, kind: kind, ref_id: ref, active: 'true' });
  return rows;
}

async function ready(page, n) {
  await expect(page.locator('.msg')).toHaveText(n + ' cards ready. Use your browser’s Print.');
}

test('t-cdhub-print-count-spec-1', async ({ page }) => {
  const tables = {
    area: [{ id: 'r01', code: 'R01' }, { id: 'r02', code: 'R02' }],
    subject: [{ id: 'd01', name: 'Dog A' }, { id: 'd02', name: 'Dog B' }],
    occupancy: [
      { subject_id: 'd01', area_id: 'r01', moved_in: '2026-01-01' },
      { subject_id: 'd02', area_id: 'r01', moved_in: '2026-01-01' }
    ],
    litter: [{ id: 'l01', dam_subject_id: 'd01', born_on: '2026-01-02' }],
    items: [{ id: 'i01', name: 'Item A', item_no: '1' }, { id: 'i02', name: 'Item B', item_no: '2' }],
    thermometer: [
      { id: 't01', name: 'Unit A', area_id: 'r01' },
      { id: 't02', name: 'Unit B', area_id: 'r01' },
      { id: 't03', name: 'Unit C', area_id: 'r02' }
    ],
    requirement: [],
    qr_tag: [{ tag: 'SITE0001', kind: 'site', ref_id: 'site', active: 'true' }]
      .concat(tag('area', 'r01', 7), tag('area', 'r02', 7))
      .concat(tag('subject', 'd01', 7), tag('subject', 'd02', 7))
      .concat(tag('litter', 'l01', 7))
      .concat(tag('item', 'i01', 7), tag('item', 'i02', 7))
      .concat(tag('thermometer', 't01', 7), tag('thermometer', 't02', 7), tag('thermometer', 't03', 7))
  };
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'qr_tag', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    if (b.action === 'read') return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[b.table] || [], role: 'USER' } } });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'x' } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-USER', SCRIPT]);
  await page.goto('cdhub/staff/print/');

  async function layouts(button, sel, n) {
    await page.getByRole('button', { name: button, exact: true }).click();
    await expect(page.locator(sel)).toHaveCount(n);
    await ready(page, n);
    for (const label of LAYOUTS) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.getByRole('button', { name: button, exact: true }).click();
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator(sel)).toHaveCount(n);
      await page.emulateMedia({ media: 'screen' });
    }
  }

  await layouts('Thermometer cards', '.qcard', 3);
  await expect(page.locator('.qcard b')).toHaveText(['Unit A', 'Unit B', 'Unit C']);
  await expect(page.locator('.sheet')).not.toContainText('R01');
  await expect(page.locator('.sheet')).not.toContainText('Today');
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Thermometer cards', exact: true }).click();
  await expect(page.locator('.qcard')).toHaveCount(3);

  await layouts('Whole-site code', '.qcard', 1);
  await expect(page.locator('.qcard b')).toHaveText(['Whole site']);

  await layouts('Thermometer cards', '.qcard', 3);
  await expect(page.locator('.sheet')).not.toContainText('Today');

  await layouts('Room cards', '.rcard', 2);
  await layouts('Dog cards', '.dcard[data-dog]', 2);
  await layouts('Litter cards', '.dcard.lcard', 1);
  await layouts('Item cards', '.dcard.icard', 2);

  const order = [
    ['Whole-site code', '.qcard', 1, 'Whole site'],
    ['Thermometer cards', '.qcard', 3, 'Unit A'],
    ['Dog cards', '.dcard[data-dog]', 2, 'Dog A'],
    ['Room cards', '.rcard', 2, 'R01'],
    ['Litter cards', '.dcard.lcard', 1, 'Litter of Dog A'],
    ['Item cards', '.dcard.icard', 2, 'Item A'],
    ['Thermometer cards', '.qcard', 3, 'Unit A']
  ];
  for (let pass = 0; pass < 2; pass++) {
    for (const step of order) {
      await page.getByRole('button', { name: step[0], exact: true }).click();
      await expect(page.locator(step[1])).toHaveCount(step[2]);
      await expect(page.locator('.sheet')).toContainText(step[3]);
      if (step[0] !== 'Whole-site code') await expect(page.locator('.sheet')).not.toContainText('Whole site');
      if (step[0] !== 'Thermometer cards' && step[0] !== 'Whole-site code') await expect(page.locator('.qcard')).toHaveCount(0);
      if (step[0] !== 'Room cards') await expect(page.locator('.rcard')).toHaveCount(0);
      if (step[0] !== 'Dog cards' && step[0] !== 'Litter cards' && step[0] !== 'Item cards') await expect(page.locator('.dcard')).toHaveCount(0);
    }
  }
});

