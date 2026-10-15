# PROGRESS: Job 6, dashboard tests and GitHub Action

*Updated 15 Oct 2026.*

## Done

- [x] Read README and the three pages. Found the sign-in and Drive hooks to mock.
- [x] Branch `claude/job6-playwright-tests` from `main`.
- [x] **Test suite (138 checks)** in `tests/mocked/`: main dashboard 47, CD Hub 30, Money Hub 41, CSV reading 16, safety 4.
- [x] **Pretend Google sign-in** (`tests/support/gis-stub.js`) with modes: ok, permission refused, error, window closed, window blocked.
- [x] **Pretend Drive** (`tests/support/fake-drive.js`): lists, reads, exports, trashes, empties bin.
- [x] **Invented sample CSVs** in `tests/fixtures/` (BLD-*, MON-*, ledgers, one Dropbox totals file).
- [x] **Local web server** for tests (`tests/support/static-server.js`) serving the repo at `/dashboard/`, same as the live address.
- [x] **GitHub Action** `.github/workflows/tests.yml`: every push, Mondays, manual button. Pinned versions, browser cache, short summary table.
- [x] **Optional live check** of the three real addresses (Mondays and manual only; never blocks).
- [x] `TESTS.md` for Lisa. This file, `HANDOVER.md`, `CONTINUE_PROMPT.md`, `TT_JOB6_SLIP.md`, `SUMMARY.md`.
- [x] Proved the tests catch breakage: broke the Money "← Dashboard" link on purpose, one test failed, put it back.
- [x] Ran the whole suite twice in a row: 274 of 274 passed (137 checks, twice; one more check was added afterwards) (no flaky tests).

## Left to do

- [ ] Confirm the Action is green on the PR (see slip for result).
- [ ] Lisa/AF6 review and merge. Not merged by this job.
- [ ] Optional later: see "Ideas" below.

## Decisions made

| Decision | Why |
|---|---|
| Test against a local copy of the repo, not GitHub Pages | CI does not depend on Pages being up. |
| Serve the repo under `/dashboard/` | Local addresses match the live ones, so links like `money/` behave the same. |
| Mock at the network edge (replace Google's script, answer Drive web calls) | Page code is untouched. Tests exercise the real code paths. |
| Folder ids and file names are read out of the page code at test time | No copy of ids in the tests. If an id changes, the tests follow. If a name is renamed, the test stops with a clear message. |
| Any request to an unplanned outside address fails the test | Guarantees nothing real is contacted. |
| Any unexpected browser console error or warning fails the test | Exact goal from the brief. A test that expects an error must say so (`allowedConsole`). |
| Pin `@playwright/test` to exactly 1.56.1, Node 22.22.0, `ubuntu-24.04`, actions pinned by commit | Same result tomorrow as today. |
| Live check is a separate job, Mondays and manual only, `continue-on-error` | Brief: skippable and non-blocking. |
| Added `.gitignore` lines (did not remove any) | The old rules hide all `*.csv` and `*.json`, which would hide the samples and `package.json`. |
| Desktop-size window only | Keeps v1 small. Phone sizes are an idea below. |
| No change to any production page | Out of scope. None was needed. |

## Ideas (not done)

- Phone-width run of the same tests.
- Tests for PC-Personal rename and bin steps (need more Drive pretend, e.g. renaming).
- Dependabot to nudge the pinned versions.
- Run the tests on pull requests from forks.
- Add the Drive-check page (local USB files) with a pretend file picker.
