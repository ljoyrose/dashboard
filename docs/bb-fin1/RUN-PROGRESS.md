# RUN-PROGRESS: JOB BB-FIN.1 Breed Better finish and harden

Rewritten after each stage. Times Europe/London. Public repo: code and invented test data only.

| Stage | State | Evidence |
|---|---|---|
| 0 Pre-flight | done 12 Nov 2026 20:31 | both repos reachable, push probes pass |
| 1 Test sweep + properties + mutation | done | node 54 -> 75 tests on PR #491, all pass; 11/11 mutants caught (tools/bb-mutate/run.mjs) |
| 2 Inspector acceptance on | done | PR #492: S10.1-S10.6 run against the staff inspect page, script mocked; 0 fixme |
| 3 Gap audit | done | GAPS.csv (110 rows) in the private Drive CHANGES folder; 0 rows left as "this job" |
| 4 Gap fixes | handed on | 7 small page/test fixes listed in CONTINUE_PROMPT.md (context split mark reached) |
| 5 Schema contract | done | PR #493 contract test; drift report in the private repo (docs/CONTRACT-2026-11-12.md) |
| 6 Go-live kit | done | private repo docs/go-live/ (4 files) and copied to CHANGES |

## Defects found by the new tests and fixed (PR #491, verdict-deciding)

1. An answer no rule knows was scored 0 (when_missing zero) or made the gate Fail (when_missing fail). Now held as unverified and flagged.
2. Points with decimals drifted (0.1 + 0.2 + 0.3), so a target equal to the sum could read Below target. Totals rounded to 6 places.
3. A percent target could need more than the animal can earn (100% of 0.6 = 1). Capped for targets up to 100%.
4. The hub view reused old results when a table was re-read with the same number of rows.
5. A must-pass check set to skip let a missing record drop out (animal could Pass). Now refused.

None changes a live verdict today (live rule rows checked, rules only).
