// Lisa 19 Nov 2026: "Site loops a lot including eventually ending in a dead-end". Every path from Needs you / Outstanding
// ends where the action is: a list opens on screen at phone width, a check opens at its own row, a note shows once.
const { test: base, expect } = require('../support/test');
const { buildWorld, IDS } = require('../support/world');

const WORK = [
  'id,raised_on,raised_by,area,item,status,blocked_on,owner,evidence,note',
  'W905,2026-11-01,Lisa,rules,Pretend rule groups,OPEN,,Claude,,Pretend note shown once',
].join('\n') + '\n';
const test = base.extend({ world: async ({}, use) => {
  const d = buildWorld();
  const f = d.files.find((x) => x.name === 'BLD-WORK.csv');
  if (f) { f.content = WORK; f.size = String(WORK.length); }
  else d.file('wk-work', 'BLD-WORK.csv', WORK, { parents: [IDS.bld], driveId: 'drv-alpha1' });
  use(d);
} });

async function signIn(page) {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
}

test('a work note shows once, not again in the waiting-on column', async ({ page }) => {
  await signIn(page);
  await page.goto('cdhub/#/work');
  const row = page.locator('#work-W905');
  await expect(row).toBeVisible();
  await expect(row.getByText('Pretend note shown once')).toHaveCount(1);
});

test('a list opened from Needs you is on screen at phone width', async ({ page }) => {
  await signIn(page);
  await page.goto('cdhub/#/today/here');
  await expect(page.locator('#tpanel h4')).toBeVisible();
  await expect(page.locator('#tpanel h4')).toBeInViewport();
});

test('a check opened by address lands on its own row', async ({ page }) => {
  await signIn(page);
  await page.goto('cdhub/#/compliance/ck-tables');
  const row = page.locator('#ck-tables');
  await expect(row).toBeInViewport();
  await expect(row).toBeFocused();
});
