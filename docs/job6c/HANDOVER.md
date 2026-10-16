# HANDOVER (Job 6c)

Read first: `docs/STATUS.md` (current facts), `TESTS.md` (for Lisa), `docs/job6c/IMPROVE.md`, then `docs/job6b/HANDOVER.md` and `docs/job6/HANDOVER.md` for the base suite.

## What 6c added
| Path | What |
|---|---|
| `tests/mocked/ci-guards.spec.js` | 10 checks that the safety net checks itself (learning loop, parked tests, teeth list, protection logic, alarm wording, no stored secrets) |
| `tests/support/check-protection.js` + `.github/workflows/protection-watch.yml` | Monday check that `main` is still protected and still requires "Browser tests (pretend Google and Drive)" |
| `.github/workflows/issue-fire-drill.yml` | Manual proof that the alarm opens, reuses and closes one Issue |
| `tests/live/live-smoke.spec.js` | New: live files must equal merged files (only with `LIVE_MATCH_REPO=1`, set by the workflows on `main`) |
| `tests/teeth/breaks.js` | The break list, split from `run-teeth.js` so tests can check it |
| `docs/STATUS.md` | One place for current facts and open `BOT:` lines |

## Rules for the next person
- **Read the system before stating a fact about it** (settings, CI, what is live). Do not copy "still off / still open" from an older slip. Update `docs/STATUS.md`, add a dated banner to old slips, do not rewrite them.
- **Every new deletion-safety rule gets a teeth entry** in `tests/teeth/breaks.js` (the break must make a named spec fail). `ci-guards` fails if an entry stops matching.
- **A parked test (`test.fixme`) needs a comment above it** with `DECISION NEEDED`, `OWNER:` and `BY YYYY-MM-DD`.
- **A fix gets an `@regression` test and a row in "Caught after merge"** (TESTS.md). `ci-guards` checks both directions.
- **TESTS.md total** ("That is N checks that must pass") must match the run; the summary warns if not.
- Open handoffs are lines starting `BOT:`; finish by changing to `BOT-DONE:` with a date. `grep -rn "^BOT:" docs/`.
- Drive: read the parent folder's title before any write; never "Claude artefacts".
- Environment: call `add_repo` (push) before `gh`; no GraphQL (`gh pr create` fails, use `gh api`); Settings writes are refused; `.gitignore` hides `*.json`/`*.csv`.

## Gotchas
- `issue-fire-drill`, `protection-watch`, `live-after-deploy` and `teeth` run only from `main`: unproven until merged (BOT-1).
- `GITHUB_TOKEN` may not see protection details; the watch then checks only "is on" and says so.
