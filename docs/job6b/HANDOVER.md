# HANDOVER (Job 6b): the tests as protection

*For a newcomer (person or Claude). Read `docs/job6/HANDOVER.md` first for the base suite (support files, how to write a test); this file only adds what Job 6b added.*

## Read in this order
1. `TESTS.md` (plain English, written for Lisa).
2. `docs/job6b/PROGRESS.md` (what is done, decisions, open questions).
3. `docs/job6/HANDOVER.md` (base suite).
4. This file.

## Run it
```
npm ci
npx playwright install chromium
npm test                  # mocked (desktop) + phone; about 80 s. live-smoke is skipped unless LIVE_SMOKE=1
npm run test:phone        # just the phone-sized set
npm run teeth             # break things on purpose, expect red (about 4 min)
npm run check:headers -- <folder>   # real downloaded files vs expected column names
CI=true npx playwright test --project=mocked --project=phone && node tests/support/summary.js test-results/results.json   # see the Action summary locally
```

## What Job 6b added
| Path | What |
|---|---|
| `.github/workflows/tests.yml` | Now runs `mocked` + `phone`. Required check = job **"Browser tests (pretend Google and Drive)"** (do not rename). Scheduled red opens/updates issue `tests-red`; green on `main` closes it. Issue steps are `continue-on-error` so bookkeeping can never change the result. |
| `.github/workflows/live-after-deploy.yml` | Live signed-out check after `pages-build-deployment` succeeds on `main`. Own issue `live-site-red`. Never required. |
| `.github/workflows/teeth.yml` | Tuesdays. Runs `tests/teeth/run-teeth.js`. Own issue `teeth-red`. |
| `.github/workflows/fix-needs-test.yml` | PR warning (never blocks) if a "fix" PR changes nothing under `tests/`. |
| `.github/pull_request_template.md`, `.github/dependabot.yml` | Checklist; weekly grouped npm + actions updates, no auto-merge. |
| `tests/support/results.js` | Reads `results.json`; group names live here (add a row when adding a spec file). |
| `tests/support/summary.js` | Table + `@regression` count + pretend-Drive drift count. |
| `tests/support/report-issue.js` | Open/update/close the single issue per label via `gh`. `--dry-run` prints instead. |
| `tests/support/fake-drive.js` | Added: PATCH rename (`name`), `unhandled` list. `test.js` writes it to `test-results/unhandled-drive.jsonl`. |
| `tests/contract/` | `expected-headers.json` (names only), `headers.js` (shared), `make-expected.js` (rebuild from samples; review the diff), `check-real-headers.js` (local). |
| `tests/mocked/header-contract.spec.js` | 12 checks. |
| `tests/mocked/personal-and-drive-check.spec.js` | PC-Personal rename/bin and Drive-check, in memory. Includes a test that pins Lisa's decision that personal `RR_` matches ARE renamed and binned (do not "fix" this). |
| `tests/mocked/bin-safety.spec.js` | RR_-inside-ZZ_-folder and ZZ_-inside-RR_-folder rules. |
| `tests/mocked/look-and-access.spec.js` | Dark mode, axe ratchet (`KNOWN_AXE`), font floor (`MIN_FONT_PX`). |
| `tests/phone/phone.spec.js`, project `phone` | 390 × 844, 3 checks. |
| `tests/teeth/run-teeth.js` | 8 breaks. Each `find` text must occur exactly once or the run says "OUT OF DATE" (page text changed: update the list). |

## Gotchas
- **Branch protection is a GitHub setting, not code.** Not set by this PR. See `TESTS.md`, `docs/job6b/branch-protection.json`.
- `workflow_run` and `schedule` workflows run only from `main`, so `live-after-deploy.yml` and `teeth.yml` can't be proven on the PR branch.
- `.gitignore` hides `*.json`/`*.csv`; `tests/contract/*.json` is re-allowed.
- The fake Drive treats every non-`mine:false` file as owned by the signed-in person; set `world.byId(id).mine = false` for shared-drive files in personal-drive tests.
- axe is run with `preload: false` (otherwise it logs a console warning that the guard fails on).
- Playwright's `results.json` only exists when `CI=true` (see config reporters).
- Header lists only catch a rename in the page, samples or list. A rename that happens only in real Drive is caught by the local script, not CI.
