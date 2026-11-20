// The round on a 360px phone never scrolls sideways, however long a dog's or litter's name is.
// Found by the click-crawl in CI on 20 Nov 2026 (JOB CDH-HT.1): the "add a dog…" list grew as wide as its longest entry
// and pushed the page 32px wider than the screen. Invented 27-animal set; pretend Google and Drive.
const base = require('../support/test');
const { buildWorld } = require('../support/world');
const c27 = require('../support/cdhub27');

const test = base.test.extend({ world: async ({}, use) => use(c27.install(buildWorld())) });
const { expect } = base;
test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

test('The round at 360px: a long name in the "add a dog" list does not make the page scroll sideways @regression', async ({ page }) => {
  await page.clock.setFixedTime(c27.NOW);
  await page.goto('cdhub/');
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible({ timeout: 20000 });
  await page.goto('cdhub/#/round');
  await page.waitForFunction(() => typeof LOAD !== 'undefined' && LOAD.state === 'ok' && LOAD.later !== 'wait');
  const list = page.locator('select.radd').first();
  await expect(list).toBeVisible();
  // a name as long as real ones get (invented): the list must stay inside the screen
  await page.evaluate(() => document.querySelectorAll('select.radd').forEach((s) => { const o = document.createElement('option'); o.value = 'sample-long'; o.textContent = 'Whole litter with Sample Dog With A Very Long Registered Name (4)'; s.appendChild(o); }));
  const m = await page.evaluate(() => { const de = document.documentElement; return { over: de.scrollWidth - de.clientWidth, right: Math.round(Math.max(...Array.from(document.querySelectorAll('select.radd')).map((s) => s.getBoundingClientRect().right))) }; });
  expect(m.right, 'the list ends inside the 360px screen').toBeLessThanOrEqual(360);
  expect(m.over, 'the page is no wider than the screen').toBeLessThanOrEqual(1);
});
