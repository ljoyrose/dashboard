// Quick fixes from the 18 Oct 2026 review: CD Hub link and text cleaning, sign-out on the Bin,
// and the 5-minute refresh that used to wipe your ticks. Pretend Google and Drive only.
const { test, expect } = require('../support/test');
const { IDS } = require('../support/world');

const signIn = async (page) => {
  await expect(page.locator('#signInBtn')).toBeEnabled();
  await page.locator('#signInBtn').click();
  await expect(page.locator('#mainNav')).toBeVisible();
  await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
};
const A = { parents: ['drv-alpha1'], driveId: 'drv-alpha1', mimeType: 'text/plain' };
const ledger = (world, ids) => { world.byId(IDS.ledger).content = 'file_id\n' + ids.join('\n') + '\n'; };

test.describe('CD Hub: table text can never become code', () => {
  test('CD Hub cleans quote marks and refuses javascript: links from the tables @regression', async ({ page }) => {
    await page.goto('cdhub/');
    const r = await page.evaluate(() => ({
      esc: window.esc('x" onmouseover="alert(1)\' <b>'),
      js: window.safeUrl('javascript:alert(1)'),
      data: window.safeUrl('data:text/html,hi'),
      quote: window.safeUrl('https://ok.example.test/"onclick="x'),
      ok: window.safeUrl(' https://www.facebook.com/sample '),
      plain: window.safeUrl('http://directory.example.test/list'),
    }));
    expect(r.esc).toBe('x&quot; onmouseover=&quot;alert(1)&#39; &lt;b&gt;');
    expect(r.js).toBe('');
    expect(r.data).toBe('');
    expect(r.quote).toBe('');
    expect(r.ok).toBe('https://www.facebook.com/sample');
    expect(r.plain).toBe('http://directory.example.test/list');
  });

  test('a booby-trapped dog name in a table adds no extra attributes to the page', async ({ page, guard }) => {
    const f = guard.world.files.find((x) => x.name === 'BLD-subject.csv');
    f.content = f.content.replace('Test Dog One', '"Test x"" onmouseover=""window.__pwned=1"" data-x="""');
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#nav button[data-go]').first()).toBeVisible();
    for (const go of ['dogs', 'round', 'areas', 'litters']) {
      await page.locator(`#nav button[data-go="${go}"]`).click();
      expect(await page.locator('[onmouseover]').count(), go).toBe(0);
    }
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
  });
});

test.describe('Main dashboard: sign-out and the timed refresh', () => {
  test('signing out on the Bin and back in draws the Bin with no errors @regression', async ({ page }) => {
    await page.goto('./#/bin');
    await signIn(page);
    await expect(page.locator('#sweepCard')).toBeVisible();
    await page.locator('#signOutBtn').click();
    await expect(page.locator('#signInBtn')).toBeVisible();
    await signIn(page);
    await expect(page.locator('#sweepCard')).toBeVisible();
    // the guard fails the test on any page error ("Cannot read properties of undefined")
  });

  test('the 5-minute refresh keeps your ticks and waits while you have any @regression', async ({ page, guard }) => {
    const w = guard.world;
    w.file('zz-tick', 'ZZ_DELETE_tick-me.txt', 'invented', A);
    ledger(w, ['zz-tick']);
    await page.clock.install();
    await page.goto('./#/bin');
    await signIn(page);
    const box = page.locator('[data-bin-list="ready"] input[type="checkbox"]').first();
    await box.check();
    const before = w.calls.length;
    await page.clock.runFor(5 * 60 * 1000 + 1000);
    await expect(box).toBeChecked();
    expect(w.calls.length, 'no Drive reads while ticks are waiting').toBe(before);
  });

  test('with nothing ticked, the 5-minute refresh does read Drive again', async ({ page, guard }) => {
    await page.clock.install();
    await page.goto('./');
    await signIn(page);
    const before = guard.world.calls.length;
    await page.clock.runFor(5 * 60 * 1000 + 1000);
    await expect.poll(() => guard.world.calls.length).toBeGreaterThan(before);
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/);
  });

  test('the 5-minute refresh waits while the tab is hidden', async ({ page, guard }) => {
    await page.clock.install();
    await page.goto('./');
    await signIn(page);
    await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
    const before = guard.world.calls.length;
    await page.clock.runFor(5 * 60 * 1000 + 1000);
    expect(guard.world.calls.length).toBe(before);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect.poll(() => guard.world.calls.length).toBeGreaterThan(before);
  });
});

test.describe('Readable text', () => {
  test('body text is left-aligned with no automatic hyphens on the dashboard and CD Hub', async ({ page }) => {
    for (const url of ['./', 'cdhub/']) {
      await page.goto(url);
      const st = await page.evaluate(() => { const c = getComputedStyle(document.body); return { align: c.textAlign, hy: c.hyphens }; });
      expect(st.align, url).not.toBe('justify');
      expect(st.hy, url).not.toBe('auto');
    }
  });
});
