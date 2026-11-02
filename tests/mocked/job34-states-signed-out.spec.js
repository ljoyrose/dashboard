// JOB 34 state matrix (group E): SIGNED OUT, every hub. signin-gate.spec.js already proves only the sign-in shows on each
// hub's front address; this adds what it does not check: no private call (Drive / Sheets) is made before sign-in, the
// sign-in button is there, and every deep view address (#/...) stays locked too. Pretend Google, Drive and Sheets.
const { test, expect, HUBS, fixture } = require('../fixtures/job34/load');
const H = fixture('states', 'hubs.json');
const PRIVATE = /^https:\/\/(www\.googleapis\.com\/drive|sheets\.googleapis\.com|www\.googleapis\.com\/oauth2|people\.googleapis\.com)/;

test.describe.configure({ timeout: 60_000 });
for (const hub of Object.keys(HUBS)) {
  test(`${hub}: signed out, every view stays locked, only the sign-in shows and no private call is made`, async ({ page, guard }) => {
    const calls = [];
    page.on('request', (r) => { if (PRIVATE.test(r.url())) calls.push(r.method() + ' ' + r.url()); });
    await page.goto(H[hub].url);
    await expect(page.locator(H[hub].signIn).first()).toBeVisible();
    await expect(page.locator('html')).toHaveClass(/dash-locked/);
    for (const v of HUBS[hub].views) {
      await page.evaluate((x) => { location.hash = '#/' + x; }, v);
      await page.waitForTimeout(150);
      await expect(page.locator('html'), `${hub} #/${v} unlocked while signed out`).toHaveClass(/dash-locked/);
      await expect(page.locator('nav.house-tabs'), `${hub} #/${v} shows the menu signed out`).toBeHidden();
    }
    await page.waitForTimeout(500);
    expect(calls, `${hub} called Google for data before sign-in`).toEqual([]);
    expect(guard.world.calls.length, `${hub} asked the pretend Drive before sign-in`).toBe(0);
  });
}
