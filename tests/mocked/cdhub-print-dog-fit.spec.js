// Dog cards stay wide enough to read: a name is not split letter by letter, the photo frame stays square, the size badge shows.
const { test, expect } = require('../support/test');

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const LAYOUTS = ['Full A4', '2 per A4', '4 per A4'];
const MM = 96 / 25.4;

function open(page, tables, deny) {
  return page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'qr_tag', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    if (b.action === 'read') {
      if (deny && deny[b.table]) return route.fulfill({ headers: CORS, json: { ok: false, code: deny[b.table], message: 'Not allowed.' } });
      return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[b.table] || [], role: 'OWNER' } } });
    }
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'x' } } });
  }).then(() => page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]));
}

const dogs = {
  area: [{ id: 'r01', code: 'R01', area_value: '16.3', area_unit_id: 'u-m2' }],
  subject: [
    { id: 'd01', name: 'Abe', sex: 'Female', size_band: 'medium', photo: 'FAKEPHOTO1' },
    { id: 'd02', name: 'Longwordlongword', sex: 'Male', size_band: 'medium' }
  ],
  occupancy: [
    { subject_id: 'd01', area_id: 'r01', moved_in: '2026-01-01' },
    { subject_id: 'd02', area_id: 'r01', moved_in: '2026-01-01' }
  ],
  qr_tag: [
    { tag: 'DOG00001', kind: 'subject', ref_id: 'd01', active: 'true' },
    { tag: 'DOG00002', kind: 'subject', ref_id: 'd02', active: 'true' },
    { tag: 'ROOM0001', kind: 'area', ref_id: 'r01', active: 'true' },
    { tag: 'ITEM0001', kind: 'item', ref_id: 'i01', active: 'true' }
  ],
  items: [{ id: 'i01', name: 'Item A', item_no: '1' }]
};

async function measure(page, id) {
  return page.locator('.dcard[data-dog="' + id + '"]').evaluate((el) => {
    const name = el.querySelector('.name');
    const range = document.createRange();
    range.selectNodeContents(name);
    const rects = [...range.getClientRects()];
    const photo = el.querySelector('[data-k="photo"]');
    const pr = photo.getBoundingClientRect();
    const img = photo.querySelector('img');
    return {
      wrap: getComputedStyle(name).overflowWrap,
      lines: rects.length,
      card: el.getBoundingClientRect().width,
      pw: pr.width,
      ph: pr.height,
      fit: img ? getComputedStyle(img).objectFit : ''
    };
  });
}

test('dog cards keep a whole word, a square photo and a size badge at every layout @regression', async ({ page }) => {
  await page.route(/^https:\/\/drive\.google\.com\/thumbnail/, (route) => route.fulfill({
    contentType: 'image/png',
    body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  }));
  await open(page, dogs);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('cdhub/staff/print/');
  for (const label of LAYOUTS) {
    await page.emulateMedia({ media: 'screen' });
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.getByRole('button', { name: 'Dog cards', exact: true }).click();
    await expect(page.locator('.dcard')).toHaveCount(2);
    const cols = await page.locator('.sheet.dogs').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length);
    expect(cols, label).toBe(label === '4 per A4' ? 2 : 1);
    for (const id of ['d01', 'd02']) {
      const m = await measure(page, id);
      expect(m.wrap, id + ' ' + label).toBe('normal');
      expect(m.lines, id + ' ' + label).toBe(1);
      expect(m.card, id + ' ' + label).toBeGreaterThan(240);
      expect(m.pw, id + ' ' + label).toBeGreaterThan(40);
      expect(Math.abs(m.pw - m.ph), id + ' ' + label).toBeLessThan(2);
      if (id === 'd01') expect(m.fit).toBe('cover');
    }
    await expect(page.locator('.dcard [data-k="size"]')).toHaveCount(2);
    await expect(page.locator('.dcard [data-k="size"] b').first()).toHaveText('Medium');
    if (label === '2 per A4') {
      await page.emulateMedia({ media: 'print' });
      const printed = await measure(page, 'd01');
      expect(Math.abs(printed.pw / MM - 88)).toBeLessThan(2);
      expect(Math.abs(printed.ph / MM - 88)).toBeLessThan(2);
    }
  }
});

test('an empty item list warns, and item rows print a card @regression', async ({ page }) => {
  await open(page, Object.assign({}, dogs, { items: [] }));
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Item cards', exact: true }).click();
  await expect(page.locator('.msg')).toHaveText('The item list is not switched on yet.');
  await expect(page.locator('.msg')).not.toContainText('0 cards ready');
  await expect(page.locator('.icard')).toHaveCount(0);

  await page.unroute(SCRIPT);
  await open(page, dogs, { items: 'NOT_ALLOWED' });
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Item cards', exact: true }).click();
  await expect(page.locator('.msg')).toHaveText('Not allowed.');
  await expect(page.locator('.msg')).not.toContainText('0 cards ready');

  await page.unroute(SCRIPT);
  await open(page, dogs);
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Item cards', exact: true }).click();
  await expect(page.locator('.icard')).toHaveCount(1);
  await expect(page.locator('.icard .name')).toHaveText('Item A');
});

test('a room card prints its area in square metres', async ({ page }) => {
  await open(page, dogs);
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Room cards', exact: true }).click();
  await expect(page.locator('.rcard [data-k="area"] dd')).toHaveText('16.3 m²');
});
