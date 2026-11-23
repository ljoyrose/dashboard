# JOB PRIV-MOVE.1: Dashboard private move prep - run progress

Rewritten after each stage (not appended). Code and counts only: the scan report, decision pack and link list are on
Drive (00 AI Commons > CHANGES), never here. Nothing has been switched: no visibility change, no history rewrite.

| # | Stage | State | Where |
|---|---|---|---|
| 1 | Runtime config loader (dry run) | Built, tests green locally, PR open for Lisa | branch `claude/sweet-johnson-13bvh1` |
| 2 | CI minutes trim | First cut built, PR 730 open for Lisa (about 17% fewer minutes). The private-repo cut waits on Lisa's CI choice | branch `claude/priv-move-ci-trim` |
| 3 | Privacy guard fixture rule | MERGED by Lisa, 20 Nov 2026 (PR 495) | main |
| 4 | Host prototypes (A1 Dockerfile + workflow, A2 notes) | Built, switched off, PR 729 open for Lisa. Container built and checked locally | branch `claude/priv-move-host-prototypes` |
| 5 | Link inventory | Done (repo: 13 mentions in 8 files, none in shipped page code; Drive: first 100 files listed) | Drive: `AA_DASH-PRIVATE-MOVE-LINKS_2026-11-12.csv` |
| 6 | Fresh scan, counts and types only | Done | Drive: `AA_PRIV-SCAN_2026-11-12_01.md`, `_02.md` |
| 7 | Decision pack | Done | Drive: `AA_DASH-PRIVATE-MOVE-DECISION-PACK_2026-11-12.md` |

## Stage 1 detail
- `config.js`: new `privateConfig` block (enabled, dryRun true, file name) and the loader at the bottom of the file.
- `auth.js`: one event (`dash-auth-change`) so this tab hears its own sign-in change.
- Tests: `tests/mocked/private-config-rails.spec.js` (7), `private-config.spec.js` (14), `private-config-same-as-today.spec.js` (11).
- Notes: `docs/private-config/README.md`.
- Found by the full suite and fixed:
  1. CD Hub "one key in this browser" test: the loader now keeps nothing in the browser in dry run or with no usable file.
  2. Page-weight budgets (14 tests): `config.js` grew by 16,618 bytes, so `tests/budget-growth/private-config-loader.json`
     adds that to the 7 pages that load it (the house way to record growth).
  3. Money Hub "someone else's account reads nothing" test: its filter now leaves out the one look for the private
     settings file (not a figures read). This is the only existing test edited.
- Local full run (mocked + phone, 4 workers): 2,093 tests, 2,059 passed, 15 skipped, 19 failed. 15 of the 19 were items 2
  and 3 above (fixed, then re-run green). The other 4 are load-sensitive: 2 fail on untouched main under the same load
  (`fold.spec.js` home, `every-click.spec.js` bin), 2 passed on re-run (`cdhub-dog-photos`, `hub-main-others`).

## 20 Nov 2026 update
- Guard fixture rule (PR 495) was merged by Lisa on 20 Nov.
- main was merged into this branch (813 commits newer). Three new staff Board tests on main failed with the loader: the
  staff pages now load `config.js`, those tests save their own invented sign-in, and the pretend Drive answered the
  loader's look with 401. Fixed in the shared test setup (`tests/support/test.js`): a settings look-up made with a
  pretend token the pretend Drive does not know is answered "no such file", as real Drive would. No page code changed.
- The "same as today" test now covers 13 pages (it finds pages by itself; the 3 staff pages were added on main).

## How the suite was run here
The container's browser is older than the one `package.json` pins, so the suite ran through a wrapper config that points
Playwright at the installed Chromium (same idea as `tools/ci-local/run-all.sh`). The repo's config is unchanged.
