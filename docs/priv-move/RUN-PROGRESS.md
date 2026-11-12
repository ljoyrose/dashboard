# JOB PRIV-MOVE.1: Dashboard private move prep - run progress

Rewritten after each stage (not appended). Code and counts only: the scan report, decision pack and link list are on
Drive (00 AI Commons > CHANGES), never here. Nothing has been switched: no visibility change, no history rewrite.

| # | Stage | State | Where |
|---|---|---|---|
| 1 | Runtime config loader (dry run) | Built, tests green locally, PR open for Lisa | branch `claude/sweet-johnson-13bvh1` |
| 2 | CI minutes trim | Measured only. Not built: handed to PRIV-MOVE 2 | numbers and design in HANDOVER.md |
| 3 | Privacy guard fixture rule | Built, self-test 38 of 38, PR 495 open for Lisa | branch `claude/priv-move-guard-fixtures` |
| 4 | Host prototypes (A1 Dockerfile + workflow, A2 notes) | Not started: handed to PRIV-MOVE 2 | HANDOVER.md |
| 5 | Link inventory | Done (repo: 13 mentions in 8 files, none in shipped page code; Drive: first 100 files listed) | Drive: `AA_DASH-PRIVATE-MOVE-LINKS_2026-11-12.csv` |
| 6 | Fresh scan, counts and types only | Done | Drive: `AA_PRIV-SCAN_2026-11-12_01.md`, `_02.md` |
| 7 | Decision pack | Done | Drive: `AA_DASH-PRIVATE-MOVE-DECISION-PACK_2026-11-12.md` |

## Stage 1 detail
- `config.js`: new `privateConfig` block (enabled, dryRun true, file name) and the loader at the bottom of the file.
- `auth.js`: one event (`dash-auth-change`) so this tab hears its own sign-in change.
- Tests: `tests/mocked/private-config-rails.spec.js` (7), `private-config.spec.js` (14), `private-config-same-as-today.spec.js` (11).
- Notes: `docs/private-config/README.md`.
- Found by the full suite and fixed: the CD Hub "one key in this browser" test. The loader now keeps nothing in the
  browser in dry run or when there is no usable file.

## How the suite was run here
The container's browser is older than the one `package.json` pins, so the suite ran through a wrapper config that points
Playwright at the installed Chromium (same idea as `tools/ci-local/run-all.sh`). The repo's config is unchanged.
