# RUN-PROGRESS: JOB BB-FIN.1 Breed Better finish and harden

Rewritten after each stage. Times Europe/London. Public repo: code and invented test data only.

| Stage | State | Evidence |
|---|---|---|
| 0 Pre-flight | done 12 Nov 2026 20:31 | both repos reachable, push probes pass |
| 1 Test sweep + properties + mutation | done | node 54 -> 74 tests, all pass; 10/10 mutants caught (tools/bb-mutate/run.mjs) |
| 2 Inspector acceptance on | done | S10.1-S10.6 run against the staff inspect page, script mocked; 0 fixme left |
| 3 Gap audit | next | GAPS.csv to CHANGES |
| 4 Gap fixes | to do | |
| 5 Schema contract | to do | contract test here, drift report in the private repo |
| 6 Go-live kit | to do | private repo docs/go-live/ + CHANGES |

## Defects found by the new tests and fixed (calculator, verdict-deciding)

1. An answer no rule knows was scored 0 (when_missing zero) or made the gate Fail (when_missing fail). Now held as unverified and flagged.
2. Points with decimals drifted (0.1 + 0.2 + 0.3 = 0.6000000000000001), so a target equal to the sum could read Below target. Totals now rounded to 6 places.
3. A percent target rounded up to whole points could need more than the animal can earn (100% of 0.6 = 1). Now capped at what can be earned for targets up to 100%.
4. The hub view reused old results when a table was re-read with the same number of rows. Now it reuses only when every table is the very same one.
