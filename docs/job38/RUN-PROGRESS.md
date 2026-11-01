# JOB 38 · CI and Lint Hardening · run progress

Rewritten after every stage. Counts only, no private values.

| Stage | Branch | PR | Tests | ACCEPT | Parked |
|---|---|---|---|---|---|
| 0 Read and report | none | none | read only | PASS (slip 01) | 2 |
| 1 Pin and permissions | claude/job38-1-pin | see slip | see PR | pending CI | 0 |
| 2 Timeouts, concurrency, path filters | claude/job38-2-limits (stacked on 1) | see slip | see PR | pending CI | 1 |

Stage 1 findings: 9 workflows, 8 distinct action SHAs, all full-length and genuine; 1 top-level permission widened beyond contents read (fix-needs-test.yml), now moved to its job.

Stage 2: concurrency added to 5 workflows (now 9 of 9); 1 timeout raised (pages gate 15 to 20); 1 docs-only switch in tests.yml (8 of 8 local scenarios correct).

Next step: Stage 3 (claude/job38-3-lint).
