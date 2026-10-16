# PRACTICE RUN - the whole flow in a COPIED Drive folder (for the bot)

Lisa agreed this (S02-8 A): **the bot does the practice run in a copied folder. Nothing in the live folder.**
Written 16 Oct 2026 by claude-job4. Nothing in this file has been run on real Google yet: every "expected" below is **UNVERIFIED** until the bot runs it.

## Ground rules (read first)

1. **Never touch the live BLD-app-tables folder.** Not to read-and-write, not to "just check". Reading it to make the copy is fine. Every `create`, `update`, `rename`, `move` and `delete` goes to the practice folder only.
2. **Before any write, say which folder id you are about to write to, and check it is NOT the id of the live BLD-app-tables folder** (the bot has that id; it is deliberately not written in this repository). If the ids match, stop.
3. Use only **made-up staff names and codes** (below). Never use a real person's name, a real code or a real email in the practice Script Properties, except Lisa's own Google address in `ADMIN_EMAILS` so she can open the owner page.
4. Nothing is merged, nothing is deleted. If a step fails, **stop, write down the exact words of the failure, and carry on only with steps that do not depend on it.**
5. Report as you go in one line per step: `P<n> PASS` / `P<n> FAIL: <exact message>` / `P<n> SKIPPED: <why>`.

## Steps

**P1. Make the practice folder.**
In `lisa@puppyclassroom.com` My Drive make a folder `BLD practice` (no spaces issue: exactly that). Note its id. Copy into it **these live files** (copy, do not move): `BLD-area.csv`, `BLD-subject.csv`, `BLD-subject_status.csv`, `BLD-occupancy.csv`, `BLD-person.csv`, `BLD-role.csv`, `BLD-field_visibility.csv`, `BLD-tenant.csv`. Check each copy's size equals the original's.

**P2. Install the script.**
Follow `docs/SETUP.md` section A in a new Apps Script project named `BLD save PRACTICE`: ten `.gs` files, `ApprovePage.html`, `appsscript.json`. After pasting, compare each file's size with the repository copy (`cdhub-write/apps-script/`).

**P3. Settings (practice folder only).**
Script Properties: `BLD_FOLDER_ID` = the practice folder id (**not** the live one), `TENANT_ID` = the `id` in the first data row of the practice `BLD-tenant.csv`, `ADMIN_EMAILS` = Lisa's Google address. Run `adminSetup`.

**P4. Codes.**
Run `adminAddStaffCode` three times: `Practice Staff` (STAFF), `Practice Leaver` (STAFF), `Practice Owner` (OWNER). Keep the three codes and their code ids (`adminListStaff`) in the run notes only. They are made-up and are discarded after the run. Expected: each run logs a code and an id like `sc-xxxxxx`.

**P5. The new files.**
Set `ALLOW_CREATE` = `true`, run `adminCreateEmptyTables`, set `ALLOW_CREATE` back to `false`. Expected: `BLD-area_reading.csv`, `BLD-occupancy_check.csv` and `BLD-_pending.csv` exist in the practice folder with a header line only. Run `adminCheckSetup`: every line `OK` or `--`.

**P6. Missing rooms (one-off back-fill, on the copy).**
Get Lisa's register (columns `dog_id`, `room_code`). On the bot's own computer run, from the repository folder:
`node tools/backfill-rooms.js --register register.csv --occupancy <practice BLD-occupancy.csv, downloaded> --areas <practice BLD-area.csv, downloaded> --tenant <TENANT_ID> --date <today> --out new-rows.csv`
Read the report on screen. Expected: it only says `filled`, `already_there`, `conflict` etc.; **conflicts are not changed**. Append the rows of `new-rows.csv` (without its header line) to the **practice** `BLD-occupancy.csv` by uploading a new version of that one file, then check: the old part of the file is byte-for-byte the same (compare the first N bytes of the old file), and the dogs that had no room now show one. Keep the report for Lisa. **The live file is not touched in this run.**

**P7. Permission rows (practice copy only).**
Open `docs/AA_2026-10-16_JOB4-PROPOSED-visibility-rows__claude-job4.csv` (**42 rows**, CRLF). Replace `ten-REPLACE-ME` with the practice tenant id and append the rows to the practice `BLD-field_visibility.csv`. Check there is no row for `area_reading` with audience `aud-staff`. Then add **one test override**: a row for table `occupancy`, field `*`, audience `person:<Practice Leaver's code id>`, visible `no`.

