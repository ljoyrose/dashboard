// Compliance mock-up gaps (7 Nov 2026): rehearsal and access. Invented rows only.
const { tabClick } = require('../support/tabs');
const { test, expect, HUBS } = require('../fixtures/job34/load');

const tab = async (page, id) => {
  await tabClick(page, `#nav button[data-go="${id}"]`);
  await expect(page.locator(`#nav button[data-go="${id}"]`)).toHaveAttribute('aria-current', 'page');
};

test.describe('CD Hub: Compliance rehearsal and access', () => {
  // H-04: a rehearsal leaves no trace: no count, no score, nowhere (not the page, not the browser's storage).
  test('rehearsal: notes show while it runs, then End leaves no trace', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    const store = () => page.evaluate(() => JSON.stringify([Object.keys(localStorage).map((k) => localStorage.getItem(k)), Object.keys(sessionStorage).map((k) => sessionStorage.getItem(k))]));
    const before = await store();
    await page.locator('#rhStart').click();
    await page.locator('#rhNote').fill('Pretend practice note');
    await page.locator('#rhAdd').click();
    await expect(page.locator('#rhList')).toContainText('Pretend practice note');
    expect(await store()).not.toContain('Pretend practice note');
    await page.locator('#rhEnd').click();
    await expect(page.locator('#rhStart')).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Pretend practice note');
    expect(await store()).toBe(before);
    expect(await page.evaluate(() => REHEARSAL)).toBeNull();
  });

  test('rehearsal: leaving Compliance discards it', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    await page.locator('#rhStart').click();
    await page.locator('#rhNote').fill('Pretend practice note');
    await page.locator('#rhAdd').click();
    await tab(page, 'dogs');
    await tab(page, 'compliance');
    await expect(page.locator('#rhStart')).toBeVisible();
    await expect(page.locator('main')).not.toContainText('Pretend practice note');
  });

  test('access: links to the owner page from the save address; says so when none is set', async ({ page, guard }) => {
    await HUBS.cdhub.open(page, guard);
    await tab(page, 'compliance');
    await expect(page.locator('#accOff')).toBeVisible();
    await page.evaluate(() => { localStorage.setItem('cdhub.sink.url', 'https://script.google.com/macros/s/SAMPLE-fake-address/exec'); go('compliance', false); });
    await expect(page.locator('#accOpen')).toHaveAttribute('href', 'https://script.google.com/macros/s/SAMPLE-fake-address/exec?page=approve');
  });
});
