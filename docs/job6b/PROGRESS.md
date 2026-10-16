# PROGRESS: Job 6b, turn the dashboard tests into protection for main

*Updated 15 Oct 2026. Branch `claude/job6b-test-protection`. Base `main` (Job 6 merged).*

## Done (in risk order)

- [x] **1. Branch protection: prepared, NOT switched on.** The builder's connection to GitHub was refused when it tried to change repository settings (HTTP 403 "Write access to this GitHub API path is not permitted through this proxy", for both the branch-protection and the rulesets paths). So: exact click-path for Lisa is in `TESTS.md` ("Make the tick compulsory") and the slip; the same settings as a file are in `docs/job6b/branch-protection.json`. **Lisa still needs to click (about 2 minutes).**
- [x] **2. Live check after every deploy:** `.github/workflows/live-after-deploy.yml` (starts after "pages-build-deployment" succeeds on `main`; signed-out only; `continue-on-error`; never part of the required check). Takes effect once merged (GitHub only runs `workflow_run` files from `main`).
- [x] **3. Failure surface:** `tests/support/report-issue.js` + steps in `tests.yml`. Red scheduled/hand-started run on `main` opens or updates ONE issue (`tests-red`), green closes it. Live site has its own single issue (`live-site-red`), teeth has its own (`teeth-red`). Only the run's built-in token. Rule written in `TESTS.md`.
- [x] **4. Header contract:** `tests/contract/expected-headers.json` (column names only), `tests/mocked/header-contract.spec.js` (12 checks, runs every push and Monday), plus a local/manual `tests/contract/check-real-headers.js` for real files (no auth, prints names only).
- [x] **5. Phone subset:** `phone` project (390 × 844). 3 checks: load, sign in, menu, no sideways scroll, no unexpected console errors. Included in the required job.
- [x] **6. Learning loop:** PR template with "Bug fix? regression test added?"; `fix-needs-test.yml` (warning only); `@regression` tag counted in the Action summary; "Caught after merge" list and recipe in `TESTS.md`.
- [x] **7. PC-Personal + Drive-check:** covered, fully in memory (9 checks). Writes go to the pretend Drive or a pretend plugged-in drive only. PC-Personal renames `RR_` files; **Lisa decided to keep that** (shared drive is the right home, one copy is enough). A test pins it.
- [x] **8. Dark mode** on all three pages (3 checks).
- [x] **9. axe accessibility + smallest-text floor** (15 checks). Ratchet: known problems recorded, fails only if worse.
- [x] **10. Fake-Drive drift counter** (Drive calls the pretend Drive could not answer; shown in the Action summary; currently 0).
- [x] **11. Dependabot** npm + github-actions, weekly, grouped, no auto-merge.
- [x] **12. Teeth job** weekly (Tuesdays): 8 deliberate breaks on a temp copy. First run found 2 real gaps, both now closed (see below).
- [x] Bonus: **Bin safety tests** (2). The rules "a `ZZ_` folder holding an `RR_` item is left alone" and "a `ZZ_` item inside an `RR_` folder is left alone" had no test at all. Found by the teeth check.

## Numbers

183 pass (was 138). Local run about 80 s. Teeth check about 4 min.

## Left to do

- [ ] **Lisa: switch on branch protection** (click-path in `TESTS.md`). Until then, tests are advice, not protection.
- [x] Lisa answered the `RR_` question: keep renaming. Parked test converted to a normal test that asserts it.
- [x] Action green on the PR (run 38823562125). PR: https://github.com/ljoyrose/dashboard/pull/12
- [ ] Merge this PR. Then `live-after-deploy.yml` and the weekly teeth check start running by themselves.
- [ ] Optional: run `node tests/contract/check-real-headers.js <folder>` once on downloaded real files.

## Decisions made

| Decision | Why |
|---|---|
| Branch protection: PR required with 0 approvals, check required, admins included, no force-push, no deletion, "up to date" not required | Lisa is the only person, so she cannot approve her own PR. Admins included so it is real. "Up to date" would force a re-run after every other merge. |
| Phone checks run inside the required job | Otherwise a broken phone layout could still merge. They add about 5 seconds. |
| Header contract reads the committed sample headers, not real Drive | The brief said no stored OAuth tokens. The list is derived from the samples + page code; the local script checks the real files. If the sample files do not match the real headers, the list does not either (the first run of the local script will show it). |
| axe + font floor are a ratchet | The pages already have problems. Failing on them would make the suite red from day one. Failing on "worse" protects against new ones. |
| Three issue labels (tests, live, teeth) rather than one | One issue can't be both "closed because the mocked suite is green" and "open because the live site is down". Each kind still has exactly one, deduped. |
| `@axe-core/playwright` 4.10.2 pinned exactly | Same result tomorrow as today. |
| No page was changed | Everything is testable as is. `.gitignore` gained one allow-line for `tests/contract/*.json`. |
| PC-Personal keeps renaming `RR_` matches (Lisa's decision, 15 Oct 2026) | Shared is the right home; one copy needed. Pinned by a normal test so it can't change by accident. |

## Open questions

1. (Closed) `RR_` in PC-Personal: keep renaming. See Decisions.
2. The sample header lists were built from the invented samples. Run the local script on real files once to confirm they are the real names.

## Job 6c stubs (not done)

- Real-Drive header fetch in CI would need a Google credential stored in GitHub. Only do this if Lisa decides she is comfortable with a read-only service account limited to header reads.
- Pull-request trigger for the tests (today: `push` only; a pull request from a fork would not get the required check).
- Fix the colour-contrast and small-text problems, then lower the numbers in `look-and-access.spec.js`.
