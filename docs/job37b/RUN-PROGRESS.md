# RUN-PROGRESS: JOB 37b Repo Docs B (dashboard part)

*Rewritten after every stage. Counts only, no private values. Session: JOB 37b.2 Repo Docs B.*

| Stage | Branch | PR | Tests | ACCEPT | Parked |
|---|---|---|---|---|---|
| REPO CHECK | none | none | ljoyrose/dashboard PUBLIC, `main` e506ab7 | PASS | 0 |
| 2 dashboard docs | claude/job37b-2-dash | #218 | link check 10/0 broken; privacy guard (placeholder DENY) clean | PASS: guard clean; 8/8 hubs have a line | 1 (register rows) |
| 4 doc comments | claude/job37b-4-comments (stacked on 37b-2) | see slip | mocked+phone 738/0 (same as Stage 2 baseline); gate 70/0 + selftest 8/8; privacy guard self-tests 34/0; teeth one-sign-in and bom caught; diff 68 added comment lines, 0 removed | PASS | 0 |

Website-tools part: done by JOB 37b.1 (website-tools PR 29). Not redone.

Next: none. JOB 37b dashboard part done; PRs wait for Lisa.

Stage 4 files (no open PR touches them; checked against all 50 open PR branches): auth.js 13, toolkit.js 5, money/core.js 32, tools/gate/gate.mjs 5, tools/privacy-guard/privacy_guard.py 10. Skipped: estate/* (JOB 46 area), all tests/* (test jobs), every file an open PR changes.
