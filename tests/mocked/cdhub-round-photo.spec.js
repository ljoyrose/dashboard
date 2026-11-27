// The Round in CD Hub: after a temperature reading or an Empty mark is saved, a photo may be added as evidence.
// The reading is saved first; the photo is optional. Switch: rule row job.temps_keep_photo = yes (no row = no offer).
// Invented rooms; pretend save script; pretend Google sign-in.
const { test, expect, HUBS } = require('../fixtures/job34/load');
const { SINK } = require('../support/dog-photo-world');

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const RULE = { id: 'r-1', rule_key: 'job.temps_keep_photo', value: 'yes', effective_from: '2026-01-01' };

async function open(page, guard, rules) {
  await HUBS.cdhub.open(page, guard);
  await page.evaluate((url) => { localStorage.setItem('cdhub.sink.url', url); }, SINK);
  const sent = [];
  await page.route(SINK, async (route) => {
    const b = JSON.parse(route.request().postData() || '{}'); sent.push(b);
    const id = b.action === 'file_add' ? 'fil-1' : b.action === 'link_add' ? 'lnk-1' : 'ar-1';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id, at: '2026-11-11T09:00:00Z' } }) });
  });
  await page.evaluate(() => go('round'));
  await page.locator('#rdate').fill('2026-11-11');
  await page.locator('#rdate').dispatchEvent('change');
  await page.evaluate((r) => { T['BLD-breeding_rule.csv'] = r; }, rules);
  return sent;
}
async function typeReading(page) {
  const min = page.locator('.tmin[data-slot="am"]').first();
  const area = await min.getAttribute('data-area');
  await min.fill('11.3'); await min.blur();
  const max = page.locator(`.tmax[data-area="${area}"][data-slot="am"]`);
  await max.fill('13.2'); await max.blur();
  return area;
}

test.describe('CD Hub Round: photo after a reading', () => {
  test('a saved reading offers a photo; a chosen photo is kept and linked to the reading @regression @live', async ({ page, guard }) => {
    const sent = await open(page, guard, [RULE]);
    const area = await typeReading(page);
    const offer = page.locator(`[data-round-photo^="${area}|am"] [data-ev-photo]`);
    await expect(offer).toContainText('Add photo');
    expect(sent.map((b) => b.table || b.action)).toEqual(['area_reading']);   // the reading is saved before any photo
    await offer.locator('input[type=file]').setInputFiles({ name: 'thermometer.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') });
    await expect(offer).toContainText('Photo kept');
    const file = sent.find((b) => b.action === 'file_add'), link = sent.find((b) => b.action === 'link_add');
    expect(file.fields).toMatchObject({ kind: 'photo', mime: 'image/jpeg', taken_on: '2026-11-11' });
    expect(link.fields).toMatchObject({ from_table: 'area_reading', from_id: 'ar-1', role: 'evidence', to_table: 'files', to_id: 'fil-1' });
  });

  test('Skip leaves the saved reading and sends nothing more', async ({ page, guard }) => {
    const sent = await open(page, guard, [RULE]);
    const area = await typeReading(page);
    const offer = page.locator(`[data-round-photo^="${area}|am"] [data-ev-photo]`);
    await offer.getByRole('button', { name: 'Skip' }).click();
    await expect(offer).toHaveCount(0);
    expect(sent.map((b) => b.table || b.action)).toEqual(['area_reading']);
  });

  test('an Empty mark offers a photo too', async ({ page, guard }) => {
    await open(page, guard, [RULE]);
    const empty = page.locator('.rempty[data-slot="am"]').first();
    const area = await empty.getAttribute('data-area');
    await empty.click();
    await expect(page.locator(`[data-round-photo^="${area}|am"] [data-ev-photo]`)).toContainText('Add photo');
  });

  test('with no job.temps_keep_photo row no photo is offered', async ({ page, guard }) => {
    const sent = await open(page, guard, []);
    const area = await typeReading(page);
    await expect.poll(() => sent.length).toBe(1);
    await expect(page.locator(`.tmsg[data-area="${area}"][data-slot="am"]`)).toContainText(/saved/i);
    await expect(page.locator('[data-round-photo]')).toHaveCount(0);
  });
});
