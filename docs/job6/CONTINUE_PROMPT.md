# CONTINUE PROMPT

Paste everything below the line into a new Claude Code session.

---

You are continuing **Job 6: Playwright tests and a GitHub Action** for `https://github.com/ljoyrose/dashboard` (public). Owner: Lisa Carson (UK, non-technical, keep docs in plain English). Branch: `claude/job6-playwright-tests`. Base: `main`.

Rules: deliver as a pull request only. Never push or merge to `main`. Delete nothing. Commit no secrets, real Drive data, tokens, private ids, personal figures, or customer/animal names. Do not change production pages unless a tiny testability fix is unavoidable (call it out in the PR).

First read, in order: `docs/job6/PROGRESS.md`, `docs/job6/HANDOVER.md`, `TESTS.md`, `docs/job6/TT_JOB6_SLIP.md`.

State at last save: 138 mocked tests (main 47, CD Hub 30, Money 41, CSV 16, safety 4) all passing locally, Action file at `.github/workflows/tests.yml`. Google sign-in and Drive are faked in `tests/support/`. Check the PR for the Action result.

Do now: run `npm ci && npx playwright install chromium && npm test`. Then finish whatever is still unticked in PROGRESS.md under "Left to do". If the Action on the PR head is red, read the failure from the run summary, fix the cause (never loosen a test just to pass), push to the same branch, and re-check. Keep `PROGRESS.md` and the slip up to date. When the Action is green and the slip has the PR link, rebuild `docs/job6/JOB6_DASHBOARD-TESTS_v1.zip` (TESTS.md, PROGRESS.md, HANDOVER.md, CONTINUE_PROMPT.md, TT_JOB6_SLIP.md, SUMMARY.md, no CSVs) and report: PR URL, zip location, whether the Action is green.
