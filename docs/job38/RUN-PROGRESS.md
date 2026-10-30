# JOB 38 · CI and Lint Hardening · run progress

Rewritten after every stage. Counts only, no private values.

| Stage | Branch | PR | Tests | ACCEPT | Parked |
|---|---|---|---|---|---|
| 0 Read and report | none | none | read only | PASS (slip 01) | 2 |
| 1 Pin and permissions | claude/job38-1-pin | #171 | 700 of 700 local | pending CI | 0 |
| 2 Timeouts, concurrency, path filters | claude/job38-2-limits (stacked on 1) | #172 | see PR | pending CI | 1 |
| 4 Local run-all | claude/job38-4-local (stacked on 3) | see slip | run-all, see PR | see PR | 1 |
| 3 Zero-dependency lint | claude/job38-3-lint (stacked on 2) | #180 | selftest 19 of 19; 69 known, 0 new | CI red then green | 0 |

Stage 1 findings: 9 workflows, 8 distinct action SHAs, all full-length and genuine; 1 top-level permission widened beyond contents read (fix-needs-test.yml), now moved to its job.

Stage 2: concurrency added to 5 workflows (now 9 of 9); 1 timeout raised (pages gate 15 to 20); 1 docs-only switch in tests.yml (8 of 8 local scenarios correct).

Stage 3: tools/lint/lint.mjs, 10 rules, 0 dependencies; baseline 5 rule-file entries (69 findings); workflow rules have no baseline.

Stage 4: tools/ci-local/run-all.sh (8 checks, 1 conditional), docs/job38/PRIVATE-REPOS.md (text only).

Next step: Stage 5 wrap slip.
