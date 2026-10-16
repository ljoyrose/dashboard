# CONTINUE PROMPT (Job 6c)

Paste everything below the line into a new Claude Code session.

---

You are continuing **Job 6c** for `https://github.com/ljoyrose/dashboard` (Lisa Carson, UK, non-technical, plain English). Branch `claude/job6c-improve`. Rules: pull request only; never push or merge to `main` (protection is ON); change tests, docs and workflows only unless Lisa says otherwise; no secrets, no real Drive data, no Overskill prompts. Go word for any paid Overskill prompt is `qssend` (STANDARD S6, S6.2); `GO` is not the go word. This repo has no paid prompts.

First read, in order: `docs/STATUS.md`, `docs/job6c/PROGRESS.md`, `docs/job6c/TT_JOB6C_SLIP_01.md`, `docs/job6c/IMPROVE.md`. Then run `npm ci && npx playwright install chromium && npm test` (expect 193 pass, 0 skipped).

Environment: call `add_repo` with push access before `gh`; GraphQL is blocked (use `gh api` REST, e.g. `gh api -X POST repos/ljoyrose/dashboard/pulls`); Settings writes return 403; read back settings with `gh api repos/ljoyrose/dashboard/branches/main`.

Do now: check the PR's Action; fix anything red (never loosen a test). After merge, check whether BOT-1 (fire drill, teeth, protection watch) is done by reading Actions runs, and update `docs/STATUS.md`. If Lisa answered Q1 `gate pages on tests`, start job "6d": Pages source to GitHub Actions with a deploy workflow that `needs` the "Browser tests (pretend Google and Drive)" job (needs Lisa's Settings click; give her the click-path and the read-back command). If Q2 `merge 13 14`, that is AF6's/Lisa's action, not yours.
