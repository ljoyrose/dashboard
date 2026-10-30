# JOB 31 Hub Data Contracts: run progress

Counts only. No private values.

| Stage | Branch | PR | Tests | ACCEPT | Parked |
|---|---|---|---|---|---|
| 0 Read and report | none | none | none | PASS: slip 01 table (Food 8 tabs, Marketplace 3 files, Studio 1 JSON with 29 keys) | 4 |
| 1 Expected shapes | claude/job31-1-shapes | #161 | header-contract 12/12 | PASS: make-expected.js rebuilds both files with no diff | 4 |
| 2 Dummy data and tests | claude/job31-2-tests (stacked on stage 1) | see slip 03 | contract 45/45 green; 27/27 failure cases red under CONTRACT_PROVE_RED=1; guards 35/35 | PASS | 4 |

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

## Next step
Stage 3: extend check-real-headers.js to the three hubs; dry run with fixtures prints counts only.
