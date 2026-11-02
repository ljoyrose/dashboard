# HANDOVER - Job 4, CD Hub write path, v3 (Lisa's answers to slip 02, 16 Oct 2026)

Written 16 Oct 2026 by claude-job4. Replaces the v2 handover (the v2 copy stays in the Drive folder `JOB4_CDHUB-WRITEPATH_v2` until the archive checklist below is done).

## State

- **Built and tested on FAKE data: 139 tests pass, 0 skipped** (`npm install && npm test`; the same number the last run printed). Test files: `tests/sink.test.js`, `tests/client.test.js`, `tests/v3.test.js`, `tests/backfill.test.js`.
- **Nothing is on.** No Script URL, no switches, no file created on Drive, no live CSV touched. Saving, staff reading, owner edit and the new daily check log are all OFF. Drive was read-only for this run.
- **Not run on real Google.** First real run = `docs/PRACTICE-RUN.md` in a COPIED folder (the bot). CORS from a browser, the Board fonts in Bloodline, the read action, the owner edit, the code switch-off and person permission rows were only tried against a fake Drive. All **UNVERIFIED**.
- PR #10 (open, not merged): https://github.com/ljoyrose/dashboard/pull/10 (branch `claude/job4-cdhub-write-path`, folder `cdhub-write/`). The head commit is named in `AA_JOB4_SLIP_03.md` (that file is in the zip, not in the repo, so it can name the commit).

## What v3 added (each of Lisa's answers, S02-1 to S02-8 and the extra)

1. **S02-3 A, S02-4 D - permissions.** `docs/AA_2026-10-16_JOB4-PROPOSED-visibility-rows__claude-job4.csv` now has **42 rows** (fv-p018 to fv-p024 removed; the rest exactly as written). `tp-p01` read = "owner (all)". Staff see no past temperature entries, not even their own; the screen has no "pick an old entry to correct" and says "Wrong entry? Tell the owner - she can fix it."; a staff code can no longer send `correct`. Both proposed CSVs keep CRLF.
2. **Extra - per-person rows.** `audience_id` = `person:<code id>` rows sit on top of the role rows: person beats role, no person row = role default, default deny stays. `apps-script/Read.gs`.
3. **2b - owner revokes staff codes.** Owner page, **Staff codes**: the entry is kept (`active` false, `revoked_at`, `revoked_by`), the code is refused at once on read and write, one `code_revoke` line is appended to `BLD-_pending.csv` (no code, no hash). `apps-script/Auth.gs`, `Web.gs`, `ApprovePage.html`.
4. **S02-5 A - owner edit** unchanged: no record kept, own switch, default OFF (test added).
5. **S02-1 - "All the rest unmoved".** New `BLD-occupancy_check.csv` (`id, tenant_id, confirmed_at, confirmed_by, dog_ids, moved_count, note`) on the allow-list behind `TABLE_ON_occupancy_check` (OFF). Staff tap **Moved** for movers; one button appends ONE row. Tested with 150 dogs.
6. **S02-2 A - moves queue 14 days then straight in.** `MOVES_QUEUE_UNTIL`; `adminStartMovesQueue` on go-live day.
7. **S02-7 B - not on site.** sold / owned_by_family / Collected / deceased are left off the daily check; `off_site_temp` shows as **Away**, keeps its room, is not asked to move.
8. **S02-6 B - missing rooms.** `tools/backfill-rooms.js` (new rows only, never edits).
9. **S02-8 A - practice run.** `docs/PRACTICE-RUN.md`.
10. **Drive-copy fixes.** `package.json` is in the zip; the patch is checked by a test with `git apply --check`; this file's test count is the real count.

## Where things are

- The zip `AA_JOB4_v3_cdhub-write.zip` holds the whole `cdhub-write/` folder (repo layout: `apps-script/`, `client/`, `screens/`, `wired/`, `tools/`, `tests/`, `docs/`, `README.md`, `HANDOVER.md`, `PROGRESS.md`, `package.json`, `package-lock.json`, `.gitignore`) plus `AA_JOB4_SLIP_03.md` at the top. **The owner drops the zip in the bot chat; the bot uploads it to the owner's Drive folder JOB4_CDHUB-WRITEPATH/v3 (the folder id is not stored in this repository)**, unzips, checks every hash in the slip, then runs `npm install && npm test`.
- Nothing was uploaded to Drive by this run (the brief says the bot does it).

## For the bot (in order)

1. Upload the zip, unzip, verify each file's size and sha256 against `AA_JOB4_SLIP_03.md`, run `npm install && npm test` (expect 139 pass, 0 skipped).
2. Run `docs/PRACTICE-RUN.md` in a COPIED folder. Never the live folder.
3. Check what else reads `BLD-field_visibility.csv` (slip question 1/4): does anything reject an audience that is not in `BLD-audience.csv`?
4. When Lisa supplies her register: run `tools/backfill-rooms.js` on a copy (PRACTICE-RUN P6), show Lisa the report, then decide about the live file.
5. Log the archive checklist rows below in `RR_DELETE-LEDGER.csv` (00 AI Commons) only after step 1 passes.

