// Decide is a view, not a table. It lists the records waiting on the owner. Each row has one action.
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');

const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};
const setFile = (world, name, content) => {
  const f = world.files.find((x) => x.name === name);
  if (f) { f.content = content; f.size = String(content.length); }
  else world.file('bld-extra-' + name, name, content, { parents: [IDS.bld], driveId: 'drv-alpha1' });
};

test.describe('CD Hub Decide', () => {
  test('Decide sits with Main and lists only records waiting on the owner; Show opens Do at that item', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await expect(page.locator('#chips .hcl')).toHaveText(['Main', 'Today', 'Do', 'Decide']);
    await page.locator('#chips button[data-go="decide"]').click();
    await expect(page.locator('#main h2').first()).toHaveText('Decide');
    const rows = page.locator('#decideCard .mrow');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('a sample answer');
    await rows.first().getByRole('button', { name: /^Show:/ }).click();
    await expect(page.locator('#main h2').first()).toHaveText('Outstanding');
    await expect(page.locator('#work-W001')).toBeFocused();
  });

  test('nothing waiting: Decide says so', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-WORK.csv', 'id,area,item,status,owner,blocked_on,evidence,note\nW002,sample,Sample open item,OPEN,other,,,\n');
    await page.goto('cdhub/');
    await signIn(page);
    await page.evaluate(() => go('decide'));
    await expect(page.locator('#decideCard')).toContainText('Nothing is waiting on you.');
  });
});
