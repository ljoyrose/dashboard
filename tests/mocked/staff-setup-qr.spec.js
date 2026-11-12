// Private set-up QR on the staff page. Fake code and fake save address only: a real code never goes near a test.
const { test, expect } = require('../support/test');

// The temperature module is optional and not on main yet, so its file answers 404.
test.use({ allowedConsole: [/404/] });

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CODE = 'FAKE-CODE-1';
const CORS = { 'access-control-allow-origin': '*' };
const empty = { rows: [], tables: { area: [], subject: [], occupancy: [], subject_status: [], qr_tag: [], litter: [] } };

async function fakeScript(page, good) {
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    return route.fulfill({ headers: CORS, json: good ? { ok: true, result: empty } : { ok: false, code: 'BAD_CODE', message: 'no' } });
  });
}
const stored = (page) => page.evaluate(() => [localStorage.getItem('bld.device.code'), localStorage.getItem('bld.scriptUrl')]);

test('a good private QR sets the phone up and leaves no code in the address', async ({ page }) => {
  await fakeScript(page, true);
  await page.goto('cdhub/staff/#join=' + encodeURIComponent(CODE) + '&url=' + SCRIPT);
  await expect(page.getByRole('heading', { name: 'The Board' })).toBeVisible();
  expect(page.url()).not.toContain(CODE);
  expect(page.url()).not.toContain('join=');
  expect(await stored(page)).toEqual([CODE, SCRIPT]);
  await expect(page.locator('a[data-link="checks"]')).toHaveAttribute('href', '../checks/');
});

test('a refused code is not remembered', async ({ page }) => {
  await fakeScript(page, false);
  await page.goto('cdhub/staff/#join=' + encodeURIComponent(CODE) + '&url=' + SCRIPT);
  await expect(page.getByText('That code was not accepted')).toBeVisible();
  expect(page.url()).not.toContain(CODE);
  expect((await stored(page))[0]).toBeNull();
});

async function typeSetup(page, payload) {
  await page.goto('cdhub/staff/');
  await page.getByRole('button', { name: 'Type set-up code instead' }).click();
  const box = page.getByLabel('Set-up code');
  await box.fill(payload);
  await page.getByRole('button', { name: 'Use this code' }).click();
  await expect(box).toHaveCount(0);
}

test('a typed set-up code follows the QR: a good one opens the staff code, a bad one is refused @regression', async ({ page }) => {
  await fakeScript(page, true);
  const good = '#setup=' + encodeURIComponent(SCRIPT);
  const bad = '#setup=' + encodeURIComponent('https://example.com/not-a-script');
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  await page.goto('cdhub/staff/' + good);
  await expect(page.getByLabel('Your staff code')).toBeVisible();
  expect(await stored(page)).toEqual([null, SCRIPT]);
  await page.evaluate(() => localStorage.clear());
  await page.goto('cdhub/staff/' + bad);
  await expect(page.getByText('That set-up QR was not right')).toBeVisible();
  expect((await stored(page))[1]).toBeNull();
  const pastedGood = await page.evaluate((h) => location.origin + location.pathname + h, good);
  await typeSetup(page, pastedGood);
  await expect(page.getByLabel('Your staff code')).toBeVisible();
  expect(await stored(page)).toEqual([null, SCRIPT]);
  expect(page.url()).not.toContain('setup=');
  expect(page.url()).not.toContain('FAKE-TEST-ID');
  expect(await page.locator('body').innerText()).not.toContain('FAKE-TEST-ID');
  await page.evaluate(() => localStorage.clear());
  const pastedBad = await page.evaluate((h) => location.origin + location.pathname + h, bad);
  await typeSetup(page, pastedBad);
  await expect(page.getByText('That set-up QR was not right')).toBeVisible();
  expect((await stored(page))[1]).toBeNull();
  expect(logs.join('\n')).not.toContain(SCRIPT);
  expect(logs.join('\n')).not.toContain('FAKE-TEST-ID');
});

