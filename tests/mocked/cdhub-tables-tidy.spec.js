// Lisa 17 Nov 2026: "improve spacing and layout on all tables", and the CCP webinar item (not CD Hub) never on the hub.
// Invented rows only.
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');
const { tabClick } = require('../support/tabs');

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
const WORK = [
  'id,area,item,status,owner,blocked_on,evidence,note',
  'W001,sample,Sample item waiting on Lisa,BLOCKED,Lisa,a sample answer,,',
  'W002,sample,Sample open item that has a much longer name than the others,OPEN,Claude,,,',
  'W043,ccp,Pretend webinar document corrections,DONE,Claude,,"closed 13/11/26: not CD Hub (pretend webinar)",',
  'W044,other,Pretend other-project item,OPEN,Claude,,closed: not CD Hub,',
].join('\n') + '\n';

test('items that are not CD Hub work (area ccp, or marked "not CD Hub") never show on Outstanding', async ({ page, guard }) => {
  setFile(guard.world, 'BLD-WORK.csv', WORK);
  await page.goto('cdhub/');
  await signIn(page);
  await tabClick(page, '#nav button[data-go="work"]');
  await expect(page.locator('#main')).toContainText('Sample open item');
  await expect(page.locator('#main')).not.toContainText('Pretend webinar');
  await expect(page.locator('#main')).not.toContainText('Pretend other-project item');
});

test('every table is tidied: short values stay on one line, long text wraps, and narrow phones get one card per row', async ({ page, guard }) => {
  setFile(guard.world, 'BLD-WORK.csv', WORK);
  await page.goto('cdhub/');
  await signIn(page);
  await tabClick(page, '#nav button[data-go="work"]');
  const table = page.locator('#main table').first();
  await expect(table).toHaveAttribute('data-tidy', '1');
  const idCell = table.locator('tbody td').first();
  await expect(idCell).toHaveClass(/tshort/);
  expect(await idCell.evaluate((e) => getComputedStyle(e).whiteSpace)).toBe('nowrap');
  expect(await idCell.evaluate((e) => getComputedStyle(e).verticalAlign)).toBe('middle');
  const done = page.locator('#main table', { hasText: 'Sample open item' });
  await expect(done.locator('td.tlong').first()).toContainText('much longer name');
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(done).toHaveClass(/tstack/);
  expect(await done.locator('tbody tr').first().evaluate((e) => getComputedStyle(e).display)).toBe('block');
  const item = done.locator('td[data-label="Item"]').first();
  expect(await item.evaluate((e) => getComputedStyle(e, '::before').content)).toContain('Item');   // sentence case (audit 17 Nov 2026)
});
