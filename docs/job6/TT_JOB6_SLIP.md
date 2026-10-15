# TT_JOB6_SLIP: Job 6 done, dashboard tests + GitHub Action

**To:** Lisa Carson / AF6 coordinator  **Date:** 15 Oct 2026
**Status:** Delivered as a pull request. Not merged.

## Links
- **PR:** https://github.com/ljoyrose/dashboard/pull/11 (branch `claude/job6-playwright-tests` into `main`)
- **First Action run on the PR branch:** https://github.com/ljoyrose/dashboard/actions/runs/38818011211 (**green**)
- **Zip:** `docs/job6/JOB6_DASHBOARD-TESTS_v1.zip` on the branch

## What was delivered
1. **138 browser checks** for all three pages: main dashboard 47, CD Hub 30, Money Hub 41, CSV reading 16, repo safety 4.
2. Each page: loads (HTTP 200), no unexpected console errors, menu and links work (including Money tile to `/money/`, hash sections `#/drive`, `#/bin`, `#/changes/24h`, `#/personal`), sample CSVs parse.
3. **Pretend Google sign-in and pretend Drive.** No credentials. Any call to an unplanned outside address fails the test.
4. **Invented sample CSVs** (BLD-*, MON-*, ledgers, one Dropbox totals file) in `tests/fixtures/`.
5. **GitHub Action** `.github/workflows/tests.yml`: every push, Mondays 06:17 UTC, and a manual button. Node 22.22.0, Playwright 1.56.1, actions pinned by commit, browser cached. The run page shows a one-table summary per page.
6. Optional **live-site check** of the three real addresses (Mondays and manual only; never blocks).
7. `TESTS.md` (plain English), `docs/job6/` PROGRESS, HANDOVER, CONTINUE_PROMPT, SUMMARY.

## How to run / where CI is
- Locally: `npm ci`, `npx playwright install chromium`, `npm test` (about 40 seconds).
- On GitHub: **Actions** tab > **Dashboard tests**. Press **Run workflow** for a run on demand.

## Production code
No page was changed. `.gitignore` gained re-allow lines only (nothing removed), so the sample CSVs and `package.json` are not hidden by the old `*.csv` / `*.json` rules.

## Open risks
1. Drive is pretend. Green does not prove the real Drive folders or permissions are right.
2. If a page starts using a Drive call the pretend Drive does not know, tests fail with "Not handled by the pretend Drive". Add it in `tests/support/fake-drive.js`.
3. Folder ids are read from the page code by pattern. If a variable is renamed, the tests stop with a clear message.
4. The Money gate address (`money/core.js`, already public in the repo) is reused in the tests.
5. Not covered: real Google consent screen, phone-size screens, PC-Personal rename/bin steps, Drive-check page.
6. Pinned versions will age. A tool like Dependabot would help (not set up).
7. I could not upload via the GitHub app's PR tool (403), so the PR was opened through the GitHub REST API. No effect on the content.
