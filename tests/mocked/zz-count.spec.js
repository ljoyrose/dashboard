const { test, expect } = require('../support/test');
const { HUBS } = require('../support/hubs');
test('count', async ({ page, guard }) => {
  await HUBS.money.open(page, guard); await page.waitForTimeout(300);
  console.log('MONEY', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('#view a[href], #view button')].filter((e) => e.getBoundingClientRect().width).map((e) => e.tagName + ' ' + (e.getAttribute('href') || '') + ' ' + e.getAttributeNames().filter((n) => n.startsWith('data-')).join(',')))));
});
