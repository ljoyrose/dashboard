# Job 4: CD Hub write path (BLD)

A gated, append-only way for staff to save room temperatures (and, later, cabin placements and the staff roster) into the BLD CSV files, without ever overwriting or deleting anything. **Built and tested on FAKE data. Nothing is on. No live file was touched.**

## How the pieces fit

```
phone screen (BLDScreens)  ->  BLDSave (checks, sends ONE POST)  ->  Apps Script web app
                                                                     |  staff code, allow-list, field checks, lock
                                                                     v
                       pending list  BLD-_pending.csv  --Lisa approves-->  BLD-area_reading.csv (one new line)
                       (or straight in, if Lisa sets MODE=direct)
```

The page stays on `drive.readonly`. Only the script writes.

## What is ON and OFF

| Thing | State |
|---|---|
| Saving (`SAVE_ENABLED`) | **OFF** until Lisa sets it |
| Each table (`TABLE_ON_<table>`) | **OFF** until Lisa sets it |
| Mode | **pending** (everything waits for Lisa) unless she sets `direct` |
| Corrections, staff roster | always pending |
| Script URL | **not set**; screens show "Saving is off" |
| Files on Drive | nothing created; Lisa creates `BLD-area_reading.csv` and `BLD-_pending.csv` (SETUP step 7) |
| Old `/cdhub/` | untouched; PR adds a new path |

## Folders

- `docs/` SETUP.md (for Lisa) and the design note (MAP note, options and Q&A rows are kept in Drive, not in this public repo)
- `apps-script/` the 9 script files, `appsscript.json`, approval page
- `client/` `bld-save.js`, `bands.js`, `drive-lookups.js`, test page `index.html`
- `screens/` `screens.js`, `bld-save.css`
- `wired/` Bloodline patch and script, Board drop-in
- `tests/` fake fixtures and 51 tests (`npm install` then `npm test`; the UI tests need `jsdom`)

## Run the tests

```
npm install      # jsdom only
npm test         # 51 tests, no network, no Google account
node tests/write-fixtures.js   # writes the FAKE sample CSVs to tests/fixtures/
```

Tests use made-up data only (tenant `ten-test`). They never touch Drive.

## Start here

Lisa: `docs/SETUP.md`. Anyone continuing: `HANDOVER.md`.