test('a typed private set-up code follows the QR: a good code is kept, a refused code is not @regression', async ({ page }) => {
  let good = true;
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    return route.fulfill({ headers: CORS, json: good ? { ok: true, result: empty } : { ok: false, code: 'BAD_CODE', message: 'no' } });
  });
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  await page.goto('cdhub/staff/');
  const payload = await page.evaluate(([c, u]) => location.origin + location.pathname + '#join=' + encodeURIComponent(c) + '&url=' + u, [CODE, SCRIPT]);
  await page.getByRole('button', { name: 'Type set-up code instead' }).click();
  await page.getByLabel('Set-up code').fill(payload);
  await page.getByRole('button', { name: 'Use this code' }).click();
  await expect(page.getByRole('heading', { name: 'The Board' })).toBeVisible();
  expect(page.url()).not.toContain(CODE);
  expect(page.url()).not.toContain('join=');
  expect(await stored(page)).toEqual([CODE, SCRIPT]);
  expect(await page.locator('body').innerText()).not.toContain(CODE);
  expect(logs.join('\n')).not.toContain(CODE);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  good = false;
  await page.goto('cdhub/staff/');
  await page.getByRole('button', { name: 'Type set-up code instead' }).click();
  await page.getByLabel('Set-up code').fill(payload);
  await page.getByRole('button', { name: 'Use this code' }).click();
  await expect(page.getByText('That code was not accepted')).toBeVisible();
  expect(page.url()).not.toContain(CODE);
  expect((await stored(page))[0]).toBeNull();
  expect(await page.locator('body').innerText()).not.toContain(CODE);
});

test('staff checks with no set-up names the hub owner and links to The Board', async ({ page }) => {
  await page.goto('cdhub/checks/');
  const note = page.locator('#note');
  await expect(note).toContainText('Ask the hub owner or an admin');
  await expect(note.getByRole('link', { name: 'The Board' })).toHaveAttribute('href', '../staff/');
  await note.getByRole('link', { name: 'The Board' }).click();
  await expect(page.getByRole('heading', { name: 'Set up this phone' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Type set-up code instead' })).toBeVisible();
});

test('the print page draws the QR on screen only and keeps nothing', async ({ page }) => {
  await fakeScript(page, true);
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
  const sent = [];
  page.on('request', (r) => { if (r.postData()) sent.push(r.postData()); sent.push(r.url()); });
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Private set-up QR' }).click();
  const box = page.locator('[data-private]');
  await expect(box).toHaveClass(/noprint/);
  await expect(box).toContainText('Do not screenshot');
  await box.getByLabel('Their staff code').fill(CODE);
  await box.getByRole('button', { name: 'Show QR' }).click();
  await expect(box.locator('svg')).toBeVisible();
  await expect(box.getByLabel('Their staff code')).toHaveValue('');
  expect(sent.join(' ')).not.toContain(CODE);
  expect(await page.evaluate((c) => JSON.stringify(Object.assign({}, localStorage, sessionStorage)).includes(c), CODE)).toBe(false);
  await box.getByRole('button', { name: 'Remove QR' }).click();
  await expect(box.locator('svg')).toHaveCount(0);
});

test('dog kennel cards are only for dogs on site: none for a dog that has left', async ({ page }) => {
  const dog = (id) => ({ id, name: 'Test ' + id });
  const tag = (ref, t) => ({ tag: t, kind: 'subject', ref_id: ref, active: 'true' });
  const tables = {
    area: [{ id: 'area-t1', code: 'T1' }], subject: [dog('here'), dog('offsite'), dog('sold'), dog('died')], subject_status: [], litter: [],
    occupancy: [
      { subject_id: 'here', area_id: 'area-t1', moved_in: '2026-10-01' },
      { subject_id: 'offsite', area_id: 'area-t1', moved_in: '2026-10-01' }, { subject_id: 'offsite', off_site_kind: 'temporary', moved_in: '2026-10-09' },
      { subject_id: 'sold', area_id: 'area-t1', moved_in: '2026-10-01' }, { subject_id: 'sold', off_site_kind: 'sold', moved_in: '2026-10-09' },
      { subject_id: 'died', area_id: 'area-t1', moved_in: '2026-10-01' }, { subject_id: 'died', off_site_kind: 'deceased', moved_in: '2026-10-09' }
    ],
    qr_tag: [tag('here', 'AAAAAAAA'), tag('offsite', 'BBBBBBBB'), tag('sold', 'CCCCCCCC'), tag('died', 'DDDDDDDD')]
  };
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[JSON.parse(route.request().postData()).table] || [] } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Dog kennel cards' }).click();
  await expect(page.locator('.dcard .who b')).toHaveText(['Test here', 'Test offsite']);
});

test('thermometer cards: one per thermometer whose need rows have not all ended, by name; adding one saves it and makes its card', async ({ page }) => {
  const tables = {
    area: [{ id: 'area-t1', code: 'T1' }, { id: 'area-old', code: '3A.1' }], subject: [], subject_status: [], litter: [], occupancy: [], qr_tag: [],
    thermometer: [{ id: 'thm-1', name: 'Hall', area_id: 'area-t1' }, { id: 'thm-4', name: 'Ended', area_id: 'area-t1' }],
    requirement: [{ need_type: 'reading.temperature', target_table: 'thermometer', target_id: 'thm-4', from_date: '2026-01-01', to_date: '2026-01-31' },
      { need_type: 'room.in_use', target_table: 'area', target_id: 'area-old', from_date: '2026-01-01', to_date: '2026-01-31' }]
  };
  const sent = [];
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'qr_tag', on: true, mode: 'direct' }, { key: 'thermometer', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    if (b.action === 'read') return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[b.table] || [] } } });
    sent.push(b);
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: b.table === 'thermometer' ? 'thm-3' : 'qrt-' + sent.length } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Thermometer cards' }).click();
  await expect(page.locator('.qcard b')).toHaveText(['Hall']);
  expect(sent.map((b) => [b.table, b.fields.kind, b.fields.ref_id])).toEqual([['qr_tag', 'thermometer', 'thm-1']]);
  await page.getByRole('button', { name: 'Add thermometer' }).click();
  await expect(page.getByRole('combobox', { name: 'Place' }).locator('option')).toHaveText(['Place', 'T1']);   // never a retired room
  await page.getByRole('textbox', { name: 'Thermometer name' }).fill('Corridor 1');
  await page.getByRole('combobox', { name: 'Place' }).selectOption('area-t1');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.qcard b')).toHaveText(['Corridor 1', 'Hall']);   // the list, A to Z, with the new one's card
  expect(sent.slice(1).map((b) => [b.table, b.fields.name || b.fields.kind, b.fields.area_id || b.fields.ref_id])).toEqual([['thermometer', 'Corridor 1', 'area-t1'], ['qr_tag', 'thermometer', 'thm-3']]);
  expect(Object.keys(sent[1].fields).sort()).toEqual(['area_id', 'name']);   // a thing carries no dates: when it is needed is need rows
});

