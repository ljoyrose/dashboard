# JOB 38 · CI and Lint Hardening · run progress

Rewritten after every stage. Counts only, no private values.

| Stage | Branch | PR | Tests | ACCEPT | Parked |
|---|---|---|---|---|---|
| 0 Read and report | none | none | read only | PASS (slip 01) | 2 |
| 1 Pin and permissions | claude/job38-1-pin | see slip | see PR | pending CI | 0 |

Stage 1 findings: 9 workflows, 8 distinct action SHAs, all full-length and genuine; 1 top-level permission widened beyond contents read (fix-needs-test.yml), now moved to its job.

Next step: Stage 2 (claude/job38-2-limits, stacked on Stage 1).
