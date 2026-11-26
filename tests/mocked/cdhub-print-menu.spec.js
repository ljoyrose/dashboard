const { test: base, expect } = require('../support/test');
const { buildWorld, IDS } = require('../support/world');

function world(on) {
  const d = buildWorld();
  if (on) d.file('x', 'BLD-field_visibility.csv', 'k\n1\n', { parents: [IDS.bld], driveId: 'drv-alpha1' });
  return d;
}
const asOn = base.extend({ world: async ({}, use) => use(world(true)) });
const asOff = base.extend({ world: async ({}, use) => use(world(false)) });

async function ready(page) {
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
  await page.waitForFunction(() => window.LOAD && LOAD.later === 'ok');
}

asOff('print link stays out of the menu without the check rows', async ({ page }) => {
  await ready(page);
  await page.locator('#nav [data-house-more]').click();
  await expect(page.locator('#houseMore .htl', { hasText: 'Print QR cards' })).toHaveCount(0);
  expect(await page.evaluate(() => HubNav.html({ links: 'href' }).includes('Print QR cards'))).toBe(false);
});

asOn('print link uses the menu markup and opens the print page', async ({ page }) => {
  await ready(page);
  await page.locator('#nav [data-house-more]').click();
  const item = page.locator('#houseMore > a', { hasText: 'Print QR cards' });
  await expect(item).toBeVisible();
  await expect(item.locator(':scope > span.htl')).toHaveText('Print QR cards');
  await expect(item.locator(':scope > svg.hi use')).toHaveAttribute('href', '#hi-t-print');
  await expect(item).toHaveAttribute('data-slot', '8');
  expect(await page.evaluate(() => !!document.getElementById('hi-t-print'))).toBe(true);
  const labels = await page.locator('#houseMore > :is(a, button) .htl').allTextContents();
  expect(labels).not.toContain('Bin');
  expect(labels.slice(-2)).toEqual(['Settings', 'Print QR cards']);
  const href = await item.getAttribute('href');
  expect(href).toBe(await page.evaluate(() => location.origin + location.pathname.replace(/[^/]*$/, '') + 'staff/print/'));
  await page.locator('#nav button[data-go="staff"]').click();
  const card = await page.evaluate(() => {
    const a = [...document.querySelectorAll('#main a.adm-card')].find((el) => (el.querySelector('span') || {}).textContent === 'Print');
    return a ? a.getAttribute('href') : '';
  });
  expect(card).toBe(href);
  await page.locator('#nav [data-house-more]').click();
  await page.locator('#houseMore > a', { hasText: 'Print QR cards' }).click();
  await expect(page).toHaveURL(href);
  await expect(page.locator('h1')).toHaveText('Print QR cards');
});
