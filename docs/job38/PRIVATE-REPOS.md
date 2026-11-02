# Running CI checks in a session (for repos with no Actions minutes left)

JOB 38. Text only: nothing has been added to any private repo. Each repo's own job adopts this, after Lisa says yes.

## Why

Public repos get GitHub Actions free. Private repos use a monthly allowance; when it runs out, CI stops running and
cannot be a gate. The same checks can run inside a Claude Code session instead, at no cost.

## The pattern (copy of `tools/ci-local/run-all.sh` in this repo)

1. One script, `tools/ci-local/run-all.sh`, that runs exactly the commands the repo's workflows run, in the same order.
2. It tests a clean copy of `HEAD` in a temp folder outside the repo, so uncommitted files cannot hide a failure.
3. It prints one table: PASS / FAIL / SKIP per check, the commit SHA and the UK time. Exit 0 only when all pass.
4. Secrets never enter the repo. A check that needs one (for example a privacy denylist) reads a file outside the repo
   named by an environment variable; if it is missing, a placeholder is used and the table says so.
5. If Playwright's own browser is missing in the session, a wrapper config in the temp folder points it at the
   pre-installed Chromium (`/opt/pw-browsers/chromium`). The repo's config is not changed.
6. `--quick` skips the slow browser suite for a fast first look.

## How a session reports it

Paste into the PR: the exact command, the commit SHA tested, the pass count and the UK time. Example shape:

```
bash tools/ci-local/run-all.sh
run-all  commit <40-char SHA>  30 Oct 2026 01:40 UK
PASS  Browser tests (mocked + phone)  ...  700 passed
ALL GREEN
```

## Adopting it in a private repo (per repo, by that repo's job)

1. Copy `run-all.sh`; replace the check list with the commands from that repo's `.github/workflows/*.yml`.
2. Keep any workflow files as they are (they still run if minutes return).
3. State in each PR that CI did not run and paste the run-all table instead.
4. Lisa decides whether a run-all table is enough to merge in that repo.

## What it does not do

- It does not replace a required check in branch protection: GitHub still waits for the named check.
- It does not run scheduled jobs (weekly teeth, protection watch, live checks).
- It cannot see repo secrets; the privacy DENY rule is only real where the denylist file is supplied.
