// OPTIONAL. Opens the three real web addresses, signed out, and checks they are up.
// Never signs in. Skipped unless LIVE_SMOKE=1 (see TESTS.md). In CI this runs as a separate,
// non-blocking job, so a GitHub Pages hiccup cannot turn the main result red.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { test, expect } = require('@playwright/test');

test.skip(!process.env.LIVE_SMOKE, 'Live check is off. Run with LIVE_SMOKE=1 to turn it on.');

const PAGES = [
  ['Main dashboard', '', /Lisa Dashboard|Map/, '#signInBtn'],
  ['CD Hub', 'cdhub/', /CD Hub/, '#main'],
  ['Money Hub', 'money/', /Money Hub/, '#signInBtn'],
];

for (const [name, url, title, selector] of PAGES) {
  test(`${name} is up and shows its sign-in screen`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const res = await page.goto(url);
    expect(res.status()).toBe(200);
    await expect(page).toHaveTitle(title);
    await expect(page.locator(selector)).toBeVisible();
    expect(errors).toEqual([]);
  });
}

// Is what is LIVE exactly what was merged? Compares the live files with the repo files, byte for byte.
// Only the workflows on `main` turn this on (LIVE_MATCH_REPO=1); on a feature branch the live site is rightly different.
// Waits up to 90 s for GitHub Pages to finish publishing (LIVE_MATCH_WAIT_MS to change).
const FILES = [['index.html', ''], ['cdhub/index.html', 'cdhub/'], ['money/index.html', 'money/'], ['money/core.js', 'money/core.js'], ['factory/index.html', 'factory/'], ['auth.js', 'auth.js'], ['config.js', 'config.js'], ['toolkit.js', 'toolkit.js'], ['tokens.css', 'tokens.css'], ['manifest.webmanifest', 'manifest.webmanifest'], ['sw.js', 'sw.js'], ['icons/icon.svg', 'icons/icon.svg']];
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
test.describe('Live files match the repo', () => {
  test.skip(!process.env.LIVE_MATCH_REPO, 'Only checked by the workflows on main (LIVE_MATCH_REPO=1).');
  for (const [file, url] of FILES) {
    test(`${file} is live exactly as merged`, async ({ request }) => {
      test.setTimeout(Number(process.env.LIVE_MATCH_WAIT_MS || 90000) + 30000);
      const want = sha(fs.readFileSync(path.resolve(__dirname, '..', '..', file)));
      await expect
        .poll(async () => {
          const res = await request.get(url + (url.includes('?') ? '&' : '?') + 'cb=' + Date.now(), { headers: { 'Cache-Control': 'no-cache' } });
          return res.ok() ? sha(await res.body()) : 'HTTP ' + res.status();
        }, { timeout: Number(process.env.LIVE_MATCH_WAIT_MS || 90000), intervals: [5000], message: `${file}: the live file is not the merged file (stale deploy, or a different version is live)` })
        .toBe(want);
    });
  }
});
