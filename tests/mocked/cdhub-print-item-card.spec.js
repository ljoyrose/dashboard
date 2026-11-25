// Print any item (the owner 15 Nov 2026, print-any-item job): one card layout for any BLD-items row (e.g. a fire extinguisher).
// The fields come from the owner's dated rule rows print.fields.item(.<kind_key>); every value prints under its label; the
// photo is fitted whole, never cropped; the QR is at least 60 mm; two cards per A4. Tags use the shared qr-rules.js helper.
// Pretend data only: invented items, invented tags, no real names or numbers.
const { test, expect } = require('../fixtures/job34/load');

const SCRIPT = 'https://script.google.com/macros/s/FAKE-TEST-ID/exec';
const CORS = { 'access-control-allow-origin': '*' };

function world(extra) {
  const tables = Object.assign({
    area: [{ id: 'ar-a', code: 'Room A' }], requirement: [], area_access: [], area_capacity: [], litter: [], subject: [], occupancy: [],
    coat_colour: [], coat_pattern: [], nose_pigment: [], microchip: [], check_type: [], thermometer: [],
    item_kinds: [{ kind_key: 'extinguisher', label: 'Pretend extinguisher type' }, { kind_key: 'kettle', label: 'Pretend kettle type' }],
    items: [
      { id: 'itm-1', item_no: 'EXT-01', name: 'Pretend Extinguisher', kind_key: 'extinguisher', make: 'Pretend Make', model: 'P1', serial_no: 'PRETEND-SN-1', expires_on: '2027-03-02', size: '2 kg', note: 'Pretend note' },
      { id: 'itm-2', item_no: 'K-01', name: 'Pretend Kettle', kind_key: 'kettle', make: 'Pretend Kettle Make', serial_no: 'PRETEND-SN-2' },
      { id: 'itm-1b', item_no: 'EXT-01', name: 'Pretend Extinguisher (moved)', kind_key: 'extinguisher', make: 'Pretend Make', model: 'P1', serial_no: 'PRETEND-SN-1', expires_on: '2027-03-02', corrects_id: 'itm-1' }],
    qr_tag: [{ tag: 'AAAAAAAA', kind: 'item', ref_id: 'itm-1', active: 'true' }, { tag: 'BBBBBBBB', kind: 'item', ref_id: 'itm-2', active: 'true' }],
    breeding_rule: []
  }, extra || {});
  return tables;
}
async function open(page, tables, posts) {
  await page.route(SCRIPT, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ headers: CORS, json: { saveEnabled: true, readEnabled: true, version: 'test',
      tables: [{ key: 'breeding_rule', on: true, mode: 'direct' }, { key: 'qr_tag', on: true, mode: 'direct' }] } });
    const body = JSON.parse(route.request().postData());
    if (body.action === 'read') return route.fulfill({ headers: CORS, json: { ok: true, result: { rows: tables[body.table] || [] } } });
    if (posts) posts.push(body);
    return route.fulfill({ headers: CORS, json: { ok: true, result: { status: 'saved', id: 'pretend-' + posts.length } } });
  });
  await page.addInitScript(([c, u]) => { localStorage.setItem('bld.device.code', c); localStorage.setItem('bld.scriptUrl', u); }, ['FAKE-OWNER', SCRIPT]);
  await page.goto('cdhub/staff/print/');
  await page.getByRole('button', { name: 'Item cards' }).click();
}
const card = (page, id) => page.locator('.icard[data-item="' + id + '"]');

