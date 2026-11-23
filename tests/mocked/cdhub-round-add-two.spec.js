// Lisa 16 Nov 2026: an empty room could not take a second dog while the first was still saving. The list now goes
// back to "add a dog..." at once, a dog being added shows "adding..." and cannot be picked twice, and both moves save.
// Invented dogs and rooms; pretend save script that answers slowly.
const { test, expect, HUBS } = require('../fixtures/job34/load');
const { SINK } = require('../support/dog-photo-world');

test('two dogs added to one room one after the other: both are sent, the list resets, no dog is sent twice', async ({ page, guard }) => {
  const occ = guard.world.files.find((x) => x.name === 'BLD-occupancy.csv');   // both dogs on site (SLA) so the round lists them
  occ.content = occ.content.replace('sub-test-dog-1,area-1,Resident,', 'sub-test-dog-1,area-1,SLA,').replace('sub-test-dog-2,area-2,Resident,', 'sub-test-dog-2,area-1,SLA,');   // both in one room, so another room is empty
  await HUBS.cdhub.open(page, guard);
  await page.evaluate((url) => { localStorage.setItem('cdhub.sink.url', url); localStorage.setItem('cdhub.sink.code', 'pretend-code'); }, SINK);
  const bodies = [];
  await page.route(SINK, async (route) => {
    const b = JSON.parse(route.request().postData() || '{}'); bodies.push(b);
    await new Promise((r) => setTimeout(r, 800));   // a slow save
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id: 'occ-' + bodies.length } }) });
  });
  await page.evaluate(() => go('round'));
  const pick = await page.locator('.radd').evaluateAll((els) => {
    for (const el of els) { const o = [...el.options].filter((x) => x.value && !x.disabled && x.value.indexOf('litter:') !== 0); if (o.length >= 2) return { area: el.dataset.area, a: o[0].value, b: o[1].value }; }
    return null;
  });
  expect(pick, 'the test data has two dogs that can be added').not.toBeNull();
  const sel = () => page.locator(`.radd[data-area="${pick.area}"]`);
  await sel().selectOption(pick.a);
  await expect(sel()).toHaveValue('');                                          // back to "add a dog..." at once
  await expect(sel().locator(`option[value="${pick.a}"]`)).toBeDisabled();      // cannot be picked twice
  await sel().selectOption(pick.b);
  await expect.poll(() => bodies.length).toBe(2);
  expect(bodies.map((b) => b.fields.subject_id)).toEqual([pick.a, pick.b]);
  expect(bodies.every((b) => b.table === 'occupancy' && b.fields.area_id === pick.area)).toBe(true);
  await expect(sel().locator(`option[value="${pick.b}"]`)).toContainText('here');
  await expect(sel().locator(`option[value="${pick.a}"]`)).toContainText('here');
});
