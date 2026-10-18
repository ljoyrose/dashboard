// Google reads retry by themselves (toolkit.js): up to 4 tries, about 1s, 2s, 4s apart, for
// "too many requests" (429), a rate-limit 403, and Google hiccups (5xx). Writes are never retried.
// When the tries run out, every page says the same plain thing instead of an error code.
const { test, expect } = require('../support/test');

const BUSY = 'Google is busy right now (too many requests). The dashboard tried 4 times. Wait a minute, then try again.';

test.describe('Google retries and the plain too-many-requests message', () => {
  test('home: two 429 answers in a row are retried and the page still reads normally @regression', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 429/);
    guard.world.failWith = { status: 429, reason: 'rateLimitExceeded', message: 'Sample busy', times: 2 };
    await page.goto('./');
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toContainText(/^Read \d/, { timeout: 20_000 });
    await expect(page.locator('#view')).not.toContainText(BUSY);
  });

  test('home: Google says 429 every time, so after 4 tries it shows the plain busy message', async ({ page, guard, allowedConsole }) => {
    test.setTimeout(60_000);
    allowedConsole.push(/status of 429/);
    guard.world.failWith = { status: 429, reason: 'rateLimitExceeded', message: 'Sample busy' };
    await page.goto('./#/drive');
    await page.locator('#signInBtn').click();
    await expect(page.locator('#view')).toContainText(BUSY, { timeout: 30_000 });
    const drives = guard.world.calls.filter((c) => c.path === '/drives');
    expect(drives.length).toBe(4);
  });

  test('home: a plain refusal (403 forbidden) is not retried', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 403/);
    guard.world.failWith = { status: 403, reason: 'forbidden', message: 'Sample refusal' };
    await page.goto('./');
    await page.locator('#signInBtn').click();
    await expect(page.locator('#readStamp')).toHaveText('A read failed', { timeout: 10_000 });
    expect(guard.world.calls.filter((c) => c.path === '/drives').length).toBe(1);
  });

  test('Money: a 403 rate limit every time ends in the plain busy message', async ({ page, guard, allowedConsole }) => {
    test.setTimeout(60_000);
    allowedConsole.push(/status of 403/);
    guard.world.failWith = { status: 403, reason: 'userRateLimitExceeded', message: 'Sample rate limit', includeAbout: true };
    await page.goto('money/');
    await expect(page.locator('#signInBtn')).toBeEnabled();
    await page.locator('#signInBtn').click();
    await expect(page.locator('#view')).toContainText(BUSY, { timeout: 30_000 });
    expect(guard.world.calls.filter((c) => c.path === '/about').length).toBe(4);
  });

  test('CD Hub: two Google hiccups (503) are retried and the tables still load', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 503/);
    guard.world.failWith = { status: 503, reason: 'backendError', message: 'Sample hiccup', times: 2 };
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#livepill')).not.toHaveText(/read failed|signed out|sign in/i, { timeout: 20_000 });
    await expect(page.locator('#main')).not.toContainText('could not be read');
  });

  test('CD Hub: 429 every time shows the plain busy message', async ({ page, guard, allowedConsole }) => {
    test.setTimeout(60_000);
    allowedConsole.push(/status of 429/);
    guard.world.failWith = { status: 429, reason: 'rateLimitExceeded', message: 'Sample busy' };
    await page.goto('cdhub/');
    await page.locator('#signinbtn').click();
    await expect(page.locator('#main')).toContainText(BUSY, { timeout: 30_000 });
  });

  test('a write (PATCH) that gets a 503 is never retried', async ({ page, guard, allowedConsole }) => {
    allowedConsole.push(/status of 503/);
    guard.world.failWith = { status: 503, reason: 'backendError', message: 'Sample hiccup' };
    await page.goto('./');
    const status = await page.evaluate(() => window.DashKit.googleFetch('https://www.googleapis.com/drive/v3/files/x1?supportsAllDrives=true', {
      method: 'PATCH', headers: { Authorization: 'Bearer FAKE-TEST-TOKEN', 'Content-Type': 'application/json' }, body: '{"name":"n"}' }).then((r) => r.status));
    expect(status).toBe(503);
    expect(guard.world.calls.filter((c) => c.method === 'PATCH').length).toBe(1);
  });
});
