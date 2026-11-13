// Dog card room control (Lisa 13 Nov 2026): a dog or pup with no room gets Place on its card; the picker offers cabins
// with space and Off-site; a move is one new occupancy row through the save script and the card shows a tick.
// Invented rows only. Nothing here is posted to a live sheet.
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

const setFile = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-extra-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};

test('a pup with no room has Place on its card; Off-site and a move save through the save script with a tick', async ({ page, guard }) => {
  setFile(guard.world, 'BLD-area_access.csv', 'id,area_id,access_type\nax-1,area-1,free\nax-2,area-2,free\n');
  setFile(guard.world, 'BLD-area_capacity.csv', 'id,area_id,access_type,size_band,max_dogs,from_date,to_date,basis\n'
    + 'cap-1,area-1,free,small,4,2026-01-01,,invented\ncap-2,area-1,free,medium,3,2026-01-01,,invented\n'
    + 'cap-3,area-1,free,medium + pups,1,2026-01-01,,invented\ncap-4,area-2,free,medium,3,2026-01-01,,invented\n');
  setFile(guard.world, 'BLD-breeding_rule.csv', 'id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by\n'
    + 'r3,t,size_from_kg.medium,10,2026-01-01,Pretend vet,,,\nr4,t,size_from_kg.large,25,2026-01-01,Pretend vet,,,\n');
  const sent = [];
  await page.route(/^https:\/\/script\.google\.com\/macros\//, (route) => {
    sent.push(JSON.parse(route.request().postData() || '{}'));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: { status: 'saved', id: 'occ-new' } }) });
  });
  await page.addInitScript(() => {
    localStorage.setItem('cdhub.sink.url', 'https://script.google.com/macros/s/AKfyTEST_only_123/exec');
    localStorage.setItem('cdhub.sink.code', 'test-code-1');
  });
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await tabClick(page, '#nav button[data-go="dogs"]');

  const pup = page.locator('.dc[data-dog="sub-test-pup-1"]');
  await expect(pup).toContainText('—');
  await pup.getByRole('button', { name: 'Place' }).click();
  const mv = page.locator('[data-move-panel]');
  await expect(mv).toBeVisible();
  await expect(mv.locator('[data-move-off]')).toHaveCount(0);   // not in a cabin, so nothing to take off site
  // the pup joins its dam (Test Dog One, medium, in area-1): a dam with her litter counts once, against the 'medium + pups' row
  const dest = mv.locator('[data-move-to="area-1"]');
  await expect(dest).toBeVisible();
  const to = 'area-1';
  await dest.click();
  await expect(page.locator('.dc[data-dog="sub-test-pup-1"] [data-k="moved"]')).toHaveText('moved ✓');
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ table: 'occupancy', action: 'add', fields: { subject_id: 'sub-test-pup-1', area_id: to } });

  const two = page.locator('.dc[data-dog="sub-test-dog-2"]');
  await two.locator('[data-cabin-move]').first().click();
  await page.locator('[data-move-panel] [data-move-off]').click();
  await expect(page.locator('.dc[data-dog="sub-test-dog-2"] [data-k="moved"]')).toHaveText('moved ✓');
  expect(sent).toHaveLength(2);
  expect(sent[1]).toMatchObject({ table: 'occupancy_out', fields: { subject_id: 'sub-test-dog-2', off_site_kind: 'temporary' } });
  await expect(page.locator('.dc[data-dog="sub-test-dog-2"]')).toContainText('off site');
});

test('BFFs and Fren. show on the dog card from dated link rows, both ways, with the words from the rule rows', async ({ page, guard }) => {
  setFile(guard.world, 'BLD-breeding_rule.csv', 'id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by\n'
    + 'r1,t,link_kind.bff,BFFs,2026-01-01,Pretend,,,\nr2,t,link_kind.not_with,Fren.,2026-01-01,Pretend,,,\n');
  setFile(guard.world, 'BLD-subject_link.csv', 'id,tenant_id,subject_id,other_subject_id,kind,from_date,to_date,source,note,set_at,set_by\n'
    + 'sl-1,t,sub-test-dog-1,sub-test-dog-2,bff,2026-01-01,,Pretend,,,\n'
    + 'sl-2,t,sub-test-pup-1,sub-test-dog-1,not_with,2026-01-01,,Pretend,,,\n'
    + 'sl-3,t,sub-test-dog-2,sub-test-pup-1,bff,2020-01-01,2020-12-31,Pretend,,,\n');
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await tabClick(page, '#nav button[data-go="dogs"]');
  const one = page.locator('.dc[data-dog="sub-test-dog-1"] [data-k="links"]');
  await expect(one).toHaveText('BFFs: Test Dog Two · Fren.: Test Pup One');
  await expect(page.locator('.dc[data-dog="sub-test-dog-2"] [data-k="links"]')).toHaveText('BFFs: Test Dog One');   // the 2020 link has ended
  await expect(one.getByRole('link', { name: 'Test Dog Two' })).toHaveAttribute('href', '#/dogs/sub-test-dog-2');
});

test('no link file yet: the hub still loads and no card shows a links line', async ({ page }) => {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await tabClick(page, '#nav button[data-go="dogs"]');
  await expect(page.locator('.dc').first()).toBeVisible();
  await expect(page.locator('[data-k="links"]')).toHaveCount(0);
});
