# TT_JOB6B_SLIP: Job 6b done, dashboard tests now protect main

> **UPDATE 16 Oct 2026:** branch protection on `main` is now ON (verified against GitHub), and the `RR_` question is decided (keep renaming). Lines below that say "not switched on" or "still open" are history. Current facts: `docs/STATUS.md`.

**To:** Lisa Carson / AF6 coordinator  **Date:** 15 Oct 2026
**Status:** Delivered as a pull request. Not merged. **One click-job for Lisa open (branch protection).**

## Links
- **PR:** https://github.com/ljoyrose/dashboard/pull/12 (branch `claude/job6b-test-protection` into `main`)
- **Action run on the PR branch:** https://github.com/ljoyrose/dashboard/actions/runs/38823562125 (**green**; job "Browser tests (pretend Google and Drive)" passed)
- **Zip:** `docs/job6b/JOB6B_DASHBOARD-TESTS_v1.zip` on the branch

## Lisa: do this (about 2 minutes) after the Action is green
**Branch protection is NOT on.** The builder was refused when it tried to change repository settings (HTTP 403). Click-path:
1. GitHub > **dashboard** repo > **Settings** > **Branches** > **Add branch protection rule**.
2. Branch name pattern: `main`.
3. Tick **Require a pull request before merging** (approvals **0**).
4. Tick **Require status checks to pass before merging**, pick **Browser tests (pretend Google and Drive)**.
5. Tick **Do not allow bypassing the above settings**.
6. Leave **Allow force pushes** and **Allow deletions** unticked. **Create**.

Result: nothing goes straight into `main`; Merge only lights up when the tests are green. (Same settings as a file: `docs/job6b/branch-protection.json`.)

## What was delivered (risk order)
1. Branch protection: prepared (above).
2. Live check after every Pages deploy (`live-after-deploy.yml`). Signed-out, never blocks. Starts once merged.
3. Red scheduled run opens/updates ONE Issue naming the failing page; green closes it. Own single issues for the live check and the teeth check. No Slack, webhooks or new secrets.
4. Header contract: expected column names (names only) vs pages and samples, 12 checks, every push and Monday. Local script `tests/contract/check-real-headers.js` for real files (no sign-in; names only).
5. Phone subset (390 × 844): 3 pages, menu, no console errors, no sideways scroll. In the required job.
6. Learning loop: PR checklist, "fix without a test" warning (never blocks), `@regression` count in the summary, "Caught after merge" list + recipe in TESTS.md.
7. PC-Personal rename/bin and Drive-check covered (8 checks), all writes in-memory only.
8. Dark mode (3). 9. axe accessibility + smallest-text floor as a ratchet (15). 10. Pretend-Drive drift counter (0 today). 11. Dependabot weekly, grouped, no auto-merge. 12. Weekly teeth check (8 breaks).
+ Bin safety tests (2): the rules protecting `RR_` archives had no test.

**Suite:** 183 pass (was 138).

## Decided by Lisa (15 Oct 2026)
PC-Personal keeps renaming (then binning) personal `RR_` files that match a shared-drive copy. Shared is the right home; one copy is enough. Not a bug. A test pins it.

## Production code
No page changed. `.gitignore` gained one allow-line.

## Open risks
1. Branch protection not on until clicked.
2. `live-after-deploy.yml` and the weekly teeth check can only run from `main`, so they are unproven until merged. The teeth script itself was run locally: all 8 breaks caught.
3. Header lists come from the invented samples + page code. A rename that exists only in real Drive is caught only by the local script. Run it once on downloaded real files to confirm the lists match.
4. The tests run on `push`. A pull request from a fork would not get the required check (not an issue for a solo repo).
5. Accessibility and text-size problems exist today (contrast, 10.5 px text on CD Hub, heading order). Recorded; the check fails only if worse.
6. Could not use the GitHub app PR tool or `gh pr create` (GraphQL blocked); PR opened via the REST API. No effect on content.
