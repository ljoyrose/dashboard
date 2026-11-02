# cdhub-write: gated write path for BLD (CD Hub is Bloodline)

A way for staff to save room temperatures and confirm where each dog is, without ever overwriting or deleting anything. Only the owner can fix an entry in place. **Built and tested on FAKE data. Nothing is on. No live file was touched.**

## How the pieces fit

```
Bloodline screens (BLDScreens)  ->  BLDSave (checks, sends ONE POST)  ->  Apps Script web app
 Where is everyone? / Enter temperatures                                    |  staff code, allow-list, field checks, lock
                                                                             v
 approvals queue  BLD-_pending.csv --Lisa approves-->  BLD-occupancy.csv / BLD-area_reading.csv (one new line)
 (or straight in: temperatures and the daily check log by default; moves after the 14-day queue period, or if Lisa sets MODE_occupancy=direct)

 Staff READ the lists they need with the same code:   screens -> BLDSave.read -> script read action -> only what BLD-field_visibility.csv allows
 Lisa only (her Google account, owner page):         Edit an entry -> overwrites ONE record in place, no record kept
                                                      Staff codes -> switch a code off (kept in the list, refused at once)
```

`drive.readonly` is only for Lisa's own sign-in. Staff never sign in to Google.

## What is ON and OFF

| Thing | State |
|---|---|
| Saving (`SAVE_ENABLED`) | **OFF** until Lisa sets it |
| Allow-list | **four files only**: `BLD-area_reading.csv`, `BLD-occupancy.csv` (own switch `TABLE_ON_occupancy`, off), `BLD-occupancy_check.csv` (own switch `TABLE_ON_occupancy_check`, off), `BLD-_pending.csv` |
| Staff roster (`BLD-staff.csv`) | **proposed only**, on a separate list in the code, refused until agreed |
| `round_event` | **retired** (kept in the code, refused) |
| Temperature readings | straight in once saving is on; staff see no past entries and cannot correct; the owner fixes wrong ones (owner edit, or an owner correction row that waits in the approvals queue) |
| Dog moves | approvals queue until `MOVES_QUEUE_UNTIL` (14 days from go-live: `adminStartMovesQueue`), then straight in; `MODE_occupancy` beats the date |
| Daily check ("All the rest unmoved") | one row per tap in `BLD-occupancy_check.csv`, straight in once its switch is on |
| Staff reading (`READ_ENABLED`) | **OFF**; default deny: no permission row means nothing is shown |
| Owner edit (`OWNER_EDIT_ENABLED`) | **OFF**; owner page only; no record kept |
| Script URL | **not set**; screens show "Saving is off" |
| Files on Drive | nothing created or changed; Lisa creates the two new files (SETUP step 7) |
| Daily backup copy | optional, **OFF** (`BACKUP_ON`) |
| Old `/cdhub/` | untouched |

**Do not hand-edit the files in Drive.** A save rewrites the whole file with one line added (Drive has no true "append"), so a hand edit at the same moment could collide. Safeguards: hash check before and after, exact restore if the read-back check fails, a log line in the approvals queue, and the optional daily backup.

## Folders

- `apps-script/` the script files (ten `.gs`), `appsscript.json`, approvals page
- `client/` `bld-save.js`, `bands.js`, `occupancy.js`, `drive-lookups.js`, standalone test page
- `screens/` `screens.js`, `bld-save.css`
- `wired/` the Bloodline patch and script (in use); `board-dropin.js` (parked, not used)
- `tools/` `backfill-rooms.js` (one-off: new occupancy rows only, never edits)
- `tests/` fake fixtures and the tests (run from this folder: `npm install && npm test`)
- `docs/` SETUP.md (for Lisa), PRACTICE-RUN.md (for the bot), design note, MAP note, options note, Q&A slips, proposed permission rows (two `.csv` files, CRLF)
- `PROGRESS.md` what is done and what is next; `HANDOVER.md` state, decisions, ids

## Run the tests

```
npm install      # jsdom (needed: the screen tests must run, they are never skipped)
npm test         # no network, no Google account
npm run fixtures # writes the FAKE sample CSVs to tests/fixtures/
```

Tests use made-up data only (tenant `ten-test`) and never touch Drive.

## Where these files live

The repo copy is in PR #10 (`cdhub-write/`). The Drive copy (folder `JOB4_CDHUB-WRITEPATH` > `v3`) is this same folder, put there by the bot from `AA_JOB4_v3_cdhub-write.zip`; see HANDOVER.md.

## Start here

Lisa: `docs/SETUP.md`, then `AA_JOB4_SLIP_03.md`. The bot: `docs/PRACTICE-RUN.md`. Reviewers: `docs/AA_2026-10-15_JOB4-DESIGN-NOTE__claude-job4.md` (sections 10 and 11 are the v2 and v3 follow-ups).
