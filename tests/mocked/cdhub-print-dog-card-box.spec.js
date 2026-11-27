const { test, expect } = require('../support/test');

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };
const STAFF = 'https://ljoyrose.github.io/dashboard/cdhub/staff/';
const LAYOUTS = ['Full A4', '2 per A4', '4 per A4'];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

const tables = {
  area: [{ id: 'r01', code: 'R01' }],
  requirement: [],
  subject_status: [],
  subject: [
    { id: 'd01', name: 'Dog A', sex: 'Female', dob: '2021-03-02', size_band: 'medium', photo: 'FAKEPHOTO01' },
    { id: 'd02', name: 'Dog B', sex: 'Male', dob: '2020-06-15', size_band: 'medium' },
    { id: 'd03', name: 'Dog C', sex: 'Female', dob: '2019-01-20', size_band: 'small' }
  ],
  occupancy: [
    { subject_id: 'd01', area_id: 'r01', moved_in: '2026-01-01' },
    { subject_id: 'd02', area_id: 'r01', moved_in: '2026-01-01' },
    { subject_id: 'd03', area_id: 'r01', moved_in: '2026-01-01' }
  ],
  microchip: [
    { id: 'm01', subject_id: 'd01', chip_number: '123456789012345' },
    { id: 'm02', subject_id: 'd02', chip_number: '123456789012346' },
    { id: 'm03', subject_id: 'd03', chip_number: '123456789012347' }
  ],
  files: [{ id: 'fil-b', kind: 'photo', url: 'https://example.com/dog-b.png' }],
  links: [{ id: 'lnk-b', from_table: 'subjects', from_id: 'd02', to_table: 'files', to_id: 'fil-b', role: 'main', from_date: '2020-01-01' }],
  litter: [{ id: 'l01', dam_subject_id: 'd01', born_on: '2026-01-02' }],
  items: [{ id: 'i01', name: 'Item A', item_no: '1' }],
  thermometer: [{ id: 'th1', name: 'Unit A', area_id: 'r01' }],
  qr_tag: [
    { tag: 'DOG00001', kind: 'subject', ref_id: 'd01', active: 'true' },
    { tag: 'DOG00002', kind: 'subject', ref_id: 'd02', active: 'true' },
    { tag: 'DOG00003', kind: 'subject', ref_id: 'd03', active: 'true' },
    { tag: 'ROOM0001', kind: 'area', ref_id: 'r01', active: 'true' },
    { tag: 'ITEM0001', kind: 'item', ref_id: 'i01', active: 'true' },
    { tag: 'LIT00001', kind: 'litter', ref_id: 'l01', active: 'true' },
    { tag: 'THM00001', kind: 'thermometer', ref_id: 'th1', active: 'true' },
    { tag: 'SITE0001', kind: 'site', ref_id: 'site', active: 'true' }
  ]
};

function open(page) {
  return page.route(/drive\.google\.com\/thumbnail/, (route) => route.fulfill({ contentType: 'image/png', body: PNG }))
    .then(() => page.route(SCRIPT, (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
      const b = JSON.parse(route.request().postData());
      if (b.action === 'read') return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[b.table] || [], role: 'OWNER' } } });
      return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'x' } } });
    }))
    .then(() => page.addInitScript(([c, u]) => {
      localStorage.setItem('bld.device.code', c);
      localStorage.setItem('bld.scriptUrl', u);
      window.__qr = [];
      let real;
      Object.defineProperty(window, 'BLDQr', { configurable: true, get() { return real; },
        set(v) { real = Object.assign({}, v, { svg: (text, label) => { window.__qr.push(text); return v.svg(text, label); } }); } });
    }, ['FAKE-OWNER', SCRIPT]));
}

async function fit(page) {
  return page.locator('article.dcard').evaluateAll((cards) => cards.map((card) => {
    const cb = card.getBoundingClientRect();
    const name = card.querySelector('.name').getBoundingClientRect();
    const dob = card.querySelector('[data-k="dob"] dd');
    let dobLines = 0;
    if (dob) {
      const range = document.createRange();
      range.selectNodeContents(dob);
      dobLines = range.getClientRects().length;
    }
    const overflow = Array.from(card.querySelectorAll('*')).filter((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      return r.right > cb.right + 1 || r.left < cb.left - 1 || r.bottom > cb.bottom + 1 || r.top < cb.top - 1;
    }).map((e) => e.getAttribute('data-k') || e.tagName);
    return { id: card.getAttribute('data-dog'), ratio: name.width / cb.width, dobLines, overflow };
  }));
}

async function photos(page) {
  return page.locator('article.dcard').evaluateAll((cards) => cards.map((card) => {
    const img = card.querySelector('[data-k="photo"] img');
    const box = card.querySelector('[data-k="photo"]');
    const ir = img ? img.getBoundingClientRect() : null;
    const br = box.getBoundingClientRect();
    return {
      id: card.getAttribute('data-dog'),
      has: !!img,
      nw: img ? img.naturalWidth : 0,
      fit: img ? getComputedStyle(img).objectFit : '',
      iw: ir ? ir.width : 0,
      ih: ir ? ir.height : 0,
      bw: br.width,
      bh: br.height,
      shown: img ? getComputedStyle(img).display !== 'none' && ir.width > 0 : false
    };
  }));
}

