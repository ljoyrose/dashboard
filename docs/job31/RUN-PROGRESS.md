# JOB 31 Hub Data Contracts: run progress

Counts only. No private values.

| Stage | Branch | PR | Tests | ACCEPT | Parked |
|---|---|---|---|---|---|
| 0 Read and report | none | none | none | PASS: slip 01 table (Food 8 tabs, Marketplace 3 files, Studio 1 JSON with 29 keys) | 4 |
| 1 Expected shapes | claude/job31-1-shapes | #161 | header-contract 12/12 | PASS: make-expected.js rebuilds both files with no diff | 4 |
| 2 Dummy data and tests | claude/job31-2-tests (stacked on stage 1) | #162 | contract 45/45 green; 27/27 failure cases red under CONTRACT_PROVE_RED=1; guards 35/35 | PASS | 4 |
| 3 Live header check hook | claude/job31-3-live (stacked on stage 2) | see slip 04 | contract 47/47; prove-red case red; header-contract 12/12 | PASS: --dry-run on fixtures prints 2 count lines only (40 files, 0 problems) | 5 |

## Stage 1 detail
- `tests/contract/expected-headers.json` gains `food` (8 tabs: Cards by position, 7 by header row) and `marketplace` (Open work tab by position, RR_LISTINGS.csv by header).
- `tests/contract/expected-state.json` (new sibling): JSON state files need nested names and JS types, which the flat column-list format cannot hold. Studio: 29 top-level keys, 47 nested paths, 364 field names; 5 paths with required fields. Marketplace wake file: 1 field.
- Sources: invented fixtures `tests/fixtures/food/book.json`, `tests/fixtures/marketplace/RR_LISTINGS.csv`, `tests/fixtures/marketplace/MKT-WAKE-WEBAPP.json`, `tests/fixtures/studio/contract-state.json` (new; JOB 3's `state.js` untouched), plus the page constants `CARD_COLS`, `RANGES`, `COLS`.
- Rebuild also refreshed one CD Hub line: the page now reads `born_on` in BLD-litter.csv; main's list was stale.

## Stage 2 detail
- `tests/contract/shape.js`: shared checks with named codes MISSING, RENAMED, EXTRA, WRONG_TYPE, EMPTY. Runs the page's own code (food `table()`, marketplace `csvRows()`, studio `prep()`) pulled from each page by brace matching.
- Specs: `food.contract.spec.js` (18 tests), `marketplace.contract.spec.js` (14), `studio.contract.spec.js` (12, incl. JOB 3's existing fixture passing the contract).
- Fixtures: invented rows added to `food/book.json`; new `marketplace/open-work.json`.
- expected-state.json: Studio top level now requires the 21 keys the page's schema comment says the engine writes.
- Wiring: no Playwright project runs `tests/contract/` yet (config is out of scope). Run with a wrapper config outside the repo (testDir = tests/contract). Parked for Lisa.

## Stage 3 detail
- No workflow runs the live check: it is the local, no-sign-in script `node tests/contract/check-real-headers.js <folder>` (TESTS.md). No workflow file or secret was added.
- It now also reads RR_FOOD tabs downloaded as CSV (`RR_FOOD - <Tab>.csv`), the Open work tab (`... - Marketplace.csv`), RR_LISTINGS.csv, MKT-WAKE-WEBAPP.json and studio-state.json. Money and CD Hub output is unchanged.
- `--dry-run` builds that folder from the invented fixtures and prints counts only. `--counts` does the same for real files.
- `live-check.contract.spec.js` (2 tests): the dry run prints counts only; a broken folder is counted as RENAMED 1, WRONG_TYPE 1, EMPTY 1.
- TESTS.md (outside this job's paths) does not mention the new hubs yet: parked.

## Next step
All three stages done. Waiting on Lisa: merges (#161, then #162, then Stage 3) and the parked items in the slips.
