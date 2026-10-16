# PROGRESS: Job 6c, end-of-session improvement review

*16 Oct 2026. Branch `claude/job6c-improve`. Current facts for everything: `docs/STATUS.md`.*

## Done
- [x] Process gate: read RR_MASTER v0.7, STANDARD S6 (S6.2) and Shorthand-Command-System; go word `qssend`; GO is not the go word.
- [x] Checked live state: protection on, live files equal repo (sha256, 4 files), live-after-deploy ran twice and passed, Dependabot PRs #13 #14 green.
- [x] `IMPROVE.md`: 14 ranked items, learning-loop table, stubs decided, "could not check".
- [x] DO NOW built: live-equals-merged test, protection watch, alarm fire drill, 10 `ci-guards` checks, plain "What to do" alarm line, docs-total warning, `docs/STATUS.md`, stale-status banners.
- [x] Local proof: full suite green (see PR), ci-guards proved able to fail (renamed an `@regression` test, 2 failed, restored), live checks pass against the real site.
- [x] `TT_JOB6-LEARNING-LOOP_02.md` written (answer to AF6's `_01`).

## Left
- [ ] Action green on the PR; Lisa/AF6 review and merge.
- [ ] BOT-1..BOT-5 in `TT_JOB6C_SLIP_01.md`.
- [ ] Lisa: Q1 (gate Pages on tests) and Q2 (Dependabot).

## Decisions
| Decision | Why |
|---|---|
| No zip this job | Everything is on GitHub; the zip is a second copy to build and upload. |
| Watch + drill + teeth all use GitHub Issues with their own label | One deduped issue per kind; no Slack, no secrets. |
| Nothing moved or renamed in Drive | Brief limits writes to this job's files; relocation is BOT-3. |
| ci-guards run in the required job | A rotting safety net should block, not warn. Only the docs-total check is a warning. |