## Archive checklist (proposals only; nothing was renamed, marked or deleted by this run)

Superseded by v3 and proposed as `ZZ_DELETE_<old name>` for the bot to log (columns date, old_name, file_id, merged_into, agent) **after** the v3 upload is verified. v1 and v2 are `AA_`/working files, not `RR_`/`SS_`; the protocol's E01 rule allows binning only merged slips, so the bot should confirm each one is merged into v3 first.

| Drive file (owner's My Drive; ids not stored in this repository) | id | merged into (v3) |
|---|---|---|
| `HANDOVER.md` in `JOB4_CDHUB-WRITEPATH_v2` | id-not-in-repo | `HANDOVER.md` in the zip |
| `README.md` in v2 | id-not-in-repo | `README.md` |
| `PROGRESS.md` in v2 | id-not-in-repo | `PROGRESS.md` |
| `gitignore.txt` in v2 | id-not-in-repo | `.gitignore` |
| `package-lock.json` in v2 | id-not-in-repo | `package-lock.json` (unchanged content: jsdom only) |
| `AA_JOB4_SLIP_02.md` in v2 | id-not-in-repo | answered by `AA_JOB4_SLIP_02_ANSWERS.md` (id id-not-in-repo), merged into `AA_JOB4_SLIP_03.md` and the docs |
| `AA_JOB4_PROMPT_v3.md` in v2 | id-not-in-repo | superseded by `AA_JOB4_PROMPT_v3c` (this run's prompt) |
| `AA_2026-10-15_JOB4-OPTIONS__claude-job4.md` in v2/docs | id-not-in-repo | `docs/` same name (v3 section added) |
| `AA_2026-10-15_JOB4-MAP-NOTE__claude-job4.md` in v2/docs | id-not-in-repo | `docs/` same name |
| `AA_2026-10-15_JOB4-DESIGN-NOTE__claude-job4.md` in v2/docs | id-not-in-repo | `docs/` same name |
| `AA_2026-10-16_JOB4-PROPOSED-visibility-rows__claude-job4.csv` in v2/docs (49 rows) | id-not-in-repo | `docs/` same name (42 rows) |
| `AA_2026-10-16_JOB4-PROPOSED-table_policy-rows__claude-job4.csv` in v2/docs | id-not-in-repo | `docs/` same name |
| Folders `code`, `tests`, `docs` in v2 | id-not-in-repo, id-not-in-repo, id-not-in-repo | the same paths in v3 (folders take a kill marker only when every child is already marked and verified: K-02) |
| Folder `JOB4_CDHUB-WRITEPATH_v2` | id-not-in-repo | `.../JOB4_CDHUB-WRITEPATH/v3` (id-not-in-repo) |

Not listed because this run could not list them (the connector pages 5 to 19 items; I paged only the v2 root and its `docs` folder): the other children of v2 `code/`, `tests/` and `docs/` (for example `SETUP.md`, the screens, the `.gs` files, the tests). **The bot lists them by folder id and adds them** (UNVERIFIED that the list above is complete).

All of `JOB4_CDHUB-WRITEPATH_v1` (folder id id-not-in-repo) is superseded by v2 and so by v3; one v1 file was already renamed `SS_` earlier (the v1 Q&A rows file) and is **kept** (SS_ is never auto-killed). The v1 `SS_` file is not on this list.

## Facts found this time

- `package-lock.json` is already on Drive in v2 (the bot uploaded it); `package.json` is in the zip.
- The staff-code registry is a Script Property, not a Drive table (so "append a revoke row to the codes table" was done as: keep the entry, mark it revoked, append a `code_revoke` line to `BLD-_pending.csv`). Slip question 2/4.
- The duplicate-entry refusal still tells staff that an entry for that room exists in the last 30 minutes (and its id). It now says "tell the owner".
- `moved_count` in the daily check log is sent by the screen and is not checked by the script.

## Not done

Open-Meteo outdoor temperature, data-health script, humidity/clean/check readings, staff hours, the staff roster (proposed only), any live CSV change, the back-fill itself (the tool is ready; it needs Lisa's register), a view for the owner of "which dogs were not confirmed today".

## Next

1. Lisa answers `AA_JOB4_SLIP_03.md` (the bot creates `AA_JOB4_SLIP_03_ANSWERS.md`).
2. Bot: upload, verify, test, practice run.
3. Fix whatever real Google shows; then Lisa decides about go-live. PR #10 is not merged.

## Naming

Docs follow `AA_<date>_<stem>__<author>`; SETUP, README, HANDOVER, PROGRESS, PRACTICE-RUN keep their asked-for names; the slip is `AA_JOB4_SLIP_03.md` as asked. No temp files were made (no `ZZ_DELETE_TT_` files to list).
