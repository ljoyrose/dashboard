# HANDOVER: picking up the dashboard tests

*Written for a newcomer (person or Claude).*

## What this is

Browser tests for a static GitHub Pages dashboard. They prove each page loads, has no console errors, has working links, and can read sample CSVs, with Google sign-in and Drive both faked.

## Read first, in this order

1. `TESTS.md`: plain-English coverage (written for Lisa).
2. `README.md`: what the dashboard does. The tests follow it.
3. `docs/job6/PROGRESS.md`: what is done, decisions.
4. This file.

## Run it

```
npm ci
npx playwright install chromium
npm test            # all 138 mocked checks, about 40 seconds
npm run report      # open the report
npm run test:live   # optional, opens the real live addresses (signed out only)
```

Needs Node 22 (`.nvmrc`). Playwright is pinned to 1.56.1 in `package.json`.

## Map of the code

| Path | What it is |
|---|---|
| `playwright.config.js` | Two projects: `mocked` (default) and `live-smoke`. Starts the local server. |
| `tests/support/static-server.js` | Serves the repo at `http://127.0.0.1:4173/dashboard/`. Only website files; hides `.git`, `tests`, etc. |
| `tests/support/gis-stub.js` | Replaces `accounts.google.com/gsi/client`. Mode set by `window.__GIS_MODE`. |
| `tests/support/fake-drive.js` | In-memory Drive. Handles `/about`, `/drives`, `/files` (list, get, media, export, PATCH trashed), `DELETE /files/trash`. Understands the `q=` words the dashboard uses. Set `failWith` to make it error. `calls` records every request. |
| `tests/support/world.js` | Builds the pretend Drive from `tests/fixtures`. Reads folder ids from the page code. |
| `tests/support/test.js` | The shared `test`. An automatic `guard` installs all mocks and fails a test on console errors, uncaught errors, or unplanned outside requests. |
| `tests/support/summary.js` | Makes the GitHub Actions summary table from `test-results/results.json`. |
| `tests/mocked/*.spec.js` | The tests. One file per page, plus CSV reading and repo safety. |
| `tests/live/live-smoke.spec.js` | Optional real-site check. Skipped unless `LIVE_SMOKE=1`. |
| `tests/fixtures/` | Invented CSVs. `bld/` for CD Hub, `mon/` for Money Hub, `dropbox/` for the Bin line. |
| `.github/workflows/tests.yml` | The Action. |

## How to write a new test

```js
const { test, expect } = require('../support/test');

test('my check', async ({ page, guard }) => {
  await page.goto('money/');                 // relative to /dashboard/
  await page.locator('#signInBtn').click();  // pretend sign-in answers at once
  await expect(page.locator('#hereTitle')).toHaveText('Now');
  // guard.world is the pretend Drive. guard.world.calls lists every Drive request.
});
```

- Change who is signed in: `guard.world.email = 'x@example.test'` before `page.goto`.
- Change what Drive holds: edit `guard.world.files` before `page.goto`.
- Change what Google does: `test.use({ gisMode: 'denied-scope' })` (also `error`, `popup-closed`, `popup-blocked`).
- Make Drive fail: `guard.world.failWith = { status: 403, reason: 'forbidden', includeAbout: true }`. Chrome logs failed calls as console errors, so also `allowedConsole.push(/status of 403/)`.
- Pin "today" for the Money code: `moneyToday` option (default `2026-03-10`). Sample dates are chosen around it.

## Gotchas

- `.gitignore` hides `*.csv` and `*.json`. The lines at the bottom re-allow `tests/fixtures`, `package.json` and `package-lock.json`. Do not remove them.
- The dashboard rewrites the address to `#/map` on load. Match URLs with an optional `(#/map)?`.
- Bin writes need a second permission click (`grantwrite`). The first sweep click only asks for it.
- A Bin "Empty bin" button sits inside a folded list. Open it first with `[data-action="foldjump"]`.
- If a test says `Not handled by the pretend Drive: /something`, the page started using a Drive call the fake does not know. Add it in `fake-drive.js`.
- If `world.js` throws "Could not find X in the page code", a variable was renamed in a page. Update the pattern.
- The Money gate email is in `money/core.js` (public already). The tests read it from there.

## What to check before merging a change to the pages

1. `npm test` is green.
2. If you added a menu item or section, add it to the matching list in the spec.
3. Do not weaken a failing test to make it pass. Fix the page or explain why the test was wrong.
