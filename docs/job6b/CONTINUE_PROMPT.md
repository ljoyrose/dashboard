# CONTINUE PROMPT (Job 6b)

Paste everything below the line into a new Claude Code session.

---

You are continuing **Job 6b: turn the dashboard tests into real protection for main** for `https://github.com/ljoyrose/dashboard` (public). Owner: Lisa Carson (UK, non-technical, plain English). Branch: `claude/job6b-test-protection`. Base: `main`.

Rules: pull request only; never push or merge to `main`. Delete nothing. No secrets, no real Google tokens, no real Drive contents in the repo or CI. Do not change production pages unless unavoidable for testability (call it out).

First read, in order: `docs/job6b/PROGRESS.md`, `docs/job6b/HANDOVER.md`, `TESTS.md`, `docs/job6b/TT_JOB6B_SLIP.md`.

State at last save: 183 checks pass. PC-Personal deliberately renames and bins personal `RR_` files that match a shared-drive copy (Lisa's decision; pinned by a test; never change the page to skip `RR_`). Branch protection is **prepared but not switched on** (the builder's GitHub connection was refused for settings changes): Lisa needs to follow "Make the tick compulsory" in `TESTS.md`, or an admin token can run `gh api -X PUT repos/ljoyrose/dashboard/branches/main/protection --input docs/job6b/branch-protection.json`.

Do now: `npm ci && npx playwright install chromium && npm test`. Check the PR's Action. If red, read the run summary, fix the cause (never loosen a test to pass), push to the same branch. Then check, in order: (1) has Lisa switched on branch protection (`gh api repos/ljoyrose/dashboard/branches/main/protection`)? (2) after merge, confirm `live-after-deploy.yml` ran after the next deploy and that the first Tuesday teeth run is green. Keep `PROGRESS.md`, the slip and `TESTS.md` in step. Rebuild `docs/job6b/JOB6B_DASHBOARD-TESTS_v1.zip` when done.

Job 6c ideas are listed at the end of `PROGRESS.md`.
