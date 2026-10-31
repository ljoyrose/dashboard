# JOB 31 Hub Data Contracts: run progress

Counts only. No private values.

| Stage | Branch | PR | Tests | ACCEPT | Parked |
|---|---|---|---|---|---|
| 0 Read and report | none | none | none | PASS: slip 01 table (Food 8 tabs, Marketplace 3 files, Studio 1 JSON with 29 keys) | 4 |
| 1 Expected shapes | claude/job31-1-shapes | see slip 02 | header-contract 12/12 | PASS: make-expected.js rebuilds both files with no diff | 4 |

## Stage 1 detail
- `tests/contract/expected-headers.json` gains `food` (8 tabs: Cards by position, 7 by header row) and `marketplace` (Open work tab by position, RR_LISTINGS.csv by header).
- `tests/contract/expected-state.json` (new sibling): JSON state files need nested names and JS types, which the flat column-list format cannot hold. Studio: 29 top-level keys, 47 nested paths, 364 field names; 5 paths with required fields. Marketplace wake file: 1 field.
- Sources: invented fixtures `tests/fixtures/food/book.json`, `tests/fixtures/marketplace/RR_LISTINGS.csv`, `tests/fixtures/marketplace/MKT-WAKE-WEBAPP.json`, `tests/fixtures/studio/contract-state.json` (new; JOB 3's `state.js` untouched), plus the page constants `CARD_COLS`, `RANGES`, `COLS`.
- Rebuild also refreshed one CD Hub line: the page now reads `born_on` in BLD-litter.csv; main's list was stale.

## Next step
Stage 2: invented rows and one contract spec per hub (missing, renamed, extra, wrong type, empty), each proven red once then green.
