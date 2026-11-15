// CD Hub Decide (menu option A, OV11 14 Nov 2026): a view, not a table. The items waiting on the owner, each with one tap.
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
  test('Decide sits in Main\'s More list and lists only what waits on you; Show opens Do at that item', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await page.locator('nav.house-tabs [data-house-more]').click();
    await page.locator('#houseMore button[data-go="decide"]').click();
    await expect(page.locator('#main h2').first()).toHaveText('Decide');
    const rows = page.locator('#decideCard .mrow');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('Sample item waiting on Lisa');
    await expect(rows.first()).toContainText('a sample answer');
    await expect(page.locator('#decideCard')).not.toContainText('waiting on Claude');
    await rows.first().getByRole('button', { name: 'Show: Sample item waiting on Lisa' }).click();
    await expect(page.locator('#main h2').first()).toHaveText('Outstanding');
    await expect(page.locator('#work-W001')).toBeFocused();
  });

  test('nothing waiting: Decide says so', async ({ page, guard }) => {
    setFile(guard.world, 'BLD-WORK.csv', 'id,area,item,status,owner,blocked_on,evidence,note\nW002,sample,Sample item waiting on Claude,OPEN,Claude,,,\n');
    await page.goto('cdhub/');
    await signIn(page);
    await page.evaluate(() => go('decide'));
    await expect(page.locator('#decideCard')).toContainText('Nothing is waiting on you.');
  });
});
