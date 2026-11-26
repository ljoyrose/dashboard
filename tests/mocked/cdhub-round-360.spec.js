const base = require('../support/test');
const { buildWorld } = require('../support/world');
const c27 = require('../support/cdhub27');

const test = base.test.extend({ world: async ({}, use) => use(c27.install(buildWorld())) });
const { expect } = base;
test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

test('t-cdhub-round-360-spec-1', async ({ page }) => {
  await page.clock.setFixedTime(c27.NOW);
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible({ timeout: 20000 });
  await page.goto('cdhub/#/round');
  await page.waitForFunction(() => typeof LOAD !== 'undefined' && LOAD.state === 'ok' && LOAD.later !== 'wait');
  const list = page.locator('select.radd').first();
  await expect(list).toBeVisible();
  await page.evaluate(() => document.querySelectorAll('select.radd').forEach((s) => { const o = document.createElement('option'); o.value = 'sample-long'; o.textContent = 'Whole litter with Sample Dog With A Very Long Registered Name (4)'; s.appendChild(o); }));
  const m = await page.evaluate(() => { const de = document.documentElement; return { over: de.scrollWidth - de.clientWidth, right: Math.round(Math.max(...Array.from(document.querySelectorAll('select.radd')).map((s) => s.getBoundingClientRect().right))) }; });
  expect(m.right, 'the list ends inside the 360px screen').toBeLessThanOrEqual(360);
  expect(m.over, 'the page is no wider than the screen').toBeLessThanOrEqual(1);
});