test('dog card name stays wide, the chip stays inside the card, and the birth date stays one line @regression', async ({ page }) => {
  await open(page);
  await page.goto('cdhub/staff/print/');
  for (const width of [1280, 1024]) {
    await page.setViewportSize({ width: width, height: 900 });
    for (const label of LAYOUTS) {
      await page.emulateMedia({ media: 'screen' });
      await page.getByRole('button', { name: label, exact: true }).click();
      await page.getByRole('button', { name: 'Dog cards', exact: true }).click();
      await expect(page.locator('article.dcard')).toHaveCount(3);
      for (const media of ['screen', 'print']) {
        await page.emulateMedia({ media: media });
        const rows = await fit(page);
        expect(rows, label + ' ' + width + ' ' + media).toHaveLength(3);
        for (const row of rows) {
          expect(row.ratio, row.id + ' ' + label + ' ' + media).toBeGreaterThan(0.4);
          expect(row.dobLines, row.id + ' ' + label + ' ' + media).toBe(1);
          expect(row.overflow, row.id + ' ' + label + ' ' + media).toEqual([]);
        }
      }
    }
  }
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  expect(pdf.length).toBeGreaterThan(1000);
});

test('dog card photo is a loaded square in every layout and in print @regression', async ({ page }) => {
  await open(page);
  await page.goto('cdhub/staff/print/');
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const label of LAYOUTS) {
    await page.emulateMedia({ media: 'screen' });
    await page.getByRole('button', { name: label, exact: true }).click();
    await page.getByRole('button', { name: 'Dog cards', exact: true }).click();
    await expect.poll(() => page.locator('.dcard[data-dog="d01"] img').evaluate((i) => i.complete && i.naturalWidth > 0).catch(() => false)).toBe(true);
    for (const media of ['screen', 'print']) {
      await page.emulateMedia({ media: media });
      const rows = await photos(page);
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
      for (const id of ['d01', 'd02']) {
        expect(byId[id].shown, id + ' ' + label + ' ' + media).toBe(true);
        expect(byId[id].nw, id + ' ' + label + ' ' + media).toBeGreaterThan(0);
        expect(byId[id].fit, id + ' ' + label + ' ' + media).toBe('cover');
        expect(Math.abs(byId[id].iw - byId[id].ih), id + ' ' + label + ' ' + media).toBeLessThan(2);
        expect(Math.abs(byId[id].bw - byId[id].bh), id + ' ' + label + ' ' + media).toBeLessThan(2);
      }
      expect(byId.d03.has, 'no photo in data ' + label).toBe(false);
    }
  }
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => {
    window.__printed = 0;
    window.print = () => {
      const imgs = Array.from(document.querySelectorAll('.dcard[data-dog="d01"] img, .dcard[data-dog="d02"] img'));
      window.__printed = imgs.length === 2 && imgs.every((i) => i.complete && i.naturalWidth > 0) ? 1 : -1;
    };
  });
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__printed)).toBe(1);
});

test('every print QR uses the staff rule or the staff page @regression @live', async ({ page }) => {
  await open(page);
  await page.goto('cdhub/staff/print/');
  const kinds = ['Whole-site code', 'Room cards', 'Dog cards', 'Litter cards', 'Item cards', 'Thermometer cards', 'Phone set-up QR'];
  for (const name of kinds) {
    await page.getByRole('button', { name: name, exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__qr.length)).toBeGreaterThan(0);
  }
  const qr = await page.evaluate(() => window.__qr.slice());
  expect(qr.length).toBeGreaterThanOrEqual(kinds.length);
  for (const text of qr) {
    expect(text.indexOf(STAFF + '#'), text).toBe(0);
    expect(text).not.toContain('pages.dev');
    expect(text).not.toContain('/print/');
  }
  const marks = qr.map((t) => new URL(t).hash.split(/[=/]/)[0]);
  expect(marks).toContain('#s');
  expect(marks).toContain('#setup');
});

test('when the photo records cannot be read, the page says so instead of blank photos @regression @live', async ({ page }) => {
  await open(page);
  await page.route(SCRIPT, (route) => {
    const b = route.request().method() === 'POST' ? JSON.parse(route.request().postData()) : {};
    if (b.action === 'read' && (b.table === 'files' || b.table === 'links')) return route.fulfill({ headers: CORS, json: { ok: false, code: 'NOT_ALLOWED', message: 'Not allowed.' } });
    return route.fallback();
  });
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Dog cards', exact: true }).click();
  await expect(page.locator('article.dcard')).toHaveCount(3);
  await expect(page.locator('.msg')).toContainText('Photos are not shown: this sign-in cannot read photo records');
});

test('a photo that does not load is counted on screen @regression', async ({ page, allowedConsole }) => {
  allowedConsole.push(/status of 404/);   // the pretend photo address answers 404 on purpose
  await open(page);
  await page.route(/example\.com\/dog-b\.png/, (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Dog cards', exact: true }).click();
  await expect(page.locator('.msg')).toContainText('1 photo did not load');
  await expect(page.locator('.sheet')).not.toContainText('did not load');
});
