// Views a new kennel starts with switched off (the owner 13 Nov 2026, PR 472; Enquiries added 15 Nov 2026): Assocs, the Table map,
// Litters, Vet and Enquiries. The data stays; the views are off every menu, and their old addresses open Main.
// An owner turns one back on with a dated row nav.view.<id> = 1. Pretend Google and Drive only; rows invented.
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');

const HEAD = 'id,tenant_id,rule_key,value,effective_from,source,note,set_at,set_by\n';
const setFile = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-extra-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};
const signIn = async (page) => {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};
const HIDDEN = ['buyers', 'shape', 'litters', 'vet', 'enquiries'];

test('with no rows, Assocs, Table map, Litters, Vet and Enquiries are off every menu and their addresses open Main @regression', async ({ page, guard }) => {
  setFile(guard.world, 'BLD-breeding_rule.csv', HEAD);
  await signIn(page);
  for (const id of HIDDEN) {
    await expect(page.locator(`[data-go="${id}"], a[href$="#/${id}"]`)).toHaveCount(0);
    expect(await page.evaluate((v) => navHas(v), id)).toBe(false);
  }
  for (const id of HIDDEN) {
    await page.evaluate((v) => { location.hash = '#/' + v; }, id);
    await expect(page).toHaveURL(/#\/map$/);
  }
});

test('an owner row nav.view.litters = 1 brings Litters back; the others stay off', async ({ page, guard }) => {
  setFile(guard.world, 'BLD-breeding_rule.csv', HEAD + 'v1,t,nav.view.litters,1,2026-01-01,Pretend setting,,,\n');
  await signIn(page);
  expect(await page.evaluate(() => navHas('litters'))).toBe(true);
  for (const id of HIDDEN.filter((x) => x !== 'litters')) expect(await page.evaluate((v) => navHas(v), id)).toBe(false);
  await page.evaluate(() => go('litters'));
  await expect(page).toHaveURL(/#\/litters$/);
});
