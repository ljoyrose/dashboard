# RUNBOOK: run, test, undo (dashboard)

*JOB 37b.2 Repo Docs B, 31 Oct 2026. Describes `main` at `e506ab7`. Plain steps; the detail lives in
[TESTS.md](../../TESTS.md), [README.md](../../README.md) (JOB 4 owns it), [tools/gate/README.md](../../tools/gate/README.md)
and [docs/STATUS.md](../STATUS.md). Script register keys: see "Register keys" at the end.*

## Run the pages locally

No build. Serve the repo root over http and open it: `node tests/support/static-server.js` (the server the tests use) or
any static server. Sign-in only works from the authorised GitHub Pages address, so locally you see the signed-out page.

## Tests

| What | Command | Notes |
|---|---|---|
| Install once | `npm ci` then `npx playwright install chromium` | Node 20+ (`package.json` engines) |
| Mocked suite (the gate for any change) | `CI=true npx playwright test --project=mocked --project=phone` | Pretend Google and Drive, invented fixtures in `tests/fixtures/`. No sign-in, no internet. |
| One file | `npx playwright test tests/mocked/<name>.spec.js` | |
| Live smoke (optional) | `npm run test:live` | Opens the live site signed out. Never blocks. |
| Web Estate unit tests | `node --test tests/estate/` | No browser. |
| Real column names (Lisa's computer only) | `npm run check:headers -- <folder of downloaded files>` | Prints column names only. Not run in CI on purpose. |

What each check covers: [TESTS.md](../../TESTS.md). Undo: tests change nothing; delete `test-results/` and `playwright-report/`.

## Gate checker (`tools/gate/gate.mjs`)

- `npm run gate -- --list`, `--selftest`, or `--card card.json --to 3->4 [--dry-run]`.
- Self-tests: `npm run test:gate`. CI: workflow `gate.yml` on push and pull request.
- Reads only the card you give it and `gates.unified.json`; writes nothing. Undo: nothing to undo.

## Teeth check (`tests/teeth/`)

- `npm run teeth` (all breaks) or `node tests/teeth/run-teeth.js <break-id>` (one).
- Copies the repo to a temp folder, breaks one thing (list in `tests/teeth/breaks.js`), and expects the matching tests to go red.
  The real files are never touched. CI: `teeth.yml`, Tuesdays; cannot block a merge.
- **Before editing a file a break points at:** each break's `find` text must appear exactly once in its file, or the break
  reports OUT OF DATE.

## Privacy guard (`tools/privacy-guard/`) — this repo is PUBLIC

- Session check before every push:
  `PRIVACY_DENYLIST_FILE=<file outside the repo> python3 tools/privacy-guard/privacy_guard.py --range origin/main..HEAD`.
  In a session without the private denylist, point it at a file holding one invented term: the EMAIL, DRIVE, PHONE, PATH and
  AUTHOR rules run, and the DENY rule is a placeholder. The CI job **Privacy guard (public repo)** (`privacy-guard.yml`) runs the
  real denylist on every push and pull request and is a required check on `main`.
- Self-tests: `python3 tools/privacy-guard/test_privacy_guard.py` (fake data only).
- On a FAIL: do not push; fix by a normal edit. If already pushed: stop, never force-push, tell Lisa (she alone decides
  history rewrites). A failing PR is replaced by a clean PR. Full rules: README "Privacy guard".

## Pages deploy

- `pages.yml` ("Publish site (after tests)") runs on every push to `main`: it runs the tests first, then copies only the
  published files (list in the workflow) to `_site/` and deploys. Docs, tests and tools are never published.
- `live-after-deploy.yml` then checks the live files match `main` byte for byte. It never blocks.
- Undo a bad publish: Lisa merges a revert PR; the next push to `main` republishes. Rollback switch for the whole
  mechanism: TESTS.md "Publishing waits for the tests".
- Sessions never run, dispatch or re-run any workflow.

## Other workflows

| Workflow | Runs | Does |
|---|---|---|
| `tests.yml` "Dashboard tests" | Push; Mondays | Mocked + phone suite; job "Browser tests (pretend Google and Drive)" is a required check. Opens/closes one Issue on red/green `main`. |
| `fix-needs-test.yml` | Pull request | Flags a bug-fix PR with no test. |
| `protection-watch.yml` | Mondays | Re-checks branch protection; opens one Issue if it is off. |
| `issue-fire-drill.yml` | Hand-started only | Proves the alarm Issue opens and closes. |

Never rename the two required job names (see TESTS.md "Make the tick compulsory").

## Undo, in general

- Every change is a PR; Lisa merges. Undo = a revert PR, merged by Lisa. Never force-push.
- On the live site, the only writes are trash and rename (Home Bin and PC-Personal) and request files / Sheet rows (Studio,
  Factory, Estate, Food hub, Marketplace). Trash is undone from the Drive bin; a request file is undone by Undo before the
  engine's next run.

## Register keys

RR_SCRIPTS-REGISTER (Drive, 00 AI Commons) is the script list of record.

| Key | What |
|---|---|
| GH-DB-01 … GH-DB-07 | Home sections: Map, Read first, Drive, PC-Personal, Drive check, Bin, Changes |
| GH-DB-08 / 09 / 10 | Money Hub / Factory / CD Hub |
| GH-DB-W01 | `tests.yml` |
| GH-DB-W02 | `live-after-deploy.yml` |
| GH-DB-W03 | `protection-watch.yml` |
| GH-DB-W04 | `teeth.yml` (and `tests/teeth/`) |
| GH-DB-W05 | `issue-fire-drill.yml` |
| GH-DB-W06 | `fix-needs-test.yml` |
| GH-DB-W07 | `gate.yml` (and `tools/gate/gate.mjs`) |
| GH-DB-W08 | `pages.yml` |
| no row yet | Studio, Food hub, Marketplace, Web Estate, `privacy-guard.yml`, `tools/privacy-guard/privacy_guard.py`, `tests/contract/check-real-headers.js`. Suggested rows are in the JOB 37b.2 slip for SYS-ST. |