test.describe('Print any item: the item card', () => {
  test('default fields, each under its label; the name has no label; one card per item; the existing tag is reused @regression', async ({ page }) => {
    const posts = [];
    await open(page, world(), posts);
    await expect(page.locator('.icard')).toHaveCount(2);                                   // a correction row is the same item
    const ext = card(page, 'itm-1');
    await expect(ext.locator('.name')).toHaveText('Pretend Extinguisher (moved)');        // the latest row's values
    await expect(ext.locator('dt')).toHaveText(['Item number', 'Type', 'Make', 'Model', 'Serial number', 'Expires on']);
    await expect(ext.locator('[data-k="kind_key"] dd')).toHaveText('Pretend extinguisher type');
    await expect(ext.locator('[data-k="expires_on"] dd')).toHaveText('2 Mar 2027');
    await expect(ext.locator('.code svg')).toHaveCount(1);
    await expect(ext.locator('.tag')).toHaveCount(0);                                     // no tag text on the card
    await expect(card(page, 'itm-2').locator('[data-k="model"]')).toHaveCount(0);         // an empty value prints nothing
    expect(posts.filter((p) => p.table === 'qr_tag')).toHaveLength(0);                    // both items already have tags
  });

  test('the owner\'s print.fields rows choose the fields; one item type can differ; the newest row in force wins', async ({ page }) => {
    await open(page, world({ breeding_rule: [
      { rule_key: 'print.fields.item', value: 'item_no|serial_no', effective_from: '2026-01-01', source: 'Pretend' },
      { rule_key: 'print.fields.item', value: 'item_no|make|size', effective_from: '2026-11-01', source: 'Pretend' },
      { rule_key: 'print.fields.item', value: 'note', effective_from: '2099-01-01', source: 'Pretend' },
      { rule_key: 'print.fields.item.kettle', value: 'serial_no', effective_from: '2026-11-01', source: 'Pretend' },
      { rule_key: 'print.label.size', value: 'Weight', effective_from: '2026-11-01', source: 'Pretend' }] }));
    await expect(card(page, 'itm-1').locator('dt')).toHaveText(['Item number', 'Make']);   // size is blank on the latest row
    await expect(card(page, 'itm-2').locator('dt')).toHaveText(['Serial number']);
    await expect(page.locator('.picks .fpick').filter({ hasText: 'Weight' })).toHaveCount(1);   // the owner's label
  });

  test('a field choice made on the page is used at once and can be saved as a dated owner rule row', async ({ page }) => {
    const posts = [];
    await open(page, world(), posts);
    const picks = page.locator('.picks');
    await picks.getByLabel('Model').uncheck(); await picks.getByLabel('Make').uncheck(); await picks.getByLabel('Note').check();
    await picks.getByRole('button', { name: 'Use these fields' }).click();
    await expect(card(page, 'itm-2').locator('dt')).toHaveText(['Item number', 'Type', 'Serial number']);
    await picks.getByRole('button', { name: 'Save as the usual fields' }).click();
    await expect(page.locator('.msg')).toContainText('Saved');
    const rule = posts.find((p) => p.table === 'breeding_rule');
    expect(rule.fields.rule_key).toBe('print.fields.item');
    expect(rule.fields.value).toBe('item_no|kind_key|serial_no|expires_on|note');
    expect(rule.fields.effective_from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('an item with no code gets one saved first, then printed (owner code)', async ({ page }) => {
    const posts = [];
    await open(page, world({ qr_tag: [{ tag: 'AAAAAAAA', kind: 'item', ref_id: 'itm-1', active: 'true' }] }), posts);
    await expect(page.locator('.icard')).toHaveCount(2);
    const made = posts.filter((p) => p.table === 'qr_tag');
    expect(made).toHaveLength(1);
    expect(made[0].fields.kind).toBe('item'); expect(made[0].fields.ref_id).toBe('itm-2');
    expect(made[0].fields.tag).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
  });

  test('print: two item cards per A4, a QR of at least 60 mm, the photo fitted whole (contain)', async ({ page }) => {
    await open(page, world());
    await page.getByRole('button', { name: '2 per A4' }).click();
    await page.emulateMedia({ media: 'print' });
    const mm = 96 / 25.4;
    const boxes = await page.locator('.icard').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    boxes.forEach((hgt) => expect(hgt / mm).toBeLessThanOrEqual(148.5));                 // two fit on one 297 mm page
    const qr = await card(page, 'itm-1').locator('.code svg').boundingBox();
    expect(Math.min(qr.width, qr.height) / mm).toBeGreaterThanOrEqual(60);
    const fit = await page.evaluate(() => { const st = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch (e) { return []; } }).map((r) => r.cssText).join('\n');   // a font sheet from another site cannot be read
      return /\.dcard \.photo img\s*\{[^}]*object-fit:\s*contain/.test(st); });
    expect(fit).toBe(true);
    await expect(page.locator('.picks')).toBeHidden();                                    // the picker never prints
  });
});
