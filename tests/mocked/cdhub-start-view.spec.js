// the owner 18 Nov 2026 (demo): "The hub opens on Records, with the sub-menu visible at the top." An owner row
// nav.start.OWNER = the section's slot number (4 = Records) picks where the hub opens with no address. No row: Main.
// Pretend Google and Drive only; rows invented.
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

test('with no start row the hub opens on Main', async ({ page, guard }) => {
  setFile(guard.world, 'BLD-breeding_rule.csv', HEAD);
  await signIn(page);
  await expect(page.locator('#main')).toHaveAttribute('data-view', 'map');
});

test('nav.start.OWNER = 4 opens Records (Dogs) with its sub-menu; an address still wins', async ({ page, guard }) => {
  setFile(guard.world, 'BLD-breeding_rule.csv', HEAD + 's1,t,nav.start.OWNER,4,2026-01-01,Pretend setting,,,\n');
  await signIn(page);
  await expect(page.locator('#main')).toHaveAttribute('data-view', 'dogs');
  await expect(page.locator('#chips')).toBeVisible();
  await page.evaluate(() => { location.hash = '#/compliance'; });
  await expect(page.locator('#main')).toHaveAttribute('data-view', 'compliance');
});
