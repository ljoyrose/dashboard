# JOB 31b Hub Data Contracts B · RUN-PROGRESS

Sibling of JOB 31 (Food, Marketplace, Studio). JOB 31b covers the hubs JOB 31 did not reach: Factory and Home,
plus named-failure proofs for Money and CD Hub (column lists were already pinned). Counts only, no private values.
All three branches are stacked on claude/job31-4-wiring (#174) and touch no file in JOB 31's PRs or in each other.

| Stage | Branch | PR | Tests | ACCEPT |
|---|---|---|---|---|
| 0 read | none | none | read only | PASS: Factory 1 file; Home 2 files |
| 1 Factory | claude/job31b-1-factory | #182 | 15/15 green; 12/12 red under CONTRACT_PROVE_RED=1; rebuild no diff | PASS |
| 2 Home | claude/job31b-2-home | #185 | 16/16 green; 12/12 red; rebuild no diff | PASS |
| 3 Money + CD Hub | claude/job31b-3-money-cdhub | #186 | 36/36 green; 8/8 red | PASS |

Mocked suite with JOB 31 + 31b contracts: 47 + 15 + 16 + 36. Privacy guard CLEAN on every branch (DENY placeholder; CI runs real).
Merge order (Lisa only): #161 → #162 → #163 → #174, then #182, #185, #186 in any order.
Parked: required-field choices (see each PR). Next: none; watch CI.
