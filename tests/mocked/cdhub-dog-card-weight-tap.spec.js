// Dog card weight (Lisa, 15 Nov 2026): on a puppy, tapping "no weight" opened the weights panel at the top of the page,
// which looked like a reload. Now the tap opens the weight section in place with Add weight; the save ticks there and the
// new weight shows at once, with the page left where it was. Invented puppy only; the save script is pretend.
const { test, expect } = require('../fixtures/job34/load');
const { HUBS } = require('../support/hubs');

const SINK = 'https://script.google.com/macros/s/PRETENDSCRIPT/exec';
const csv = (h, rows) => [h].concat(rows).join('\r\n') + '\r\n';
function put(world, name, content) {
  const f = world.files.find((x) => x.name === name && !x.trashed);
  if (f) { f.content = content; f.size = String(content.length); return; }
  const like = world.files.find((x) => x.name === 'BLD-area.csv' && !x.trashed);
  world.file('fx-' + name, name, content, { parents: like.parents, driveId: like.driveId, mimeType: like.mimeType });
}

test('puppy: tapping "no weight" opens Add weight in place; the save ticks and the weight shows at once', async ({ page, guard }) => {
  const w = guard.world;
  put(w, 'BLD-subject.csv', csv('id,tenant_id,name,sex,dob,kind,neuter_status', ['sub-p1,t,Pretend Pup,Female,2026-10-01,Puppy,entire']));
  put(w, 'BLD-subject_status.csv', csv('id,tenant_id,subject_id,state', ['s1,t,sub-p1,Active']));
  put(w, 'BLD-weight.csv', csv('id,subject_id,performed_on,weight_kg,unit,body_condition_score,bcs_scale,source', []));
  await HUBS.cdhub.open(page, guard);
  await page.evaluate((url) => { localStorage.setItem('cdhub.sink.url', url); localStorage.setItem('cdhub.sink.code', 'pretend-code'); }, SINK);
  const bodies = [];
  await page.route(SINK, async (route) => {
    bodies.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved' } }) });
  });
  await page.setViewportSize({ width: 390, height: 500 });
  await page.evaluate(() => go('dogs/sub-p1'));
  const card = page.locator('#rows article.dc', { hasText: 'Pretend Pup' });
  const sec = card.locator('details.wtc');
  await expect(sec.locator('[data-k="weight"]')).toHaveText('no weight');
  await sec.locator('summary').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.evaluate(() => { window.__stay = 1; });
  const url = page.url(), y = await page.evaluate(() => window.scrollY);
  await sec.locator('[data-k="weight"]').click();
  await expect(sec).toHaveAttribute('open', '');
  const form = sec.locator('form[data-weigh-form="sub-p1"]');
  await expect(form).toBeVisible();
  expect(await page.evaluate(() => window.__stay)).toBe(1);   // no reload
  expect(page.url()).toBe(url);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - y)).toBeLessThan(40);   // no jump to the top
  await expect(page.locator('#wpanel')).toBeEmpty();
  await form.locator('input[name="kg"]').fill('1.25');
  await form.getByRole('button', { name: 'Add weight' }).click();
  const after = page.locator('#rows article.dc', { hasText: 'Pretend Pup' }).locator('details.wtc');
  await expect(after.locator('[data-saved="good"]')).toBeVisible();
  await expect(after).toHaveAttribute('open', '');
  await expect(after.locator('[data-k="weight"]')).toContainText('1.25 kg');
  expect(bodies.some((b) => b.action === 'weighing' || (b.fields && b.fields.weight_kg === '1.25') || JSON.stringify(b).includes('"1.25"'))).toBe(true);
  expect(await page.evaluate(() => window.__stay)).toBe(1);
});