test('room signs are never made for a room whose room.in_use rows have ended', async ({ page }) => {
  const tables = {
    area: [{ id: 'area-t1', code: 'T1' }, { id: 'area-old', code: '3A.1' }], subject: [], subject_status: [], litter: [], occupancy: [],
    qr_tag: [{ tag: 'EEEEEEEE', kind: 'area', ref_id: 'area-t1', active: 'true' }, { tag: 'FFFFFFFF', kind: 'area', ref_id: 'area-old', active: 'true' }],
    requirement: [{ need_type: 'room.in_use', target_table: 'area', target_id: 'area-old', from_date: '2026-01-01', to_date: '2026-01-31' }]
  };
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [], version: 'test' } });
    return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[JSON.parse(route.request().postData()).table] || [] } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Room signs' }).click();
  await expect(page.locator('.rcard > b')).toHaveText(['T1']);
});

// Lisa 11 Nov 2026: "+ Thermometer" on the hub opens the print page straight at Add thermometer; the place list has
// corridors as well as rooms; after the save the list shows with the new thermometer's QR card. Only an OWNER code
// can save (the save script refuses any other); the button is on the owner's hub, never the staff page.
test('add mode (?add=thermometer): straight to the form; corridors listed; saved thermometer joins the list with its QR card', async ({ page }) => {
  const tables = {
    area: [{ id: 'area-r1', code: '3A.1', group_sort: '1' }, { id: 'area-c', code: '3A corridor', group_sort: '2' }, { id: 'area-r2', code: '3A.2', group_sort: '1' }],
    subject: [], subject_status: [], litter: [], occupancy: [], qr_tag: [{ tag: 'AAAA2222', kind: 'thermometer', ref_id: 'thm-1', active: 'true' }],
    thermometer: [{ id: 'thm-1', name: '3A.1', area_id: 'area-r1' }], requirement: []
  };
  const sent = [];
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, tables: [{ key: 'qr_tag', on: true, mode: 'direct' }, { key: 'thermometer', on: true, mode: 'direct' }], version: 'test' } });
    const b = JSON.parse(route.request().postData());
    if (b.action === 'read') return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[b.table] || [] } } });
    sent.push(b);
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: b.table === 'thermometer' ? 'thm-2' : 'qrt-' + sent.length } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
  await page.goto('cdhub/staff/print/?add=thermometer');
  await expect(page.getByText('Add thermometer', { exact: true }).last()).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Place' }).locator('option')).toHaveText(['Place', '3A.1', '3A.2', '3A corridor']);
  await page.getByRole('textbox', { name: 'Thermometer name' }).fill('3A corridor');
  await page.getByRole('combobox', { name: 'Place' }).selectOption('area-c');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('.qcard b')).toHaveText(['3A corridor', '3A.1']);
  await expect(page.locator('.qcard', { hasText: '3A corridor' }).locator('svg')).toHaveCount(1);
  expect(sent.map((b) => [b.table, b.fields.name || b.fields.kind, b.fields.area_id || b.fields.ref_id])).toEqual([['thermometer', '3A corridor', 'area-c'], ['qr_tag', 'thermometer', 'thm-2']]);
});
