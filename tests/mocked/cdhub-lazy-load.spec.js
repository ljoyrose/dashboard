// CD Hub lazy load (menu PR 4, OV11 15 Nov 2026): Breed Better and Enquiries load the first time a page that uses them
// opens, not on first open. First load must be lighter; each page still works; a failed part says so and tries again.
const { test, expect } = require('../support/test');

const signIn = async (page) => {
  await expect(page.locator('#signinbtn')).toBeEnabled();
  await page.locator('#signinbtn').click();
  await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
};
const LAZY_JS = /\/(breed-better\/(score|dna-panel|hub-view)\.js|enquiries\/(core|reader|requests|examples)\.js|cdhub\/enquiries-view\.js)$/;
const own = (page, list) => page.on('requestfinished', (r) => {
  const u = new URL(r.url());
  if (u.hostname === '127.0.0.1') list.push({ path: u.pathname, size: r.sizes().then((s) => s.responseBodySize).catch(() => 0) });
});
const total = async (list) => (await Promise.all(list.map((x) => x.size))).reduce((a, b) => a + b, 0);

test.describe('CD Hub lazy load', () => {
  test('first open fetches no Breed Better or Enquiries code, and is at least 250 KB lighter than once Dogs has opened', async ({ page }) => {
    const got = [];
    own(page, got);
    await page.goto('cdhub/');
    await signIn(page);
    await page.waitForLoadState('load');
    expect(got.filter((x) => LAZY_JS.test(x.path)).map((x) => x.path)).toEqual([]);
    const first = await total(got);
    await page.evaluate(() => go('dogs'));
    await expect(page.locator('#main #q')).toBeVisible();   // the Dogs page, after its parts have run
    const parts = got.filter((x) => LAZY_JS.test(x.path));
    expect(parts.length).toBe(8);
    const lazyBytes = await total(parts);
    expect(lazyBytes, 'bytes moved off first open').toBeGreaterThan(250000);
    expect(first).toBeLessThan(await total(got) - 250000);
  });

  test('Enquiries opens after its parts load, and each part is fetched only once', async ({ page }) => {
    const got = [];
    own(page, got);
    await page.goto('cdhub/');
    await signIn(page);
    await page.evaluate(() => go('enquiries'));
    await expect(page.locator('#main h2').first()).toContainText('Enquiries');
    await expect(page.locator('#cdWait')).toHaveCount(0);
    await page.evaluate(() => go('map'));
    await page.evaluate(() => go('enquiries'));
    await expect(page.locator('#cdWait')).toHaveCount(0);
    expect(got.filter((x) => /enquiries-view\.js$/.test(x.path))).toHaveLength(1);
  });

  test('the tables each part reads are read from first open, and match the part\'s own list', async ({ page }) => {
    await page.goto('cdhub/');
    await signIn(page);
    await page.evaluate(() => BLDLazy.load(LAZY.bb.src.concat(LAZY.enq.src)));
    const r = await page.evaluate(() => ({ bb: [LAZY.bb.files, BBHubView.FILES], enq: [LAZY.enq.files, CDEnquiries.FILES], want: WANT }));
    expect(r.bb[0].slice().sort()).toEqual(r.bb[1].slice().sort());
    expect(r.enq[0].slice().sort()).toEqual(r.enq[1].slice().sort());
    for (const f of r.bb[0].concat(r.enq[0])) expect(r.want, f).toContain(f);
  });

  test('a part that fails to load says so; the next open tries again and the page shows', async ({ page, allowedConsole }) => {
    allowedConsole.push(/Failed to load resource: the server responded with a status of 500/);
    let fail = true;
    await page.route('**/enquiries/core.js', (route) => (fail ? route.fulfill({ status: 500, body: '' }) : route.fallback()));
    await page.goto('cdhub/');
    await signIn(page);
    await page.evaluate(() => go('enquiries'));
    await expect(page.locator('#cdWait')).toContainText('This page could not load');
    fail = false;
    await page.evaluate(() => go('map'));
    await page.evaluate(() => go('enquiries'));
    await expect(page.locator('#cdWait')).toHaveCount(0);
    await expect(page.locator('#main h2').first()).toContainText('Enquiries');
  });
});