**P8. Switch on (practice only).**
Properties: `SAVE_ENABLED`=`true`, `TABLE_ON_area_reading`=`true`, `TABLE_ON_occupancy`=`true`, `TABLE_ON_occupancy_check`=`true`, `READ_ENABLED`=`true`, `OWNER_EDIT_ENABLED`=`true`. Run `adminStartMovesQueue`. Deploy the two web apps (SETUP steps 10 and 11).

**P9. Checks.** For each, record the exact answer. Send requests exactly as the screens do (`POST`, body as `text/plain`, see `client/bld-save.js`).

| # | Do this | Expected (UNVERIFIED until run) |
|---|---|---|
| 9.1 | `GET` the Save URL | JSON: `saveEnabled` true, `readEnabled` true, tables `area_reading`, `occupancy`, `occupancy_check`; no code, no tenant id, no folder id |
| 9.2 | Open the Save URL from a browser page on another origin (the staff screen) and do a read | works without a sign-in (this proves CORS); if the browser blocks it, record the console error |
| 9.3 | Read `area`, `subject`, `occupancy`, `subject_status` with the Practice Staff code | rows come back; no `tenant_id`; no `dob` or `chip_number` |
| 9.4 | Read `area_reading` with the Practice Staff code | `NOT_ALLOWED` (staff see no past entries) |
| 9.5 | Read `area_reading` with a wrong code | `BAD_CODE`, no rows |
| 9.6 | Save one temperature with the Practice Staff code | `saved`; one new line in `BLD-area_reading.csv`; nothing above it changed |
| 9.7 | Read `area_reading` with the Practice Staff code again | still `NOT_ALLOWED`; with the Practice Owner code: one row |
| 9.8 | Send a `correct` request with the Practice Staff code | `NOT_ALLOWED` |
| 9.9 | Save one move with the Practice Staff code | `queued` (inside the 14 days); nothing new in `BLD-occupancy.csv` yet |
| 9.10 | On the owner page (signed in as Lisa) press **Approve** | one new line at the bottom of the practice `BLD-occupancy.csv`; `moved_in` is today; `moved_out` empty |
| 9.11 | Press **All the rest unmoved** on the staff screen (or send the request) | one new line in `BLD-occupancy_check.csv`: `confirmed_by` is the staff **code id** (not the name, not the code), `dog_ids` pipe-separated, the moved dog is not in it |
| 9.12 | Send the same confirmation again at once | `DUPLICATE`, no second line |
| 9.13 | Read `occupancy` with the Practice Leaver code | `NOT_ALLOWED` (the person row beats the role row); Practice Staff still reads it |
| 9.14 | Owner page, **Staff codes**, switch off Practice Leaver | "Switched off"; a line `code_revoke` appears at the end of `BLD-_pending.csv` with no code and no hash in it |
| 9.15 | Read and save with the Practice Leaver code | both refused at once (`BAD_CODE`) |
| 9.16 | Owner page, **Edit an entry**, change the temperature saved in 9.6, tick the box | the value in that one line changes; **every other line is byte-for-byte the same**; no record of the old value in `BLD-_pending.csv` |
| 9.17 | Try the owner page while signed in to a different Google account | refused (`for the kennel owner` message), nothing editable |
| 9.18 | Run `adminCheckSetup` | no `FIX` lines |

**P10. Work out what real Google does differently.** Anything that behaved differently from the fake Drive the tests use (line endings, a file that became a Google Sheet, a Drive version history entry per save, lock waits, slow saves with a big file, `getContent` limits): write it down with the exact words. These are the things the 138 offline tests cannot prove.

**P11. Switch off and leave tidy.**
Set `SAVE_ENABLED`, `READ_ENABLED` and `OWNER_EDIT_ENABLED` to `false`. In **Deploy > Manage deployments** archive both practice deployments. **Do not delete the practice folder or its files** - leave them for Lisa to look at. Make sure the live folder has no new or changed file (compare the listing from P1).

**P12. Report to Lisa** in one screen: how many of 9.1 to 9.18 passed; the failures in the exact words; the list of anything surprising from P10; and one line saying "the live folder was not touched" with the listing check from P11. Then the bot logs the practice folder id and the script project name in its own notes for the real go-live.

## What the practice run still cannot prove

It cannot prove behaviour with several staff saving at the same moment (the lock is tested offline only), nor a very large `BLD-occupancy.csv` (the live file has hundreds of rows; try the real size in the practice copy and time one save), nor that Bloodline loads The Board's fonts on the staff phones.
