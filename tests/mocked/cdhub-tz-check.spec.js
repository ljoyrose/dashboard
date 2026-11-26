const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');

const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};
const put = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-extra-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};
const H = 'id,tenant_id,language_tag,time_zone,from_date,to_date,source\n';
const row = (page) => page.locator('#checksCard .ckrow', { hasText: 'Time zone' });

test('no locale row: the check fails with "Time zone not set"', async ({ page, guard }) => {
  put(guard.world, 'BLD-locale.csv', H);
  await page.goto('cdhub/#/compliance');
  await signIn(page);
  await expect(row(page)).toHaveClass(/bad/);
  await expect(row(page)).toContainText('Time zone not set');
});

test("an ended row, one with no time zone, or another tenant's row does not count", async ({ page, guard }) => {
  put(guard.world, 'BLD-locale.csv', H + 'l1,ten-test,en-GB,Europe/London,2020-01-01,2020-12-31,Pretend\nl2,ten-test,en-GB,,2021-01-01,,Pretend\nl4,other-tenant,en-GB,Europe/Paris,2021-01-01,,Pretend\n');
  await page.goto('cdhub/#/compliance');
  await signIn(page);
  await expect(row(page)).toContainText('Time zone not set');
});

test('a time zone in force today passes and is shown', async ({ page, guard }) => {
  put(guard.world, 'BLD-locale.csv', H + 'l3,ten-test,en-GB,Europe/London,2021-01-01,,Pretend\n');
  await page.goto('cdhub/#/compliance');
  await signIn(page);
  await expect(row(page)).toHaveClass(/ ok/);
  await expect(row(page)).toContainText('Europe/London');
});

