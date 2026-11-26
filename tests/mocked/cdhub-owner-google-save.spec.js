// Owners save with their Google sign-in (the owner 16 Nov 2026, option A): a signed-in hub sends the sign-in with the save
// and asks for no code. If the save script answers that this Google account is not an owner, the hub asks for the
// staff code and sends again with the code only. Invented rooms; pretend save script; pretend Google sign-in.
const { test, expect, HUBS } = require('../fixtures/job34/load');
const { SINK } = require('../support/dog-photo-world');

async function openNoCode(page, guard) {
  await HUBS.cdhub.open(page, guard);
  await page.evaluate((url) => { localStorage.setItem('cdhub.sink.url', url); ['cdhub.sink.code', 'bld.device.code', 'bld.staffCode'].forEach((k) => localStorage.removeItem(k)); sessionStorage.clear(); }, SINK);
}
async function saves(page, answer) {
  const bodies = [];
  await page.route(SINK, async (route) => {
    const b = JSON.parse(route.request().postData() || '{}'); bodies.push(b);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(answer(b, bodies.length)) });
  });
  return bodies;
}
async function typeReading(page) {
  await page.evaluate(() => go('round'));
  await page.locator('#rdate').fill('2026-11-11');
  await page.locator('#rdate').dispatchEvent('change');
  const min = page.locator('.tmin[data-slot="am"]').first();
  const area = await min.getAttribute('data-area');
  await min.fill('11.3'); await min.blur();
  const max = page.locator(`.tmax[data-area="${area}"][data-slot="am"]`);
  await max.fill('13.2'); await max.blur();
  return area;
}

test.describe('CD Hub: owner saves with Google sign-in', () => {
  test('signed in with no code kept: saving is on, the save carries the sign-in, and no code is asked', async ({ page, guard }) => {
    await openNoCode(page, guard);
    expect(await page.evaluate(() => sinkOn())).toBe(true);
    const bodies = await saves(page, () => ({ ok: true, result: { status: 'saved', id: 'ar-1', at: '2026-11-11T09:00:00Z' } }));
    const area = await typeReading(page);
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0]).toMatchObject({ table: 'area_reading', code: '', fields: { area_id: area, min_c: '11.3', max_c: '13.2' } });
    expect(typeof bodies[0].google_token).toBe('string');
    expect(bodies[0].google_token.length).toBeGreaterThan(0);
    await expect(page.locator('[data-staff-code]')).toHaveCount(0);
  });

  test('not an owner account: the hub asks for the staff code and sends again with the code only', async ({ page, guard }) => {
    await openNoCode(page, guard);
    const bodies = await saves(page, (b, n) => n === 1
      ? { ok: false, code: 'GOOGLE_NOT_OWNER', message: 'This Google account is not on the owner list. Enter your staff code. Nothing was saved.' }
      : { ok: true, result: { status: 'saved', id: 'ar-2', at: '2026-11-11T09:00:00Z' } });
    await typeReading(page);
    await expect(page.locator('[data-staff-code]')).toBeVisible();
    await page.locator('[data-staff-code] input').fill('pretend-code-9');
    await page.getByRole('button', { name: 'Use this code' }).click();
    await expect.poll(() => bodies.length).toBe(2);
    expect(bodies[1].code).toBe('pretend-code-9');
    expect(bodies[1].google_token).toBeUndefined();
    expect(bodies[1].request_id).toBe(bodies[0].request_id);   // the same save, never two
  });

  test('Switch off here also stops saving with the Google sign-in', async ({ page, guard }) => {
    await openNoCode(page, guard);
    await page.evaluate(() => go('round'));
    await page.locator('#sinkoff').click();
    expect(await page.evaluate(() => sinkOn())).toBe(false);
  });
});
