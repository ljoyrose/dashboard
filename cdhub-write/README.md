# cdhub-write: gated, append-only write path for BLD (CD Hub is Bloodline)

A way for staff to save room temperatures into the BLD temperature log without ever overwriting or deleting anything. **Built and tested on FAKE data. Nothing is on. No live file was touched.**

## How the pieces fit

```
Bloodline screen (BLDScreens)  ->  BLDSave (checks, sends ONE POST)  ->  Apps Script web app
                                                                          |  staff code, allow-list, field checks, lock
                                                                          v
              waiting list  BLD-_pending.csv  --Lisa approves-->  BLD-area_reading.csv (one new line)
              (or straight in, if Lisa sets MODE_area_reading=direct)
```

The page stays on `drive.readonly`. Only the script writes.

## What is ON and OFF

| Thing | State |
|---|---|
| Saving (`SAVE_ENABLED`) | **OFF** until Lisa sets it |
| Allow-list | **two files only**: `BLD-area_reading.csv`, `BLD-_pending.csv` |
| Cabin placement log, staff roster | **proposed only**, kept in code on a separate list, refused until agreed |
| Mode | **pending** (everything waits for Lisa) unless she sets `direct`; corrections always wait |
| Script URL | **not set**; screens show "Saving is off" |
| Files on Drive | nothing created; Lisa creates the two files (SETUP step 7) |
| Daily backup copy | optional, **OFF** (`BACKUP_ON`) |
| Old `/cdhub/` | untouched |

**Do not hand-edit the two files in Drive.** A save rewrites the whole file with one line added (Drive has no true "append"), so a hand edit at the same moment could collide. Safeguards: hash check before and after, exact restore if the read-back check fails, a log line in the waiting list, and the optional daily backup.

## Folders

- `apps-script/` the script files, `appsscript.json`, approval page
- `client/` `bld-save.js`, `bands.js`, `drive-lookups.js`, standalone test page
- `screens/` `screens.js`, `bld-save.css`
- `wired/` the Bloodline patch and script (in use); `board-dropin.js` (parked, not used)
- `tests/` fake fixtures and the tests
- `docs/` SETUP.md (for Lisa), design note, MAP note, options note
- `PROGRESS.md` what is done and what is next

## Run the tests

```
npm install      # jsdom (needed: the screen tests must run, they are never skipped)
npm test         # no network, no Google account
npm run fixtures # writes the FAKE sample CSVs to tests/fixtures/
```

Tests use made-up data only (tenant `ten-test`) and never touch Drive.

## Start here

Lisa: `docs/SETUP.md`. Reviewers: `docs/AA_2026-10-15_JOB4-DESIGN-NOTE__claude-job4.md`.
